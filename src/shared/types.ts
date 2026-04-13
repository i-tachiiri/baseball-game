export type Role = 'PITCHER' | 'BATTER';
export type Element = 'FIRE' | 'WATER' | 'GRASS';
export type SpeedCategory = 'SLOW' | 'NORMAL' | 'FAST';
export type Phase = 'LOBBY' | 'WAIT_PITCHER' | 'WAIT_BATTER' | 'REVEAL' | 'FINISHED' | 'DISCONNECTED';
export type Winner = Role | undefined;

export interface Player {
  id: string;
  token: string;
  isHost: boolean;
  role: Role;
  connected: boolean;
  lastSeenAt: number;
}

export interface PitchInput {
  element: Element;
  speedRaw: number;
  useMagic: boolean;
}

export interface BatInput {
  element: Element;
  timing: number | null;
}

export interface RoundInput {
  pitcher?: PitchInput;
  batter?: BatInput;
}

export interface RoundResult {
  kind: 'HR' | 'FOUL' | 'STRIKE' | 'BAT_BREAK';
  message: string;
  diff: number;
  speedCategory: SpeedCategory;
  center: number;
  justMeet: boolean;
  magicUsed: boolean;
  ballIndex: number;
}

export interface GameState {
  roomCode: string;
  createdAt: number;
  hostId: string;
  hostRole: Role;
  phase: Phase;
  pausedPhase?: Phase;
  players: {
    host?: Player;
    guest?: Player;
  };
  ballIndex: number;
  maxBalls: number;
  currentBallStartedAt: number;
  currentInput: RoundInput;
  magicUsed: boolean;
  lastResult?: RoundResult;
  winner: Winner;
  rematch: {
    host: boolean;
    guest: boolean;
  };
}
