// 🚀 CYBER TANK SHOWDOWN 3D (Overhauled Action Brawler)
import * as THREE from '/vendor/three/three.module.js';

export class TankGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    // Compact, high-action arena
    this.arenaWidth = 44;
    this.arenaDepth = 32;

    this.roundActive = false;
    this.scores = { 1: 0, 2: 0 };
    this.targetScore = 3;
    this.round = 1;

    this.players = {};
    this.bullets = [];
    this.particles = [];
    this.powerups = [];
    this.obstacles = [];
    this.shakeAmount = 0;
    this.lastTime = performance.now();

    // AI bot control if P2 is not connected
    this.p2IsBot = false;

    this.initThree();
    this.buildArena();
    this.createPlayers();
    this.bindResize();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060914, 0.015);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || (window.innerHeight - 64);

    // Close, dynamic camera
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    this.camera.position.set(0, 28, 26);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Vibrant Lighting
    const ambientLight = new THREE.AmbientLight(0x2d3a54, 2.2);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
    sunLight.position.set(20, 50, 30);
    this.scene.add(sunLight);

    const cyanPoint = new THREE.PointLight(0x00f0ff, 3.5, 40);
    cyanPoint.position.set(-18, 8, -12);
    this.scene.add(cyanPoint);

    const pinkPoint = new THREE.PointLight(0xff0055, 3.5, 40);
    pinkPoint.position.set(18, 8, 12);
    this.scene.add(pinkPoint);
  }

  buildArena() {
    // Reflective Cyber Floor
    const floorGeo = new THREE.BoxGeometry(this.arenaWidth, 1.2, this.arenaDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a101d,
      roughness: 0.15,
      metalness: 0.85
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.6;
    this.scene.add(floor);

    // Glowing Grid
    const grid = new THREE.GridHelper(this.arenaWidth, 22, 0x00f0ff, 0x162540);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Outer Neon Perimeter Walls
    const wallHeight = 2.4;
    const wallThick = 1.4;
    const hw = this.arenaWidth / 2;
    const hd = this.arenaDepth / 2;

    const createBorder = (w, h, d, x, z, col) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0x121929,
          roughness: 0.2,
          metalness: 0.8,
          emissive: col,
          emissiveIntensity: 0.35
        })
      );
      b.position.set(x, h / 2, z);
      this.scene.add(b);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), new THREE.MeshBasicMaterial({ color: col }));
      strip.position.set(x, h, z);
      this.scene.add(strip);
    };

    createBorder(this.arenaWidth + wallThick * 2, wallHeight, wallThick, 0, -hd, 0x00f0ff);
    createBorder(this.arenaWidth + wallThick * 2, wallHeight, wallThick, 0, hd, 0xff0055);
    createBorder(wallThick, wallHeight, this.arenaDepth, -hw, 0, 0x00f0ff);
    createBorder(wallThick, wallHeight, this.arenaDepth, hw, 0, 0xff0055);

    // Tactical Neon Pillars
    this.buildObstacles();
  }

  buildObstacles() {
    const obstacleData = [
      { x: -10, z: -5, w: 3.5, h: 3.2, d: 3.5, col: 0x00f0ff },
      { x: 10, z: 5, w: 3.5, h: 3.2, d: 3.5, col: 0xff0055 },
      { x: 0, z: 0, w: 4.5, h: 3.2, d: 4.5, col: 0xffe600 }
    ];

    obstacleData.forEach(obs => {
      const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x152033,
        roughness: 0.15,
        metalness: 0.85,
        emissive: obs.col,
        emissiveIntensity: 0.4
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      this.scene.add(mesh);

      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: obs.col }));
      mesh.add(wire);

      this.obstacles.push({ x: obs.x, z: obs.z, w: obs.w, d: obs.d, col: obs.col, mesh });
    });
  }

  createTankMesh(primaryColorHex, emissiveColorHex) {
    const group = new THREE.Group();

    // Chunky Armored Tank Body
    const bodyGeo = new THREE.BoxGeometry(4.2, 1.4, 5.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x161d2c,
      roughness: 0.2,
      metalness: 0.85,
      emissive: emissiveColorHex,
      emissiveIntensity: 0.45
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    group.add(body);

    // Glowing Neon Stripes
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.26, 0.35, 5.05),
      new THREE.MeshBasicMaterial({ color: primaryColorHex })
    );
    stripe.position.y = 1.0;
    group.add(stripe);

    // Cockpit
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x050912,
        clearcoat: 1.0,
        roughness: 0.1,
        emissive: primaryColorHex,
        emissiveIntensity: 0.4
      })
    );
    cockpit.position.set(0, 1.8, -0.3);
    group.add(cockpit);

    // Double-Barrel Rotating Plasma Cannon Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.8, 0);

    const barrelGeo = new THREE.CylinderGeometry(0.3, 0.35, 3.6, 16);
    barrelGeo.rotateX(Math.PI / 2);

    const leftBarrel = new THREE.Mesh(
      barrelGeo,
      new THREE.MeshStandardMaterial({ color: 0x222a3d, metalness: 0.9, roughness: 0.2, emissive: primaryColorHex, emissiveIntensity: 0.6 })
    );
    leftBarrel.position.set(-0.55, 0, 1.8);
    turretGroup.add(leftBarrel);

    const rightBarrel = new THREE.Mesh(
      barrelGeo,
      new THREE.MeshStandardMaterial({ color: 0x222a3d, metalness: 0.9, roughness: 0.2, emissive: primaryColorHex, emissiveIntensity: 0.6 })
    );
    rightBarrel.position.set(0.55, 0, 1.8);
    turretGroup.add(rightBarrel);

    group.add(turretGroup);

    // Left & Right Cyber Treads
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x0c111a, roughness: 0.8, metalness: 0.5 });
    const treadGeo = new THREE.BoxGeometry(0.8, 0.9, 5.4);

    const leftTread = new THREE.Mesh(treadGeo, treadMat);
    leftTread.position.set(-2.4, 0.6, 0);
    group.add(leftTread);

    const rightTread = new THREE.Mesh(treadGeo, treadMat);
    rightTread.position.set(2.4, 0.6, 0);
    group.add(rightTread);

    // Force Field Shield Bubble
    const shieldGeo = new THREE.SphereGeometry(4.2, 24, 24);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: primaryColorHex,
      transparent: true,
      opacity: 0,
      clearcoat: 1.0,
      emissive: primaryColorHex,
      emissiveIntensity: 0.8
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 1.2;
    group.add(shieldMesh);

    // Light
    const pointLight = new THREE.PointLight(primaryColorHex, 2.5, 12);
    pointLight.position.set(0, 1.5, 0);
    group.add(pointLight);

    return {
      mesh: group,
      turret: turretGroup,
      shieldMesh,
      light: pointLight
    };
  }

  createPlayers() {
    // Player 1 (Cyan)
    const p1 = this.createTankMesh(0x00f0ff, 0x004466);
    this.scene.add(p1.mesh);
    this.players[1] = {
      id: 1,
      alive: true,
      name: 'Player 1',
      color: '#00f0ff',
      ...p1,
      x: -14,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      targetAngle: 0,
      hp: 100,
      maxHp: 100,
      boostEnergy: 100,
      isBoosting: false,
      shieldActive: false,
      shieldTimer: 0,
      shieldCooldown: 0,
      fireCooldown: 0,
      input: { x: 0, y: 0, fire: false, boost: false, shield: false }
    };

    // Player 2 (Magenta)
    const p2 = this.createTankMesh(0xff0055, 0x660022);
    this.scene.add(p2.mesh);
    this.players[2] = {
      id: 2,
      alive: true,
      name: 'Player 2',
      color: '#ff0055',
      ...p2,
      x: 14,
      z: 0,
      vx: 0,
      vz: 0,
      angle: Math.PI,
      targetAngle: Math.PI,
      hp: 100,
      maxHp: 100,
      boostEnergy: 100,
      isBoosting: false,
      shieldActive: false,
      shieldTimer: 0,
      shieldCooldown: 0,
      fireCooldown: 0,
      input: { x: 0, y: 0, fire: false, boost: false, shield: false }
    };

    this.resetRoundPositions();
  }

  resetRoundPositions() {
    const p1 = this.players[1];
    p1.alive = true;
    p1.x = -14;
    p1.z = 0;
    p1.vx = 0;
    p1.vz = 0;
    p1.angle = 0;
    p1.targetAngle = 0;
    p1.hp = 100;
    p1.boostEnergy = 100;
    p1.shieldActive = false;
    p1.shieldMesh.material.opacity = 0;
    p1.mesh.visible = true;

    const p2 = this.players[2];
    p2.alive = true;
    p2.x = 14;
    p2.z = 0;
    p2.vx = 0;
    p2.vz = 0;
    p2.angle = Math.PI;
    p2.targetAngle = Math.PI;
    p2.hp = 100;
    p2.boostEnergy = 100;
    p2.shieldActive = false;
    p2.shieldMesh.material.opacity = 0;
    p2.mesh.visible = true;

    this.bullets.forEach(b => this.scene.remove(b.mesh));
    this.bullets = [];

    this.particles.forEach(pt => this.scene.remove(pt.mesh));
    this.particles = [];

    this.syncPlayerHud(1);
    this.syncPlayerHud(2);
  }

  startCountdown(onFinished) {
    let count = 3;
    const overlay = document.getElementById('countdown-overlay');
    const textEl = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');

    const tick = () => {
      if (count > 0) {
        textEl.textContent = count;
        textEl.className = 'font-orbitron font-black text-8xl text-cyan-400 drop-shadow-[0_0_35px_#00f0ff] animate-pulse';
        window.sounds?.playCountdown(count);
        count--;
        setTimeout(tick, 900);
      } else {
        textEl.textContent = 'FIGHT!';
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
      fire: !!(input.fire || input.btnA),
      boost: !!(input.boost || input.btnY),
      shield: !!(input.shield || input.btnX)
    };
  }

  fireLaser(p) {
    if (!this.roundActive || p.hp <= 0 || p.fireCooldown > 0) return;
    p.fireCooldown = 18; // Controlled fire rate
    window.sounds?.playLaser(p.id);
    this.syncToMobile(p.id, 'haptic', { pattern: [25] });

    const spawnBullet = (offset) => {
      const geo = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 8);
      geo.rotateX(Math.PI / 2);
      const color = p.id === 1 ? 0x00f0ff : 0xff0055;
      const mat = new THREE.MeshBasicMaterial({ color });
      const bullet = new THREE.Mesh(geo, mat);

      const spawnDist = 3.6;
      const bx = p.x + Math.sin(p.angle) * spawnDist + Math.cos(p.angle) * offset;
      const bz = p.z + Math.cos(p.angle) * spawnDist - Math.sin(p.angle) * offset;
      bullet.position.set(bx, 1.6, bz);
      bullet.rotation.y = p.angle;
      this.scene.add(bullet);

      const speed = 0.95;
      this.bullets.push({
        mesh: bullet,
        ownerId: p.id,
        color,
        vx: Math.sin(p.angle) * speed,
        vz: Math.cos(p.angle) * speed,
        life: 75
      });
    };

    spawnBullet(-0.55);
    spawnBullet(0.55);
  }

  spawnImpactSparks(x, y, z, colorHex) {
    const sparkCount = 8;
    const geo = new THREE.SphereGeometry(0.18, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex || 0xffe600 });

    for (let i = 0; i < sparkCount; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      this.scene.add(p);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.25 + Math.random() * 0.4;
      this.particles.push({
        mesh: p,
        vx: Math.cos(angle) * speed,
        vy: 0.12 + Math.random() * 0.3,
        vz: Math.sin(angle) * speed,
        life: 20
      });
    }
  }

  activateShield(p) {
    if (p.shieldCooldown > 0 || p.shieldActive || p.hp <= 0) return;
    p.shieldActive = true;
    p.shieldTimer = 140;
    p.shieldCooldown = 320;
    window.sounds?.playShield();
    this.syncToMobile(p.id, 'haptic', { pattern: [40, 30, 40] });
  }

  destroyTank(p) {
    this.roundActive = false;
    p.alive = false;
    window.sounds?.playExplosion();
    this.shakeAmount = 25;
    p.mesh.visible = false;

    this.spawnImpactSparks(p.x, 1.5, p.z, p.id === 1 ? 0x00f0ff : 0xff0055);
    this.spawnImpactSparks(p.x, 1.5, p.z, 0xffa500);

    this.syncToMobile(p.id, 'haptic', { pattern: [150, 80, 200, 100, 300] });

    const winnerId = p.id === 1 ? 2 : 1;
    this.scores[winnerId]++;
    this.onScoreUpdate(this.scores);
    this.syncToMobile(winnerId, 'haptic', { pattern: [60, 40, 120] });

    setTimeout(() => {
      p.mesh.visible = true;
      if (this.scores[winnerId] >= this.targetScore) {
        this.onRoundEnd(winnerId, true);
      } else {
        this.round++;
        this.resetRoundPositions();
        this.startCountdown();
      }
    }, 2000);
  }

  syncPlayerHud(playerNumber) {
    const p = this.players[playerNumber];
    if (!p) return;

    const hpBar = document.getElementById(`p${playerNumber}-hp-bar`);
    const hpText = document.getElementById(`p${playerNumber}-hp-text`);
    const boostBar = document.getElementById(`p${playerNumber}-boost-bar`);

    if (hpBar) hpBar.style.width = `${Math.max(0, p.hp)}%`;
    if (hpText) hpText.textContent = `${Math.max(0, p.hp)} HP`;
    if (boostBar) boostBar.style.width = `${p.boostEnergy}%`;

    this.syncToMobile(playerNumber, 'status-sync', {
      hp: p.hp,
      boostEnergy: Math.floor(p.boostEnergy),
      shieldActive: p.shieldActive,
      shieldCooldown: Math.ceil(p.shieldCooldown / 60)
    });
  }

  updateAI(dt = 1.0) {
    const bot = this.players[2];
    const target = this.players[1];
    if (!this.p2IsBot || !bot || !bot.alive || bot.hp <= 0) return;

    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.hypot(dx, dz);
    const targetAngle = Math.atan2(dx, dz);

    bot.targetAngle = targetAngle;

    if (dist > 12) {
      bot.input.x = Math.sin(targetAngle);
      bot.input.y = Math.cos(targetAngle);
    } else {
      // Strafe around player
      bot.input.x = Math.cos(targetAngle) * 0.7;
      bot.input.y = -Math.sin(targetAngle) * 0.7;
    }

    // Fire laser if roughly facing target
    if (Math.abs(bot.angle - targetAngle) < 0.4 && Math.random() < 0.05 * dt) {
      this.fireLaser(bot);
    }

    // Shield if close and low HP
    if (dist < 8 && bot.hp < 50 && bot.shieldCooldown <= 0) {
      this.activateShield(bot);
    }
  }

  updatePhysics(dt = 1.0) {
    if (this.p2IsBot) {
      this.updateAI(dt);
    }

    const maxBoundX = this.arenaWidth / 2 - 2.8;
    const maxBoundZ = this.arenaDepth / 2 - 2.8;

    [1, 2].forEach(id => {
      const p = this.players[id];
      if (!p.alive || p.hp <= 0) return;

      if (p.fireCooldown > 0) p.fireCooldown -= dt;
      if (p.shieldTimer > 0) {
        p.shieldTimer -= dt;
        p.shieldMesh.material.opacity = 0.5 + Math.sin(Date.now() * 0.02) * 0.2;
        if (p.shieldTimer <= 0) {
          p.shieldActive = false;
          p.shieldMesh.material.opacity = 0;
        }
      }
      if (p.shieldCooldown > 0) p.shieldCooldown -= dt;

      if (p.input.fire) this.fireLaser(p);
      if (p.input.shield) this.activateShield(p);

      let accel = 0.038 * dt;
      let topSpeed = 0.42;

      if (p.input.boost && p.boostEnergy > 10) {
        p.isBoosting = true;
        topSpeed = 0.65;
        accel = 0.065 * dt;
        p.boostEnergy = Math.max(0, p.boostEnergy - 0.7 * dt);
      } else {
        p.isBoosting = false;
        p.boostEnergy = Math.min(100, p.boostEnergy + 0.3 * dt);
      }

      const ix = p.input.x;
      const iy = p.input.y;
      if (Math.hypot(ix, iy) > 0.15) {
        p.targetAngle = Math.atan2(ix, iy);
        p.vx += ix * accel;
        p.vz += iy * accel;

        // Clamp to top speed
        const currentSpeed = Math.hypot(p.vx, p.vz);
        if (currentSpeed > topSpeed) {
          p.vx = (p.vx / currentSpeed) * topSpeed;
          p.vz = (p.vz / currentSpeed) * topSpeed;
        }
      }

      // Smooth damping / friction
      const friction = Math.pow(0.88, dt);
      p.vx *= friction;
      p.vz *= friction;

      p.x += p.vx * dt;
      p.z += p.vz * dt;

      // 1. Hard Arena Boundary Clamping (Zero velocity outwards into walls)
      if (p.x < -maxBoundX) { p.x = -maxBoundX; if (p.vx < 0) p.vx = 0; }
      if (p.x > maxBoundX)  { p.x = maxBoundX;  if (p.vx > 0) p.vx = 0; }
      if (p.z < -maxBoundZ) { p.z = -maxBoundZ; if (p.vz < 0) p.vz = 0; }
      if (p.z > maxBoundZ)  { p.z = maxBoundZ;  if (p.vz > 0) p.vz = 0; }

      // 2. Solid SAT Obstacle Collision Resolution
      this.obstacles.forEach(obs => {
        const halfW = obs.w / 2 + 2.1;
        const halfD = obs.d / 2 + 2.1;
        const dx = p.x - obs.x;
        const dz = p.z - obs.z;
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);

        if (overlapX > 0 && overlapZ > 0) {
          if (overlapX < overlapZ) {
            p.x = obs.x + Math.sign(dx) * halfW;
            p.vx = 0;
          } else {
            p.z = obs.z + Math.sign(dz) * halfD;
            p.vz = 0;
          }
        }
      });

      // 3. Smooth Body Rotation
      let diff = p.targetAngle - p.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      p.angle += diff * Math.min(1.0, 0.18 * dt);

      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.angle;
    });

    // 4. Tank vs Tank Bumper Collision
    const p1 = this.players[1];
    const p2 = this.players[2];
    if (p1 && p2 && p1.alive && p2.alive && p1.hp > 0 && p2.hp > 0) {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const dist = Math.hypot(dx, dz);
      const minDist = 4.4;
      if (dist < minDist && dist > 0.001) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        p1.x -= nx * overlap;
        p1.z -= nz * overlap;
        p2.x += nx * overlap;
        p2.z += nz * overlap;

        // Bumper bounce impulse
        p1.vx -= nx * 0.12;
        p1.vz -= nz * 0.12;
        p2.vx += nx * 0.12;
        p2.vz += nz * 0.12;
      }
    }

    // 5. Bullets Update (Impact on wall/obstacle/tank - NO infinite bouncing)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.z += b.vz * dt;
      b.life -= dt;

      // Check perimeter wall hit
      if (Math.abs(b.mesh.position.x) >= maxBoundX + 0.6 || Math.abs(b.mesh.position.z) >= maxBoundZ + 0.6) {
        this.spawnImpactSparks(b.mesh.position.x, 1.4, b.mesh.position.z, b.color || 0x00f0ff);
        window.sounds?.playHit?.();
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      // Check obstacle hit
      let hitObs = false;
      for (let obs of this.obstacles) {
        const ow = obs.w / 2 + 0.3;
        const od = obs.d / 2 + 0.3;
        if (Math.abs(b.mesh.position.x - obs.x) < ow && Math.abs(b.mesh.position.z - obs.z) < od) {
          this.spawnImpactSparks(b.mesh.position.x, 1.4, b.mesh.position.z, obs.col || 0xffcc00);
          window.sounds?.playHit?.();
          this.scene.remove(b.mesh);
          this.bullets.splice(i, 1);
          hitObs = true;
          break;
        }
      }
      if (hitObs) continue;

      // Check tank hit
      const targetId = b.ownerId === 1 ? 2 : 1;
      const target = this.players[targetId];

      if (target && target.alive && target.hp > 0 && Math.hypot(b.mesh.position.x - target.x, b.mesh.position.z - target.z) < 2.5) {
        this.spawnImpactSparks(b.mesh.position.x, 1.4, b.mesh.position.z, target.id === 1 ? 0x00f0ff : 0xff0055);
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);

        if (target.shieldActive) {
          window.sounds?.playShield?.();
          this.syncToMobile(targetId, 'haptic', { pattern: [30] });
        } else {
          target.hp = Math.max(0, target.hp - 20);
          window.sounds?.playHit?.();
          this.shakeAmount = 14;
          this.syncToMobile(targetId, 'haptic', { pattern: [80, 40, 80] });
          this.syncPlayerHud(targetId);

          if (target.hp <= 0) {
            this.destroyTank(target);
          }
        }
        continue;
      }

      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    // 6. Update Spark Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.vy -= 0.02 * dt;
      pt.life -= dt;
      const s = Math.max(0.01, pt.life / 20);
      pt.mesh.scale.set(s, s, s);
      if (pt.life <= 0 || pt.mesh.position.y < 0.1) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  updateCamera(dt = 1.0) {
    const p1 = this.players[1];
    const p2 = this.players[2];

    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);

    const targetY = THREE.MathUtils.clamp(24 + dist * 0.4, 24, 40);
    const targetZ = midZ + THREE.MathUtils.clamp(20 + dist * 0.35, 20, 36);

    const camLerp = Math.min(1.0, 0.08 * dt);
    this.camera.position.x += (midX - this.camera.position.x) * camLerp;
    this.camera.position.y += (targetY - this.camera.position.y) * camLerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * camLerp;

    if (this.shakeAmount > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount * 0.12;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount * 0.12;
      this.shakeAmount *= Math.pow(0.88, dt);
    }

    this.camera.lookAt(midX, 1.0, midZ);
  }

  start() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;
      // Normalized dt: 1.0 at 60fps (16.667ms)
      const dt = Math.min(Math.max(deltaMs / 16.667, 0.2), 2.5);

      this.updatePhysics(dt);
      this.updateCamera(dt);
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
