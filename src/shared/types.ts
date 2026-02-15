export type Role = 'PITCHER' | 'BATTER';
export type Element = 'FIRE' | 'WATER' | 'GRASS';
export type SpeedCategory = 'SLOW' | 'NORMAL' | 'FAST';
export type RoundOutcome = 'HR' | 'FOUL' | 'STRIKE' | 'BAT_BREAK';

export interface Player {
  id: string;
  token: string;
  connected: boolean;
  lastSeenAt: number;
  role: Role;
}

export interface RoundInput {
  pitcher?: {
    element: Element;
    speedRaw: number;
    useMagic: boolean;
  };
  batter?: {
    element: Element;
    timing: number | null;
  };
}

export interface RoundResult {
  outcome: RoundOutcome;
  diff: number;
  speedCategory: SpeedCategory;
  center: number;
  magicUsed: boolean;
  justMeet: boolean;
  message: string;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  status: 'LOBBY' | 'IN_GAME' | 'RESULT';
  createdAt: number;
  hostRole: Role;
  players: Player[];
  pitchCount: number;
  maxPitches: number;
  magicUsedByPitcher: boolean;
  currentInput: RoundInput;
  lastResult?: RoundResult;
  winner?: Role;
  rematchVotes: Record<string, boolean>;
}
