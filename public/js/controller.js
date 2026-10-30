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
    const lL1 = document.getElementById('label-l1');
    const lR1 = document.getElementById('label-r1');

    if (game === 'kart') {
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
      this.gyroToggleBtn.classList.add('bg-cyan-500/30', 'text-cyan-400', 'border-cyan-400', 'shadow-[0_0_15px_rgba(0,240,255,0.4)]');
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
      this.gyroToggleBtn.classList.remove('bg-cyan-500/30', 'text-cyan-400', 'border-cyan-400', 'shadow-[0_0_15px_rgba(0,240,255,0.4)]');
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

  sendInput() {
    if (!this.isConnected) return;
    let effectiveX = this.input.x;
    // When gyro is active and touch stick is neutral, steer with gyro!
    if (this.gyroEnabled && Math.abs(effectiveX) < 0.1) {
      effectiveX = this.gyroNormalizedSteer;
    }

    this.socket.emit('controller-input', {
      x: effectiveX,
      y: this.input.y,
      btnRT: this.input.btnRT,
      btnLT: this.input.btnLT,
      btnRB: this.input.btnRB,
      btnLB: this.input.btnLB,
      btnA: this.input.btnA,
      btnB: this.input.btnB,
      btnX: this.input.btnX,
      btnY: this.input.btnY,
      select: this.input.select,
      start: this.input.start,
      // Named Aliases
      gas: this.input.btnRT,
      brake: this.input.btnLT,
      boost: this.input.btnA,
      dashLeft: this.input.btnX,
      dashRight: this.input.btnB,
      interact: this.input.btnY,
      respawn: this.input.btnRB,
      lookback: this.input.btnLB,
      pause: this.input.start,
      map: this.input.select,
      // Compatibility
      fire: this.input.btnA || this.input.btnRT,
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
