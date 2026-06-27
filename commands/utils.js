import os from 'os';
import fs from 'fs';
import path from 'path';
import { getApps } from '../storage/db.js';

export function isChromeAppUrl(urlStr) {
  try {
    const platform = os.platform();
    let chromeAppsDirs = [];

    if (platform === 'win32') {
      chromeAppsDirs.push(path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Chrome Apps'));
    } else if (platform === 'darwin') {
      chromeAppsDirs.push(path.join(os.homedir(), 'Applications/Chrome Apps.localized'));
      chromeAppsDirs.push(path.join(os.homedir(), 'Applications'));
    } else {
      chromeAppsDirs.push(path.join(os.homedir(), '.local/share/applications'));
    }

    const fullUrlLower = urlStr.toLowerCase();

    for (const dir of chromeAppsDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);

      for (const file of files) {
        let appName = '';
        if (platform === 'win32' && file.toLowerCase().endsWith('.lnk')) {
          appName = path.basename(file, '.lnk');
        } else if (platform === 'darwin' && file.toLowerCase().endsWith('.app')) {
          appName = path.basename(file, '.app');
        } else if (platform === 'linux' && file.toLowerCase().endsWith('.desktop') && (file.includes('chrome-') || file.includes('msedge-'))) {
          try {
            const content = fs.readFileSync(path.join(dir, file), 'utf-8');
            const nameMatch = content.match(/^Name=(.+)$/m);
            if (nameMatch) appName = nameMatch[1];
          } catch (_) {}
        }

        if (!appName) continue;
        const appWords = appName.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
        if (appWords.length === 0) continue;

        if (appWords.every(word => fullUrlLower.includes(word))) {
          return true;
        }
      }
    }
  } catch (_) {}
  return false;
}


export function isRegisteredAppUrl(urlStr) {
  if (!urlStr) return false;
  try {
    let formattedUrl = urlStr;
    if (!/^https?:\/\//i.test(urlStr)) {
      formattedUrl = 'https://' + urlStr;
    }
    const parsedUrl = new URL(formattedUrl);
    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    const apps = getApps();
    
    return apps.some(app => {
      if (app.url) {
        const isImported = /_[a-z0-9]{4}$/.test(app.id);
        if (isImported) return false;

        try {
          const appParsed = new URL(app.url);
          const appHost = appParsed.hostname.toLowerCase().replace(/^www\./, '');
          
          if (host === appHost) {
            const path1 = parsedUrl.pathname.toLowerCase().replace(/\/$/, '');
            const path2 = appParsed.pathname.toLowerCase().replace(/\/$/, '');
            return path1.startsWith(path2);
          }
        } catch (_) {}
      }
      return false;
    });
  } catch (_) {
    return false;
  }
}


export const style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

export const tick = `${style.green}✓${style.reset}`;
export const cross = `${style.red}✗${style.reset}`;

export function formatRelativeTime(dateStr) {
  if (!dateStr) return 'never';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export function getSystemUptime() {
  const uptimeSec = os.uptime();
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function parseUrlDetails(urlStr) {
  try {
    let formattedUrl = urlStr;
    if (!/^https?:\/\//i.test(urlStr)) {
      formattedUrl = 'https://' + urlStr;
    }
    const parsed = new URL(formattedUrl);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    const parts = hostname.split('.');
    
    let mainPart = parts[0];
    if (['mail', 'app', 'play', 'docs', 'my', 'dev'].includes(mainPart) && parts.length > 1) {
      mainPart = parts[1];
    }
    
    const capitalized = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    return { id: mainPart.toLowerCase(), name: capitalized, url: formattedUrl };
  } catch (e) {
    return { id: 'app', name: 'Web App', url: urlStr };
  }
}
