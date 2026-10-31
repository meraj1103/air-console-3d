// 🏎️ PRO CAR RACERS 3D (Party Racing Engine)
import * as THREE from '/vendor/three/three.module.js';

export class KartGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    this.totalLaps = 3;
    this.raceActive = false;
    this.countdown = 3;
    this.lastTime = performance.now();

    this.karts = {};
    this.items = [];
    this.projectiles = [];
    this.particles = [];
    this.skidMarks = [];
    this.boostPads = [];
    this.trackSamples = [];

    // Track Waypoints (Loop circuit)
    this.trackWaypoints = [
      { x: -35, z: 25 },
      { x: 35, z: 25 },
      { x: 50, z: 10 },
      { x: 50, z: -20 },
      { x: 30, z: -35 },
      { x: 0, z: -20 },
      { x: -20, z: -35 },
      { x: -45, z: -20 },
      { x: -45, z: 10 }
    ];

    this.initThree();
    this.buildTrack();
    this.createKarts();
    this.bindResize();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060914, 0.012);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || (window.innerHeight - 64);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 40, 45);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0x2a3b5c, 2.0);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(30, 60, 40);
    sunLight.castShadow = true;
    this.scene.add(sunLight);

    const blueFill = new THREE.DirectionalLight(0x00f0ff, 1.2);
    blueFill.position.set(-40, 20, -30);
    this.scene.add(blueFill);

    const pinkFill = new THREE.DirectionalLight(0xff0055, 1.0);
    pinkFill.position.set(40, 20, -30);
    this.scene.add(pinkFill);
  }

  buildTrack() {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(240, 240);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070b16,
      roughness: 0.4,
      metalness: 0.6
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.scene.add(ground);

    // Grid Floor Overlay
    const grid = new THREE.GridHelper(200, 50, 0x00f0ff, 0x13213a);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Build Asphalt Ribbon Track using CatmullRomCurve3
    const curvePoints = this.trackWaypoints.map(p => new THREE.Vector3(p.x, 0, p.z));
    curvePoints.push(curvePoints[0]); // close loop
    this.trackCurve = new THREE.CatmullRomCurve3(curvePoints);
    this.trackCurve.closed = true;

    // Pre-sample spline points for fast closest-point math
    this.trackSamples = this.trackCurve.getPoints(240);

    // Track Surface Mesh
    const trackWidth = 14;
    const segments = 160;
    const trackPoints = this.trackCurve.getPoints(segments);

    const trackShape = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];

    for (let i = 0; i <= segments; i++) {
      const p = trackPoints[i % segments];
      const nextP = trackPoints[(i + 1) % segments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      const left = new THREE.Vector3().copy(p).addScaledVector(normal, trackWidth / 2);
      const right = new THREE.Vector3().copy(p).addScaledVector(normal, -trackWidth / 2);

      positions.push(left.x, 0.05, left.z);
      positions.push(right.x, 0.05, right.z);

      const u = i / segments;
      uvs.push(0, u);
      uvs.push(1, u);
    }

    const indices = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }

    trackShape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackShape.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trackShape.setIndex(indices);
    trackShape.computeVertexNormals();

    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x161e30,
      roughness: 0.3,
      metalness: 0.7
    });
    const trackMesh = new THREE.Mesh(trackShape, trackMat);
    this.scene.add(trackMesh);

    // Glowing Neon Rails (Curbs)
    this.buildNeonRails();

    // Finish Line Arch & Checkerboard
    this.buildFinishLine();

    // Place Boost Pads & Item Boxes
    this.placeTrackPickups();
  }

  getClosestTrackInfo(x, z) {
    let minDistSq = Infinity;
    let closestPt = this.trackSamples[0];
    let closestIdx = 0;

    for (let i = 0; i < this.trackSamples.length; i++) {
      const p = this.trackSamples[i];
      const dSq = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestPt = p;
        closestIdx = i;
      }
    }

    const nextIdx = (closestIdx + 1) % this.trackSamples.length;
    const nextPt = this.trackSamples[nextIdx];
    const tangent = { x: nextPt.x - closestPt.x, z: nextPt.z - closestPt.z };
    const forwardAngle = Math.atan2(tangent.x, tangent.z);

    return {
      point: closestPt,
      distance: Math.sqrt(minDistSq),
      forwardAngle
    };
  }

  buildNeonRails() {
    const segments = 120;
    const points = this.trackCurve.getPoints(segments);
    const leftRailPts = [];
    const rightRailPts = [];
    const hw = 7.0;

    for (let i = 0; i <= segments; i++) {
      const p = points[i % segments];
      const nextP = points[(i + 1) % segments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const norm = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      leftRailPts.push(new THREE.Vector3().copy(p).addScaledVector(norm, hw).setY(0.4));
      rightRailPts.push(new THREE.Vector3().copy(p).addScaledVector(norm, -hw).setY(0.4));
    }

    const leftCurve = new THREE.CatmullRomCurve3(leftRailPts);
    const rightCurve = new THREE.CatmullRomCurve3(rightRailPts);

    const railGeoLeft = new THREE.TubeGeometry(leftCurve, 120, 0.35, 8, false);
    const railGeoRight = new THREE.TubeGeometry(rightCurve, 120, 0.35, 8, false);

    const matLeft = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const matRight = new THREE.MeshBasicMaterial({ color: 0xff0055 });

    this.scene.add(new THREE.Mesh(railGeoLeft, matLeft));
    this.scene.add(new THREE.Mesh(railGeoRight, matRight));
  }

  buildFinishLine() {
    const archGroup = new THREE.Group();
    const p = this.trackWaypoints[0];

    const postMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, metalness: 0.8, roughness: 0.2 });
    const postGeo = new THREE.CylinderGeometry(0.6, 0.6, 12, 16);

    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(-8.5, 6, 0);
    archGroup.add(postL);

    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(8.5, 6, 0);
    archGroup.add(postR);

    // Crossbar
    const barGeo = new THREE.BoxGeometry(18, 1.6, 1.6);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xffe600, emissiveIntensity: 0.5 });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, 11, 0);
    archGroup.add(bar);

    archGroup.position.set(p.x, 0, p.z);
    archGroup.rotation.y = Math.PI / 2;
    this.scene.add(archGroup);
  }

  placeTrackPickups() {
    // Boost Pads
    const boostLocs = [
      { x: -30, z: 25 },
      { x: 45, z: 20 },
      { x: 15, z: -30 },
      { x: -35, z: -30 }
    ];

    boostLocs.forEach(loc => {
      const padGeo = new THREE.PlaneGeometry(6, 4);
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.85
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(loc.x, 0.1, loc.z);
      this.scene.add(pad);
      this.boostPads.push({ pos: loc, mesh: pad });
    });

    // Mystery Item Boxes
    const itemLocs = [
      { x: 0, z: 25 },
      { x: 50, z: -5 },
      { x: -10, z: -25 },
      { x: -45, z: -5 }
    ];

    itemLocs.forEach(loc => {
      const boxGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xffe600,
        emissive: 0xffaa00,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(loc.x, 1.5, loc.z);
      this.scene.add(box);
      this.items.push({ pos: loc, mesh: box, active: true, respawnTimer: 0 });
    });
  }

  createKartMesh(primaryColorHex, stripeColorHex) {
    const group = new THREE.Group();

    // Aerodynamic Chassis
    const bodyGeo = new THREE.BoxGeometry(2.6, 0.7, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColorHex,
      roughness: 0.2,
      metalness: 0.85,
      emissive: primaryColorHex,
      emissiveIntensity: 0.25
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    group.add(body);

    // Neon Racing Stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.72, 4.45),
      new THREE.MeshBasicMaterial({ color: stripeColorHex })
    );
    stripe.position.y = 0.65;
    group.add(stripe);

    // Rear Spoiler
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 })
    );
    spoiler.position.set(0, 1.5, -1.8);
    group.add(spoiler);

    // 4 Neon Wheels
    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 });

    const wheelOffsets = [
      { x: -1.45, z: 1.4 },  // front left
      { x: 1.45, z: 1.4 },   // front right
      { x: -1.5, z: -1.4 },  // rear left
      { x: 1.5, z: -1.4 }    // rear right
    ];

    wheelOffsets.forEach(pos => {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos.x, 0.48, pos.z);

      const w = new THREE.Mesh(wheelGeo, wheelMat);
      wGroup.add(w);

      const rim = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.35, 12),
        new THREE.MeshBasicMaterial({ color: primaryColorHex, side: THREE.DoubleSide })
      );
      rim.rotation.y = Math.PI / 2;
      rim.position.x = pos.x > 0 ? 0.21 : -0.21;
      wGroup.add(rim);

      group.add(wGroup);
      wheels.push(wGroup);
    });

    return { mesh: group, wheels };
  }

  createKarts() {
    // Player 1 (Cyan)
    const k1 = this.createKartMesh(0x00f0ff, 0xffffff);
    this.scene.add(k1.mesh);
    this.karts[1] = {
      id: 1,
      name: 'Player 1',
      ...k1,
      x: -33,
      z: 22,
      angle: Math.PI / 2,
      speed: 0,
      maxSpeed: 0.88,
      accel: 0.024,
      nitroEnergy: 100,
      lap: 1,
      currentWaypoint: 0,
      hasItem: null,
      input: { steer: 0, accel: false, brake: false, drift: false, item: false }
    };

    // Player 2 (Magenta)
    const k2 = this.createKartMesh(0xff0055, 0xffe600);
    this.scene.add(k2.mesh);
    this.karts[2] = {
      id: 2,
      name: 'Player 2',
      ...k2,
      x: -33,
      z: 28,
      angle: Math.PI / 2,
      speed: 0,
      maxSpeed: 0.88,
      accel: 0.024,
      nitroEnergy: 100,
      lap: 1,
      currentWaypoint: 0,
      hasItem: null,
      input: { steer: 0, accel: false, brake: false, drift: false, item: false }
    };

    this.resetRoundPositions();
  }

  resetRoundPositions() {
    const k1 = this.karts[1];
    k1.x = -33;
    k1.z = 22;
    k1.angle = Math.PI / 2;
    k1.speed = 0;
    k1.nitroEnergy = 100;
    k1.lap = 1;
    k1.currentWaypoint = 0;
    k1.hasItem = null;

    const k2 = this.karts[2];
    k2.x = -33;
    k2.z = 28;
    k2.angle = Math.PI / 2;
    k2.speed = 0;
    k2.nitroEnergy = 100;
    k2.lap = 1;
    k2.currentWaypoint = 0;
    k2.hasItem = null;

    this.syncKartHud(1);
    this.syncKartHud(2);
  }

  startCountdown(onFinished) {
    let count = 3;
    const overlay = document.getElementById('countdown-overlay');
    const textEl = document.getElementById('countdown-text');
    overlay.classList.remove('hidden');

    const tick = () => {
      if (count > 0) {
        textEl.textContent = count;
        textEl.className = 'font-orbitron font-black text-8xl text-yellow-300 drop-shadow-[0_0_35px_#ffe600] animate-pulse';
        window.sounds?.playCountdown(count);
        count--;
        setTimeout(tick, 900);
      } else {
        textEl.textContent = 'GO!';
        textEl.className = 'font-orbitron font-black text-9xl text-emerald-400 drop-shadow-[0_0_45px_#00ff88] scale-125';
        window.sounds?.playCountdown(0);
        setTimeout(() => {
          overlay.classList.add('hidden');
          this.raceActive = true;
          if (onFinished) onFinished();
        }, 700);
      }
    };
    tick();
  }

  handlePlayerInput(playerNumber, input) {
    const k = this.karts[playerNumber];
    if (!k) return;

    let steer = input.x !== undefined ? input.x : (input.steer || 0);
    if (Math.abs(steer) < 0.05 && typeof input.tiltX === 'number' && Math.abs(input.tiltX) > 2) {
      steer = Math.max(-1, Math.min(1, input.tiltX / 28));
    }

    k.input = {
      steer: steer,
      accel: !!(input.fire || input.accel || input.btnA || input.btnRT || input.gas || (typeof input.y === 'number' && input.y < -0.3)),
      brake: !!(input.brake || input.btnB || input.btnLT || (typeof input.y === 'number' && input.y > 0.3)),
      drift: !!(input.boost || input.drift || input.btnX),
      item: !!(input.shield || input.item || input.btnY)
    };
  }

  useItem(kart) {
    if (!kart.hasItem) return;
    const itemType = kart.hasItem;
    kart.hasItem = null;

    if (itemType === 'nitro') {
      kart.speed = kart.maxSpeed * 1.5;
      window.sounds?.playBoost();
      this.syncToMobile(kart.id, 'haptic', { pattern: [60, 40, 80] });
    } else if (itemType === 'missile') {
      this.fireMissile(kart);
      window.sounds?.playLaser(kart.id);
      this.syncToMobile(kart.id, 'haptic', { pattern: [40] });
    }

    this.syncKartHud(kart.id);
  }

  fireMissile(kart) {
    const geo = new THREE.CylinderGeometry(0.2, 0.25, 1.8, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(kart.x, 0.8, kart.z);
    mesh.rotation.y = kart.angle;
    this.scene.add(mesh);

    const speed = 1.6;
    this.projectiles.push({
      mesh,
      ownerId: kart.id,
      vx: Math.sin(kart.angle) * speed,
      vz: Math.cos(kart.angle) * speed,
      life: 80
    });
  }

  updatePhysics(dt = 1.0) {
    if (!this.raceActive) return;

    [1, 2].forEach(id => {
      const k = this.karts[id];

      // Handle Item usage
      if (k.input.item) {
        this.useItem(k);
      }

      // Acceleration & Braking (scaled by dt)
      const accelStep = k.accel * dt;
      if (k.input.accel) {
        k.speed = Math.min(k.maxSpeed, k.speed + accelStep);
      } else if (k.input.brake) {
        k.speed = Math.max(-0.35, k.speed - accelStep * 1.6);
      } else {
        k.speed *= Math.pow(0.97, dt); // Rolling friction
      }

      // Nitro boost
      if (k.input.drift && k.nitroEnergy > 5) {
        k.speed = Math.min(k.maxSpeed * 1.45, k.speed + 0.035 * dt);
        k.nitroEnergy = Math.max(0, k.nitroEnergy - 0.7 * dt);
        this.spawnExhaustParticles(k);
      } else {
        k.nitroEnergy = Math.min(100, k.nitroEnergy + 0.22 * dt);
      }

      // Steering
      const steerFactor = 0.038 * (k.speed / (k.maxSpeed || 1)) * dt;
      if (Math.abs(k.input.steer) > 0.1) {
        k.angle += -k.input.steer * steerFactor;
      }

      // Move forward
      k.x += Math.sin(k.angle) * k.speed * dt;
      k.z += Math.cos(k.angle) * k.speed * dt;

      // Track Barrier Rail Collision & Lakitu Fail-Safe
      const trackInfo = this.getClosestTrackInfo(k.x, k.z);
      const curbLimit = 6.4;

      if (trackInfo.distance > curbLimit) {
        // Hit outer curb rail
        const nx = (k.x - trackInfo.point.x) / trackInfo.distance;
        const nz = (k.z - trackInfo.point.z) / trackInfo.distance;
        k.x = trackInfo.point.x + nx * curbLimit;
        k.z = trackInfo.point.z + nz * curbLimit;
        k.speed *= Math.pow(0.92, dt); // scrub speed along wall
      }

      // Out of map fail-safe auto-respawn
      if (trackInfo.distance > 13.0) {
        k.x = trackInfo.point.x;
        k.z = trackInfo.point.z;
        k.angle = trackInfo.forwardAngle;
        k.speed = 0.2;
        window.sounds?.playPowerup?.();
        this.syncToMobile(k.id, 'haptic', { pattern: [50, 50] });
      }

      // Update 3D mesh
      k.mesh.position.set(k.x, 0, k.z);
      k.mesh.rotation.y = k.angle;

      // Wheel spin animation
      k.wheels.forEach(w => {
        w.children[0].rotation.x += k.speed * 1.6 * dt;
      });

      // Front wheels steer rotation
      k.wheels[0].rotation.y = -k.input.steer * 0.45;
      k.wheels[1].rotation.y = -k.input.steer * 0.45;

      // Checkpoint Progress Tracking
      this.checkLapProgress(k);

      // Boost Pad Triggers
      this.boostPads.forEach(pad => {
        if (Math.hypot(k.x - pad.pos.x, k.z - pad.pos.z) < 3.8) {
          k.speed = k.maxSpeed * 1.55;
          window.sounds?.playBoost();
          this.syncToMobile(k.id, 'haptic', { pattern: [50, 40] });
        }
      });

      // Item Box Pickups
      this.items.forEach(box => {
        if (box.active && Math.hypot(k.x - box.pos.x, k.z - box.pos.z) < 3.2) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 260;
          k.hasItem = Math.random() > 0.5 ? 'nitro' : 'missile';
          window.sounds?.playPowerup();
          this.syncToMobile(k.id, 'haptic', { pattern: [30, 40, 80] });
          this.syncKartHud(k.id);
        }
      });
    });

    // Kart-to-Kart Bumper Collision (Calculated once outside the loop)
    const k1 = this.karts[1];
    const k2 = this.karts[2];
    if (k1 && k2) {
      const dx = k2.x - k1.x;
      const dz = k2.z - k1.z;
      const dist = Math.hypot(dx, dz);
      const minDistance = 3.4;
      if (dist < minDistance && dist > 0.001) {
        const overlap = (minDistance - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        k1.x -= nx * overlap;
        k1.z -= nz * overlap;
        k2.x += nx * overlap;
        k2.z += nz * overlap;

        const tempSpeed = k1.speed;
        k1.speed = Math.max(0.1, k2.speed * 0.9);
        k2.speed = Math.max(0.1, tempSpeed * 0.9);

        window.sounds?.playHit?.();
        this.syncToMobile(1, 'haptic', { pattern: [30] });
        this.syncToMobile(2, 'haptic', { pattern: [30] });
      }
    }

    // Respawn Item Boxes
    this.items.forEach(box => {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
      } else {
        box.mesh.rotation.y += 0.03 * dt;
      }
    });

    // Update Missiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.life -= dt;

      // Hit opponent check
      const targetId = p.ownerId === 1 ? 2 : 1;
      const target = this.karts[targetId];
      if (Math.hypot(p.mesh.position.x - target.x, p.mesh.position.z - target.z) < 2.8) {
        target.speed = -0.2;
        target.angle += Math.PI * 0.7;
        window.sounds?.playExplosion();
        this.syncToMobile(targetId, 'haptic', { pattern: [120, 60, 150] });
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  checkLapProgress(kart) {
    const nextWpIdx = (kart.currentWaypoint + 1) % this.trackWaypoints.length;
    const nextWp = this.trackWaypoints[nextWpIdx];

    if (Math.hypot(kart.x - nextWp.x, kart.z - nextWp.z) < 16) {
      kart.currentWaypoint = nextWpIdx;

      // Crossed Finish Line
      if (nextWpIdx === 0) {
        kart.lap++;
        window.sounds?.playPowerup();

        if (kart.lap > this.totalLaps) {
          // Finished race!
          this.raceActive = false;
          window.sounds?.playVictory();
          this.onRoundEnd(kart.id, true);
        } else {
          this.syncKartHud(kart.id);
        }
      }
    }
  }

  spawnExhaustParticles(kart) {
    const colors = [0x00f0ff, 0xff0055, 0xffe600];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 6),
      new THREE.MeshBasicMaterial({ color: c })
    );
    pMesh.position.set(kart.x - Math.sin(kart.angle) * 2.2, 0.4, kart.z - Math.cos(kart.angle) * 2.2);
    this.scene.add(pMesh);

    let life = 18;
    const fade = () => {
      pMesh.scale.multiplyScalar(0.92);
      life--;
      if (life > 0) requestAnimationFrame(fade);
      else this.scene.remove(pMesh);
    };
    fade();
  }

  syncKartHud(playerId) {
    const k = this.karts[playerId];
    if (!k) return;

    const hpText = document.getElementById(`p${playerId}-hp-text`);
    const boostBar = document.getElementById(`p${playerId}-boost-bar`);

    if (hpText) hpText.textContent = `LAP ${Math.min(3, k.lap)} / 3`;
    if (boostBar) boostBar.style.width = `${k.nitroEnergy}%`;

    this.syncToMobile(playerId, 'status-sync', {
      hp: Math.min(100, Math.floor((k.lap / 3) * 100)),
      boostEnergy: Math.floor(k.nitroEnergy),
      shieldActive: !!k.hasItem,
      shieldCooldown: 0
    });
  }

  updateCamera(dt = 1.0) {
    const k1 = this.karts[1];
    const k2 = this.karts[2];

    const midX = (k1.x + k2.x) / 2;
    const midZ = (k1.z + k2.z) / 2;
    const dist = Math.hypot(k2.x - k1.x, k2.z - k1.z);

    const targetY = THREE.MathUtils.clamp(32 + dist * 0.45, 34, 58);
    const targetZ = midZ + THREE.MathUtils.clamp(30 + dist * 0.4, 32, 52);

    const camLerp = Math.min(1.0, 0.08 * dt);
    this.camera.position.x += (midX - this.camera.position.x) * camLerp;
    this.camera.position.y += (targetY - this.camera.position.y) * camLerp;
    this.camera.position.z += (targetZ - this.camera.position.z) * camLerp;

    this.camera.lookAt(midX, 1.2, midZ);
  }

  start() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;
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
