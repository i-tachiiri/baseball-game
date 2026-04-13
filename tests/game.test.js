import test from 'node:test';
import assert from 'node:assert/strict';
import { calcRound, normalizeTimingByTap, speedCategory } from '../dist/src/shared/game.js';

test('speed category mapping', () => {
  assert.equal(speedCategory(0), 'NORMAL');
  assert.equal(speedCategory(3), 'SLOW');
  assert.equal(speedCategory(22), 'NORMAL');
  assert.equal(speedCategory(31), 'FAST');
});

test('just meet is always HR', () => {
  const result = calcRound(
    {
      pitcher: { element: 'FIRE', speedRaw: 11, useMagic: false },
      batter: { element: 'GRASS', timing: 50 }
    },
    1,
    1
  );
  assert.equal(result.kind, 'HR');
  assert.equal(result.justMeet, true);
});

test('timing fail with batter advantage becomes foul', () => {
  const result = calcRound(
    {
      pitcher: { element: 'FIRE', speedRaw: 11, useMagic: false },
      batter: { element: 'WATER', timing: 0 }
    },
    1,
    2
  );
  assert.equal(result.kind, 'FOUL');
});

test('magic shifts center', () => {
  const result = calcRound(
    {
      pitcher: { element: 'FIRE', speedRaw: 11, useMagic: true },
      batter: { element: 'FIRE', timing: 50 }
    },
    -1,
    3
  );
  assert.equal(result.center, 35);
});

test('timing normalization clamps range', () => {
  assert.equal(normalizeTimingByTap(1000, 1000, 1500), 0);
  assert.equal(normalizeTimingByTap(1000, 1750, 1500), 50);
  assert.equal(normalizeTimingByTap(1000, 4000, 1500), 100);
});
