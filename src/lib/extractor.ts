import fs from 'fs';
import path from 'path';
import pako from 'pako';
import * as fzstd from 'fzstd';
import * as kiwi from 'kiwi-schema';
import AdmZip from 'adm-zip';
import { DependencyManager } from './dependency-manager';

export interface DesignTokens {
  colors: {
    hex: string[];
    rgba: string[];
    hsl: string[];
  };
  cssVariables: Record<string, string>;
  fonts: {
    googleFonts: string[];
    fontFamilies: string[];
  };
}

export interface ExtractorOptions {
  onProgress?: (progress: number, status: string) => void;
  outputDir: string;
}

export class FigmaMakeExtractor {
  private outputDir: string;
  private extractedDir: string;
  private sourceFilesDir: string;
  private reactAppDir: string;
  private onProgress?: (progress: number, status: string) => void;
  private dependencyManager: DependencyManager;

  constructor(options: ExtractorOptions) {
    this.outputDir = options.outputDir;
    this.extractedDir = path.join(this.outputDir, 'extracted');
    this.sourceFilesDir = path.join(this.outputDir, 'source_files');
    this.reactAppDir = path.join(this.outputDir, 'react_app');
    this.onProgress = options.onProgress;
    this.dependencyManager = new DependencyManager();
  }

  private progress(value: number, status: string) {
    this.onProgress?.(value, status);
  }

  async extractEverything(makeFilePath: string) {
    try {
      // Step 0: Extract ZIP
      this.progress(10, 'Unzipping .make file...');
      this.unzipMake(makeFilePath);

      // Step 1: Decode canvas.fig
      this.progress(30, 'Decoding binary canvas...');
      const decodedMessage = this.decodeCanvas();

      // Step 2: Extract Source
      this.progress(50, 'Extracting source code...');
      const sourceFiles = this.extractSourceCode(decodedMessage);

      // Step 3: Extract Tokens
      this.progress(70, 'Analyzing design tokens...');
      const tokens = this.extractDesignTokens(sourceFiles);

      // Step 4: Scaffold React App
      this.progress(85, 'Scaffolding React project...');
      await this.scaffoldReactApp(sourceFiles, tokens);

      // Step 5: Instant Setup (One-Click Dependencies)
      this.progress(95, 'Resolving dependencies (Instant Setup)...');
      await this.dependencyManager.ensureDependencies(this.reactAppDir);

      this.progress(100, 'Extraction complete!');
      return {
        success: true,
        reactAppDir: this.reactAppDir,
        tokens
      };
    } catch (error: any) {
      console.error('Extraction failed:', error);
      throw error;
    }
  }

  private unzipMake(makeFilePath: string) {
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(this.extractedDir)) fs.rmSync(this.extractedDir, { recursive: true, force: true });
    
