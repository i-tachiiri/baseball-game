import { calcRound, normalizeTiming } from '../src/shared/game';
import type { Element, GameState, Role } from '../src/shared/types';

interface SubmitPayload {
  element?: Element;
  speedRaw?: number;
  useMagic?: boolean;
  timingTapAtClient?: number;
  timing?: number;
}

export class RoomDO implements DurableObject {
  private stateObj?: GameState;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

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
    if (!this.stateObj) this.stateObj = await this.state.storage.get<GameState>('room');
    return this.stateObj;
  }

  private async save(state: GameState): Promise<void> {
    this.stateObj = state;
    await this.state.storage.put('room', state);
  }

  private async createRoom(): Promise<Response> {
    const roomCode = this.state.id.toString().slice(-4).padStart(4, '0');
    const hostId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const now = Date.now();

    const state: GameState = {
      roomCode,
      hostId,
      status: 'LOBBY',
      createdAt: now,
      hostRole: 'PITCHER',
      players: [{ id: hostId, token, role: 'PITCHER', connected: true, lastSeenAt: now }],
      pitchCount: 0,
      maxPitches: 3,
      magicUsedByPitcher: false,
      currentInput: {},
      rematchVotes: {}
    };
    await this.save(state);
    return this.json({ roomCode, playerId: hostId, token });
  }

  private async joinRoom(): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);
    if (state.players.length >= 2) return this.json({ error: 'room full' }, 409);

    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const role: Role = state.hostRole === 'PITCHER' ? 'BATTER' : 'PITCHER';
    state.players.push({ id, token, role, connected: true, lastSeenAt: Date.now() });
    state.status = 'IN_GAME';
    await this.save(state);

    return this.json({ roomCode: state.roomCode, playerId: id, token });
  }

  private async handleState(playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);

    const now = Date.now();
    state.players.forEach((p) => {
      if (p.id === playerId) {
        p.lastSeenAt = now;
        p.connected = true;
      } else {
        p.connected = now - p.lastSeenAt < 60000;
      }
    });
    await this.save(state);
    return this.json({ state });
  }

  private async handleRole(req: Request, playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);
    if (playerId !== state.hostId) return this.json({ error: 'host only' }, 403);

    const body = (await req.json()) as { role: Role };
    state.hostRole = body.role;
    state.players = state.players.map((p) => ({
      ...p,
      role: p.id === state.hostId ? body.role : body.role === 'PITCHER' ? 'BATTER' : 'PITCHER'
    }));
    await this.save(state);

    return this.json({ ok: true });
  }

  private async handleSubmit(req: Request, playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);
    if (state.status !== 'IN_GAME') return this.json({ error: 'not in game' }, 409);

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return this.json({ error: 'unknown player' }, 404);

    const payload = (await req.json()) as SubmitPayload;
    if (player.role === 'PITCHER') {
      state.currentInput.pitcher = {
        element: payload.element ?? 'FIRE',
        speedRaw: payload.speedRaw ?? 0,
        useMagic: Boolean(payload.useMagic) && !state.magicUsedByPitcher
      };
      if (state.currentInput.pitcher.useMagic) state.magicUsedByPitcher = true;
    } else {
      const timing = payload.timing ?? (payload.timingTapAtClient ? normalizeTiming(payload.timingTapAtClient, Date.now()) : null);
      state.currentInput.batter = { element: payload.element ?? 'FIRE', timing };
    }

    if (state.currentInput.pitcher && state.currentInput.batter) {
      const randomSign = Math.random() < 0.5 ? -1 : 1;
      const result = calcRound(state.currentInput, randomSign);
      state.lastResult = result;
      state.pitchCount += 1;
      state.currentInput = {};
      if (result.outcome === 'HR') {
        state.status = 'RESULT';
        state.winner = 'BATTER';
      } else if (state.pitchCount >= state.maxPitches) {
        state.status = 'RESULT';
        state.winner = 'PITCHER';
      }
    }

    await this.save(state);
    return this.json({ ok: true, state });
  }

  private async handleRematch(playerId: string): Promise<Response> {
    const state = await this.loadState();
    if (!state) return this.json({ error: 'room not found' }, 404);

    state.rematchVotes[playerId] = true;
    if (state.players.every((p) => state.rematchVotes[p.id])) {
      state.status = 'IN_GAME';
      state.pitchCount = 0;
      state.magicUsedByPitcher = false;
      state.currentInput = {};
      state.lastResult = undefined;
      state.winner = undefined;
      state.rematchVotes = {};
    }
    await this.save(state);
    return this.json({ ok: true, state });
  }

  private auth(req: Request): { ok: true; playerId: string } | { ok: false; error: string } {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const playerId = req.headers.get('x-player-id');
    if (!token || !playerId || !this.stateObj) return { ok: false, error: 'missing auth' };

    const player = this.stateObj.players.find((p) => p.id === playerId && p.token === token);
    if (!player) return { ok: false, error: 'invalid token' };

    return { ok: true, playerId };
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  }
}
