import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, clock } from '../public/core/time.js';

const at = (h, m, s = 0) => new Date(2026, 0, 1, h, m, s);

test('倒计时', () => {
  assert.equal(formatCountdown('21:00', at(20, 55)), '05:00');
  assert.equal(formatCountdown('21:00', at(19, 59, 30)), '1:00:30');
  assert.equal(formatCountdown('21：00', at(20, 59)), '01:00', '全角冒号也能用');
});

test('刚过目标时间显示 00:00，过了半天以上算第二天', () => {
  assert.equal(formatCountdown('21:00', at(21, 5)), '00:00');
  assert.equal(formatCountdown('01:00', at(23, 0)), '2:00:00');
});

test('格式不对时不显示', () => {
  assert.equal(formatCountdown('soon', at(12, 0)), '');
});

test('时钟', () => {
  assert.equal(clock(at(9, 5)), '09:05');
});
