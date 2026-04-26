@echo off
REM Скрипт для запуска сервера с обходом ошибок TypeScript

echo ========================================
echo  Telegram Garant Bot - Server Startup
echo ========================================
echo.

cd /d "%~dp0services\user-service"

echo [1/4] Stopping existing node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Clearing ts-node cache...
if exist "node_modules\.ts-node" (
    rmdir /s /q "node_modules\.ts-node"
    echo Cache cleared.
) else (
    echo No cache to clear.
)

echo [3/4] Checking for UseMiddleware in controllers...
powershell -Command "Get-ChildItem 'src\modules' -Filter '*.controller.ts' -Recurse | ForEach-Object { $c = Get-Content -Raw $_.FullName; if ($c -match '@UseMiddleware') { Write-Host 'WARNING: UseMiddleware found in' $_.Name } }"

echo [4/4] Starting server with ts-node...
echo.
echo ========================================
echo  Server starting...
echo  Press CTRL+C to stop
echo ========================================
echo.

npx ts-node --transpile-only -r tsconfig-paths/register src/main.ts

pause
