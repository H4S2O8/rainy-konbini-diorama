import * as THREE from 'three';
import { createToonMaterial, inkMesh } from '../materials/toonMaterials';
import {
  createBrailleTileTexture,
  createSidewalkTileTexture,
  createWorldRoadMaps,
} from '../textures/proceduralTextures';

export interface DioramaBaseResult {
  group: THREE.Group;
  roadMesh: THREE.Mesh;
  roadUniforms: {
    tReflection: { value: THREE.Texture };
    uTextureMatrix: { value: THREE.Matrix4 };
    uTime: { value: number };
    uTrafficColor: { value: THREE.Color };
    uSignFlicker: { value: number };
    uDoorOpen: { value: number };
  };
  updateReflection: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    hiddenObjects?: THREE.Object3D[]
  ) => void;
}

export function createDioramaBase(): DioramaBaseResult {
  const group = new THREE.Group();
  group.name = 'DioramaBase';

  // =========================================================================
  // 1. COLLECTIBLE SQUARE DIORAMA PLINTH (18.0 x 18.0 base)
  // =========================================================================
  const subSoilMat = createToonMaterial({ color: 0x20283a });
  const plinthMat = createToonMaterial({ color: 0x121826 });
  const trimMat = createToonMaterial({
    color: 0x998468,
    emissive: 0x3b2e20,
    emissiveIntensity: 0.34,
    wetRim: true,
    wetRimStrength: 0.35,
  });
  const footMat = createToonMaterial({ color: 0x090d16 });

  // Upper structural cross-section block just below Y=0
  const upperSlab = inkMesh(new THREE.BoxGeometry(18.02, 0.38, 18.02), subSoilMat, {
    castShadow: false,
    receiveShadow: false,
  });
  upperSlab.position.set(0, -0.195, 0);
  group.add(upperSlab);

  // Thin warm bronze/slate collector accent bevel line
  const accentTrim = inkMesh(new THREE.BoxGeometry(18.22, 0.045, 18.22), trimMat, {
    edges: false,
    castShadow: false,
  });
  accentTrim.position.set(0, -0.405, 0);
  group.add(accentTrim);

  // Main bevelled collector base frame
  const lowerPlinth = inkMesh(new THREE.BoxGeometry(18.42, 0.44, 18.42), plinthMat, {
    castShadow: false,
    receiveShadow: false,
  });
  lowerPlinth.position.set(0, -0.645, 0);
  group.add(lowerPlinth);

  // Recessed underside shadow foot
  const shadowFoot = new THREE.Mesh(new THREE.BoxGeometry(17.7, 0.14, 17.7), footMat);
  shadowFoot.position.set(0, -0.93, 0);
  group.add(shadowFoot);

  // Subtle floating studio diorama halo/shadow disc under the square plinth
  const plinthAuraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv - 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float d = length(vUv) * 2.0;
        float glow = exp(-d * d * 4.5);
        vec3 col = mix(vec3(0.02, 0.04, 0.09), vec3(0.11, 0.22, 0.44), glow * 0.5);
        gl_FragColor = vec4(col, (1.0 - smoothstep(0.45, 0.98, d)) * 0.42);
      }
    `,
  });
  const plinthAura = new THREE.Mesh(new THREE.PlaneGeometry(25.5, 25.5), plinthAuraMat);
  plinthAura.rotation.x = -Math.PI / 2;
  plinthAura.position.y = -1.03;
  group.add(plinthAura);

  // =========================================================================
  // 2. REAL-TIME PLANAR PUDDLE REFLECTION + WET ANIME ASPHALT SHADER (Y = 0)
  // =========================================================================
  const { albedoMap, puddleMaskMap } = createWorldRoadMaps();

  const reflectionRT = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
  });

  const textureMatrix = new THREE.Matrix4();
  const virtualCamera = new THREE.PerspectiveCamera();
  const reflectorPlane = new THREE.Plane();
  const normal = new THREE.Vector3(0, 1, 0);
  const reflectorWorldPosition = new THREE.Vector3(0, 0, 0);
  const cameraWorldPosition = new THREE.Vector3();
  const rotationMatrix = new THREE.Matrix4();
  const lookAtPosition = new THREE.Vector3(0, 0, -1);
  const clipPlane = new THREE.Vector4();
  const view = new THREE.Vector3();
  const target = new THREE.Vector3();
  const q = new THREE.Vector4();

  const roadUniforms = {
    tAlbedo: { value: albedoMap },
    tPuddle: { value: puddleMaskMap },
    tReflection: { value: reflectionRT.texture },
    uTextureMatrix: { value: textureMatrix },
    uTime: { value: 0 },
    uTrafficColor: { value: new THREE.Color(0x28e09b) },
    uSignFlicker: { value: 1.0 },
    uDoorOpen: { value: 0.0 },
  };

  const roadShaderMat = new THREE.ShaderMaterial({
    uniforms: roadUniforms,
    vertexShader: `
      uniform mat4 uTextureMatrix;
      varying vec2 vUv;
      varying vec4 vReflUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vReflUv = uTextureMatrix * worldPos;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D tAlbedo;
      uniform sampler2D tPuddle;
      uniform sampler2D tReflection;
      uniform float uTime;
      uniform vec3 uTrafficColor;
      uniform float uSignFlicker;
      uniform float uDoorOpen;

      varying vec2 vUv;
      varying vec4 vReflUv;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Procedural anime concentric raindrop ripple normal perturbation (2 octaves)
      vec2 rainRipples(vec2 wp, float t) {
        vec2 total = vec2(0.0);
        for (int layer = 0; layer < 2; layer++) {
          float scale = 1.65 + float(layer) * 0.95;
          vec2 uv = wp * scale + float(layer) * 17.3;
          vec2 id = floor(uv);
          vec2 gv = fract(uv) - 0.5;

          float rnd = hash21(id);
          vec2 center = (vec2(hash21(id + 3.1), hash21(id + 9.7)) - 0.5) * 0.52;
          float localT = fract(t * 0.62 + rnd);
          float radius = localT * 0.52;
          vec2 dVec = gv - center;
          float dist = length(dVec) + 1e-4;

          float ring = sin((dist - radius) * 52.0) * exp(-abs(dist - radius) * 26.0);
          float fade = (1.0 - localT) * smoothstep(0.02, 0.08, localT);
          total += (dVec / dist) * ring * fade;
        }
        return total;
      }

      void main() {
        vec3 baseCol = texture2D(tAlbedo, vUv).rgb;
        vec3 mask = texture2D(tPuddle, vUv).rgb;

        // Break up puddle contours with natural multi-scale organic asphalt micro-depression noise
        float nEdge = noise2(vWorldPos.xz * 1.45) * 0.38 + noise2(vWorldPos.xz * 3.4) * 0.16 - 0.27;
        float puddleRaw = mask.r + nEdge * (1.0 - smoothstep(0.72, 0.95, mask.r));
        float puddle = smoothstep(0.32, 0.72, puddleRaw);

        // Detect painted white crosswalk / road markings for reflective paint sheen
        float paintMask = smoothstep(0.45, 0.78, (baseCol.r + baseCol.g + baseCol.b) / 3.0);

        // Mineral wet asphalt aggregate grain (rough outside puddles, mirror-smooth inside puddles!)
        vec2 pebbleCell = floor(vWorldPos.xz * 42.0);
        float pebbleRnd = hash21(pebbleCell);
        vec2 pebbleJitter = (vec2(pebbleRnd, hash21(pebbleCell + 13.7)) - 0.5) * 0.011 * (1.0 - puddle);

        // Only evaluate procedural rain ripples inside puddle pixels!
        vec2 ripple = puddle > 0.03 ? rainRipples(vWorldPos.xz, uTime) : vec2(0.0);
        float windShimmer = sin(vWorldPos.x * 9.0 + uTime * 3.2) * cos(vWorldPos.z * 11.0 - uTime * 2.6) * 0.0022;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fBase = clamp(1.0 - clamp(viewDir.y, 0.05, 1.0), 0.0, 1.0);
        float fresnel = fBase * fBase * sqrt(fBase);

        // Projective reflection sampling (mirror-clean in puddles, granular mineral smear on damp asphalt)
        vec4 proj = vReflUv;
        float wSafe = max(proj.w, 0.001);
        vec2 reflUvBase = proj.xy / wSafe;

        vec2 puddleOffset = ripple * (0.017 * puddle + 0.004) + pebbleJitter + vec2(windShimmer);
        vec3 reflCrisp = texture2D(tReflection, clamp(reflUvBase + puddleOffset, 0.002, 0.998)).rgb;

        // Multi-tap vertical/horizontal smear for damp rough asphalt sheen
        float blurAmt = mix(0.018, 0.0020, puddle);
        vec3 reflBlur = (
          texture2D(tReflection, clamp(reflUvBase + puddleOffset + vec2(blurAmt, 0.0), 0.002, 0.998)).rgb +
          texture2D(tReflection, clamp(reflUvBase + puddleOffset - vec2(blurAmt, 0.0), 0.002, 0.998)).rgb +
          texture2D(tReflection, clamp(reflUvBase + puddleOffset + vec2(0.0, blurAmt * 2.1), 0.002, 0.998)).rgb +
          reflCrisp
        ) * 0.25;

        vec3 reflCol = mix(reflBlur, reflCrisp, puddle);

        // Night atmosphere lighting pools on wet road (with subtle mineral stone value variation)
        vec3 litAsphalt = baseCol * vec3(0.38, 0.46, 0.70) * (0.94 + pebbleRnd * 0.12);

        // Curb & sidewalk contact AO shadow along main corner curb
        float nearFrontCurb = smoothstep(0.0, 0.48, max(0.0, vWorldPos.z - 4.38)) + step(vWorldPos.z, 4.38);
        float frontCurbSpan = step(-4.45, vWorldPos.x) * step(vWorldPos.x, 4.2);
        float nearSideCurb = smoothstep(0.0, 0.48, max(0.0, vWorldPos.x - 5.38)) + step(vWorldPos.x, 5.38);
        float sideCurbSpan = step(-9.0, vWorldPos.z) * step(vWorldPos.z, 3.2);
        float curbAO = mix(0.70, 1.0, mix(1.0, nearFrontCurb, frontCurbSpan) * mix(1.0, nearSideCurb, sideCurbSpan));
        litAsphalt *= curbAO;

        // Warm golden spill from konbini windows & automatic corner door
        float distFrontWin = length((vWorldPos.xz - vec2(-0.5, 3.3)) * vec2(0.36, 0.65));
        float distCornerDoor = length((vWorldPos.xz - vec2(3.6, 2.3)) * vec2(0.5, 0.5));
        float distSideWin = length((vWorldPos.xz - vec2(5.1, -1.6)) * vec2(0.68, 0.42));
        float warmSpill = exp(-distFrontWin * 1.45) * 0.56
                        + exp(-distCornerDoor * 1.35) * (0.52 + uDoorOpen * 0.24)
                        + exp(-distSideWin * 1.55) * 0.38;
        litAsphalt += vec3(1.0, 0.72, 0.34) * warmSpill * (0.44 + paintMask * 0.52);

        // Cool cyan-blue konbini signboard & vending machine spill
        float distVending = length((vWorldPos.xz - vec2(-4.15, 3.0)) * vec2(0.6, 0.6));
        litAsphalt += vec3(0.24, 0.76, 1.0) * exp(-distVending * 1.5) * 0.52 * uSignFlicker;

        // Pylon pole sign spill near parking corner
        float distPylon = length((vWorldPos.xz - vec2(-8.0, 4.3)) * vec2(0.55, 0.55));
        litAsphalt += vec3(0.34, 0.74, 1.0) * exp(-distPylon * 1.4) * 0.40;

        // Streetlamp pool at street corner (+4.5, +4.6) + wet mineral glint specks!
        float distLamp = length((vWorldPos.xz - vec2(4.7, 4.9)) * vec2(0.45, 0.45));
        float lampPool = exp(-distLamp * 1.35);
        float wetSparkle = step(0.91, pebbleRnd) * (1.0 - puddle) * (lampPool + warmSpill * 0.8) * 0.32;
        litAsphalt += vec3(0.76, 0.86, 1.0) * lampPool * 0.32 + vec3(0.85, 0.92, 1.0) * wetSparkle;

        // Distant corner traffic signal dynamic color wash (+7.4, +5.4)
        float distSignal = length((vWorldPos.xz - vec2(7.0, 5.2)) * vec2(0.48, 0.44));
        litAsphalt += uTrafficColor * exp(-distSignal * 1.65) * 0.24;

        // Puddle darkens underlying asphalt so mirror reflections pop like wet glass
        litAsphalt *= mix(1.0, 0.38, puddle * (1.0 - paintMask * 0.45));

        // Combine reflection strength: glassy in puddles, crisp vertical wet smear on damp asphalt
        float reflWeight = mix(0.20 + paintMask * 0.22, 0.78, puddle);
        reflWeight = clamp(reflWeight + fresnel * (0.14 + puddle * 0.20), 0.0, 0.92);

        vec3 finalCol = mix(litAsphalt, reflCol * vec3(0.84, 0.88, 0.96) + litAsphalt * 0.16, reflWeight);

        // Delicate anime ripple highlight glints inside puddles (keep mirror reflections clear!)
        float rippleCrest = clamp(length(ripple) * 1.55, 0.0, 1.0) * puddle;
        finalCol += vec3(0.58, 0.80, 1.0) * (rippleCrest * rippleCrest) * 0.19;

        // Subtle organic puddle edge meniscus
        float puddleEdge = smoothstep(0.26, 0.42, puddleRaw) * (1.0 - smoothstep(0.42, 0.60, puddleRaw));
        finalCol += vec3(0.24, 0.40, 0.65) * puddleEdge * 0.08;

        gl_FragColor = vec4(clamp(finalCol, 0.0, 2.0), 1.0);
      }
    `,
  });

  const roadGeo = new THREE.PlaneGeometry(18.0, 18.0, 1, 1);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMesh = new THREE.Mesh(roadGeo, roadShaderMat);
  roadMesh.position.y = 0.0;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // =========================================================================
  // 3. RAISED SIDEWALK & KONBINI FORECOURT (Y = 0.00..0.14)
  // =========================================================================
  const sidewalkTex = createSidewalkTileTexture();
  const sidewalkMat = createToonMaterial({
    map: sidewalkTex,
    color: 0xb9c9e4,
    wetRim: true,
    wetRimColor: 0x7ab4ff,
    wetRimStrength: 0.22,
  });

  // Note on ExtrudeGeometry rotated -PI/2 around X:
  // Local (sx, sy) -> World (sx, depth, -sy). So to place at world (x, z), use sy = -z!
  const swShape = new THREE.Shape();
  // Start back-left of main konbini sidewalk pad: X = -4.4, Z = -8.98 (sy = +8.98)
  swShape.moveTo(-4.4, 8.98);
  swShape.lineTo(5.4, 8.98); // to back-right curb X = +5.4, Z = -8.98
  swShape.lineTo(5.4, -3.0); // along right street curb up to Z = +3.0 (sy = -3.0)
  // Rounded street corner fillet from (5.4, -3.0) to (4.0, -4.4), center (4.0, -3.0), R = 1.4
  swShape.absarc(4.0, -3.0, 1.4, 0, -Math.PI / 2, true);
  swShape.lineTo(-4.4, -4.4); // along front street curb X = +4.0 to -4.4 at Z = +4.4
  swShape.closePath();

  const swGeo = new THREE.ExtrudeGeometry(swShape, {
    depth: 0.125,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  swGeo.rotateX(-Math.PI / 2);
  // Fix UV scaling for extruded top face so sidewalk tiles look uniform
  const posAttr = swGeo.attributes.position;
  const uvAttr = swGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const pz = posAttr.getZ(i);
    uvAttr.setXY(i, (px + 9) / 14, (pz + 9) / 14);
  }
  uvAttr.needsUpdate = true;

  const sidewalkMesh = inkMesh(swGeo, sidewalkMat, {
    thresholdAngle: 32,
    castShadow: false,
    receiveShadow: true,
  });
  group.add(sidewalkMesh);

  // Left neighborhood courtyard raised pad (X in [-8.98, -5.35], Z in [-8.98, +0.65], clear of road y=0)
  const alleyPadGeo = new THREE.BoxGeometry(3.63, 0.136, 9.63);
  const alleyPad = inkMesh(alleyPadGeo, sidewalkMat, { castShadow: false, receiveShadow: true });
  alleyPad.position.set(-7.165, 0.072, -4.165);
  group.add(alleyPad);

  // Narrow outer-left curb border strip beside parking bay (X in [-8.98, -8.58], Z in [0.65, 4.4])
  const leftCurbStrip = inkMesh(
    new THREE.BoxGeometry(0.4, 0.14, 3.72),
    createToonMaterial({ color: 0x606e85, wetRim: true, roughness: 0.85 }),
    { castShadow: false }
  );
  leftCurbStrip.position.set(-8.78, 0.074, 2.53);
  group.add(leftCurbStrip);

  // =========================================================================
  // 4. CONCRETE CURB BLOCKS, DRAINAGE GUTTERS & STORM GRATES ("排水沟")
  //    Offset cleanly outside sidewalk perimeter & above Y=0 / Y=0.140 to prevent Z-fighting!
  // =========================================================================
  const curbStoneMat = createToonMaterial({
    color: 0x76859e,
    wetRim: true,
    wetRimColor: 0x9ac6ff,
    wetRimStrength: 0.25,
    roughness: 0.86,
  });
  const grateFrameMat = createToonMaterial({ color: 0x262f40 });
  const grateBarMat = createToonMaterial({ color: 0x45536b, wetRim: true, wetRimStrength: 0.35 });

  // Segmented concrete curb blocks along front curb (Z = 4.46, X from -4.05 to +3.75)
  for (let x = -4.05; x <= 3.75; x += 0.78) {
    // Lower ramp curb across crosswalk X in [0.3, 2.7]
    const isRamp = x > 0.2 && x < 2.8;
    const h = isRamp ? 0.056 : 0.162;
    const block = inkMesh(new THREE.BoxGeometry(0.72, h, 0.14), curbStoneMat, {
      castShadow: false,
    });
    block.position.set(x, h * 0.5 + 0.004, 4.47);
    group.add(block);
  }

  // Segmented concrete curb blocks along right side street curb (X = 5.47, Z from -8.5 to +2.75)
  for (let z = -8.5; z <= 2.75; z += 0.78) {
    const isRamp = z > 0.1 && z < 2.6;
    const h = isRamp ? 0.056 : 0.162;
    const block = inkMesh(new THREE.BoxGeometry(0.14, h, 0.72), curbStoneMat, {
      castShadow: false,
    });
    block.position.set(5.47, h * 0.5 + 0.004, z);
    group.add(block);
  }

  // Curved corner curb segments around (4.0, 3.0), R = 1.47 (clean 0.30m segments -> zero overlap!)
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * (Math.PI * 0.5);
    const cx = 4.0 + Math.cos(a) * 1.47;
    const cz = 3.0 + Math.sin(a) * 1.47;
    const cBlock = inkMesh(new THREE.BoxGeometry(0.30, 0.162, 0.14), curbStoneMat, {
      castShadow: false,
    });
    cBlock.position.set(cx, 0.085, cz);
    cBlock.rotation.y = Math.PI * 0.5 - a;
    group.add(cBlock);
  }

  // Helper to build detailed slotted storm drain grate ("排水沟格栅")
  function addStormGrate(x: number, z: number, rotY = 0) {
    const g = new THREE.Group();
    const frame = inkMesh(new THREE.BoxGeometry(0.68, 0.022, 0.3), grateFrameMat, {
      edges: true,
      castShadow: false,
    });
    g.add(frame);
    for (let i = -5; i <= 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.24), grateBarMat);
      bar.position.x = i * 0.056;
      g.add(bar);
    }
    g.position.set(x, 0.015, z);
    g.rotation.y = rotY;
    group.add(g);
  }

  addStormGrate(-2.8, 4.72, 0);
  addStormGrate(3.35, 4.72, 0);
  addStormGrate(5.72, 2.95, Math.PI / 2);
  addStormGrate(5.72, -2.4, Math.PI / 2);
  addStormGrate(5.72, -6.8, Math.PI / 2);

  // =========================================================================
  // 5. YELLOW TACTILE BRAILLE PAVING TILES ("点字ブロック", raised cleanly above Y=0.140)
  // =========================================================================
  const brailleTex = createBrailleTileTexture();
  const brailleMat = createToonMaterial({
    map: brailleTex,
    color: 0xf6cf42,
    wetRim: true,
    wetRimStrength: 0.2,
    roughness: 0.72,
  });

  const brailleFront = inkMesh(new THREE.BoxGeometry(2.25, 0.012, 0.36), brailleMat, {
    subtle: true,
    castShadow: false,
  });
  brailleFront.position.set(1.48, 0.148, 4.02);
  group.add(brailleFront);

  const brailleSideTex = createBrailleTileTexture();
  brailleSideTex.repeat.set(1, 6);
  const brailleSide = inkMesh(
    new THREE.BoxGeometry(0.36, 0.012, 2.2),
    createToonMaterial({ map: brailleSideTex, color: 0xf6cf42, wetRim: true, roughness: 0.72 }),
    { subtle: true, castShadow: false }
  );
  brailleSide.position.set(5.02, 0.148, 1.35);
  group.add(brailleSide);

  // =========================================================================
  // 6. PARKING WHEEL STOPPERS ("停车位車止め") & ALLEY STEPPING STONES
  // =========================================================================
  const stopperMat = createToonMaterial({ color: 0x9aa7bd, wetRim: true });
  const reflectorStickerMat = createToonMaterial({
    color: 0xffca28,
    emissive: 0xffaa00,
    emissiveIntensity: 0.45,
  });

  for (const sx of [-7.59, -5.96]) {
    for (const dx of [-0.42, 0.42]) {
      const block = inkMesh(new THREE.BoxGeometry(0.5, 0.1, 0.15), stopperMat);
      block.position.set(sx + dx, 0.05, 1.32);
      const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.01), reflectorStickerMat);
      sticker.position.set(0, 0.01, 0.078);
      block.add(sticker);
      group.add(block);
    }
  }

  // Damp stone flagstones down the narrow side alley (X in [-5.1, -3.8], Z in [-7.8, +0.4])
  const stoneMat = createToonMaterial({ color: 0x455269, wetRim: true, wetRimStrength: 0.28 });
  for (let i = 0; i < 11; i++) {
    const z = 0.2 - i * 0.76;
    const x = -4.52 + ((i % 2) - 0.5) * 0.22;
    const stone = inkMesh(new THREE.BoxGeometry(0.62, 0.032, 0.48), stoneMat, {
      subtle: true,
      castShadow: false,
    });
    stone.position.set(x, 0.016, z);
    stone.rotation.y = ((i * 37) % 10 - 5) * 0.02;
    group.add(stone);
  }

  // =========================================================================
  // 7. REAL-TIME MIRROR CAMERA UPDATE FUNCTION (Oblique Frustum Clip at Y=0)
  // =========================================================================
  function updateReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    hiddenObjects: THREE.Object3D[] = []
  ) {
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    if (cameraWorldPosition.y <= 0.05) return;

    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);

    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.near = camera.near;
    virtualCamera.far = camera.far;
    virtualCamera.fov = camera.fov;
    virtualCamera.aspect = camera.aspect;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

    // Update projective UV matrix
    textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    textureMatrix.multiply(virtualCamera.projectionMatrix);
    textureMatrix.multiply(virtualCamera.matrixWorldInverse);

    // Oblique clip plane at Y = 0.0 so plinth below street never renders in reflection
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clipPlane.set(
      reflectorPlane.normal.x,
      reflectorPlane.normal.y,
      reflectorPlane.normal.z,
      reflectorPlane.constant
    );

    const projMat = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + projMat.elements[8]) / projMat.elements[0];
    q.y = (Math.sign(clipPlane.y) + projMat.elements[9]) / projMat.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projMat.elements[10]) / projMat.elements[14];

    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    projMat.elements[2] = clipPlane.x;
    projMat.elements[6] = clipPlane.y;
    projMat.elements[10] = clipPlane.z + 1.0 - 0.003;
    projMat.elements[14] = clipPlane.w;

    // Hide road mesh, beneath-road plinth, and tiny clutter/particles while capturing reflection
    roadMesh.visible = false;
    upperSlab.visible = false;
    accentTrim.visible = false;
    lowerPlinth.visible = false;
    shadowFoot.visible = false;
    plinthAura.visible = false;
    for (const obj of hiddenObjects) {
      obj.visible = false;
    }

    const prevTarget = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;

    renderer.setRenderTarget(reflectionRT);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear(true, true, false);
    renderer.render(scene, virtualCamera);

    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    renderer.setRenderTarget(prevTarget);

    for (const obj of hiddenObjects) {
      obj.visible = true;
    }
    roadMesh.visible = true;
    upperSlab.visible = true;
    accentTrim.visible = true;
    lowerPlinth.visible = true;
    shadowFoot.visible = true;
    plinthAura.visible = true;
  }

  return {
    group,
    roadMesh,
    roadUniforms,
    updateReflection,
  };
}
