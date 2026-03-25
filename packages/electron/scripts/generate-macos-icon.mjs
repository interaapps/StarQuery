import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const appIconSetPath = path.join(rootDir, 'images', 'Assets.xcassets', 'AppIcon.appiconset');
const outputIcnsPath = path.join(rootDir, 'images', 'icon.icns');
const outputIcoPath = path.join(rootDir, 'images', 'icon.ico');
const outputPngPath = path.join(rootDir, 'images', 'icon.png');
const outputWindowIconPath = path.join(rootDir, 'images', '128x128.png');

const iconEntries = [
  { type: 'icp4', filename: '16-mac.png', size: 16 },
  { type: 'icp5', filename: '32-mac.png', size: 32 },
  { type: 'icp6', filename: '64-mac.png', size: 64 },
  { type: 'ic07', filename: '128-mac.png', size: 128 },
  { type: 'ic08', filename: '256-mac.png', size: 256 },
  { type: 'ic09', filename: '512-mac.png', size: 512 },
  { type: 'ic10', filename: '1024-mac.png', size: 1024 },
];

function createChunk(type, data) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([header, data]);
}

function createIco(pngEntries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngEntries.length, 4);

  const directoryEntries = [];
  let offset = 6 + pngEntries.length * 16;

  for (const entry of pngEntries) {
    const directory = Buffer.alloc(16);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);
    directory.writeUInt8(0, 2);
    directory.writeUInt8(0, 3);
    directory.writeUInt16LE(1, 4);
    directory.writeUInt16LE(32, 6);
    directory.writeUInt32LE(entry.data.length, 8);
    directory.writeUInt32LE(offset, 12);
    directoryEntries.push(directory);
    offset += entry.data.length;
  }

  return Buffer.concat([header, ...directoryEntries, ...pngEntries.map((entry) => entry.data)]);
}

async function readIconAsset(filename) {
  return fs.readFile(path.join(appIconSetPath, filename));
}

async function main() {
  const chunks = [];
  const icoEntries = [];

  for (const entry of iconEntries) {
    const pngData = await readIconAsset(entry.filename);
    chunks.push(createChunk(entry.type, pngData));
    if ([16, 32, 64, 128, 256].includes(entry.size)) {
      icoEntries.push({ size: entry.size, data: pngData });
    }
  }

  const fileSize = 8 + chunks.reduce((total, chunk) => total + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(fileSize, 4);

  await fs.writeFile(outputIcnsPath, Buffer.concat([header, ...chunks]));
  await fs.writeFile(outputIcoPath, createIco(icoEntries));
  await fs.copyFile(path.join(appIconSetPath, '1024-mac.png'), outputPngPath);
  await fs.copyFile(path.join(appIconSetPath, '128-mac.png'), outputWindowIconPath);
}

await main();
