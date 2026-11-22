const { app, BrowserWindow, Menu, session, shell, screen } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, 'web');
const APP_ORIGIN = 'app.slati.free';
const APP_PORT = 47823;
const ALLOWED_PERMISSIONS = new Set(['geolocation', 'notifications', 'fullscreen']);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let server = null;
let mainWindow = null;

function indexPath() {
  return path.join(WEB_ROOT, 'index.html');
}

function resolveRequestFile(requestUrl) {
  try {
    const pathname = decodeURIComponent((requestUrl || '/').split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    const candidate = path.resolve(WEB_ROOT, relative);
    const fromRoot = path.relative(WEB_ROOT, candidate);

    if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return indexPath();
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    if (!path.extname(relative)) return indexPath();
    return null;
  } catch (error) {
    return indexPath();
  }
}

function sendFile(request, response, filePath) {
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
    'Content-Type': contentType,
  };

  if (request.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (match) {
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : stats.size - 1;
      if (!match[1] && match[2]) {
        start = Math.max(0, stats.size - Number(match[2]));
        end = stats.size - 1;
      }
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && end < stats.size) {
        headers['Content-Length'] = end - start + 1;
        headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`;
        response.writeHead(206, headers);
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        fs.createReadStream(filePath, { start, end }).pipe(response);
        return;
      }
    }
  }

  headers['Content-Length'] = stats.size;
  response.writeHead(200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }

    const filePath = resolveRequestFile(request.url);
    if (!filePath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    sendFile(request, response, filePath);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const nextServer = createServer();
    nextServer.once('error', reject);
    nextServer.listen(APP_PORT, '127.0.0.1', () => resolve(nextServer));
  });
}

function configurePermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  );
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
}

async function createWindow() {
  if (!server) server = await startServer();
  const baseUrl = `http://127.0.0.1:${APP_PORT}`;
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(460, Math.max(380, workArea.width - 40));
  const height = Math.min(900, Math.max(640, workArea.height - 40));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 380,
    minHeight: 640,
    show: false,
    title: 'Slati Pro',
    backgroundColor: '#0d1b2a',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(baseUrl)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`${baseUrl}/`);

  if (process.env.SLATI_CAPTURE) {
    const target = path.resolve(process.env.SLATI_CAPTURE);
    setTimeout(async () => {
      try {
        const image = await mainWindow.webContents.capturePage();
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, image.toPNG());
      } catch (error) {
        console.error(error);
      } finally {
        app.quit();
      }
    }, 8000);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ORIGIN);
    Menu.setApplicationMenu(null);
    configurePermissions();
    try {
      await createWindow();
    } catch (error) {
      console.error(error);
      app.quit();
    }
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
