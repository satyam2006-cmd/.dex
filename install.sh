#!/bin/bash
# .dex CLI Installer for macOS and Linux
# Single command install:
# curl -fsSL https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.sh | bash

set -e

# Styling colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Styling Helpers
write_header() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

write_success() {
    echo -e "${GREEN}[OK] $1${NC}"
}

write_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

write_warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

write_error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Helper: Download file using curl or wget
download_file() {
    local url="$1"
    local output="$2"
    if command -v curl &> /dev/null; then
        curl -sSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -qO "$output" "$url"
    else
        return 1
    fi
}

write_header "Installing .dex CLI"

DEX_VERSION="1.2.2"
REQUIRED_NODE_MAJOR=18
PORTABLE_NODE_VERSION="22.15.0"

# Helper: Detect package manager
detect_package_manager() {
    if command -v brew &> /dev/null; then
        echo "brew"
    elif command -v apt-get &> /dev/null; then
        echo "apt"
    elif command -v dnf &> /dev/null; then
        echo "dnf"
    elif command -v yum &> /dev/null; then
        echo "yum"
    elif command -v pacman &> /dev/null; then
        echo "pacman"
    elif command -v apk &> /dev/null; then
        echo "apk"
    else
        echo "none"
    fi
}

# 1. Dependency Checks & Auto-Install
write_info "Checking system requirements..."

# --- Node.js & npm Check & Auto-Install ---
PORTABLE_NODE_PATH=""
NODE_MAJOR=0
if command -v node &> /dev/null; then
    NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
