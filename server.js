const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');
const { spawn } = require('child_process');

// 🚗 Windows Native DirectInput Hardware Bridge (Python)
let pythonBridge = null;

function startPythonBridge() {
  try {
    const bridgeScript = path.join(__dirname, 'windows_game_bridge.py');
    pythonBridge = spawn('python', [bridgeScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    pythonBridge.stdout.on('data', (d) => {
      console.log('[GameBridge] ' + d.toString().trim());
    });

    pythonBridge.stderr.on('data', (d) => {
      console.warn('[GameBridge Warn] ' + d.toString().trim());
    });

    pythonBridge.on('close', (code) => {
      console.log('[GameBridge] Closed with code ' + code + '. Restarting in 3s...');
      setTimeout(startPythonBridge, 3000);
    });
  } catch (err) {
    console.error('[GameBridge Error] Could not start Python bridge:', err);
  }
}

// Start bridge automatically for native PC games
startPythonBridge();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Find local IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();

// Determine base URL dynamically (Works locally on Wi-Fi AND when deployed to Render/Railway/Cloud)
function getBaseUrl(socket, req) {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }

  const hostHeader = (socket ? socket.handshake?.headers?.host : req?.headers?.host) || '';
  const proto = (socket ? socket.handshake?.headers?.['x-forwarded-proto'] : req?.headers?.['x-forwarded-proto'])
    || ((hostHeader.includes('localhost') || hostHeader.includes('10.') || hostHeader.includes('192.168.')) ? 'http' : 'https');

  // If accessed from localhost directly, return local Wi-Fi IP so phones on LAN can reach it
  if (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1')) {
    return `http://${localIp}:${PORT}`;
  }

  // If deployed online (e.g. your-app.onrender.com, railway.app, custom domain)
  if (hostHeader) {
    return `${proto}://${hostHeader}`;
  }

  return `http://${localIp}:${PORT}`;
}

// Auto-redirect mobile devices hitting the root to the mobile controller
app.get('/', (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isMobile) {
    const room = req.query.room || '';
    return res.redirect(`/controller.html${room ? '?room=' + room : ''}`);
  }
  next();
});

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/confetti', express.static(path.join(__dirname, 'node_modules/canvas-confetti/dist')));

