const CATEGORY_RULES = [
  {
    category: 'Music',
    names: ['spotify', 'vlc', 'media player', 'windows media player', 'youtube music', 'itunes', 'foobar', 'winamp', 'musicbee'],
    aliases: ['music', 'audio', 'songs', 'player']
  },
  {
    category: 'Coding',
    names: ['visual studio code', 'vs code', 'code', 'cursor', 'intellij', 'pycharm', 'webstorm', 'rider', 'clion', 'android studio', 'github desktop', 'git', 'sublime', 'notepad++'],
    aliases: ['code', 'coding', 'dev', 'developer', 'programming', 'ide', 'git']
  },
  {
    category: 'Communication',
    names: ['discord', 'slack', 'teams', 'microsoft teams', 'telegram', 'whatsapp', 'zoom', 'skype', 'signal'],
    aliases: ['chat', 'call', 'meeting', 'message', 'communication']
  },
  {
    category: 'Design',
    names: ['figma', 'photoshop', 'illustrator', 'adobe xd', 'after effects', 'premiere pro', 'indesign', 'canva', 'blender'],
    aliases: ['design', 'creative', 'photo', 'image', 'vector']
  },
  {
    category: 'Browser',
    names: ['chrome', 'google chrome', 'firefox', 'edge', 'microsoft edge', 'brave', 'opera', 'vivaldi', 'arc'],
    aliases: ['browser', 'web', 'internet']
  },
  {
    category: 'Productivity',
    names: ['word', 'excel', 'powerpoint', 'onenote', 'notion', 'obsidian', 'todoist', 'notes', 'calendar'],
    aliases: ['office', 'docs', 'document', 'sheet', 'notes', 'productivity']
  },
  {
    category: 'Terminal',
    names: ['terminal', 'windows terminal', 'powershell', 'command prompt', 'cmd', 'iterm', 'konsole', 'gnome terminal'],
    aliases: ['shell', 'cli', 'console', 'terminal']
  }
];

const APP_ALIASES = new Map([
  ['visual studio code', ['vs', 'vscode', 'code', 'ide']],
  ['code', ['vs', 'vscode', 'visual studio code']],
  ['cursor', ['ai code', 'editor', 'ide']],
  ['spotify', ['music', 'songs', 'audio']],
  ['vlc media player', ['vlc', 'music', 'video', 'media player']],
  ['windows media player', ['media player', 'music', 'video']],
  ['youtube music', ['music', 'songs', 'yt music']],
  ['github desktop', ['github', 'git', 'repo']],
  ['google chrome', ['chrome', 'browser', 'web']],
  ['microsoft edge', ['edge', 'browser', 'web']],
  ['brave browser', ['brave', 'browser', 'web']],
  ['microsoft teams', ['teams', 'chat', 'meeting']],
  ['adobe photoshop', ['photoshop', 'design', 'photo']],
  ['adobe illustrator', ['illustrator', 'design', 'vector']]
]);

function normalize(value) {
  return String(value || '').toLowerCase();
}

function hasWholeTerm(value, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(value);
}

export function inferCategory(name, existingCategory = '') {
  if (existingCategory && existingCategory !== 'General') {
    return existingCategory;
  }

  const normalized = normalize(name);
  for (const rule of CATEGORY_RULES) {
    if (rule.names.some(term => normalized.includes(term))) {
      return rule.category;
    }
  }
  return 'General';
}

export function inferAliases(name, type = '', category = '') {
  const normalized = normalize(name);
  const aliases = new Set();

  aliases.add(normalized);
  aliases.add(normalized.replace(/\b(microsoft|google|adobe|windows)\b/g, '').replace(/\s+/g, ' ').trim());

  for (const [appName, appAliases] of APP_ALIASES.entries()) {
    if (normalized === appName || hasWholeTerm(normalized, appName) || appName === normalized.replace(/^microsoft\s+/, '')) {
      appAliases.forEach(alias => aliases.add(alias));
    }
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.category === category || rule.names.some(term => normalized.includes(term))) {
      rule.aliases.forEach(alias => aliases.add(alias));
    }
  }

  if (type === 'workspace') aliases.add('workspace');
  if (type === 'snapshot') aliases.add('snapshot');
  if (type === 'web-app') aliases.add('web');
  if (type === 'os-app') aliases.add('app');
  if (type === 'command') aliases.add('command');

  return Array.from(aliases).filter(Boolean);
}
