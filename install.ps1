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

$DexVersion = "1.0.2"
$RequiredNodeMajor = 18
$PortableNodeVersion = "22.15.0"

# 0. Fix PowerShell ExecutionPolicy if it's Restricted
# Restricted policy blocks ALL .ps1 scripts (including PowerShell profiles and npm shims).
# Setting it to RemoteSigned for CurrentUser allows local scripts to run while keeping
# security for downloaded scripts. This does NOT require admin rights.
try {
    $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
    if ($currentPolicy -eq "Restricted" -or $currentPolicy -eq "Undefined") {
        $processPolicy = Get-ExecutionPolicy -Scope Process
        if ($processPolicy -eq "Restricted" -or $processPolicy -eq "Undefined") {
            # Also check the effective (machine-level) policy
            $effectivePolicy = Get-ExecutionPolicy
            if ($effectivePolicy -eq "Restricted") {
                Write-Info "PowerShell ExecutionPolicy is Restricted. Setting to RemoteSigned for current user..."
                Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
                Write-Success "ExecutionPolicy set to RemoteSigned (CurrentUser scope)."
            }
        }
    }
} catch {
    Write-Warn "Could not change ExecutionPolicy. If '.dex' command fails after install, run:"
    Write-Host "  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" -ForegroundColor White
}

# 1. Dependency Checks & Auto-Install
Write-Info "Checking system requirements..."

# Helper: Refresh PATH in current session after an install
function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
    
    # Ensure npm global bin directory is in the Path for the current session
    $npmBinDir = Join-Path $env:APPDATA "npm"
    if ($env:Path -notlike "*$npmBinDir*") {
        $env:Path = "$env:Path;$npmBinDir"
    }
}

# Helper: Check if winget is available
function Test-Winget {
    try { winget --version 2>$null; return $true } catch { return $false }
}

# --- Node.js Check & Auto-Install ---
$PORTABLE_NODE_PATH = $null
Refresh-Path
$nodeVersion = $null
$nodeMajor = 0
try {
    $nodeVersion = node -v 2>$null
    if ($nodeVersion) {
        $nodeMajor = [int]($nodeVersion.TrimStart("v").Split(".")[0])
    }
} catch {}

