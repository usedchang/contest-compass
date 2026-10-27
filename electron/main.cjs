const { app, BrowserWindow, protocol, net, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { writeFile } = require('node:fs/promises');
const os = require('node:os');

protocol.registerSchemesAsPrivileged([{ scheme: 'compass', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

app.whenReady().then(() => {
  ipcMain.handle('statement:save-png', async (_event, filename, dataUrl) => {
    if (typeof filename !== 'string' || filename !== path.basename(filename) || !filename.endsWith('.png')) throw new Error('无效的文件名');
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 30_000_000) throw new Error('无效的 PNG 图片');
    const bytes = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG 图片内容无效');
    const target = process.env.COMPASS_HEADLESS_TEST === '1'
      ? path.join(os.tmpdir(), filename)
      : (await dialog.showSaveDialog({ defaultPath: filename, filters: [{ name: 'PNG 图片', extensions: ['png'] }] })).filePath;
    if (!target) return { saved: false };
    await writeFile(target, bytes);
    return { saved: true, path: target };
  });
  ipcMain.handle('statement:fetch', async (_event, id) => {
    if (!/^(?:CF\d+[A-Z][A-Z0-9]*|AT_[A-Za-z0-9_]+)$/.test(id || '')) throw new Error('无效的题号');
    const response = await fetch(`https://www.luogu.com.cn/problem/${id}?_contentOnly=1`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`镜像站返回 HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000 || !html.includes('lentille-context')) throw new Error('镜像站没有返回题面数据');
    return html;
  });
  protocol.handle('compass', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const root = path.resolve(__dirname, '../dist');
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
  const win = new BrowserWindow({ width: 1400, height: 920, minWidth: 960, minHeight: 680, show: process.env.COMPASS_HEADLESS_TEST !== '1', backgroundColor: '#f7f5f1', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
  win.loadURL('compass://local/');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
