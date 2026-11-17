import * as THREE from 'three';
import { AnimeToonMaterial } from '../materials/toonMaterials';
import { TrafficSignalHandle } from './exteriorProps';

export interface WeatherEffectsOptions {
  eaveDripPoints: THREE.Vector3[];
  flickerMaterials: AnimeToonMaterial[];
  steamSprites: THREE.Mesh[];
  acFanMeshes: THREE.Object3D[];
  trafficSignal: TrafficSignalHandle;
  trafficLight: THREE.PointLight;
  doorwayWarmLight: THREE.PointLight;
  setDoorOpenAmount: (open01: number) => void;
  roadUniforms: {
    uTime: { value: number };
    uTrafficColor: { value: THREE.Color };
    uSignFlicker: { value: number };
    uDoorOpen: { value: number };
  };
  glassUniforms: {
    uTime: { value: number };
  };
  noboriUniforms?: {
    uTime: { value: number };
  };
  onDoorOpen?: () => void;
  getDoorProximity?: () => number | null;
}

export interface WeatherEffectsController {
  group: THREE.Group;
  update: (elapsed: number, delta: number) => void;
  getDoorOpenAmount: () => number;
}

function isInsideKonbiniVolume(x: number, y: number, z: number): boolean {
  if (y > 4.25) return false;
  if (x >= -3.68 && x <= 3.9 && z >= -4.68 && z <= 1.9) {
    // Account for chamfered corner cut: x + z <= 3.72
    if (x + z <= 3.75) return true;
  }
  // Also exclude neighbor cottage solid volume
  if (y < 3.6 && x >= -8.8 && x <= -5.9 && z >= -7.35 && z <= -1.85) {
    return true;
  }
  return false;
}

