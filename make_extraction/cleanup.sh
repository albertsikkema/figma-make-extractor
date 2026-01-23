#!/bin/bash
# Cleanup script - removes all generated output

cd "$(dirname "$0")"

echo "Removing output directory..."
rm -rf output

echo ""
echo "Cleanup complete. Run:"
echo "  ./run-all.sh <path-to-make-file>"
