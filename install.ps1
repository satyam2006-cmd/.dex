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

# 1. Dependency Checks & Auto-Install
Write-Info "Checking system requirements..."

# Helper: Refresh PATH in current session after an install
function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

# Helper: Check if winget is available
function Test-Winget {
    try { winget --version 2>$null; return $true } catch { return $false }
}

# --- Node.js Check & Auto-Install ---
$nodeVersion = $null
try { $nodeVersion = node -v 2>$null } catch {}

if (-not $nodeVersion) {
    Write-Warn "Node.js is not installed. Attempting to install automatically..."
    
    $installed = $false
    
    # Try winget first
    if (Test-Winget) {
        Write-Info "Installing Node.js via winget..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) { $installed = $true }
        } catch {}
    }
    
    # Fallback: Direct MSI download
    if (-not $installed) {
        Write-Info "winget not available. Downloading Node.js installer directly..."
        $nodeInstaller = Join-Path $env:TEMP "node-lts-installer.msi"
        $nodeUrl = "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi"
        try {
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
            Write-Info "Running Node.js installer (this may take a minute)..."
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn" -Wait -NoNewWindow
            Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
            $installed = $true
        } catch {
            Write-Error "Failed to download Node.js installer."
            Write-Host "Please install Node.js (v18+) manually from https://nodejs.org/ and re-run this script." -ForegroundColor Yellow
            exit 1
        }
    }

    if ($installed) {
        Refresh-Path
        try { $nodeVersion = node -v 2>$null } catch {}
        if (-not $nodeVersion) {
            Write-Error "Node.js was installed but is not yet available in PATH."
            Write-Host "Please restart your terminal and re-run this script." -ForegroundColor Yellow
            exit 1
        }
        Write-Success "Node.js installed successfully: $nodeVersion"
    }
} else {
    Write-Success "Node.js found: $nodeVersion"
}

# --- npm Check (bundled with Node.js) ---
$npmVersion = $null
try { $npmVersion = npm -v 2>$null } catch {}

if (-not $npmVersion) {
    Write-Error "npm is not available despite Node.js being installed."
    Write-Host "Please reinstall Node.js from https://nodejs.org/ (npm is bundled) and re-run this script." -ForegroundColor Yellow
    exit 1
}
Write-Success "npm found: v$npmVersion"

# --- Git Check & Auto-Install (optional, used for cloning) ---
$gitAvailable = $null
try { $gitAvailable = git --version 2>$null } catch {}

if (-not $gitAvailable) {
    Write-Warn "Git is not installed. Attempting to install automatically..."
    
    $gitInstalled = $false
    
    if (Test-Winget) {
        Write-Info "Installing Git via winget..."
        try {
            winget install Git.Git --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) { $gitInstalled = $true }
        } catch {}
    }
    
    if ($gitInstalled) {
        Refresh-Path
        try { $gitAvailable = git --version 2>$null } catch {}
        if ($gitAvailable) {
            Write-Success "Git installed successfully: $gitAvailable"
        } else {
            Write-Info "Git was installed but not yet in PATH. Will use ZIP download instead."
            $gitAvailable = $null
        }
    } else {
        Write-Info "Could not auto-install Git. Will use ZIP download instead."
    }
}

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

    # Try Git clone (uses $gitAvailable from dependency check above)
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
        $zipPath = Join-Path $env:TEMP "dex-v1.0.1.zip"
        $apiUrl = "https://github.com/satyam2006-cmd/.dex/archive/refs/tags/v1.0.1.zip"
        
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

# 4. Configure PowerShell Profile for .dex command support
if ($env:OS -eq "Windows_NT") {
    Write-Info "Configuring PowerShell profile for .dex command..."
    $profilePath = $PROFILE
    if ($profilePath) {
        $profileDir = Split-Path $profilePath -Parent
        if (-not (Test-Path $profileDir)) {
            New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        }
        if (-not (Test-Path $profilePath)) {
            New-Item -ItemType File -Force -Path $profilePath | Out-Null
        }
        
        $profileContent = ""
        try {
            $profileContent = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
        } catch {}

        $functionDefinition = @"

# .dex command function added by .dex installer
function .dex {
    & dex @args
}
"@
        if ([string]::IsNullOrEmpty($profileContent) -or $profileContent -notlike "*function .dex *") {
            Add-Content -Path $profilePath -Value $functionDefinition
            Write-Success "Added .dex function to PowerShell profile ($profilePath)"
        } else {
            Write-Info ".dex function already exists in PowerShell profile."
        }
    }
    
    # Define the function in the current active session globally so it works immediately
    function global:.dex {
        & dex @args
    }
}

# 5. Show Logo & Usage Info
Write-Host ""
Write-Host "     .DEX CLI Setup Complete" -ForegroundColor Cyan
Write-Host "     ------------------------" -ForegroundColor Cyan
Write-Host "     Version: 1.0.1" -ForegroundColor Cyan
Write-Host "     Command: .dex" -ForegroundColor Cyan
Write-Host ""

Write-Host "Usage Examples:" -ForegroundColor Yellow
Write-Host "  .dex                     - View stats and ASCII logo" -ForegroundColor White
Write-Host "  .dex create `<url`> [name] - Disguise & register a web app" -ForegroundColor White
Write-Host "  .dex launch `<app-name`>   - Run your desktop web app" -ForegroundColor White
Write-Host "  .dex list                - List registered apps" -ForegroundColor White
Write-Host "  .dex help                - See all command options" -ForegroundColor White

if ($env:OS -eq "Windows_NT") {
    Write-Host "`nThe '.dex' command is configured in your profile. If it's not active in this window, please restart your terminal or run: . `$PROFILE`n" -ForegroundColor Green
} else {
    Write-Host "`nRestart your terminal to begin using .dex from any directory!`n" -ForegroundColor Green
}

