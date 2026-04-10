import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { platform } from 'os';
import fs from 'fs';
import { FigmaMakeExtractor } from '../lib/extractor';
import { DependencyManager } from '../lib/dependency-manager';

const dependencyManager = new DependencyManager();

let mainWindow: any = null;
let devServer: any = null;

app.setName('Make Extractor');

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Loading preload script from:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Make Extractor',
    frame: false, // Custom title bar
    transparent: true,
    backgroundColor: '#09090b', // Matches shadcn slate-950
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false // Sometimes needed for local dev with complex structures
    },
  });

  // Ensure window shows correctly
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Production pathing fix
    const indexPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'app/dist/renderer/index.html')
      : path.join(__dirname, '../../renderer/index.html');
      
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }
}

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

app.whenReady().then(createWindow);

// IPC Handlers
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Figma Make', extensions: ['make'] }],
    properties: ['openFile']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('start-extraction', async (event, makeFilePath: string) => {
  // Default output to the same directory as the .make file
  const baseDir = path.dirname(makeFilePath);
  const projectName = path.basename(makeFilePath, '.make');
  const outputDir = path.join(baseDir, projectName + '_extracted');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const extractor = new FigmaMakeExtractor({
    outputDir,
    onProgress: (progress, status) => {
      mainWindow?.webContents.send('extraction-progress', { progress, status });
    }
  });

  try {
    const result = await (extractor as any).extractEverything(makeFilePath);
    if (result.success) {
      // Auto-open folder on completion
      shell.openPath(outputDir);
    }
    return result;
  } catch (error: any) {
    console.error('Extraction handler failed:', error);
    return { success: false, error: error.message };
  }
});

function getNodePath(): string {
  const isWin = platform() === 'win32';
  const platformFolder = isWin ? 'win' : 'mac';
  const nodeBinaryName = isWin ? 'node.exe' : 'node';
  
  const bundledNodePath = app.isPackaged
    ? path.join(process.resourcesPath, platformFolder, nodeBinaryName)
    : path.join(__dirname, '../../../resources', platformFolder, nodeBinaryName);

  if (fs.existsSync(bundledNodePath) && fs.lstatSync(bundledNodePath).isFile()) {
    return bundledNodePath;
  }
  return 'node'; // Fallback to system node
}

ipcMain.handle('launch-app', async (event, appDir: string) => {
  if (devServer) {
    devServer.kill();
  }

  const nodePath = getNodePath();
  const viteBinPath = path.join(appDir, 'node_modules/vite/bin/vite.js');

  if (!fs.existsSync(viteBinPath)) {
    return { success: false, error: 'Vite not found in project node_modules' };
  }

  // Start Vite dev server - One Click start!
  devServer = spawn(nodePath, [viteBinPath], {
    cwd: appDir,
    env: { ...process.env, BROWSER: 'none' }
  });

  devServer.stdout?.on('data', (data: any) => {
    const output = data.toString();
    console.log(`Vite: ${output}`);
    
    // Auto-open browser when "Local:" URL appears
    const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
    if (match) {
      shell.openExternal(match[1]);
      mainWindow?.webContents.send('app-ready', match[1]);
    }
  });

  devServer.on('error', (err: any) => {
    console.error('Failed to start dev server:', err);
    mainWindow?.webContents.send('extraction-progress', { progress: 0, status: `Server Error: ${err.message}` });
  });

  return { success: true };
});

ipcMain.handle('check-engine-status', async () => {
  return dependencyManager.isReady();
});

ipcMain.handle('initialize-engine', async (event) => {
  const nodePath = getNodePath();

  try {
    await dependencyManager.initialize(nodePath, (status) => {
      mainWindow?.webContents.send('extraction-progress', { progress: 0, status });
    });
    return { success: true };
  } catch (error: any) {
    console.error('Engine initialization failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reveal-folder', async (event, folderPath: string) => {
  if (fs.existsSync(folderPath)) {
    shell.openPath(folderPath);
    return { success: true };
  }
  return { success: false, error: 'Folder not found' };
});

app.on('window-all-closed', () => {
  if (devServer) devServer.kill();
  if (process.platform !== 'darwin') app.quit();
});
