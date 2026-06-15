import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';

// Dynamic path resolution on Windows
const localAppData = process.env.LOCALAPPDATA || '';
const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

const POSSIBLE_CHROME_PATHS = [
  path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
];

const POSSIBLE_EDGE_PATHS = [
  path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
];

// Resolves path of available browser executable
export function getBrowsers() {
  const chrome = POSSIBLE_CHROME_PATHS.find(p => fs.existsSync(p)) || null;
  const edge = POSSIBLE_EDGE_PATHS.find(p => fs.existsSync(p)) || null;
  
  return { chrome, edge };
}

// Launches a URL in app mode
export function launchUrl(url, preferredBrowser = 'auto') {
  const browsers = getBrowsers();
  let browserPath = null;

  if (preferredBrowser === 'chrome') {
    browserPath = browsers.chrome || browsers.edge;
  } else if (preferredBrowser === 'edge') {
    browserPath = browsers.edge || browsers.chrome;
  } else {
    // Default: try Chrome first, then Edge
    browserPath = browsers.chrome || browsers.edge;
  }

  // If no specific Chromium binary was found in standard paths, attempt to spawn by command
  if (!browserPath) {
    // Check if we can fallback to standard start commands, or run default browser using start command
    return new Promise((resolve) => {
      // Launch using start which opens the default browser (though not in standalone mode)
      const command = `start "" "${url}"`;
      exec(command, (err) => {
        if (err) {
          console.error('Failed to open default browser via shell:', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  return new Promise((resolve) => {
    // Standalone Chromium app mode flag
    const args = [`--app=${url}`];
    
    // Spawn the browser as a detached background process
    const child = spawn(browserPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref();
    resolve(true);
  });
}
