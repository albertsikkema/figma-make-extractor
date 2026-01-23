const fs = require('fs');
const path = require('path');

// Input/output directories
const outputDir = './output';
const sourceDir = `${outputDir}/source_files`;
const reactAppDir = `${outputDir}/react_app`;

// Read all source files and analyze imports
const files = fs.readdirSync(sourceDir);
const fileContents = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(sourceDir, file), 'utf-8');
  fileContents[file] = content;
}

console.log('Analyzing imports to determine folder structure...\n');

// Create directory structure
const dirs = [
  reactAppDir,
  `${reactAppDir}/src`,
  `${reactAppDir}/src/components`,
  `${reactAppDir}/src/components/ui`,
  `${reactAppDir}/src/hooks`,
  `${reactAppDir}/src/lib`,
  `${reactAppDir}/src/data`,
  `${reactAppDir}/src/styles`,
  `${reactAppDir}/public`,
  `${reactAppDir}/public/images`,
];

dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// Determine file destinations based on analysis
function getDestination(fileName) {
  // UI components (shadcn)
  const knownUI = [
    'accordion.tsx', 'alert-dialog.tsx', 'alert.tsx', 'aspect-ratio.tsx', 'avatar.tsx',
    'badge.tsx', 'breadcrumb.tsx', 'button.tsx', 'calendar.tsx', 'card.tsx', 'carousel.tsx',
    'chart.tsx', 'checkbox.tsx', 'collapsible.tsx', 'command.tsx', 'context-menu.tsx',
    'dialog.tsx', 'drawer.tsx', 'dropdown-menu.tsx', 'form.tsx', 'hover-card.tsx',
    'input-otp.tsx', 'input.tsx', 'label.tsx', 'menubar.tsx', 'navigation-menu.tsx',
    'pagination.tsx', 'popover.tsx', 'progress.tsx', 'radio-group.tsx', 'resizable.tsx',
    'scroll-area.tsx', 'select.tsx', 'separator.tsx', 'sheet.tsx', 'sidebar.tsx',
    'skeleton.tsx', 'slider.tsx', 'sonner.tsx', 'switch.tsx', 'table.tsx', 'tabs.tsx',
    'textarea.tsx', 'toggle-group.tsx', 'toggle.tsx', 'tooltip.tsx'
  ];

  if (knownUI.includes(fileName)) {
    return `${reactAppDir}/src/components/ui/${fileName}`;
  }

  // Hooks
  if (fileName.startsWith('use') && fileName.endsWith('.ts')) {
    return `${reactAppDir}/src/hooks/${fileName}`;
  }

  // Lib/utils
  if (fileName === 'utils.ts') {
    return `${reactAppDir}/src/lib/${fileName}`;
  }

  // Data files
  if (fileName.endsWith('.ts') && !fileName.endsWith('.tsx') &&
      (fileName.includes('prayers') || fileName.includes('sacred') ||
       fileName.includes('calendar') || fileName.includes('epistle') ||
       fileName.includes('gospel') || fileName.includes('psalms'))) {
    return `${reactAppDir}/src/data/${fileName}`;
  }

  // CSS
  if (fileName === 'globals.css') {
    return `${reactAppDir}/src/styles/${fileName}`;
  }

  // Main app files
  if (fileName === 'App.tsx') {
    return `${reactAppDir}/src/${fileName}`;
  }

  // Markdown docs
  if (fileName.endsWith('.md')) {
    return `${reactAppDir}/${fileName}`;
  }

  // Everything else goes to components
  if (fileName.endsWith('.tsx') || fileName.endsWith('.ts')) {
    return `${reactAppDir}/src/components/${fileName}`;
  }

  return `${reactAppDir}/src/${fileName}`;
}

