# Resolve merge conflicts by accepting incoming changes

$files = @(
    "src\app\admin\navigation.tsx",
    "src\app\admin\analytics-impact\page.tsx",
    "src\app\api\analytics\impact\route.ts",
    "src\app\executive\analytics-impact\page.tsx"
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file"
        
        $content = Get-Content -Path $fullPath -Raw
        
        $pattern = '<<<<<<< HEAD[\s\S]*?=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]+'
        $content = $content -replace $pattern, '$1'
        
        Set-Content -Path $fullPath -Value $content -NoNewline
        Write-Host "Resolved: $file"
    }
}

Write-Host "Done"
