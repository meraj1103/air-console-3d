import { TankGame } from './games/tankGame.js';
import { PongGame } from './games/pongGame.js';

class AirConsoleHost {
  constructor() {
    this.socket = io();
    this.roomCode = null;
    this.controllerUrl = '';
    this.players = { 1: false, 2: false };
    this.currentGameType = 'tank'; // 'tank' or 'pong'
    this.activeGame = null;
    this.scores = { 1: 0, 2: 0 };
    this.keyboardFallbackEnabled = true;

    this.initElements();
    this.bindSocketEvents();
    this.bindUiEvents();
    this.bindKeyboardControls();
  }

  initElements() {
    this.lobbyView = document.getElementById('lobby-view');
    this.gameView = document.getElementById('game-view');
    this.victoryModal = document.getElementById('victory-modal');

    this.roomCodeEl = document.getElementById('room-code-display');
    this.qrImageEl = document.getElementById('qr-code-img');
    this.urlDisplayEl = document.getElementById('connection-url');

    this.p1Slot = document.getElementById('player1-slot');
    this.p2Slot = document.getElementById('player2-slot');
    this.p1Status = document.getElementById('p1-status');
    this.p2Status = document.getElementById('p2-status');

    this.startGameBtn = document.getElementById('start-game-btn');
    this.gameContainer = document.getElementById('game-canvas-container');

    this.gameSelectorBtns = document.querySelectorAll('.game-select-card');
  }

  bindSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Connected to server. Creating room...');
      this.socket.emit('create-room', null, (res) => {
        if (res && res.success) {
          this.roomCode = res.roomCode;
          this.controllerUrl = res.controllerUrl;

          if (this.roomCodeEl) this.roomCodeEl.textContent = this.roomCode;
          if (this.qrImageEl && res.qrCode) this.qrImageEl.src = res.qrCode;
          if (this.urlDisplayEl) this.urlDisplayEl.textContent = res.controllerUrl;

          // Virtual Controller test links
          const testP1 = document.getElementById('test-p1-link');
          const testP2 = document.getElementById('test-p2-link');
          if (testP1) testP1.href = res.controllerUrl;
          if (testP2) testP2.href = res.controllerUrl;
        }
      });
    });

    // Mobile player joined
    this.socket.on('player-joined', ({ playerNumber, name }) => {
      this.players[playerNumber] = true;
      window.sounds.playJoin();

      if (playerNumber === 1) {
        this.p1Slot.classList.add('border-cyan-400', 'bg-cyan-950/30');
        this.p1Slot.classList.remove('border-white/10', 'bg-slate-900/40');
        this.p1Status.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping mr-2"></span>CONNECTED: <b class="text-white">${name || 'Player 1'}</b>`;
        document.getElementById('p1-ready-badge').classList.remove('hidden');
      } else {
        this.p2Slot.classList.add('border-pink-500', 'bg-pink-950/30');
        this.p2Slot.classList.remove('border-white/10', 'bg-slate-900/40');
        this.p2Status.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping mr-2"></span>CONNECTED: <b class="text-white">${name || 'Player 2'}</b>`;
        document.getElementById('p2-ready-badge').classList.remove('hidden');
      }

      this.checkStartReadiness();
    });

    // Mobile player left
    this.socket.on('player-left', ({ playerNumber }) => {
      this.players[playerNumber] = false;
      if (playerNumber === 1) {
        this.p1Slot.classList.remove('border-cyan-400', 'bg-cyan-950/30');
        this.p1Slot.classList.add('border-white/10', 'bg-slate-900/40');
        this.p1Status.innerHTML = `WAITING FOR PHONE 1...`;
        document.getElementById('p1-ready-badge').classList.add('hidden');
      } else {
        this.p2Slot.classList.remove('border-pink-500', 'bg-pink-950/30');
        this.p2Slot.classList.add('border-white/10', 'bg-slate-900/40');
        this.p2Status.innerHTML = `WAITING FOR PHONE 2...`;
        document.getElementById('p2-ready-badge').classList.add('hidden');
      }
      this.checkStartReadiness();
    });

    // High frequency player input from phones
    this.socket.on('player-input', (inputData) => {
      if (this.activeGame) {
        this.activeGame.handlePlayerInput(inputData.playerNumber, inputData);
      }
    });

    // Player action from mobile (rematch / menu)
    this.socket.on('player-action', ({ playerNumber, action }) => {
      if (action === 'rematch') {
        this.rematch();
      } else if (action === 'menu') {
        this.returnToLobby();
      }
    });
  }

  checkStartReadiness() {
    // Enable start button if at least 1 player connected, or show 2 connected
    const pCount = (this.players[1] ? 1 : 0) + (this.players[2] ? 1 : 0);
    const countBadge = document.getElementById('connected-count-badge');
    if (countBadge) countBadge.textContent = `${pCount}/2 PLAYERS READY`;

    if (pCount >= 1) {
      this.startGameBtn.removeAttribute('disabled');
      this.startGameBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      this.startGameBtn.classList.add('shadow-[0_0_30px_rgba(0,240,255,0.4)]', 'hover:scale-105');
    }
  }

  bindUiEvents() {
    // Game selection cards
    this.gameSelectorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.sounds.playClick();
        this.gameSelectorBtns.forEach(b => b.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-500/10'));
        btn.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-500/10');
        this.currentGameType = btn.dataset.game;
      });
    });

    // Start game button
    this.startGameBtn.addEventListener('click', () => {
      window.sounds.playClick();
      this.launchGame();
    });

    // Rematch button on victory screen
    document.getElementById('rematch-btn')?.addEventListener('click', () => {
      window.sounds.playClick();
      this.rematch();
    });

    // Return to lobby button
    document.getElementById('lobby-btn')?.addEventListener('click', () => {
      window.sounds.playClick();
      this.returnToLobby();
    });

    // In-game Exit button
    document.getElementById('exit-game-btn')?.addEventListener('click', () => {
      window.sounds.playClick();
      this.returnToLobby();
    });

    // Audio mute button
    const muteBtn = document.getElementById('mute-toggle-btn');
    muteBtn?.addEventListener('click', () => {
      const isMuted = window.sounds.toggleMute();
      muteBtn.textContent = isMuted ? '🔇 MUTED' : '🔊 SOUND ON';
    });

    // Copy URL button
    document.getElementById('copy-url-btn')?.addEventListener('click', () => {
      if (this.controllerUrl) {
        navigator.clipboard.writeText(this.controllerUrl);
        const copyNotice = document.getElementById('copy-notice');
        if (copyNotice) {
          copyNotice.classList.remove('opacity-0');
          setTimeout(() => copyNotice.classList.add('opacity-0'), 1800);
        }
      }
    });

    // Dual Phone Simulator popups
    document.getElementById('open-dual-sim-btn')?.addEventListener('click', () => {
      window.sounds.playClick();
      if (this.controllerUrl) {
        window.open(this.controllerUrl, 'P1_Sim', 'width=440,height=700,left=40,top=80');
        setTimeout(() => {
          window.open(this.controllerUrl, 'P2_Sim', 'width=440,height=700,left=520,top=80');
        }, 350);
      }
    });
  }

  bindKeyboardControls() {
    // Allows keyboard testing directly on the laptop:
    // P1: WASD + Space (Fire) + Shift (Boost) + E (Shield)
    // P2: Arrow keys + Enter (Fire) + Right Ctrl (Boost) + Right Shift (Shield)
    const keysDown = {};

    window.addEventListener('keydown', (e) => {
      if (!this.keyboardFallbackEnabled || !this.activeGame) return;
      keysDown[e.code] = true;
      this.evalKeyboardInput(keysDown);
    });

    window.addEventListener('keyup', (e) => {
      if (!this.keyboardFallbackEnabled || !this.activeGame) return;
      delete keysDown[e.code];
      this.evalKeyboardInput(keysDown);
    });
  }

  evalKeyboardInput(keys) {
    if (!this.activeGame) return;

    // Player 1 (WASD)
    let p1X = 0;
    let p1Y = 0;
    if (keys['KeyA']) p1X -= 1;
    if (keys['KeyD']) p1X += 1;
    if (keys['KeyW']) p1Y -= 1;
    if (keys['KeyS']) p1Y += 1;

    this.activeGame.handlePlayerInput(1, {
      x: p1X,
      y: p1Y,
      fire: !!keys['Space'],
      boost: !!keys['ShiftLeft'],
      shield: !!keys['KeyE']
    });

    // Player 2 (Arrows)
    let p2X = 0;
    let p2Y = 0;
    if (keys['ArrowLeft']) p2X -= 1;
    if (keys['ArrowRight']) p2X += 1;
    if (keys['ArrowUp']) p2Y -= 1;
    if (keys['ArrowDown']) p2Y += 1;

    this.activeGame.handlePlayerInput(2, {
      x: p2X,
      y: p2Y,
      fire: !!keys['Enter'] || !!keys['Numpad0'],
      boost: !!keys['ControlRight'],
      shield: !!keys['ShiftRight']
    });
  }

  syncToMobile(playerNumber, type, payload) {
    this.socket.emit('sync-to-player', {
      playerNumber,
      type,
      payload
    });
  }

  launchGame() {
    this.lobbyView.classList.add('hidden');
    this.victoryModal.classList.add('hidden');
    this.gameView.classList.remove('hidden');

    this.scores = { 1: 0, 2: 0 };
    this.updateScoreHud();

    // Broadcast game start to phones
    this.socket.emit('broadcast-to-controllers', {
      type: 'game-start',
      payload: { game: this.currentGameType }
    });

    if (this.activeGame) {
      this.activeGame.stop();
    }

    const onScoreUpdate = (newScores) => {
      this.scores = { ...newScores };
      this.updateScoreHud();
    };

    const onRoundEnd = (winnerId, isMatchOver) => {
      if (isMatchOver) {
        this.showVictoryScreen(winnerId);
      } else {
        // Next round
        setTimeout(() => {
          this.activeGame.resetRoundPositions();
          this.activeGame.startCountdown();
        }, 800);
      }
    };

    const syncCallback = (pNum, type, data) => {
      this.syncToMobile(pNum, type, data);
    };

    if (this.currentGameType === 'tank') {
      document.getElementById('current-game-title').textContent = 'CYBER BUMPERS: NEON TANKS';
      this.activeGame = new TankGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else {
      document.getElementById('current-game-title').textContent = 'HYPER PONG 3D: CYBER SLAM';
      this.activeGame = new PongGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    }

    this.activeGame.start();
    this.activeGame.startCountdown();
  }

  updateScoreHud() {
    const p1ScoreEl = document.getElementById('p1-score-display');
    const p2ScoreEl = document.getElementById('p2-score-display');
    if (p1ScoreEl) p1ScoreEl.textContent = this.scores[1];
    if (p2ScoreEl) p2ScoreEl.textContent = this.scores[2];
  }

  showVictoryScreen(winnerId) {
    window.sounds.playVictory();

    // Trigger celebration confetti
    if (window.confetti) {
      window.confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        window.confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        window.confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 400);
    }

    const modal = document.getElementById('victory-modal');
    const winnerBanner = document.getElementById('winner-banner');
    const winnerSub = document.getElementById('winner-sub');

    if (winnerId === 1) {
      winnerBanner.textContent = 'PLAYER 1 WINS!';
      winnerBanner.className = 'font-black text-6xl tracking-wider text-cyan-400 drop-shadow-[0_0_35px_#00f0ff] mb-2';
      winnerSub.textContent = 'Electric Cyan Champion of the Arena';
    } else {
      winnerBanner.textContent = 'PLAYER 2 WINS!';
      winnerBanner.className = 'font-black text-6xl tracking-wider text-pink-500 drop-shadow-[0_0_35px_#ff007f] mb-2';
      winnerSub.textContent = 'Neon Magenta Champion of the Arena';
    }

    modal.classList.remove('hidden');

    // Broadcast victory to mobile controllers
    this.socket.emit('broadcast-to-controllers', {
      type: 'game-over',
      payload: { winnerId, scores: this.scores }
    });
  }

  rematch() {
    this.victoryModal.classList.add('hidden');
    this.launchGame();
  }

  returnToLobby() {
    if (this.activeGame) {
      this.activeGame.stop();
      this.activeGame = null;
    }
    this.gameView.classList.add('hidden');
    this.victoryModal.classList.add('hidden');
    this.lobbyView.classList.remove('hidden');

    this.socket.emit('broadcast-to-controllers', {
      type: 'return-lobby',
      payload: {}
    });
  }
}

// Instantiate host on load
window.addEventListener('DOMContentLoaded', () => {
  window.airConsole = new AirConsoleHost();
});
