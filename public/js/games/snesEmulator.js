// 🕹️ RETRO SNES EMULATOR ENGINE (.SFC / .SMC PLAYER)
// Uses Nostalgist.js (Snes9x WebAssembly) to play real 16-bit multiplayer SNES games
// with 2 mobile phones as Player 1 and Player 2 controllers!

export class SnesEmulator {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.syncToMobile = syncToMobile;

    this.nostalgist = null;
    this.activeRomName = '';
    this.isRunning = false;

    // Previous input state for pressDown / pressUp tracking
    this.prevInputs = {
      1: { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false, l: false, r: false, select: false, start: false },
      2: { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false, l: false, r: false, select: false, start: false }
    };

    this.renderUi();
  }

  renderUi() {
    this.container.innerHTML = `
      <div class="flex flex-col h-full w-full p-6 items-center justify-between text-slate-100 overflow-y-auto">
        <!-- Top Bar -->
        <div class="w-full max-w-4xl flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🕹️</span>
            <div>
              <h2 class="font-orbitron font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
                SUPER FAMICOM / SNES 16-BIT CONSOLE
              </h2>
              <p class="text-[10px] font-mono text-slate-400">Play real .sfc & .smc multiplayer ROMs with your phones as controllers!</p>
            </div>
          </div>
          <button id="snes-exit-btn" class="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 hover:border-cyan-400 text-xs font-mono text-slate-300 hover:text-white transition">
            ✕ EXIT EMULATOR
          </button>
        </div>

        <!-- Emulator Canvas / ROM Drop Area -->
        <div id="emulator-screen-box" class="relative w-full max-w-4xl flex-1 bg-black rounded-3xl border-2 border-purple-500/50 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.3)] overflow-hidden min-h-[380px]">
          <!-- Canvas for Nostalgist will mount here -->
          <canvas id="snes-canvas" class="hidden max-h-full max-w-full object-contain rounded-xl"></canvas>

          <!-- Dropzone Placeholder when no ROM is loaded -->
          <div id="snes-dropzone" class="flex flex-col items-center text-center p-8 max-w-lg">
            <div class="w-20 h-20 rounded-2xl bg-purple-950/60 border-2 border-dashed border-purple-400/80 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(168,85,247,0.4)] mb-4 animate-pulse">
              🎮
            </div>
            <h3 class="font-orbitron font-black text-lg text-purple-300 mb-1">LOAD A MULTIPLAYER .SFC GAME</h3>
            <p class="text-xs font-mono text-slate-400 mb-6">
              Drag & drop any Super Nintendo <b class="text-white">.sfc</b> or <b class="text-white">.smc</b> ROM file directly here, or choose an option below:
            </p>

            <div class="flex flex-wrap gap-3 justify-center mb-6">
              <label class="cyber-btn px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-orbitron font-bold text-xs tracking-wider text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] cursor-pointer hover:brightness-110">
                📁 SELECT .SFC FILE FROM LAPTOP
                <input id="rom-file-input" type="file" accept=".sfc,.smc,.bin" class="hidden">
              </label>
            </div>

            <!-- Free Legal Download Recommendations -->
            <div class="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-left w-full text-[11px] font-mono text-slate-300 space-y-1.5">
              <p class="font-bold text-cyan-400 mb-1">FREE MULTIPLAYER .SFC GAMES YOU CAN DOWNLOAD NOW:</p>
              <p>• <b class="text-white">Supercooked!</b> — 2-Player Co-op Kitchen Mayhem for SNES (<a href="https://itch.io/games/tag-snes" target="_blank" class="text-purple-400 underline">itch.io</a>)</p>
              <p>• <b class="text-white">Unarmed</b> — 2-4 Player Arena Action Brawler (<a href="https://itch.io/games/tag-multiplayer/tag-snes" target="_blank" class="text-purple-400 underline">itch.io</a>)</p>
              <p>• <b class="text-white">N-Warp Daisakusen</b> — Legendary 8-Player Party Game for SNES</p>
              <p>• <b class="text-white">Super Mario Kart, Super Bomberman, Street Fighter II</b> — (If you own personal backup copies)</p>
            </div>
          </div>

          <!-- Loading Indicator -->
          <div id="snes-loading" class="hidden flex flex-col items-center">
            <div class="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="font-orbitron text-xs font-bold text-purple-300 tracking-wider">LAUNCHING RETRO CORE (SNES9X)...</p>
          </div>
        </div>

        <!-- Controller Status Bar -->
        <div class="w-full max-w-4xl bg-slate-950/80 border border-white/10 rounded-2xl p-3 flex items-center justify-between text-xs font-mono mt-3">
          <div class="flex items-center gap-4">
            <span class="text-slate-400">CONTROLLERS:</span>
            <span class="text-cyan-400 font-bold">Joy-Con 1 = SNES P1</span>
            <span class="text-pink-400 font-bold">Joy-Con 2 = SNES P2</span>
          </div>
          <span id="snes-status-text" class="text-purple-300 font-bold">Waiting for .sfc ROM...</span>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const fileInput = document.getElementById('rom-file-input');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.loadRomFromFile(file);
    });

    const dropzone = document.getElementById('snes-dropzone');
    const box = document.getElementById('emulator-screen-box');

    box?.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('border-cyan-400', 'bg-purple-950/20');
    });

    box?.addEventListener('dragleave', () => {
      box.classList.remove('border-cyan-400', 'bg-purple-950/20');
    });

    box?.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('border-cyan-400', 'bg-purple-950/20');
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.sfc') || file.name.endsWith('.smc') || file.name.endsWith('.bin'))) {
        this.loadRomFromFile(file);
      } else {
        alert('Please drop a valid .sfc or .smc Super Nintendo ROM file.');
      }
    });

    document.getElementById('snes-exit-btn')?.addEventListener('click', () => {
      this.stop();
      window.airConsole?.returnToLobby();
    });
  }

  async loadRomFromFile(file) {
    const dropzone = document.getElementById('snes-dropzone');
    const loading = document.getElementById('snes-loading');
    const canvas = document.getElementById('snes-canvas');
    const statusText = document.getElementById('snes-status-text');

    if (dropzone) dropzone.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    if (statusText) statusText.textContent = `Loading ${file.name}...`;

    try {
      // Ensure Nostalgist is loaded
      if (!window.Nostalgist) {
        await this.loadNostalgistScript();
      }

      if (this.nostalgist) {
        await this.nostalgist.exit();
        this.nostalgist = null;
      }

      if (canvas) canvas.classList.remove('hidden');

      this.nostalgist = await window.Nostalgist.launch({
        core: 'snes9x',
        rom: file,
        element: canvas,
        retroarchConfig: {
          input_player1_analog_dpad_mode: 1,
          input_player2_analog_dpad_mode: 1
        }
      });

      this.isRunning = true;
      if (loading) loading.classList.add('hidden');
      if (statusText) statusText.textContent = `▶ RUNNING: ${file.name}`;
      window.sounds?.playJoin();
    } catch (err) {
      console.error('Failed to launch SNES ROM:', err);
      if (loading) loading.classList.add('hidden');
      if (dropzone) dropzone.classList.remove('hidden');
      if (statusText) statusText.textContent = `Error loading ROM: ${err.message}`;
      alert(`Could not launch emulator: ${err.message}`);
    }
  }

  loadNostalgistScript() {
    return new Promise((resolve, reject) => {
      if (window.Nostalgist) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/nostalgist@latest/dist/nostalgist.umd.min.js';
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('Failed to load Nostalgist emulator library'));
      document.head.appendChild(s);
    });
  }

  handlePlayerInput(playerNumber, input) {
    if (!this.isRunning || !this.nostalgist) return;

    const p = playerNumber; // 1 or 2
    const prev = this.prevInputs[p];
    if (!prev) return;

    // Analog stick to D-pad mapping
    const stickX = input.x || 0;
    const stickY = input.y || 0;

    const up = stickY < -0.3;
    const down = stickY > 0.3;
    const left = stickX < -0.3;
    const right = stickX > 0.3;

    // Face & shoulder buttons
    const btnA = !!(input.btnA || input.fire);
    const btnB = !!(input.btnB || input.boost);
    const btnX = !!(input.btnX || input.shield);
    const btnY = !!(input.btnY);
    const btnL = !!(input.btnL);
    const btnR = !!(input.btnR);
    const select = !!(input.select);
    const start = !!(input.start);

    const updateButton = (btnName, isDown) => {
      if (isDown && !prev[btnName]) {
        prev[btnName] = true;
        this.nostalgist.pressDown({ button: btnName, player: p }).catch(() => {});
      } else if (!isDown && prev[btnName]) {
        prev[btnName] = false;
        this.nostalgist.pressUp({ button: btnName, player: p }).catch(() => {});
      }
    };

    updateButton('up', up);
    updateButton('down', down);
    updateButton('left', left);
    updateButton('right', right);
    updateButton('a', btnA);
    updateButton('b', btnB);
    updateButton('x', btnX);
    updateButton('y', btnY);
    updateButton('l', btnL);
    updateButton('r', btnR);
    updateButton('select', select);
    updateButton('start', start);
  }

  start() {}
  startCountdown(cb) { if (cb) cb(); }

  stop() {
    this.isRunning = false;
    if (this.nostalgist) {
      try {
        this.nostalgist.exit();
      } catch (e) {}
      this.nostalgist = null;
    }
  }
}

