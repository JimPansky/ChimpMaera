// Bounded parsers and deterministic encoders for the synthetic PNG/WAV
// fixtures. PNG generation uses a specified zlib wrapper around stored
// DEFLATE blocks; decoding accepts that exact subset and never allocates from
// an attacker-controlled decompressed length.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_PNG_BYTES = 4_000_000;
const MAX_WAV_BYTES = 1_000_000;
const MAX_CHUNK_BYTES = 3_000_000;
const MAX_DIMENSION = 2_048;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function adler32(buffer) {
  let a = 1;
  let b = 0;
  for (const byte of buffer) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function pngChunk(type, data) {
  if (!/^[A-Za-z]{4}$/.test(type) || data.length > MAX_CHUNK_BYTES) throw new Error("PNG chunk denied");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function storedZlib(raw) {
  const pieces = [Buffer.from([0x78, 0x01])];
  for (let offset = 0; offset < raw.length;) {
    const size = Math.min(65_535, raw.length - offset);
    const final = offset + size === raw.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 1 : 0;
    header.writeUInt16LE(size, 1);
    header.writeUInt16LE((~size) & 0xffff, 3);
    pieces.push(header, raw.subarray(offset, offset + size));
    offset += size;
  }
  if (raw.length === 0) pieces.push(Buffer.from([1, 0, 0, 0xff, 0xff]));
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(raw));
  pieces.push(checksum);
  return Buffer.concat(pieces);
}

function inflateStoredZlib(compressed, expectedLength) {
  if (compressed.length < 11 || compressed[0] !== 0x78 || compressed[1] !== 0x01) {
    throw new Error("PNG zlib header denied");
  }
  const expectedAdler = compressed.readUInt32BE(compressed.length - 4);
  const chunks = [];
  let total = 0;
  let offset = 2;
  let final = false;
  while (!final) {
    if (offset + 5 > compressed.length - 4) throw new Error("PNG DEFLATE block truncated");
    const header = compressed[offset];
    if ((header & 0xfe) !== 0) throw new Error("PNG DEFLATE must use byte-aligned stored blocks");
    final = (header & 1) === 1;
    const size = compressed.readUInt16LE(offset + 1);
    const inverse = compressed.readUInt16LE(offset + 3);
    if (((~size) & 0xffff) !== inverse) throw new Error("PNG DEFLATE length complement denied");
    offset += 5;
    if (offset + size > compressed.length - 4) throw new Error("PNG DEFLATE data truncated");
    total += size;
    if (total > expectedLength) throw new Error("PNG decompression ceiling denied");
    chunks.push(compressed.subarray(offset, offset + size));
    offset += size;
  }
  if (offset !== compressed.length - 4 || total !== expectedLength) throw new Error("PNG decompressed length denied");
  const raw = Buffer.concat(chunks, total);
  if (adler32(raw) !== expectedAdler) throw new Error("PNG Adler-32 denied");
  return raw;
}

export function writePng({ width, height, rgb }) {
  if (!Number.isInteger(width) || width <= 0 || width > MAX_DIMENSION
    || !Number.isInteger(height) || height <= 0 || height > MAX_DIMENSION) throw new Error("PNG dimensions denied");
  if (!Buffer.isBuffer(rgb) || rgb.length !== width * height * 3) throw new Error("PNG RGB length denied");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let row = 0; row < height; row += 1) rgb.copy(raw, row * (rowBytes + 1) + 1, row * rowBytes, (row + 1) * rowBytes);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", storedZlib(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_PNG_BYTES || buffer.length < 57
    || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG signature or size denied");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error("PNG chunk truncated");
    const length = buffer.readUInt32BE(offset);
    if (length > MAX_CHUNK_BYTES || offset + 12 + length > buffer.length) throw new Error("PNG chunk boundary denied");
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("PNG chunk type denied");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (crc32(Buffer.concat([typeBytes, data])) !== buffer.readUInt32BE(offset + 8 + length)) throw new Error("PNG CRC denied");
    chunks.push({ type, data });
    offset += 12 + length;
  }
  if (offset !== buffer.length || chunks.length !== 3
    || chunks[0].type !== "IHDR" || chunks[1].type !== "IDAT" || chunks[2].type !== "IEND"
    || chunks[0].data.length !== 13 || chunks[2].data.length !== 0) {
    throw new Error("PNG critical chunk structure denied");
  }
  const ihdr = chunks[0].data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  if (width <= 0 || width > MAX_DIMENSION || height <= 0 || height > MAX_DIMENSION
    || ihdr[8] !== 8 || ihdr[9] !== 2 || ihdr[10] !== 0 || ihdr[11] !== 0 || ihdr[12] !== 0) {
    throw new Error("PNG IHDR format denied");
  }
  return { width, height, bitDepth: 8, colorType: 2, compressed: chunks[1].data };
}

export function readPngInfo(buffer) {
  const { width, height, bitDepth, colorType } = parsePng(buffer);
  return { width, height, bitDepth, colorType };
}

export function decodePng(buffer) {
  const parsed = parsePng(buffer);
  const rowBytes = parsed.width * 3;
  const raw = inflateStoredZlib(parsed.compressed, (rowBytes + 1) * parsed.height);
  const rgb = Buffer.alloc(rowBytes * parsed.height);
  for (let row = 0; row < parsed.height; row += 1) {
    const start = row * (rowBytes + 1);
    if (raw[start] !== 0) throw new Error("PNG filter denied");
    raw.copy(rgb, row * rowBytes, start + 1, start + 1 + rowBytes);
  }
  return { width: parsed.width, height: parsed.height, rgb };
}

export function writeWav({ sampleRate, samples }) {
  if (sampleRate !== 48_000 || !(samples instanceof Int16Array) || samples.length > 480_000) throw new Error("WAV generation parameters denied");
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) buffer.writeInt16LE(samples[index], 44 + index * 2);
  return buffer;
}

function parseWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.length > MAX_WAV_BYTES
    || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("WAV RIFF header or size denied");
  }
  if (buffer.readUInt32LE(4) !== buffer.length - 8) throw new Error("WAV RIFF size denied");
  if (buffer.toString("ascii", 12, 16) !== "fmt " || buffer.readUInt32LE(16) !== 16
    || buffer.readUInt16LE(20) !== 1 || buffer.readUInt16LE(22) !== 1
    || buffer.readUInt32LE(24) !== 48_000 || buffer.readUInt32LE(28) !== 96_000
    || buffer.readUInt16LE(32) !== 2 || buffer.readUInt16LE(34) !== 16) {
    throw new Error("WAV fmt contract denied");
  }
  if (buffer.toString("ascii", 36, 40) !== "data") throw new Error("WAV data ordering denied");
  const dataBytes = buffer.readUInt32LE(40);
  if (dataBytes % 2 !== 0 || 44 + dataBytes !== buffer.length) throw new Error("WAV data boundary or padding denied");
  return { sampleRate: 48_000, channels: 1, bitsPerSample: 16, blockAlign: 2, byteRate: 96_000, dataBytes, sampleCount: dataBytes / 2 };
}

export function readWavInfo(buffer) {
  const info = parseWav(buffer);
  return { ...info, durationSeconds: info.sampleCount / info.sampleRate };
}

export function readWavData(buffer) {
  return parseWav(buffer);
}
