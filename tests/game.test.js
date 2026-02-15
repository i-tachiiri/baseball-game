import test from 'node:test';
import assert from 'node:assert/strict';
import { calcRound, speedCategory } from '../dist/src/shared/game.js';

test('speed category mapping', () => {
  assert.equal(speedCategory(0), 'NORMAL');
  assert.equal(speedCategory(3), 'SLOW');
  assert.equal(speedCategory(22), 'NORMAL');
  assert.equal(speedCategory(31), 'FAST');
});

test('just meet is HR', () => {
  const result = calcRound({
    pitcher: { element: 'FIRE', speedRaw: 11, useMagic: false },
    batter: { element: 'WATER', timing: 50 }
  }, 1);
  assert.equal(result.outcome, 'HR');
});
