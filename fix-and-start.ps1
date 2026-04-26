# Telegram Garant Bot - Автоматическое исправление и запуск

Write-Host "========================================"
Write-Host " Telegram Garant Bot - Auto Fix & Start"
Write-Host "========================================"
Write-Host ""

Set-Location "C:\telegram-garant\services\user-service"

Write-Host "[1/5] Fixing all entity imports..."

# Fix deal entities imports
Get-ChildItem "src\modules\deal\entities" -Filter "*.entity.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./user/", "from '../../user/"
    $content = $content -replace "from '\.\./payment/", "from '../../payment/"
    $content = $content -replace "from '\.\./review/", "from '../../review/"
    $content = $content -replace "from '\./enums/", "from '../enums/"
    Set-Content $_.FullName -Value $content -NoNewline
    Write-Host "  Fixed: $($_.Name)"
}

# Fix payment entities imports
Get-ChildItem "src\modules\payment\entities" -Filter "*.entity.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./user/", "from '../../user/"
    $content = $content -replace "from '\.\./deal/", "from '../../deal/"
    $content = $content -replace "from '\./enums/", "from '../enums/"
    Set-Content $_.FullName -Value $content -NoNewline
    Write-Host "  Fixed: $($_.Name)"
}

# Fix review entities imports
Get-ChildItem "src\modules\review\entities" -Filter "*.entity.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "from '\.\./user/", "from '../../user/"
    $content = $content -replace "from '\.\./deal/", "from '../../deal/"
    $content = $content -replace "from '\./enums/", "from '../enums/"
    Set-Content $_.FullName -Value $content -NoNewline
    Write-Host "  Fixed: $($_.Name)"
}

Write-Host ""
Write-Host "[2/5] Removing UseMiddleware from controllers..."

Get-ChildItem "src\modules" -Filter "*.controller.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace "\r?\n\s*@UseMiddleware.*", ""
    $content = $content -replace ".*UseMiddleware.*\r?\n", ""
    Set-Content $_.FullName -Value $content -NoNewline
}

Write-Host ""
Write-Host "[3/5] Stopping existing node processes..."
taskkill /F /IM node.exe 2>$null | Out-Null

Write-Host ""
Write-Host "[4/5] Clearing cache..."
if (Test-Path "node_modules\.ts-node") {
    Remove-Item "node_modules\.ts-node" -Recurse -Force
    Write-Host "  Cache cleared."
} else {
    Write-Host "  No cache to clear."
}

Write-Host ""
Write-Host "[5/5] Starting server..."
Write-Host ""
Write-Host "========================================"
Write-Host " Server starting..."
Write-Host " Press CTRL+C to stop"
Write-Host "========================================"
Write-Host ""

npx ts-node --transpile-only -r tsconfig-paths/register src/main.ts
