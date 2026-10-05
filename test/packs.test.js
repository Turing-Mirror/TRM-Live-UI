import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCompatibility, validateManifest, loadPack, listPackIds } from '../server/packs.js';
import { ENGINE_VERSION, PACK_FORMAT } from '../server/version.js';

const minimal = () => ({
  format: PACK_FORMAT.current,
  id: 'demo',
  version: '1.0.0',
  madeWith: ENGINE_VERSION,
  name: 'Demo',
  canvas: { width: 1920, height: 1080 },
  regions: [{ id: 'a', kind: 'title', x: 0, y: 0, w: 10, h: 10 }],
});
const codes = (issues) => issues.map((issue) => issue.code);
const validate = (manifest, exists = () => true) => validateManifest(manifest, { folder: 'demo', exists });

test('最小的包没有问题', () => {
  assert.deepEqual(validate(minimal()), []);
  assert.deepEqual(checkCompatibility(minimal()), []);
});

test('格式比程序新的包不能用', () => {
  const issues = checkCompatibility({ ...minimal(), format: PACK_FORMAT.current + 1 });
  assert.deepEqual(codes(issues), ['pack.formatTooNew']);
  assert.equal(issues[0].level, 'error');
});

test('要求更高程序版本的包不能用', () => {
  const issues = checkCompatibility({ ...minimal(), requires: '999.0.0' });
  assert.deepEqual(codes(issues), ['pack.requiresEngine']);
});

test('用更新的大版本制作的包只提醒', () => {
  const issues = checkCompatibility({ ...minimal(), madeWith: '999.0.0' });
  assert.deepEqual(codes(issues), ['pack.madeWithNewer']);
  assert.equal(issues[0].level, 'warning');
});

test('结构问题逐条报告', () => {
  const manifest = {
    ...minimal(),
    id: 'other',
    canvas: { width: 1920 },
    styles: ['missing.css'],
    regions: [
      { id: 'a', kind: 'title', x: 0, y: 0, w: 1, h: 1 },
      { id: 'a', kind: 'title', x: 0, y: 0, w: 1 },
    ],
    scenes: { items: [{ id: 'wait', screen: { kind: 'screen' } }] },
  };
  const found = codes(validate(manifest, (file) => file !== 'missing.css'));
  for (const code of ['pack.idMismatch', 'pack.missingField', 'pack.fileMissing', 'pack.duplicateId', 'pack.invalidField']) {
    assert.ok(found.includes(code), `应报告 ${code}`);
  }
});

test('自带的每个 UI 包都能用', () => {
  const ids = listPackIds();
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const pack = loadPack(id);
    assert.ok(pack.usable, `${id}: ${JSON.stringify(pack.issues)}`);
  }
});

test('需要更新组件接口的包不能用', () => {
  const issues = checkCompatibility({ ...minimal(), componentApi: 999 });
  assert.deepEqual(codes(issues), ['pack.componentApiTooNew']);
});
