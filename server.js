// Family Auction Night — real-time auction server
// Run: npm install && npm start

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 100;
const MAX_NAME = 10;
const FREEZE_MS = 5000; // no bidding in the final 5 seconds of a timed round
const MAX_TIMER_SEC = 60 * 60;
// The host creates their key on the host screen the first time it's opened.
// (Optional: set HOST_KEY in the environment to pre-set it.)
const normKey = (k) => String(k || '').trim().toUpperCase();
let HOST_KEY = normKey(process.env.HOST_KEY) || null;

function lanIP() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) candidates.push(n.address);
    }
  }
  return (
    candidates.find((a) => a.startsWith('192.168.')) ||
    candidates.find((a) => a.startsWith('10.')) ||
    candidates.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ||
    candidates[0] ||
    'localhost'
  );
}

// On Render, RENDER_EXTERNAL_URL is set automatically, so the QR code points to the public address
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${lanIP()}:${PORT}`).replace(/\/$/, '');
const JOIN_URL = `${PUBLIC_URL}/`;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

// Page files can sit next to server.js OR inside a "public" folder; either works.
const fs = require('fs');
function pageFile(name) {
  const inPublic = path.join(__dirname, 'public', name);
  return fs.existsSync(inPublic) ? inPublic : path.join(__dirname, name);
}
const sendPage = (name) => (req, res) => res.set('Cache-Control', 'no-cache').sendFile(pageFile(name));
app.get('/', sendPage('play.html'));
app.get(['/host', '/host.html'], sendPage('host.html'));
app.get(['/tv', '/tv.html'], sendPage('tv.html'));
app.get('/play.html', sendPage('play.html'));
app.get('/sfx.js', sendPage('sfx.js'));
app.get('/api/host-status', (req, res) => res.set('Cache-Control', 'no-store').json({ hasKey: !!HOST_KEY }));
app.get('/qr.png', async (req, res) => {
  try {
    const png = await QRCode.toBuffer(JOIN_URL, { width: 640, margin: 1 });
    res.type('png').set('Cache-Control', 'no-store').send(png);
  } catch (e) {
    res.status(500).send('QR error');
  }
});

// ---------------- Game state ----------------
const players = new Map(); // secret token -> player
const byPublicId = new Map(); // public id -> player

let game = { status: 'lobby' }; // lobby | running | ended
// round: { number, item, current, state: open|locked|sold|cancelled, leader, endsAt, endReason }
let round = null;
let roundCount = 0;
let history = []; // { number, item, winner, amount }
let timerHandle = null;

const toInt = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
};
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
const nameTaken = (name, exceptToken) =>
  [...players.values()].some((p) => p.token !== exceptToken && p.name.toLowerCase() === name.toLowerCase());
const isLive = () => round && (round.state === 'open' || round.state === 'locked');
const isFrozen = () => isLive() && round.endsAt && round.endsAt - Date.now() <= FREEZE_MS;

// Sound / animation cues for the TV and host screens
const fx = (type, data = {}) => io.to(['tv', 'host']).emit('fx', { type, ...data });

// ---------------- Timer ----------------
function clearTimer() {
  clearTimeout(timerHandle);
  timerHandle = null;
}
function scheduleTimer() {
  clearTimer();
  if (!isLive() || !round.endsAt) return;
  timerHandle = setTimeout(onTimeUp, Math.max(0, round.endsAt - Date.now()));
}
function onTimeUp() {
  timerHandle = null;
  if (!isLive()) return;
  if (round.endsAt && round.endsAt - Date.now() > 50) return scheduleTimer(); // time was added
  if (round.leader) {
    sell(true);
  } else {
    round.state = 'cancelled';
    round.endReason = 'nobids';
    fx('nobids');
  }
  broadcast();
}

function sell(auto = false) {
  if (!isLive() || !round.leader) return false;
  const p = byPublicId.get(round.leader.id);
  if (p) p.money = Math.max(0, p.money - round.leader.amount);
  round.state = 'sold';
  round.endReason = auto ? 'timeup' : 'host';
  history.push({ number: round.number, item: round.item, winner: round.leader.name, amount: round.leader.amount });
  clearTimer();
  fx('sold', { name: round.leader.name, amount: round.leader.amount, auto });
  return true;
}

function publicRound() {
  if (!round) return null;
  return {
    number: round.number,
    item: round.item,
    current: round.current,
    state: round.state,
    leader: round.leader ? { ...round.leader } : null,
    endsAt: round.endsAt,
    timerTotal: round.timerTotal,
    winnerMoney: round.state === 'sold' && round.leader && byPublicId.get(round.leader.id) ? byPublicId.get(round.leader.id).money : null,
    endReason: round.endReason || null,
  };
}

function playerList() {
  return [...players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    money: p.money,
    connected: p.connected,
    joinedAt: p.joinedAt,
  }));
}

let pending = false;
function broadcast() {
  if (pending) return;
  pending = true;
  setImmediate(() => {
    pending = false;
    const list = playerList();
    const base = {
      status: game.status,
      round: publicRound(),
      playerCount: list.length,
      onlineCount: list.filter((p) => p.connected).length,
      history: history.slice(-12),
      freezeMs: FREEZE_MS,
      serverNow: Date.now(),
    };
    io.to(['host', 'tv']).emit('hostState', { ...base, players: list, joinUrl: JOIN_URL, maxPlayers: MAX_PLAYERS });

    const standings =
      game.status === 'ended'
        ? [...list].sort((a, b) => b.money - a.money).map((p) => ({ name: p.name, money: p.money }))
        : null;
    io.to('players').emit('state', { ...base, standings });
    for (const p of players.values()) {
      if (p.socketId) io.to(p.socketId).emit('me', { id: p.id, name: p.name, money: p.money });
    }
  });
}

function hostToast(socket, msg) {
  socket.emit('toast', msg);
}

function dropLeaderIfRemoved(p) {
  if (round && round.leader && round.leader.id === p.id && round.state !== 'sold') {
    round.leader = null;
    if (round.state === 'locked') round.state = 'open';
  }
}

// ---------------- Sockets ----------------
io.on('connection', (socket) => {
  const auth = socket.handshake.auth || {};

  // ===== TV (read-only display) =====
  if (auth.role === 'tv') {
    socket.join('tv');
    broadcast();
    return;
  }

  // ===== HOST =====
  if (auth.role === 'host') {
    const deny = (reason) => {
      socket.emit('hostDenied', reason);
      setTimeout(() => socket.disconnect(true), 500); // give the message time to arrive
    };
    const k = normKey(auth.key);
    if (!HOST_KEY) {
      if (!auth.create) return deny('nokey');
      if (k.length < 4) return deny('short');
      HOST_KEY = k; // first host to create a key owns the controls
      console.log('Host key created on the host screen.');
    } else if (k !== HOST_KEY) {
      return deny('wrong');
    }
    socket.join('host');
    broadcast();

    const on = (evt, fn) =>
      socket.on(evt, (data = {}) => {
        try {
          fn(data || {});
        } catch (e) {
          console.error(evt, e);
        }
        broadcast();
      });

    on('host:startGame', () => {
      if (game.status !== 'running') fx('gameStart');
      game.status = 'running';
    });
    on('host:endGame', () => {
      if (isLive()) {
        round.state = 'cancelled';
        round.endReason = 'host';
      }
      clearTimer();
      game.status = 'ended';
      fx('gameEnd');
    });
    on('host:newGame', ({ keepPlayers }) => {
      clearTimer();
      game.status = 'lobby';
      round = null;
      roundCount = 0;
      history = [];
      if (!keepPlayers) {
        for (const p of players.values()) {
          if (p.socketId) io.to(p.socketId).emit('kicked', 'The host started a brand-new game. Join again!');
        }
        players.clear();
        byPublicId.clear();
      } else {
        for (const p of players.values()) p.money = 0;
      }
    });

    // --- money ---
    on('host:setAll', ({ amount }) => {
      const a = toInt(amount);
      if (a === null || a < 0) return hostToast(socket, 'Enter a valid amount');
      for (const p of players.values()) p.money = a;
      hostToast(socket, `Everyone now has $${a}`);
      fx('money');
    });
    on('host:addAll', ({ amount }) => {
      const a = toInt(amount);
      if (a === null || a === 0) return hostToast(socket, 'Enter a valid amount');
      for (const p of players.values()) p.money = Math.max(0, p.money + a);
      hostToast(socket, `${a > 0 ? 'Gave' : 'Took'} $${Math.abs(a)} ${a > 0 ? 'to' : 'from'} everyone`);
      fx('money');
    });
    on('host:adjust', ({ id, amount }) => {
      const p = byPublicId.get(id);
      const a = toInt(amount);
      if (!p || a === null || a === 0) return;
      p.money = Math.max(0, p.money + a);
    });
    on('host:setMoney', ({ id, amount }) => {
      const p = byPublicId.get(id);
      const a = toInt(amount);
      if (!p || a === null || a < 0) return;
      p.money = a;
    });
    on('host:kick', ({ id }) => {
      const p = byPublicId.get(id);
      if (!p) return;
      if (p.socketId) io.to(p.socketId).emit('kicked', 'You were removed by the host.');
      players.delete(p.token);
      byPublicId.delete(p.id);
      dropLeaderIfRemoved(p);
    });

    // --- auction ---
    on('host:startRound', ({ amount, item, seconds }) => {
      const a = toInt(amount);
      const secs = toInt(seconds) || 0;
      if (game.status !== 'running') return hostToast(socket, 'Start the game first');
      if (a === null || a < 0) return hostToast(socket, 'Enter a starting bid');
      if (secs < 0 || secs > MAX_TIMER_SEC) return hostToast(socket, 'Timer must be under 60 minutes');
      roundCount += 1;
      round = {
        number: roundCount,
        item: String(item || '').trim().slice(0, 40),
        current: a,
        state: 'open',
        leader: null,
        endsAt: secs > 0 ? Date.now() + secs * 1000 : null,
        timerTotal: secs > 0 ? secs * 1000 : null,
        endReason: null,
      };
      scheduleTimer();
      fx('roundStart');
    });
    on('host:addTime', ({ seconds }) => {
      const s = toInt(seconds);
      if (!isLive()) return hostToast(socket, 'No auction running');
      if (!s || s <= 0 || s > MAX_TIMER_SEC) return hostToast(socket, 'Enter a valid time');
      const base = round.endsAt && round.endsAt > Date.now() ? round.endsAt : Date.now();
      round.endsAt = Math.min(base + s * 1000, Date.now() + MAX_TIMER_SEC * 1000);
      round.timerTotal = Math.max(round.timerTotal || 0, round.endsAt - Date.now());
      scheduleTimer();
      fx('timeAdded');
    });
    on('host:stopTimer', () => {
      if (!isLive()) return;
      round.endsAt = null;
      round.timerTotal = null;
      clearTimer();
    });
    on('host:raise', ({ amount }) => {
      const a = toInt(amount);
      if (!isLive()) return;
      if (a === null || a <= 0) return hostToast(socket, 'Raise must be more than $0');
      round.current += a;
      round.state = 'open';
      fx('raise');
    });
    on('host:setBid', ({ amount }) => {
      const a = toInt(amount);
      if (!isLive() || a === null || a < 0) return;
      if (round.leader && a <= round.leader.amount) return hostToast(socket, `Must be above the locked bid of $${round.leader.amount}`);
      round.current = a;
      round.state = 'open';
      fx('raise');
    });
    on('host:sold', () => {
      if (!sell(false)) hostToast(socket, 'Nobody has locked a bid yet');
    });
    on('host:cancelRound', () => {
      if (!isLive()) return;
      round.state = 'cancelled';
      round.endReason = 'host';
      clearTimer();
      fx('cancel');
    });
    return;
  }

  // ===== PLAYER =====
  let me = null;

  socket.on('join', ({ token, name } = {}, ack = () => {}) => {
    if (token && players.has(token)) {
      me = players.get(token);
      me.socketId = socket.id;
      me.connected = true;
      socket.join('players');
      ack({ ok: true, token: me.token });
      return broadcast();
    }
    const n = cleanName(name);
    if (!n) return ack({ ok: false, error: 'Pick a nickname' });
    if (players.size >= MAX_PLAYERS) return ack({ ok: false, error: 'Game is full (100 players)' });
    if (nameTaken(n)) return ack({ ok: false, error: 'That nickname is taken' });

    const newToken = crypto.randomBytes(16).toString('hex');
    me = {
      token: newToken,
      id: crypto.randomBytes(6).toString('hex'),
      name: n,
      money: 0,
      socketId: socket.id,
      connected: true,
      joinedAt: Date.now(),
    };
    players.set(newToken, me);
    byPublicId.set(me.id, me);
    socket.join('players');
    ack({ ok: true, token: newToken });
    fx('join', { name: n });
    broadcast();
  });

  socket.on('bid', ({ amount } = {}, ack = () => {}) => {
    // Node runs this handler to completion before any other bid is handled,
    // so exactly one player can win the lock at each price.
    if (!me || !players.has(me.token)) return ack({ ok: false, error: 'Not in the game' });
    if (game.status !== 'running' || !round) return ack({ ok: false, error: 'No auction right now' });
    if (round.state !== 'open') {
      return ack({ ok: false, error: round.state === 'locked' ? `Too late — ${round.leader.name} locked it in` : 'Bidding is closed' });
    }
    if (isFrozen()) return ack({ ok: false, error: 'Final 5 seconds — bidding is closed' });
    if (toInt(amount) !== round.current) return ack({ ok: false, error: 'The price just changed — check the new amount' });
    if (round.leader && round.leader.id === me.id) return ack({ ok: false, error: "You're already winning" });
    if (me.money < round.current) return ack({ ok: false, error: 'Not enough money' });

    round.leader = { id: me.id, name: me.name, amount: round.current };
    round.state = 'locked';
    ack({ ok: true });
    fx('lock', { name: me.name, amount: round.current });
    broadcast();
  });

  socket.on('leave', () => {
    if (!me) return;
    players.delete(me.token);
    byPublicId.delete(me.id);
    dropLeaderIfRemoved(me);
    me = null;
    broadcast();
  });

  socket.on('disconnect', () => {
    if (me && players.has(me.token) && me.socketId === socket.id) {
      me.connected = false;
      me.socketId = null;
      broadcast();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  console.log('  FAMILY AUCTION NIGHT is running!');
  console.log(line);
  console.log(`  HOST controls (create your host key the first time you open it):`);
  console.log(`     ${PUBLIC_URL}/host`);
  console.log(`  TV screen (full-screen display with sound):`);
  console.log(`     ${PUBLIC_URL}/tv`);
  console.log('');
  console.log(`  PLAYERS join at: ${JOIN_URL}   (or scan the QR code)`);
  console.log(`${line}\n`);
});
