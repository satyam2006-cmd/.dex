import os from 'os';

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
