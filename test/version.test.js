import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, isVersion, majorOf, ENGINE_VERSION } from '../server/version.js';

test('版本号格式', () => {
  assert.ok(isVersion('1.2.3'));
  assert.ok(isVersion('v1.2.3'));
  assert.ok(!isVersion('1.2'));
  assert.ok(!isVersion(undefined));
  assert.ok(isVersion(ENGINE_VERSION), 'package.json 的 version 必须是 x.y.z');
});

test('版本比较按数字而不是按字符', () => {
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
  assert.ok(compareVersions('1.0.0', '2.0.0') < 0);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.throws(() => compareVersions('1.0', '1.0.0'));
});

test('取大版本号', () => {
  assert.equal(majorOf('3.1.4'), 3);
});