if (-not $nodeVersion -or $nodeMajor -lt $RequiredNodeMajor) {
    if ($nodeVersion) {
        Write-Warn "Node.js $nodeVersion is installed, but .dex requires Node.js v$RequiredNodeMajor or newer."
    } else {
        Write-Warn "Node.js is not installed."
    }
    Write-Info "Attempting to install Node.js automatically..."
    
    $installed = $false
    
    # Try winget first
    if (Test-Winget) {
        Write-Info "Installing Node.js via winget..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
            if ($LASTEXITCODE -eq 0) { $installed = $true }
        } catch {}
    }
    
    # Fallback: Portable user-space ZIP download (no admin required, highly robust)
    if (-not $installed) {
        Write-Info "winget not available or failed. Attempting user-space portable Node.js installation..."
        
        $arch = "x64"
        if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
            $arch = "arm64"
        }
        
        $nodeDirName = "node-v$PortableNodeVersion-win-$arch"
        $nodeUrl = "https://nodejs.org/dist/v$PortableNodeVersion/$nodeDirName.zip"
        
        if ($arch -eq "arm64") {
            $nodeUrl = "https://nodejs.org/dist/v$PortableNodeVersion/node-v$PortableNodeVersion-win-arm64.zip"
        }
        
        $nodeZip = Join-Path $env:TEMP "$nodeDirName.zip"
        $nodeBinParent = Join-Path $env:USERPROFILE ".node"
        $nodeExtractPath = Join-Path $nodeBinParent $nodeDirName
        
        try {
            Write-Info "Downloading Node.js portable zip (v$PortableNodeVersion)..."
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing
            
            Write-Info "Extracting Node.js..."
            if (-not (Test-Path $nodeBinParent)) {
                New-Item -ItemType Directory -Force -Path $nodeBinParent | Out-Null
            }
            
            # Clean up old extraction if it exists
            if (Test-Path $nodeExtractPath) {
                Remove-Item $nodeExtractPath -Recurse -Force -ErrorAction SilentlyContinue
            }
            
            Expand-Archive -Path $nodeZip -DestinationPath $nodeBinParent
            
            # Clean up zip
            Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue
            
            # Add to user PATH permanently
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            if ($userPath -notlike "*$nodeExtractPath*") {
                [Environment]::SetEnvironmentVariable("Path", "$userPath;$nodeExtractPath", "User")
            }
            
            # Add to current process PATH
            $env:Path = "$env:Path;$nodeExtractPath"
            
            $installed = $true
            $PORTABLE_NODE_PATH = $nodeExtractPath
            Write-Success "Portable Node.js installed to $nodeExtractPath"
        } catch {
            Write-Error "Failed to install portable Node.js."
            Write-Host $_.Exception.Message -ForegroundColor Red
            Write-Host "Please install Node.js (v18+) manually from https://nodejs.org/ and re-run this script." -ForegroundColor Yellow
            exit 1
        }
    }

    if ($installed) {
        Refresh-Path
        try {
            $nodeVersion = node -v 2>$null
            if ($nodeVersion) {
                $nodeMajor = [int]($nodeVersion.TrimStart("v").Split(".")[0])
            }
        } catch {}
        if (-not $nodeVersion -or $nodeMajor -lt $RequiredNodeMajor) {
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
# Try npm.cmd first on Windows to bypass PowerShell script Execution Policy restrictions
$npmCmd = "npm"
if ($env:OS -eq "Windows_NT") {
    $npmCmd = "npm.cmd"
}
try { 
    $npmVersion = & $npmCmd -v 2>$null 
    if ($npmVersion) { $npmVersion = $npmVersion.Trim() }
} catch {}

if (-not $npmVersion -and $npmCmd -eq "npm.cmd") {
    # Fallback to plain npm if npm.cmd was not found for some reason
    try { 
        $npmVersion = npm -v 2>$null 
        if ($npmVersion) { $npmVersion = $npmVersion.Trim() }
    } catch {}
}

if (-not $npmVersion) {
    Write-Warn "npm is not available or its shim is broken. .dex has no third-party runtime dependencies, so the installer will use direct command wrappers."
} else {
    Write-Success "npm found: v$npmVersion"
}

if ($PORTABLE_NODE_PATH) {
    try {
        & $npmCmd config set prefix "$env:APPDATA\npm" --global
        Write-Success "Configured npm global prefix to $env:APPDATA\npm"
    } catch {
        Write-Warn "Could not set global npm prefix. Global packages might install in the Node directory."
    }
}

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
        $zipPath = Join-Path $env:TEMP "dex-master.zip"
        $apiUrl = "https://github.com/satyam2006-cmd/.dex/archive/refs/heads/master.zip"
        
        try {
            Invoke-WebRequest -Uri $apiUrl -OutFile $zipPath -UseBasicParsing
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
    # Ensure the npm global bin directory exists
    $npmBinDir = Join-Path $env:APPDATA "npm"
    if (-not (Test-Path $npmBinDir)) {
        New-Item -ItemType Directory -Force -Path $npmBinDir | Out-Null
    }

    # Ensure npm global bin directory is permanently in the User PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$npmBinDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$npmBinDir", "User")
    }

    if ($npmVersion) {
        Write-Info "Installing package dependencies..."
        & $npmCmd install --omit=dev
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }

        & $npmCmd link --force
        if ($LASTEXITCODE -ne 0) {
            throw "npm link failed with exit code $LASTEXITCODE"
        }
        
        # On Windows, remove .ps1 shims and Unix extensionless files from npm directory.
        # .ps1 shims are blocked by PowerShell's ExecutionPolicy on many systems (Restricted/AllSigned).
        # The .cmd shims work universally regardless of ExecutionPolicy, so we keep only those.
        $shimsToRemove = @(".dex", ".dex.ps1", "dex", "dex.ps1")
        foreach ($shim in $shimsToRemove) {
            $shimPath = Join-Path $npmBinDir $shim
            if (Test-Path $shimPath) {
                Remove-Item $shimPath -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Info "Skipping npm link and creating direct command wrappers."
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

# 4. Ensure '.dex' command works on Windows (even with Restricted ExecutionPolicy)
if ($env:OS -eq "Windows_NT") {
    Write-Info "Configuring .dex command..."
    
    # Create a .dex.cmd batch wrapper in the npm bin directory.
    # This ensures '.dex' works in both cmd.exe and PowerShell regardless of ExecutionPolicy.
    $npmBinDir = Join-Path $env:APPDATA "npm"
    $entryPath = Join-Path $installDir "bin\dex.js"
    $dexCmd = Join-Path $npmBinDir "dex.cmd"
    $dotDexCmd = Join-Path $npmBinDir ".dex.cmd"
    $dexCmdContent = "@echo off`r`nnode ""$entryPath"" %*"
    $dotDexCmdContent = "@echo off`r`n""$dexCmd"" %*"
    Set-Content -Path $dexCmd -Value $dexCmdContent -Encoding ASCII -Force
    Set-Content -Path $dotDexCmd -Value $dotDexCmdContent -Encoding ASCII -Force
    Write-Success "Created dex.cmd and .dex.cmd wrappers in npm directory."
    
    # Best-effort: Also add function to PowerShell profile for nicer PowerShell integration.
    # This may not work on Restricted ExecutionPolicy systems, but that's OK because
    # the .dex.cmd wrapper above already handles the command.
    $profilePath = $PROFILE
    if ($profilePath) {
        try {
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
        } catch {
            Write-Info "Could not update PowerShell profile (ExecutionPolicy may be Restricted). The .dex.cmd wrapper will handle the command."
        }
    }
    
    # Define the function in the current active session globally so it works immediately
    function global:.dex {
        & dex @args
    }
}

# 5. Show Setup Complete & Usage Info
Write-Host ""
Write-Host "     .DEX CLI Setup Complete" -ForegroundColor Cyan
Write-Host "     ------------------------" -ForegroundColor Cyan
Write-Host "     Version: $DexVersion" -ForegroundColor Cyan
Write-Host "     Command: .dex" -ForegroundColor Cyan
Write-Host ""

Write-Host "Usage Examples:" -ForegroundColor Yellow
Write-Host "  .dex                     - View stats and ASCII logo" -ForegroundColor White
Write-Host "  .dex create <url> [name] - Disguise & register a web app" -ForegroundColor White
Write-Host "  .dex launch <app-name>   - Run your desktop web app" -ForegroundColor White
Write-Host "  .dex list                - List registered apps" -ForegroundColor White
Write-Host "  .dex help                - See all command options" -ForegroundColor White

Write-Host "`nRestart your terminal to begin using .dex from any directory!`n" -ForegroundColor Green
