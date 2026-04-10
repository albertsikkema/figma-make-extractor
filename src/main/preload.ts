import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  startExtraction: (filePath: string) => ipcRenderer.invoke('start-extraction', filePath),
  launchApp: (appDir: string) => ipcRenderer.invoke('launch-app', appDir),
  checkEngineStatus: () => ipcRenderer.invoke('check-engine-status'),
  initializeEngine: () => ipcRenderer.invoke('initialize-engine'),
  onProgress: (callback: (data: { progress: number; status: string }) => void) => {
    const subscription = (event: any, data: any) => callback(data);
    ipcRenderer.on('extraction-progress', subscription);
    return () => ipcRenderer.removeListener('extraction-progress', subscription);
  },
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  onAppReady: (callback: (url: string) => void) => {
    const subscription = (event: any, url: any) => callback(url);
    ipcRenderer.on('app-ready', subscription);
    return () => ipcRenderer.removeListener('app-ready', subscription);
  }
});
