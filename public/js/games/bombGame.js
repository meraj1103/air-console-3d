// 💣 SUPER BOMB BRAWLERS 3D (Party Bomberman Engine)
import * as THREE from '/vendor/three/three.module.js';

export class BombGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    // Grid Dimensions (13 x 11 tiles)
    this.cols = 13;
    this.rows = 11;
    this.tileSize = 3.6;

    this.grid = []; // 0: empty, 1: solid wall, 2: destructible crate
    this.crates = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];
    this.particles = [];

    this.roundActive = false;
    this.scores = { 1: 0, 2: 0 };
    this.players = {};

    this.initThree();
    this.buildArena();
    this.spawnPlayers();
    this.bindResize();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070b16, 0.015);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || (window.innerHeight - 64);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 48, 38);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Warm, vibrant lighting
    const ambientLight = new THREE.AmbientLight(0x283650, 2.2);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    sunLight.position.set(20, 60, 30);
    this.scene.add(sunLight);

    const cyanRim = new THREE.PointLight(0x00f0ff, 3.0, 50);
    cyanRim.position.set(-25, 10, -20);
    this.scene.add(cyanRim);

    const pinkRim = new THREE.PointLight(0xff0055, 3.0, 50);
    pinkRim.position.set(25, 10, 20);
    this.scene.add(pinkRim);
  }

  gridToWorld(col, row) {
    const x = (col - (this.cols - 1) / 2) * this.tileSize;
    const z = (row - (this.rows - 1) / 2) * this.tileSize;
    return { x, z };
  }

  worldToGrid(x, z) {
    const col = Math.round(x / this.tileSize + (this.cols - 1) / 2);
    const row = Math.round(z / this.tileSize + (this.rows - 1) / 2);
    return { col: THREE.MathUtils.clamp(col, 0, this.cols - 1), row: THREE.MathUtils.clamp(row, 0, this.rows - 1) };
  }

  buildArena() {
    const arenaW = this.cols * this.tileSize;
    const arenaD = this.rows * this.tileSize;

    // Floor Platform
    const floorGeo = new THREE.BoxGeometry(arenaW + 4, 1.2, arenaD + 4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1220,
      metalness: 0.8,
      roughness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    this.scene.add(floor);

    // Glowing Grid
    const grid = new THREE.GridHelper(arenaW, this.cols, 0x00f0ff, 0x182845);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Outer Glowing Boundary Wall
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x121a2d,
      roughness: 0.15,
      metalness: 0.85,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.3
    });

    const hw = arenaW / 2 + 1;
    const hd = arenaD / 2 + 1;

    const makeBorder = (w, h, d, x, z, col) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      b.position.set(x, h / 2, z);
      this.scene.add(b);

      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), new THREE.MeshBasicMaterial({ color: col }));
      neonStrip.position.set(x, h, z);
      this.scene.add(neonStrip);
    };

    makeBorder(arenaW + 4, 2.5, 1.5, 0, -hd, 0x00f0ff);
    makeBorder(arenaW + 4, 2.5, 1.5, 0, hd, 0xff0055);
    makeBorder(1.5, 2.5, arenaD + 4, -hw, 0, 0x00f0ff);
    makeBorder(1.5, 2.5, arenaD + 4, hw, 0, 0xff0055);

    // Generate Pillars & Destructible Crates
    this.grid = Array(this.rows).fill(0).map(() => Array(this.cols).fill(0));

    // Indestructible Cyber Pillars (every alternate tile)
    for (let r = 1; r < this.rows - 1; r += 2) {
      for (let c = 1; c < this.cols - 1; c += 2) {
        this.grid[r][c] = 1; // Solid
        const { x, z } = this.gridToWorld(c, r);

        const pillarGeo = new THREE.BoxGeometry(this.tileSize * 0.9, 2.8, this.tileSize * 0.9);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x141f36,
          metalness: 0.9,
          roughness: 0.1,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.25
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(x, 1.4, z);

        const wire = new THREE.LineSegments(new THREE.EdgesGeometry(pillarGeo), new THREE.LineBasicMaterial({ color: 0x00f0ff }));
        pillar.add(wire);

        this.scene.add(pillar);
      }
    }

    // Populate Destructible Crates (avoiding player spawn corners)
    this.populateCrates();
  }

  populateCrates() {
    this.crates.forEach(c => this.scene.remove(c.mesh));
    this.crates = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Safe spawn corners for P1 (0,0; 1,0; 0,1) and P2 (cols-1, rows-1; etc)
        const isP1Spawn = (c <= 1 && r <= 1);
        const isP2Spawn = (c >= this.cols - 2 && r >= this.rows - 2);

        if (!isP1Spawn && !isP2Spawn && this.grid[r][c] === 0) {
          if (Math.random() < 0.65) {
            this.grid[r][c] = 2; // Crate
            const { x, z } = this.gridToWorld(c, r);

            const crateGeo = new THREE.BoxGeometry(this.tileSize * 0.88, 2.2, this.tileSize * 0.88);
            const crateMat = new THREE.MeshStandardMaterial({
              color: 0x221a36,
              emissive: 0xff0055,
              emissiveIntensity: 0.45,
              metalness: 0.7,
              roughness: 0.3
            });
            const crateMesh = new THREE.Mesh(crateGeo, crateMat);
            crateMesh.position.set(x, 1.1, z);

            const wire = new THREE.LineSegments(new THREE.EdgesGeometry(crateGeo), new THREE.LineBasicMaterial({ color: 0xff88aa }));
            crateMesh.add(wire);

            this.scene.add(crateMesh);
            this.crates.push({ col: c, row: r, mesh: crateMesh });
          }
        }
      }
    }
  }

  createMechaCharacter(colorHex) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.9, 1.1, 1.8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x161e30,
      metalness: 0.8,
      roughness: 0.2,
      emissive: colorHex,
      emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    group.add(body);

    // Glowing Visor
    const headGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x070b14,
      clearcoat: 1.0,
      emissive: colorHex,
      emissiveIntensity: 0.8
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.2;
    group.add(head);

    // Light
    const pl = new THREE.PointLight(colorHex, 2.5, 8);
    pl.position.y = 2.0;
    group.add(pl);

    return group;
  }

  spawnPlayers() {
    // Player 1 (Top Left)
    const p1Mesh = this.createMechaCharacter(0x00f0ff);
    this.scene.add(p1Mesh);
    const p1Pos = this.gridToWorld(0, 0);

    this.players[1] = {
      id: 1,
      mesh: p1Mesh,
      x: p1Pos.x,
      z: p1Pos.z,
      col: 0,
      row: 0,
      speed: 0.22,
      maxBombs: 1,
      activeBombs: 0,
      bombRange: 2,
      alive: true,
      input: { x: 0, y: 0, bomb: false }
    };

    // Player 2 (Bottom Right)
    const p2Mesh = this.createMechaCharacter(0xff0055);
    this.scene.add(p2Mesh);
    const p2Pos = this.gridToWorld(this.cols - 1, this.rows - 1);

    this.players[2] = {
      id: 2,
      mesh: p2Mesh,
      x: p2Pos.x,
      z: p2Pos.z,
      col: this.cols - 1,
      row: this.rows - 1,
      speed: 0.22,
      maxBombs: 1,
      activeBombs: 0,
      bombRange: 2,
      alive: true,
      input: { x: 0, y: 0, bomb: false }
    };

    this.resetRound();
  }

  resetRound() {
    const p1Pos = this.gridToWorld(0, 0);
    this.players[1].x = p1Pos.x;
    this.players[1].z = p1Pos.z;
    this.players[1].alive = true;
    this.players[1].mesh.visible = true;
    this.players[1].activeBombs = 0;
    this.players[1].maxBombs = 1;
    this.players[1].bombRange = 2;

    const p2Pos = this.gridToWorld(this.cols - 1, this.rows - 1);
    this.players[2].x = p2Pos.x;
    this.players[2].z = p2Pos.z;
    this.players[2].alive = true;
    this.players[2].mesh.visible = true;
    this.players[2].activeBombs = 0;
    this.players[2].maxBombs = 1;
    this.players[2].bombRange = 2;

    // Clear bombs and explosions
    this.bombs.forEach(b => this.scene.remove(b.mesh));
    this.bombs = [];
    this.explosions.forEach(e => this.scene.remove(e.mesh));
    this.explosions = [];

    this.populateCrates();
  }

  startCountdown(onFinished) {
    let count = 3;
    const overlay = document.getElementById('countdown-overlay');
    const textEl = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');

    const tick = () => {
      if (count > 0) {
        textEl.textContent = count;
        textEl.className = 'font-orbitron font-black text-8xl text-pink-400 drop-shadow-[0_0_35px_#ff0055] animate-pulse';
        window.sounds?.playCountdown(count);
        count--;
        setTimeout(tick, 900);
      } else {
        textEl.textContent = 'BRAWL!';
        textEl.className = 'font-orbitron font-black text-9xl text-yellow-300 drop-shadow-[0_0_45px_#ffff00] scale-125';
        window.sounds?.playCountdown(0);
        setTimeout(() => {
          overlay.classList.add('hidden');
          this.roundActive = true;
          if (onFinished) onFinished();
        }, 700);
      }
    };
    tick();
  }

  handlePlayerInput(playerNumber, input) {
    const p = this.players[playerNumber];
    if (!p) return;

    p.input = {
      x: input.x || 0,
      y: input.y || 0,
      bomb: !!(input.fire || input.btnA)
    };

    if (p.input.bomb) {
      this.placeBomb(p);
    }
  }

  placeBomb(player) {
    if (!this.roundActive || !player.alive || player.activeBombs >= player.maxBombs) return;

    const { col, row } = this.worldToGrid(player.x, player.z);

    // Can't place two bombs on the same tile
    if (this.bombs.some(b => b.col === col && b.row === row)) return;

    player.activeBombs++;
    window.sounds?.playClick();
    this.syncToMobile(player.id, 'haptic', { pattern: [25] });

    const { x, z } = this.gridToWorld(col, row);

    // 3D Glowing Bomb Mesh
    const bombGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      emissive: player.id === 1 ? 0x00f0ff : 0xff0055,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1
    });
    const bombMesh = new THREE.Mesh(sphereGeo, sphereMat);
    bombMesh.position.y = 1.0;
    bombGroup.add(bombMesh);

    // Fuse light
    const fuseLight = new THREE.PointLight(0xffcc00, 3.0, 6);
    fuseLight.position.y = 2.2;
    bombGroup.add(fuseLight);

    bombGroup.position.set(x, 0, z);
    this.scene.add(bombGroup);

    this.bombs.push({
      col,
      row,
      x,
      z,
      ownerId: player.id,
      range: player.bombRange,
      mesh: bombGroup,
      timer: 130 // ~2.2 seconds
    });
  }

  detonateBomb(bombIndex) {
    const bomb = this.bombs[bombIndex];
    if (!bomb) return;

    const owner = this.players[bomb.ownerId];
    if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

    this.scene.remove(bomb.mesh);
    this.bombs.splice(bombIndex, 1);

    window.sounds?.playExplosion();

    // 4-directional explosion lines
    const directions = [
      { dc: 0, dr: 0 },   // center
      { dc: 1, dr: 0 },   // East
      { dc: -1, dr: 0 },  // West
      { dc: 0, dr: 1 },   // South
      { dc: 0, dr: -1 }   // North
    ];

    directions.forEach(dir => {
      for (let dist = 1; dist <= (dir.dc === 0 && dir.dr === 0 ? 0 : bomb.range); dist++) {
        const c = bomb.col + dir.dc * dist;
        const r = bomb.row + dir.dr * dist;

        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) break;
        if (this.grid[r][c] === 1) break; // blocked by solid pillar

        this.spawnExplosionBeam(c, r);

        // If hits a destructible crate
        if (this.grid[r][c] === 2) {
          this.destroyCrate(c, r);
          break; // explosion stops at crate
        }

        // If hits another bomb -> chain reaction!
        const chainedBombIdx = this.bombs.findIndex(b => b.col === c && b.row === r);
        if (chainedBombIdx !== -1) {
          this.detonateBomb(chainedBombIdx);
        }
      }
    });

    if (directions[0]) {
      this.spawnExplosionBeam(bomb.col, bomb.row);
    }
  }

  spawnExplosionBeam(col, row) {
    const { x, z } = this.gridToWorld(col, row);

    const geo = new THREE.BoxGeometry(this.tileSize * 0.95, 2.4, this.tileSize * 0.95);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.2, z);
    this.scene.add(mesh);

    this.explosions.push({ mesh, life: 18 });

    // Check if player hit by blast
    [1, 2].forEach(id => {
      const p = this.players[id];
      if (p.alive) {
        const pGrid = this.worldToGrid(p.x, p.z);
        if (pGrid.col === col && pGrid.row === row) {
          this.eliminatePlayer(p);
        }
      }
    });
  }

  destroyCrate(col, row) {
    this.grid[row][col] = 0;
    const idx = this.crates.findIndex(c => c.col === col && c.row === row);
    if (idx !== -1) {
      this.scene.remove(this.crates[idx].mesh);
      this.crates.splice(idx, 1);
    }

    // 40% chance to drop powerup
    if (Math.random() < 0.45) {
      this.spawnPowerup(col, row);
    }
  }

  spawnPowerup(col, row) {
    const { x, z } = this.gridToWorld(col, row);
    const type = Math.random() > 0.5 ? 'bomb' : 'fire';

    const geo = new THREE.OctahedronGeometry(0.8);
    const mat = new THREE.MeshBasicMaterial({ color: type === 'bomb' ? 0x00f0ff : 0xff3b30 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.8, z);
    this.scene.add(mesh);

    this.powerups.push({ col, row, type, mesh });
  }

  eliminatePlayer(player) {
    player.alive = false;
    player.mesh.visible = false;
    window.sounds?.playExplosion();
    this.syncToMobile(player.id, 'haptic', { pattern: [200, 100, 300] });

    const winnerId = player.id === 1 ? 2 : 1;
    this.scores[winnerId]++;
    this.onScoreUpdate(this.scores);
    this.syncToMobile(winnerId, 'haptic', { pattern: [60, 40, 120] });

    setTimeout(() => {
      if (this.scores[winnerId] >= 3) {
        this.onRoundEnd(winnerId, true);
      } else {
        this.resetRound();
        this.startCountdown();
      }
    }, 2000);
  }

  updatePhysics() {
    if (!this.roundActive) return;

    // Move Players with Grid Wall Collisions
    [1, 2].forEach(id => {
      const p = this.players[id];
      if (!p.alive) return;

      const ix = p.input.x;
      const iy = p.input.y;

      if (Math.hypot(ix, iy) > 0.2) {
        const nextX = p.x + ix * p.speed;
        const nextZ = p.z + iy * p.speed;

        // Collision box check against grid pillars and crates
        const rad = 1.1;
        const g1 = this.worldToGrid(nextX + rad, p.z);
        const g2 = this.worldToGrid(nextX - rad, p.z);
        const g3 = this.worldToGrid(p.x, nextZ + rad);
        const g4 = this.worldToGrid(p.x, nextZ - rad);

        const canMoveX = this.grid[g1.row]?.[g1.col] === 0 && this.grid[g2.row]?.[g2.col] === 0;
        const canMoveZ = this.grid[g3.row]?.[g3.col] === 0 && this.grid[g4.row]?.[g4.col] === 0;

        if (canMoveX) p.x = nextX;
        if (canMoveZ) p.z = nextZ;

        p.mesh.rotation.y = Math.atan2(ix, iy);
      }

      p.mesh.position.set(p.x, 0, p.z);

      // Powerup Pickup
      const pGrid = this.worldToGrid(p.x, p.z);
      const puIdx = this.powerups.findIndex(pu => pu.col === pGrid.col && pu.row === pGrid.row);
      if (puIdx !== -1) {
        const pu = this.powerups[puIdx];
        if (pu.type === 'bomb') p.maxBombs++;
        else p.bombRange++;

        window.sounds?.playPowerup();
        this.scene.remove(pu.mesh);
        this.powerups.splice(puIdx, 1);
        this.syncToMobile(p.id, 'haptic', { pattern: [40, 60] });
      }
    });

    // Update Bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.timer--;
      b.mesh.scale.setScalar(1 + Math.sin(Date.now() * 0.02) * 0.12); // Pulse
      if (b.timer <= 0) {
        this.detonateBomb(i);
      }
    }

    // Update Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life--;
      exp.mesh.material.opacity = exp.life / 18;
      if (exp.life <= 0) {
        this.scene.remove(exp.mesh);
        this.explosions.splice(i, 1);
      }
    }
  }

  start() {
    if (this.animId) cancelAnimationFrame(this.animId);
    const loop = () => {
      this.updatePhysics();
      this.renderer.render(this.scene, this.camera);
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  bindResize() {
    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer || !this.camera) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });
  }
}
