import React, { useState, useEffect } from 'react';
import { Download, Play, Rocket, Settings, FolderOpen, Terminal as TerminalIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mocked electronAPI for TypeScript (provided via preload)
declare global {
  interface Window {
    electronAPI: {
      selectFile: () => Promise<string | null>;
      startExtraction: (path: string) => Promise<any>;
      launchApp: (appDir: string) => Promise<any>;
      onProgress: (callback: (data: any) => void) => void;
      onAppReady: (callback: (url: string) => void) => void;
      checkEngineStatus: () => Promise<boolean>;
      initializeEngine: () => Promise<{ success: boolean; error?: string }>;
      closeWindow: () => void;
      minimizeWindow: () => void;
    };
  }
}

export default function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready for extraction');
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [engineReady, setEngineReady] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Safely get electronAPI
  const electronAPI = (window as any).electronAPI || { 
    selectFile: () => Promise.reject('Electron not found'),
    startExtraction: () => Promise.reject('Electron not found'),
    onProgress: () => () => {},
    onAppReady: () => () => {},
    launchApp: () => Promise.reject('Electron not found'),
    checkEngineStatus: () => Promise.resolve(true),
    initializeEngine: () => Promise.resolve({ success: true }),
    closeWindow: () => {},
    minimizeWindow: () => {}
  };

  useEffect(() => {
    if (!(window as any).electronAPI) {
      console.warn('electronAPI not found. UI running in web mode?');
      return;
    }
    
    electronAPI.onProgress((data: any) => {
      setProgress(data.progress);
      setStatus(data.status);
      setLogs(prev => [...prev.slice(-10), data.status]);
    });

    electronAPI.onAppReady((url: string) => {
      setAppUrl(url);
      setStatus('Prototype is live!');
    });

    // Check engine status
    electronAPI.checkEngineStatus().then((ready: boolean) => {
      setEngineReady(ready);
    });
  }, []);

  const handleInitEngine = async () => {
    setInitializing(true);
    setSetupError(null);
    setStatus('Initializing extraction engine...');
    const result = await electronAPI.initializeEngine();
    if (result.success) {
      setEngineReady(true);
    } else {
      setSetupError(result.error || 'Unknown initialization error');
      setStatus(`Setup Error: ${result.error}`);
    }
    setInitializing(false);
  };

  const handleSelectFile = async () => {
    const path = await window.electronAPI.selectFile();
    if (path) setFilePath(path);
  };

  const handleExtract = async () => {
    if (!filePath) return;
    setExtracting(true);
    setAppUrl(null);
    setProgress(0);
    setLogs(['Initializing extraction pipeline...']);

    const result = await window.electronAPI.startExtraction(filePath);
    if (result.success) {
      setOutputDir(result.reactAppDir);
      // Auto-launch after extraction! One-Click!
      setStatus('Starting development server...');
      await window.electronAPI.launchApp(result.reactAppDir);
    } else {
      setStatus(`Error: ${result.error}`);
      setExtracting(false);
    }
  };

  const handleReset = () => {
    setFilePath(null);
    setExtracting(false);
    setProgress(0);
    setStatus('Ready for extraction');
    setOutputDir(null);
    setAppUrl(null);
    setLogs([]);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-ui-bg select-none">
      {/* Draggable Header */}
      <header className="h-10 w-full flex items-center justify-between px-4 bg-white/[0.02] border-b border-white/[0.05] z-50" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-brand-primary" />
          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Make Extractor</span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={() => electronAPI.minimizeWindow()}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-white/5 transition-colors"
          >
            <div className="w-3 h-[1px] bg-current" />
          </button>
          <button 
            onClick={() => electronAPI.closeWindow()}
            className="w-12 h-10 flex items-center justify-center text-slate-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {engineReady === false && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-ui-bg flex items-center justify-center p-8"
          >
            <div className="max-w-md w-full space-y-8 text-center">
              <div className="p-4 bg-brand-primary/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-brand-primary">
                <Settings size={40} className={initializing ? 'animate-spin' : ''} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">First-Run Optimization</h2>
                <p className="text-slate-400 text-sm">To ensure instant extractions, we're preparing our React engine on your system. This only happens once.</p>
                {setupError && (
                  <div className="flex items-center gap-2 justify-center text-red-400 text-xs mt-2 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                    <AlertCircle size={14} />
                    <span>{setupError}</span>
                  </div>
                )}
              </div>
              
              {!initializing ? (
                <button
                  onClick={handleInitEngine}
                  className="w-full bg-brand-primary py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  {setupError ? 'Retry Optimization' : 'Start Optimization (One-Click)'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 60 }} className="h-full bg-brand-primary" />
                  </div>
                  <p className="text-xs font-mono text-slate-500">{status}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-8 flex flex-col gap-8 max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
            One-Click Proto-Link
          </h1>
          <p className="text-slate-400">Extract complete React applications from Figma .make files instantly.</p>
        </div>

        {/* Dropzone Area */}
        <div 
          onClick={handleSelectFile}
          className={`
            group relative h-48 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer
            border-2 border-dashed transition-all duration-500
            ${filePath ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-white/10 hover:border-white/20 bg-white/[0.02]'}
          `}
        >
          <div className={`p-4 rounded-full transition-all duration-500 ${filePath ? 'bg-brand-primary/20 text-brand-primary' : 'bg-white/5 text-slate-500'}`}>
            <Download size={32} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">{filePath ? filePath.split(/[/\\]/).pop() : 'Drop your .make file here'}</p>
            <p className="text-sm text-slate-500">{filePath ? 'Ready to launch' : 'or click to browse local files'}</p>
          </div>

          {outputDir && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute -bottom-4 bg-ui-bg border border-white/10 px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-[10px] text-slate-400 font-mono"
            >
              <FolderOpen size={12} className="text-brand-primary" />
              <span>Saved to: ...{outputDir.slice(-40)}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); window.electronAPI.launchApp(outputDir); }}
                className="ml-2 text-brand-primary hover:text-white transition-colors underline"
              >
                Reveal
              </button>
            </motion.div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExtract}
            disabled={!filePath || extracting}
            className={`
              flex-1 h-16 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all
              ${!filePath ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-brand-primary hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]'}
            `}
          >
            {extracting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Settings size={24} /></motion.div> : <Rocket size={24} />}
            {appUrl ? 'Relaunch App' : 'Extract & Open'}
          </button>
          
          {appUrl && (
            <button
              onClick={handleReset}
              className="px-6 h-16 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 font-bold transition-all flex items-center gap-2"
            >
              <AlertCircle size={20} />
              New
            </button>
          )}
        </div>

        {/* Status Dashboard */}
        <AnimatePresence>
          {extracting && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass rounded-2xl p-6 space-y-4"
            >
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2 text-slate-300">
                  {progress === 100 ? <CheckCircle2 size={16} className="text-brand-accent" /> : <TerminalIcon size={16} />}
                  <span className="text-sm font-medium">{status}</span>
                </div>
                <span className="text-xs font-mono text-slate-500">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${progress}%` }} 
                  className="h-full bg-gradient-to-r from-brand-primary to-blue-400"
                />
              </div>
              
              {/* Log Viewer */}
              <div className="h-24 bg-black/20 rounded-lg p-3 font-mono text-[10px] text-slate-500 overflow-hidden flex flex-col gap-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-brand-primary opacity-50">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>

              {appUrl && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 pt-2">
                  <div className="flex-1 p-3 bg-brand-accent/10 border border-brand-accent/20 rounded-lg flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-brand-accent" />
                    <span className="text-sm text-brand-accent font-semibold underline cursor-pointer" onClick={() => window.open(appUrl)}>
                      {appUrl}
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-4 text-center">
        <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">Zero Configuration Pipeline • Cross-Platform Engine • v1.0.0</p>
      </footer>
    </div>
  );
}
