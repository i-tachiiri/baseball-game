const api = {
  roomCode: '',
  playerId: '',
  token: '',
  role: 'PITCHER',
  selectedElement: 'FIRE',
  speedRaw: 0,
  magic: false,
  lastShownBall: 0,
  canHit: false
};

const $ = (id) => document.getElementById(id);
const home = $('home');
const lobby = $('lobby');
const game = $('game');
const result = $('result');

function authHeaders() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${api.token}`,
    'x-player-id': api.playerId
  };
}

function switchScreen(name) {
  home.classList.toggle('hidden', name !== 'home');
  lobby.classList.toggle('hidden', name !== 'lobby');
  game.classList.toggle('hidden', name !== 'game');
  result.classList.toggle('hidden', name !== 'result');
}

async function createRoom() {
  const res = await fetch('/api/room/create', { method: 'POST' });
  const data = await res.json();
  Object.assign(api, data);
  $('roomCode').textContent = api.roomCode;
  switchScreen('lobby');
}

async function joinRoom() {
  const roomCode = $('joinCode').value.padStart(4, '0');
  const res = await fetch('/api/room/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode })
  });
  const data = await res.json();
  if (data.error) {
    $('lobbyWait').textContent = 'ルームが みつからない！';
    return;
  }
  Object.assign(api, data);
  $('roomCode').textContent = api.roomCode;
  switchScreen('lobby');
}

async function setRole(role) {
  await fetch('/api/room/role', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ roomCode: api.roomCode, role })
  });
}

function navForState(state) {
  if (state.phase === 'DISCONNECTED') {
    return 'あれ？ あいてが いなくなった！';
  }
  if (api.role === 'PITCHER') {
    if (state.currentInput.pitcher) return 'だしゃの まち！';
    return 'れんだして！ はやさを きめろ！';
  }
  if (state.currentInput.batter) return 'とうしゅの まち！';
  return 'バットを えらべ！ よーい… いま！ うて！';
}

function playReveal(resultData) {
  $('resultText').textContent = 'いくぞ…！';
  setTimeout(() => {
    $('resultText').textContent = resultData.magicUsed ? '🟣 まきゅう！ ピタッ！' : '⚾ とうきゅう！';
  }, 1200);
  setTimeout(() => {
    $('resultText').textContent = 'カキーン！';
  }, 2000);
  setTimeout(() => {
    $('resultText').textContent = resultData.message;
    $('resultText').classList.remove('flash');
    void $('resultText').offsetWidth;
    $('resultText').classList.add('flash');
  }, 2600);
}

async function submitAction() {
  const body = { roomCode: api.roomCode, element: api.selectedElement };
  if (api.role === 'PITCHER') {
    body.speedRaw = api.speedRaw;
    body.useMagic = api.magic;
    api.speedRaw = 0;
    api.magic = false;
  } else {
    if (!api.canHit) return;
    body.timingTapAtClient = Date.now();
    api.canHit = false;
  }
  await fetch('/api/room/submit', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
}

function renderControls() {
  $('spam').style.display = api.role === 'PITCHER' ? 'inline-block' : 'none';
  $('magic').style.display = api.role === 'PITCHER' ? 'inline-block' : 'none';
  $('hit').textContent = api.role === 'PITCHER' ? 'なげる！' : 'いま！ うて！';
}

function updateRoleInfo(state) {
  const players = [state.players.host, state.players.guest].filter(Boolean);
  const me = players.find((p) => p.id === api.playerId);
  if (me) {
    api.role = me.role;
    renderControls();
  }
}

function showWinner(state) {
  const win = state.winner === api.role;
  $('winner').textContent = win ? 'ホームラン！ かち！' : 'さんしん！ まけ！';
}

async function poll() {
  if (!api.roomCode || !api.token) return;
  const res = await fetch(`/api/room/state?roomCode=${api.roomCode}`, { headers: authHeaders() });
  const data = await res.json();
  const state = data.state;
  if (!state) return;

  updateRoleInfo(state);

  if (state.phase === 'LOBBY') {
    switchScreen('lobby');
    $('lobbyWait').textContent = state.players.guest ? 'スタート！' : 'あいてを まってるよ！';
    return;
  }

  if (state.phase === 'FINISHED') {
    switchScreen('result');
    showWinner(state);
    return;
  }

  switchScreen('game');
  $('pitchLabel').textContent = state.ballIndex >= 3 ? 'あと1きゅう！' : `いま ${state.ballIndex}きゅうめ！`;
  $('phaseNav').textContent = navForState(state);

  const bothConnected = [state.players.host, state.players.guest].filter(Boolean).every((p) => p.connected);
  if (!bothConnected || state.phase === 'DISCONNECTED') {
    $('resultText').textContent = 'もどるのを まってるよ！';
    return;
  }

  if (state.lastResult && state.lastResult.ballIndex > api.lastShownBall) {
    api.lastShownBall = state.lastResult.ballIndex;
    playReveal(state.lastResult);
  }

  if (api.role === 'BATTER' && !state.currentInput.batter) {
    api.canHit = true;
  }
}

$('create').onclick = createRoom;
$('join').onclick = joinRoom;
$('spam').onclick = () => {
  api.speedRaw += 1;
  $('phaseNav').textContent = `れんだ！ ${api.speedRaw}`;
};
$('magic').onclick = () => {
  api.magic = true;
  $('phaseNav').textContent = 'まきゅうセット！';
};
$('hit').onclick = submitAction;
$('rematch').onclick = async () => {
  $('rematchWait').textContent = 'あいてを まってるよ！';
  await fetch('/api/room/rematch', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ roomCode: api.roomCode, want: true })
  });
};

document.querySelectorAll('[data-role]').forEach((el) => {
  el.addEventListener('click', async (event) => {
    const role = event.currentTarget.getAttribute('data-role');
    await setRole(role);
  });
});

document.querySelectorAll('[data-el]').forEach((el) => {
  el.addEventListener('click', (event) => {
    api.selectedElement = event.currentTarget.getAttribute('data-el');
  });
});

setInterval(poll, 1000);
