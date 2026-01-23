#!/bin/bash
# Master script to extract a React app from a Figma Make (.make) file
# Usage: ./run-all.sh <path-to-make-file>

cd "$(dirname "$0")"

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-make-file>"
  echo "Example: $0 ../source.make"
  exit 1
fi

MAKE_FILE="$1"

if [ ! -f "$MAKE_FILE" ]; then
  echo "Error: File not found: $MAKE_FILE"
  exit 1
fi

set -e  # Exit on any error

echo "============================================"
echo "Step 0a: Install dependencies"
echo "============================================"
npm install --silent pako fzstd kiwi-schema

echo ""
echo "============================================"
echo "Step 0b: Extract .make file (ZIP archive)"
echo "============================================"

# Create output directory and clean up previous extraction
mkdir -p output/extracted
rm -rf output/extracted/*

# Extract to output/extracted/
unzip -q "$MAKE_FILE" -d output/extracted/

echo "Extracted contents:"
ls -la output/extracted/

echo ""
echo "============================================"
echo "Step 1: Decode canvas.fig"
echo "============================================"
node 01-decode-canvas.js

echo ""
echo "============================================"
echo "Step 2: Extract source code"
echo "============================================"
node 02-extract-source-code.js

echo ""
echo "============================================"
echo "Step 3: Extract design tokens"
echo "============================================"
node 03-extract-design-tokens.js

echo ""
echo "============================================"
echo "Step 4: Create React app"
echo "============================================"
node 04-create-react-app.js

echo ""
echo "============================================"
echo "All steps complete!"
echo "============================================"
echo ""
echo "To run the app:"
echo "  cd output/react_app"
echo "  npm install --legacy-peer-deps"
echo "  npm run dev"