// Fix import paths in file content
function fixImports(content, fileName) {
  let fixed = content;

  // Remove version numbers from imports (e.g., @radix-ui/react-dialog@1.1.6 -> @radix-ui/react-dialog)
  fixed = fixed.replace(/@([\d.]+)(['"])/g, '$2');

  // Convert figma:asset imports to const URL strings
  // Change: import imageName from 'figma:asset/hash.png';
  // To: const imageName = '/images/hash.png';
  fixed = fixed.replace(
    /import\s+(\w+)\s+from\s+['"]figma:asset\/([^'"]+)['"]/g,
    "const $1 = '/images/$2'"
  );

  // Fix UI component imports (both single and double quotes)
  // ./utils -> @/lib/utils
  fixed = fixed.replace(/from\s+['"]\.\/utils['"]/g, 'from "@/lib/utils"');
  // ./use-mobile -> @/hooks/use-mobile
  fixed = fixed.replace(/from\s+['"]\.\/use-mobile['"]/g, 'from "@/hooks/use-mobile"');

  // Fix relative imports in components
  // ../ui/* -> @/components/ui/*
  fixed = fixed.replace(/from\s+['"]\.\.\/ui\/([^'"]+)['"]/g, 'from "@/components/ui/$1"');
  // ../data/* -> @/data/*
  fixed = fixed.replace(/from\s+['"]\.\.\/data\/([^'"]+)['"]/g, 'from "@/data/$1"');
  // ../../data/* -> @/data/*
  fixed = fixed.replace(/from\s+['"]\.\.\/\.\.\/data\/([^'"]+)['"]/g, 'from "@/data/$1"');
  // ../utils/liturgical-calendar -> @/data/liturgical-calendar
  fixed = fixed.replace(/from\s+['"]\.\.\/utils\/liturgical-calendar['"]/g, 'from "@/data/liturgical-calendar"');
  // ../figma/ImageWithFallback -> @/components/ImageWithFallback
  fixed = fixed.replace(/from\s+['"]\.\.\/figma\/ImageWithFallback['"]/g, 'from "@/components/ImageWithFallback"');
  // ./figma/ImageWithFallback -> @/components/ImageWithFallback
  fixed = fixed.replace(/from\s+['"]\.\/figma\/ImageWithFallback['"]/g, 'from "@/components/ImageWithFallback"');
  // ../MainApp -> @/components/MainApp
  fixed = fixed.replace(/from\s+['"]\.\.\/MainApp['"]/g, 'from "@/components/MainApp"');
  // ../hooks/* -> @/hooks/*
  fixed = fixed.replace(/from\s+['"]\.\.\/hooks\/([^'"]+)['"]/g, 'from "@/hooks/$1"');
  // ../MaryIcon, ../LineArtImage, ../SacredTimePlayer etc -> @/components/*
  fixed = fixed.replace(/from\s+['"]\.\.\/(\w+)['"]/g, 'from "@/components/$1"');
  // ./tabs/* -> @/components/* (for MainApp.tsx)
  fixed = fixed.replace(/from\s+['"]\.\/tabs\/([^'"]+)['"]/g, 'from "@/components/$1"');

  return fixed;
}

// Process and copy files
console.log('Organizing files...\n');

for (const file of files) {
  let content = fileContents[file];
  const dest = getDestination(file);

  // Fix imports
  content = fixImports(content, file);

  fs.writeFileSync(dest, content);
  console.log(`  ${file} -> ${dest.replace(reactAppDir + '/', '')}`);
}

// Extract all npm dependencies from imports
const npmDeps = new Set();

for (const content of Object.values(fileContents)) {
  const importRegex = /from\s+['"]([^'"@./][^'"]*)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let pkg = match[1];
    // Get package name (handle scoped packages)
    if (pkg.startsWith('@')) {
      pkg = pkg.split('/').slice(0, 2).join('/');
    } else {
      pkg = pkg.split('/')[0];
    }
    // Remove version numbers
    pkg = pkg.replace(/@[\d.]+$/, '');
    // Skip figma:asset (invalid package)
    if (!pkg.startsWith('figma:')) {
      npmDeps.add(pkg);
    }
  }
}

console.log('\nDetected npm dependencies:', [...npmDeps].sort().join(', '));

// Create package.json with all required dependencies
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
    // Core React
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    // Radix UI components
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-aspect-ratio": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-collapsible": "^1.1.0",
    "@radix-ui/react-context-menu": "^2.2.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-hover-card": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-menubar": "^1.1.0",
    "@radix-ui/react-navigation-menu": "^1.2.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slider": "^1.2.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toggle": "^1.1.0",
    "@radix-ui/react-toggle-group": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    // UI utilities
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.300.0",
    // Animation
    "motion": "^11.0.0",
    // Form handling
    "react-hook-form": "^7.50.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    // UI components
    "cmdk": "^0.2.0",
    "embla-carousel-react": "^8.0.0",
    "input-otp": "^1.2.0",
    "react-day-picker": "^8.10.0",
    "date-fns": "^3.3.0",
    "react-resizable-panels": "^2.0.0",
    "recharts": "^2.12.0",
    "sonner": "^1.4.0",
    "vaul": "^0.9.0",
    // Theme
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

fs.writeFileSync(`${reactAppDir}/package.json`, JSON.stringify(packageJson, null, 2));
console.log('\nCreated package.json');

// Create vite.config.ts
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
fs.writeFileSync(`${reactAppDir}/vite.config.ts`, viteConfig);
console.log('Created vite.config.ts');

// Create tsconfig.json (relaxed for Figma code compatibility)
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
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    noFallthroughCasesInSwitch: false,
    baseUrl: ".",
    paths: {
      "@/*": ["./src/*"]
    }
  },
  include: ["src"],
  references: [{ path: "./tsconfig.node.json" }]
};
fs.writeFileSync(`${reactAppDir}/tsconfig.json`, JSON.stringify(tsconfig, null, 2));
console.log('Created tsconfig.json');

// Create tsconfig.node.json
const tsconfigNode = {
  compilerOptions: {
    composite: true,
    skipLibCheck: true,
    module: "ESNext",
    moduleResolution: "bundler",
    allowSyntheticDefaultImports: true
  },
  include: ["vite.config.ts"]
};
fs.writeFileSync(`${reactAppDir}/tsconfig.node.json`, JSON.stringify(tsconfigNode, null, 2));
console.log('Created tsconfig.node.json');

// Create index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Figma Make App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
fs.writeFileSync(`${reactAppDir}/index.html`, indexHtml);
console.log('Created index.html');

// Create main.tsx entry point (without StrictMode to avoid timer issues)
const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
`;
fs.writeFileSync(`${reactAppDir}/src/main.tsx`, mainTsx);
console.log('Created src/main.tsx');

// Create postcss.config.js (Tailwind v4 compatible)
const postcssConfig = `export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
`;
fs.writeFileSync(`${reactAppDir}/postcss.config.js`, postcssConfig);
console.log('Created postcss.config.js');

// Create vite-env.d.ts for image imports
const viteEnvDts = `/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
`;
fs.writeFileSync(`${reactAppDir}/src/vite-env.d.ts`, viteEnvDts);
console.log('Created src/vite-env.d.ts');

// Copy images (add .png extension if missing)
const imagesDir = './output/extracted/images';
if (fs.existsSync(imagesDir)) {
  const images = fs.readdirSync(imagesDir);
  for (const img of images) {
    const srcPath = `${imagesDir}/${img}`;
    // Add .png extension if not present
    const destName = img.endsWith('.png') ? img : `${img}.png`;
    const destPath = `${reactAppDir}/public/images/${destName}`;
    fs.copyFileSync(srcPath, destPath);
  }
  console.log(`\nCopied ${images.length} images to public/images/ (with .png extension)`);
}

console.log(`\n✓ React app created in ${reactAppDir}/`);
console.log('\nTo run:');
console.log(`  cd ${reactAppDir}`);
console.log('  npm install --legacy-peer-deps');
console.log('  npm run dev');
