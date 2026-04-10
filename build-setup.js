const { createWindowsInstaller } = require('electron-winstaller');
const path = require('path');

async function buildInstaller() {
  console.log('📦 Starting installer packaging process...');
  const rootPath = path.join(__dirname);
  
  try {
    await createWindowsInstaller({
      appDirectory: path.join(rootPath, 'build_out', 'Figma Make Extractor-win32-x64'),
      outputDirectory: path.join(rootPath, 'releases'),
      authors: 'Abhishek Saini',
      exe: 'Figma Make Extractor.exe',
      setupExe: 'Figma-Make-Extractor-Setup.exe',
      noMsi: true,
      setupRun: 'Figma Make Extractor.exe'
    });
    console.log('✅ Success! Installer created at Figma-Make-Extractor-Setup.exe');
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
    process.exit(1);
  }
}

buildInstaller();
