// 🏎️ HOT WHEELS RACING CONSOLE CONTROLLER ENGINE
// Turns 2 mobile phones into ergonomic racing wheels & pedals for Hot Wheels Unleashed!

export class HotWheelsMode {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.syncToMobile = syncToMobile;

    this.inputs = {
      1: { steer: 0, gas: false, brake: false, boost: false, respawn: false, pause: false },
      2: { steer: 0, gas: false, brake: false, boost: false, respawn: false, pause: false }
    };

    // Hot Wheels default keyboard bindings for PC
    this.keyMap = {
      1: {
        steerLeft: 'KeyA',
        steerRight: 'KeyD',
        gas: 'KeyW',
        brake: 'KeyS',
        boost: 'Space',
        respawn: 'KeyR',
        pause: 'Escape'
      },
      2: {
        steerLeft: 'ArrowLeft',
        steerRight: 'ArrowRight',
        gas: 'ArrowUp',
        brake: 'ArrowDown',
        boost: 'Enter',
        respawn: 'Numpad0',
        pause: 'Backspace'
      }
    };

    this.activeKeys = new Set();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full p-6 items-center justify-between text-slate-100 overflow-y-auto">
        <!-- Top Title Bar -->
        <div class="w-full max-w-4xl flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <span class="text-3xl animate-bounce">🏎️</span>
            <div>
              <h2 class="font-orbitron font-black text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-300 to-red-500">
                HOT WHEELS UNLEASHED CONSOLE HUB
              </h2>
              <p class="text-xs font-mono text-slate-400">2-Player Mobile Steering Wheels & Pedals for Split-Screen PC Racing</p>
            </div>
          </div>
          <button onclick="window.airConsole?.returnToLobby()" class="px-4 py-1.5 rounded-xl bg-slate-900 border border-white/20 hover:border-orange-400 text-xs font-mono text-slate-300 hover:text-white transition cursor-pointer">
            ✕ RETURN TO ARCADE MENU
          </button>
        </div>

        <!-- Live Racing Dashboard Visualizer -->
        <div class="grid grid-cols-2 gap-6 w-full max-w-4xl my-auto">
          <!-- Player 1 Hot Wheels Dash -->
          <div class="cyber-card p-6 rounded-3xl border-2 border-cyan-400/50 bg-slate-900/80 flex flex-col items-center shadow-[0_0_30px_rgba(0,240,255,0.25)]">
            <div class="flex items-center justify-between w-full mb-3">
              <span class="font-orbitron text-xs font-black text-cyan-400 tracking-wider">PLAYER 1 [BLUE RACER]</span>
              <div class="flex items-center gap-2">
                <span id="hw-p1-gyro-badge" class="hidden px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-400 text-slate-950 font-black shadow-[0_0_10px_#00f0ff] animate-pulse">🧭 GYRO: 0°</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">SPLIT-SCREEN P1</span>
              </div>
            </div>

            <!-- Virtual Steering Wheel & Pedals Gauge -->
            <div class="relative w-full h-44 bg-slate-950 border border-cyan-500/30 rounded-2xl p-4 flex items-center justify-around shadow-inner">
              <!-- Steering Wheel Visual -->
              <div class="flex flex-col items-center">
                <div id="hw-p1-wheel" class="w-24 h-24 rounded-full border-4 border-cyan-400 flex items-center justify-center transition-transform duration-75 relative shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                  <div class="w-16 h-2 bg-cyan-400 rounded-full"></div>
                  <div class="absolute top-1 w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_6px_#ffeb3b]"></div>
                </div>
                <span class="text-[10px] font-mono text-slate-400 mt-2 font-bold">STEERING (A/D or TILT)</span>
              </div>

              <!-- Pedals & Nitro Visual -->
              <div class="flex gap-3 items-end">
                <!-- Brake Pedal -->
                <div id="hw-p1-brake" class="w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-500 flex flex-col items-center justify-end pb-2 transition-all">
                  <span class="text-[9px] font-black font-orbitron text-rose-400">BRAKE</span>
                </div>
                <!-- Gas Pedal -->
                <div id="hw-p1-gas" class="w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-400 flex flex-col items-center justify-end pb-2 transition-all">
                  <span class="text-[9px] font-black font-orbitron text-emerald-400">GAS</span>
                </div>
                <!-- Nitro Flame -->
                <div id="hw-p1-boost" class="w-12 h-16 rounded-xl bg-slate-900 border-2 border-orange-400 flex flex-col items-center justify-center transition-all text-xl">
                  🔥
                </div>
              </div>
            </div>

