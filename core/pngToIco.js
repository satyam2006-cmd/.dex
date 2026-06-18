import fs from 'fs';
import path from 'path';

/**
 * Packages a raw PNG buffer into a single-image Windows ICO format buffer.
 * @param {Buffer} pngBuffer - Raw PNG image data
 * @returns {Buffer} ICO formatted data
 */
export function pngToIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (always 0)
  header.writeUInt16LE(1, 2); // Resource Type (1 = Icon)
  header.writeUInt16LE(1, 4); // Number of Images (1)

  const dir = Buffer.alloc(16);
  dir.writeUInt8(0, 0);       // Width (0 means 256px)
  dir.writeUInt8(0, 1);       // Height (0 means 256px)
  dir.writeUInt8(0, 2);       // Color palette count (0 if no palette)
  dir.writeUInt8(0, 3);       // Reserved (always 0)
  dir.writeUInt16LE(1, 4);    // Color planes (1)
  dir.writeUInt16LE(32, 6);   // Bits per pixel (32)
  dir.writeUInt32LE(pngBuffer.length, 8); // Size of image data
  dir.writeUInt32LE(22, 12);  // Offset to image data (header 6 bytes + directory 16 bytes = 22)

  return Buffer.concat([header, dir, pngBuffer]);
}
