import type { Element, RoundInput, RoundResult, SpeedCategory } from './types';

export function speedCategory(raw: number): SpeedCategory {
  if (raw === 0) return 'NORMAL';
  if (raw <= 10) return 'SLOW';
  if (raw <= 30) return 'NORMAL';
  return 'FAST';
}

export function centerBySpeed(speed: SpeedCategory): number {
  if (speed === 'SLOW') return 70;
  if (speed === 'FAST') return 30;
  return 50;
}

export function judgeElement(pitcher: Element, batter: Element): -1 | 0 | 1 {
  if (pitcher === batter) return 0;
  if (
    (batter === 'FIRE' && pitcher === 'GRASS') ||
    (batter === 'GRASS' && pitcher === 'WATER') ||
    (batter === 'WATER' && pitcher === 'FIRE')
  ) {
    return 1;
  }
  return -1;
}

export function normalizeTimingByTap(ballStartAt: number, tapAt: number, windowMs = 1500): number {
  const elapsed = Math.max(0, tapAt - ballStartAt);
  const scaled = Math.round((elapsed / windowMs) * 100);
  return Math.max(0, Math.min(100, scaled));
}

export function calcRound(input: RoundInput, randomSign: -1 | 1, ballIndex: number): RoundResult {
  const pitcher = input.pitcher ?? { element: 'FIRE' as const, speedRaw: 0, useMagic: false };
  const batter = input.batter ?? { element: 'FIRE' as const, timing: null };
  const speed = speedCategory(pitcher.speedRaw);
  let center = centerBySpeed(speed);

  if (pitcher.useMagic) {
    center += randomSign * 15;
    center = Math.max(0, Math.min(100, center));
  }

  const diff = batter.timing === null ? 999 : Math.abs(center - batter.timing);
  if (diff <= 5) {
    return {
      kind: 'HR',
      message: 'JUST MEET!!',
      diff,
      speedCategory: speed,
      center,
      justMeet: true,
      magicUsed: pitcher.useMagic,
      ballIndex
    };
  }

  const relation = judgeElement(pitcher.element, batter.element);
  if (diff <= 20) {
    if (relation === 1) {
      return { kind: 'HR', message: 'ホームラン！！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
    }
    if (relation === 0) {
      return { kind: 'FOUL', message: 'ファール！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
    }
    return { kind: 'BAT_BREAK', message: 'バット こわれた！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
  }

  if (relation === 1) {
    return { kind: 'FOUL', message: 'ファール！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
  }
  if (relation === 0) {
    return { kind: 'STRIKE', message: 'ストライク！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
  }
  return { kind: 'STRIKE', message: 'さんしん！', diff, speedCategory: speed, center, justMeet: false, magicUsed: pitcher.useMagic, ballIndex };
}
