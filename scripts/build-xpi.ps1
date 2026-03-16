param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "manifest.json was not found in $projectRoot"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$extensionId = if ($manifest.browser_specific_settings.gecko.id) {
  $manifest.browser_specific_settings.gecko.id
} else {
  "site-image-blocker"
}
$safeId = ($extensionId -replace "[^a-zA-Z0-9._-]", "-").Trim("-")
$version = $manifest.version

$outputRoot = Join-Path $projectRoot $OutputDir
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$tempDirName = "build-" + [guid]::NewGuid().ToString("N")
$tempDir = Join-Path $outputRoot $tempDirName
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$includePaths = @(
  "manifest.json",
  "background.js",
  "README.md",
  "content",
  "icons",
  "options",
  "popup"
)

foreach ($relativePath in $includePaths) {
  $sourcePath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path $sourcePath)) {
    throw "Required path is missing: $relativePath"
  }

  $destinationPath = Join-Path $tempDir $relativePath

  if ((Get-Item $sourcePath) -is [System.IO.DirectoryInfo]) {
    Copy-Item -Path $sourcePath -Destination $destinationPath -Recurse
  } else {
    $destinationParent = Split-Path -Parent $destinationPath
    if ($destinationParent) {
      New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }

    Copy-Item -Path $sourcePath -Destination $destinationPath
  }
}

$zipBaseName = "{0}-{1}" -f $safeId, $version
$zipPath = Join-Path $outputRoot ($zipBaseName + ".zip")
$xpiPath = Join-Path $outputRoot ($zipBaseName + ".xpi")

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

if (Test-Path $xpiPath) {
  Remove-Item $xpiPath -Force
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -Path $zipPath -Destination $xpiPath
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Created package: $xpiPath"
