$path = "d:\Video-Editor\src\components\MediaPanel.tsx"
$lines = [System.IO.File]::ReadAllLines($path)
Write-Host "Before:" $lines.Length
# Delete lines at indices 840 to 915 inclusive (1-indexed: 841-916)
# Keep: [0..839] and [916..(total-1)]
$keep = $lines[0..839] + $lines[916..($lines.Length - 1)]
[System.IO.File]::WriteAllLines($path, $keep, [System.Text.Encoding]::UTF8)
$verify = [System.IO.File]::ReadAllLines($path)
Write-Host "After:" $verify.Length
$old = $verify | Where-Object { $_ -match "Timeline FX section" }
Write-Host "Old block remaining:" $old.Count
