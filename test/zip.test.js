import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZip, readZip, crc32 } from '../server/zip.js';
import { normalizeEntries } from '../server/packio.js';

const file = (name, text) => ({ name, data: Buffer.from(text) });
const names = (files) => files.map((f) => f.name).sort();

test('CRC32 与标准值一致', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('打包再解开，内容不变', () => {
  const files = [file('pack.json', '{"id":"a"}'), file('fonts/中文.otf', 'x'.repeat(5000)), file('empty.txt', '')];
  const back = readZip(createZip(files));
  assert.deepEqual(names(back), names(files));
  for (const original of files) {
    assert.ok(back.find((f) => f.name === original.name).data.equals(original.data));
  }
});

test('损坏的 zip 会被拒绝', () => {
  const zip = createZip([file('pack.json', 'hello world hello world')]);
  zip[40] ^= 0xff;
  assert.throws(() => readZip(zip), { code: 'zip.invalid' });
  assert.throws(() => readZip(Buffer.from('not a zip')), { code: 'zip.invalid' });
});

test('超过数量限制会被拒绝', () => {
  const zip = createZip([file('a', '1'), file('b', '2'), file('c', '3')]);
  assert.throws(() => readZip(zip, { entries: 2, bytes: 1e6 }), { code: 'zip.tooLarge' });
});

test('pack.json 在唯一的顶层文件夹里时自动去掉这一层', () => {
  const out = normalizeEntries([file('my-pack/pack.json', '{}'), file('my-pack/style.css', ''), file('__MACOSX/x', '')]);
  assert.deepEqual(names(out), ['pack.json', 'style.css']);
});

test('没有 pack.json 时拒绝', () => {
  assert.throws(() => normalizeEntries([file('a/style.css', ''), file('b/pack.json', '')]), { code: 'zip.noManifest' });
});

test('越界路径被拒绝', () => {
  for (const bad of ['../evil.js', 'fonts/../../evil.js', '/abs.js', 'C:/evil.js']) {
    assert.throws(() => normalizeEntries([file('pack.json', '{}'), file(bad, '')]), { code: 'zip.invalid' }, bad);
  }
});
