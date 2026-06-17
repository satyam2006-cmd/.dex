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

echo -e "\n${CYAN}=== Installing .dex CLI ===${NC}"

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
echo -e "${BLUE}i Checking system requirements...${NC}"

# --- Node.js & npm Check & Auto-Install ---
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}! Node.js or npm is missing. Attempting auto-installation...${NC}"
    
    PM=$(detect_package_manager)
    
    if [ "$PM" = "brew" ]; then
        echo -e "${BLUE}i Installing Node.js via Homebrew...${NC}"
        brew install node
    elif [ "$PM" = "apt" ]; then
        echo -e "${BLUE}i Installing Node.js & npm via apt...${NC}"
        sudo apt-get update && sudo apt-get install -y nodejs npm
    elif [ "$PM" = "dnf" ]; then
        echo -e "${BLUE}i Installing Node.js & npm via dnf...${NC}"
        sudo dnf install -y nodejs npm
    elif [ "$PM" = "yum" ]; then
        echo -e "${BLUE}i Installing Node.js & npm via yum...${NC}"
        sudo yum install -y nodejs npm
    elif [ "$PM" = "pacman" ]; then
        echo -e "${BLUE}i Installing Node.js & npm via pacman...${NC}"
        sudo pacman -S --noconfirm nodejs npm
    elif [ "$PM" = "apk" ]; then
        echo -e "${BLUE}i Installing Node.js & npm via apk...${NC}"
        sudo apk add nodejs npm
    else
        if [ "$(uname)" = "Darwin" ]; then
            echo -e "${RED}✗ Node.js is missing and Homebrew is not installed.${NC}"
            echo -e "${YELLOW}Please install Homebrew (https://brew.sh/) or install Node.js from https://nodejs.org/${NC}"
        else
            echo -e "${RED}✗ Node.js is missing and no supported package manager was found.${NC}"
            echo -e "${YELLOW}Please install Node.js (v18+) manually and try again.${NC}"
        fi
        exit 1
    fi

    # Verify Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js installation verification failed.${NC}"
        echo -e "${YELLOW}Please install Node.js (v18+) manually and try again.${NC}"
        exit 1
    fi
    # Verify npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm installation verification failed.${NC}"
        echo -e "${YELLOW}Please install npm manually and try again.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Node.js found: $(node -v)${NC}"
echo -e "${GREEN}✓ npm found: v$(npm -v)${NC}"

# --- Git Check & Auto-Install ---
GIT_AVAILABLE=false
if command -v git &> /dev/null; then
    GIT_AVAILABLE=true
else
    echo -e "${YELLOW}! Git is missing. Attempting auto-installation...${NC}"
    PM=$(detect_package_manager)
    
    if [ "$PM" = "brew" ]; then
        echo -e "${BLUE}i Installing Git via Homebrew...${NC}"
        brew install git
    elif [ "$PM" = "apt" ]; then
        echo -e "${BLUE}i Installing Git via apt...${NC}"
        sudo apt-get install -y git
    elif [ "$PM" = "dnf" ]; then
        echo -e "${BLUE}i Installing Git via dnf...${NC}"
        sudo dnf install -y git
    elif [ "$PM" = "yum" ]; then
        echo -e "${BLUE}i Installing Git via yum...${NC}"
        sudo yum install -y git
    elif [ "$PM" = "pacman" ]; then
        echo -e "${BLUE}i Installing Git via pacman...${NC}"
        sudo pacman -S --noconfirm git
    elif [ "$PM" = "apk" ]; then
        echo -e "${BLUE}i Installing Git via apk...${NC}"
        sudo apk add git
    fi

    if command -v git &> /dev/null; then
        GIT_AVAILABLE=true
        echo -e "${GREEN}✓ Git installed successfully: $(git --version)${NC}"
    else
        echo -e "${YELLOW}! Git installation failed or skipped. Will use ZIP download fallback.${NC}"
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
    echo -e "${BLUE}i Running in local repository mode...${NC}"
    INSTALL_DIR=$(pwd)
else
    echo -e "${BLUE}i Running in remote installation mode...${NC}"
    INSTALL_DIR="$HOME/.dex-cli"
    
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${BLUE}i Existing installation found at $INSTALL_DIR. Updating...${NC}"
    else
        mkdir -p "$INSTALL_DIR"
    fi

    # Try Git clone (uses GIT_AVAILABLE from dependency check above)
    if [ "$GIT_AVAILABLE" = true ]; then
        echo -e "${BLUE}i Cloning repository via Git...${NC}"
        if [ -d "$INSTALL_DIR/.git" ]; then
            cd "$INSTALL_DIR"
            git fetch --all &>/dev/null
            git reset --hard origin/master &>/dev/null
            cd - &>/dev/null
        else
            git clone https://github.com/satyam2006-cmd/.dex.git "$INSTALL_DIR" &>/dev/null
        fi
    else
        echo -e "${BLUE}i Git not found. Downloading via curl...${NC}"
        ZIP_PATH="/tmp/dex-v1.0.1.zip"
        curl -sSL "https://github.com/satyam2006-cmd/.dex/archive/refs/tags/v1.0.1.zip" -o "$ZIP_PATH"
        
        echo -e "${BLUE}i Extracting files...${NC}"
        EXTRACT_TEMP="/tmp/dex_extract_temp"
        rm -rf "$EXTRACT_TEMP" && mkdir -p "$EXTRACT_TEMP"
        unzip -q "$ZIP_PATH" -d "$EXTRACT_TEMP"
        
        EXTRACTED_DIR=$(find "$EXTRACT_TEMP" -maxdepth 1 -mindepth 1 -type d | head -n 1)
        cp -R "$EXTRACTED_DIR"/* "$INSTALL_DIR/"
        
        # Clean up
        rm -f "$ZIP_PATH"
        rm -rf "$EXTRACT_TEMP"
    fi
fi

# 3. Global Linking
echo -e "${BLUE}i Linking .dex CLI globally...${NC}"
cd "$INSTALL_DIR"

# Try link normally
if npm link --force &>/dev/null; then
    echo -e "${GREEN}✓ Linked globally without sudo.${NC}"
else
    echo -e "${YELLOW}! Local link failed. Retrying with sudo...${NC}"
    if sudo npm link --force; then
        echo -e "${GREEN}✓ Linked globally with sudo.${NC}"
    else
        echo -e "${RED}✗ Failed to link CLI. Check your npm permissions.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ .dex CLI installed successfully!${NC}"

# 4. Show Logo & Usage Info
echo -e "${CYAN}"
echo "                   ███                           "
echo "                  ████                           .DEX CLI"
echo "                  ████                           ------------------------"
echo "           ███████████  ████████   ████   ███    Version: 1.0.1"
echo "         █████████████ ███████████  █████████    Status: Ready"
echo "         ███      ████████████████   ██████      Command: .dex"
echo " ██████  ███      ████████████████    █████      "
echo " ██████  ████    █████ ███     ██   ███████     Type '.dex' to launch."
echo " ██████   ████████████  ██████████ ████   ████   "
echo -e "${NC}"

echo -e "${YELLOW}Usage Examples:${NC}"
echo -e "  .dex                     - View stats and ASCII logo"
echo -e "  .dex create <url> [name] - Disguise & register a web app"
echo -e "  .dex launch <app-name>   - Run your desktop web app"
echo -e "  .dex list                - List registered apps"
echo -e "  .dex help                - See all command options"
echo -e "\n${GREEN}Restart your terminal to begin using .dex from any directory!${NC}\n"
