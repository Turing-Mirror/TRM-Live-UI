// 最小的 zip 读写，用于 UI 包的导入导出。只用 Node 自带的 zlib，不引入依赖。
//
// 支持：存储（method 0）与 deflate（method 8），UTF-8 文件名。
// 不支持：zip64、加密、分卷。遇到时报错，不猜。
import zlib from 'node:zlib';
import { AppError } from './errors.js';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const SIG = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 };
const UTF8_FLAG = 0x0800;

/** files: [{ name, data: Buffer }] → zip Buffer */
export function createZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG.local, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(SIG.central, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralSize = centrals.reduce((sum, buf) => sum + buf.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG.end, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * zip Buffer → [{ name, data }]。目录项会被略过。
 * limits.entries 与 limits.bytes 防止“解压炸弹”。
 */
export function readZip(buffer, limits = { entries: 2000, bytes: 300 * 1024 * 1024 }) {
  const invalid = () => new AppError('zip.invalid');
  let endAt = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i -= 1) {
    if (buffer.readUInt32LE(i) === SIG.end) {
      endAt = i;
      break;
    }
  }
  if (endAt < 0) throw invalid();
  const count = buffer.readUInt16LE(endAt + 10);
  let pos = buffer.readUInt32LE(endAt + 16);
  if (count === 0xffff || pos === 0xffffffff) throw new AppError('zip.unsupported');
  if (count > limits.entries) throw new AppError('zip.tooLarge');

  const files = [];
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== SIG.central) throw invalid();
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const crc = buffer.readUInt32LE(pos + 16);
    const compressed = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localAt = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString(flags & UTF8_FLAG ? 'utf8' : 'latin1', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x1) throw new AppError('zip.unsupported');
    if (name.endsWith('/')) continue;
    total += size;
    if (total > limits.bytes) throw new AppError('zip.tooLarge');

    if (localAt + 30 > buffer.length || buffer.readUInt32LE(localAt) !== SIG.local) throw invalid();
    const dataAt = localAt + 30 + buffer.readUInt16LE(localAt + 26) + buffer.readUInt16LE(localAt + 28);
    const raw = buffer.subarray(dataAt, dataAt + compressed);
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(size, 1) });
    else throw new AppError('zip.unsupported');
    if (data.length !== size || crc32(data) !== crc) throw invalid();
    files.push({ name, data });
  }
  return files;
}
