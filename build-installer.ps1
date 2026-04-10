# Make Extractor - Build Script (Simple)
$ErrorActionPreference = "Stop"
Write-Host "🚀 Starting Build..."

# 1. Clean
Write-Host "🧹 Cleaning..."
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
if (Test-Path release) { Remove-Item release -Recurse -Force }
if (Test-Path build_out) { Remove-Item build_out -Recurse -Force }

# 2. Build Assets
Write-Host "📦 Building renderer..."
npx vite build --outDir dist/renderer

Write-Host "📦 Building main..."
npx tsc -p tsconfig.main.json

# 3. Setup Release Folder
New-Item -ItemType Directory -Path release/dist -Force
Copy-Item "dist/*" "release/dist" -Recurse -Force

# 4. Prepare package.json
Write-Host "📄 Preparing package.json..."
$pkg = Get-Content package.json | ConvertFrom-Json
$r = @{ 
    name = $pkg.name
    version = $pkg.version
    main = "dist/main/main/main.js"
    dependencies = $pkg.dependencies 
}
$r | ConvertTo-Json | Set-Content release/package.json

# 5. Prepare config.json (Simple JSON string to avoid PS parser issues)
Write-Host "🛠️ Preparing config.json..."
$configJson = @"
{
  "productName": "Make Extractor",
  "appId": "com.figmamake.extractor",
  "directories": {
    "output": "../build_out",
    "app": "."
  },
  "files": [
    "dist/**/*"
  ],
  "extraResources": [
    { "from": "../resources/win/node.exe", "to": "win/node.exe" },
    { "from": "../resources/node_modules_cache", "to": "node_modules_cache" }
  ],
  "win": {
    "target": "nsis",
    "artifactName": "Figma-Make-Extractor-Setup-1.0.0.exe"
  },
    "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
"@
$configJson | Set-Content release/config.json

# 6. Build
Write-Host "🔨 Packaging..."
Set-Location release
npx electron-builder --win --config config.json
Set-Location ..

# 7. Move Result
if (Test-Path build_out/Figma-Make-Extractor-Setup-1.0.0.exe) {
    Copy-Item "build_out/Figma-Make-Extractor-Setup-1.0.0.exe" "./Figma-Make-Extractor-Setup-1.0.0.exe" -Force
    Write-Host "✅ DONE! Figma-Make-Extractor-Setup-1.0.0.exe created."
} else {
    Write-Error "❌ Build failed."
}
