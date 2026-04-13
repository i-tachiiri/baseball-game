import { calcRound, speedCategory } from '../src/shared/game';

describe('speedCategory', () => {
  it('handles fallback', () => {
    expect(speedCategory(0)).toBe('NORMAL');
  });
  it('handles ranges', () => {
    expect(speedCategory(5)).toBe('SLOW');
    expect(speedCategory(20)).toBe('NORMAL');
    expect(speedCategory(40)).toBe('FAST');
  });
});

describe('calcRound', () => {
  it('returns HR on just meet', () => {
    const r = calcRound({
      pitcher: { element: 'FIRE', speedRaw: 11, useMagic: false },
      batter: { element: 'WATER', timing: 50 }
    }, 1);
    expect(r.outcome).toBe('HR');
    expect(r.justMeet).toBe(true);
  });

  it('applies timing failure logic', () => {
    const r = calcRound({
      pitcher: { element: 'FIRE', speedRaw: 11, useMagic: false },
      batter: { element: 'WATER', timing: 0 }
    }, 1);
    expect(r.outcome).toBe('FOUL');
  });
});
