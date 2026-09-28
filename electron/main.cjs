const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const MODEL_DIR = path.join(app.getPath('userData'), 'ai-models');
const RUNTIME_DIR = path.join(app.getPath('userData'), 'ai-runtime');
let worker = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#111214',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function hasNativePlugin() {
  const executable = process.platform === 'win32' ? 'cutout-worker.exe' : 'cutout-worker';
  return fs.existsSync(path.join(RUNTIME_DIR, executable)) &&
    fs.existsSync(path.join(MODEL_DIR, 'rvm_mobilenetv3_fp16.onnx'));
}

ipcMain.handle('cutout:status', () => ({
  platform: process.platform,
  installed: hasNativePlugin(),
  modelDirectory: MODEL_DIR,
  runtimeDirectory: RUNTIME_DIR,
}));

ipcMain.handle('cutout:choose-install', async () => {
  const result = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Install native Cutout', 'Use browser mode'],
    defaultId: 0,
    cancelId: 1,
    title: 'Install native AI Cutout',
    message: 'Native Windows Cutout is not installed',
    detail: 'The native plugin improves video matte quality and export consistency. It requires an additional model download and works best with a GPU.',
  });
  return result.response === 0;
});

// The downloader is intentionally a separate signed installer step. The IPC
// contract is ready now; the UI can use browser MediaPipe until the installer
// places cutout-worker.exe and the model in these directories.
ipcMain.handle('cutout:install-paths', () => ({ MODEL_DIR, RUNTIME_DIR }));

ipcMain.handle('cutout:start', async (_event, request) => {
  if (!hasNativePlugin()) throw new Error('Native Cutout plugin is not installed');
  if (worker) return { started: true };
  const exe = path.join(RUNTIME_DIR, 'cutout-worker.exe');
  worker = spawn(exe, [], { cwd: RUNTIME_DIR, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  worker.on('exit', () => { worker = null; });
  worker.stdout.on('data', (data) => {
    // Worker protocol is newline-delimited JSON. Forwarding is added when the
    // signed worker package is installed.
    try { JSON.parse(data.toString()); } catch (_) {}
  });
  worker.stdin.write(JSON.stringify({ type: 'configure', ...request }) + '\n');
  return { started: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (worker) worker.kill(); });
