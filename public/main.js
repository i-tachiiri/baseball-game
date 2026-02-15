const api = {
  roomCode: null,
  playerId: null,
  token: null,
  role: null,
  speedRaw: 0,
  element: 'FIRE',
  timingStart: 0,
  magic: false,
  lastResolvedPitch: 0
};

const $ = (id) => document.getElementById(id);
const home = $('home');
const lobby = $('lobby');
const game = $('game');
const result = $('result');

function headers() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${api.token}`,
    'x-player-id': api.playerId
  };
}

async function createRoom() {
  const res = await fetch('/api/room/create', { method: 'POST' });
  const data = await res.json();
  Object.assign(api, data);
  showLobby();
}

async function joinRoom() {
  const roomCode = $('joinCode').value;
  const res = await fetch('/api/room/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomCode }) });
  const data = await res.json();
  Object.assign(api, data);
  showLobby();
}

function showLobby() {
  home.classList.add('hidden');
  lobby.classList.remove('hidden');
  $('roomCode').textContent = api.roomCode;
}

async function setRole(role) {
  await fetch('/api/room/role', { method: 'POST', headers: headers(), body: JSON.stringify({ roomCode: api.roomCode, role }) });
}

async function submit() {
  const body = { roomCode: api.roomCode, element: api.element };
  if (api.role === 'PITCHER') {
    body.speedRaw = api.speedRaw;
    body.useMagic = api.magic;
    api.speedRaw = 0;
    api.magic = false;
  } else {
    body.timingTapAtClient = api.timingStart;
  }
  await fetch('/api/room/submit', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
}

function renderNav() {
  if (api.role === 'PITCHER') {
    $('phaseNav').textContent = 'れんだして！ はやさを きめろ！';
  } else {
    $('phaseNav').textContent = 'よーい… いま！ うて！';
    api.timingStart = Date.now() - 3000;
  }
}

async function poll() {
  if (!api.roomCode || !api.token) return;
  const res = await fetch(`/api/room/state?roomCode=${api.roomCode}`, { headers: headers() });
  const data = await res.json();
  const state = data.state;
  if (!state) return;

  const me = state.players.find((p) => p.id === api.playerId);
  api.role = me?.role;

  if (state.players.length < 2) {
    $('lobbyWait').textContent = 'あいてを まってるよ！';
  }

  if (state.status === 'IN_GAME') {
    lobby.classList.add('hidden');
    game.classList.remove('hidden');
    result.classList.add('hidden');
    $('pitchLabel').textContent = `いま ${state.pitchCount + 1}きゅうめ！`;
    renderNav();

    if (state.lastResult && state.pitchCount !== api.lastResolvedPitch) {
      api.lastResolvedPitch = state.pitchCount;
      $('resultText').textContent = 'いくぞ…！';
      setTimeout(() => { $('resultText').textContent = state.lastResult.magicUsed ? '🟣 まきゅう！' : '⚾ 投げた！'; }, 1200);
      setTimeout(() => { $('resultText').textContent = 'カキーン！'; }, 2000);
      setTimeout(() => { $('resultText').textContent = state.lastResult.message; }, 2600);
    }

    if (!state.players.every((p) => p.connected)) {
      $('resultText').textContent = 'あれ？ あいてが いなくなった！';
    }
  }

  if (state.status === 'RESULT') {
    game.classList.add('hidden');
    result.classList.remove('hidden');
    $('winner').textContent = state.winner === api.role ? 'ホームラン！ かち！' : 'さんしん！ まけ！';
  }
}

$('create').onclick = createRoom;
$('join').onclick = joinRoom;
$('spam').onclick = () => api.speedRaw += 1;
$('hit').onclick = submit;
$('magic').onclick = () => { api.magic = true; };
$('rematch').onclick = async () => {
  $('rematchWait').textContent = 'あいてを まってるよ！';
  await fetch('/api/room/rematch', { method: 'POST', headers: headers(), body: JSON.stringify({ roomCode: api.roomCode, want: true }) });
};

document.querySelectorAll('[data-role]').forEach((el) => el.addEventListener('click', async (ev) => {
  await setRole(ev.target.getAttribute('data-role'));
}));

document.querySelectorAll('[data-el]').forEach((el) => el.addEventListener('click', (ev) => {
  api.element = ev.target.getAttribute('data-el');
}));

setInterval(poll, 1000);
