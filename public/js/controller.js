// 🎮 AIR-JOYCON: Mobile Console Gamepad Engine
// High-frequency, zero-latency touch controls, diamond buttons, haptics & gyro

class MobileGamepad {
  constructor() {
    this.socket = io();
    this.roomCode = null;
    this.playerNumber = null;
    this.isConnected = false;
    this.wakeLock = null;

    // Input state
    this.input = {
      x: 0,
      y: 0,
      btnA: false,
      btnB: false,
      btnX: false,
      btnY: false,
      btnL: false,
      btnR: false,
      tiltX: 0,
      tiltY: 0
    };

    // Gyroscope toggle
    this.gyroEnabled = false;

    // Joystick touch tracking
    this.stickTouchId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.stickRadius = 55;

    this.initElements();
    this.bindSocketEvents();
    this.bindTouchControls();
    this.bindRoomJoinUi();
    this.checkUrlParams();
    this.startPingLoop();
    this.requestWakeLock();
  }

  initElements() {
    this.joinScreen = document.getElementById('join-screen');
    this.gamepadScreen = document.getElementById('gamepad-screen');
    this.roomInput = document.getElementById('room-input');
    this.joinBtn = document.getElementById('join-btn');
    this.joinError = document.getElementById('join-error');

    this.playerBadge = document.getElementById('player-badge');
    this.pingBadge = document.getElementById('ping-badge');
    this.hpBar = document.getElementById('mobile-hp-bar');
    this.hpText = document.getElementById('mobile-hp-text');

    this.stickZone = document.getElementById('joystick-zone');
    this.stickBase = document.getElementById('joystick-base');
    this.stickHandle = document.getElementById('joystick-handle');

    this.btnA = document.getElementById('btn-a');
    this.btnB = document.getElementById('btn-b');
    this.btnX = document.getElementById('btn-x');
    this.btnY = document.getElementById('btn-y');
    this.btnL1 = document.getElementById('btn-l1');
    this.btnR1 = document.getElementById('btn-r1');

    this.gyroToggleBtn = document.getElementById('gyro-toggle-btn');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.rematchModal = document.getElementById('mobile-rematch-modal');
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.roomInput.value = roomParam.toUpperCase();
      this.joinRoom(roomParam.toUpperCase());
    }
  }

  bindRoomJoinUi() {
    this.joinBtn?.addEventListener('click', () => {
      window.sounds?.playClick();
      const code = (this.roomInput.value || '').trim();
      if (!code) {
        this.showError('Please enter a 4-digit room code');
        return;
      }
      this.joinRoom(code);
    });

    this.roomInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinBtn?.click();
    });

    this.fullscreenBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    this.gyroToggleBtn?.addEventListener('click', () => {
      this.toggleGyro();
    });

    document.getElementById('mobile-rematch-btn')?.addEventListener('click', () => {
      this.socket.emit('player-action', { action: 'rematch' });
      this.rematchModal.classList.add('hidden');
    });
  }

  showError(msg) {
    if (this.joinError) {
      this.joinError.textContent = msg;
      this.joinError.classList.remove('hidden');
    }
  }

  joinRoom(code) {
    this.showError('');
    this.socket.emit('join-room', {
      roomCode: code,
      deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone' : 
                  navigator.userAgent.includes('Android') ? 'Android' : 'Joy-Con Controller'
    }, (res) => {
      if (res && res.success) {
        this.playerNumber = res.playerNumber;
        this.roomCode = res.roomCode;
        this.isConnected = true;
        this.setupGamepadView();
      } else {
        this.showError(res ? res.error : 'Connection failed. Check room code on laptop.');
      }
    });
  }

  setupGamepadView() {
    this.joinScreen.classList.add('hidden');
    this.gamepadScreen.classList.remove('hidden');

    if (this.playerNumber === 1) {
      this.playerBadge.textContent = 'JOY-CON 1 [CYAN]';
      this.playerBadge.className = 'px-3 py-1 rounded-full text-xs font-black tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.35)]';
      this.gamepadScreen.style.setProperty('--player-color', '#00f0ff');
    } else {
      this.playerBadge.textContent = 'JOY-CON 2 [PINK]';
      this.playerBadge.className = 'px-3 py-1 rounded-full text-xs font-black tracking-widest bg-pink-500/20 text-pink-400 border border-pink-400/50 shadow-[0_0_15px_rgba(255,0,85,0.35)]';
      this.gamepadScreen.style.setProperty('--player-color', '#ff0055');
    }

    this.triggerHaptic([40, 20, 60]);
    window.sounds?.playJoin();
  }

  bindSocketEvents() {
    this.socket.on('host-sync', ({ type, payload }) => {
      if (type === 'haptic' && payload && payload.pattern) {
        this.triggerHaptic(payload.pattern);
      } else if (type === 'status-sync' && payload) {
        this.updateMobileHud(payload);
      } else if (type === 'game-over') {
        this.showRematchDialog(payload.winnerId);
      } else if (type === 'game-start') {
        this.rematchModal.classList.add('hidden');
        this.adaptButtonLabels(payload.game);
        this.triggerHaptic([30, 30, 60]);
      } else if (type === 'return-lobby') {
        this.rematchModal.classList.add('hidden');
      }
    });

    this.socket.on('host-disconnected', () => {
      alert('The host laptop disconnected.');
      window.location.reload();
    });
  }

  adaptButtonLabels(game) {
    const lA = document.getElementById('label-a');
    const lB = document.getElementById('label-b');
    const lX = document.getElementById('label-x');
    const lY = document.getElementById('label-y');

    if (game === 'kart') {
      if (lA) lA.textContent = 'ACCEL';
      if (lB) lB.textContent = 'BRAKE';
      if (lX) lX.textContent = 'ITEM';
      if (lY) lY.textContent = 'NITRO';
    } else if (game === 'bomb') {
      if (lA) lA.textContent = 'BOMB';
      if (lB) lB.textContent = 'RUN';
      if (lX) lX.textContent = 'PUNCH';
      if (lY) lY.textContent = 'POWER';
    } else if (game === 'tank') {
      if (lA) lA.textContent = 'FIRE';
      if (lB) lB.textContent = 'REV';
      if (lX) lX.textContent = 'SHIELD';
      if (lY) lY.textContent = 'BOOST';
    } else {
      if (lA) lA.textContent = 'A';
      if (lB) lB.textContent = 'B';
      if (lX) lX.textContent = 'X';
      if (lY) lY.textContent = 'Y';
    }
  }

  updateMobileHud({ hp }) {
    if (this.hpBar) this.hpBar.style.width = `${Math.max(0, hp)}%`;
    if (this.hpText) this.hpText.textContent = `${Math.max(0, hp)}%`;
  }

  showRematchDialog(winnerId) {
    const isWinner = winnerId === this.playerNumber;
    const banner = document.getElementById('mobile-winner-text');
    if (banner) {
      banner.textContent = isWinner ? '🏆 VICTORY!' : '💀 DEFEAT';
      banner.className = isWinner ? 'text-4xl font-black text-cyan-400' : 'text-4xl font-black text-slate-400';
    }
    this.rematchModal.classList.remove('hidden');
  }

  triggerHaptic(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  bindTouchControls() {
    // 1. Virtual Analog Thumbstick
    this.stickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.stickTouchId = touch.identifier;

      const rect = this.stickZone.getBoundingClientRect();
      const localX = touch.clientX - rect.left;
      const localY = touch.clientY - rect.top;

      this.stickOrigin = { x: localX, y: localY };
      this.stickBase.style.left = `${localX}px`;
      this.stickBase.style.top = `${localY}px`;
      this.stickBase.classList.remove('hidden');

      this.stickHandle.style.transform = `translate(0px, 0px)`;
      this.triggerHaptic(15);
    }, { passive: false });

    this.stickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.stickTouchId === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.stickTouchId) {
          const rect = this.stickZone.getBoundingClientRect();
          const currentX = touch.clientX - rect.left;
          const currentY = touch.clientY - rect.top;

          const dx = currentX - this.stickOrigin.x;
          const dy = currentY - this.stickOrigin.y;
          const dist = Math.hypot(dx, dy);

          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, this.stickRadius);

          const hx = Math.cos(angle) * clampedDist;
          const hy = Math.sin(angle) * clampedDist;
          this.stickHandle.style.transform = `translate(${hx}px, ${hy}px)`;

          this.input.x = hx / this.stickRadius;
          this.input.y = hy / this.stickRadius;

          this.sendInput();
          break;
        }
      }
    }, { passive: false });

    const endStick = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.stickTouchId) {
          this.stickTouchId = null;
          this.stickBase.classList.add('hidden');
          this.input.x = 0;
          this.input.y = 0;
          this.sendInput();
          break;
        }
      }
    };

    this.stickZone.addEventListener('touchend', endStick, { passive: false });
    this.stickZone.addEventListener('touchcancel', endStick, { passive: false });

    // 2. Action Face Buttons & Bumpers
    const bindBtn = (element, key, hapticLen = 20) => {
      if (!element) return;
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        element.classList.add('scale-90', 'brightness-125');
        this.input[key] = true;
        this.triggerHaptic(hapticLen);
        this.sendInput();
      }, { passive: false });

      const releaseBtn = (e) => {
        e.preventDefault();
        element.classList.remove('scale-90', 'brightness-125');
        this.input[key] = false;
        this.sendInput();
      };

      element.addEventListener('touchend', releaseBtn, { passive: false });
      element.addEventListener('touchcancel', releaseBtn, { passive: false });

      // Mouse fallback
      element.addEventListener('mousedown', () => {
        element.classList.add('scale-90');
        this.input[key] = true;
        this.sendInput();
      });
      window.addEventListener('mouseup', () => {
        element.classList.remove('scale-90');
        if (this.input[key]) {
          this.input[key] = false;
          this.sendInput();
        }
      });
    };

    bindBtn(this.btnA, 'btnA', 25);
    bindBtn(this.btnB, 'btnB', 25);
    bindBtn(this.btnX, 'btnX', 25);
    bindBtn(this.btnY, 'btnY', 25);
    bindBtn(this.btnL1, 'btnL', 30);
    bindBtn(this.btnR1, 'btnR', 30);
  }

  toggleGyro() {
    if (!this.gyroEnabled) {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(res => { if (res === 'granted') this.enableGyro(); })
          .catch(console.error);
      } else {
        this.enableGyro();
      }
    } else {
      this.disableGyro();
    }
  }

  enableGyro() {
    this.gyroEnabled = true;
    this.gyroToggleBtn.classList.add('bg-cyan-500/30', 'text-cyan-400', 'border-cyan-400');
    this.gyroToggleBtn.textContent = '🧭 TILT: ON';

    this.gyroHandler = (e) => {
      const gamma = e.gamma || 0;
      const beta = (e.beta || 0) - 30;
      this.input.tiltX = gamma;
      this.input.tiltY = beta;
      this.sendInput();
    };

    window.addEventListener('deviceorientation', this.gyroHandler);
  }

  disableGyro() {
    this.gyroEnabled = false;
    this.gyroToggleBtn.classList.remove('bg-cyan-500/30', 'text-cyan-400', 'border-cyan-400');
    this.gyroToggleBtn.textContent = '🧭 TILT: OFF';
    if (this.gyroHandler) {
      window.removeEventListener('deviceorientation', this.gyroHandler);
    }
    this.input.tiltX = 0;
    this.input.tiltY = 0;
    this.sendInput();
  }

  sendInput() {
    if (!this.isConnected) return;
    this.socket.emit('controller-input', {
      x: this.input.x,
      y: this.input.y,
      btnA: this.input.btnA,
      btnB: this.input.btnB,
      btnX: this.input.btnX,
      btnY: this.input.btnY,
      btnL: this.input.btnL,
      btnR: this.input.btnR,
      // Compatibility aliases
      fire: this.input.btnA,
      boost: this.input.btnB || this.input.btnY,
      shield: this.input.btnX,
      tiltX: this.input.tiltX,
      tiltY: this.input.tiltY
    });
  }

  startPingLoop() {
    setInterval(() => {
      if (!this.isConnected) return;
      const start = Date.now();
      this.socket.emit('ping-check', start, (timestamp) => {
        const latency = Date.now() - timestamp;
        if (this.pingBadge) {
          this.pingBadge.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full ${latency < 40 ? 'bg-emerald-400' : 'bg-yellow-400'} animate-pulse mr-1"></span>${latency}ms`;
        }
      });
    }, 2000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gamepad = new MobileGamepad();
});
