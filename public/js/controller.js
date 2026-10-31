// 🎮 AIR-JOYCON: Mobile Console Gamepad Engine
// High-frequency, zero-latency touch controls, diamond buttons, haptics & gyro

class MobileGamepad {
  constructor() {
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Render keep-alive heartbeat ping every 15s
    setInterval(() => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('ping-check', Date.now());
      }
    }, 15000);
    this.roomCode = null;
    this.playerNumber = null;
    this.isConnected = false;
    this.wakeLock = null;

    // Input state
    this.input = {
      x: 0,
      y: 0,
      btnRT: false, // Accelerator
      btnLT: false, // Brake / Reverse
      btnRB: false, // Respawn
      btnLB: false, // Look Back
      btnA: false,  // Boost
      btnX: false,  // Dash Left
      btnB: false,  // Dash Right
      btnY: false,  // Interact
      select: false,// Island Map
      start: false, // Pause
      tiltX: 0,
      tiltY: 0
    };

    // Gyroscope toggle & calibration state
    this.gyroEnabled = false;
    this.gyroCenterOffset = 0;
    this.gyroNormalizedSteer = 0;
    this.lastRawAngle = 0;

    // Joystick touch tracking
    this.stickTouchId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.stickRadius = 55;

    // Rate-limiting & zero-lag network buffer
    this.lastInputSentTime = 0;
    this.inputThrottleTimeout = null;

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

    this.btnRT = document.getElementById('btn-rt');
    this.btnLT = document.getElementById('btn-lt');
    this.btnRB = document.getElementById('btn-rb');
    this.btnLB = document.getElementById('btn-lb');
    this.btnA = document.getElementById('btn-a');
    this.btnB = document.getElementById('btn-b');
    this.btnX = document.getElementById('btn-x');
    this.btnY = document.getElementById('btn-y');
    this.btnView = document.getElementById('btn-view');
    this.btnMenu = document.getElementById('btn-menu');

    this.gyroToggleBtn = document.getElementById('gyro-toggle-btn');
    this.gyroStatusLabel = document.getElementById('gyro-status-label');
    this.gyroCalibrateBtn = document.getElementById('gyro-calibrate-btn');
    this.gyroSteeringHud = document.getElementById('gyro-steering-hud');
    this.gyroWheelGraphic = document.getElementById('gyro-wheel-graphic');
    this.gyroAngleDisplay = document.getElementById('gyro-angle-display');
    this.joystickAmbientGuide = document.getElementById('joystick-ambient-guide');

    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.headerFsBtn = document.getElementById('header-fullscreen-btn');
    this.joinFsBtn = document.getElementById('join-fullscreen-btn');
    this.floatingFsPill = document.getElementById('fs-floating-pill');
    this.headerFsLabel = document.getElementById('header-fs-label');
    this.floatingFsLabel = document.getElementById('floating-fs-label');
    this.reconnectToast = document.getElementById('reconnect-toast');
    this.reconnectToastMsg = document.getElementById('reconnect-toast-msg');
    this.rematchModal = document.getElementById('mobile-rematch-modal');

    // Sync fullscreen UI on standard events
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, () => this.updateFullscreenUI());
    });
  }

  enterFullscreen() {
    const el = document.documentElement;
    const rfs = el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitRequestFullScreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (rfs) {
      try {
        const p = rfs.call(el);
        if (p && p.then) {
          p.then(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (e) {}
    }

    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}

    window.scrollTo(0, 1);
    setTimeout(() => {
      window.scrollTo(0, 1);
      this.updateFullscreenUI();
    }, 250);
  }

  exitFullscreen() {
    const doc = document;
    const efs = doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;
    if (efs) {
      try {
        const p = efs.call(doc);
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
    setTimeout(() => this.updateFullscreenUI(), 250);
  }

  toggleFullscreen() {
    const isFs = !!(document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement);

    if (!isFs) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  updateFullscreenUI() {
    const isFs = !!(document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement);

    if (this.floatingFsPill) {
      if (isFs) {
        this.floatingFsPill.classList.add('hidden');
      } else {
        this.floatingFsPill.classList.remove('hidden');
      }
    }
    if (this.headerFsLabel) {
      this.headerFsLabel.textContent = isFs ? 'EXIT FS' : 'FULLSCREEN';
    }
    if (this.fullscreenBtn) {
      this.fullscreenBtn.innerHTML = isFs ? '<span>⛶</span><span>EXIT FS</span>' : '<span>⛶</span><span>FULLSCREEN</span>';
    }
  }

  showToast(msg) {
    if (this.reconnectToast && this.reconnectToastMsg) {
      this.reconnectToastMsg.textContent = msg;
      this.reconnectToast.classList.remove('hidden');
    }
  }

  hideToast() {
    if (this.reconnectToast) {
      this.reconnectToast.classList.add('hidden');
    }
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
    const savedRoom = localStorage.getItem('airconsole_room_code');
    const codeToUse = (roomParam || savedRoom || 'CYBER').toUpperCase();
    if (this.roomInput) {
      this.roomInput.value = codeToUse;
    }
    if (roomParam) {
      this.joinRoom(codeToUse);
    }
  }

  bindRoomJoinUi() {
    const doJoin = () => {
      this.enterFullscreen();
      window.sounds?.playClick();
      const code = (this.roomInput.value || 'CYBER').trim();
      this.joinRoom(code);
    };

    this.joinBtn?.addEventListener('click', doJoin);
    this.joinBtn?.addEventListener('touchstart', () => {
      this.enterFullscreen();
    }, { passive: true });

    this.joinFsBtn?.addEventListener('click', () => {
      this.enterFullscreen();
    });

    this.headerFsBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    this.floatingFsPill?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    this.fullscreenBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    this.roomInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
    });

    this.gyroToggleBtn?.addEventListener('click', () => {
      this.toggleGyro();
    });

    this.gyroCalibrateBtn?.addEventListener('click', () => {
      this.calibrateGyro();
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

  joinRoom(code, preferredSlot = null) {
    this.showError('');
    const roomCodeToJoin = (code || 'CYBER').toUpperCase().trim();
    const targetSlot = preferredSlot || this.playerNumber || parseInt(localStorage.getItem('airconsole_player_slot'), 10) || null;

    this.socket.emit('join-room', {
      roomCode: roomCodeToJoin,
      preferredSlot: targetSlot,
      deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone' : 
                  navigator.userAgent.includes('Android') ? 'Android' : 'Joy-Con Controller'
    }, (res) => {
      if (res && res.success) {
        this.playerNumber = res.playerNumber;
        this.roomCode = res.roomCode;
        this.isConnected = true;
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        try {
          localStorage.setItem('airconsole_room_code', this.roomCode);
          localStorage.setItem('airconsole_player_slot', this.playerNumber);
        } catch (e) {}
        this.hideToast();
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
      this.playerBadge.textContent = 'PLAYER 1 [BLUE]';
      this.playerBadge.className = 'px-3 py-1 rounded-lg text-xs font-bold tracking-wider bg-blue-950 border border-blue-600 text-blue-300 shadow-sm';
      this.gamepadScreen.style.setProperty('--player-color', '#3b82f6');
    } else {
      this.playerBadge.textContent = 'PLAYER 2 [RED]';
      this.playerBadge.className = 'px-3 py-1 rounded-lg text-xs font-bold tracking-wider bg-rose-950 border border-rose-600 text-rose-300 shadow-sm';
      this.gamepadScreen.style.setProperty('--player-color', '#ef4444');
    }

    this.triggerHaptic([40, 20, 60]);
    window.sounds?.playJoin();
  }

  bindSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Socket connected to server');
      this.hideToast();
      const savedRoom = this.roomCode || localStorage.getItem('airconsole_room_code') || 'CYBER';
      const savedSlot = this.playerNumber || parseInt(localStorage.getItem('airconsole_player_slot'), 10) || null;
      if (this.isConnected && savedRoom) {
        console.log(`Auto re-joining persistent room ${savedRoom} slot ${savedSlot}...`);
        this.showToast(`Re-joining Room ${savedRoom}...`);
        this.joinRoom(savedRoom, savedSlot);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      this.showToast('Reconnecting to Host screen...');
      if (this.playerBadge) {
        this.playerBadge.textContent = 'RECONNECTING...';
        this.playerBadge.className = 'px-3 py-1 rounded-lg text-xs font-bold tracking-wider bg-yellow-950 border border-yellow-600 text-yellow-300 shadow-sm';
      }
    });

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
      console.warn('Host laptop temporarily disconnected');
      this.showToast(`Host laptop offline. Holding room ${this.roomCode || 'CYBER'}...`);
      if (this.playerBadge) {
        this.playerBadge.textContent = 'WAITING FOR HOST...';
        this.playerBadge.className = 'px-3 py-1 rounded-lg text-xs font-bold tracking-wider bg-yellow-950 border border-yellow-600 text-yellow-300 shadow-sm';
      }
      if (this.reconnectInterval) clearInterval(this.reconnectInterval);
      this.reconnectInterval = setInterval(() => {
        if (this.roomCode) {
          this.joinRoom(this.roomCode, this.playerNumber);
        }
      }, 2500);
    });
  }

  adaptButtonLabels(game) {
    const lA = document.getElementById('label-a');
    const lB = document.getElementById('label-b');
    const lX = document.getElementById('label-x');
    const lY = document.getElementById('label-y');
    const lL1 = document.getElementById('label-l1');
    const lR1 = document.getElementById('label-r1');

    this.currentGame = game;

    if (game === 'fighter') {
      // Fighting game: Disable gyro tilt completely, use only joystick/buttons!
      this.gyroEnabled = false;
      if (this.gyroToggleBtn) this.gyroToggleBtn.classList.add('hidden');
      const gyroHud = document.getElementById('gyro-steering-hud');
      if (gyroHud) gyroHud.classList.add('hidden');
      if (lA) lA.textContent = 'SLASH';
      if (lB) lB.textContent = 'JUMP';
      if (lX) lX.textContent = 'SHURIKEN';
      if (lY) lY.textContent = 'HEAVY';
      if (lL1) lL1.textContent = 'DODGE';
      if (lR1) lR1.textContent = 'SLASH';
    } else if (game === 'kart') {
      if (lA) lA.textContent = 'ACCEL';
      if (lB) lB.textContent = 'BRAKE';
      if (lX) lX.textContent = 'ITEM';
      if (lY) lY.textContent = 'NITRO';
      if (lL1) lL1.textContent = 'NITRO';
      if (lR1) lR1.textContent = 'ITEM';
    } else if (game === 'hotwheels') {
      if (lA) lA.textContent = 'GAS';
      if (lB) lB.textContent = 'BRAKE';
      if (lX) lX.textContent = 'DRIFT';
      if (lY) lY.textContent = 'NITRO';
      if (lL1) lL1.textContent = 'RESPAWN';
      if (lR1) lR1.textContent = 'NITRO';
    } else if (game === 'bomb') {
      if (lA) lA.textContent = 'BOMB';
      if (lB) lB.textContent = 'RUN';
      if (lX) lX.textContent = 'PUNCH';
      if (lY) lY.textContent = 'POWER';
      if (lL1) lL1.textContent = 'BOMB';
      if (lR1) lR1.textContent = 'PUNCH';
    } else if (game === 'tank') {
      if (lA) lA.textContent = 'FIRE';
      if (lB) lB.textContent = 'REV';
      if (lX) lX.textContent = 'SHIELD';
      if (lY) lY.textContent = 'BOOST';
      if (lL1) lL1.textContent = 'SHIELD';
      if (lR1) lR1.textContent = 'FIRE';
    } else {
      if (lA) lA.textContent = 'A';
      if (lB) lB.textContent = 'B';
      if (lX) lX.textContent = 'X';
      if (lY) lY.textContent = 'Y';
      if (lL1) lL1.textContent = 'L1';
      if (lR1) lR1.textContent = 'R1';
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
      banner.className = isWinner ? 'text-4xl font-black text-emerald-400' : 'text-4xl font-black text-slate-400';
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

          // Throttle continuous touchmove to 30ms to prevent buffer buildup on Render
          this.sendInput(false);
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
          // Send immediately on stick release so player stops instantly
          this.sendInput(true);
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
        // Immediate send: Zero latency on button down!
        this.sendInput(true);
      }, { passive: false });

      const releaseBtn = (e) => {
        e.preventDefault();
        element.classList.remove('scale-90', 'brightness-125');
        this.input[key] = false;
        // Immediate send on button release
        this.sendInput(true);
      };

      element.addEventListener('touchend', releaseBtn, { passive: false });
      element.addEventListener('touchcancel', releaseBtn, { passive: false });

      // Mouse fallback
      element.addEventListener('mousedown', () => {
        element.classList.add('scale-90');
        this.input[key] = true;
        this.sendInput(true);
      });
      window.addEventListener('mouseup', () => {
        element.classList.remove('scale-90');
        if (this.input[key]) {
          this.input[key] = false;
          this.sendInput(true);
        }
      });
    };

    // Xbox Layout Controls
    bindBtn(this.btnRT, 'btnRT', 35); // Accelerator (RT)
    bindBtn(this.btnLT, 'btnLT', 35); // Brake / Reverse (LT)
    bindBtn(this.btnRB, 'btnRB', 30); // Respawn (RB)
    bindBtn(this.btnLB, 'btnLB', 30); // Look Back (LB)
    bindBtn(this.btnA, 'btnA', 30);   // Boost (A)
    bindBtn(this.btnX, 'btnX', 25);   // Dash Left (X)
    bindBtn(this.btnB, 'btnB', 25);   // Dash Right (B)
    bindBtn(this.btnY, 'btnY', 25);   // Interact (Y)
    bindBtn(this.btnView, 'select', 25); // Island Map (View)
    bindBtn(this.btnMenu, 'start', 25);  // Pause (Menu)
  }

  showSecureContextNotice() {
    if (window.isSecureContext === false && location.protocol !== 'https:' && location.hostname !== 'localhost') {
      const existing = document.getElementById('https-secure-notice');
      if (existing) return;
      const notice = document.createElement('div');
      notice.id = 'https-secure-notice';
      notice.className = 'fixed top-16 left-4 right-4 z-50 p-3 rounded-2xl bg-gradient-to-r from-amber-950/95 to-slate-900/95 border-2 border-amber-400 text-slate-100 shadow-[0_0_25px_rgba(255,180,0,0.4)] flex flex-col gap-2 font-mono text-xs';
      notice.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2 text-amber-400 font-bold font-orbitron">
            <span>⚠️</span> <span>HTTPS NEEDED FOR TILT GYRO</span>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-white px-2 py-0.5 text-sm cursor-pointer">✕</button>
        </div>
        <p class="text-[11px] text-slate-300">
          Mobile Chrome & Safari block motion sensors over raw Wi-Fi IP (<code>http://</code>).
        </p>
        <div class="flex items-center gap-2 pt-1">
          <a href="https://air-console-3d.onrender.com" target="_blank" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black font-orbitron text-[10px] tracking-wider text-center flex-1 shadow">
            OPEN HTTPS SERVER ⚡
          </a>
          <button onclick="this.parentElement.parentElement.remove()" class="px-3 py-1.5 rounded-xl bg-slate-800 border border-white/20 text-slate-200 text-[10px] font-bold">
            USE TOUCH STEERING
          </button>
        </div>
      `;
      document.body.appendChild(notice);
    }
  }

  toggleGyro() {
    if (!this.gyroEnabled) {
      this.showSecureContextNotice();
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(res => {
            if (res === 'granted') {
              this.enableGyro();
            } else {
              alert('Motion permission denied. You can still steer by touching the wheel or joystick!');
              this.enableGyro(); // Fallback to touch steering wheel
            }
          })
          .catch((err) => {
            console.warn('DeviceOrientation permission catch:', err);
            this.enableGyro();
          });
      } else {
        this.enableGyro();
      }
    } else {
      this.disableGyro();
    }
  }

  enableGyro() {
    this.gyroEnabled = true;
    this.gyroCenterOffset = 0;
    this.gyroNormalizedSteer = 0;

    if (this.gyroToggleBtn) {
      this.gyroToggleBtn.classList.add('bg-blue-600/30', 'text-blue-300', 'border-blue-500');
      this.gyroToggleBtn.classList.remove('bg-slate-900', 'text-slate-300', 'border-white/20');
    }
    if (this.gyroStatusLabel) this.gyroStatusLabel.textContent = 'WHEEL: ON';
    if (this.gyroCalibrateBtn) this.gyroCalibrateBtn.classList.remove('hidden');
    if (this.gyroSteeringHud) this.gyroSteeringHud.classList.remove('hidden');
    if (this.joystickAmbientGuide) this.joystickAmbientGuide.classList.add('hidden');

    this.triggerHaptic([40, 20, 60]);

    // Primary: DeviceOrientation (e.beta / e.gamma)
    this.gyroHandler = (e) => {
      this.handleOrientation(e);
    };

    // Fallback: DeviceMotion (e.accelerationIncludingGravity)
    this.motionHandler = (e) => {
      if (this.hasReceivedOrientation) return; // Orientation is already working
      const acc = e.accelerationIncludingGravity;
      if (acc && (typeof acc.x === 'number' || typeof acc.y === 'number')) {
        const orientationAngle = window.screen?.orientation?.angle ?? (window.orientation || 0);
        let rawAngle = 0;
        if (orientationAngle === 90) {
          rawAngle = (acc.y || 0) * 8.0;
        } else if (orientationAngle === -90 || orientationAngle === 270) {
          rawAngle = -(acc.y || 0) * 8.0;
        } else {
          rawAngle = (acc.x || 0) * 8.0;
        }
        this.processSteerAngle(rawAngle);
      }
    };

    window.addEventListener('deviceorientation', this.gyroHandler, true);
    window.addEventListener('devicemotion', this.motionHandler, true);

    // Initialize interactive touch-to-steer wheel
    this.bindTouchSteeringWheel();
  }

  bindTouchSteeringWheel() {
    if (!this.gyroWheelGraphic || this.hasBoundWheelTouch) return;
    this.hasBoundWheelTouch = true;

    let isTouchingWheel = false;
    let wheelCenter = { x: 0, y: 0 };

    const startTouch = (e) => {
      isTouchingWheel = true;
      const rect = this.gyroWheelGraphic.getBoundingClientRect();
      wheelCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      moveTouch(e);
    };

    const moveTouch = (e) => {
      if (!isTouchingWheel) return;
      const touch = e.touches ? e.touches[0] : e;
      const dx = touch.clientX - wheelCenter.x;
      const dy = touch.clientY - wheelCenter.y;
      
      // Calculate angle from 12 o'clock (-90 deg)
      let angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
      if (angleDeg > 180) angleDeg -= 360;
      if (angleDeg < -180) angleDeg += 360;

      // Clamp between -60 and +60 deg for driving
      const clamped = Math.max(-180, Math.min(180, angleDeg));
      this.processSteerAngle(clamped);
    };

    const endTouch = () => {
      if (!isTouchingWheel) return;
      isTouchingWheel = false;
      // Spring back to center
      this.processSteerAngle(0);
    };

    this.gyroWheelGraphic.addEventListener('touchstart', startTouch, { passive: false });
    window.addEventListener('touchmove', moveTouch, { passive: true });
    window.addEventListener('touchend', endTouch, { passive: true });
    window.addEventListener('touchcancel', endTouch, { passive: true });
  }

  disableGyro() {
    this.gyroEnabled = false;
    this.gyroNormalizedSteer = 0;

    if (this.gyroToggleBtn) {
      this.gyroToggleBtn.classList.remove('bg-blue-600/30', 'text-blue-300', 'border-blue-500');
      this.gyroToggleBtn.classList.add('bg-slate-900', 'text-slate-300', 'border-white/20');
    }
    if (this.gyroStatusLabel) this.gyroStatusLabel.textContent = 'WHEEL: OFF';
    if (this.gyroCalibrateBtn) this.gyroCalibrateBtn.classList.add('hidden');
    if (this.gyroSteeringHud) this.gyroSteeringHud.classList.add('hidden');
    if (this.joystickAmbientGuide) this.joystickAmbientGuide.classList.remove('hidden');

    if (this.gyroHandler) {
      window.removeEventListener('deviceorientation', this.gyroHandler, true);
    }
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler, true);
    }
    this.input.tiltX = 0;
    this.input.tiltY = 0;
    this.sendInput();
  }

  calibrateGyro() {
    this.gyroCenterOffset = this.lastRawAngle;
    this.triggerHaptic([30, 30]);
    if (this.gyroAngleDisplay) {
      this.gyroAngleDisplay.textContent = '0° [RE-CENTERED]';
    }
  }

  handleOrientation(e) {
    if (!this.gyroEnabled) return;
    if (e.beta !== null && e.beta !== undefined && e.gamma !== null && e.gamma !== undefined) {
      this.hasReceivedOrientation = true;
    }

    const orientationAngle = window.screen?.orientation?.angle ?? (window.orientation || 0);
    let rawAngle = 0;
    if (orientationAngle === 90) {
      rawAngle = (e.beta || 0);
    } else if (orientationAngle === -90 || orientationAngle === 270) {
      rawAngle = -(e.beta || 0);
    } else if (orientationAngle === 180) {
      rawAngle = -(e.gamma || 0);
    } else {
      rawAngle = (e.gamma || 0);
    }

    this.processSteerAngle(rawAngle);
  }

  processSteerAngle(rawAngle) {
    this.lastRawAngle = rawAngle;
    const calibratedAngle = rawAngle - this.gyroCenterOffset;

    const deadzone = 2.0;
    let normalizedSteer = 0;
    if (Math.abs(calibratedAngle) > deadzone) {
      const sign = Math.sign(calibratedAngle);
      // Fluid scaling: 60 deg = full lock
      const mag = (Math.abs(calibratedAngle) - deadzone) / 55.0;
      normalizedSteer = sign * Math.min(1.0, Math.max(0, mag));
    }

    this.input.tiltX = calibratedAngle;
    this.gyroNormalizedSteer = normalizedSteer;

    // Full 1:1 steering rotation
    if (this.gyroWheelGraphic) {
      this.gyroWheelGraphic.style.transform = `rotate(${calibratedAngle}deg)`;
    }
    if (this.gyroAngleDisplay) {
      const rounded = Math.round(calibratedAngle);
      const dir = rounded > 2 ? 'RIGHT' : rounded < -2 ? 'LEFT' : 'CENTER';
      this.gyroAngleDisplay.textContent = `${rounded > 0 ? '+' : ''}${rounded}° [${dir}]`;
    }

    this.sendInput();
  }

  sendInput(immediate = false) {
    if (!this.isConnected) return;

    const now = performance.now();
    // For continuous analog movement (touchmove), throttle to 30ms (~33 updates/sec)
    // For critical button actions (Attack, Jump, Slash), send immediately!
    if (!immediate && (now - this.lastInputSentTime < 30)) {
      if (!this.inputThrottleTimeout) {
        this.inputThrottleTimeout = setTimeout(() => {
          this.inputThrottleTimeout = null;
          this.sendInput(true);
        }, 30 - (now - this.lastInputSentTime));
      }
      return;
    }

    if (this.inputThrottleTimeout) {
      clearTimeout(this.inputThrottleTimeout);
      this.inputThrottleTimeout = null;
    }
    this.lastInputSentTime = now;

    let effectiveX = this.input.x;
    if (this.gyroEnabled && this.currentGame !== 'fighter' && Math.abs(effectiveX) < 0.1) {
      effectiveX = this.gyroNormalizedSteer;
    }

    const gasPressed = !!(this.input.btnRT || this.input.btnA || (typeof this.input.y === 'number' && this.input.y < -0.3));
    const brakePressed = !!(this.input.btnLT || this.input.btnB || (typeof this.input.y === 'number' && this.input.y > 0.3));
    const boostPressed = !!(this.input.btnY || this.input.btnX || this.input.btnRB);
    const respawnPressed = !!(this.input.btnLB || this.input.select);

    // High-speed, robust payload
    const payload = {
      x: Math.round(effectiveX * 100) / 100,
      y: Math.round(this.input.y * 100) / 100,
      btnA: !!this.input.btnA,
      btnB: !!this.input.btnB,
      btnX: !!this.input.btnX,
      btnY: !!this.input.btnY,
      btnRT: !!this.input.btnRT,
      btnLT: !!this.input.btnLT,
      btnRB: !!this.input.btnRB,
      btnLB: !!this.input.btnLB,
      gas: gasPressed,
      brake: brakePressed,
      boost: boostPressed,
      respawn: respawnPressed,
      tiltX: typeof this.lastRawAngle === 'number' ? Math.round(this.lastRawAngle * 10) / 10 : 0,
      fire: !!(this.input.btnA || this.input.btnRT),
      jump: !!this.input.btnB
    };

    // Use volatile emit if available: Discards stale queued packets during network spikes!
    if (this.socket.volatile) {
      this.socket.volatile.emit('controller-input', payload);
    } else {
      this.socket.emit('controller-input', payload);
    }
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
