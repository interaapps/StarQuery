import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(rootDir, 'images', 'icon-iOS-Default-1024x1024@1x.png');
const outputIcnsPath = path.join(rootDir, 'images', 'icon.icns');
const outputIcoPath = path.join(rootDir, 'images', 'icon.ico');
const outputPngPath = path.join(rootDir, 'images', 'icon.png');
const outputWindowIconPath = path.join(rootDir, 'images', '128x128.png');

const iconEntries = [
  { type: 'icp4', size: 16 },
  { type: 'icp5', size: 32 },
  { type: 'icp6', size: 64 },
  { type: 'ic07', size: 128 },
  { type: 'ic08', size: 256 },
  { type: 'ic09', size: 512 },
  { type: 'ic10', size: 1024 },
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

async function generatePng(source, size, outputPath) {
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', outputPath], {
    stdio: 'ignore',
  });
  return fs.readFile(outputPath);
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'starquery-icon-'));

  try {
    const chunks = [];
    const icoEntries = [];

    for (const entry of iconEntries) {
      const tempOutputPath = path.join(tempDir, `${entry.type}.png`);
      const pngData = await generatePng(sourcePath, entry.size, tempOutputPath);
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
    await generatePng(sourcePath, 512, outputPngPath);
    await generatePng(sourcePath, 256, outputWindowIconPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

await main();
