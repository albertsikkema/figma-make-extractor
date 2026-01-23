# Extracting Data from Figma Make (.make) Files

A comprehensive guide to extracting source code, design tokens, and assets from Figma Make files.

## Quick Start

```bash
cd make_extraction
./run-all.sh ../YourFile.make
cd output/react_app
npm install --legacy-peer-deps
npm run dev
```

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Scripts](#scripts)
4. [Understanding the .make File Structure](#understanding-the-make-file-structure)
5. [Understanding canvas.fig Binary Format](#understanding-canvasfig-binary-format)
6. [Appendix: File Formats Reference](#appendix-file-formats-reference)

---

## Overview

### What is Figma Make?

Figma Make is an AI-powered prototyping tool that generates complete React applications. Unlike traditional Figma Design files (.fig), Make files (.make) contain:

- **Source code** (React/TypeScript components)
- **Design tokens** (colors, fonts, spacing defined in CSS/code)
- **Assets** (images, icons)
- **AI chat history** (the conversation that generated the app)

### Why Can't You Use the Figma API?

The standard Figma REST API returns `{"status":400,"err":"File type not supported by this endpoint"}` for Make files. This is because Make files are code projects, not visual design files.

### What This Guide Covers

This guide documents the reverse-engineering process to extract:
- All React/TypeScript source code
- Design tokens (colors, fonts, spacing, etc.)
- Image assets
- Project structure

---

## Prerequisites

### Required Software

```bash
# Node.js (v18+)
node --version
```

### npm Packages (installed automatically)

| Package | Purpose |
|---------|---------|
| `pako` | Deflate decompression for the schema chunk |
| `fzstd` | Zstandard decompression for the data chunk |
| `kiwi-schema` | Decode Figma's Kiwi binary schema format |

---

## Scripts

The extraction process is handled by numbered scripts in the `make_extraction/` directory:

### Directory Structure

```
make_extraction/
├── run-all.sh         # Master script - runs all steps
├── 01-decode-canvas.js        # Decodes canvas.fig binary to JSON
├── 02-extract-source-code.js  # Extracts CODE_FILE nodes
├── 03-extract-design-tokens.js # Extracts colors, fonts, CSS vars
├── 04-create-react-app.js     # Creates runnable React app
├── cleanup.sh                 # Removes generated files
└── output/                    # Generated output directory
    ├── extracted/             # Unzipped .make contents
    │   ├── canvas.fig
    │   ├── images/
    │   ├── meta.json
    │   └── ...
    ├── decoded-message.json   # Raw decoded canvas data
    ├── source_files/          # Extracted source files
    ├── design-tokens.json     # Extracted design tokens
    └── react_app/             # Ready-to-run React application
```

### Usage

```bash
# Run all steps with a single command (installs dependencies automatically)
./run-all.sh <path-to-make-file>

# Example
./run-all.sh ../source.make

# Clean up generated files
./cleanup.sh
```

### Script Details

#### run-all.sh
Master script that:
1. Installs npm dependencies (pako, fzstd, kiwi-schema)
2. Extracts the .make file (ZIP archive) to `output/extracted/`
3. Runs all Node.js scripts in sequence
4. Outputs a ready-to-run React application

#### 01-decode-canvas.js
- Reads `output/extracted/canvas.fig` binary file
- Skips 12-byte header (`fig-makee` + padding)
- Decompresses Chunk 1 (Deflate) → Kiwi schema
- Decompresses Chunk 2 (Zstandard) → message data
- Decodes using kiwi-schema
- Outputs `output/decoded-message.json`

#### 02-extract-source-code.js
- Reads `decoded-message.json`
- Extracts all `CODE_FILE` nodes with `sourceCode`
- Saves individual files to `output/source_files/`

#### 03-extract-design-tokens.js
- Scans all source files using regex patterns
- Extracts: hex colors, rgba colors, hsl colors, CSS variables, fonts
- Outputs `output/design-tokens.json`

#### 04-create-react-app.js
- Analyzes imports to determine folder structure
- Organizes files into proper React project structure:
  - `src/components/ui/` - shadcn/ui components
  - `src/components/` - custom components
  - `src/hooks/` - React hooks
  - `src/lib/` - utilities
  - `src/data/` - data files
  - `src/styles/` - CSS files
- Fixes import paths (removes version numbers, normalizes paths)
- Converts `figma:asset` imports to static URLs
- Creates `package.json`, `vite.config.ts`, `tsconfig.json`
- Copies images with proper extensions
- Outputs ready-to-run app in `output/react_app/`

---

## Understanding the .make File Structure

A `.make` file is a **ZIP archive**. You can verify this by checking its magic bytes:

```bash
xxd -l 4 "YourFile.make"
# Output: 504b 0304 (PK..) = ZIP signature
```

### Contents of a .make Archive

```
YourFile.make (ZIP)
├── canvas.fig          # Binary file containing source code & design data
├── meta.json           # Project metadata
├── ai_chat.json        # AI conversation history (can be very large)
├── thumbnail.png       # Preview image
├── images/             # Image assets used in the app
│   ├── [hash1]
│   ├── [hash2]
│   └── ...
└── blob_store/         # Additional binary data
```

---

## Understanding canvas.fig Binary Format

The `canvas.fig` file is NOT a standard Figma design file. It has a custom format:

### Header Structure

| Offset | Size | Content |
|--------|------|---------|
| 0 | 9 bytes | Magic: `fig-makee` |
| 9 | 3 bytes | Padding (zeros) |
| 12 | 4 bytes | Chunk 1 size (little-endian uint32) |
| 16 | N bytes | Chunk 1 data (deflate compressed) |
| 16+N | 4 bytes | Chunk 2 size (little-endian uint32) |
| 20+N | M bytes | Chunk 2 data (zstd compressed) |

### Chunk Contents

- **Chunk 1 (Schema)**: Deflate-compressed Kiwi schema definition
- **Chunk 2 (Data)**: Zstandard-compressed message data containing all nodes

### Verify the Header

```bash
xxd -l 20 canvas.fig
# Should show: 6669 672d 6d61 6b65 65 (fig-makee)
```

### Node Types in Decoded Message

| Type | Description |
|------|-------------|
| `DOCUMENT` | Root document node |
| `CANVAS` | Page/canvas |
| `CODE_LIBRARY` | Code library container |
| `CODE_FILE` | Source code file (`.tsx`, `.ts`, `.css`) |
| `CODE_COMPONENT` | Exported React component |
| `CODE_INSTANCE` | Instance of a component |
| `FRAME` | Visual frame (preview) |
| `RESPONSIVE_SET` | Responsive breakpoint container |

---

## Appendix: File Formats Reference

### Kiwi Schema Types Found in Figma Make

The schema typically contains 500+ definitions including:

| Type | Description |
|------|-------------|
| `Message` | Top-level container |
| `NodeChange` | Individual node data |
| `Color` | RGBA color (floats 0-1) |
| `Paint` | Fill/stroke paint |
| `FontName` | Font family reference |
| `TextData` | Text content and styling |
| `Vector` | 2D point |
| `Matrix` | Transform matrix |

### Color Format

Colors are stored as RGBA floats (0.0 to 1.0):

```javascript
{
  "r": 0.11764705926179886,  // = 30/255
  "g": 0.11764705926179886,
  "b": 0.11764705926179886,
  "a": 1
}
```

Convert to hex:
```javascript
function rgbaToHex(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`.toUpperCase();
}
```

### Compression Identification

| Magic Bytes | Compression |
|-------------|-------------|
| `78 9C` or `78 DA` | zlib/deflate |
| `28 B5 2F FD` | Zstandard |

---

## Troubleshooting

### "Invalid stored block lengths" error
The data chunk uses Zstandard compression, not zlib. Use `fzstd` package.

### BigInt serialization error
The scripts use a custom JSON replacer to handle BigInt values.

### Empty source code
Ensure the node has `type === 'CODE_FILE'` and `sourceCode` property exists.

### Import path errors in React app
The `04-create-react-app.js` script automatically:
- Strips version numbers from imports (e.g., `@radix-ui/react-dialog@1.1.6` → `@radix-ui/react-dialog`)
- Converts `figma:asset` imports to static URL constants
- Normalizes relative paths to use `@/` alias

### Tailwind CSS v4 PostCSS error
The generated app uses `@tailwindcss/postcss` package for Tailwind v4 compatibility.

### Animation issues (React StrictMode)
The generated app omits React.StrictMode to avoid timer/animation issues with Framer Motion.

---

## Summary

| Step | Script | Output |
|------|--------|--------|
| 0 | `run-all.sh` | Extracts ZIP, runs all steps |
| 1 | `01-decode-canvas.js` | `output/decoded-message.json` |
| 2 | `02-extract-source-code.js` | `output/source_files/` |
| 3 | `03-extract-design-tokens.js` | `output/design-tokens.json` |
| 4 | `04-create-react-app.js` | `output/react_app/` |

---

<a href="https://www.buymeacoffee.com/albertsikkema" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## License & Disclaimer

This guide documents a reverse-engineering process for educational purposes. The extracted code remains subject to Figma's terms of service and any applicable licenses.

---

*Guide updated: January 2026*
*Tested with: Figma Make files from early 2026*
