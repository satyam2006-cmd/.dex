const BRIDGE = 'http://127.0.0.1:17654';

function cleanTab(tab) {
  if (!tab.url || !/^https?:\/\//i.test(tab.url)) return null;
  return {
    title: tab.title || tab.url,
    url: tab.url,
    windowId: tab.windowId,
    index: tab.index,
    active: Boolean(tab.active)
  };
}

async function sendTabs(requestId) {
  const tabs = (await chrome.tabs.query({}))
    .map(cleanTab)
    .filter(Boolean)
    .sort((a, b) => (a.windowId - b.windowId) || (a.index - b.index));

  await fetch(`${BRIDGE}/tabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, tabs })
  });
}

async function pollBridge() {
  try {
    const response = await fetch(`${BRIDGE}/task`, { cache: 'no-store' });
    if (!response.ok) return;

    const task = await response.json();
    if (task && task.type === 'capture' && task.requestId) {
      await sendTabs(task.requestId);
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('dex-poll', { periodInMinutes: 0.05 });
  pollBridge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('dex-poll', { periodInMinutes: 0.05 });
  pollBridge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dex-poll') {
    pollBridge();
  }
});

chrome.action.onClicked.addListener(() => {
  pollBridge();
});
