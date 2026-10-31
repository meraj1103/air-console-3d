// 🖥️ AIR-CONSOLE 3D HOST OS (Screen Manager)
import { KartGame } from './games/kartGame.js';
import { BombGame } from './games/bombGame.js';
import { TankGame } from './games/tankGame.js';
import { GamepadMode } from './games/gamepadMode.js';
import { SnesEmulator } from './games/snesEmulator.js';
import { HotWheelsMode } from './games/hotWheelsMode.js';
import { FighterGame } from './games/fighterGame.js';

class AirConsoleHost {
  constructor() {
    this.socket = io();
    this.roomCode = null;
    this.controllerUrl = '';
    this.players = { 1: false, 2: false };
    this.currentGameType = 'fighter'; // Default to fast fun Kart Racing!
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

  setPlayerConnected(playerNumber, name) {
    this.players[playerNumber] = true;
    if (playerNumber === 1) {
      this.p1Slot?.classList.add('border-cyan-400', 'bg-cyan-950/40', 'shadow-[0_0_20px_rgba(0,240,255,0.2)]');
      this.p1Slot?.classList.remove('border-white/10', 'bg-slate-900/40');
      if (this.p1Status) this.p1Status.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping mr-2"></span>JOY-CON 1: <b class="text-white">${name || 'Player 1'}</b>`;
      document.getElementById('p1-ready-badge')?.classList.remove('hidden');
    } else {
      this.p2Slot?.classList.add('border-pink-500', 'bg-pink-950/40', 'shadow-[0_0_20px_rgba(255,0,85,0.2)]');
      this.p2Slot?.classList.remove('border-white/10', 'bg-slate-900/40');
      if (this.p2Status) this.p2Status.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping mr-2"></span>JOY-CON 2: <b class="text-white">${name || 'Player 2'}</b>`;
      document.getElementById('p2-ready-badge')?.classList.remove('hidden');
    }
    this.checkStartReadiness();
  }

  setPlayerDisconnected(playerNumber) {
    this.players[playerNumber] = false;
    if (playerNumber === 1) {
      this.p1Slot?.classList.remove('border-cyan-400', 'bg-cyan-950/40', 'shadow-[0_0_20px_rgba(0,240,255,0.2)]');
      this.p1Slot?.classList.add('border-white/10', 'bg-slate-900/40');
      if (this.p1Status) this.p1Status.innerHTML = `WAITING FOR PHONE 1...`;
      document.getElementById('p1-ready-badge')?.classList.add('hidden');
    } else {
      this.p2Slot?.classList.remove('border-pink-500', 'bg-pink-950/40', 'shadow-[0_0_20px_rgba(255,0,85,0.2)]');
      this.p2Slot?.classList.add('border-white/10', 'bg-slate-900/40');
      if (this.p2Status) this.p2Status.innerHTML = `WAITING FOR PHONE 2 (OR AI BOT)...`;
      document.getElementById('p2-ready-badge')?.classList.add('hidden');
    }
    this.checkStartReadiness();
  }

  bindSocketEvents() {
    this.socket.on('connect', () => {
      const savedCode = sessionStorage.getItem('airconsole_room_code') || 'CYBER';
      console.log('Connected to server. Using persistent room code:', savedCode);
      this.socket.emit('create-room', savedCode, (res) => {
        if (res && res.success) {
          this.roomCode = res.roomCode;
          sessionStorage.setItem('airconsole_room_code', this.roomCode);
          this.controllerUrl = res.controllerUrl;

          if (this.roomCodeEl) this.roomCodeEl.textContent = this.roomCode;
          if (this.qrImageEl && res.qrCode) this.qrImageEl.src = res.qrCode;
          if (this.urlDisplayEl) this.urlDisplayEl.textContent = res.controllerUrl;

          // Virtual Controller test links
          const testP1 = document.getElementById('test-p1-link');
          const testP2 = document.getElementById('test-p2-link');
          if (testP1) testP1.href = res.controllerUrl;
          if (testP2) testP2.href = res.controllerUrl;

          // Seamlessly restore already connected players if re-attached
          if (res.players) {
            if (res.players[1] && res.players[1].socketId) {
              this.setPlayerConnected(1, res.players[1].name);
            }
            if (res.players[2] && res.players[2].socketId) {
              this.setPlayerConnected(2, res.players[2].name);
            }
          }
        }
      });
    });

    // Mobile player joined
    this.socket.on('player-joined', ({ playerNumber, name }) => {
      this.setPlayerConnected(playerNumber, name);
      window.sounds?.playJoin();
    });

    // Mobile player left
    this.socket.on('player-left', ({ playerNumber }) => {
      this.setPlayerDisconnected(playerNumber);
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
    const pCount = (this.players[1] ? 1 : 0) + (this.players[2] ? 1 : 0);
    const countBadge = document.getElementById('connected-count-badge');
    if (countBadge) {
      countBadge.textContent = pCount === 2 ? '2/2 PLAYERS CONNECTED' :
                               pCount === 1 ? '1 PLAYER CONNECTED (AI BOT READY)' : '0/2 PLAYERS';
    }

    if (this.startGameBtn) {
      if (pCount === 2) {
        this.startGameBtn.textContent = 'START 2-PLAYER BATTLE ⚡';
        this.startGameBtn.className = 'cyber-btn w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-pink-500 text-white font-orbitron font-black text-base tracking-widest uppercase transition-all shadow-[0_0_35px_rgba(0,240,255,0.5)] hover:brightness-110 active:scale-95 cursor-pointer';
      } else if (pCount === 1) {
        this.startGameBtn.textContent = 'START GAME (PLAYER 1 VS AI BOT) 🤖';
        this.startGameBtn.className = 'cyber-btn w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-orbitron font-black text-base tracking-widest uppercase transition-all shadow-[0_0_30px_rgba(0,255,136,0.4)] hover:brightness-110 active:scale-95 cursor-pointer';
      } else {
        this.startGameBtn.textContent = 'START (KEYBOARD / SIMULATOR) ⚡';
        this.startGameBtn.className = 'cyber-btn w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-orbitron font-bold text-sm tracking-widest uppercase transition-all cursor-pointer border border-white/20';
      }
    }
  }

  bindUiEvents() {
    this.gameSelectorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.sounds?.playClick();
        this.gameSelectorBtns.forEach(b => {
          b.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-500/10', 'border-cyan-400');
          b.classList.add('border-white/10');
        });
        btn.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-500/10', 'border-cyan-400');
        btn.classList.remove('border-white/10');
        this.currentGameType = btn.dataset.game;
      });
    });

