import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class DependencyManager {
  private cacheDir: string;
  private resourcesDir: string;

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'node_modules_cache');
    this.resourcesDir = app.isPackaged
      ? path.join(process.resourcesPath, 'node_modules_cache')
      : path.join(__dirname, '../../../resources/node_modules_cache');
  }

  isReady(): boolean {
    const checkDir = fs.existsSync(this.resourcesDir) ? this.resourcesDir : this.cacheDir;
    const nodeModulesPath = path.join(checkDir, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) return false;
    
    // Check if cache has the essentials (e.g., vite and react)
    const vitePath = path.join(nodeModulesPath, 'vite');
    const reactPath = path.join(nodeModulesPath, 'react');
    return fs.existsSync(vitePath) && fs.existsSync(reactPath);
  }

  async initialize(nodePath: string, onProgress: (status: string) => void) {
    if (this.isReady()) return;

    onProgress('Verifying connection...');
    try {
      await new Promise<void>((resolve, reject) => {
        require('dns').lookup('google.com', (err: any) => {
          if (err) resolve(); // Continue even if lookup fails, npm might work anyway
          else resolve();
        });
      });
    } catch (e: any) {}

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    onProgress('Preparing extraction engine...');
    
    const seedPackage = {
      name: "figma-make-cache-seed",
      version: "1.0.0",
      dependencies: {
        "react": "^19.2.4",
        "react-dom": "^19.2.4",
        "vite": "^8.0.3",
        "@vitejs/plugin-react": "^6.0.1",
        "tailwindcss": "^4.2.2",
        "lucide-react": "^1.7.0"
      }
    };
    
    fs.writeFileSync(path.join(this.cacheDir, 'package.json'), JSON.stringify(seedPackage, null, 2));

    onProgress('Downloading React templates (first-time setup)...');
    
    return new Promise<void>((resolve, reject) => {
      const { spawn } = require('child_process');
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      
      const child = spawn(npm, ['install', '--no-package-lock'], {
        cwd: this.cacheDir,
        shell: true,
        env: { ...process.env, NO_UPDATE_NOTIFIER: '1' }
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          onProgress('Engine ready!');
          resolve();
        } else {
          reject(new Error(`Failed to initialize engine (Exit code ${code}). Try running 'npm install' manually in ${this.cacheDir}`));
        }
      });
    });
  }

  async ensureDependencies(targetDir: string) {
    const targetNodeModules = path.join(targetDir, 'node_modules');
    
    // Choose source: priority is bundled resources, then local userData cache
    let sourceNodeModules = '';
    if (fs.existsSync(path.join(this.resourcesDir, 'node_modules'))) {
      sourceNodeModules = path.join(this.resourcesDir, 'node_modules');
    } else if (fs.existsSync(path.join(this.cacheDir, 'node_modules'))) {
      sourceNodeModules = path.join(this.cacheDir, 'node_modules');
    }

    if (sourceNodeModules) {
      console.log(`Linking dependencies from ${sourceNodeModules}...`);
      this.linkRecursive(sourceNodeModules, targetNodeModules);
      return;
    }

    throw new Error('Core dependencies not found. Please ensure you have an internet connection for the first-run setup.');
  }

  private linkRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.resolve(src, item);
      const destPath = path.resolve(dest, item);
      
      if (fs.existsSync(destPath)) continue; // Already exists, skip

      if (fs.lstatSync(srcPath).isDirectory()) {
        if (process.platform === 'win32') {
          try {
            // Using junctions (/J) to avoid admin privilege requirements
            require('child_process').execSync(`mklink /J "${destPath}" "${srcPath}"`);
          } catch (e: any) {
            this.copyRecursive(srcPath, destPath);
          }
        } else {
          try {
            fs.symlinkSync(srcPath, destPath, 'dir');
          } catch (e: any) {
            this.copyRecursive(srcPath, destPath);
          }
        }
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private copyRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      if (fs.lstatSync(srcPath).isDirectory()) {
        this.copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
