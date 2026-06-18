import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 17654;

function extensionPath() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '..', 'extension', 'dex-capture');
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

export function getCaptureExtensionPath() {
  return extensionPath();
}

export function requestBrowserTabs(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let completed = false;
    let taskDelivered = false;

    const server = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        sendJson(res, 200, {});
        return;
      }

      if (req.method === 'GET' && req.url === '/task') {
        if (completed || taskDelivered) {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'content-type',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
          });
          res.end();
          return;
        }
        taskDelivered = true;
        sendJson(res, 200, { type: 'capture', requestId });
        return;
      }

      if (req.method === 'POST' && req.url === '/tabs') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            if (payload.requestId !== requestId) {
              sendJson(res, 409, { ok: false });
              return;
            }

            completed = true;
            clearTimeout(timer);
            sendJson(res, 200, { ok: true });
            server.close();
            resolve(Array.isArray(payload.tabs) ? payload.tabs : []);
          } catch (err) {
            sendJson(res, 400, { ok: false, error: err.message });
          }
        });
        return;
      }

      sendJson(res, 404, { ok: false });
    });

    const timer = setTimeout(() => {
      if (completed) return;
      completed = true;
      server.close();
      reject(new Error(`No .dex Capture Bridge response. Load the extension from: ${extensionPath()}`));
    }, timeoutMs);

    server.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    server.listen(PORT, '127.0.0.1');
  });
}

export function checkCaptureExtension(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let seen = false;

    const server = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        sendJson(res, 200, {});
        return;
      }

      if (req.method === 'GET' && req.url === '/task') {
        seen = true;
        clearTimeout(timer);
        sendJson(res, 200, { type: 'idle' });
        server.close();
        resolve(true);
        return;
      }

      sendJson(res, 404, { ok: false });
    });

    const timer = setTimeout(() => {
      if (seen) return;
      server.close();
      reject(new Error(`No extension polling detected. Load the extension from: ${extensionPath()}`));
    }, timeoutMs);

    server.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    server.listen(PORT, '127.0.0.1');
  });
}
