// ⚔️ BLADE DUEL: SAMURAI SHOWDOWN (1v1 SHARED-SCREEN FIGHTER)
// Inspired by Street Fighter & Samurai Shodown - 2 Players on ONE FULL SCREEN!

class Sprite {
  constructor({ position, imageSrc, scale = 1, framesMax = 1, offset = { x: 0, y: 0 }, framesHold = 8 }) {
    this.position = position;
    this.scale = scale;
    this.framesMax = framesMax;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = framesHold;
    this.offset = offset;

    this.image = new Image();
    this.image.src = imageSrc;
  }

  draw(c) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    const fw = this.image.width / this.framesMax;
    const fh = this.image.height;
    c.drawImage(
      this.image,
      this.framesCurrent * fw,
      0,
      fw,
      fh,
      this.position.x - this.offset.x,
      this.position.y - this.offset.y,
      fw * this.scale,
      fh * this.scale
    );
  }

  animateFrames() {
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) {
        this.framesCurrent++;
      } else {
        this.framesCurrent = 0;
      }
    }
  }

  update(c) {
    this.draw(c);
    this.animateFrames();
  }
}

class Fighter extends Sprite {
  constructor({
    position,
    velocity = { x: 0, y: 0 },
    color = 'red',
    imageSrc,
    scale = 1,
    framesMax = 1,
    offset = { x: 0, y: 0 },
    sprites,
    attackBox = { offset: { x: 0, y: 0 }, width: 140, height: 60 },
    facing = 'right',
    defaultFacing = 'right',
    alignBottom = true,
    width = 55,
    height = 150
  }) {
    super({ position, imageSrc, scale, framesMax, offset, framesHold: 12 });

    this.velocity = velocity;
    this.width = width;
    this.height = height;
    this.color = color;
    this.isAttacking = false;
    this.attackType = 1;
    this.health = 100;
    this.isDead = false;
    this.facing = facing;
    this.defaultFacing = defaultFacing;
    this.alignBottom = alignBottom;

    this.attackBox = {
      position: { x: this.position.x, y: this.position.y },
      offset: attackBox.offset,
      width: attackBox.width,
      height: attackBox.height
    };

    this.sprites = sprites;
    for (const sprite in this.sprites) {
      this.sprites[sprite].image = new Image();
      this.sprites[sprite].image.src = this.sprites[sprite].imageSrc;
    }
  }

  draw(c) {
    if (!this.image.complete || this.image.naturalWidth === 0) return;
    const frameWidth = this.image.width / this.framesMax;
    const frameHeight = this.image.height;
    const destWidth = frameWidth * this.scale;
    const destHeight = frameHeight * this.scale;

    // Anchor exactly at character horizontal center & feet baseline
    const centerX = this.position.x + this.width / 2;
    const drawY = this.alignBottom
      ? this.position.y + this.height - destHeight
      : this.position.y - this.offset.y;

    c.save();
    // Translate directly to character center
    c.translate(centerX, drawY);

    // Flip around character center axis if facing opposite default
    const shouldFlip = (this.facing !== this.defaultFacing);
    if (shouldFlip) {
      c.scale(-1, 1);
    }

    // Draw centered horizontally so animation transitions NEVER jump or jitter!
    c.drawImage(
      this.image,
      this.framesCurrent * frameWidth,
      0,
      frameWidth,
      frameHeight,
      -destWidth / 2,
      0,
      destWidth,
      destHeight
    );
    c.restore();
  }

  update(c, gravity, groundLevel, canvasWidth) {
    this.draw(c);
    if (!this.isDead) this.animateFrames();

    // Update attack box position aligned with facing direction
    const attackXOffset = this.facing === 'left' ? -this.attackBox.width : this.width;
    this.attackBox.position.x = this.position.x + attackXOffset;
    this.attackBox.position.y = this.position.y + (this.attackBox.offset?.y || 25);

    // Apply Velocity
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    // Boundaries
    this.position.x = Math.max(30, Math.min(canvasWidth - this.width - 30, this.position.x));

    // Gravity & Ground Collision
    if (this.position.y + this.height + this.velocity.y >= groundLevel) {
      this.velocity.y = 0;
      this.position.y = groundLevel - this.height;
    } else {
      this.velocity.y += gravity;
    }
  }