    const zip = new AdmZip(makeFilePath);
    zip.extractAllTo(this.extractedDir, true);
  }

  private decodeCanvas() {
    const canvasPath = path.join(this.extractedDir, 'canvas.fig');
    const buffer = fs.readFileSync(canvasPath);
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Skip header (12 bytes)
    let offset = 12;

    // Chunk 1 (Schema)
    const chunk1Size = view.getUint32(offset, true);
    offset += 4;
    const chunk1Data = data.slice(offset, offset + chunk1Size);
    offset += chunk1Size;
    const schemaBytes = pako.inflateRaw(chunk1Data);

    // Chunk 2 (Data)
    const chunk2Size = view.getUint32(offset, true);
    offset += 4;
    const chunk2Data = data.slice(offset, offset + chunk2Size);
    const figmaData = fzstd.decompress(chunk2Data);

    // Decode Kiwi
    const schemaObj = (kiwi as any).decodeBinarySchema(schemaBytes);
    const compiled = (kiwi as any).compileSchema(schemaObj);
    return compiled.decodeMessage(new Uint8Array(figmaData));
  }

  private extractSourceCode(message: any) {
    if (!fs.existsSync(this.sourceFilesDir)) fs.mkdirSync(this.sourceFilesDir, { recursive: true });
    
    const files: Record<string, string> = {};
    for (const node of message.nodeChanges || []) {
      if (node.type === 'CODE_FILE' && node.sourceCode !== undefined) {
        files[node.name] = node.sourceCode;
        fs.writeFileSync(path.join(this.sourceFilesDir, node.name), node.sourceCode);
      }
    }
    return files;
  }

  private extractDesignTokens(sourceFiles: Record<string, string>): DesignTokens {
    let allContent = Object.values(sourceFiles).join('\n');
    
    const hexColors = new Set<string>();
    const hexRegex = /#([0-9A-Fa-f]{3,8})\b/g;
    let match: any;
    while ((match = hexRegex.exec(allContent)) !== null) hexColors.add('#' + match[1]);

    const rgbaColors = new Set<string>();
    const rgbaRegex = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi;
    while ((match = rgbaRegex.exec(allContent)) !== null) rgbaColors.add(match[0]);

    const hslColors = new Set<string>();
    const hslRegex = /hsla?\s*\([^)]+\)/gi;
    while ((match = hslRegex.exec(allContent)) !== null) hslColors.add(match[0]);

    const cssVariables: Record<string, string> = {};
    const cssVarRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
    while ((match = cssVarRegex.exec(allContent)) !== null) cssVariables[`--${match[1]}`] = match[2].trim();

    const fonts = new Set<string>();
    const fontImportRegex = /fonts\.googleapis\.com\/css2\?family=([^&'")\s]+)/g;
    while ((match = fontImportRegex.exec(allContent)) !== null) {
      fonts.add(decodeURIComponent(match[1]).replace(/\+/g, ' '));
    }

    const fontFamilies = new Set<string>();
    const fontFamilyRegex = /font-family:\s*([^;]+);/gi;
    while ((match = fontFamilyRegex.exec(allContent)) !== null) fontFamilies.add(match[1].trim());

    const tokens = {
      colors: {
        hex: [...hexColors].sort(),
        rgba: [...rgbaColors].sort(),
        hsl: [...hslColors].sort()
      },
      cssVariables,
      fonts: {
        googleFonts: [...fonts].sort(),
        fontFamilies: [...fontFamilies].sort()
      }
    };

    fs.writeFileSync(path.join(this.outputDir, 'design-tokens.json'), JSON.stringify(tokens, null, 2));
    return tokens;
  }

  private async scaffoldReactApp(sourceFiles: Record<string, string>, tokens: DesignTokens) {
    const dirs = [
      this.reactAppDir,
      `${this.reactAppDir}/src`,
      `${this.reactAppDir}/src/components`,
      `${this.reactAppDir}/src/components/ui`,
      `${this.reactAppDir}/src/hooks`,
      `${this.reactAppDir}/src/lib`,
      `${this.reactAppDir}/src/data`,
      `${this.reactAppDir}/src/styles`,
      `${this.reactAppDir}/public`,
      `${this.reactAppDir}/public/images`,
    ];

    dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

    const getDest = (name: string) => {
      const knownUI = ['accordion.tsx', 'alert-dialog.tsx', 'badge.tsx', 'button.tsx', 'card.tsx', 'dialog.tsx', 'dropdown-menu.tsx', 'input.tsx', 'label.tsx', 'popover.tsx', 'select.tsx', 'separator.tsx', 'sheet.tsx', 'tabs.tsx', 'textarea.tsx', 'tooltip.tsx'];
      if (knownUI.includes(name)) return `${this.reactAppDir}/src/components/ui/${name}`;
      if (name.startsWith('use') && name.endsWith('.ts')) return `${this.reactAppDir}/src/hooks/${name}`;
      if (name === 'utils.ts') return `${this.reactAppDir}/src/lib/${name}`;
      if (name === 'globals.css') return `${this.reactAppDir}/src/styles/${name}`;
      if (name === 'App.tsx') return `${this.reactAppDir}/src/${name}`;
      if (name.endsWith('.tsx') || name.endsWith('.ts')) return `${this.reactAppDir}/src/components/${name}`;
      return `${this.reactAppDir}/${name}`;
    };

    const fixImports = (c: string) => {
       return c.replace(/@([\d.]+)(['"])/g, '$2')
               .replace(/import\s+(\w+)\s+from\s+['"]figma:asset\/([^'"]+)['"]/g, "const $1 = '/images/$2'")
               .replace(/from\s+['"]\.\/utils['"]/g, 'from "@/lib/utils"')
               .replace(/from\s+['"]\.\/use-mobile['"]/g, 'from "@/hooks/use-mobile"')
               .replace(/from\s+['"]\.\.\/ui\/([^'"]+)['"]/g, 'from "@/components/ui/$1"')
               .replace(/from\s+['"]\.\.\/hooks\/([^'"]+)['"]/g, 'from "@/hooks/$1"')
               .replace(/from\s+['"]\.\.\/data\/([^'"]+)['"]/g, 'from "@/data/$1"');
    };

    for (const [name, code] of Object.entries(sourceFiles)) {
      const dest = getDest(name);
      fs.writeFileSync(dest, fixImports(code));
    }

    const imagesDir = path.join(this.extractedDir, 'images');
    if (fs.existsSync(imagesDir)) {
      const images = fs.readdirSync(imagesDir);
      for (const img of images) {
        const destName = img.endsWith('.png') ? img : `${img}.png`;
        fs.copyFileSync(path.join(imagesDir, img), path.join(this.reactAppDir, 'public/images', destName));
      }
    }

    this.createConfigFiles();
  }

  private createConfigFiles() {
    const packageJson = {
      name: "figma-make-extracted-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "@radix-ui/react-accordion": "^1.2.0",
        "@radix-ui/react-checkbox": "^1.1.0",
        "@radix-ui/react-dialog": "^1.1.0",
        "@radix-ui/react-dropdown-menu": "^2.1.0",
        "@radix-ui/react-label": "^2.1.0",
        "@radix-ui/react-popover": "^1.1.0",
        "@radix-ui/react-select": "^2.1.0",
        "@radix-ui/react-separator": "^1.1.0",
        "@radix-ui/react-sheet": "^1.1.0",
        "@radix-ui/react-tabs": "^1.1.0",
        "@radix-ui/react-tooltip": "^1.1.0",
        "class-variance-authority": "^0.7.0",
        "clsx": "^2.1.0",
        "tailwind-merge": "^2.2.0",
        "lucide-react": "^0.300.0",
        "motion": "^11.0.0",
        "next-themes": "^0.2.0"
      },
      devDependencies: {
        "@types/node": "^20.11.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        "@tailwindcss/postcss": "^4.0.0",
        "autoprefixer": "^10.4.0",
        "postcss": "^8.4.0",
        "tailwindcss": "^4.0.0",
        "typescript": "^5.3.0",
        "vite": "^5.0.0"
      }
    };

    fs.writeFileSync(path.join(this.reactAppDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`;
    fs.writeFileSync(path.join(this.reactAppDir, 'vite.config.ts'), viteConfig);

    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: false,
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] }
      },
      include: ["src"]
    };
    fs.writeFileSync(path.join(this.reactAppDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    const postcssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
`;
    fs.writeFileSync(path.join(this.reactAppDir, 'postcss.config.js'), postcssConfig);

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Figma Make App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
    fs.writeFileSync(path.join(this.reactAppDir, 'index.html'), indexHtml);

    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
`;
    fs.writeFileSync(path.join(this.reactAppDir, 'src/main.tsx'), mainTsx);
  }
}