fi

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null || [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
    if command -v node &> /dev/null; then
        write_warn "Node.js $(node -v) is installed, but .dex requires v$REQUIRED_NODE_MAJOR or newer."
    else
        write_warn "Node.js or npm is missing."
    fi
    write_info "Attempting auto-installation..."
    
    PM=$(detect_package_manager)
    INSTALLED=false
    
    if [ "$PM" = "brew" ]; then
        write_info "Installing Node.js via Homebrew..."
        brew install node && INSTALLED=true
    elif [ "$PM" = "apt" ]; then
        write_info "Installing Node.js & npm via apt..."
        sudo apt-get update && sudo apt-get install -y nodejs npm && INSTALLED=true
    elif [ "$PM" = "dnf" ]; then
        write_info "Installing Node.js & npm via dnf..."
        sudo dnf install -y nodejs npm && INSTALLED=true
    elif [ "$PM" = "yum" ]; then
        write_info "Installing Node.js & npm via yum..."
        sudo yum install -y nodejs npm && INSTALLED=true
    elif [ "$PM" = "pacman" ]; then
        write_info "Installing Node.js & npm via pacman..."
        sudo pacman -S --noconfirm nodejs npm && INSTALLED=true
    elif [ "$PM" = "apk" ]; then
        write_info "Installing Node.js & npm via apk..."
        sudo apk add nodejs npm && INSTALLED=true
    fi

    if [ "$INSTALLED" = false ]; then
        write_info "Package manager not available or installation failed. Trying user-space portable Node.js..."
        
        OS=$(uname -s)
        ARCH=$(uname -m)
        
        # Normalize OS
        if [ "$OS" = "Darwin" ]; then
            NODE_OS="darwin"
        else
            NODE_OS="linux"
        fi
        
        # Normalize ARCH
        if [ "$ARCH" = "x86_64" ]; then
            NODE_ARCH="x64"
        elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
            NODE_ARCH="arm64"
        else
            NODE_ARCH="x64"
        fi
        
        NODE_DIR_NAME="node-v$PORTABLE_NODE_VERSION-$NODE_OS-$NODE_ARCH"
        NODE_URL="https://nodejs.org/dist/v$PORTABLE_NODE_VERSION/$NODE_DIR_NAME.tar.gz"
        
        NODE_BIN_PARENT="$HOME/.node"
        mkdir -p "$NODE_BIN_PARENT"
        
        TAR_PATH="/tmp/$NODE_DIR_NAME.tar.gz"
        
        write_info "Downloading Node.js portable binary ($NODE_DIR_NAME)..."
        if download_file "$NODE_URL" "$TAR_PATH"; then
            write_info "Extracting Node.js..."
            rm -rf "$NODE_BIN_PARENT/$NODE_DIR_NAME"
            tar -xzf "$TAR_PATH" -C "$NODE_BIN_PARENT"
            rm -f "$TAR_PATH"
            
            PORTABLE_NODE_PATH="$NODE_BIN_PARENT/$NODE_DIR_NAME"
            export PATH="$PORTABLE_NODE_PATH/bin:$PATH"
            INSTALLED=true
            write_success "Portable Node.js installed to $PORTABLE_NODE_PATH"
        else
            write_error "Failed to download portable Node.js from $NODE_URL"
        fi
    fi

    # Verify Node.js
    NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
    if ! command -v node &> /dev/null || [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]; then
        write_error "Node.js installation verification failed."
        echo -e "${YELLOW}Please install Node.js (v18+) manually and try again.${NC}"
        exit 1
    fi
    # Verify npm
    if ! command -v npm &> /dev/null; then
        write_warn "npm installation verification failed. .dex has no third-party runtime dependencies, so the installer will use direct command wrappers."
    fi
fi

write_success "Node.js found: $(node -v)"
if command -v npm &> /dev/null; then
    write_success "npm found: v$(npm -v)"
else
    write_warn "npm not found; continuing with direct command wrappers."
fi

# --- Git Check & Auto-Install ---
GIT_AVAILABLE=false
if command -v git &> /dev/null; then
    GIT_AVAILABLE=true
else
    write_warn "Git is not installed. Attempting to install automatically..."
    PM=$(detect_package_manager)
    
    if [ "$PM" = "brew" ]; then
        write_info "Installing Git via Homebrew..."
        brew install git
    elif [ "$PM" = "apt" ]; then
        write_info "Installing Git via apt..."
        sudo apt-get install -y git
    elif [ "$PM" = "dnf" ]; then
        write_info "Installing Git via dnf..."
        sudo dnf install -y git
    elif [ "$PM" = "yum" ]; then
        write_info "Installing Git via yum..."
        sudo yum install -y git
    elif [ "$PM" = "pacman" ]; then
        write_info "Installing Git via pacman..."
        sudo pacman -S --noconfirm git
    elif [ "$PM" = "apk" ]; then
        write_info "Installing Git via apk..."
        sudo apk add git
    fi

    if command -v git &> /dev/null; then
        GIT_AVAILABLE=true
        write_success "Git installed successfully: $(git --version)"
    else
        write_warn "Could not auto-install Git. Will use ZIP/Tarball download instead."
    fi
fi

# 2. Determine installation mode (Local vs Remote)
IS_LOCAL=false
if [ -f "package.json" ]; then
    NAME=$(node -e "try { console.log(require('./package.json').name); } catch(e) { console.log(''); }" 2>/dev/null || \
           node -e "import fs from 'fs'; const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8')); console.log(pkg.name);" 2>/dev/null)
    if [ "$NAME" = "dex-cli" ]; then
        IS_LOCAL=true
    fi
fi

INSTALL_DIR=""

if [ "$IS_LOCAL" = true ]; then
    write_info "Running in local repository mode..."
    INSTALL_DIR=$(pwd)
else
    write_info "Running in remote installation mode..."
    INSTALL_DIR="$HOME/.dex-cli"
    
    if [ -d "$INSTALL_DIR" ]; then
        write_info "Existing installation found at $INSTALL_DIR. Updating..."
    else
        mkdir -p "$INSTALL_DIR"
    fi

    # Try Git clone (uses GIT_AVAILABLE from dependency check above)
    if [ "$GIT_AVAILABLE" = true ]; then
        write_info "Cloning repository via Git..."
        if [ -d "$INSTALL_DIR/.git" ]; then
            cd "$INSTALL_DIR"
            git fetch --all &>/dev/null
            git reset --hard origin/master &>/dev/null
            cd - &>/dev/null
        else
            git clone https://github.com/satyam2006-cmd/.dex.git "$INSTALL_DIR" &>/dev/null
        fi
    else
        write_info "Git not found. Downloading archive..."
        TAR_PATH="/tmp/dex-master.tar.gz"
        if ! download_file "https://github.com/satyam2006-cmd/.dex/archive/refs/heads/master.tar.gz" "$TAR_PATH"; then
            write_error "Neither curl nor wget is installed, or download failed. Cannot install."
            exit 1
        fi
        
        write_info "Extracting files..."
        EXTRACT_TEMP="/tmp/dex_extract_temp"
        rm -rf "$EXTRACT_TEMP" && mkdir -p "$EXTRACT_TEMP"
        tar -xzf "$TAR_PATH" -C "$EXTRACT_TEMP"
        
        EXTRACTED_DIR=$(find "$EXTRACT_TEMP" -maxdepth 1 -mindepth 1 -type d | head -n 1)
        cp -R "$EXTRACTED_DIR"/* "$INSTALL_DIR/"
        
        # Clean up
        rm -f "$TAR_PATH"
        rm -rf "$EXTRACT_TEMP"
    fi
fi

# Double check that package.json exists in target directory
if [ ! -f "$INSTALL_DIR/package.json" ]; then
    write_error "Invalid installation: package.json not found in target folder. The repository may be empty."
    exit 1
fi

# 3. Global Linking
write_info "Linking .dex CLI globally..."
cd "$INSTALL_DIR"

if command -v npm &> /dev/null; then
    write_info "Installing package dependencies..."
    npm install --omit=dev

    # Try link normally
    if npm link --force &>/dev/null; then
        write_success "Linked globally without sudo."
    else
        write_warn "Local npm link failed. Retrying with sudo..."
        if sudo npm link --force; then
            write_success "Linked globally with sudo."
        else
            write_warn "npm link failed. Falling back to direct command wrappers."
        fi
    fi
else
    write_info "Skipping npm link because npm is unavailable."
fi

USER_BIN="$HOME/.local/bin"
mkdir -p "$USER_BIN"
export PATH="$USER_BIN:$PATH"
DEX_ENTRY="$INSTALL_DIR/bin/dex.js"
cat > "$USER_BIN/dex" << DEXCLI
#!/bin/sh
exec node "$DEX_ENTRY" "\$@"
DEXCLI
cat > "$USER_BIN/.dex" << DEXDOTCLI
#!/bin/sh
exec node "$DEX_ENTRY" "\$@"
DEXDOTCLI
chmod +x "$USER_BIN/dex" "$USER_BIN/.dex"
write_success "Created dex and .dex command wrappers in $USER_BIN."

# On Unix/macOS, npm link creates extensionless shim files alongside the symlinks.
# Clean up any extensionless files that could cause "permission denied" or ambiguity issues.
NPM_PREFIX=$(npm prefix -g 2>/dev/null)
if [ -n "$NPM_PREFIX" ]; then
    NPM_BIN="$NPM_PREFIX/bin"
    # Remove extensionless shim if it's a regular file (not a symlink, which is what we want)
    for shim in ".dex" "dex"; do
        SHIM_PATH="$NPM_BIN/$shim"
        if [ -f "$SHIM_PATH" ] && [ ! -L "$SHIM_PATH" ]; then
            rm -f "$SHIM_PATH" 2>/dev/null || true
        fi
    done
fi

write_success ".dex CLI installed successfully!"

# 4. Build per-user search cache and verify bundled capture extension
write_info "Preparing per-user search index..."
if (cd "$INSTALL_DIR" && node bin/dex.js search --refresh >/dev/null 2>&1); then
    write_success "Search index prepared in $HOME/.dex"
else
    write_warn "Could not prepare search index. It will be rebuilt on first search."
fi

CAPTURE_EXTENSION_PATH="$INSTALL_DIR/extension/dex-capture"
if [ -f "$CAPTURE_EXTENSION_PATH/manifest.json" ]; then
    write_success "Capture extension available at $CAPTURE_EXTENSION_PATH"
else
    write_warn "Capture extension files were not found at $CAPTURE_EXTENSION_PATH"
fi

# 5. Configure shell profile for .dex command
# On Unix/macOS, '.dex' starts with a dot which can conflict with shell builtins.
# We add a shell alias/function so '.dex' reliably invokes the CLI.
write_info "Configuring .dex command in shell profile..."

configure_shell_profile() {
    local profile_file="$1"
    local shell_name="$2"
    
    if [ ! -f "$profile_file" ]; then
        touch "$profile_file"
    fi
    
    # Add portable Node.js bin path if configured
    if [ -n "$PORTABLE_NODE_PATH" ]; then
        if ! grep -q "$PORTABLE_NODE_PATH/bin" "$profile_file" 2>/dev/null; then
            echo "export PATH=\"$PORTABLE_NODE_PATH/bin:\$PATH\"" >> "$profile_file"
            write_success "Added portable Node.js path to $shell_name profile ($profile_file)"
        fi
    fi

    if ! grep -q "$HOME/.local/bin" "$profile_file" 2>/dev/null; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$profile_file"
        write_success "Added user bin directory to $shell_name profile ($profile_file)"
    fi
    
    if ! grep -q "function .dex\|alias .dex=" "$profile_file" 2>/dev/null; then
        cat >> "$profile_file" << 'DEXFUNC'

# .dex command function added by .dex installer
.dex() {
    command dex "$@"
}
DEXFUNC
        write_success "Added .dex function to $shell_name profile ($profile_file)"
    else
        write_info ".dex function already exists in $shell_name profile."
    fi
}

# Detect current shell and configure the appropriate profile
CURRENT_SHELL=$(basename "${SHELL:-/bin/bash}")

case "$CURRENT_SHELL" in
    zsh)
        configure_shell_profile "$HOME/.zshrc" "zsh"
        ;;
    bash)
        if [ "$(uname)" = "Darwin" ]; then
            # macOS uses .bash_profile for login shells
            configure_shell_profile "$HOME/.bash_profile" "bash"
        else
            configure_shell_profile "$HOME/.bashrc" "bash"
        fi
        ;;
    fish)
        # Fish uses a different syntax
        FISH_CONFIG="$HOME/.config/fish/config.fish"
        mkdir -p "$(dirname "$FISH_CONFIG")"
        if [ -n "$PORTABLE_NODE_PATH" ]; then
            if ! grep -q "$PORTABLE_NODE_PATH/bin" "$FISH_CONFIG" 2>/dev/null; then
                echo "fish_add_path $PORTABLE_NODE_PATH/bin" >> "$FISH_CONFIG"
                write_success "Added portable Node.js path to fish config ($FISH_CONFIG)"
            fi
        fi
        if ! grep -q "$HOME/.local/bin" "$FISH_CONFIG" 2>/dev/null; then
            echo "fish_add_path $HOME/.local/bin" >> "$FISH_CONFIG"
            write_success "Added user bin directory to fish config ($FISH_CONFIG)"
        fi
        if ! grep -q "function .dex\|alias .dex=" "$FISH_CONFIG" 2>/dev/null; then
            cat >> "$FISH_CONFIG" << 'DEXFISH'

# .dex command function added by .dex installer
function .dex
    command dex $argv
end
DEXFISH
            write_success "Added .dex function to fish config ($FISH_CONFIG)"
        else
            write_info ".dex function already exists in fish config."
        fi
        ;;
    *)
        # Try .profile as a generic fallback
        configure_shell_profile "$HOME/.profile" "shell"
        ;;
esac

# Define the function in the current session so it works immediately
.dex() {
    command dex "$@"
}

# 6. Show Setup Complete & Usage Info
echo -e ""
echo -e "${CYAN}     .DEX CLI Setup Complete${NC}"
echo -e "${CYAN}     ------------------------${NC}"
echo -e "${CYAN}     Version: $DEX_VERSION${NC}"
echo -e "${CYAN}     Command: .dex${NC}"
echo -e ""

echo -e "${YELLOW}Usage Examples:${NC}"
echo -e "  .dex                     - View stats and ASCII logo"
echo -e "  .dex create <url> [name] - Disguise & register a web app"
echo -e "  .dex launch <app-name>   - Run your desktop web app"
echo -e "  .dex list                - List registered apps"
echo -e "  .dex help                - See all command options"

echo -e "\n${GREEN}Restart your terminal to begin using .dex from any directory!${NC}\n"
