# Figma Make Extractor - Progress & Handoff

This document summarizes the development progress, architecture, and current status of the Figma Make Extractor project to ensure a smooth transition to a new session.

## 1. Project Overview
A desktop application designed to extract contents from Figma `.make` files.
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (Shadcn UI).
- **Backend**: Electron (TypeScript).
- **Core Logic**: Custom `.make` file parser handles Zstd decompression, Kiwi schema decoding, and asset extraction.

## 2. Completed Architecture
- **Dependency Management**: Automatically detects if `node_modules` are present in the extraction target. If missing, it uses a pre-bundled set of dependencies to allow for one-click startup of extracted projects.
- **IPC Communication**:
  - `start-extraction`: Main process handles the heavy lifting of parsing and writing files.
  - `initialize-engine`: Ensures the environment is ready for running extracted apps.
  - `launch-app`: Automates the startup of the extracted project's dev server.

## 3. Key Fixes & Improvements

### A. The "Black Screen" Bug
- **Issue**: Production builds couldn't find `index.html` because of relative path changes once installed.
- **Fix**: Implemented robust pathing in `src/main/main.ts` using `app.getAppPath()` and `process.resourcesPath`.
- **Status**: **RESOLVED**.

### B. App Searchability & Shortcuts
- **Issue**: Portable builds were hard to find; users wanted to search via the Windows Key.
- **Fix**: Integrated `electron-squirrel-startup`. This module handles Windows shell events to create Start Menu and Desktop shortcuts during installation.
- **Status**: **RESOLVED**.

### C. UI & Aesthetics
- **Branding**: Implemented a minimalist 'F' logo as per user request.
- **DevTools**: Configured the application to start with the console **closed** by default (can be opened with `Ctrl+Shift+I`).
- **Status**: **RESOLVED**.

### D. Uninstaller
- **Issue**: Users wanted a standard way to remove the app.
- **Fix**: Added `author` metadata to `package.json` for professional display in Windows Settings. Integrated Squirrel's native uninstaller which populates the "Apps & Features" menu.
- **Status**: **RESOLVED** (Pending final build test).

## 4. Current Status & Handoff

### A. Windows Installer (NSIS)
- **Status**: **RESOLVED**.
- **Change**: Switched to NSIS. Resolved binary download issues by manually caching `nsis` and `winCodeSign` dependencies. Added `ELECTRON_BUILDER_OFFLINE=true` to the build script.
- **Output**: `dist/build/Figma Make Extractor Setup 1.0.0.exe`.

### B. macOS Support
- **Status**: **SETUP COMPLETE (Ready for Build)**.
- **Changes**: 
  - Updated `electron-builder.json` to include `mac` (DMG) target.
  - Added `build:mac` script to `package.json`.
  - Updated `src/main/main.ts` (`getNodePath`) to be platform-aware for bundled `node` binaries.
- **Action Required**: The app needs to be built on a macOS machine. It requires a Mac-native `node` binary placed in `resources/mac/node`.

## 5. Files to Review (Next Session)
- `src/main/main.ts`: Check `getNodePath()` for macOS pathing logic.
- `electron-builder.json`: macOS and DMG configuration sections.
- `package.json`: `build:mac` script.

## 6. How to Build (Next Session)

### On Windows
Run `npm run build:nsis`.

### On macOS
1.  Download a native macOS `node` binary.
2.  Place it at `resources/mac/node`.
3.  Run `npm run build:mac`.

---

**Note to Next Agent**: The Windows build is fully functional. The current goal is to produce the macOS version. All configuration is done, but it must be executed on a Mac.
