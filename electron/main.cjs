const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');

const MODEL_DIR = path.join(app.getPath('userData'), 'ai-models');
const RUNTIME_DIR = path.join(app.getPath('userData'), 'ai-runtime');
const COMPANION_PORT = 48123;

let worker = null;
let companionServer = null;

function ensureDirectoriesAndModels() {
  try {
    if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });
    if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });

    const targetModel = path.join(MODEL_DIR, 'rvm_mobilenetv3_fp16.onnx');
    if (!fs.existsSync(targetModel)) {
      const candidates = [
        path.join(__dirname, '..', 'dist', 'models', 'rvm_mobilenetv3_fp16.onnx'),
        path.join(__dirname, '..', 'public', 'models', 'rvm_mobilenetv3_fp16.onnx'),
        path.join(process.resourcesPath || '', 'app.asar', 'dist', 'models', 'rvm_mobilenetv3_fp16.onnx'),
        path.join(process.resourcesPath || '', 'dist', 'models', 'rvm_mobilenetv3_fp16.onnx'),
        path.join(process.resourcesPath || '', 'models', 'rvm_mobilenetv3_fp16.onnx'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          fs.copyFileSync(cand, targetModel);
          console.log(`[electron] Copied RVM model from ${cand} to ${targetModel}`);
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[electron] Note initializing models directory:', err.message);
  }
}

function hasModelInstalled() {
  const inUserData = fs.existsSync(path.join(MODEL_DIR, 'rvm_mobilenetv3_fp16.onnx'));
  const inDist = fs.existsSync(path.join(__dirname, '..', 'dist', 'models', 'rvm_mobilenetv3_fp16.onnx'));
  const inPublic = fs.existsSync(path.join(__dirname, '..', 'public', 'models', 'rvm_mobilenetv3_fp16.onnx'));
  return inUserData || inDist || inPublic;
}

function startCompanionServer() {
  if (companionServer) return;
  try {
    companionServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/status' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ready',
          desktopAvailable: true,
          installed: true,
          modelReady: hasModelInstalled(),
          platform: process.platform,
          version: '1.0.0',
          port: COMPANION_PORT,
        }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    companionServer.on('error', (err) => {
      console.warn('[electron] Companion server port notice:', err.message);
    });

    companionServer.listen(COMPANION_PORT, '127.0.0.1', () => {
      console.log(`[electron] Desktop AI Cutout Companion running at http://127.0.0.1:${COMPANION_PORT}`);
    });
  } catch (err) {
    console.warn('[electron] Could not start companion server:', err);
  }
}

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

ipcMain.handle('cutout:status', () => ({
  platform: process.platform,
  installed: hasModelInstalled(),
  modelDirectory: MODEL_DIR,
  runtimeDirectory: RUNTIME_DIR,
}));

ipcMain.handle('cutout:choose-install', async () => {
  const result = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Use Desktop Native Cutout', 'Use Browser Mode'],
    defaultId: 0,
    cancelId: 1,
    title: 'AI Background Cutout Mode',
    message: 'Desktop AI Cutout is Available',
    detail: 'Desktop Mode accelerates neural matting with local system performance. Choose an option to proceed.',
  });
  return result.response === 0;
});

ipcMain.handle('cutout:install-paths', () => ({ MODEL_DIR, RUNTIME_DIR }));

ipcMain.handle('cutout:start', async (_event, request) => {
  if (worker) return { started: true };
  const exe = path.join(RUNTIME_DIR, 'cutout-worker.exe');
  if (fs.existsSync(exe)) {
    worker = spawn(exe, [], { cwd: RUNTIME_DIR, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    worker.on('exit', () => { worker = null; });
    worker.stdout.on('data', (data) => {
      try { JSON.parse(data.toString()); } catch (_) {}
    });
    worker.stdin.write(JSON.stringify({ type: 'configure', ...request }) + '\n');
  }
  return { started: true };
});

app.whenReady().then(() => {
  ensureDirectoriesAndModels();
  startCompanionServer();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (worker) worker.kill();
  if (companionServer) companionServer.close();
});
