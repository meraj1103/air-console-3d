// 🏎️ NEON KART: CYBER RACERS 3D (Party Racing Engine)
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

    this.karts = {};
    this.items = [];
    this.projectiles = [];
    this.particles = [];
    this.skidMarks = [];
    this.boostPads = [];

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

    // Speed Boost Pads & Item Boxes
    this.buildBoostPads();
    this.spawnItemBoxes();
  }

  buildNeonRails() {
    const segments = 120;
    const pts = this.trackCurve.getPoints(segments);
    const trackWidth = 14;

    const leftRailPts = [];
    const rightRailPts = [];

    for (let i = 0; i <= segments; i++) {
      const p = pts[i % segments];
      const nextP = pts[(i + 1) % segments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

      leftRailPts.push(new THREE.Vector3().copy(p).addScaledVector(normal, trackWidth / 2 + 0.6));
      rightRailPts.push(new THREE.Vector3().copy(p).addScaledVector(normal, -(trackWidth / 2 + 0.6)));
    }

    const leftCurve = new THREE.CatmullRomCurve3(leftRailPts);
    const leftTube = new THREE.TubeGeometry(leftCurve, segments, 0.45, 8, true);
    const leftRailMesh = new THREE.Mesh(leftTube, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
    leftRailMesh.position.y = 0.5;
    this.scene.add(leftRailMesh);

    const rightCurve = new THREE.CatmullRomCurve3(rightRailPts);
    const rightTube = new THREE.TubeGeometry(rightCurve, segments, 0.45, 8, true);
    const rightRailMesh = new THREE.Mesh(rightTube, new THREE.MeshBasicMaterial({ color: 0xff0055 }));
    rightRailMesh.position.y = 0.5;
    this.scene.add(rightRailMesh);
  }

  buildFinishLine() {
    // Arch over the track start
    const archGroup = new THREE.Group();
    archGroup.position.set(-35, 0, 25);

    // Left Pillar
    const leftCol = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.9, roughness: 0.2 })
    );
    leftCol.position.set(-8.5, 4.5, 0);
    archGroup.add(leftCol);

    // Right Pillar
    const rightCol = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.9, roughness: 0.2 })
    );
    rightCol.position.set(8.5, 4.5, 0);
    archGroup.add(rightCol);

    // Top Beam with glowing Neon Sign
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(18.6, 1.8, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x090f1d, emissive: 0x00f0ff, emissiveIntensity: 0.4 })
    );
    beam.position.set(0, 9, 0);
    archGroup.add(beam);

    // Holographic Banner
    const bannerGeo = new THREE.PlaneGeometry(12, 1.5);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0xffe600, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 8.8, 1.05);
    archGroup.add(banner);

    this.scene.add(archGroup);
  }

  buildBoostPads() {
    const padLocations = [
      { t: 0.22, color: 0xffe600 },
      { t: 0.55, color: 0x00ff88 },
      { t: 0.82, color: 0xff0055 }
    ];

    padLocations.forEach(pad => {
      const pos = this.trackCurve.getPointAt(pad.t);
      const tangent = this.trackCurve.getTangentAt(pad.t);

      const geo = new THREE.PlaneGeometry(6, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: pad.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.1, pos.z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(tangent.x, tangent.z);

      this.scene.add(mesh);
      this.boostPads.push({ pos, mesh, color: pad.color });
    });
  }

  spawnItemBoxes() {
    const itemT = [0.15, 0.4, 0.7];
    itemT.forEach(t => {
      const pos = this.trackCurve.getPointAt(t);
      [-3.5, 3.5].forEach(offset => {
        const tangent = this.trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const p = new THREE.Vector3().copy(pos).addScaledVector(normal, offset);

        const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x11192e,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.9,
          roughness: 0.1,
          metalness: 0.8
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.x, 1.6, p.z);

        const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff }));
        mesh.add(wire);

        this.scene.add(mesh);
        this.items.push({ pos: p, mesh, active: true, respawnTimer: 0 });
      });
    });
  }

  createKartMesh(primaryColorHex, emissiveColorHex) {
    const kartGroup = new THREE.Group();

    // Aerodynamic Chassis Body
    const bodyGeo = new THREE.BoxGeometry(2.4, 0.9, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x141a29,
      metalness: 0.85,
      roughness: 0.2,
      emissive: emissiveColorHex,
      emissiveIntensity: 0.4
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    kartGroup.add(body);

    // Glowing Neon Center Racing Stripe
    const stripeGeo = new THREE.BoxGeometry(0.8, 0.95, 4.5);
    const stripeMat = new THREE.MeshBasicMaterial({ color: primaryColorHex });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.6;
    kartGroup.add(stripe);

    // Cockpit & Windshield
    const canopyGeo = new THREE.CylinderGeometry(0.7, 0.9, 1.6, 8);
    canopyGeo.rotateX(Math.PI / 4);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x02050a,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      emissive: primaryColorHex,
      emissiveIntensity: 0.3
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 1.15, -0.2);
    kartGroup.add(canopy);

    // Cyber Rear Spoiler / Wing
    const spoilerGeo = new THREE.BoxGeometry(3.0, 0.2, 0.8);
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x0d121f, metalness: 0.9, roughness: 0.1 });
    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(0, 1.45, -1.9);
    kartGroup.add(spoiler);

    // Spoiler Struts
    const strutMat = new THREE.MeshBasicMaterial({ color: primaryColorHex });
    const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7), strutMat);
    leftStrut.position.set(-1.1, 1.1, -1.9);
    kartGroup.add(leftStrut);
    const rightStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7), strutMat);
    rightStrut.position.set(1.1, 1.1, -1.9);
    kartGroup.add(rightStrut);

    // 4 Neon Cyber Wheels
    const wheels = [];
    const wheelPositions = [
      { x: -1.4, y: 0.5, z: 1.4 },
      { x: 1.4, y: 0.5, z: 1.4 },
      { x: -1.4, y: 0.5, z: -1.4 },
      { x: 1.4, y: 0.5, z: -1.4 }
    ];

    wheelPositions.forEach(pos => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(pos.x, pos.y, pos.z);

      const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 16);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.8 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      wheelGroup.add(tire);

      // Neon Rim Ring
      const rimGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 16);
      rimGeo.rotateY(Math.PI / 2);
      const rimMat = new THREE.MeshBasicMaterial({ color: primaryColorHex });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      kartGroup.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    // Dual Exhaust Nitro Thrusters
    const thrusterGlowGeo = new THREE.CircleGeometry(0.28, 12);
    const thrusterGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const leftExhaust = new THREE.Mesh(thrusterGlowGeo, thrusterGlowMat);
    leftExhaust.position.set(-0.6, 0.5, -2.25);
    kartGroup.add(leftExhaust);

    const rightExhaust = new THREE.Mesh(thrusterGlowGeo, thrusterGlowMat);
    rightExhaust.position.set(0.6, 0.5, -2.25);
    kartGroup.add(rightExhaust);

    // Dynamic Undercarriage Glow Light
    const underLight = new THREE.PointLight(primaryColorHex, 2.5, 9);
    underLight.position.set(0, 0.3, 0);
    kartGroup.add(underLight);

    return {
      mesh: kartGroup,
      wheels,
      exhausts: [leftExhaust, rightExhaust],
      light: underLight
    };
  }

  createKarts() {
    // Player 1 (Cyan Racer)
    const p1 = this.createKartMesh(0x00f0ff, 0x004466);
    this.scene.add(p1.mesh);
    this.karts[1] = {
      id: 1,
      name: 'Player 1',
      color: '#00f0ff',
      ...p1,
      x: -33,
      z: 22,
      angle: Math.PI / 2,
      speed: 0,
      maxSpeed: 1.15,
      accel: 0.038,
      steerAngle: 0,
      driftAngle: 0,
      isDrifting: false,
      lap: 1,
      currentWaypoint: 0,
      nitroEnergy: 100,
      hasItem: null, // 'missile', 'nitro', 'shield'
      input: { steer: 0, accel: false, brake: false, drift: false, item: false }
    };

    // Player 2 (Magenta Racer)
    const p2 = this.createKartMesh(0xff0055, 0x660022);
    this.scene.add(p2.mesh);
    this.karts[2] = {
      id: 2,
      name: 'Player 2',
      color: '#ff0055',
      ...p2,
      x: -37,
      z: 27,
      angle: Math.PI / 2,
      speed: 0,
      maxSpeed: 1.15,
      accel: 0.038,
      steerAngle: 0,
      driftAngle: 0,
      isDrifting: false,
      lap: 1,
      currentWaypoint: 0,
      nitroEnergy: 100,
      hasItem: null,
      input: { steer: 0, accel: false, brake: false, drift: false, item: false }
    };

    this.resetKartPositions();
  }

  resetKartPositions() {
    const p1 = this.karts[1];
    p1.x = -33;
    p1.z = 22;
    p1.angle = Math.PI / 2;
    p1.speed = 0;
    p1.lap = 1;
    p1.currentWaypoint = 0;
    p1.nitroEnergy = 100;
    p1.hasItem = null;
    p1.mesh.position.set(p1.x, 0, p1.z);
    p1.mesh.rotation.y = p1.angle;

    const p2 = this.karts[2];
    p2.x = -37;
    p2.z = 27;
    p2.angle = Math.PI / 2;
    p2.speed = 0;
    p2.lap = 1;
    p2.currentWaypoint = 0;
    p2.nitroEnergy = 100;
    p2.hasItem = null;
    p2.mesh.position.set(p2.x, 0, p2.z);
    p2.mesh.rotation.y = p2.angle;
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

    k.input = {
      steer: input.x !== undefined ? input.x : (input.steer || 0),
      accel: !!(input.fire || input.accel || input.btnA),
      brake: !!(input.brake || input.btnB),
      drift: !!(input.boost || input.drift || input.btnX),
      item: !!(input.shield || input.item || input.btnY)
    };
  }

  useItem(kart) {
    if (!kart.hasItem) return;
    const itemType = kart.hasItem;
    kart.hasItem = null;

    if (itemType === 'nitro') {
      kart.speed = kart.maxSpeed * 1.6;
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

    const speed = 2.2;
    this.projectiles.push({
      mesh,
      ownerId: kart.id,
      vx: Math.sin(kart.angle) * speed,
      vz: Math.cos(kart.angle) * speed,
      life: 80
    });
  }

  updatePhysics() {
    if (!this.raceActive) return;

    [1, 2].forEach(id => {
      const k = this.karts[id];

      // Handle Item usage
      if (k.input.item) {
        this.useItem(k);
      }

      // Acceleration & Braking
      if (k.input.accel) {
        k.speed = Math.min(k.maxSpeed, k.speed + k.accel);
      } else if (k.input.brake) {
        k.speed = Math.max(-0.4, k.speed - k.accel * 1.5);
      } else {
        k.speed *= 0.96; // Rolling friction
      }

      // Nitro boost
      if (k.input.drift && k.nitroEnergy > 5) {
        k.speed = Math.min(k.maxSpeed * 1.5, k.speed + 0.05);
        k.nitroEnergy = Math.max(0, k.nitroEnergy - 0.9);
        this.spawnExhaustParticles(k);
      } else {
        k.nitroEnergy = Math.min(100, k.nitroEnergy + 0.25);
      }

      // Steering
      const steerFactor = 0.045 * (k.speed / (k.maxSpeed || 1));
      if (Math.abs(k.input.steer) > 0.1) {
        k.angle += -k.input.steer * steerFactor;
      }

      // Move forward
      k.x += Math.sin(k.angle) * k.speed;
      k.z += Math.cos(k.angle) * k.speed;

      // Update 3D mesh
      k.mesh.position.set(k.x, 0, k.z);
      k.mesh.rotation.y = k.angle;

      // Wheel spin animation
      k.wheels.forEach(w => {
        w.children[0].rotation.x += k.speed * 1.8;
      });

      // Front wheels steer rotation
      k.wheels[0].rotation.y = -k.input.steer * 0.45;
      k.wheels[1].rotation.y = -k.input.steer * 0.45;

      // Checkpoint Progress Tracking
      this.checkLapProgress(k);

      // Boost Pad Triggers
      this.boostPads.forEach(pad => {
        if (Math.hypot(k.x - pad.pos.x, k.z - pad.pos.z) < 4.0) {
          k.speed = k.maxSpeed * 1.65;
          window.sounds?.playBoost();
          this.syncToMobile(k.id, 'haptic', { pattern: [50, 40] });
        }
      });

      // Item Box Pickups
      this.items.forEach(box => {
        if (box.active && Math.hypot(k.x - box.pos.x, k.z - box.pos.z) < 3.2) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 300; // 5 seconds
          k.hasItem = Math.random() > 0.5 ? 'nitro' : 'missile';
          window.sounds?.playPowerup();
          this.syncToMobile(k.id, 'haptic', { pattern: [30, 40, 80] });
          this.syncKartHud(k.id);
        }
      });
    });

    // Respawn Item Boxes
    this.items.forEach(box => {
      if (!box.active) {
        box.respawnTimer--;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
      } else {
        box.mesh.rotation.y += 0.04;
      }
    });

    // Update Missiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx;
      p.mesh.position.z += p.vz;
      p.life--;

      // Hit opponent check
      const targetId = p.ownerId === 1 ? 2 : 1;
      const target = this.karts[targetId];
      if (Math.hypot(p.mesh.position.x - target.x, p.mesh.position.z - target.z) < 3.0) {
        target.speed = -0.3; // spin out
        target.angle += Math.PI * 0.8;
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

    // Kart-to-Kart Bumping Collision
    const k1 = this.karts[1];
    const k2 = this.karts[2];
    const dx = k2.x - k1.x;
    const dz = k2.z - k1.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.6 && dist > 0.01) {
      const nx = dx / dist;
      const nz = dz / dist;
      k1.x -= nx * 0.8;
      k1.z -= nz * 0.8;
      k2.x += nx * 0.8;
      k2.z += nz * 0.8;
      window.sounds?.playHit();
      this.syncToMobile(1, 'haptic', { pattern: [35] });
      this.syncToMobile(2, 'haptic', { pattern: [35] });
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

  updateCamera() {
    const k1 = this.karts[1];
    const k2 = this.karts[2];

    const midX = (k1.x + k2.x) / 2;
    const midZ = (k1.z + k2.z) / 2;
    const dist = Math.hypot(k2.x - k1.x, k2.z - k1.z);

    const targetY = THREE.MathUtils.clamp(32 + dist * 0.45, 34, 58);
    const targetZ = midZ + THREE.MathUtils.clamp(30 + dist * 0.4, 32, 52);

    this.camera.position.x += (midX - this.camera.position.x) * 0.08;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.08;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.08;

    this.camera.lookAt(midX, 1.2, midZ);
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

