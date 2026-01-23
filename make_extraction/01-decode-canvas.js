const fs = require('fs');
const pako = require('pako');
const fzstd = require('fzstd');
const kiwi = require('kiwi-schema');

// Directories
const outputDir = './output';
const extractedDir = `${outputDir}/extracted`;
fs.mkdirSync(outputDir, { recursive: true });

// Read the canvas.fig file from extracted folder
const buffer = fs.readFileSync(`${extractedDir}/canvas.fig`);
const data = new Uint8Array(buffer);
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

// Skip header (12 bytes: "fig-makee" + 3 bytes padding)
let offset = 12;

// Read Chunk 1 (Schema) - Deflate compressed
const chunk1Size = view.getUint32(offset, true);
offset += 4;
const chunk1Data = data.slice(offset, offset + chunk1Size);
offset += chunk1Size;

// Decompress schema using pako (deflate)
const schemaBytes = pako.inflateRaw(chunk1Data);
console.log(`Schema: ${chunk1Size} bytes compressed -> ${schemaBytes.length} bytes`);

// Read Chunk 2 (Data) - Zstandard compressed
const chunk2Size = view.getUint32(offset, true);
offset += 4;
const chunk2Data = data.slice(offset, offset + chunk2Size);

// Decompress data using fzstd (zstandard)
const figmaData = fzstd.decompress(chunk2Data);
console.log(`Data: ${chunk2Size} bytes compressed -> ${figmaData.length} bytes`);

// Decode the Kiwi schema
const schemaObj = kiwi.decodeBinarySchema(schemaBytes);
console.log(`Schema definitions: ${schemaObj.definitions.length}`);

// Compile schema and decode the message
const compiled = kiwi.compileSchema(schemaObj);
const message = compiled.decodeMessage(new Uint8Array(figmaData));

console.log(`Message type: ${message.type}`);
if (message.nodeChanges) {
  console.log(`Node changes: ${message.nodeChanges.length}`);
}

// Save decoded data - handle BigInt serialization
const replacer = (key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

const outputPath = `${outputDir}/decoded-message.json`;
fs.writeFileSync(outputPath, JSON.stringify(message, replacer, 2));
console.log(`\nSaved raw decoded content to ${outputPath}`);
