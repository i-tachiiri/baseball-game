import type { Element, RoundInput, RoundResult, SpeedCategory } from './types';

export function speedCategory(raw: number): SpeedCategory {
  if (raw === 0) {
    return 'NORMAL';
  }
  if (raw <= 10) {
    return 'SLOW';
  }
  if (raw <= 30) {
    return 'NORMAL';
  }
  return 'FAST';
}

export function centerBySpeed(speed: SpeedCategory): number {
  if (speed === 'SLOW') {
    return 70;
  }
  if (speed === 'FAST') {
    return 30;
  }
  return 50;
}

export function judgeElement(pitcher: Element, batter: Element): -1 | 0 | 1 {
  if (pitcher === batter) {
    return 0;
  }
  if (
    (batter === 'FIRE' && pitcher === 'GRASS') ||
    (batter === 'GRASS' && pitcher === 'WATER') ||
    (batter === 'WATER' && pitcher === 'FIRE')
  ) {
    return 1;
  }
  return -1;
}

export function calcRound(input: RoundInput, randomSign: -1 | 1): RoundResult {
  const pitcher = input.pitcher ?? { element: 'FIRE' as const, speedRaw: 0, useMagic: false };
  const batter = input.batter ?? { element: 'FIRE' as const, timing: null };
  const speed = speedCategory(pitcher.speedRaw);
  let center = centerBySpeed(speed);
  const magicUsed = Boolean(pitcher.useMagic);

  if (magicUsed) {
    center += randomSign * 15;
    center = Math.max(0, Math.min(100, center));
  }

  const timing = batter.timing;
  const diff = timing === null ? 999 : Math.abs(center - timing);

  if (diff <= 5) {
    return { outcome: 'HR', diff, speedCategory: speed, center, magicUsed, justMeet: true, message: 'JUST MEET!!' };
  }

  const relation = judgeElement(pitcher.element, batter.element);

  if (diff <= 20) {
    if (relation === 1) {
      return { outcome: 'HR', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'ホームラン！！' };
    }
    if (relation === 0) {
      return { outcome: 'FOUL', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'ファール！' };
    }
    return { outcome: 'BAT_BREAK', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'バット こわれた！' };
  }

  if (relation === 1) {
    return { outcome: 'FOUL', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'ファール！' };
  }
  if (relation === 0) {
    return { outcome: 'STRIKE', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'ストライク！' };
  }
  return { outcome: 'STRIKE', diff, speedCategory: speed, center, magicUsed, justMeet: false, message: 'さんしん！' };
}

export function normalizeTiming(startAt: number, now: number): number {
  const elapsed = Math.max(0, Math.min(10000, now - startAt));
  return Math.round((elapsed / 10000) * 100);
}
