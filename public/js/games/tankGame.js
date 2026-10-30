// 3D Cyber Bumpers / Neon Tank Arena Game Engine (Three.js)
import * as THREE from '/vendor/three/three.module.js';

export class TankGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile; // Callback to send haptics/HUD to mobile

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    // Arena dimensions
    this.arenaWidth = 60;
    this.arenaDepth = 40;

    // Game state
    this.roundActive = false;
    this.scores = { 1: 0, 2: 0 };
    this.targetScore = 3; // First to 3 round wins
    this.round = 1;

    // Objects
    this.players = {};
    this.bullets = [];
    this.particles = [];
    this.powerups = [];
    this.obstacles = [];

    // Screen shake
    this.shakeAmount = 0;

    this.initThree();
    this.buildArena();
    this.createPlayers();
    this.bindResize();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070e, 0.015);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || (window.innerHeight - 64);

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 52, 45);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Ambient & Directional Lights
    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(20, 50, 30);
    this.scene.add(keyLight);

    // Cyber starfield background
    this.createStarfield();
  }

  createStarfield() {
    const starCount = 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = Math.random() * 100 - 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;

      const c = Math.random() > 0.5 ? [0, 0.9, 1] : [1, 0, 0.6];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const starPoints = new THREE.Points(geometry, material);
    this.scene.add(starPoints);
  }

  buildArena() {
    // Holographic Grid Floor
    const grid = new THREE.GridHelper(this.arenaWidth, 30, 0x00f0ff, 0x112238);
    grid.position.y = 0.05;
    this.scene.add(grid);

    // Dark reflective platform
    const floorGeo = new THREE.BoxGeometry(this.arenaWidth, 1, this.arenaDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.2,
      metalness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    this.scene.add(floor);

    // Glowing Neon Perimeter Rails
    const railMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const railMatMag = new THREE.MeshBasicMaterial({ color: 0xff007f });

    // North / South walls
    const hw = this.arenaWidth / 2;
    const hd = this.arenaDepth / 2;

    const wallThickness = 1.2;
    const wallHeight = 2.4;

    const createWall = (w, h, d, x, y, z, color) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0c1526,
        roughness: 0.3,
        metalness: 0.9,
        emissive: color,
        emissiveIntensity: 0.35
      });
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(x, y, z);
      this.scene.add(wall);

      // Light edge neon strip
      const stripGeo = new THREE.BoxGeometry(w, 0.4, d);
      const stripMat = new THREE.MeshBasicMaterial({ color });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(x, y + h / 2, z);
      this.scene.add(strip);
    };

    createWall(this.arenaWidth + wallThickness * 2, wallHeight, wallThickness, 0, wallHeight / 2, -hd, 0x00f0ff);
    createWall(this.arenaWidth + wallThickness * 2, wallHeight, wallThickness, 0, wallHeight / 2, hd, 0xff007f);
    createWall(wallThickness, wallHeight, this.arenaDepth, -hw, wallHeight / 2, 0, 0x00f0ff);
    createWall(wallThickness, wallHeight, this.arenaDepth, hw, wallHeight / 2, 0, 0xff007f);

    // Obstacles in arena (bouncers & cyber prisms)
    this.createObstacles();
  }

  createObstacles() {
    const obstacleData = [
      { x: -16, z: 0, w: 4, h: 3, d: 8, color: 0x00f0ff },
      { x: 16, z: 0, w: 4, h: 3, d: 8, color: 0xff007f },
      { x: 0, z: -8, w: 6, h: 3, d: 3, color: 0x00e5ff },
      { x: 0, z: 8, w: 6, h: 3, d: 3, color: 0xff3b30 }
    ];

    obstacleData.forEach(data => {
      const geo = new THREE.BoxGeometry(data.w, data.h, data.d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0e172a,
        roughness: 0.15,
        metalness: 0.85,
        emissive: data.color,
        emissiveIntensity: 0.4
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(data.x, data.h / 2, data.z);
      this.scene.add(mesh);

      // Top glowing neon frame
      const wireGeo = new THREE.EdgesGeometry(geo);
      const wireMat = new THREE.LineBasicMaterial({ color: data.color, linewidth: 2 });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      mesh.add(wire);

      this.obstacles.push({
        x: data.x,
        z: data.z,
        w: data.w,
        d: data.d,
        mesh
      });
    });
  }

  createTankMesh(colorHex, emissiveHex) {
    const tankGroup = new THREE.Group();

    // Hover Chassis
    const bodyGeo = new THREE.BoxGeometry(3.6, 1.2, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x161c2e,
      roughness: 0.2,
      metalness: 0.8,
      emissive: emissiveHex,
      emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    tankGroup.add(body);

    // Glowing Neon Stripes on Body
    const stripeGeo = new THREE.BoxGeometry(3.68, 0.25, 4.45);
    const stripeMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.8;
    tankGroup.add(stripe);

    // Cockpit Canopy
    const cockpitGeo = new THREE.SphereGeometry(1.3, 16, 16);
    cockpitGeo.scale(1, 0.7, 1.2);
    const cockpitMat = new THREE.MeshPhysicalMaterial({
      color: 0x050a14,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: colorHex,
      emissiveIntensity: 0.25
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 1.6, -0.2);
    tankGroup.add(cockpit);

    // Rotating Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.6, 0);

    const barrelGeo = new THREE.CylinderGeometry(0.28, 0.32, 3.2, 16);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0, 1.6);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x222a3a,
      roughness: 0.3,
      metalness: 0.9,
      emissive: colorHex,
      emissiveIntensity: 0.5
    });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    turretGroup.add(barrel);

    // Barrel tip neon ring
    const tipGeo = new THREE.TorusGeometry(0.36, 0.08, 8, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.set(0, 0, 3.2);
    turretGroup.add(tip);

    tankGroup.add(turretGroup);

    // Hover Thrusters (left & right pods)
    const podGeo = new THREE.CylinderGeometry(0.5, 0.6, 3.6, 12);
    podGeo.rotateX(Math.PI / 2);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.8, roughness: 0.3 });

    const leftPod = new THREE.Mesh(podGeo, podMat);
    leftPod.position.set(-2.0, 0.6, 0);
    tankGroup.add(leftPod);

    const rightPod = new THREE.Mesh(podGeo, podMat);
    rightPod.position.set(2.0, 0.6, 0);
    tankGroup.add(rightPod);

    // Thruster glow circles
    const thrusterGlowGeo = new THREE.CircleGeometry(0.45, 16);
    const thrusterGlowMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    const leftGlow = new THREE.Mesh(thrusterGlowGeo, thrusterGlowMat);
    leftGlow.position.set(-2.0, 0.6, -1.82);
    tankGroup.add(leftGlow);

    const rightGlow = new THREE.Mesh(thrusterGlowGeo, thrusterGlowMat);
    rightGlow.position.set(2.0, 0.6, -1.82);
    tankGroup.add(rightGlow);

    // Force Field Shield Bubble (hidden initially)
    const shieldGeo = new THREE.SphereGeometry(3.6, 24, 24);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1.0,
      emissive: colorHex,
      emissiveIntensity: 0.8
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 1.0;
    tankGroup.add(shieldMesh);

    // Dynamic ground light
    const pointLight = new THREE.PointLight(colorHex, 2.5, 12);
    pointLight.position.set(0, 1.2, 0);
    tankGroup.add(pointLight);

    return {
      mesh: tankGroup,
      turret: turretGroup,
      shieldMesh,
      light: pointLight
    };
  }

  createPlayers() {
    // Player 1 (Cyan)
    const p1Tank = this.createTankMesh(0x00f0ff, 0x005577);
    this.scene.add(p1Tank.mesh);
    this.players[1] = {
      id: 1,
      name: 'Player 1',
      color: '#00f0ff',
      ...p1Tank,
      x: -20,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      targetAngle: 0,
      turretAngle: 0,
      hp: 100,
      maxHp: 100,
      boostEnergy: 100,
      isBoosting: false,
      shieldActive: false,
      shieldTimer: 0,
      shieldCooldown: 0,
      fireCooldown: 0,
      tripleShot: false,
      tripleShotTimer: 0,
      speedBoostTimer: 0,
      input: { x: 0, y: 0, fire: false, boost: false, shield: false }
    };

    // Player 2 (Magenta / Neon Pink)
    const p2Tank = this.createTankMesh(0xff007f, 0x770033);
    this.scene.add(p2Tank.mesh);
    this.players[2] = {
      id: 2,
      name: 'Player 2',
      color: '#ff007f',
      ...p2Tank,
      x: 20,
      z: 0,
      vx: 0,
      vz: 0,
      angle: Math.PI,
      targetAngle: Math.PI,
      turretAngle: Math.PI,
      hp: 100,
      maxHp: 100,
      boostEnergy: 100,
      isBoosting: false,
      shieldActive: false,
      shieldTimer: 0,
      shieldCooldown: 0,
      fireCooldown: 0,
      tripleShot: false,
      tripleShotTimer: 0,
      speedBoostTimer: 0,
      input: { x: 0, y: 0, fire: false, boost: false, shield: false }
    };

    this.resetRoundPositions();
  }

  resetRoundPositions() {
    // P1 Spawn
    const p1 = this.players[1];
    p1.x = -20;
    p1.z = 0;
    p1.vx = 0;
    p1.vz = 0;
    p1.angle = 0;
    p1.targetAngle = 0;
    p1.hp = 100;
    p1.boostEnergy = 100;
    p1.shieldActive = false;
    p1.shieldTimer = 0;
    p1.shieldCooldown = 0;
    p1.tripleShot = false;
    p1.speedBoostTimer = 0;
    p1.shieldMesh.material.opacity = 0;

    // P2 Spawn
    const p2 = this.players[2];
    p2.x = 20;
    p2.z = 0;
    p2.vx = 0;
    p2.vz = 0;
    p2.angle = Math.PI;
    p2.targetAngle = Math.PI;
    p2.hp = 100;
    p2.boostEnergy = 100;
    p2.shieldActive = false;
    p2.shieldTimer = 0;
    p2.shieldCooldown = 0;
    p2.tripleShot = false;
    p2.speedBoostTimer = 0;
    p2.shieldMesh.material.opacity = 0;

    // Clear bullets & powerups
    this.bullets.forEach(b => this.scene.remove(b.mesh));
    this.bullets = [];

    this.powerups.forEach(p => this.scene.remove(p.mesh));
    this.powerups = [];

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
        textEl.className = 'countdown-num scale-125 transition-transform duration-300 text-cyan-400 font-black text-8xl drop-shadow-[0_0_35px_#00f0ff]';
        window.sounds.playCountdown(count);
        count--;
        setTimeout(tick, 900);
      } else if (count === 0) {
        textEl.textContent = 'FIGHT!';
        textEl.className = 'countdown-num scale-150 transition-transform duration-300 text-yellow-300 font-black text-9xl drop-shadow-[0_0_45px_#ffff00]';
        window.sounds.playCountdown(0);
        count--;
        setTimeout(() => {
          overlay.classList.add('hidden');
          this.roundActive = true;
          if (onFinished) onFinished();
        }, 800);
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
      fire: !!input.fire,
      boost: !!input.boost,
      shield: !!input.shield
    };

    // If tilt angle provided
    if (input.tiltX !== undefined && input.tiltY !== undefined) {
      p.input.x = THREE.MathUtils.clamp(input.tiltX / 30, -1, 1);
      p.input.y = THREE.MathUtils.clamp(-input.tiltY / 30, -1, 1);
    }
  }

  fireLaser(p) {
    if (!this.roundActive || p.hp <= 0) return;
    if (p.fireCooldown > 0) return;

    p.fireCooldown = 12; // Cooldown frames
    window.sounds.playLaser(p.id);

    // Haptic feedback to the shooting player
    this.syncToMobile(p.id, 'haptic', { pattern: [25] });

    const spawnBullet = (angleOffset = 0) => {
      const finalAngle = p.turretAngle + angleOffset;
      const geo = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: p.id === 1 ? 0x00f0ff : 0xff007f
      });
      const bulletMesh = new THREE.Mesh(geo, mat);

      const spawnDist = 3.6;
      const bx = p.x + Math.sin(finalAngle) * spawnDist;
      const bz = p.z + Math.cos(finalAngle) * spawnDist;
      bulletMesh.position.set(bx, 1.6, bz);
      bulletMesh.rotation.y = finalAngle;

      this.scene.add(bulletMesh);

      const speed = 1.35;
      this.bullets.push({
        mesh: bulletMesh,
        ownerId: p.id,
        vx: Math.sin(finalAngle) * speed,
        vz: Math.cos(finalAngle) * speed,
        life: 140, // frames before decay
        bounces: 0,
        maxBounces: 2
      });

      // Muzzle spark
      this.createSparkExplosion(bx, 1.6, bz, p.id === 1 ? 0x00f0ff : 0xff007f, 6);
    };

    if (p.tripleShot) {
      spawnBullet(-0.25);
      spawnBullet(0);
      spawnBullet(0.25);
    } else {
      spawnBullet(0);
    }
  }

  activateShield(p) {
    if (p.shieldCooldown > 0 || p.shieldActive || p.hp <= 0) return;
    p.shieldActive = true;
    p.shieldTimer = 150; // ~2.5 seconds
    p.shieldCooldown = 360; // 6 seconds cooldown
    window.sounds.playShield();
    this.syncToMobile(p.id, 'haptic', { pattern: [40, 30, 40] });
  }

  spawnPowerup() {
    if (this.powerups.length >= 3) return;

    const types = ['speed', 'triple', 'shield', 'emp'];
    const type = types[Math.floor(Math.random() * types.length)];

    const colors = {
      speed: 0xffe600,
      triple: 0x00ff88,
      shield: 0x00bfff,
      emp: 0xbf00ff
    };

    const x = (Math.random() - 0.5) * (this.arenaWidth - 14);
    const z = (Math.random() - 0.5) * (this.arenaDepth - 10);

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      emissive: colors[type],
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.5, z);

    // Glowing wireframe
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: colors[type] })
    );
    mesh.add(wire);

    // Light
    const pl = new THREE.PointLight(colors[type], 2.0, 8);
    mesh.add(pl);

    this.scene.add(mesh);
    this.powerups.push({ x, z, type, mesh, rotSpeed: 0.03 });
  }

  triggerEmp(originX, originZ, senderPlayerId) {
    window.sounds.playExplosion();
    this.shakeAmount = 15;

    // EMP Shockwave visual ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xbf00ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(originX, 0.4, originZ);
    this.scene.add(ringMesh);

    let scale = 1;
    const expandAnim = () => {
      scale += 1.8;
      ringMesh.scale.set(scale, 1, scale);
      ringMat.opacity -= 0.045;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(expandAnim);
      } else {
        this.scene.remove(ringMesh);
      }
    };
    expandAnim();

    // Damage & knock back the opponent
    const targetId = senderPlayerId === 1 ? 2 : 1;
    const target = this.players[targetId];
    if (target && target.hp > 0) {
      const dx = target.x - originX;
      const dz = target.z - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 28) {
        const force = (28 - dist) / 28;
        if (!target.shieldActive) {
          target.hp = Math.max(0, target.hp - Math.floor(25 * force));
          this.syncToMobile(targetId, 'haptic', { pattern: [100, 50, 150] });
        }
        target.vx += (dx / (dist || 1)) * 1.6 * force;
        target.vz += (dz / (dist || 1)) * 1.6 * force;
        this.syncPlayerHud(targetId);

        if (target.hp <= 0) {
          this.destroyTank(target);
        }
      }
    }
  }

  createSparkExplosion(x, y, z, colorHex, count = 18) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, y, z);
      this.scene.add(p);

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.2;
      const vy = (Math.random() - 0.2) * 0.8;

      this.particles.push({
        mesh: p,
        vx: Math.cos(angle) * speed,
        vy: vy,
        vz: Math.sin(angle) * speed,
        life: 25 + Math.random() * 15
      });
    }
  }

  destroyTank(p) {
    this.roundActive = false;
    window.sounds.playExplosion();
    this.shakeAmount = 25;
    this.createSparkExplosion(p.x, 1.2, p.z, p.id === 1 ? 0x00f0ff : 0xff007f, 65);
    p.mesh.visible = false;

    // Rumble loser's phone
    this.syncToMobile(p.id, 'haptic', { pattern: [150, 80, 200, 100, 300] });

    // Winner gets round point
    const winnerId = p.id === 1 ? 2 : 1;
    this.scores[winnerId]++;
    this.onScoreUpdate(this.scores);

    // Rumble winner's phone with victory pattern
    this.syncToMobile(winnerId, 'haptic', { pattern: [50, 50, 50, 50, 120] });

    setTimeout(() => {
      p.mesh.visible = true;
      if (this.scores[winnerId] >= this.targetScore) {
        // Match winner!
        this.onRoundEnd(winnerId, true);
      } else {
        // Next round
        this.round++;
        this.onRoundEnd(winnerId, false);
      }
    }, 2200);
  }

  syncPlayerHud(playerNumber) {
    const p = this.players[playerNumber];
    if (!p) return;

    // Update screen UI DOM
    const hpBar = document.getElementById(`p${playerNumber}-hp-bar`);
    const hpText = document.getElementById(`p${playerNumber}-hp-text`);
    const boostBar = document.getElementById(`p${playerNumber}-boost-bar`);

    if (hpBar) hpBar.style.width = `${Math.max(0, p.hp)}%`;
    if (hpText) hpText.textContent = `${Math.max(0, p.hp)} HP`;
    if (boostBar) boostBar.style.width = `${p.boostEnergy}%`;

    // Send status directly to mobile phone controller
    this.syncToMobile(playerNumber, 'status-sync', {
      hp: p.hp,
      boostEnergy: Math.floor(p.boostEnergy),
      shieldActive: p.shieldActive,
      shieldCooldown: Math.ceil(p.shieldCooldown / 60)
    });
  }

  updatePhysics() {
    const hw = this.arenaWidth / 2 - 2.5;
    const hd = this.arenaDepth / 2 - 2.5;

    // Update players
    [1, 2].forEach(id => {
      const p = this.players[id];
      if (p.hp <= 0) return;

      // Cooldowns
      if (p.fireCooldown > 0) p.fireCooldown--;
      if (p.shieldTimer > 0) {
        p.shieldTimer--;
        p.shieldMesh.material.opacity = 0.45 + Math.sin(Date.now() * 0.02) * 0.2;
        if (p.shieldTimer <= 0) {
          p.shieldActive = false;
          p.shieldMesh.material.opacity = 0;
        }
      }
      if (p.shieldCooldown > 0) p.shieldCooldown--;

      if (p.speedBoostTimer > 0) p.speedBoostTimer--;
      if (p.tripleShotTimer > 0) {
        p.tripleShotTimer--;
        if (p.tripleShotTimer <= 0) p.tripleShot = false;
      }

      // Input actions
      if (p.input.fire) {
        this.fireLaser(p);
      }
      if (p.input.shield) {
        this.activateShield(p);
      }

      // Boost calculation
      let baseSpeed = 0.42;
      if (p.speedBoostTimer > 0) baseSpeed *= 1.4;

      if (p.input.boost && p.boostEnergy > 10) {
        p.isBoosting = true;
        baseSpeed *= 1.7;
        p.boostEnergy = Math.max(0, p.boostEnergy - 0.7);
        // Thruster sparks
        this.createSparkExplosion(p.x, 0.6, p.z, p.id === 1 ? 0x00f0ff : 0xff007f, 2);
      } else {
        p.isBoosting = false;
        p.boostEnergy = Math.min(100, p.boostEnergy + 0.35);
      }

      // Movement vector
      const ix = p.input.x;
      const iy = p.input.y;
      const inputMag = Math.hypot(ix, iy);

      if (inputMag > 0.15) {
        p.targetAngle = Math.atan2(ix, iy);
        p.vx += ix * baseSpeed * 0.3;
        p.vz += iy * baseSpeed * 0.3;
      }

      // Friction / damping
      p.vx *= 0.88;
      p.vz *= 0.88;

      // Speed clamp
      const currentSpeed = Math.hypot(p.vx, p.vz);
      const maxSpeed = p.isBoosting ? 0.95 : 0.58;
      if (currentSpeed > maxSpeed) {
        p.vx = (p.vx / currentSpeed) * maxSpeed;
        p.vz = (p.vz / currentSpeed) * maxSpeed;
      }

      p.x += p.vx;
      p.z += p.vz;

      // Arena boundary collision
      if (p.x < -hw) { p.x = -hw; p.vx *= -0.5; }
      if (p.x > hw) { p.x = hw; p.vx *= -0.5; }
      if (p.z < -hd) { p.z = -hd; p.vz *= -0.5; }
      if (p.z > hd) { p.z = hd; p.vz *= -0.5; }

      // Obstacle collision
      this.obstacles.forEach(obs => {
        const ox = obs.x;
        const oz = obs.z;
        const ow = obs.w / 2 + 1.8;
        const od = obs.d / 2 + 1.8;

        if (Math.abs(p.x - ox) < ow && Math.abs(p.z - oz) < od) {
          const overlapX = ow - Math.abs(p.x - ox);
          const overlapZ = od - Math.abs(p.z - oz);
          if (overlapX < overlapZ) {
            p.x += Math.sign(p.x - ox) * overlapX;
            p.vx *= -0.6;
          } else {
            p.z += Math.sign(p.z - oz) * overlapZ;
            p.vz *= -0.6;
          }
        }
      });

      // Smooth tank body rotation lerping
      let diff = p.targetAngle - p.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      p.angle += diff * 0.18;

      // Turret rotation
      p.turretAngle = p.angle;

      // Update 3D mesh position & rotation
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.angle;
      p.turret.rotation.y = p.turretAngle - p.angle;

      // Floating hover bobbing
      p.mesh.position.y = Math.sin(Date.now() * 0.005 + p.id) * 0.15;
    });

    // Player-to-Player Bumper collision
    const p1 = this.players[1];
    const p2 = this.players[2];
    if (p1.hp > 0 && p2.hp > 0) {
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const dist = Math.hypot(dx, dz);
      const minDist = 4.2;

      if (dist < minDist && dist > 0.01) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        // Push tanks apart
        p1.x -= nx * overlap * 0.5;
        p1.z -= nz * overlap * 0.5;
        p2.x += nx * overlap * 0.5;
        p2.z += nz * overlap * 0.5;

        // Elastic bumper bounce
        const rvx = p2.vx - p1.vx;
        const rvz = p2.vz - p1.vz;
        const velAlongNormal = rvx * nx + rvz * nz;

        if (velAlongNormal < 0) {
          const impulse = -(1.6) * velAlongNormal;
          p1.vx -= nx * impulse * 0.6;
          p1.vz -= nz * impulse * 0.6;
          p2.vx += nx * impulse * 0.6;
          p2.vz += nz * impulse * 0.6;

          window.sounds.playHit();
          this.createSparkExplosion((p1.x + p2.x) / 2, 1.0, (p1.z + p2.z) / 2, 0xffffff, 8);
          this.syncToMobile(1, 'haptic', { pattern: [40] });
          this.syncToMobile(2, 'haptic', { pattern: [40] });
        }
      }
    }

    // Bullets update
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.x += b.vx;
      b.mesh.position.z += b.vz;
      b.life--;

      // Boundary bouncing
      if (Math.abs(b.mesh.position.x) > hw) {
        b.vx *= -1;
        b.bounces++;
        b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
        window.sounds.playHit();
        this.createSparkExplosion(b.mesh.position.x, 1.6, b.mesh.position.z, 0xffffff, 4);
      }
      if (Math.abs(b.mesh.position.z) > hd) {
        b.vz *= -1;
        b.bounces++;
        b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
        window.sounds.playHit();
        this.createSparkExplosion(b.mesh.position.x, 1.6, b.mesh.position.z, 0xffffff, 4);
      }

      // Obstacle bouncing
      this.obstacles.forEach(obs => {
        const ox = obs.x;
        const oz = obs.z;
        const ow = obs.w / 2 + 0.3;
        const od = obs.d / 2 + 0.3;

        if (Math.abs(b.mesh.position.x - ox) < ow && Math.abs(b.mesh.position.z - oz) < od) {
          const overlapX = ow - Math.abs(b.mesh.position.x - ox);
          const overlapZ = od - Math.abs(b.mesh.position.z - oz);
          if (overlapX < overlapZ) {
            b.vx *= -1;
          } else {
            b.vz *= -1;
          }
          b.bounces++;
          b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
          window.sounds.playHit();
          this.createSparkExplosion(b.mesh.position.x, 1.6, b.mesh.position.z, 0x00f0ff, 4);
        }
      });

      // Hit check against opponent
      const targetId = b.ownerId === 1 ? 2 : 1;
      const target = this.players[targetId];

      if (target && target.hp > 0) {
        const dist = Math.hypot(b.mesh.position.x - target.x, b.mesh.position.z - target.z);
        if (dist < 2.5) {
          // Bullet hit target!
          this.scene.remove(b.mesh);
          this.bullets.splice(i, 1);

          if (target.shieldActive) {
            // Deflected by shield!
            window.sounds.playShield();
            this.createSparkExplosion(b.mesh.position.x, 1.6, b.mesh.position.z, 0x00f0ff, 12);
            this.syncToMobile(targetId, 'haptic', { pattern: [30] });
          } else {
            // Damage dealt!
            target.hp = Math.max(0, target.hp - 20);
            window.sounds.playHit();
            this.shakeAmount = 10;
            this.createSparkExplosion(target.x, 1.2, target.z, target.id === 1 ? 0x00f0ff : 0xff007f, 20);

            // Rumble target's phone
            this.syncToMobile(targetId, 'haptic', { pattern: [80, 40, 80] });

            this.syncPlayerHud(targetId);

            if (target.hp <= 0) {
              this.destroyTank(target);
            }
          }
          continue;
        }
      }

      if (b.life <= 0 || b.bounces > b.maxBounces) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    // Powerups rotation & pickup
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pw = this.powerups[i];
      pw.mesh.rotation.y += pw.rotSpeed;
      pw.mesh.rotation.x += pw.rotSpeed * 0.7;

      [1, 2].forEach(pId => {
        const p = this.players[pId];
        if (p.hp > 0 && Math.hypot(p.x - pw.x, p.z - pw.z) < 3.2) {
          // Collected!
          window.sounds.playPowerup();
          this.createSparkExplosion(pw.x, 1.5, pw.z, 0xffff00, 25);
          this.syncToMobile(pId, 'haptic', { pattern: [40, 40, 80] });

          if (pw.type === 'speed') {
            p.speedBoostTimer = 360; // 6s speed overdrive
          } else if (pw.type === 'triple') {
            p.tripleShot = true;
            p.tripleShotTimer = 480; // 8s triple lasers
          } else if (pw.type === 'shield') {
            p.hp = Math.min(100, p.hp + 25);
            p.shieldCooldown = 0;
            this.activateShield(p);
          } else if (pw.type === 'emp') {
            this.triggerEmp(p.x, p.z, pId);
          }

          this.syncPlayerHud(pId);
          this.scene.remove(pw.mesh);
          this.powerups.splice(i, 1);
        }
      });
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.mesh.position.x += pt.vx;
      pt.mesh.position.y += pt.vy;
      pt.mesh.position.z += pt.vz;
      pt.vy -= 0.02; // gravity
      pt.life--;
      pt.mesh.scale.multiplyScalar(0.94);

      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }

    // Periodic powerup spawn
    if (this.roundActive && Math.random() < 0.005) {
      this.spawnPowerup();
    }

    // Periodic HUD sync
    if (Math.random() < 0.08) {
      this.syncPlayerHud(1);
      this.syncPlayerHud(2);
    }
  }

  updateCamera() {
    const p1 = this.players[1];
    const p2 = this.players[2];

    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;
    const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);

    const targetY = THREE.MathUtils.clamp(40 + dist * 0.45, 42, 68);
    const targetZ = midZ + THREE.MathUtils.clamp(35 + dist * 0.35, 36, 55);

    // Smooth camera lerping
    this.camera.position.x += (midX - this.camera.position.x) * 0.05;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.05;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.05;

    // Apply Screen Shake
    if (this.shakeAmount > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount * 0.15;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount * 0.15;
      this.shakeAmount *= 0.88;
      if (this.shakeAmount < 0.1) this.shakeAmount = 0;
    }

    this.camera.lookAt(midX, 1.0, midZ);
  }

  start() {
    if (this.animId) cancelAnimationFrame(this.animId);

    const loop = () => {
      this.updatePhysics();
      this.updateCamera();
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
