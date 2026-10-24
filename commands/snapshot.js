import { getWorkspace, addWorkspace, readDb, writeDb } from '../storage/db.js';
import { getRunningGuiApps, launchCapturedApp } from '../core/osApps.js';
import { launchUrl } from '../core/launcher.js';
import { checkCaptureExtension, getCaptureExtensionPath, requestBrowserTabs } from '../core/tabCaptureBridge.js';
import { style, tick, isRegisteredAppUrl, isChromeAppUrl } from './utils.js';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

function parseSnapshotArgs(args) {
  const action = args[0]?.toLowerCase();
  const rest = action === 'save' || action === 'restore' ? args.slice(1) : args;
  let name = '';

  for (let i = 0; i < rest.length; i++) {
    if ((rest[i] === '-w' || rest[i] === '--workspace') && rest[i + 1]) {
      name = rest[i + 1];
      break;
    }
    if (!rest[i].startsWith('-')) {
      name = rest[i];
      break;
    }
  }

  return { action, name };
}

async function captureBrowserTabs(context = {}) {
  // Quick probe: if extension is already active, this resolves quickly (< 1.5s)
  try {
    const extensionTabs = await requestBrowserTabs(1500);
    return {
      tabs: extensionTabs.map(tab => tab.url),
      tabDetails: extensionTabs,
      warnings: []
    };
  } catch (_) {
    // Extension not connected on quick probe
  }

  // Guide user immediately on how to load the extension
  console.log(`\n${style.bold}${style.cyan}.dex Capture Bridge Extension${style.reset}`);
  console.log(`${style.yellow}Browser extension not connected yet. To capture live tabs:${style.reset}`);
  console.log(`  Folder: ${style.bold}${getCaptureExtensionPath()}${style.reset}`);
  console.log('  1. Open chrome://extensions (or edge://extensions)');
  console.log('  2. Enable "Developer mode" toggle');
  console.log('  3. Click "Load unpacked" and select the folder above.\n');

  const shouldWait = await askYesNo('Have you loaded the extension and want to capture browser tabs now? (y/N): ', context);

  if (shouldWait) {
    console.log('Connecting to browser extension (click the .dex extension icon in your browser to connect)...');
    try {
      const extensionTabs = await requestBrowserTabs(15000);
      return {
        tabs: extensionTabs.map(tab => tab.url),
        tabDetails: extensionTabs,
        warnings: []
      };
    } catch (err) {
      console.log(`${style.yellow}Could not connect to extension: ${err.message}. Proceeding without browser tabs.${style.reset}`);
      return {
        tabs: [],
        tabDetails: [],
        warnings: []
      };
    }
  }

  console.log(`${style.dim}Proceeding without browser tabs...${style.reset}`);
  return {
    tabs: [],
    tabDetails: [],
    warnings: []
  };
}

function isTerminalApp(app) {
  const value = `${app?.name || ''} ${app?.path || ''} ${app?.launchName || ''}`.toLowerCase();
  return [
    'windowsterminal',
    'windows terminal',
    'terminal.exe',
    'wt.exe',
    'powershell.exe',
    'pwsh.exe',
    'cmd.exe',
    'conhost.exe',
    'openconsole.exe'
  ].some(term => value.includes(term));
}

