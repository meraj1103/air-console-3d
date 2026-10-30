// 🎮 UNIVERSAL PC GAMEPAD MODE
// Turns your connected mobile phones into real-time controllers for laptop games

export class GamepadMode {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.syncToMobile = syncToMobile;

    this.inputs = {
      1: { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnL: false, btnR: false },
      2: { x: 0, y: 0, btnA: false, btnB: false, btnX: false, btnY: false, btnL: false, btnR: false }
    };

    // Keyboard Keybindings mapping to Laptop
    this.keyMap = {
      1: {
        up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
        btnA: 'Space', btnB: 'ShiftLeft', btnX: 'KeyE', btnY: 'KeyQ',
        btnL: 'Digit1', btnR: 'Digit2'
      },
      2: {
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
        btnA: 'Enter', btnB: 'ControlRight', btnX: 'ShiftRight', btnY: 'Slash',
        btnL: 'Digit9', btnR: 'Digit0'
      }
    };

    this.activeKeys = new Set();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full p-8 items-center justify-center text-slate-100 overflow-y-auto">
        <div class="max-w-4xl w-full flex flex-col items-center">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-4xl">🎮</span>
            <h2 class="font-orbitron font-black text-3xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
              UNIVERSAL PC GAMEPAD MODE
            </h2>
          </div>
          <p class="text-xs font-mono text-slate-400 mb-8 text-center max-w-xl">
            Your phones are now active as virtual gamepads! Inputs are simulated as keyboard strokes on your laptop so you can control web games, emulators, and local games!
          </p>

          <!-- Dual Gamepad Live Visualizers -->
          <div class="grid grid-cols-2 gap-8 w-full mb-8">
            <!-- Player 1 Controller Visualizer -->
            <div class="cyber-card p-6 rounded-3xl border border-cyan-500/40 bg-slate-900/60 flex flex-col items-center">
              <div class="flex items-center justify-between w-full mb-4">
                <span class="font-orbitron text-xs font-black text-cyan-400">PLAYER 1 [JOY-CON CYAN]</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300">KEYS: W A S D + Space</span>
              </div>

              <!-- Controller Mockup -->
              <div class="relative w-64 h-36 bg-slate-950 border-2 border-cyan-400/50 rounded-3xl p-4 flex justify-between items-center shadow-[0_0_25px_rgba(0,240,255,0.2)]">
                <!-- Left Stick Visual -->
                <div class="w-16 h-16 rounded-full bg-slate-900 border border-cyan-400 flex items-center justify-center relative">
                  <div id="vis-p1-stick" class="w-8 h-8 rounded-full bg-cyan-400 transition-transform duration-75"></div>
                </div>

                <!-- Action Diamond -->
                <div class="relative w-16 h-16">
                  <div id="vis-p1-btnY" class="absolute top-0 left-5 w-5 h-5 rounded-full bg-slate-800 border border-yellow-400 text-[9px] flex items-center justify-center font-bold">Y</div>
                  <div id="vis-p1-btnX" class="absolute top-5 left-0 w-5 h-5 rounded-full bg-slate-800 border border-blue-400 text-[9px] flex items-center justify-center font-bold">X</div>
                  <div id="vis-p1-btnB" class="absolute top-5 right-0 w-5 h-5 rounded-full bg-slate-800 border border-red-500 text-[9px] flex items-center justify-center font-bold">B</div>
                  <div id="vis-p1-btnA" class="absolute bottom-0 left-5 w-5 h-5 rounded-full bg-slate-800 border border-emerald-400 text-[9px] flex items-center justify-center font-bold">A</div>
                </div>
              </div>

              <div class="mt-4 text-[11px] font-mono text-slate-400 text-center space-y-1">
                <p>Stick: <b class="text-cyan-300">W, A, S, D</b></p>
                <p>Buttons: <b class="text-emerald-400">[A] Space</b> | <b class="text-rose-400">[B] Shift</b> | <b class="text-blue-400">[X] E</b> | <b class="text-yellow-400">[Y] Q</b></p>
              </div>
            </div>

            <!-- Player 2 Controller Visualizer -->
            <div class="cyber-card p-6 rounded-3xl border border-pink-500/40 bg-slate-900/60 flex flex-col items-center">
              <div class="flex items-center justify-between w-full mb-4">
                <span class="font-orbitron text-xs font-black text-pink-400">PLAYER 2 [JOY-CON PINK]</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500/20 text-pink-300">KEYS: Arrows + Enter</span>
              </div>