    this.startGameBtn?.addEventListener('click', () => {
      window.sounds?.playClick();
      this.launchGame();
    });

    document.getElementById('rematch-btn')?.addEventListener('click', () => {
      window.sounds?.playClick();
      this.rematch();
    });

    document.getElementById('lobby-btn')?.addEventListener('click', () => {
      window.sounds?.playClick();
      this.returnToLobby();
    });

    document.getElementById('exit-game-btn')?.addEventListener('click', () => {
      window.sounds?.playClick();
      this.returnToLobby();
    });

    const muteBtn = document.getElementById('mute-toggle-btn');
    muteBtn?.addEventListener('click', () => {
      const isMuted = window.sounds?.toggleMute();
      muteBtn.textContent = isMuted ? '🔇 MUTED' : '🔊 SOUND ON';
    });

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

    document.getElementById('open-dual-sim-btn')?.addEventListener('click', () => {
      window.sounds?.playClick();
      if (this.controllerUrl) {
        window.open(this.controllerUrl, 'JoyCon_1', 'width=460,height=720,left=30,top=60');
        setTimeout(() => {
          window.open(this.controllerUrl, 'JoyCon_2', 'width=460,height=720,left=520,top=60');
        }, 350);
      }
    });
  }

  bindKeyboardControls() {
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
      btnA: !!keys['Space'],
      boost: !!keys['ShiftLeft'],
      btnB: !!keys['ShiftLeft'],
      shield: !!keys['KeyE'],
      btnX: !!keys['KeyE'],
      btnY: !!keys['KeyQ']
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
      btnA: !!keys['Enter'] || !!keys['Numpad0'],
      boost: !!keys['ControlRight'],
      btnB: !!keys['ControlRight'],
      shield: !!keys['ShiftRight'],
      btnX: !!keys['ShiftRight'],
      btnY: !!keys['Slash']
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
        setTimeout(() => {
          this.activeGame.resetRoundPositions?.();
          this.activeGame.startCountdown?.();
        }, 800);
      }
    };

    const syncCallback = (pNum, type, data) => {
      this.syncToMobile(pNum, type, data);
    };

    const titleEl = document.getElementById('current-game-title');

    if (this.currentGameType === 'kart') {
      if (titleEl) titleEl.textContent = '🏎️ NEON KART: CYBER RACERS 3D';
      this.activeGame = new KartGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else if (this.currentGameType === 'bomb') {
      if (titleEl) titleEl.textContent = '💣 SUPER BOMB BRAWLERS 3D';
      this.activeGame = new BombGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else if (this.currentGameType === 'tank') {
      if (titleEl) titleEl.textContent = '🚀 CYBER TANK SHOWDOWN 3D';
      this.activeGame = new TankGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
      // If Player 2 is not connected, enable AI bot
      if (!this.players[2]) {
        this.activeGame.p2IsBot = true;
      }
    } else if (this.currentGameType === 'hotwheels') {
      if (titleEl) titleEl.textContent = '🏎️ HOT WHEELS UNLEASHED CONSOLE';
      this.activeGame = new HotWheelsMode(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else if (this.currentGameType === 'fighter') {
      if (titleEl) titleEl.textContent = '⚔️ BLADE DUEL: SAMURAI SHOWDOWN 1v1';
      this.activeGame = new FighterGame(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else if (this.currentGameType === 'snes') {
      if (titleEl) titleEl.textContent = '🕹️ SUPER FAMICOM / SNES CONSOLE (.SFC)';
      this.activeGame = new SnesEmulator(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    } else {
      if (titleEl) titleEl.textContent = '🎮 UNIVERSAL PC GAMEPAD MODE';
      this.activeGame = new GamepadMode(this.gameContainer, onScoreUpdate, onRoundEnd, syncCallback);
    }

    this.activeGame.start();
    this.activeGame.startCountdown?.();
  }

  updateScoreHud() {
    const p1ScoreEl = document.getElementById('p1-score-display');
    const p2ScoreEl = document.getElementById('p2-score-display');
    if (p1ScoreEl) p1ScoreEl.textContent = this.scores[1];
    if (p2ScoreEl) p2ScoreEl.textContent = this.scores[2];
  }

  showVictoryScreen(winnerId) {
    window.sounds?.playVictory();

    if (window.confetti) {
      window.confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    }

    const modal = document.getElementById('victory-modal');
    const winnerBanner = document.getElementById('winner-banner');
    const winnerSub = document.getElementById('winner-sub');

    if (winnerId === 1) {
      if (winnerBanner) {
        winnerBanner.textContent = 'PLAYER 1 WINS!';
        winnerBanner.className = 'font-orbitron font-black text-6xl tracking-wider text-cyan-400 drop-shadow-[0_0_35px_#00f0ff] mb-2';
      }
      if (winnerSub) winnerSub.textContent = 'Joy-Con Cyan Champion!';
    } else {
      if (winnerBanner) {
        winnerBanner.textContent = 'PLAYER 2 WINS!';
        winnerBanner.className = 'font-orbitron font-black text-6xl tracking-wider text-pink-500 drop-shadow-[0_0_35px_#ff0055] mb-2';
      }
      if (winnerSub) winnerSub.textContent = 'Joy-Con Pink Champion!';
    }

    modal?.classList.remove('hidden');

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

window.addEventListener('DOMContentLoaded', () => {
  window.airConsole = new AirConsoleHost();
});
