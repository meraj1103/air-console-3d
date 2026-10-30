// 3D Hyper Pong / Cyber Slam Game Engine (Three.js)
import * as THREE from '/vendor/three/three.module.js';

export class PongGame {
  constructor(container, onScoreUpdate, onRoundEnd, syncToMobile) {
    this.container = container;
    this.onScoreUpdate = onScoreUpdate;
    this.onRoundEnd = onRoundEnd;
    this.syncToMobile = syncToMobile;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;

    // Table / Court dimensions
    this.courtLength = 64; // X axis
    this.courtWidth = 36;  // Z axis

    this.roundActive = false;
    this.scores = { 1: 0, 2: 0 };
    this.targetScore = 5; // First to 5 goals

    this.paddles = {};
    this.puck = null;
    this.particles = [];
    this.shakeAmount = 0;

    this.initThree();
    this.buildCourt();
    this.createPaddlesAndPuck();
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
    this.camera.position.set(0, 48, 42);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x1a2638, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(0, 50, 20);
    this.scene.add(dirLight);
  }

  buildCourt() {
    // Holographic Cyber Court Surface
    const courtGeo = new THREE.BoxGeometry(this.courtLength, 1, this.courtWidth);
    const courtMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.1,
      metalness: 0.9
    });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.position.y = -0.5;
    this.scene.add(court);

    // Center dividing line & circle
    const centerLineGeo = new THREE.BoxGeometry(0.4, 0.1, this.courtWidth);
    const centerLineMat = new THREE.MeshBasicMaterial({ color: 0x335577 });
    const centerLine = new THREE.Mesh(centerLineGeo, centerLineMat);
    centerLine.position.y = 0.02;
    this.scene.add(centerLine);

    const centerRingGeo = new THREE.RingGeometry(5, 5.4, 32);
    centerRingGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x335577, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(centerRingGeo, ringMat);
    ring.position.y = 0.03;
    this.scene.add(ring);

    // Glowing Perimeter Rails
    const wallHeight = 2.0;
    const wallThick = 1.0;
    const hl = this.courtLength / 2;
    const hw = this.courtWidth / 2;

    const makeRail = (w, h, d, x, y, z, color) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0c1526,
        roughness: 0.2,
        metalness: 0.8,
        emissive: color,
        emissiveIntensity: 0.3
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      const stripGeo = new THREE.BoxGeometry(w, 0.3, d);
      const stripMat = new THREE.MeshBasicMaterial({ color });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(x, y + h / 2, z);
      this.scene.add(strip);
    };

    // Top & Bottom Rails (Z axis)
    makeRail(this.courtLength + wallThick * 2, wallHeight, wallThick, 0, wallHeight / 2, -hw, 0x00f0ff);
    makeRail(this.courtLength + wallThick * 2, wallHeight, wallThick, 0, wallHeight / 2, hw, 0xff007f);

    // Goal posts on ends (leaving a goal opening in the middle)
    const goalOpening = 16;
    const postWidth = (this.courtWidth - goalOpening) / 2;

    // Left Goal Posts (Player 1 side)
    makeRail(wallThick, wallHeight, postWidth, -hl, wallHeight / 2, -(goalOpening / 2 + postWidth / 2), 0x00f0ff);
    makeRail(wallThick, wallHeight, postWidth, -hl, wallHeight / 2, (goalOpening / 2 + postWidth / 2), 0x00f0ff);

    // Right Goal Posts (Player 2 side)
    makeRail(wallThick, wallHeight, postWidth, hl, wallHeight / 2, -(goalOpening / 2 + postWidth / 2), 0xff007f);
    makeRail(wallThick, wallHeight, postWidth, hl, wallHeight / 2, (goalOpening / 2 + postWidth / 2), 0xff007f);

    // Goal Laser Gate Lights
    const gateGeo = new THREE.CylinderGeometry(0.15, 0.15, goalOpening, 16);
    gateGeo.rotateX(Math.PI / 2);
    const gate1 = new THREE.Mesh(gateGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
    gate1.position.set(-hl - 0.5, 0.8, 0);
    this.scene.add(gate1);

    const gate2 = new THREE.Mesh(gateGeo, new THREE.MeshBasicMaterial({ color: 0xff007f, transparent: true, opacity: 0.7 }));
    gate2.position.set(hl + 0.5, 0.8, 0);
    this.scene.add(gate2);
  }

  createPaddlesAndPuck() {
    // Helper to make futuristic hover paddle
    const makePaddle = (colorHex) => {
      const group = new THREE.Group();

      const baseGeo = new THREE.CylinderGeometry(2.4, 2.8, 1.2, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x161c2e,
        roughness: 0.2,
        metalness: 0.8,
        emissive: colorHex,
        emissiveIntensity: 0.4
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.6;
      group.add(base);

      // Glowing Neon Rim
      const rimGeo = new THREE.TorusGeometry(2.6, 0.22, 12, 32);
      rimGeo.rotateX(Math.PI / 2);
      const rimMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 0.6;
      group.add(rim);

      // Grip Dome
      const domeGeo = new THREE.SphereGeometry(1.2, 16, 16);
      domeGeo.scale(1, 0.7, 1);
      const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0x070b14,
        roughness: 0.1,
        clearcoat: 1.0,
        emissive: colorHex,
        emissiveIntensity: 0.3
      });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.y = 1.3;
      group.add(dome);

      // Light
      const pl = new THREE.PointLight(colorHex, 2.0, 10);
      pl.position.y = 1.5;
      group.add(pl);

      return group;
    };

    // P1 Paddle (Cyan, Left side)
    const p1Group = makePaddle(0x00f0ff);
    this.scene.add(p1Group);
    this.paddles[1] = {
      id: 1,
      mesh: p1Group,
      x: -24,
      z: 0,
      vx: 0,
      vz: 0,
      input: { x: 0, y: 0, fire: false, boost: false }
    };

    // P2 Paddle (Magenta, Right side)
    const p2Group = makePaddle(0xff007f);
    this.scene.add(p2Group);
    this.paddles[2] = {
      id: 2,
      mesh: p2Group,
      x: 24,
      z: 0,
      vx: 0,
      vz: 0,
      input: { x: 0, y: 0, fire: false, boost: false }
    };

    // 3D Neon Energy Puck
    const puckGroup = new THREE.Group();
    const puckGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.7, 24);
    const puckMat = new THREE.MeshStandardMaterial({
      color: 0x090e1a,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 0.8
    });
    const puckMesh = new THREE.Mesh(puckGeo, puckMat);
    puckMesh.position.y = 0.35;
    puckGroup.add(puckMesh);

    // Glowing edge
    const puckEdgeGeo = new THREE.TorusGeometry(1.42, 0.16, 12, 32);
    puckEdgeGeo.rotateX(Math.PI / 2);
    const puckEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const puckEdge = new THREE.Mesh(puckEdgeGeo, puckEdgeMat);
    puckEdge.position.y = 0.35;
    puckGroup.add(puckEdge);

    const puckLight = new THREE.PointLight(0x00f0ff, 3.0, 12);
    puckLight.position.y = 1.0;
    puckGroup.add(puckLight);

    this.scene.add(puckGroup);

    this.puck = {
      mesh: puckGroup,
      edgeMat: puckEdgeMat,
      light: puckLight,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      speed: 0.9,
      curve: 0
    };

    this.resetPuck(1);
  }

  resetPuck(serverPlayer = 1) {
    this.puck.x = 0;
    this.puck.z = 0;
    this.puck.curve = 0;
    this.puck.speed = 0.85;

    // Serve towards player
    const dir = serverPlayer === 1 ? -1 : 1;
    const angle = (Math.random() - 0.5) * 0.8;
    this.puck.vx = Math.cos(angle) * this.puck.speed * dir;
    this.puck.vz = Math.sin(angle) * this.puck.speed;

    this.puck.mesh.position.set(0, 0, 0);
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
        textEl.textContent = 'SERVE!';
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
    const pad = this.paddles[playerNumber];
    if (!pad) return;

    pad.input = {
      x: input.x || 0,
      y: input.y || 0,
      fire: !!input.fire, // SMASH action
      boost: !!input.boost
    };

    if (input.tiltX !== undefined && input.tiltY !== undefined) {
      pad.input.x = THREE.MathUtils.clamp(input.tiltX / 30, -1, 1);
      pad.input.y = THREE.MathUtils.clamp(-input.tiltY / 30, -1, 1);
    }
  }

  createSparks(x, z, colorHex, count = 12) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, 0.6, z);
      this.scene.add(p);

      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 0.7 + 0.3;
      this.particles.push({
        mesh: p,
        vx: Math.cos(angle) * spd,
        vy: Math.random() * 0.6 + 0.2,
        vz: Math.sin(angle) * spd,
        life: 20
      });
    }
  }

  scoreGoal(scoringPlayer) {
    this.roundActive = false;
    this.scores[scoringPlayer]++;
    this.onScoreUpdate(this.scores);
    window.sounds.playVictory();
    this.shakeAmount = 20;

    const concedingPlayer = scoringPlayer === 1 ? 2 : 1;
    this.syncToMobile(scoringPlayer, 'haptic', { pattern: [60, 40, 120] });
    this.syncToMobile(concedingPlayer, 'haptic', { pattern: [180, 80, 200] });

    this.createSparks(scoringPlayer === 1 ? this.courtLength / 2 : -this.courtLength / 2, 0, scoringPlayer === 1 ? 0x00f0ff : 0xff007f, 40);

    setTimeout(() => {
      if (this.scores[scoringPlayer] >= this.targetScore) {
        this.onRoundEnd(scoringPlayer, true);
      } else {
        this.resetPuck(concedingPlayer);
        this.startCountdown();
      }
    }, 1800);
  }

  updatePhysics() {
    const hw = this.courtWidth / 2 - 1.5;
    const hl = this.courtLength / 2 - 1.5;

    // Update Paddles
    [1, 2].forEach(id => {
      const pad = this.paddles[id];
      const speed = pad.input.boost ? 0.8 : 0.52;

      pad.vx += pad.input.x * speed * 0.3;
      pad.vz += pad.input.y * speed * 0.3;

      pad.vx *= 0.85;
      pad.vz *= 0.85;

      pad.x += pad.vx;
      pad.z += pad.vz;

      // Keep within court boundaries and their respective court half
      pad.z = THREE.MathUtils.clamp(pad.z, -hw + 1.8, hw - 1.8);
      if (id === 1) {
        // Player 1 restricted to left half
        pad.x = THREE.MathUtils.clamp(pad.x, -hl + 2.0, -1.5);
      } else {
        // Player 2 restricted to right half
        pad.x = THREE.MathUtils.clamp(pad.x, 1.5, hl - 2.0);
      }

      pad.mesh.position.set(pad.x, 0, pad.z);
    });

    if (!this.roundActive) return;

    // Update Puck
    this.puck.x += this.puck.vx;
    this.puck.z += this.puck.vz;

    // Apply spin/curve
    this.puck.vz += this.puck.curve;
    this.puck.curve *= 0.98;

    // Top / Bottom rail bounce
    if (Math.abs(this.puck.z) > hw - 1.0) {
      this.puck.vz *= -1;
      this.puck.z = Math.sign(this.puck.z) * (hw - 1.0);
      window.sounds.playHit();
      this.createSparks(this.puck.x, this.puck.z, 0xffffff, 6);
    }

    // Goal checks (Left & Right ends)
    const goalOpening = 16 / 2;
    if (this.puck.x < -hl) {
      if (Math.abs(this.puck.z) < goalOpening) {
        // Player 2 scored!
        this.scoreGoal(2);
        return;
      } else {
        // Hit goal post
        this.puck.vx *= -1;
        this.puck.x = -hl;
        window.sounds.playHit();
      }
    } else if (this.puck.x > hl) {
      if (Math.abs(this.puck.z) < goalOpening) {
        // Player 1 scored!
        this.scoreGoal(1);
        return;
      } else {
        // Hit goal post
        this.puck.vx *= -1;
        this.puck.x = hl;
        window.sounds.playHit();
      }
    }

    // Paddle-to-Puck collision
    [1, 2].forEach(id => {
      const pad = this.paddles[id];
      const dx = this.puck.x - pad.x;
      const dz = this.puck.z - pad.z;
      const dist = Math.hypot(dx, dz);
      const hitRadius = 3.6;

      if (dist < hitRadius) {
        // Hit!
        const nx = dx / (dist || 1);
        const nz = dz / (dist || 1);

        // Smash mechanics if player pressed fire / smash
        let hitSpeed = Math.min(1.7, this.puck.speed * 1.06 + 0.1);
        if (pad.input.fire) {
          hitSpeed = 1.95; // MEGA SMASH!
          this.shakeAmount = 14;
          this.puck.curve = pad.input.y * 0.04;
          window.sounds.playLaser(id);
          this.syncToMobile(id, 'haptic', { pattern: [60, 30, 80] });
        } else {
          window.sounds.playHit();
          this.syncToMobile(id, 'haptic', { pattern: [35] });
        }

        this.puck.speed = hitSpeed;
        this.puck.vx = nx * this.puck.speed;
        this.puck.vz = nz * this.puck.speed;

        // Separate
        this.puck.x = pad.x + nx * (hitRadius + 0.1);
        this.puck.z = pad.z + nz * (hitRadius + 0.1);

        // Change puck glow to player color
        const color = id === 1 ? 0x00f0ff : 0xff007f;
        this.puck.edgeMat.color.setHex(color);
        this.puck.light.color.setHex(color);

        this.createSparks(this.puck.x, this.puck.z, color, 12);
      }
    });

    this.puck.mesh.position.set(this.puck.x, 0, this.puck.z);
    this.puck.mesh.rotation.y += 0.05;

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.mesh.position.x += pt.vx;
      pt.mesh.position.y += pt.vy;
      pt.mesh.position.z += pt.vz;
      pt.vy -= 0.02;
      pt.life--;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  updateCamera() {
    if (this.shakeAmount > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount * 0.1;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount * 0.1;
      this.shakeAmount *= 0.88;
      if (this.shakeAmount < 0.1) this.shakeAmount = 0;
    }
    this.camera.lookAt(0, 0, 0);
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
