Get-ChildItem -Path "." -Recurse -Filter "*.entity.ts" | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw
    if ($content -match "'jsonb'") {
        $newContent = $content -replace "'jsonb', default: \{\}", "'simple-json', default: '{}'"
        $newContent = $newContent -replace "'jsonb', nullable: true", "'simple-json', nullable: true"
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($_.FullName)"
    }
}
Write-Host "Done!"