  attack(attackType = 1) {
    if (this.isDead || this.isAttacking) return;
    this.attackType = attackType;
    this.switchSprite(attackType === 2 && this.sprites.attack2 ? 'attack2' : 'attack1');
    this.isAttacking = true;
  }

  takeHit(damage = 15) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.switchSprite('death');
    } else {
      this.switchSprite('takeHit');
    }
  }

  switchSprite(sprite) {
    // If dead, stay on death frame
    if (this.image === this.sprites.death?.image) {
      if (this.framesCurrent === this.sprites.death.framesMax - 1) this.isDead = true;
      return;
    }

    // Do not interrupt active attack animations before completion
    if (
      (this.image === this.sprites.attack1?.image && this.framesCurrent < this.sprites.attack1.framesMax - 1) ||
      (this.image === this.sprites.attack2?.image && this.framesCurrent < this.sprites.attack2.framesMax - 1)
    ) return;

    // Do not interrupt hit reaction
    if (this.image === this.sprites.takeHit?.image && this.framesCurrent < this.sprites.takeHit.framesMax - 1) return;

    switch (sprite) {
      case 'idle':
        if (this.image !== this.sprites.idle.image) {
          this.image = this.sprites.idle.image;
          this.framesMax = this.sprites.idle.framesMax;
          this.framesHold = 14; // Calm, smooth idle breathing
          this.framesCurrent = 0;
        }
        break;
      case 'run':
        if (this.image !== this.sprites.run.image) {
          this.image = this.sprites.run.image;
          this.framesMax = this.sprites.run.framesMax;
          this.framesHold = 8; // Fluid running stride
          this.framesCurrent = 0;
        }
        break;
      case 'jump':
        if (this.image !== this.sprites.jump.image) {
          this.image = this.sprites.jump.image;
          this.framesMax = this.sprites.jump.framesMax;
          this.framesHold = 8;
          this.framesCurrent = 0;
        }
        break;
      case 'fall':
        if (this.sprites.fall && this.image !== this.sprites.fall.image) {
          this.image = this.sprites.fall.image;
          this.framesMax = this.sprites.fall.framesMax;
          this.framesHold = 8;
          this.framesCurrent = 0;
        }
        break;
      case 'attack1':
        if (this.image !== this.sprites.attack1.image) {
          this.image = this.sprites.attack1.image;
          this.framesMax = this.sprites.attack1.framesMax;
          this.framesHold = 5; // Snappy sword slash
          this.framesCurrent = 0;
        }
        break;
      case 'attack2':
        if (this.sprites.attack2 && this.image !== this.sprites.attack2.image) {
          this.image = this.sprites.attack2.image;
          this.framesMax = this.sprites.attack2.framesMax;
          this.framesHold = 6;
          this.framesCurrent = 0;
        }
        break;
      case 'takeHit':
        if (this.image !== this.sprites.takeHit.image) {
          this.image = this.sprites.takeHit.image;
          this.framesMax = this.sprites.takeHit.framesMax;
          this.framesHold = 8;
          this.framesCurrent = 0;
        }
        break;
      case 'death':
        if (this.image !== this.sprites.death.image) {
          this.image = this.sprites.death.image;
          this.framesMax = this.sprites.death.framesMax;
          this.framesHold = 10;
          this.framesCurrent = 0;
        }
        break;
    }
  }
}

