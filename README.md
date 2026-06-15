# .dex CLI

Manage and launch standalone desktop web apps directly from your terminal, Windows Run dialog (Win + R), Start Menu, or scripts. 

.dex turns your web bookmarks into native-feeling desktop applications with zero-lag startup and silent, background process management.

![.dex CLI Banner](webpreview.png)

---

## Installation

You can install .dex globally on any machine with a single terminal command. No manual cloning or configuration required.

### Windows (PowerShell)
Run the following in PowerShell as Administrator or standard user:
```powershell
irm https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.ps1 | iex
```

### macOS & Linux (Terminal)
Run the following in your shell:
```bash
curl -fsSL https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.sh | bash
```

Note: Restart your terminal after setup to refresh path variables.

---

## Usage & Commands

```bash
.dex <command> [arguments]
```

### 1. Register a Desktop Web App
Creates a wrapper desktop application from any URL.
```bash
.dex create https://github.com github
```
- --hidden: Disguise the shortcut using a system utility icon (e.g., Notepad, Calculator) to hide its true contents.
- -w, --workspace <name>: Assign the app directly to a workspace.

### 2. Launch App(s)
Opens one or more registered applications in standalone windows.
```bash
.dex launch github chatgpt
```
- -w, --workspace <name>: Launch all applications assigned to a specific workspace at once.

### 3. Start Menu & Search Integration (Windows Only)
When you register an app via .dex, a shortcut is placed in:
1. Your Desktop
2. Your Windows Start Menu Programs folder

This allows you to press the Win key, search for your custom app name (e.g., github), and launch it directly from Windows Search.

### 4. Manage Apps
- List registered apps: .dex list (use --all to view hidden apps)
- Search apps: .dex search <query>
- Update metadata: .dex update <app-id> [--url <url>] [--name <name>] [--hidden <true|false>] [--workspace <ws>]
- Delete app: .dex remove <app-name> (deletes configuration, desktop shortcuts, and Start Menu entries)

### 5. Analytics & Housekeeping
- Recent launches: .dex recent
- Analytics & usage statistics: .dex stats
- Weekly launch graph summary: .dex summarize
- Identify unused apps (30+ days): .dex suggest
- Interactively purge unused apps: .dex clean
- Database Backup/Restore: .dex export <file.json> and .dex import <file.json>

---

## System Architecture & Technology

- Zero Third-Party Dependencies: Designed for maximum speed and security, using only native Node.js core modules.
- Silent Launch System: Windows shortcuts launch apps completely silently in the background via wscript.exe and .vbs hooks, avoiding console window flickering.
- Cross-Platform: Core CLI is fully compatible with Windows, macOS, and Linux.

---

## Roadmap (v2)
- Web Dashboard: An interactive Local GUI to manage and track workspace analytics (.dex serve route preview).
- Auto-Camouflage: System tray background management.

---

## License

Licensed under the Apache License, Version 2.0 (the "License"). See the [LICENSE](LICENSE) file for details.