              <!-- Controller Mockup -->
              <div class="relative w-64 h-36 bg-slate-950 border-2 border-pink-500/50 rounded-3xl p-4 flex justify-between items-center shadow-[0_0_25px_rgba(255,0,127,0.2)]">
                <!-- Left Stick Visual -->
                <div class="w-16 h-16 rounded-full bg-slate-900 border border-pink-400 flex items-center justify-center relative">
                  <div id="vis-p2-stick" class="w-8 h-8 rounded-full bg-pink-400 transition-transform duration-75"></div>
                </div>

                <!-- Action Diamond -->
                <div class="relative w-16 h-16">
                  <div id="vis-p2-btnY" class="absolute top-0 left-5 w-5 h-5 rounded-full bg-slate-800 border border-yellow-400 text-[9px] flex items-center justify-center font-bold">Y</div>
                  <div id="vis-p2-btnX" class="absolute top-5 left-0 w-5 h-5 rounded-full bg-slate-800 border border-blue-400 text-[9px] flex items-center justify-center font-bold">X</div>
                  <div id="vis-p2-btnB" class="absolute top-5 right-0 w-5 h-5 rounded-full bg-slate-800 border border-red-500 text-[9px] flex items-center justify-center font-bold">B</div>
                  <div id="vis-p2-btnA" class="absolute bottom-0 left-5 w-5 h-5 rounded-full bg-slate-800 border border-emerald-400 text-[9px] flex items-center justify-center font-bold">A</div>
                </div>
              </div>

              <div class="mt-4 text-[11px] font-mono text-slate-400 text-center space-y-1">
                <p>Stick: <b class="text-pink-300">Arrow Keys</b></p>
                <p>Buttons: <b class="text-emerald-400">[A] Enter</b> | <b class="text-rose-400">[B] R-Ctrl</b> | <b class="text-blue-400">[X] R-Shift</b> | <b class="text-yellow-400">[Y] /</b></p>
              </div>
            </div>
          </div>

          <!-- Live Input Log Bar -->
          <div class="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <span class="text-xs font-mono text-slate-400">STATUS:</span>
            <span id="gamepad-status-log" class="text-xs font-mono text-emerald-400">🎮 Ready! Tap phone buttons or move sticks to test.</span>
            <button onclick="window.airConsole?.returnToLobby()" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-mono rounded-lg border border-white/10">
              RETURN TO ARCADE MENU
            </button>
          </div>
        </div>
      </div>
    `;
  }

  handlePlayerInput(playerNumber, input) {
    const pInput = this.inputs[playerNumber];
    if (!pInput) return;

    const km = this.keyMap[playerNumber];

    // Stick directions
    const stickX = input.x || 0;
    const stickY = input.y || 0;

    this.dispatchKey(km.left, stickX < -0.3);
    this.dispatchKey(km.right, stickX > 0.3);
    this.dispatchKey(km.up, stickY < -0.3);
    this.dispatchKey(km.down, stickY > 0.3);

    // Buttons
    const btnA = !!(input.fire || input.btnA);
    const btnB = !!(input.boost || input.btnB);
    const btnX = !!(input.shield || input.btnX);
    const btnY = !!(input.btnY);

    this.dispatchKey(km.btnA, btnA);
    this.dispatchKey(km.btnB, btnB);
    this.dispatchKey(km.btnX, btnX);
    this.dispatchKey(km.btnY, btnY);

    // Update Visualizer
    const stickEl = document.getElementById(`vis-p${playerNumber}-stick`);
    if (stickEl) {
      stickEl.style.transform = `translate(${stickX * 16}px, ${stickY * 16}px)`;
    }

    const setBtnVis = (id, active) => {
      const el = document.getElementById(id);
      if (el) {
        if (active) {
          el.classList.add('bg-white', 'text-black', 'scale-125');
        } else {
          el.classList.remove('bg-white', 'text-black', 'scale-125');
        }
      }
    };

    setBtnVis(`vis-p${playerNumber}-btnA`, btnA);
    setBtnVis(`vis-p${playerNumber}-btnB`, btnB);
    setBtnVis(`vis-p${playerNumber}-btnX`, btnX);
    setBtnVis(`vis-p${playerNumber}-btnY`, btnY);

    const logEl = document.getElementById('gamepad-status-log');
    if (logEl) {
      logEl.textContent = `Player ${playerNumber} Input: Stick (${stickX.toFixed(2)}, ${stickY.toFixed(2)}) | A:${btnA} B:${btnB} X:${btnX} Y:${btnY}`;
    }
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
    this.activeKeys.forEach(code => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    });
    this.activeKeys.clear();
  }
}