            <div class="mt-3 text-[11px] font-mono text-slate-400 text-center">
              Keys: <b class="text-cyan-300">W (Gas)</b> | <b class="text-rose-400">S (Brake)</b> | <b class="text-yellow-400">A/D (Steer)</b> | <b class="text-orange-400">Space (Boost)</b>
            </div>
          </div>

          <!-- Player 2 Hot Wheels Dash -->
          <div class="cyber-card p-6 rounded-3xl border-2 border-pink-500/50 bg-slate-900/80 flex flex-col items-center shadow-[0_0_30px_rgba(255,0,85,0.25)]">
            <div class="flex items-center justify-between w-full mb-3">
              <span class="font-orbitron text-xs font-black text-pink-400 tracking-wider">PLAYER 2 [RED RACER]</span>
              <div class="flex items-center gap-2">
                <span id="hw-p2-gyro-badge" class="hidden px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500 text-white font-black shadow-[0_0_10px_#ff0055] animate-pulse">🧭 GYRO: 0°</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500/20 text-pink-300 border border-pink-400/40">SPLIT-SCREEN P2</span>
              </div>
            </div>

            <!-- Virtual Steering Wheel & Pedals Gauge -->
            <div class="relative w-full h-44 bg-slate-950 border border-pink-500/30 rounded-2xl p-4 flex items-center justify-around shadow-inner">
              <!-- Steering Wheel Visual -->
              <div class="flex flex-col items-center">
                <div id="hw-p2-wheel" class="w-24 h-24 rounded-full border-4 border-pink-500 flex items-center justify-center transition-transform duration-75 relative shadow-[0_0_20px_rgba(255,0,85,0.3)]">
                  <div class="w-16 h-2 bg-pink-500 rounded-full"></div>
                  <div class="absolute top-1 w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_6px_#ffeb3b]"></div>
                </div>
                <span class="text-[10px] font-mono text-slate-400 mt-2 font-bold">STEERING (ARROWS or TILT)</span>
              </div>

              <!-- Pedals & Nitro Visual -->
              <div class="flex gap-3 items-end">
                <!-- Brake Pedal -->
                <div id="hw-p2-brake" class="w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-500 flex flex-col items-center justify-end pb-2 transition-all">
                  <span class="text-[9px] font-black font-orbitron text-rose-400">BRAKE</span>
                </div>
                <!-- Gas Pedal -->
                <div id="hw-p2-gas" class="w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-400 flex flex-col items-center justify-end pb-2 transition-all">
                  <span class="text-[9px] font-black font-orbitron text-emerald-400">GAS</span>
                </div>
                <!-- Nitro Flame -->
                <div id="hw-p2-boost" class="w-12 h-16 rounded-xl bg-slate-900 border-2 border-orange-400 flex flex-col items-center justify-center transition-all text-xl">
                  🔥
                </div>
              </div>
            </div>

            <div class="mt-3 text-[11px] font-mono text-slate-400 text-center">
              Keys: <b class="text-pink-300">Up (Gas)</b> | <b class="text-rose-400">Down (Brake)</b> | <b class="text-yellow-400">Left/Right</b> | <b class="text-orange-400">Enter (Boost)</b>
            </div>
          </div>
        </div>

