@echo off
echo ========================================
echo  Quick Fix & Start Script
echo ========================================
echo.

cd /d "%~dp0services\user-service"

echo [1/3] Removing problematic imports...
powershell -Command "
$files = @(
  'src/modules/user/user.controller.ts',
  'src/modules/deal/deal.controller.ts',
  'src/modules/payment/payment.controller.ts',
  'src/modules/review/review.controller.ts',
  'src/modules/arbitration/*.controller.ts'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $c = Get-Content -Raw $f
    $c = $c -replace '.*@UseMiddleware.*\r?\n', ''
    $c = $c -replace '.*UseMiddleware,.*\r?\n', ''
    Set-Content $f -Value $c -NoNewline
    Write-Host \"Fixed: $f\"
  }
}
"

echo [2/3] Clearing cache...
taskkill /F /IM node.exe 2>nul
if exist "node_modules\.ts-node" rmdir /s /q "node_modules\.ts-node"

echo [3/3] Starting server...
echo.
npx ts-node --transpile-only -r tsconfig-paths/register src/main.ts

pause