export class FighterGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile;

    this.timer = 60;
    this.timerId = null;
    this.isOver = false;

    // Active real-time input buffer with timeout watchdog
    this.activeInputs = {
      1: { x: 0, y: 0, attack1: false, attack2: false, lastActive: Date.now() },
      2: { x: 0, y: 0, attack1: false, attack2: false, lastActive: Date.now() }
    };

    this.gravity = 0.7;
    this.groundLevel = 480;

    this.render();
    this.initGame();
  }

  render() {
    this.container.innerHTML = `
      <div class="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden select-none">
        <!-- Stage Selector Chips -->
        <div class="absolute top-2 left-0 right-0 z-30 flex items-center justify-center gap-2">
          <button id="stage-btn-village" class="px-3 py-1 rounded-full text-[11px] font-mono bg-purple-950/90 border border-purple-400 text-purple-200 hover:brightness-125 transition cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.3)]">🏚️ CURSED VILLAGE</button>
          <button id="stage-btn-cyber" class="px-3 py-1 rounded-full text-[11px] font-mono bg-slate-900 border border-white/20 text-slate-300 hover:text-white transition cursor-pointer">🌆 CYBER RUINS</button>
          <button id="stage-btn-dojo" class="px-3 py-1 rounded-full text-[11px] font-mono bg-slate-900 border border-white/20 text-slate-300 hover:text-white transition cursor-pointer">🏯 ANCIENT DOJO</button>
        </div>

        <!-- Top HUD (HP Bars & 60s Round Timer) -->
        <div class="absolute top-10 left-6 right-6 z-20 flex items-center justify-between max-w-5xl mx-auto">
          <!-- Player 1 HP Bar (Cyborg Raider) -->
          <div class="w-2/5 flex flex-col items-start">
            <div class="flex items-center justify-between w-full mb-1">
              <span class="font-orbitron font-black text-xs text-cyan-400 tracking-wider">P1: CYBORG RAIDER ⚡</span>
              <span id="p1-hp-text" class="font-mono text-xs text-cyan-300 font-bold">100 HP</span>
            </div>
            <div class="w-full h-5 rounded-lg bg-slate-900 border-2 border-cyan-400/50 p-0.5 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <div id="p1-hp-bar" class="h-full rounded-md bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-150" style="width: 100%;"></div>
            </div>
          </div>

          <!-- Round Timer -->
          <div class="w-16 h-16 rounded-2xl bg-slate-900/95 border-2 border-yellow-400 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(255,230,0,0.4)] z-30">
            <span id="fight-timer" class="font-orbitron font-black text-2xl text-yellow-300">60</span>
          </div>

          <!-- Player 2 HP Bar (Ninja Kenji) -->
          <div class="w-2/5 flex flex-col items-end">
            <div class="flex items-center justify-between w-full mb-1">
              <span id="p2-hp-text" class="font-mono text-xs text-pink-300 font-bold">100 HP</span>
              <span class="font-orbitron font-black text-xs text-pink-500 tracking-wider">P2: NINJA KENJI 🥷</span>
            </div>
            <div class="w-full h-5 rounded-lg bg-slate-900 border-2 border-pink-500/50 p-0.5 shadow-[0_0_15px_rgba(255,0,85,0.3)] flex justify-end">
              <div id="p2-hp-bar" class="h-full rounded-md bg-gradient-to-l from-pink-500 to-rose-400 transition-all duration-150" style="width: 100%;"></div>
            </div>
          </div>
        </div>

        <!-- 1v1 Shared Fighting Arena Canvas (1024x576 HD) -->
        <canvas id="fighter-canvas" width="1024" height="576" class="w-full h-full max-w-5xl max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"></canvas>

        <!-- KO / Victory Banner -->
        <div id="fight-result-banner" class="hidden absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md">
          <h1 id="fight-result-text" class="font-orbitron font-black text-6xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-500 animate-bounce mb-3">
            KNOCKOUT!
          </h1>
          <p id="fight-result-winner" class="font-mono text-lg text-white font-bold tracking-wider mb-6">
            🏆 PLAYER 1 WINS!
          </p>
          <button id="fight-rematch-btn" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-orbitron font-bold text-sm text-white shadow-[0_0_20px_rgba(0,240,255,0.5)] hover:brightness-110 active:scale-95 transition cursor-pointer">
            PLAY AGAIN ⚔️
          </button>
        </div>
      </div>
    `;
  }

  initGame() {
    this.canvas = document.getElementById('fighter-canvas');
    this.c = this.canvas.getContext('2d');

    // Background (Cursed Horror Village by default)
    this.background = new Sprite({
      position: { x: 0, y: 0 },
      imageSrc: '/assets/fighter/backgrounds/cursed_village.png'
    });

    // Player 1 (Custom Cyborg Raider with Red Glowing Saber & Shuriken)
    this.player1 = new Fighter({
      position: { x: 180, y: 300 },
      velocity: { x: 0, y: 0 },
      imageSrc: '/assets/fighter/cyborg/Idle.png',
      framesMax: 3,
      scale: 1.15,
      width: 55,
      height: 150,
      facing: 'right',
      defaultFacing: 'right',
      alignBottom: true,
      sprites: {
        idle: { imageSrc: '/assets/fighter/cyborg/Idle.png', framesMax: 3 },
        run: { imageSrc: '/assets/fighter/cyborg/Run.png', framesMax: 4 },
        jump: { imageSrc: '/assets/fighter/cyborg/Jump.png', framesMax: 4 },
        fall: { imageSrc: '/assets/fighter/cyborg/Jump.png', framesMax: 4 },
        attack1: { imageSrc: '/assets/fighter/cyborg/Attack1.png', framesMax: 6 },
        attack2: { imageSrc: '/assets/fighter/cyborg/Attack2.png', framesMax: 3 },
        takeHit: { imageSrc: '/assets/fighter/cyborg/TakeHit.png', framesMax: 3 },
        death: { imageSrc: '/assets/fighter/cyborg/Death.png', framesMax: 4 }
      },
      attackBox: {
        offset: { x: 0, y: 25 },
        width: 175,
        height: 75
      }
    });

    // Player 2 (Ninja Kenji - Scaled to exact matching proportions!)
    this.player2 = new Fighter({
      position: { x: 740, y: 300 },
      velocity: { x: 0, y: 0 },
      color: 'blue',
      imageSrc: '/assets/fighter/player2/Idle.png',
      framesMax: 4,
      scale: 1.35,
      width: 55,
      height: 150,
      facing: 'left',
      defaultFacing: 'left',
      alignBottom: true,
      sprites: {
        idle: { imageSrc: '/assets/fighter/player2/Idle.png', framesMax: 4 },
        run: { imageSrc: '/assets/fighter/player2/Run.png', framesMax: 8 },
        jump: { imageSrc: '/assets/fighter/player2/Jump.png', framesMax: 2 },
        fall: { imageSrc: '/assets/fighter/player2/Fall.png', framesMax: 2 },
        attack1: { imageSrc: '/assets/fighter/player2/Attack1.png', framesMax: 4 },
        attack2: { imageSrc: '/assets/fighter/player2/Attack2.png', framesMax: 4 },
        takeHit: { imageSrc: '/assets/fighter/player2/TakeHit.png', framesMax: 3 },
        death: { imageSrc: '/assets/fighter/player2/Death.png', framesMax: 7 }
      },
      attackBox: {
        offset: { x: 0, y: 25 },
        width: 155,
        height: 75
      }
    });

    this.bindStageSelectors();
    this.startTimer();
    this.animate();
  }

  bindStageSelectors() {
    const setStage = (src) => {
      this.background.image = new Image();
      this.background.image.src = src;
    };
    document.getElementById('stage-btn-village')?.addEventListener('click', () => {
      setStage('/assets/fighter/backgrounds/cursed_village.png');
    });
    document.getElementById('stage-btn-cyber')?.addEventListener('click', () => {
      setStage('/assets/fighter/backgrounds/cyber_ruins_stage.png');
    });
    document.getElementById('stage-btn-dojo')?.addEventListener('click', () => {
      setStage('/assets/fighter/backgrounds/background1.png');
    });
    document.getElementById('fight-rematch-btn')?.addEventListener('click', () => {
      this.restartRound();
    });
  }

  startTimer() {
    this.timer = 60;
    const timerEl = document.getElementById('fight-timer');
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      if (this.timer > 0 && !this.isOver) {
        this.timer--;
        if (timerEl) timerEl.textContent = this.timer;
      }
      if (this.timer === 0 && !this.isOver) {
        this.determineWinner();
      }
    }, 1000);
  }

  handlePlayerInput(playerNumber, input) {
    const current = this.activeInputs[playerNumber];
    if (!current) return;

    current.lastActive = Date.now();

    // Movement X (with 0.25 deadzone threshold to eliminate drift)
    if (typeof input.x === 'number') {
      current.x = Math.abs(input.x) > 0.25 ? input.x : 0;
    }
    if (typeof input.y === 'number') {
      current.y = input.y;
    }

    if (input.btnA || input.btnRT || input.fire) current.attack1 = true;
    if (input.btnX || input.btnY) current.attack2 = true;
    if (input.btnB || input.jump) current.jump = true;
  }

  processInputs() {
    const now = Date.now();

    for (let pNum = 1; pNum <= 2; pNum++) {
      const inp = this.activeInputs[pNum];
      const p = pNum === 1 ? this.player1 : this.player2;
      if (!p || p.isDead || this.isOver) continue;

      // Inactivity timeout: If no input received within 350ms, immediately zero out movement!
      if (now - inp.lastActive > 350) {
        inp.x = 0;
      }

      // X Movement strictly bound to active inputs
      if (inp.x < -0.25) {
        p.velocity.x = -6;
        p.facing = 'left';
        if (p.velocity.y === 0) p.switchSprite('run');
      } else if (inp.x > 0.25) {
        p.velocity.x = 6;
        p.facing = 'right';
        if (p.velocity.y === 0) p.switchSprite('run');
      } else {
        p.velocity.x = 0;
        if (p.velocity.y === 0) p.switchSprite('idle');
      }

      // Jump
      if ((inp.y < -0.45 || inp.jump) && p.velocity.y === 0) {
        p.velocity.y = -18;
        p.switchSprite('jump');
        inp.jump = false;
        window.sounds?.playJump?.();
      }

      if (p.velocity.y < 0) {
        p.switchSprite('jump');
      } else if (p.velocity.y > 0) {
        p.switchSprite('fall');
      }

      // Attacks
      if (inp.attack1) {
        inp.attack1 = false;
        p.attack(1);
        window.sounds?.playShoot?.();
      } else if (inp.attack2) {
        inp.attack2 = false;
        p.attack(2);
        window.sounds?.playBoost?.();
      }
    }
  }

  checkCollision(rect1, rect2) {
    return (
      rect1.position.x + rect1.width >= rect2.position.x &&
      rect1.position.x <= rect2.position.x + rect2.width &&
      rect1.position.y + rect1.height >= rect2.position.y &&
      rect1.position.y <= rect2.position.y + rect2.height
    );
  }

  animate() {
    if (this.destroyed) return;
    requestAnimationFrame(() => this.animate());

    // CRITICAL: Nearest-neighbor interpolation ensures crisp, razor-sharp pixel art!
    this.c.imageSmoothingEnabled = false;

    // Clear Screen
    this.c.fillStyle = '#050811';
    this.c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Background Stage
    this.background.update(this.c);

    // Subtle arena lighting atmosphere
    this.c.fillStyle = 'rgba(0, 0, 0, 0.12)';
    this.c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Process inputs continuously with timeout watchdog
    this.processInputs();

    // Update Fighters
    this.player1.update(this.c, this.gravity, this.groundLevel, this.canvas.width);
    this.player2.update(this.c, this.gravity, this.groundLevel, this.canvas.width);

    // Collision Detection: Player 1 attacking Player 2
    if (
      this.checkCollision(this.player1.attackBox, this.player2) &&
      this.player1.isAttacking &&
      (
        (this.player1.attackType === 1 && this.player1.framesCurrent === 4) ||
        (this.player1.attackType === 2 && this.player1.framesCurrent === 1)
      )
    ) {
      this.player1.isAttacking = false;
      const damage = this.player1.attackType === 2 ? 22 : 16;
      this.player2.takeHit(damage);
      this.updateHud();
      window.sounds?.playExplosion?.();
      this.syncToMobile?.(2, 'haptic', { pattern: [40, 30, 80] });
    }

    if (
      (this.player1.attackType === 1 && this.player1.framesCurrent === 5) ||
      (this.player1.attackType === 2 && this.player1.framesCurrent === 2)
    ) {
      this.player1.isAttacking = false;
    }

    // Collision Detection: Player 2 attacking Player 1
    if (
      this.checkCollision(this.player2.attackBox, this.player1) &&
      this.player2.isAttacking &&
      this.player2.framesCurrent === 2
    ) {
      this.player2.isAttacking = false;
      this.player1.takeHit(15);
      this.updateHud();
      window.sounds?.playExplosion?.();
      this.syncToMobile?.(1, 'haptic', { pattern: [40, 30, 80] });
    }

    if (this.player2.isAttacking && this.player2.framesCurrent === 3) {
      this.player2.isAttacking = false;
    }

    // Check for Knockout
    if ((this.player1.health <= 0 || this.player2.health <= 0) && !this.isOver) {
      this.determineWinner();
    }
  }

  updateHud() {
    const p1Bar = document.getElementById('p1-hp-bar');
    const p2Bar = document.getElementById('p2-hp-bar');
    const p1Text = document.getElementById('p1-hp-text');
    const p2Text = document.getElementById('p2-hp-text');

    if (p1Bar) p1Bar.style.width = `${Math.max(0, this.player1.health)}%`;
    if (p2Bar) p2Bar.style.width = `${Math.max(0, this.player2.health)}%`;
    if (p1Text) p1Text.textContent = `${Math.max(0, this.player1.health)} HP`;
    if (p2Text) p2Text.textContent = `${Math.max(0, this.player2.health)} HP`;

    // Sync HP to phone controllers
    this.syncToMobile?.(1, 'hp', { hp: this.player1.health });
    this.syncToMobile?.(2, 'hp', { hp: this.player2.health });
  }

  determineWinner() {
    this.isOver = true;
    clearInterval(this.timerId);

    const banner = document.getElementById('fight-result-banner');
    const winnerText = document.getElementById('fight-result-winner');

    let winnerNum = null;
    let winnerName = 'TIE MATCH!';
    if (this.player1.health > this.player2.health) {
      winnerNum = 1;
      winnerName = '🏆 PLAYER 1 (CYBORG RAIDER) WINS!';
    } else if (this.player2.health > this.player1.health) {
      winnerNum = 2;
      winnerName = '🏆 PLAYER 2 (NINJA KENJI) WINS!';
    }

    if (banner) banner.classList.remove('hidden');
    if (winnerText) winnerText.textContent = winnerName;

    if (winnerNum) {
      this.onScoreUpdate?.(winnerNum, 1);
    }
  }

  restartRound() {
    this.isOver = false;
    this.player1.health = 100;
    this.player2.health = 100;
    this.player1.isDead = false;
    this.player2.isDead = false;
    this.player1.position = { x: 180, y: 300 };
    this.player2.position = { x: 740, y: 300 };
    this.player1.velocity = { x: 0, y: 0 };
    this.player2.velocity = { x: 0, y: 0 };
    this.player1.switchSprite('idle');
    this.player2.switchSprite('idle');
    this.player1.facing = 'right';
    this.player2.facing = 'left';

    const banner = document.getElementById('fight-result-banner');
    if (banner) banner.classList.add('hidden');

    this.updateHud();
    this.startTimer();
  }

  start() {}
  startCountdown(cb) { if (cb) cb(); }
  stop() {
    this.destroyed = true;
    clearInterval(this.timerId);
  }
}
