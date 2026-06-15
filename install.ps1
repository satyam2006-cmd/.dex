# .dex CLI Installer for Windows
# Single command install:
# irm https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Styling Helpers
function Write-Header ($text) {
    Write-Host "`n=== $text ===" -ForegroundColor Cyan
}

function Write-Success ($text) {
    Write-Host "[OK] $text" -ForegroundColor Green
}

function Write-Info ($text) {
    Write-Host "[INFO] $text" -ForegroundColor Blue
}

function Write-Warn ($text) {
    Write-Host "[WARN] $text" -ForegroundColor Yellow
}

function Write-Error ($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

Write-Header "Installing .dex CLI"

# 1. Dependency Checks
Write-Info "Checking system requirements..."

$nodeVersion = $null
try {
    $nodeVersion = node -v 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Error "Node.js is not installed."
    Write-Host "Please install Node.js (v18 or higher) from https://nodejs.org/ and try again." -ForegroundColor Yellow
    exit 1
}
Write-Success "Node.js found: $nodeVersion"

$npmVersion = $null
try {
    $npmVersion = npm -v 2>$null
} catch {}

if (-not $npmVersion) {
    Write-Error "npm is not installed."
    Write-Host "Please ensure npm is installed and added to your PATH." -ForegroundColor Yellow
    exit 1
}
Write-Success "npm found: v$npmVersion"

# 2. Determine installation mode (Local vs Remote)
$isLocal = $false
if (Test-Path "package.json") {
    $pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($pkgJson -and $pkgJson.name -eq "dex-cli") {
        $isLocal = $true
    }
}

$installDir = ""

if ($isLocal) {
    Write-Info "Running in local repository mode..."
    $installDir = Get-Location
} else {
    Write-Info "Running in remote installation mode..."
    $installDir = Join-Path $env:USERPROFILE ".dex-cli"
    
    if (Test-Path $installDir) {
        Write-Info "Existing installation found at $installDir. Updating..."
    } else {
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    }

    # Try Git clone
    $gitAvailable = $null
    try {
        $gitAvailable = git --version 2>$null
    } catch {}

    if ($gitAvailable) {
        Write-Info "Cloning repository via Git..."
        if (Test-Path (Join-Path $installDir ".git")) {
            Push-Location $installDir
            try {
                git fetch --all | Out-Null
                git reset --hard origin/master | Out-Null
            } finally {
                Pop-Location
            }
        } else {
            git clone https://github.com/satyam2006-cmd/.dex.git $installDir
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to clone repository from GitHub."
                exit 1
            }
        }
    } else {
        Write-Info "Git not found. Downloading via web request..."
        $zipPath = Join-Path $env:TEMP "dex-v1.0.0.zip"
        $apiUrl = "https://github.com/satyam2006-cmd/.dex/archive/refs/tags/v1.0.0.zip"
        
        try {
            Invoke-WebRequest -Uri $apiUrl -OutFile $zipPath
        } catch {
            Write-Error "Failed to download ZIP file from GitHub. The repository might be private or empty."
            exit 1
        }
        
        Write-Info "Extracting files..."
        $extractTemp = Join-Path $env:TEMP "dex_extract_temp"
        if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
        
        Expand-Archive -Path $zipPath -DestinationPath $extractTemp
        
        # Copy contents to target dir
        $extractedDir = Join-Path $extractTemp ".dex-main"
        if (-not (Test-Path $extractedDir)) {
            $extractedDir = Get-ChildItem $extractTemp | Select-Object -First 1 | ForEach-Object { $_.FullName }
        }
        
        Copy-Item -Path "$extractedDir\*" -Destination $installDir -Recurse -Force
        
        # Clean up
        Remove-Item $zipPath -Force
        Remove-Item $extractTemp -Recurse -Force
    }
}

# Double check that package.json exists in target directory
if (-not (Test-Path (Join-Path $installDir "package.json"))) {
    Write-Error "Invalid installation: package.json not found in target folder. The repository may be empty."
    exit 1
}

# 3. Global Linking
Write-Info "Linking .dex CLI globally..."
Push-Location $installDir
try {
    # Run npm link
    npm link --force
    if ($LASTEXITCODE -ne 0) {
        throw "npm link failed with exit code $LASTEXITCODE"
    }
    
    # On Windows, clean the Unix extensionless file from npm directory to prevent "Open With" popups
    $npmBinDir = Join-Path $env:APPDATA "npm"
    $unixShim = Join-Path $npmBinDir ".dex"
    if (Test-Path $unixShim) {
        Remove-Item $unixShim -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Error "Failed to link .dex CLI."
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Success ".dex CLI installed successfully!"

# 4. Show Logo & Usage Info
Write-Host ""
Write-Host "     .DEX CLI Setup Complete" -ForegroundColor Cyan
Write-Host "     ------------------------" -ForegroundColor Cyan
Write-Host "     Version: 1.0.0" -ForegroundColor Cyan
Write-Host "     Command: .dex" -ForegroundColor Cyan
Write-Host ""

Write-Host "Usage Examples:" -ForegroundColor Yellow
Write-Host "  .dex                     - View stats and ASCII logo" -ForegroundColor White
Write-Host "  .dex create `<url`> [name] - Disguise & register a web app" -ForegroundColor White
Write-Host "  .dex launch `<app-name`>   - Run your desktop web app" -ForegroundColor White
Write-Host "  .dex list                - List registered apps" -ForegroundColor White
Write-Host "  .dex help                - See all command options" -ForegroundColor White
Write-Host "`nRestart your terminal to begin using .dex from any directory!`n" -ForegroundColor Green