async function askYesNo(question, context = {}) {
  if (context.rl) {
    const answer = await context.rl.question(question);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function filterTerminalApps(osApps, context = {}) {
  const terminalApps = osApps.filter(isTerminalApp);
  if (terminalApps.length === 0) return osApps;

  const terminalNames = terminalApps.map(app => app.name).join(', ');
  console.log(`${style.yellow}Note: terminal detected by snapshot capture: ${terminalNames}.${style.reset}`);
  const keepTerminals = await askYesNo('Do you want to keep terminal window(s) in this workspace snapshot? (y/N): ', context);

  if (keepTerminals) {
    return osApps;
  }

  return osApps.filter(app => !isTerminalApp(app));
}

async function saveSnapshot(name, options = {}, context = {}) {
  let ws = getWorkspace(name);
  if (!ws) {
    ws = addWorkspace(name, []);
    console.log(`${tick} Created snapshot "${name}".`);
  }

  const { tabs, tabDetails, warnings } = await captureBrowserTabs(context);
  const { getRunningVsCodeFolders } = await import('../core/osApps.js');
  const ideFolders = getRunningVsCodeFolders();
  const osApps = await filterTerminalApps(getRunningGuiApps(), context);

  const db = readDb();
  db.workspaces[ws.id].snapshot = {
    tabs,
    tabDetails,
    ideFolders,
    osApps,
    timestamp: new Date().toISOString()
  };
  writeDb(db);

  warnings.forEach(warning => {
    console.log(`${style.yellow}Warning: ${warning}${style.reset}`);
  });

  console.log(`
${style.bold}${style.green}Snapshot Saved!${style.reset}
Name: ${ws.name}
  - Browser tabs captured: ${tabs.length}
  - Apps in use captured: ${osApps.length}
  - VS Code folders captured: ${ideFolders.length}

${style.dim}Restore it with:${style.reset}
  snapshot restore ${ws.name}
`);
}

async function restoreSnapshot(name) {
  const ws = getWorkspace(name);
  if (!ws || !ws.snapshot) {
    console.log(`${style.yellow}No snapshot found for "${name}". Save one first with: snapshot save ${name}${style.reset}`);
    return;
  }

  const snapshot = ws.snapshot;
  console.log(`Restoring snapshot "${ws.name}"...`);

  // 1. Restore browser tabs
  if (snapshot.tabs && snapshot.tabs.length > 0) {
    console.log(`Opening ${snapshot.tabs.length} browser tab(s)...`);
    const tabDetailsMap = new Map();
    if (snapshot.tabDetails) {
      for (const detail of snapshot.tabDetails) {
        if (detail && detail.url) {
          tabDetailsMap.set(detail.url, detail);
        }
      }
    }
    for (const url of snapshot.tabs) {
      const detail = tabDetailsMap.get(url);
      let asApp = false;
      if (detail && detail.windowType) {
        asApp = detail.windowType === 'app' || detail.windowType === 'popup';
      } else if (isRegisteredAppUrl(url) || isChromeAppUrl(url)) {
        asApp = true;
      }
      await launchUrl(url, 'auto', asApp);
    }
  }

  // 2. Restore IDE folders
  const { launchSystemCommand } = await import('../core/osApps.js');
  if (snapshot.ideFolders && snapshot.ideFolders.length > 0) {
    console.log(`Opening ${snapshot.ideFolders.length} VS Code folder(s)...`);
    for (const folder of snapshot.ideFolders) {
      await launchSystemCommand('code', [folder]);
    }
  }

  // 3. Restore OS apps
  if (snapshot.osApps && snapshot.osApps.length > 0) {
    console.log(`Launching ${snapshot.osApps.length} OS app(s)...`);
    for (const app of snapshot.osApps) {
      await launchCapturedApp(app);
    }
  }

  console.log(`${tick} Snapshot restored successfully.`);
}

export default {
  name: 'snapshot',
  description: 'Save and restore named workspace snapshots (browser tabs, apps, IDE folders)',
  async execute(args, context = {}) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'extension' || sub === '--extension' || sub === 'install') {
      console.log(`${style.bold}.dex Capture Bridge Extension${style.reset}`);
      console.log('Load this bundled extension once in Chrome, Edge, or Brave:');
      console.log(`  ${getCaptureExtensionPath()}`);
      console.log('');
      console.log('1. Open chrome://extensions (or edge://extensions)');
      console.log('2. Enable "Developer mode" toggle');
      console.log('3. Click "Load unpacked" and select the folder above.');
      return;
    }

    if (sub === 'status') {
      try {
        await checkCaptureExtension();
        console.log(`${style.green}.dex Capture Bridge is connected.${style.reset}`);
      } catch (err) {
        console.log(`${style.yellow}${err.message}${style.reset}`);
        console.log('Run: snapshot extension');
      }
      return;
    }

    const { action, name } = parseSnapshotArgs(args);

    if (!action || (action !== 'save' && action !== 'restore')) {
      console.log(`${style.red}Error: Please specify snapshot action ('save' or 'restore').${style.reset}`);
      console.log('Usage: snapshot save <name>');
      console.log('       snapshot restore <name>');
      console.log('       snapshot extension');
      console.log('       snapshot status');
      return;
    }

    if (!name) {
      console.log(`${style.red}Error: Please specify snapshot name. Example: snapshot ${action} coding-session${style.reset}`);
      return;
    }

    if (action === 'save') {
      await saveSnapshot(name, {}, context);
    } else {
      await restoreSnapshot(name);
    }
  }
};
