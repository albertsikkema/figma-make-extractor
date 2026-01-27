# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Figma Make Extractor is a set of Node.js scripts that reverse-engineer `.make` files (from Figma Make, an AI-powered prototyping tool) to extract React/TypeScript source code, design tokens, and assets. The Figma API does not support `.make` files, making this extraction necessary.

## Key Commands

```bash
# Extract everything from a .make file and create a runnable React app
cd make_extraction
./run-all.sh ../YourFile.make

# Run the extracted React app
cd output/react_app
npm install --legacy-peer-deps
npm run dev

# Clean up all generated output
./cleanup.sh
```

## Architecture

### Pipeline Overview

The extraction is a 4-step pipeline executed by `run-all.sh`:

1. **01-decode-canvas.js** - Parses the binary `canvas.fig` file:
   - Skips 12-byte header (`fig-makee` + padding)
   - Decompresses Chunk 1 (Deflate) → Kiwi schema
   - Decompresses Chunk 2 (Zstandard) → message data
   - Outputs `decoded-message.json`

2. **02-extract-source-code.js** - Extracts `CODE_FILE` nodes with `sourceCode` property from the decoded message

3. **03-extract-design-tokens.js** - Regex-based extraction of colors, CSS variables, and fonts

4. **04-create-react-app.js** - Transforms extracted files into a working React app:
   - Categorizes files into components/ui, hooks, lib, data, styles
   - Fixes import paths (removes version numbers, normalizes to `@/` alias)
   - Converts `figma:asset` imports to static URL paths
   - Generates Vite + Tailwind v4 config files

### File Format Details

- `.make` files are ZIP archives containing `canvas.fig`, `meta.json`, `ai_chat.json`, and image assets
- `canvas.fig` uses a custom binary format with Kiwi schema (not standard Figma design files)
- Node types in the decoded data: `DOCUMENT`, `CANVAS`, `CODE_LIBRARY`, `CODE_FILE`, `CODE_COMPONENT`, `CODE_INSTANCE`, `FRAME`, `RESPONSIVE_SET`

### Dependencies

- `pako` - Deflate decompression
- `fzstd` - Zstandard decompression
- `kiwi-schema` - Figma's binary schema decoder

## Output Structure

```
output/
├── extracted/          # Raw unzipped .make contents
├── decoded-message.json
├── source_files/       # Individual extracted source files
├── design-tokens.json
└── react_app/          # Ready-to-run Vite + React + Tailwind v4 app
```
