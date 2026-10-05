import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateData, cleanGroup } from '../server/content.js';
import { deepMerge } from '../server/store.js';

const manifest = { scenes: { items: [{ id: 'live' }, { id: 'brb', screen: { kind: 'screen' } }] } };

test('v1 之前的平铺内容迁移到新结构', () => {
  const legacy = { scene: 'brb', title: { main: 'A' }, brb: { heading: 'B' } };
  assert.deepEqual(migrateData(legacy, manifest), {
    scene: 'brb',
    regions: { title: { main: 'A' } },
    screens: { brb: { heading: 'B' } },
  });
});

test('已是当前结构的数据只去掉 format', () => {
  const current = { format: 1, scene: 'live', regions: {}, screens: {} };
  assert.deepEqual(migrateData(current, manifest), { scene: 'live', regions: {}, screens: {} });
});

test('只保留字符串、数字、布尔值', () => {
  const dirty = { a: { text: 'x', n: 1, on: true, bad: { nested: 1 }, list: [1] }, b: 'not an object' };
  assert.deepEqual(cleanGroup(dirty), { a: { text: 'x', n: 1, on: true } });
});

test('默认值与用户值深合并，包新增的字段有默认值', () => {
  const defaults = { regions: { title: { main: '默认', sub: '新字段' } } };
  const user = { regions: { title: { main: '用户' } } };
  assert.deepEqual(deepMerge(defaults, user), { regions: { title: { main: '用户', sub: '新字段' } } });
});
