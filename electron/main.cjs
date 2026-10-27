const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'compass', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

app.whenReady().then(() => {
  protocol.handle('compass', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const root = path.resolve(__dirname, '../dist');
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
  const win = new BrowserWindow({ width: 1400, height: 920, minWidth: 960, minHeight: 680, show: process.env.COMPASS_HEADLESS_TEST !== '1', backgroundColor: '#f7f5f1', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.loadURL('compass://local/');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
