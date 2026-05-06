# Testing the mini-app end-to-end against a local backend

Use this when you want to drive the mini-app UI (e.g. `/settings`, `/profile`,
`/arbitrator`, `/admin`) against a real `user-service` backend without
standing up Telegram, Cryptomus, the Hardhat node, or the bot.

The test recipe matches what `scripts/local-e2e.sh` does for HTTP smoke, but
keeps the backend alive afterwards so the browser can talk to it.

## Prereqs (already in the repo)

- `services/user-service/dist/main.js` exists (`npm run build` if not)
- `mini-app/node_modules` populated (`npm install` if not)
- `docker` available
- `scripts/local-e2e.env` checked in — DO NOT edit it during a test, just `source` it

## Boot order

```bash
# 1. Throwaway postgres on :5499 (won't collide with docker-compose).
docker rm -f tg-garant-e2e-postgres >/dev/null 2>&1 || true
cd /home/ubuntu/repos/Telegram-garant-contract
set -a; . scripts/local-e2e.env; set +a
docker run -d --name tg-garant-e2e-postgres \
  -e POSTGRES_USER="$DB_USERNAME" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "${DB_PORT}:5432" postgres:15-alpine
until docker exec tg-garant-e2e-postgres \
  pg_isready -U "$DB_USERNAME" -d "$DB_NAME" >/dev/null 2>&1; do sleep 1; done

# 2. Backend (stub blockchain, stub telegram, stub redis).
cd services/user-service
( set -a; . ../../scripts/local-e2e.env; set +a; \
  nohup node dist/main.js > /tmp/backend.log 2>&1 & echo "PID=$!" )

# 3. Vite dev server, pointed at the local backend.
cd ../../mini-app
VITE_API_URL=http://localhost:3099/api \
  nohup ./node_modules/.bin/vite --host --port 5173 \
  > /tmp/mini-app.log 2>&1 & echo "PID=$!"
```

`ioredis` will spam `ECONNREFUSED 127.0.0.1:6399` in `/tmp/backend.log` —
ignore it, the backend lazily connects and we never hit redis in the smoke.

## Auth — bypass Telegram initData

`scripts/local-e2e.env` sets `AUTH_DEV_MODE=true` and the backend exposes
`POST /auth/dev-login` only when both `AUTH_DEV_MODE=true` AND
`NODE_ENV != production`. Use it to get a JWT directly:

```bash
curl -s -X POST http://localhost:3099/api/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"telegramId":99001,"username":"e2e_tester","firstName":"E2E","lastName":"Tester","languageCode":"ru"}' \
  | tee /tmp/dev-login.json
```

Response contains `accessToken`, `expiresIn`, and `user`. The mini-app reads
the token from `localStorage.auth_token` (key constant: `AUTH_TOKEN_STORAGE_KEY`
in `mini-app/src/api/index.ts`).

To skip the AuthGate "Telegram WebApp context not available" screen in a
browser test:

1. Navigate to `http://localhost:5173/` once (Auth bootstrap will fail
   gracefully — that's fine).
2. Set the token in the page's localStorage:
   ```js
   localStorage.setItem('auth_token', '<accessToken from dev-login>')
   ```
3. F5 reload — `useAuthBootstrap` sees an existing token, skips the
   initData exchange, calls `/users/me`, and renders the app.

Use `localhost:5173/profile`, `/settings`, `/deals`, etc. as direct entry
points — the bottom nav is fixed-positioned and gets hidden behind the Linux
desktop dock at y≈753 in our default browser size, so URL navigation is more
reliable than clicking the bottom nav.

## Driving `<input type="time">` from automation

The HTML5 time input has segmented hour/minute spinners — `triple_click` +
`type` only edits whichever segment is focused, so typing `2200` ends up as
weird values like `02:20`. Use the React-compatible value setter instead:

```js
const inputs = document.querySelectorAll('input[type=time]');
const target = inputs[1];                // 0 = start, 1 = end on /settings
const setter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype, 'value'
).set;
setter.call(target, '22:00');
target.dispatchEvent(new Event('input', { bubbles: true }));
```

This goes through the React `onChange` path correctly and updates state.

## Tearing down

```bash
kill $(cat /tmp/backend.pid 2>/dev/null) 2>/dev/null || true
pkill -f 'mini-app.*vite' 2>/dev/null || true
docker rm -f tg-garant-e2e-postgres 2>/dev/null || true
```

## Known cosmetic gotchas (NOT regressions to chase)

- `/settings` save button is sticky-bottom (`.settings-save`) and visually
  overlaps the second time input on short viewports (e.g. 1024×768 with
  Linux dock visible). Functional behavior is unaffected — clicks/taps
  on the underlying inputs still register because they're laid out above
  the sticky button in DOM order.
- The bottom-nav `<nav>` is `position: fixed; bottom: 0` and is reported
  as `offscreen` by the desktop tool when the Linux dock covers y≈753.
  Use URL navigation instead of clicking the nav from automation.

## Devin Secrets Needed

None — the entire stack runs in stub mode. `JWT_SECRET` is hard-coded in
`scripts/local-e2e.env` for local-only use and is never reused elsewhere.
