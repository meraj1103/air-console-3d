// 🏎️ HOT WHEELS RACING CONSOLE CONTROLLER ENGINE
// Turns 2 mobile phones into ergonomic racing wheels & pedals for Hot Wheels Unleashed & in-console car simulation!

export class HotWheelsMode {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.syncToMobile = syncToMobile;

    this.carState = {
      1: { steer: 0, gas: false, brake: false, boost: false, respawn: false, speed: 0, rpm: 900, gear: 'N' },
      2: { steer: 0, gas: false, brake: false, boost: false, respawn: false, speed: 0, rpm: 900, gear: 'N' }
    };

    // Keyboard bindings for PC DirectX / In-browser games
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
    this.animId = null;
    this.render();
    this.startSimulationLoop();
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full p-6 items-center justify-between text-slate-100 overflow-y-auto bg-[#0a0d14]">
        <!-- Top Title Bar -->
        <div class="w-full max-w-5xl flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🏎️</span>
            <div>
              <h2 class="font-orbitron font-black text-2xl tracking-wider text-white">
                HOT WHEELS CAR CONTROL CONSOLE
              </h2>
              <p class="text-xs font-mono text-slate-400">2-Player Mobile Steering Wheels & Pedals for Console & Split-Screen PC Racing</p>
            </div>
          </div>
          <button onclick="window.airConsole?.returnToLobby()" class="px-4 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-mono text-slate-300 hover:text-white transition cursor-pointer">
            ✕ RETURN TO CONSOLE MENU
          </button>
        </div>

        <!-- Live Racing Dashboard Visualizer -->
        <div class="grid grid-cols-2 gap-6 w-full max-w-5xl my-auto">
          <!-- Player 1 Hot Wheels Dash (Blue) -->
          <div class="cyber-card p-6 rounded-3xl border border-blue-600/50 bg-slate-900/90 flex flex-col items-center">
            <div class="flex items-center justify-between w-full mb-3">
              <span class="font-orbitron text-xs font-black text-blue-400 tracking-wider">PLAYER 1 [BLUE RACER]</span>
              <div class="flex items-center gap-2">
                <span id="hw-p1-gyro-badge" class="hidden px-2 py-0.5 rounded text-[10px] font-mono bg-blue-600 text-white font-bold">🧭 GYRO: 0°</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-900/40 text-blue-300 border border-blue-600/40">SLOT: P1</span>
              </div>
            </div>

            <!-- Virtual Cockpit & Telemetry -->
            <div class="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
              <!-- Top Gauges: Speedometer, Gear, RPM -->
              <div class="flex items-center justify-between px-2">
                <!-- Speedometer -->
                <div class="flex flex-col">
                  <span class="text-[10px] font-mono text-slate-400">SPEED</span>
                  <div class="flex items-baseline gap-1">
                    <span id="hw-p1-speed" class="font-orbitron text-3xl font-black text-white">0</span>
                    <span class="text-[10px] font-mono text-slate-400">MPH</span>
                  </div>
                </div>

                <!-- Gear & Status -->
                <div class="flex flex-col items-center">
                  <span class="text-[10px] font-mono text-slate-400">GEAR</span>
                  <span id="hw-p1-gear" class="font-orbitron text-2xl font-black text-emerald-400">N</span>
                </div>

                <!-- RPM Meter -->
                <div class="flex flex-col items-end">
                  <span class="text-[10px] font-mono text-slate-400">ENGINE RPM</span>
                  <div class="flex items-baseline gap-1">
                    <span id="hw-p1-rpm" class="font-orbitron text-xl font-bold text-slate-200">900</span>
                    <span class="text-[10px] font-mono text-slate-400">RPM</span>
                  </div>
                </div>
              </div>

              <!-- RPM Bar -->
              <div class="w-full bg-slate-900 rounded-full h-2 p-0.5 border border-slate-800 overflow-hidden">
                <div id="hw-p1-rpm-bar" class="bg-blue-500 h-full rounded-full transition-all duration-75 w-[12%]"></div>
              </div>

              <!-- Steering Wheel & Pedals -->
              <div class="flex items-center justify-around pt-2">
                <!-- Steering Wheel -->
                <div class="flex flex-col items-center">
                  <div id="hw-p1-wheel" class="w-24 h-24 rounded-full border-4 border-blue-500 bg-slate-900/80 flex items-center justify-center transition-transform duration-75 relative">
                    <div class="w-16 h-2 bg-blue-500 rounded-full"></div>
                    <div class="absolute top-1 w-3 h-3 rounded-full bg-yellow-400"></div>
                  </div>
                  <span id="hw-p1-steer-label" class="text-[10px] font-mono text-slate-400 mt-2 font-bold">STEER: 0° [CENTER]</span>
                </div>

                <!-- Pedals & Nitro -->
                <div class="flex gap-3 items-end">
                  <!-- Brake Pedal -->
                  <div id="hw-p1-brake" class="w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-600 flex flex-col items-center justify-end pb-2 transition-all">
                    <span class="text-[9px] font-black font-orbitron text-rose-400">BRAKE</span>
                  </div>
                  <!-- Gas Pedal -->
                  <div id="hw-p1-gas" class="w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-500 flex flex-col items-center justify-end pb-2 transition-all">
                    <span class="text-[9px] font-black font-orbitron text-emerald-400">GAS</span>
                  </div>
                  <!-- Nitro Boost -->
                  <div id="hw-p1-boost" class="w-12 h-16 rounded-xl bg-slate-900 border-2 border-amber-500 flex flex-col items-center justify-center transition-all text-xl">
                    🔥
                  </div>
                </div>
              </div>
            </div>

            <!-- Live Phone Input Telemetry -->
            <div id="hw-p1-debug" class="mt-3 text-[10px] font-mono text-slate-400 text-center bg-slate-950/60 rounded-lg px-3 py-1.5 w-full border border-slate-800">
              Inputs: <span class="text-slate-300">GAS [A/RT]</span> | <span class="text-slate-300">BRAKE [B/LT]</span> | <span class="text-slate-300">STEER [Stick/Tilt]</span> | <span class="text-slate-300">BOOST [Y/RB]</span>
            </div>
          </div>

          <!-- Player 2 Hot Wheels Dash (Red) -->
          <div class="cyber-card p-6 rounded-3xl border border-rose-600/50 bg-slate-900/90 flex flex-col items-center">
            <div class="flex items-center justify-between w-full mb-3">
              <span class="font-orbitron text-xs font-black text-rose-400 tracking-wider">PLAYER 2 [RED RACER]</span>
              <div class="flex items-center gap-2">
                <span id="hw-p2-gyro-badge" class="hidden px-2 py-0.5 rounded text-[10px] font-mono bg-rose-600 text-white font-bold">🧭 GYRO: 0°</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-900/40 text-rose-300 border border-rose-600/40">SLOT: P2</span>
              </div>
            </div>

            <!-- Virtual Cockpit & Telemetry -->
            <div class="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
              <!-- Top Gauges: Speedometer, Gear, RPM -->
              <div class="flex items-center justify-between px-2">
                <!-- Speedometer -->
                <div class="flex flex-col">
                  <span class="text-[10px] font-mono text-slate-400">SPEED</span>
                  <div class="flex items-baseline gap-1">
                    <span id="hw-p2-speed" class="font-orbitron text-3xl font-black text-white">0</span>
                    <span class="text-[10px] font-mono text-slate-400">MPH</span>
                  </div>
                </div>

                <!-- Gear & Status -->
                <div class="flex flex-col items-center">
                  <span class="text-[10px] font-mono text-slate-400">GEAR</span>
                  <span id="hw-p2-gear" class="font-orbitron text-2xl font-black text-emerald-400">N</span>
                </div>

                <!-- RPM Meter -->
                <div class="flex flex-col items-end">
                  <span class="text-[10px] font-mono text-slate-400">ENGINE RPM</span>
                  <div class="flex items-baseline gap-1">
                    <span id="hw-p2-rpm" class="font-orbitron text-xl font-bold text-slate-200">900</span>
                    <span class="text-[10px] font-mono text-slate-400">RPM</span>
                  </div>
                </div>
              </div>

              <!-- RPM Bar -->
              <div class="w-full bg-slate-900 rounded-full h-2 p-0.5 border border-slate-800 overflow-hidden">
                <div id="hw-p2-rpm-bar" class="bg-rose-500 h-full rounded-full transition-all duration-75 w-[12%]"></div>
              </div>

              <!-- Steering Wheel & Pedals -->
              <div class="flex items-center justify-around pt-2">
                <!-- Steering Wheel -->
                <div class="flex flex-col items-center">
                  <div id="hw-p2-wheel" class="w-24 h-24 rounded-full border-4 border-rose-500 bg-slate-900/80 flex items-center justify-center transition-transform duration-75 relative">
                    <div class="w-16 h-2 bg-rose-500 rounded-full"></div>
                    <div class="absolute top-1 w-3 h-3 rounded-full bg-yellow-400"></div>
                  </div>
                  <span id="hw-p2-steer-label" class="text-[10px] font-mono text-slate-400 mt-2 font-bold">STEER: 0° [CENTER]</span>
                </div>

                <!-- Pedals & Nitro -->
                <div class="flex gap-3 items-end">
                  <!-- Brake Pedal -->
                  <div id="hw-p2-brake" class="w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-600 flex flex-col items-center justify-end pb-2 transition-all">
                    <span class="text-[9px] font-black font-orbitron text-rose-400">BRAKE</span>
                  </div>
                  <!-- Gas Pedal -->
                  <div id="hw-p2-gas" class="w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-500 flex flex-col items-center justify-end pb-2 transition-all">
                    <span class="text-[9px] font-black font-orbitron text-emerald-400">GAS</span>
                  </div>
                  <!-- Nitro Boost -->
                  <div id="hw-p2-boost" class="w-12 h-16 rounded-xl bg-slate-900 border-2 border-amber-500 flex flex-col items-center justify-center transition-all text-xl">
                    🔥
                  </div>
                </div>
              </div>
            </div>

            <!-- Live Phone Input Telemetry -->
            <div id="hw-p2-debug" class="mt-3 text-[10px] font-mono text-slate-400 text-center bg-slate-950/60 rounded-lg px-3 py-1.5 w-full border border-slate-800">
              Inputs: <span class="text-slate-300">GAS [A/RT]</span> | <span class="text-slate-300">BRAKE [B/LT]</span> | <span class="text-slate-300">STEER [Stick/Tilt]</span> | <span class="text-slate-300">BOOST [Y/RB]</span>
            </div>
          </div>
        </div>

        <!-- 3-Step Setup Guide for Hot Wheels Unleashed & Console -->
        <div class="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs font-mono shadow-md">
          <div class="space-y-1">
            <p class="font-bold text-amber-400 flex items-center gap-1.5">
              <span>🏁</span> HOW TO PLAY HOT WHEELS ON YOUR PC:
            </p>
            <p class="text-slate-300">1. On laptop, open <b class="text-white">Hot Wheels Unleashed</b> → <b class="text-white">Quick Modes → Split Screen</b>.</p>
            <p class="text-slate-300">2. Hold Phone like a steering wheel. Press <b class="text-emerald-400">[GAS]</b> or <b class="text-emerald-400">[RT]</b> to accelerate, tilt phone or use joystick to steer.</p>
            <p class="text-slate-400 text-[11px]">• Playing on Render in cloud? Run <code class="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">python windows_game_bridge.py</code> on your laptop so keystrokes reach Hot Wheels directly!</p>
          </div>
          <div class="text-right shrink-0">
            <span class="inline-block px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-600/40 text-emerald-300 font-bold">
              ✓ CAR RACING ENGINE READY
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

    const car = this.carState[playerNumber];
    if (!car) return;

    // Steering: Joystick X or Phone Gyro / Tilt
    let steer = 0;
    if (typeof input.x === 'number' && Math.abs(input.x) > 0.05) {
      steer = input.x;
    } else if (typeof input.tiltX === 'number' && Math.abs(input.tiltX) > 1.5) {
      steer = Math.max(-1, Math.min(1, input.tiltX / 30));
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

    const steerLeft = steer < -0.22;
    const steerRight = steer > 0.22;

    // Fully inclusive input mapping:
    // Gas: Phone [GAS] button (btnA), [RT] trigger, input.gas, or Joystick Up (y < -0.3)
    const gas = !!(
      input.btnRT ||
      input.btnA ||
      input.gas ||
      input.accel ||
      input.fire ||
      (typeof input.y === 'number' && input.y < -0.3)
    );

    // Brake: Phone [BRAKE] button (btnB), [LT] trigger, input.brake, or Joystick Down (y > 0.3)
    const brake = !!(
      input.btnLT ||
      input.btnB ||
      input.brake ||
      (typeof input.y === 'number' && input.y > 0.3)
    );

    // Boost: Phone [BOOST] button (btnY), [DRIFT] (btnX), [RB] trigger, or input.boost
    const boost = !!(
      input.btnY ||
      input.btnX ||
      input.btnRB ||
      input.boost
    );

    // Respawn: Phone [RESPAWN] button (btnLB), select, or input.respawn
    const respawn = !!(
      input.btnLB ||
      input.select ||
      input.respawn
    );

    const pause = !!(input.start || input.pause);

    // Audio feedback on laptop speakers
    if (boost && !car.boost) {
      window.sounds?.playBoost?.();
    }

    car.steer = steer;
    car.gas = gas;
    car.brake = brake;
    car.boost = boost;
    car.respawn = respawn;

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
      wheel.style.transform = `rotate(${steer * 90}deg)`;
    }

    const steerLabel = document.getElementById(`hw-p${playerNumber}-steer-label`);
    if (steerLabel) {
      const deg = Math.round(steer * 90);
      steerLabel.textContent = `STEER: ${deg > 0 ? '+' : ''}${deg}° [${deg < -10 ? 'LEFT' : deg > 10 ? 'RIGHT' : 'CENTER'}]`;
    }

    const gasEl = document.getElementById(`hw-p${playerNumber}-gas`);
    if (gasEl) {
      gasEl.className = gas
        ? 'w-11 h-24 rounded-xl bg-emerald-500 text-slate-950 font-black border-2 border-white flex flex-col items-center justify-end pb-2 scale-95 transition-all shadow-md'
        : 'w-11 h-24 rounded-xl bg-slate-900 border-2 border-emerald-500 flex flex-col items-center justify-end pb-2 transition-all';
    }

    const brakeEl = document.getElementById(`hw-p${playerNumber}-brake`);
    if (brakeEl) {
      brakeEl.className = brake
        ? 'w-11 h-20 rounded-xl bg-rose-600 text-white font-black border-2 border-white flex flex-col items-center justify-end pb-2 scale-95 transition-all shadow-md'
        : 'w-11 h-20 rounded-xl bg-slate-900 border-2 border-rose-600 flex flex-col items-center justify-end pb-2 transition-all';
    }

    const boostEl = document.getElementById(`hw-p${playerNumber}-boost`);
    if (boostEl) {
      boostEl.className = boost
        ? 'w-12 h-16 rounded-xl bg-amber-500 text-slate-950 font-black border-2 border-white flex flex-col items-center justify-center scale-105 transition-all shadow-md text-2xl'
        : 'w-12 h-16 rounded-xl bg-slate-900 border-2 border-amber-500 flex flex-col items-center justify-center transition-all text-xl';
    }

    // Telemetry text
    const debugEl = document.getElementById(`hw-p${playerNumber}-debug`);
    if (debugEl) {
      debugEl.innerHTML = `STEER: <b class="text-white">${steer.toFixed(2)}</b> | GAS: <b class="${gas ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${gas ? 'ON' : 'OFF'}</b> | BRAKE: <b class="${brake ? 'text-rose-400 font-bold' : 'text-slate-400'}">${brake ? 'ON' : 'OFF'}</b> | BOOST: <b class="${boost ? 'text-amber-400 font-bold' : 'text-slate-400'}">${boost ? 'ON' : 'OFF'}</b>`;
    }
  }