// API to get local network IP and connection details
app.get('/api/info', async (req, res) => {
  const room = req.query.room || '';
  const baseUrl = getBaseUrl(null, req);
  const controllerUrl = `${baseUrl}/controller.html?room=${room}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(controllerUrl, {
      margin: 1,
      width: 256,
      color: {
        dark: '#00f0ff',
        light: '#070b14'
      }
    });
  } catch (err) {
    console.error('QR code generation error:', err);
  }

  res.json({
    localIp,
    port: PORT,
    controllerUrl,
    qrCodeDataUrl
  });
});

// Rooms state
const rooms = new Map();

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  // Host creates room
  // Host creates room (Persistent Room Code CYBER + Graceful Re-attach)
  socket.on('create-room', async (requestedCode, callback) => {
    let roomCode = (requestedCode || 'CYBER').toUpperCase().trim();
    let room = rooms.get(roomCode);

    const baseUrl = getBaseUrl(socket, null);
    const controllerUrl = `${baseUrl}/controller.html?room=${roomCode}`;

    if (room) {
      // Host is reconnecting/refreshing: Cancel cleanup timer & re-attach without kicking players!
      if (room.hostDisconnectTimer) {
        clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = null;
      }
      room.hostId = socket.id;
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.isHost = true;

      console.log(`[Host Reattached] Seamlessly re-attached host to persistent Room: ${roomCode}`);

      if (callback) {
        callback({
          success: true,
          roomCode,
          localIp,
          port: PORT,
          controllerUrl,
          qrCode: room.qrCode,
          players: room.players
        });
      }
      return;
    }

    // Brand new room creation
    let qrCode = '';
    try {
      qrCode = await QRCode.toDataURL(controllerUrl, {
        margin: 1,
        width: 280,
        color: {
          dark: '#00f0ff',
          light: '#070c18'
        }
      });
    } catch (e) {
      console.error(e);
    }

    room = {
      code: roomCode,
      hostId: socket.id,
      qrCode: qrCode,
      hostDisconnectTimer: null,
      players: {
        1: { socketId: null, name: 'Player 1', ready: false, device: 'Mobile' },
        2: { socketId: null, name: 'Player 2', ready: false, device: 'Mobile' }
      },
      selectedGame: 'fighter'
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.isHost = true;

    if (callback) {
      callback({
        success: true,
        roomCode,
        localIp,
        port: PORT,
        controllerUrl,
        qrCode,
        players: room.players
      });
    }

    console.log(`[Host Created] Persistent Room: ${roomCode} at ${controllerUrl}`);
  });

  // Mobile controller connects to room (Supports Reconnection to preferred slot)
  socket.on('join-room', ({ roomCode, deviceName, preferredSlot }, callback) => {
    const code = (roomCode || 'CYBER').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      if (callback) callback({ success: false, error: `Room ${code} not found. Please open the game screen first!` });
      return;
    }

    // Check which player slot is open (prefer previous slot on reconnect)
    let assignedPlayerNumber = null;
    if (preferredSlot && (!room.players[preferredSlot].socketId || room.players[preferredSlot].socketId === socket.id)) {
      assignedPlayerNumber = preferredSlot;
    } else if (!room.players[1].socketId || room.players[1].socketId === socket.id) {
      assignedPlayerNumber = 1;
    } else if (!room.players[2].socketId || room.players[2].socketId === socket.id) {
      assignedPlayerNumber = 2;
    }

    if (!assignedPlayerNumber) {
      if (callback) callback({ success: false, error: 'Room is already full (2 players connected).' });
      return;
    }

    room.players[assignedPlayerNumber].socketId = socket.id;
    room.players[assignedPlayerNumber].name = deviceName || (Player );
    room.players[assignedPlayerNumber].ready = true;

    socket.join(code);
    socket.roomCode = code;
    socket.playerNumber = assignedPlayerNumber;

    if (callback) {
      callback({
        success: true,
        playerNumber: assignedPlayerNumber,
        roomCode: code,
        game: room.selectedGame
      });
    }

    // Notify Host
    io.to(room.hostId).emit('player-joined', {
      playerNumber: assignedPlayerNumber,
      name: room.players[assignedPlayerNumber].name
    });

    console.log(`[Player Joined] Player ${assignedPlayerNumber} (${room.players[assignedPlayerNumber].name}) connected to persistent room ${code}`);
  });

  socket.on('controller-input', (inputData) => {
    if (!socket.roomCode || !socket.playerNumber) return;
    const room = rooms.get(socket.roomCode);
    if (room && room.hostId) {
      io.to(room.hostId).emit('player-input', {
        playerNumber: socket.playerNumber,
        ...inputData
      });
    }

    // Direct hardware injection into Windows game (Hot Wheels)
    if (pythonBridge && pythonBridge.stdin && !pythonBridge.stdin.destroyed) {
      try {
        pythonBridge.stdin.write(JSON.stringify({
          playerNumber: socket.playerNumber,
          ...inputData
        }) + '\n');
      } catch (e) {}
    }
  });

  // Host sends haptic vibration / sound trigger / HP sync to phone
  socket.on('sync-to-player', ({ playerNumber, type, payload }) => {
    if (!socket.roomCode) return;
    const room = rooms.get(socket.roomCode);
    if (room && room.players[playerNumber] && room.players[playerNumber].socketId) {
      io.to(room.players[playerNumber].socketId).emit('host-sync', {
        type,
        payload
      });
    }
  });

  // WebRTC Screen Mirroring & Remote Desktop Signaling
  socket.on('webrtc-offer', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('webrtc-offer', data);
  });

  socket.on('webrtc-answer', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('webrtc-answer', data);
  });

  socket.on('webrtc-ice-candidate', (data) => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('webrtc-ice-candidate', data);
  });

  // Remote Desktop Mouse & Keyboard from Phone
  socket.on('remote-mouse', (mouseData) => {
    if (pythonBridge && pythonBridge.stdin && !pythonBridge.stdin.destroyed) {
      try {
        pythonBridge.stdin.write(JSON.stringify({ type: 'mouse', ...mouseData }) + '\n');
      } catch (e) {}
    }
  });

  socket.on('remote-key', (keyData) => {
    if (pythonBridge && pythonBridge.stdin && !pythonBridge.stdin.destroyed) {
      try {
        pythonBridge.stdin.write(JSON.stringify({ type: 'key', ...keyData }) + '\n');
      } catch (e) {}
    }
  });

  // Broadcast to all players in the room (e.g. game start, game over, rematch)
  socket.on('broadcast-to-controllers', ({ type, payload }) => {
    if (!socket.roomCode) return;
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    for (const pNum of [1, 2]) {
      const p = room.players[pNum];
      if (p && p.socketId) {
        io.to(p.socketId).emit('host-sync', { type, payload });
      }
    }
  });

  // Mobile controller triggers rematch / ready
  socket.on('player-action', ({ action }) => {
    if (!socket.roomCode) return;
    const room = rooms.get(socket.roomCode);
    if (room && room.hostId) {
      io.to(room.hostId).emit('player-action', {
        playerNumber: socket.playerNumber,
        action
      });
    }
  });

  // Ping for latency measurement
  socket.on('ping-check', (clientTimestamp, callback) => {
    if (callback) callback(clientTimestamp);
  });

  // Handle disconnect
  // Handle disconnect with 30-second Grace Period (Immune to network blips & page refreshes)
  socket.on('disconnect', () => {
    if (socket.isHost && socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        console.log(`[Host Temp Disconnect] Holding Room ${socket.roomCode} for 30s grace period...`);
        // Notify players host is briefly reconnecting (no disruptive alert)
        socket.to(socket.roomCode).emit('host-reconnecting');

        if (room.hostDisconnectTimer) clearTimeout(room.hostDisconnectTimer);
        room.hostDisconnectTimer = setTimeout(() => {
          console.log(`[Room Expired] Persistent Room ${socket.roomCode} deleted after 30s host inactivity.`);
          io.to(socket.roomCode).emit('host-disconnected');
          rooms.delete(socket.roomCode);
        }, 30000);
      }
    } else if (socket.roomCode && socket.playerNumber) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        console.log(`[Player Disconnected] Player ${socket.playerNumber} left room ${socket.roomCode}`);
        if (pythonBridge && pythonBridge.stdin && !pythonBridge.stdin.destroyed) {
          try {
            pythonBridge.stdin.write(JSON.stringify({
              playerNumber: socket.playerNumber,
              gas: false, brake: false, boost: false, drift: false, respawn: false, x: 0, tiltX: 0
            }) + '\n');
          } catch (e) {}
        }
        room.players[socket.playerNumber].socketId = null;
        room.players[socket.playerNumber].ready = false;
        io.to(room.hostId).emit('player-left', {
          playerNumber: socket.playerNumber
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 AIR-CYBER CONSOLE ARCADE SERVER RUNNING!`);
  console.log(`  💻 Laptop Host Screen : http://localhost:${PORT}`);
  console.log(`  📱 Mobile Controller  : http://${localIp}:${PORT}/controller.html`);
  console.log(`======================================================\n`);
});
