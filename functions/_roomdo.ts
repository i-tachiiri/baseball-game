import { calcRound, normalizeTimingByTap } from '../src/shared/game';
import type { BatInput, Element, GameState, Phase, PitchInput, Player, Role } from '../src/shared/types';

interface SubmitPayload {
  element?: Element;
  speedRaw?: number;
  useMagic?: boolean;
  timingTapAtClient?: number;
}

export class RoomDO implements DurableObject {
  private stateObj?: GameState;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;

    if (path === '/create') return this.createRoom();
    if (path === '/join') return this.joinRoom();

    await this.loadState();
    const auth = this.auth(req);
    if (!auth.ok) return this.json({ error: auth.error }, 401);

    if (path === '/state') return this.handleState(auth.playerId);
    if (path === '/role') return this.handleRole(req, auth.playerId);
    if (path === '/submit') return this.handleSubmit(req, auth.playerId);
    if (path === '/rematch') return this.handleRematch(auth.playerId);

    return this.json({ error: 'not found' }, 404);
  }

  private async loadState(): Promise<GameState | undefined> {
    if (!this.stateObj) {
      this.stateObj = await this.state.storage.get<GameState>('room');
    }
    return this.stateObj;
  }

  private async save(next: GameState): Promise<void> {
    this.stateObj = next;
    await this.state.storage.put('room', next);
  }

  private playersList(state: GameState): Player[] {
    return [state.players.host, state.players.guest].filter((player): player is Player => Boolean(player));
  }

  private async createRoom(): Promise<Response> {
    const roomCode = this.state.id.toString().slice(-4).padStart(4, '0');
    const hostId = crypto.randomUUID();
    const now = Date.now();
    const host: Player = {
      id: hostId,
      token: crypto.randomUUID(),
      isHost: true,
      role: 'PITCHER',
      connected: true,
      lastSeenAt: now
    };

    const state: GameState = {
      roomCode,
      createdAt: now,
      hostId,
      hostRole: 'PITCHER',
      phase: 'LOBBY',
      players: { host },
      ballIndex: 1,
      maxBalls: 3,
      currentBallStartedAt: now,
      currentInput: {},
      magicUsed: false,
      winner: undefined,
      rematch: { host: false, guest: false }
    };

    await this.save(state);
    return this.json({ roomCode, playerId: host.id, token: host.token });
  }

  private async joinRoom(): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);
    if (!state.players.host) return this.json({ error: 'host missing' }, 409);
    if (state.players.guest) return this.json({ error: 'room full' }, 409);

    const now = Date.now();
    const guestRole: Role = state.hostRole === 'PITCHER' ? 'BATTER' : 'PITCHER';
    state.players.guest = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      isHost: false,
      role: guestRole,
      connected: true,
      lastSeenAt: now
    };
    state.phase = 'WAIT_PITCHER';
    state.currentBallStartedAt = now;
    await this.save(state);

    return this.json({ roomCode: state.roomCode, playerId: state.players.guest.id, token: state.players.guest.token });
  }

  private updateConnectivity(state: GameState, currentPlayerId: string): void {
    const now = Date.now();
    const players = this.playersList(state);
    players.forEach((player) => {
      if (player.id === currentPlayerId) {
        player.lastSeenAt = now;
        player.connected = true;
      } else {
        player.connected = now - player.lastSeenAt < 60000;
      }
    });

    const bothPresent = players.length === 2;
    const allConnected = bothPresent && players.every((player) => player.connected);

    if (!bothPresent) {
      state.phase = 'LOBBY';
      state.pausedPhase = undefined;
      return;
    }

    if (!allConnected) {
      if (state.phase !== 'DISCONNECTED') {
        state.pausedPhase = state.phase;
      }
      state.phase = 'DISCONNECTED';
      return;
    }

    if (state.phase === 'DISCONNECTED') {
      state.phase = state.pausedPhase ?? 'WAIT_PITCHER';
      state.pausedPhase = undefined;
    }
  }

  private resolvePhaseFromInputs(state: GameState): Phase {
    if (state.phase === 'LOBBY' || state.phase === 'FINISHED' || state.phase === 'DISCONNECTED') return state.phase;
    if (state.currentInput.pitcher && state.currentInput.batter) return 'REVEAL';
    if (state.currentInput.pitcher) return 'WAIT_BATTER';
    return 'WAIT_PITCHER';
  }

  private ensureFallbackInputs(state: GameState): void {
    if (!state.currentInput.pitcher) {
      state.currentInput.pitcher = { element: 'FIRE', speedRaw: 0, useMagic: false };
    }
    if (!state.currentInput.batter) {
      state.currentInput.batter = { element: 'FIRE', timing: null };
    }
  }

  private maybeFinalizeBall(state: GameState): void {
    if (state.phase === 'LOBBY' || state.phase === 'FINISHED' || state.phase === 'DISCONNECTED') return;

    const timedOut = Date.now() - state.currentBallStartedAt >= 10000;
    if (!(timedOut || (state.currentInput.pitcher && state.currentInput.batter))) {
      state.phase = this.resolvePhaseFromInputs(state);
      return;
    }

    this.ensureFallbackInputs(state);
    state.phase = 'REVEAL';

    const randomSign: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
    const result = calcRound(state.currentInput, randomSign, state.ballIndex);
    state.lastResult = result;

    if (result.kind === 'HR') {
      state.phase = 'FINISHED';
      state.winner = 'BATTER';
      return;
    }

    if (state.ballIndex >= state.maxBalls) {
      state.phase = 'FINISHED';
      state.winner = 'PITCHER';
      return;
    }

    state.ballIndex += 1;
    state.currentInput = {};
    state.currentBallStartedAt = Date.now();
    state.phase = 'WAIT_PITCHER';
  }

  private async handleState(playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);

    this.updateConnectivity(state, playerId);
    this.maybeFinalizeBall(state);
    await this.save(state);
    return this.json({ state });
  }

  private async handleRole(req: Request, playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state || !state.players.host) return this.json({ error: 'room not found' }, 404);
    if (playerId !== state.hostId) return this.json({ error: 'host only' }, 403);
    if (state.players.guest) return this.json({ error: 'role locked after join' }, 409);

    const body = (await req.json()) as { role?: Role };
    if (body.role !== 'PITCHER' && body.role !== 'BATTER') {
      return this.json({ error: 'invalid role' }, 400);
    }

    state.hostRole = body.role;
    state.players.host.role = body.role;
    await this.save(state);
    return this.json({ ok: true });
  }

  private readPitchInput(payload: SubmitPayload, state: GameState): PitchInput {
    const wantsMagic = Boolean(payload.useMagic) && !state.magicUsed;
    if (wantsMagic) state.magicUsed = true;
    return {
      element: payload.element ?? 'FIRE',
      speedRaw: Math.max(0, payload.speedRaw ?? 0),
      useMagic: wantsMagic
    };
  }

  private readBatInput(payload: SubmitPayload, state: GameState): BatInput {
    const timing = typeof payload.timingTapAtClient === 'number'
      ? normalizeTimingByTap(state.currentBallStartedAt, payload.timingTapAtClient)
      : null;
    return {
      element: payload.element ?? 'FIRE',
      timing
    };
  }

  private async handleSubmit(req: Request, playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);

    this.updateConnectivity(state, playerId);
    if (state.phase === 'LOBBY') return this.json({ error: 'waiting player' }, 409);
    if (state.phase === 'FINISHED') return this.json({ error: 'match finished' }, 409);
    if (state.phase === 'DISCONNECTED') return this.json({ error: 'opponent disconnected' }, 409);

    const player = this.playersList(state).find((entry) => entry.id === playerId);
    if (!player) return this.json({ error: 'unknown player' }, 404);

    const payload = (await req.json()) as SubmitPayload;
    if (player.role === 'PITCHER') {
      if (!state.currentInput.pitcher) {
        state.currentInput.pitcher = this.readPitchInput(payload, state);
      }
    } else if (!state.currentInput.batter) {
      state.currentInput.batter = this.readBatInput(payload, state);
    }

    this.maybeFinalizeBall(state);
    await this.save(state);
    return this.json({ ok: true, state });
  }

  private async handleRematch(playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state || !state.players.host) return this.json({ error: 'room not found' }, 404);
    if (state.phase !== 'FINISHED') return this.json({ error: 'match not finished' }, 409);

    if (playerId === state.players.host.id) {
      state.rematch.host = true;
    }
    if (state.players.guest && playerId === state.players.guest.id) {
      state.rematch.guest = true;
    }

    if (state.players.guest && state.rematch.host && state.rematch.guest) {
      state.phase = 'WAIT_PITCHER';
      state.pausedPhase = undefined;
      state.ballIndex = 1;
      state.currentInput = {};
      state.currentBallStartedAt = Date.now();
      state.lastResult = undefined;
      state.winner = undefined;
      state.magicUsed = false;
      state.rematch = { host: false, guest: false };
    }

    await this.save(state);
    return this.json({ ok: true, state });
  }

  private auth(req: Request): { ok: true; playerId: string } | { ok: false; error: string } {
    if (!this.stateObj) return { ok: false, error: 'missing room' };
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const playerId = req.headers.get('x-player-id');
    if (!token || !playerId) return { ok: false, error: 'missing auth' };

    const player = this.playersList(this.stateObj).find((entry) => entry.id === playerId && entry.token === token);
    if (!player) return { ok: false, error: 'invalid token' };
    return { ok: true, playerId };
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' }
    });
  }
}