  startSimulationLoop() {
    const loop = () => {
      [1, 2].forEach((pNum) => {
        const car = this.carState[pNum];
        if (!car) return;

        // Physics acceleration
        if (car.boost) {
          car.speed = Math.min(240, car.speed + 2.5);
          car.rpm = Math.min(8500, car.rpm + 250);
          car.gear = 'BOOST';
        } else if (car.gas) {
          car.speed = Math.min(185, car.speed + 1.2);
          car.rpm = Math.min(7500, 1500 + car.speed * 32);
          car.gear = 'D';
        } else if (car.brake) {
          if (car.speed > 2) {
            car.speed = Math.max(0, car.speed - 3.0);
            car.rpm = Math.max(900, car.rpm - 200);
            car.gear = 'BRAKE';
          } else {
            car.speed = Math.max(-30, car.speed - 0.8);
            car.rpm = Math.min(3000, 900 + Math.abs(car.speed) * 60);
            car.gear = 'R';
          }
        } else {
          // Coasting drag
          car.speed = Math.max(0, car.speed - 0.5);
          car.rpm = Math.max(900, car.rpm - 80);
          car.gear = car.speed > 2 ? 'D' : 'N';
        }

        // Update Gauge HUD
        const spdEl = document.getElementById(`hw-p${pNum}-speed`);
        if (spdEl) spdEl.textContent = Math.round(Math.abs(car.speed));

        const rpmEl = document.getElementById(`hw-p${pNum}-rpm`);
        if (rpmEl) rpmEl.textContent = Math.round(car.rpm);

        const gearEl = document.getElementById(`hw-p${pNum}-gear`);
        if (gearEl) gearEl.textContent = car.gear;

        const rpmBar = document.getElementById(`hw-p${pNum}-rpm-bar`);
        if (rpmBar) {
          const pct = Math.min(100, Math.max(10, (car.rpm / 8500) * 100));
          rpmBar.style.width = `${pct}%`;
        }
      });

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
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
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.activeKeys.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    });
    this.activeKeys.clear();
  }
}