export function createWeatherEffects(opts: WeatherEffectsOptions): WeatherEffectsController {
  const group = new THREE.Group();
  group.name = 'WeatherEffects';

  // =========================================================================
  // 1. CONTINUOUS SLANTED ANIME RAINFALL ("持续降雨")
  // =========================================================================
  const RAIN_COUNT = 960;
  const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 vertices per streak
  const rainAlphas = new Float32Array(RAIN_COUNT * 2);
  const rainState = new Float32Array(RAIN_COUNT * 4); // x, y, z, speed

  const windX = 0.075;
  const windZ = 0.035;

  function respawnRainDrop(i: number, randomHeight = false) {
    let rx = 0;
    let rz = 0;
    let ry = randomHeight ? Math.random() * 10.8 + 0.4 : 9.8 + Math.random() * 2.2;
    for (let tries = 0; tries < 5; tries++) {
      rx = (Math.random() - 0.5) * 17.5;
      rz = (Math.random() - 0.5) * 17.5;
      if (!isInsideKonbiniVolume(rx, ry, rz)) break;
    }
    rainState[i * 4 + 0] = rx;
    rainState[i * 4 + 1] = ry;
    rainState[i * 4 + 2] = rz;
    rainState[i * 4 + 3] = 11.5 + Math.random() * 5.5;
  }

  for (let i = 0; i < RAIN_COUNT; i++) {
    respawnRainDrop(i, true);
    rainAlphas[i * 2 + 0] = 0.0; // tail fades to transparent
    rainAlphas[i * 2 + 1] = 0.42 + Math.random() * 0.26; // crisp glistening tip
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.setAttribute('aAlpha', new THREE.BufferAttribute(rainAlphas, 1));

  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aAlpha;
      varying float vAlpha;
      varying vec3 vWorldPos;
      void main() {
        vAlpha = aAlpha;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vWorldPos;
      void main() {
        // Soft vertical fade near top of diorama volume so rain emerges naturally from night mist
        float topFade = smoothstep(11.4, 8.2, vWorldPos.y);
        // Warm golden tint near konbini windows, cool icy blue elsewhere
        float nearStore = exp(-length(vWorldPos.xz - vec2(0.5, 1.8)) * 0.28);
        vec3 col = mix(vec3(0.66, 0.82, 1.0), vec3(1.0, 0.90, 0.72), nearStore * 0.55);
        gl_FragColor = vec4(col, vAlpha * topFade);
      }
    `,
  });

  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  group.add(rainLines);

  // =========================================================================
  // 2. EAVE WATER DRIPS ("屋檐滴水")
  // =========================================================================
  interface DripParticle {
    origin: THREE.Vector3;
    y: number;
    vy: number;
    waitTimer: number;
    groundY: number;
  }

  const dripPoints = opts.eaveDripPoints;
  const dripParticles: DripParticle[] = dripPoints.map((pt, idx) => ({
    origin: pt.clone(),
    y: pt.y,
    vy: 0,
    waitTimer: (idx * 0.37) % 2.4,
    groundY: pt.x > -5.3 && pt.x < 5.35 && pt.z < 4.35 ? 0.15 : 0.02,
  }));

  const dripGeo = new THREE.SphereGeometry(0.022, 6, 6);
  dripGeo.scale(0.85, 2.1, 0.85);
  const dripMat = new THREE.MeshBasicMaterial({
    color: 0xd8eeff,
    transparent: true,
    opacity: 0.78,
  });
  const dripInst = new THREE.InstancedMesh(dripGeo, dripMat, Math.max(1, dripParticles.length));
  dripInst.frustumCulled = false;
  group.add(dripInst);

  // =========================================================================
  // 3. ANIME CONCENTRIC PUDDLE RIPPLE RINGS (Single InstancedMesh = 1 Draw Call!)
  // =========================================================================
  interface RippleRing {
    index: number;
    age: number;
    duration: number;
    maxRadius: number;
    isEaveSplash: boolean;
    hidden: boolean;
  }

  const puddleZones: Array<[number, number, number, number, number]> = [
    // [centerX, centerZ, radiusX, radiusZ, groundY]
    [1.15, 5.95, 2.0, 0.95, 0.016],
    [-2.65, 5.45, 1.5, 0.75, 0.016],
    [5.35, 5.65, 1.6, 1.05, 0.016],
    [7.15, 1.65, 0.9, 1.6, 0.016],
    [-6.8, 2.85, 1.0, 0.75, 0.016],
    [-0.2, 4.58, 3.2, 0.16, 0.016],
    [-4.55, 0.2, 0.45, 0.95, 0.016],
    [-6.4, 7.15, 1.5, 0.7, 0.016],
  ];

  const RIPPLE_COUNT = 46;
  const rippleGeo = new THREE.PlaneGeometry(1, 1);
  rippleGeo.rotateX(-Math.PI / 2);

  const rippleProgArr = new Float32Array(RIPPLE_COUNT);
  const rippleTintArr = new Float32Array(RIPPLE_COUNT * 3);
  const rippleProgAttr = new THREE.InstancedBufferAttribute(rippleProgArr, 1);
  const rippleTintAttr = new THREE.InstancedBufferAttribute(rippleTintArr, 3);
  rippleProgAttr.setUsage(THREE.DynamicDrawUsage);
  rippleGeo.setAttribute('aProgress', rippleProgAttr);
  rippleGeo.setAttribute('aTint', rippleTintAttr);

  const rippleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aProgress;
      attribute vec3 aTint;
      varying vec2 vUv;
      varying float vProgress;
      varying vec3 vTint;
      void main() {
        vUv = uv - 0.5;
        vProgress = aProgress;
        vTint = aTint;
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vProgress;
      varying vec3 vTint;
      void main() {
        if (vProgress >= 0.999) discard;
        float d = length(vUv) * 2.0;
        float r1 = vProgress;
        float r2 = max(0.0, vProgress - 0.26);
        float ring1 = smoothstep(0.055, 0.012, abs(d - r1));
        float ring2 = smoothstep(0.045, 0.012, abs(d - r2)) * step(0.26, vProgress) * 0.55;
        float om = clamp(1.0 - vProgress, 0.0, 1.0);
        float fade = om * sqrt(om);
        float alpha = (ring1 + ring2) * fade * 0.34;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vTint, alpha);
      }
    `,
  });

  const rippleInst = new THREE.InstancedMesh(rippleGeo, rippleMat, RIPPLE_COUNT);
  rippleInst.frustumCulled = false;
  group.add(rippleInst);

  const rippleDummy = new THREE.Object3D();
  const ripples: RippleRing[] = [];
  let rippleMatrixDirty = false;
  let rippleTintDirty = false;

  function setRippleMatrix(idx: number, x: number, y: number, z: number, radius: number) {
    const s = Math.max(0.02, radius * 2.0);
    rippleDummy.position.set(x, y, z);
    rippleDummy.scale.set(s, 1, s);
    rippleDummy.updateMatrix();
    rippleInst.setMatrixAt(idx, rippleDummy.matrix);
    rippleMatrixDirty = true;
  }

  function setRippleTint(idx: number, hex: number) {
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >> 8) & 0xff) / 255;
    const b = (hex & 0xff) / 255;
    rippleTintArr[idx * 3 + 0] = r;
    rippleTintArr[idx * 3 + 1] = g;
    rippleTintArr[idx * 3 + 2] = b;
    rippleTintDirty = true;
  }

  function placeRandomPuddleRipple(r: RippleRing) {
    const zone = puddleZones[Math.floor(Math.random() * puddleZones.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random());
    const px = zone[0] + Math.cos(angle) * dist * zone[2];
    const pz = zone[1] + Math.sin(angle) * dist * zone[3];
    r.duration = 0.95 + Math.random() * 0.75;
    r.maxRadius = 0.24 + Math.random() * 0.28;
    r.hidden = false;
    setRippleMatrix(r.index, px, zone[4], pz, r.maxRadius);
    setRippleTint(r.index, pz < 6.4 && px > -2.5 && px < 3.5 ? 0xffe0a8 : 0x9cd2ff);
  }

  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const ring: RippleRing = {
      index: i,
      age: Math.random() * 1.4,
      duration: 1.2,
      maxRadius: 0.32,
      isEaveSplash: i < 10,
      hidden: false,
    };
    placeRandomPuddleRipple(ring);
    ripples.push(ring);
  }
  rippleInst.instanceMatrix.needsUpdate = true;
  rippleTintAttr.needsUpdate = true;

  let nextSplashSlot = 0;
  function triggerDripSplash(x: number, y: number, z: number) {
    const ring = ripples[nextSplashSlot % 10];
    nextSplashSlot++;
    ring.age = 0;
    ring.duration = 0.72;
    ring.maxRadius = 0.22;
    ring.hidden = false;
    setRippleMatrix(ring.index, x, y + 0.008, z, ring.maxRadius);
    setRippleTint(ring.index, 0xffe4b5);
  }

  // =========================================================================
  // 3B. FLOATING NOCTURNAL RAIN-MIST MOTES (GPU-animated in vertex shader!)
  // =========================================================================
  const MOTE_COUNT = 64;
  const moteSeed = new Float32Array(MOTE_COUNT);
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  const moteCol = new Float32Array(MOTE_COUNT * 3);

  for (let i = 0; i < MOTE_COUNT; i++) {
    let mx = 0, my = 0, mz = 0;
    const r = Math.random();
    if (r < 0.35) {
      mx = 3.2 + (Math.random() - 0.5) * 3.8;
      my = 1.0 + Math.random() * 4.2;
      mz = 4.2 + (Math.random() - 0.5) * 3.8;
      moteCol[i * 3 + 0] = 0.72;
      moteCol[i * 3 + 1] = 0.88;
      moteCol[i * 3 + 2] = 1.0;
    } else if (r < 0.72) {
      mx = 0.5 + (Math.random() - 0.5) * 5.2;
      my = 0.4 + Math.random() * 2.5;
      mz = 2.6 + (Math.random() - 0.5) * 2.4;
      moteCol[i * 3 + 0] = 1.0;
      moteCol[i * 3 + 1] = 0.82;
      moteCol[i * 3 + 2] = 0.52;
    } else {
      mx = -4.6 + (Math.random() - 0.5) * 3.2;
      my = 0.4 + Math.random() * 2.4;
      mz = 1.2 + (Math.random() - 0.5) * 3.6;
      moteCol[i * 3 + 0] = 0.62;
      moteCol[i * 3 + 1] = 0.84;
      moteCol[i * 3 + 2] = 1.0;
    }
    moteBase[i * 3 + 0] = mx;
    moteBase[i * 3 + 1] = my;
    moteBase[i * 3 + 2] = mz;
    moteSeed[i] = Math.random() * 10.0;
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase, 3));
  moteGeo.setAttribute('aColor', new THREE.BufferAttribute(moteCol, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeed, 1));

  const moteMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSeed;
      uniform float uTime;
      varying vec3 vCol;
      varying float vPulse;
      void main() {
        vCol = aColor;
        vPulse = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.4 + aSeed * 3.1));
        vec3 p = position + vec3(
          sin(uTime * 0.42 + aSeed) * 0.28,
          cos(uTime * 0.35 + aSeed * 1.3) * 0.16,
          cos(uTime * 0.38 + aSeed * 0.8) * 0.24
        );
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp((38.0 + 18.0 * sin(aSeed)) / max(-mvPosition.z, 1.0), 2.0, 11.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vCol;
      varying float vPulse;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float soft = (1.0 - d) * (1.0 - d);
        gl_FragColor = vec4(vCol, soft * vPulse * 0.28);
      }
    `,
  });

  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.frustumCulled = false;
  group.add(motePoints);

  // =========================================================================
  // 4. UPDATE LOOP: RAIN, DRIPS, RIPPLES, FLICKER, AUTO DOOR & TRAFFIC LIGHT
  // =========================================================================
  const dummy = new THREE.Object3D();
  const baseEmissiveIntensities = opts.flickerMaterials.map((m) => m.emissiveIntensity);
  let wasDoorOpen = false;
  let curDoorOpen = 0;

  const colGreen = new THREE.Color(0x1ce092);
  const colAmber = new THREE.Color(0xffad24);
  const colRed = new THREE.Color(0xff3348);

  function update(elapsed: number, delta: number) {
    const dt = Math.min(delta, 0.05);

    opts.roadUniforms.uTime.value = elapsed;
    opts.glassUniforms.uTime.value = elapsed;
    if (opts.noboriUniforms) {
      opts.noboriUniforms.uTime.value = elapsed;
    }
    moteMat.uniforms.uTime.value = elapsed;

    // 4A. Update Slanted Rain Streaks
    const posArr = rainGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const spd = rainState[i * 4 + 3];
      rainState[i * 4 + 0] += windX * spd * dt;
      rainState[i * 4 + 1] -= spd * dt;
      rainState[i * 4 + 2] += windZ * spd * dt;

      const x = rainState[i * 4 + 0];
      const y = rainState[i * 4 + 1];
      const z = rainState[i * 4 + 2];

      if (
        y < 0.05 ||
        Math.abs(x) > 8.95 ||
        Math.abs(z) > 8.95 ||
        isInsideKonbiniVolume(x, y, z)
      ) {
        respawnRainDrop(i, false);
      }

      const cx = rainState[i * 4 + 0];
      const cy = rainState[i * 4 + 1];
      const cz = rainState[i * 4 + 2];
      const streakLen = 0.42;

      // Tail vertex
      posArr[i * 6 + 0] = cx - windX * streakLen;
      posArr[i * 6 + 1] = cy + streakLen;
      posArr[i * 6 + 2] = cz - windZ * streakLen;
      // Tip vertex
      posArr[i * 6 + 3] = cx;
      posArr[i * 6 + 4] = cy;
      posArr[i * 6 + 5] = cz;
    }
    rainGeo.attributes.position.needsUpdate = true;

    // 4B. Update Eave Water Drips ("屋檐滴水")
    for (let i = 0; i < dripParticles.length; i++) {
      const p = dripParticles[i];
      if (p.waitTimer > 0) {
        p.waitTimer -= dt;
        // Swelling droplet hanging right under eave lip
        const swell = THREE.MathUtils.clamp(1.0 - p.waitTimer * 0.5, 0.25, 0.9);
        dummy.position.set(p.origin.x, p.origin.y, p.origin.z);
        dummy.scale.set(swell, swell * 0.7, swell);
      } else {
        p.vy += 9.5 * dt;
        p.y -= p.vy * dt;
        dummy.position.set(p.origin.x, p.y, p.origin.z);
        dummy.scale.set(0.85, 1.25 + p.vy * 0.12, 0.85);

        if (p.y <= p.groundY) {
          triggerDripSplash(p.origin.x, p.groundY, p.origin.z);
          p.y = p.origin.y;
          p.vy = 0;
          p.waitTimer = 0.85 + Math.random() * 1.95;
        }
      }
      dummy.updateMatrix();
      dripInst.setMatrixAt(i, dummy.matrix);
    }
    dripInst.instanceMatrix.needsUpdate = true;

    // 4C. Update Puddle Ripple Rings (Single InstancedMesh!)
    for (const r of ripples) {
      r.age += dt;
      if (r.age >= r.duration) {
        if (r.isEaveSplash) {
          if (!r.hidden) {
            r.hidden = true;
            rippleProgArr[r.index] = 1.0;
          }
          continue;
        }
        r.age = 0;
        placeRandomPuddleRipple(r);
      }
      rippleProgArr[r.index] = THREE.MathUtils.clamp(r.age / r.duration, 0, 1);
    }
    rippleProgAttr.needsUpdate = true;
    if (rippleMatrixDirty) {
      rippleInst.instanceMatrix.needsUpdate = true;
      rippleMatrixDirty = false;
    }
    if (rippleTintDirty) {
      rippleTintAttr.needsUpdate = true;
      rippleTintDirty = false;
    }

    // 4D. Subtle Signboard / Lightbox Micro-Flicker ("便利店招牌或灯箱轻微闪烁")
    const flickerCycle = elapsed % 7.4;
    let flickerMul = 1.0;
    if (flickerCycle > 6.65 && flickerCycle < 6.73) {
      flickerMul = 0.48;
    } else if (flickerCycle > 6.81 && flickerCycle < 6.87) {
      flickerMul = 0.62;
    } else if (flickerCycle > 6.95 && flickerCycle < 6.99) {
      flickerMul = 0.75;
    } else {
      flickerMul = 0.98 + Math.sin(elapsed * 23.0) * 0.02;
    }
    opts.roadUniforms.uSignFlicker.value = flickerMul;
    for (let i = 0; i < opts.flickerMaterials.length; i++) {
      opts.flickerMaterials[i].emissiveIntensity = baseEmissiveIntensities[i] * flickerMul;
    }

    // 4E. Automatic Door Proximity Sensor in Explore Mode / Ambient Cycle in Orbit Mode
    const proximityDist = opts.getDoorProximity?.() ?? null;
    if (proximityDist !== null) {
      const targetOpen = proximityDist < 2.65 ? 1.0 : 0.0;
      const speed = targetOpen > curDoorOpen ? 3.8 : 2.1;
      curDoorOpen += (targetOpen - curDoorOpen) * Math.min(1, dt * speed);
      if (Math.abs(targetOpen - curDoorOpen) < 0.005) curDoorOpen = targetOpen;
    } else {
      const doorCycle = elapsed % 14.5;
      let cycleOpen = 0.0;
      if (doorCycle > 4.0 && doorCycle < 4.9) {
        cycleOpen = THREE.MathUtils.smoothstep(doorCycle, 4.0, 4.9);
      } else if (doorCycle >= 4.9 && doorCycle < 7.5) {
        cycleOpen = 1.0;
      } else if (doorCycle >= 7.5 && doorCycle < 8.5) {
        cycleOpen = 1.0 - THREE.MathUtils.smoothstep(doorCycle, 7.5, 8.5);
      }
      curDoorOpen = cycleOpen;
    }
    const doorOpen = curDoorOpen;
    const isOpening = doorOpen > 0.08;
    if (isOpening && !wasDoorOpen) {
      opts.onDoorOpen?.();
    }
    wasDoorOpen = isOpening;

    opts.setDoorOpenAmount(doorOpen);
    opts.roadUniforms.uDoorOpen.value = doorOpen;
    opts.doorwayWarmLight.intensity = 2.6 + doorOpen * 1.65;

    // 4F. Distant Corner Traffic Signal Subtle Cycle ("远处交通信号灯微弱变化")
    const sigPhase = elapsed % 19.0;
    if (sigPhase < 9.5) {
      // Emerald Green
      opts.trafficSignal.greenLens.emissiveIntensity = 2.05;
      opts.trafficSignal.amberLens.emissiveIntensity = 0.02;
      opts.trafficSignal.redLens.emissiveIntensity = 0.02;
      opts.trafficSignal.pedGreenMat.emissiveIntensity =
        sigPhase > 7.5 ? (Math.sin(elapsed * 14.0) > 0 ? 1.8 : 0.05) : 1.75;
      opts.trafficSignal.pedRedMat.emissiveIntensity = 0.02;
      opts.trafficLight.color.lerp(colGreen, 0.15);
      opts.roadUniforms.uTrafficColor.value.lerp(colGreen, 0.12);
    } else if (sigPhase < 12.0) {
      // Warm Amber
      opts.trafficSignal.greenLens.emissiveIntensity = 0.02;
      opts.trafficSignal.amberLens.emissiveIntensity = 2.0;
      opts.trafficSignal.redLens.emissiveIntensity = 0.02;
      opts.trafficSignal.pedGreenMat.emissiveIntensity = 0.02;
      opts.trafficSignal.pedRedMat.emissiveIntensity = 1.75;
      opts.trafficLight.color.lerp(colAmber, 0.15);
      opts.roadUniforms.uTrafficColor.value.lerp(colAmber, 0.12);
    } else {
      // Ruby Red
      opts.trafficSignal.greenLens.emissiveIntensity = 0.02;
      opts.trafficSignal.amberLens.emissiveIntensity = 0.02;
      opts.trafficSignal.redLens.emissiveIntensity = 2.05;
      opts.trafficSignal.pedGreenMat.emissiveIntensity = 0.02;
      opts.trafficSignal.pedRedMat.emissiveIntensity = 1.85;
      opts.trafficLight.color.lerp(colRed, 0.15);
      opts.roadUniforms.uTrafficColor.value.lerp(colRed, 0.12);
    }

    // 4G. Oden Steam Wisps & AC Fan Spin
    for (const wisp of opts.steamSprites) {
      const local = (elapsed * 0.55 + (wisp.userData.phase as number)) % 1.0;
      wisp.position.y = (wisp.userData.baseY as number) + local * 0.28;
      const s = 0.65 + local * 0.75;
      wisp.scale.set(s, s, s);
      (wisp.material as THREE.MeshBasicMaterial).opacity = Math.sin(local * Math.PI) * 0.26;
    }

    // Top AC unit fan spins steadily, bottom units rest or spin slowly
    if (opts.acFanMeshes.length > 0) {
      opts.acFanMeshes[1]?.rotateX(dt * 7.5);
      opts.acFanMeshes[0]?.rotateX(dt * 2.2);
    }
  }

  return {
    group,
    update,
    getDoorOpenAmount: () => curDoorOpen,
  };
}
