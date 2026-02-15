export interface Env {
  ROOM_DO: DurableObjectNamespace;
}

export async function forward(context: EventContext<Env, string, unknown>, route: string): Promise<Response> {
  const request = context.request;
  const method = request.method;
  let roomCode: string | null = null;

  if (route === '/create') {
    roomCode = `${Math.floor(Math.random() * 10000)}`.padStart(4, '0');
  } else if (method === 'GET') {
    roomCode = new URL(request.url).searchParams.get('roomCode');
  } else {
    const body = (await request.clone().json()) as { roomCode?: string };
    roomCode = body.roomCode ?? null;
  }

  if (!roomCode) {
    return new Response(JSON.stringify({ error: 'roomCode required' }), { status: 400 });
  }

  const id = context.env.ROOM_DO.idFromName(roomCode);
  const stub = context.env.ROOM_DO.get(id);

  const headers = new Headers();
  headers.set('content-type', 'application/json');
  const auth = request.headers.get('authorization');
  const playerId = request.headers.get('x-player-id');
  if (auth) headers.set('authorization', auth);
  if (playerId) headers.set('x-player-id', playerId);

  const init: RequestInit = { method, headers };
  if (method !== 'GET') {
    init.body = route === '/create' ? '{}' : await request.text();
  }
  return stub.fetch(`https://room${route}`, init);
}
