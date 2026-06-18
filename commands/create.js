import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { addApp } from '../storage/db.js';
import { createDesktopShortcut } from '../core/shortcut.js';
import { style, parseUrlDetails, tick, cross } from './utils.js';
import { pngToIco } from '../core/pngToIco.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  name: 'create',
  description: 'Create a desktop app shortcut from a URL',
  async execute(args) {
    const isHidden = args.includes('--hidden');
    
    let iconArg = null;
    const iconIdx = args.indexOf('--icon');
    if (iconIdx !== -1 && args[iconIdx + 1]) {
      iconArg = args[iconIdx + 1];
    }
    
    // Look for workspace flags
    let workspaceName = '';
    const wsIndex = args.findIndex(arg => arg === '--workspace' || arg === '-w');
    if (wsIndex !== -1 && args[wsIndex + 1]) {
      workspaceName = args[wsIndex + 1];
    }

    // Filter out flags and their values to get positional arguments
    let filteredArgs = [];
    let i = 0;
    while (i < args.length) {
      if (args[i] === '--hidden') {
        i++;
      } else if (args[i] === '--icon') {
        i += 2;
      } else if (args[i] === '-w' || args[i] === '--workspace') {
        i += 2;
      } else {
        filteredArgs.push(args[i]);
        i++;
      }
    }

    let urlArg = filteredArgs[0];
    let appName = filteredArgs[1];

    if (!urlArg) {
      console.log(`${style.red}Error: Please specify a URL.${style.reset}`);
      console.log(`Usage: create <url> [name] [--hidden] [--icon <path_or_url>] [-w <workspace>]`);
      return;
    }

    if (!/^https?:\/\//i.test(urlArg)) {
      urlArg = 'https://' + urlArg;
    }

    // 1. Silent URL Reachability Check
    console.log(`Verifying URL reachability: ${urlArg}...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(urlArg, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(timeoutId);
      
      if (!res.ok && res.status >= 400) {
        console.log(`${style.red}Error: The URL returned status code ${res.status}. Creation aborted.${style.reset}`);
        return;
      }
    } catch (err) {
      console.log(`${style.red}Error: The URL "${urlArg}" is unreachable or invalid. Creation aborted.${style.reset}`);
      return;
    }

    const details = parseUrlDetails(urlArg);
    const finalId = appName ? appName.toLowerCase().replace(/[^a-z0-9_-]/g, '') : details.id;
    const finalName = appName || details.name;

    // 2. Custom Icon Processing & PNG to ICO Conversion
    let finalIconPath = null;
    const iconsDir = path.join(os.homedir(), '.dex', 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Default icon fallback for hidden apps: use .dex logo
    if (isHidden && !iconArg) {
      iconArg = '.dex';
    }

    if (iconArg) {
      const targetIcoPath = path.join(iconsDir, `${finalId}.ico`);
      try {
        if (iconArg === '.dex') {
          const dexIcoPath = path.join(iconsDir, 'dex.ico');
          if (!fs.existsSync(dexIcoPath)) {
            const projectRoot = path.resolve(__dirname, '..');
            const logoPngPath = path.join(projectRoot, 'logo.png');
            if (fs.existsSync(logoPngPath)) {
              const pngBuf = fs.readFileSync(logoPngPath);
              const icoBuf = pngToIco(pngBuf);
              fs.writeFileSync(dexIcoPath, icoBuf);
            }
          }
          if (fs.existsSync(dexIcoPath)) {
            finalIconPath = dexIcoPath;
          }
        } else if (iconArg.startsWith('http://') || iconArg.startsWith('https://')) {
          console.log(`Downloading icon from ${iconArg}...`);
          const res = await fetch(iconArg);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (iconArg.endsWith('.ico') || buf.toString('ascii', 0, 4) === '\0\0\x01\0') {
              fs.writeFileSync(targetIcoPath, buf);
            } else {
              const icoBuf = pngToIco(buf);
              fs.writeFileSync(targetIcoPath, icoBuf);
            }
            finalIconPath = targetIcoPath;
          } else {
            console.log(`${style.yellow}Warning: Failed to download custom icon. Using default browser icon.${style.reset}`);
          }
        } else {
          const localPath = path.resolve(iconArg);
          if (fs.existsSync(localPath)) {
            if (iconArg.endsWith('.ico') || iconArg.endsWith('.exe') || iconArg.endsWith('.dll')) {
              finalIconPath = localPath;
            } else {
              const buf = fs.readFileSync(localPath);
              const icoBuf = pngToIco(buf);
              fs.writeFileSync(targetIcoPath, icoBuf);
              finalIconPath = targetIcoPath;
            }
          } else {
            console.log(`${style.yellow}Warning: Custom icon path "${iconArg}" does not exist. Using default browser icon.${style.reset}`);
          }
        }
      } catch (err) {
        console.log(`${style.yellow}Warning: Failed to process icon (${err.message}). Using default browser icon.${style.reset}`);
      }
    }

    const appData = {
      id: finalId,
      name: finalName,
      url: urlArg,
      hidden: isHidden,
      iconPath: finalIconPath
    };

    if (workspaceName) {
      appData.workspaces = [workspaceName.toLowerCase()];
    }

    // Save to DB
    addApp(appData);

    // Generate Desktop Shortcut
    try {
      await createDesktopShortcut(finalName, finalId, isHidden, finalIconPath);
      console.log(`
${style.bold}${style.green}App Created Successfully${style.reset}
Name: ${finalName}
Location: Desktop
${isHidden ? style.dim + 'Shortcut Camouflaged & Hidden' + style.reset : ''}
`);
    } catch (err) {
      console.log(`
${style.bold}${style.green}App Created${style.reset}
Name: ${finalName}
${style.yellow}Warning: Failed to create desktop shortcut. App saved to library.${style.reset}
`);
    }
  }
};