        <!-- 3-Step Setup Guide for Hot Wheels Unleashed -->
        <div class="w-full max-w-4xl bg-gradient-to-r from-orange-950/60 via-slate-900/90 to-red-950/60 border border-orange-500/40 rounded-2xl p-4 flex items-center justify-between text-xs font-mono shadow-[0_0_25px_rgba(255,102,0,0.15)]">
          <div class="space-y-1">
            <p class="font-bold text-orange-400 flex items-center gap-1.5">
              <span>🏁</span> HOW TO PLAY HOT WHEELS IN 2-PLAYER SPLIT-SCREEN:
            </p>
            <p class="text-slate-300">1. Launch <b class="text-white">Hot Wheels Unleashed</b> on your laptop.</p>
            <p class="text-slate-300">2. Go to <b class="text-white">Quick Modes → Split Screen</b> from the main menu.</p>
            <p class="text-slate-300">3. Player 1 taps <b class="text-emerald-400">[GAS]</b> on Phone 1, and Player 2 taps <b class="text-emerald-400">[GAS]</b> on Phone 2 to join the race!</p>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-400 text-orange-300 font-bold">
              ✓ 2-PHONE RACING ENGINE ACTIVE
            </span>
            <p class="text-[10px] text-slate-400 mt-1">Tap pedals on phone to test!</p>
          </div>
        </div>
      </div>
    `;
  }

  handlePlayerInput(playerNumber, input) {
    const km = this.keyMap[playerNumber];
    if (!km) return;

    // Steering: Joystick X or Phone Gyro/Tilt
    let steer = 0;
    if (typeof input.x === 'number' && Math.abs(input.x) > 0.05) {
      steer = input.x;
    } else if (typeof input.tiltX === 'number' && Math.abs(input.tiltX) > 2) {
      steer = Math.max(-1, Math.min(1, input.tiltX / 28));
    }

    // Update live gyro badge if active
    const gyroBadge = document.getElementById(`hw-p${playerNumber}-gyro-badge`);
    if (gyroBadge) {
      if (typeof input.tiltX === 'number' && Math.abs(input.tiltX) > 1.5) {
        gyroBadge.classList.remove('hidden');
        const deg = Math.round(input.tiltX);
        gyroBadge.textContent = `🧭 GYRO: ${deg > 0 ? '+' : ''}${deg}°`;
      }
    }

    const steerLeft = steer < -0.25;
    const steerRight = steer > 0.25;

    // Pedals & Nitro
    const gas = !!(input.btnA || input.gas || input.fire);
    const brake = !!(input.btnB || input.brake);
    const boost = !!(input.btnY || input.boost || input.btnR || input.btnR1);
    const respawn = !!(input.btnX || input.respawn || input.btnL || input.btnL1);
    const pause = !!(input.start || input.select);

    // Audio feedback on laptop speakers
    if (boost && !this.inputs[playerNumber].boost) {
      window.sounds?.playBoost?.();
    }

    this.inputs[playerNumber] = { steer, gas, brake, boost, respawn, pause };

    // Dispatch Keyboard events for laptop
    this.dispatchKey(km.steerLeft, steerLeft);
    this.dispatchKey(km.steerRight, steerRight);
    this.dispatchKey(km.gas, gas);
    this.dispatchKey(km.brake, brake);
    this.dispatchKey(km.boost, boost);
    this.dispatchKey(km.respawn, respawn);
    this.dispatchKey(km.pause, pause);

    // Update Dashboard Visuals
    const wheel = document.getElementById(`hw-p${playerNumber}-wheel`);
    if (wheel) {
      wheel.style.transform = `rotate(${steer * 65}deg)`;
    }

    const setHighlight = (id, active, activeClass, inactiveClass) => {
      const el = document.getElementById(id);
      if (el) {
        el.className = active ? activeClass : inactiveClass;
      }
    };

    setHighlight(
      `hw-p${playerNumber}-gas`,
      gas,
      'w-11 h-24 rounded-xl bg-emerald-500 text-black border-2 border-white flex flex-col items-center justify-end pb-2 scale-95 shadow-[0_0_20px_#00ff88]',
      'w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-400 flex flex-col items-center justify-end pb-2 transition-all'
    );

    setHighlight(
      `hw-p${playerNumber}-brake`,
      brake,
      'w-11 h-20 rounded-xl bg-rose-500 text-white border-2 border-white flex flex-col items-center justify-end pb-2 scale-95 shadow-[0_0_20px_#ff0055]',
      'w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-500 flex flex-col items-center justify-end pb-2 transition-all'
    );

    setHighlight(
      `hw-p${playerNumber}-boost`,
      boost,
      'w-12 h-16 rounded-xl bg-orange-500 text-white border-2 border-white flex flex-col items-center justify-center scale-110 shadow-[0_0_25px_#ff7700] text-2xl',
      'w-12 h-16 rounded-xl bg-slate-900 border-2 border-orange-400 flex flex-col items-center justify-center transition-all text-xl'
    );
  }

  dispatchKey(code, isPressed) {
    if (!code) return;
    if (isPressed && !this.activeKeys.has(code)) {
      this.activeKeys.add(code);
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    } else if (!isPressed && this.activeKeys.has(code)) {
      this.activeKeys.delete(code);
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    }
  }

  start() {}
  startCountdown(cb) { if (cb) cb(); }
  stop() {
    this.activeKeys.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    });
    this.activeKeys.clear();
  }
}
