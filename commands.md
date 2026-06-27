# .dex CLI Command Reference

This file documents all the commands available in the `.dex` command-line tool.

---

## Core Commands

### `help`
Show the interactive help menu listing available commands.
* **Usage**: `help` or `.dex help`

### `clear` / `cls`
Clear the terminal screen (applicable when running in interactive REPL shell mode).
* **Usage**: `clear` / `cls`

### `exit` / `quit`
Exit the interactive REPL shell.
* **Usage**: `exit` / `quit`

### `create`
Create a desktop web app shortcut from a Web URL.
* **Usage**: `create <url> [name] [flags]`
* **Flags**:
  * `--hidden`: Disguises and hides the shortcut file in Windows Explorer.
  * `--icon <path_or_url>`: Path to a local image/executable or a direct URL to fetch an icon (.png, .jpg, .ico).
  * `-w`, `--workspace <name>`: Re-assign/assign app to a workspace on creation.
* **Example**:
  ```bash
  .dex create https://github.com github --icon https://github.com/favicon.ico -w coding
  ```

### `launch`
Launch registered web apps, OS applications, or workspaces.
* **Usage**: `launch <app-names...>` or `launch -os <native-app>` or `launch --workspace <workspace-name>`
* **Flags**:
  * `-os`, `--os <name>`: Launch an installed native desktop app (e.g., `launch -os vscode`).
  * `-w`, `--workspace <name>`: Launch all apps associated with the specified workspace.
* **Examples**:
  ```bash
  .dex launch github
  .dex launch -os vscode spotify
  .dex launch -w coding
  ```

### `update`
Update metadata of a registered web app, or self-update the `.dex` CLI tool to the latest version.
* **Usage**: `update <app-id> [flags]` or `update self`
* **Flags**:
  * `--url <url>`: Update the target Web URL.
  * `--name <name>`: Update the display name of the app (also recreates/renames the desktop shortcut).
  * `--hidden <true|false>`: Toggles the disguised/hidden status of the desktop shortcut.
  * `--unlock`: Instantly makes a disguised/hidden shortcut file visible in Explorer.
  * `--workspace <name>`: Assigns or re-assigns the app to workspaces (comma-separated).
* **Examples**:
  ```bash
  .dex update github --name "GitHub Enterprise" --url https://github.com/enterprises
  .dex update self
  ```

### `list`
List all registered web apps.
* **Usage**: `list [flags]`
* **Flags**:
  * `-a`, `--all`: Show all apps including hidden/disguised ones.
  * `--hidden`: Show only hidden/disguised apps.

### `search`
Perform a fuzzy search across apps, workspaces, snapshots, profiles, and commands. If run with no arguments in a TTY environment, it opens an interactive autocomplete list.
* **Usage**: `search [query] [flags]`
* **Flags**:
  * `-l`, `--launch`: Automatically launches the best/first matching result.
  * `--refresh`: Rebuilds the fuzzy search index cache.
* **Example**:
  ```bash
  .dex search code -l
  ```

### `remove`
Delete app metadata and its corresponding desktop shortcut. Prompts for confirmation.
* **Usage**: `remove <app-name>`

### `info`
Show detailed information about a registered app, including creation time, last launch, usage counter, category, and camouflage status.
* **Usage**: `info <app-name>`

---

## Workspaces & Productivity

### `capture`
Capture live open browser tabs using the `.dex` browser extension.
* **Usage**: `capture <name>` or `capture install` or `capture status`
* **Subcommands**:
  * `install`: Shows the unpacked path of the bundled browser extension so you can load it in Developer Mode.
  * `status`: Checks whether the capture bridge extension is currently active and connected.
* **Example**:
  ```bash
  .dex capture coding-session
  ```

### `snapshot`
Save and restore workspace session snapshots (browser tabs, open IDE folders, native apps).
* **Usage**: `snapshot save <name>` or `snapshot restore <name>`
* **Subcommands**:
  * `save <name>`: Captures current open tabs (from active Chromium browsers) and running GUI applications, saving it under the given workspace/snapshot name.
  * `restore <name>`: Launches all GUI apps, VS Code folders, and opens browser tabs captured in the saved snapshot.

### `workspace`
Manage structured workspaces, snapshots, and tab imports.
* **Usage**: `workspace <subcommand>`
* **Subcommands**:
  * `list` (or `ls`): List all workspaces and their associated apps.
  * `create -w <name>`: Create a new empty workspace.
  * `delete -w <name>`: Delete an existing workspace.
  * `rename -w <old-name> <new-name>`: Rename a workspace.
  * `add -w <workspace> <app>`: Add a registered app to a workspace.
  * `remove -w <workspace> <app>`: Remove an app from a workspace.
  * `launch -w <name>`: Launch all apps and tabs inside a workspace.
  * `snapshot save -w <name>`: Save the current session snapshot for the workspace.
  * `snapshot restore -w <name>`: Restore the saved snapshot for the workspace.
  * `import -w <name> <browser>`: Import currently open tabs from a browser (chrome, edge, brave, opera).

### `profile`
Manage higher-level launch profiles (group multiple workspaces and custom workflow command chains).
* **Usage**: `profile <subcommand>`
* **Subcommands**:
  * `list` (or `ls`): List all profiles.
  * `show <name>` (or `info`/`view`): Inspect workspace and workflow assignments in a profile.
  * `create <name>`: Create a new profile.
  * `rename <profile> <new-name>`: Rename a profile.
  * `add-workspace <profile> <workspace>`: Add a workspace to a profile.
  * `remove-workspace <profile> <workspace>`: Remove a workspace from a profile.
  * `add-workflow <profile> <name> -- <command...>`: Add a custom command chain that runs sequentially during profile launch.
  * `edit-workflow <profile> <name> -- <command...>`: Update an existing workflow command in the profile.
  * `remove-workflow <profile> <name>`: Remove a workflow command from the profile.
  * `launch <profile>`: Launch the profile.
  * `--<profile-name>`: Shortcut to run/launch a profile (e.g. `profile --gaming`).

---

## Analytics & Utilities

### `recent`
Show recently launched apps sorted by usage timestamp.
* **Usage**: `recent`

### `stats`
Show overall usage statistics: total registered apps, total launches, most used, and least used apps.
* **Usage**: `stats`

### `export`
Export the entire `.dex` application library database to a JSON file.
* **Usage**: `export <file.json>`

### `import`
Import a `.dex` application library database from a JSON file.
* **Usage**: `import <file.json>`

### `suggest`
List registered apps that have not been launched within the last 30 days.
* **Usage**: `suggest`

### `clean`
Interactively prompt to remove apps (and delete their desktop shortcuts) that haven't been used in over 30 days.
* **Usage**: `clean`

### `summarize`
Show a weekly launch activity summary displaying a text-based usage bar chart by day of the week, plus the top 5 most active apps.
* **Usage**: `summarize`

### `serve`
Start the Web Dashboard server (under development, planned for v2).
* **Usage**: `serve` (or `dashboard`)
