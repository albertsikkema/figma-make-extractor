const fs = require('fs');
const path = require('path');

// Input/output directories
const outputDir = './output';
const sourceFilesDir = `${outputDir}/source_files`;

// Read the decoded message
const message = require(`${outputDir}/decoded-message.json`);

// Create output directory
fs.mkdirSync(sourceFilesDir, { recursive: true });

// Extract CODE_FILE nodes
const codeFiles = [];

for (const node of message.nodeChanges) {
  if (node.type === 'CODE_FILE' && node.sourceCode !== undefined) {
    codeFiles.push({
      name: node.name,
      code: node.sourceCode
    });
  }
}

console.log(`Found ${codeFiles.length} code files:\n`);

// Save each file
for (const file of codeFiles) {
  const filePath = path.join(sourceFilesDir, file.name);
  fs.writeFileSync(filePath, file.code);
  console.log(`  ${file.name} (${file.code.length} bytes)`);
}

console.log(`\nSaved to ${sourceFilesDir}/`);
