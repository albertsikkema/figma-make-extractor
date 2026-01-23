const fs = require('fs');
const path = require('path');

// Input/output directories
const outputDir = './output';
const sourceDir = `${outputDir}/source_files`;

// Read all source files
const files = fs.readdirSync(sourceDir);
let allContent = '';

for (const file of files) {
  const content = fs.readFileSync(path.join(sourceDir, file), 'utf-8');
  allContent += content + '\n';
}

// Extract hex colors
const hexColors = new Set();
const hexRegex = /#([0-9A-Fa-f]{3,8})\b/g;
let match;
while ((match = hexRegex.exec(allContent)) !== null) {
  hexColors.add('#' + match[1]);
}

// Extract rgba/rgb colors
const rgbaColors = new Set();
const rgbaRegex = /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/gi;
while ((match = rgbaRegex.exec(allContent)) !== null) {
  rgbaColors.add(match[0]);
}

// Extract hsl/hsla colors
const hslColors = new Set();
const hslRegex = /hsla?\s*\([^)]+\)/gi;
while ((match = hslRegex.exec(allContent)) !== null) {
  hslColors.add(match[0]);
}

// Extract CSS variables definitions
const cssVariables = {};
const cssVarRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
while ((match = cssVarRegex.exec(allContent)) !== null) {
  cssVariables[`--${match[1]}`] = match[2].trim();
}

// Extract font imports
const fonts = new Set();
const fontImportRegex = /fonts\.googleapis\.com\/css2\?family=([^&'")\s]+)/g;
while ((match = fontImportRegex.exec(allContent)) !== null) {
  fonts.add(decodeURIComponent(match[1]).replace(/\+/g, ' '));
}

// Extract font-family declarations
const fontFamilies = new Set();
const fontFamilyRegex = /font-family:\s*([^;]+);/gi;
while ((match = fontFamilyRegex.exec(allContent)) !== null) {
  fontFamilies.add(match[1].trim());
}

// Compile design tokens
const designTokens = {
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

const outputPath = `${outputDir}/design-tokens.json`;
fs.writeFileSync(outputPath, JSON.stringify(designTokens, null, 2));

console.log('Design tokens extracted:\n');
console.log(`Hex colors: ${hexColors.size}`);
console.log(`RGBA colors: ${rgbaColors.size}`);
console.log(`HSL colors: ${hslColors.size}`);
console.log(`CSS variables: ${Object.keys(cssVariables).length}`);
console.log(`Google Fonts: ${fonts.size}`);
console.log(`Font families: ${fontFamilies.size}`);
console.log(`\nSaved to ${outputPath}`);
