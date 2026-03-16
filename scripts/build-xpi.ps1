param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

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

$includePaths = @(
  "manifest.json",
  "background.js",
  "README.md",
  "content",
  "icons",
  "options",
  "popup"
)

function Add-FileToArchive {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$SourcePath,
    [string]$EntryPath
  )

  $normalizedEntryPath = $EntryPath.Replace("\", "/")
  $entry = $Archive.CreateEntry($normalizedEntryPath, [System.IO.Compression.CompressionLevel]::Optimal)

  $entryStream = $entry.Open()
  $fileStream = [System.IO.File]::OpenRead($SourcePath)

  try {
    $fileStream.CopyTo($entryStream)
  } finally {
    $fileStream.Dispose()
    $entryStream.Dispose()
  }
}

function Add-PathToArchive {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$RootPath,
    [string]$RelativePath
  )

  $sourcePath = Join-Path $RootPath $RelativePath

  if (-not (Test-Path $sourcePath)) {
    throw "Required path is missing: $RelativePath"
  }

  $item = Get-Item $sourcePath

  if ($item -is [System.IO.DirectoryInfo]) {
    foreach ($file in Get-ChildItem -Path $sourcePath -File -Recurse) {
      $relativeEntryPath = $file.FullName.Substring($RootPath.Length).TrimStart('\', '/')
      Add-FileToArchive -Archive $Archive -SourcePath $file.FullName -EntryPath $relativeEntryPath
    }
    return
  }

  Add-FileToArchive -Archive $Archive -SourcePath $sourcePath -EntryPath $RelativePath
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

$zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)

try {
  foreach ($relativePath in $includePaths) {
    Add-PathToArchive -Archive $archive -RootPath $projectRoot -RelativePath $relativePath
  }
} finally {
  $archive.Dispose()
  $zipStream.Dispose()
}

Move-Item -Path $zipPath -Destination $xpiPath

Write-Host "Created package: $xpiPath"
