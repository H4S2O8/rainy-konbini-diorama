import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { AnimeToonMaterial, createToonMaterial, inkMesh } from '../materials/toonMaterials';
import {
  createBrushedMetalTexture,
  createExteriorTileTexture,
  createKonbiniSignTexture,
  createQuadAtlasBoxGeometry,
  createRoofDeckTexture,
  createWelcomeMatTexture,
  loadPublicTexture,
} from '../textures/proceduralTextures';

export interface KonbiniBuildingResult {
  group: THREE.Group;
  glassUniforms: {
    uTime: { value: number };
  };
  flickerMaterials: AnimeToonMaterial[];
  setDoorOpenAmount: (open01: number) => void;
  eaveDripPoints: THREE.Vector3[];
}

export function createKonbiniBuilding(): KonbiniBuildingResult {
  const group = new THREE.Group();
  group.name = 'KonbiniBuilding';

  const tileTex = createExteriorTileTexture();
  const extWallMat = createToonMaterial({
    map: tileTex,
    color: 0xf0eadf,
    wetRim: true,
    wetRimColor: 0x8abfff,
    wetRimStrength: 0.16,
    roughness: 0.88,
  });
  const innerWallMat = createToonMaterial({
    color: 0xfff3de,
    emissive: 0xffd9a0,
    emissiveIntensity: 0.18,
    roughness: 0.86,
    interior: true,
  });
  const darkMullionMat = createToonMaterial({
    color: 0x1e2533,
    wetRim: true,
    wetRimStrength: 0.28,
    roughness: 0.34,
  });
  const plinthGraniteMat = createToonMaterial({
    color: 0x394254,
    wetRim: true,
    wetRimStrength: 0.25,
    roughness: 0.62,
  });
  const parapetCapMat = createToonMaterial({
    color: 0xd0d7e3,
    wetRim: true,
    wetRimStrength: 0.3,
    roughness: 0.42,
  });

  // =========================================================================
  // 1. ANIMATED ANIME RAINDROP-ON-GLASS SHADER ("雨水沿玻璃滑落")
  // =========================================================================
  const glassUniforms = {
    uTime: { value: 0 },
  };

  const wetGlassMat = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      // Sliding raindrop bead + trailing wet streak along window pane
      float dropTrailLayer(vec2 uv, float cols, float speed, float seed) {
        vec2 st = vec2(uv.x * cols, uv.y * 2.2);
        float colId = floor(st.x);
        float rnd = hash21(vec2(colId, seed));
        float t = uTime * speed * (0.65 + rnd * 0.7) + rnd * 12.0;

        // Slight organic horizontal wiggle as drop slides down
        float wiggle = sin(uv.y * 16.0 + rnd * 6.28) * 0.14;
        float fx = fract(st.x) - 0.5 + wiggle;

        // Drop head moves downward (y goes 1 -> 0)
        float headY = 1.0 - fract(t * 0.28);
        float dy = uv.y - headY;

        // Glistening drop bead
        float dropDist = length(vec2(fx * 1.1, dy * 6.5));
        float bead = smoothstep(0.18, 0.04, dropDist);

        // Trailing thin water streak above the bead (where it just slid from)
        float inTrail = smoothstep(0.0, 0.03, dy) * smoothstep(0.42, 0.04, dy);
        float trailWidth = smoothstep(0.09, 0.015, abs(fx));
        float trailBeads = smoothstep(0.35, 0.85, fract(uv.y * 26.0 + rnd * 9.0));
        float trail = inTrail * trailWidth * (0.45 + 0.55 * trailBeads);

        return clamp(bead + trail * 0.65, 0.0, 1.0);
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fBase = clamp(1.0 - clamp(abs(dot(vWorldNormal, viewDir)), 0.0, 1.0), 0.0, 1.0);
        float fresnel = fBase * fBase * sqrt(fBase);

        // Two layers of sliding raindrop trails at different scales
        float drops1 = dropTrailLayer(vUv, 14.0, 0.85, 1.7);
        float drops2 = dropTrailLayer(vUv + vec2(0.037, 0.19), 23.0, 0.55, 5.3);
        float drops = clamp(drops1 + drops2 * 0.75, 0.0, 1.0);

        // Classic anime diagonal glass reflection band
        float diag = vUv.x * 0.85 + vUv.y * 0.55;
        float streak1 = smoothstep(0.46, 0.49, diag) * (1.0 - smoothstep(0.54, 0.57, diag));
        float streak2 = smoothstep(0.59, 0.605, diag) * (1.0 - smoothstep(0.625, 0.64, diag));
        float animeSheen = (streak1 * 0.55 + streak2 * 0.35);

        // Subtle condensation mist near bottom sill of glass
        float sillMist = smoothstep(0.18, 0.0, vUv.y) * 0.22;

        // Color combines cool cyan-blue night sky reflection + warm amber indoor refraction in raindrops
        vec3 glassTint = mix(vec3(0.55, 0.80, 1.0), vec3(1.0, 0.90, 0.70), drops * 0.65);
        vec3 col = glassTint + vec3(0.85, 0.94, 1.0) * animeSheen + vec3(1.0, 0.94, 0.80) * drops * 0.55;

        float alpha = 0.075 + fresnel * 0.16 + animeSheen * 0.14 + drops * 0.38 + sillMist;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.62));
      }
    `,
  });

  // =========================================================================
  // 2. FOUNDATION & FLOOR BASE (X in [-3.6, +3.8], Z in [-4.6, +1.8], Chamfer)
  // =========================================================================
  // Shape in XZ: recall ExtrudeGeometry rotated -PI/2 around X uses sy = -z!
  function makeBuildingFootprintShape(inset = 0): THREE.Shape {
    const xMin = -3.6 + inset;
    const xMax = 3.8 - inset;
    const zMin = -4.6 + inset;
    const zMax = 1.8 - inset;
    const ch = 2.0 - inset * 0.4142; // chamfer leg length

    const s = new THREE.Shape();
    s.moveTo(xMin, -zMin); // back-left (-3.6, +4.6) -> world (-3.6, -4.6)
    s.lineTo(xMax, -zMin); // back-right (+3.8, +4.6) -> world (+3.8, -4.6)
    s.lineTo(xMax, -(zMax - ch)); // right chamfer start (+3.8, +0.2) -> world (+3.8, -0.2)
    s.lineTo(xMax - ch, -zMax); // front chamfer end (+1.8, -1.8) -> world (+1.8, +1.8)
    s.lineTo(xMin, -zMax); // front-left (-3.6, -1.8) -> world (-3.6, +1.8)
    s.closePath();
    return s;
  }

  // Base granite curb step (Y = 0.14..0.18)
  const baseGeo = new THREE.ExtrudeGeometry(makeBuildingFootprintShape(-0.03), {
    depth: 0.05,
    bevelEnabled: false,
  });
  baseGeo.rotateX(-Math.PI / 2);
  const baseStep = inkMesh(baseGeo, plinthGraniteMat, { castShadow: false });
  baseStep.position.y = 0.135;
  group.add(baseStep);

  // Upper solid header/roof band (Y = 2.78..4.06)
  const roofBandGeo = new THREE.ExtrudeGeometry(makeBuildingFootprintShape(0), {
    depth: 1.28,
    bevelEnabled: false,
  });
  roofBandGeo.rotateX(-Math.PI / 2);
  const roofBand = inkMesh(roofBandGeo, extWallMat, { thresholdAngle: 25 });
  roofBand.position.y = 2.78;
  group.add(roofBand);

  // Rooftop perimeter parapet walls (Y = 4.06..4.34)
  function addParapetSegment(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    thickness = 0.22,
    height = 0.28
  ) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz); // local Z along segment -> rotate Y

    const seg = new THREE.Group();
    const wall = inkMesh(new THREE.BoxGeometry(thickness, height, len - 0.04), extWallMat, {
      castShadow: false,
    });
    wall.position.y = height * 0.5;
    seg.add(wall);

    const cap = inkMesh(
      new RoundedBoxGeometry(thickness + 0.08, 0.055, len - 0.04, 2, 0.015),
      parapetCapMat,
      { edges: false, hull: true }
    );
    cap.position.y = height + 0.025;
    seg.add(cap);

    seg.position.set((x1 + x2) * 0.5, 4.06, (z1 + z2) * 0.5);
    seg.rotation.y = angle;
    group.add(seg);
  }

  addParapetSegment(-3.49, -4.49, 3.69, -4.49); // back
  addParapetSegment(3.69, -4.49, 3.69, -0.22); // right
  addParapetSegment(3.69, -0.22, 1.78, 1.69); // chamfer
  addParapetSegment(1.78, 1.69, -3.49, 1.69); // front
  addParapetSegment(-3.49, 1.69, -3.49, -4.49); // left

  // Neat corner cap finials cleanly covering parapet corner joints without coplanar Z-fighting
  for (const [cx, cz] of [
    [-3.49, -4.49],
    [3.69, -4.49],
    [3.69, -0.22],
    [1.78, 1.69],
    [-3.49, 1.69],
  ]) {
    const cornerCap = inkMesh(new RoundedBoxGeometry(0.32, 0.345, 0.32, 2, 0.02), parapetCapMat, {
      edges: false,
      hull: true,
    });
    cornerCap.position.set(cx, 4.235, cz);
    group.add(cornerCap);
  }

  // =========================================================================
  // 3. WALLS, MULLIONS & LARGE PANORAMIC GLASS WINDOWS
  // =========================================================================
  // 3A. Solid Back Wall (Z = -4.6, X in [-3.6, +3.8], Y = 0.16..2.78)
  const backWallExt = inkMesh(new THREE.BoxGeometry(7.4, 2.64, 0.18), extWallMat);
  backWallExt.position.set(0.1, 1.48, -4.51);
  group.add(backWallExt);

  const backWallInt = new THREE.Mesh(new THREE.BoxGeometry(7.05, 2.64, 0.04), innerWallMat);
  backWallInt.position.set(0.1, 1.48, -4.4);
  group.add(backWallInt);

  // 3B. Solid Left Alley Wall (X = -3.6, Z in [-4.6, +1.8], Y = 0.16..2.78)
  const leftWallExt = inkMesh(new THREE.BoxGeometry(0.18, 2.64, 6.4), extWallMat);
  leftWallExt.position.set(-3.51, 1.48, -1.4);
  group.add(leftWallExt);

  const leftWallInt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.64, 6.1), innerWallMat);
  leftWallInt.position.set(-3.4, 1.48, -1.4);
  group.add(leftWallInt);

  // Rear-right solid wall section behind beverage cooler (X = +3.8, Z in [-4.6, -3.52])
  const rightRearPier = inkMesh(new THREE.BoxGeometry(0.2, 2.64, 1.12), extWallMat);
  rightRearPier.position.set(3.7, 1.48, -4.04);
  group.add(rightRearPier);

  const rightRearInt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.64, 1.12), innerWallMat);
  rightRearInt.position.set(3.58, 1.48, -4.04);
  group.add(rightRearInt);

  // Front-left corner structural pier (X in [-3.6, -3.22], Z = +1.7)
  const frontLeftPier = inkMesh(new THREE.BoxGeometry(0.38, 2.64, 0.22), extWallMat);
  frontLeftPier.position.set(-3.41, 1.48, 1.69);
  group.add(frontLeftPier);

  // Chamfer flanking corner columns at (1.72, 1.72) and (3.72, -0.28)
  const chamferColLeft = inkMesh(new THREE.BoxGeometry(0.28, 2.64, 0.28), extWallMat);
  chamferColLeft.position.set(1.68, 1.48, 1.68);
  group.add(chamferColLeft);

  const chamferColRight = inkMesh(new THREE.BoxGeometry(0.28, 2.64, 0.28), extWallMat);
  chamferColRight.position.set(3.68, 1.48, -0.32);
  group.add(chamferColRight);

  // 3C. FRONT PANORAMIC GLASS WINDOW (X in [-3.22, +1.54], Z = +1.72, width = 4.76m!)
  const frontWinWidth = 4.76;
  const frontWinCenterX = (-3.22 + 1.54) * 0.5; // -0.84
  // Low knee wall under front window (Y = 0.16..0.52)
  const frontKneeWall = inkMesh(
    new THREE.BoxGeometry(frontWinWidth, 0.36, 0.2),
    extWallMat
  );
  frontKneeWall.position.set(frontWinCenterX, 0.34, 1.7);
  group.add(frontKneeWall);

  const frontSillCap = inkMesh(
    new THREE.BoxGeometry(frontWinWidth + 0.04, 0.04, 0.25),
    darkMullionMat
  );
  frontSillCap.position.set(frontWinCenterX, 0.53, 1.71);
  group.add(frontSillCap);

  // Top & horizontal transom mullions on front window
  const frontTopMullion = inkMesh(
    new THREE.BoxGeometry(frontWinWidth, 0.065, 0.12),
    darkMullionMat
  );
  frontTopMullion.position.set(frontWinCenterX, 2.75, 1.72);
  group.add(frontTopMullion);

  const frontTransom = inkMesh(
    new THREE.BoxGeometry(frontWinWidth, 0.05, 0.1),
    darkMullionMat
  );
  frontTransom.position.set(frontWinCenterX, 2.34, 1.72);
  group.add(frontTransom);

  // 3-bay vertical mullions across front window
  for (const mx of [-3.2, -1.62, -0.04, 1.53]) {
    const vBar = inkMesh(new THREE.BoxGeometry(0.055, 2.24, 0.11), darkMullionMat);
    vBar.position.set(mx, 1.65, 1.72);
    group.add(vBar);
  }

  // Front glass pane with animated sliding raindrops
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(frontWinWidth - 0.06, 2.2), wetGlassMat);
  frontGlass.position.set(frontWinCenterX, 1.64, 1.73);
  frontGlass.renderOrder = 3;
  group.add(frontGlass);

  // 3D. RIGHT SIDE LARGE GLASS WINDOW (X = +3.72, Z in [-3.48, -0.46], width = 3.02m!)
  const sideWinWidth = 3.02;
  const sideWinCenterZ = (-3.48 - 0.46) * 0.5; // -1.97
  const sideKneeWall = inkMesh(new THREE.BoxGeometry(0.2, 0.36, sideWinWidth), extWallMat);
  sideKneeWall.position.set(3.7, 0.34, sideWinCenterZ);
  group.add(sideKneeWall);

  const sideSillCap = inkMesh(
    new THREE.BoxGeometry(0.25, 0.04, sideWinWidth + 0.04),
    darkMullionMat
  );
  sideSillCap.position.set(3.71, 0.53, sideWinCenterZ);
  group.add(sideSillCap);

  const sideTopMullion = inkMesh(
    new THREE.BoxGeometry(0.12, 0.065, sideWinWidth),
    darkMullionMat
  );
  sideTopMullion.position.set(3.72, 2.75, sideWinCenterZ);
  group.add(sideTopMullion);

  const sideTransom = inkMesh(new THREE.BoxGeometry(0.1, 0.05, sideWinWidth), darkMullionMat);
  sideTransom.position.set(3.72, 2.34, sideWinCenterZ);
  group.add(sideTransom);

  for (const mz of [-3.47, -1.97, -0.47]) {
    const vBar = inkMesh(new THREE.BoxGeometry(0.11, 2.24, 0.055), darkMullionMat);
    vBar.position.set(3.72, 1.65, mz);
    group.add(vBar);
  }

  const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(sideWinWidth - 0.06, 2.2), wetGlassMat);
  sideGlass.rotation.y = Math.PI / 2;
  sideGlass.position.set(3.73, 1.64, sideWinCenterZ);
  sideGlass.renderOrder = 3;
  group.add(sideGlass);

  // =========================================================================
  // 4. 45° CHAMFERED CORNER AUTOMATIC DOORS ("自动门偶尔开合" + "门口地垫")
  // =========================================================================
  const entranceGroup = new THREE.Group();
  entranceGroup.position.set(2.74, 0.16, 0.74);
  entranceGroup.rotation.y = Math.PI / 4; // Local +Z faces straight out toward street corner!
  group.add(entranceGroup);

  // Header motor track & sensor pod
  const trackHeader = inkMesh(new RoundedBoxGeometry(2.68, 0.16, 0.16, 2, 0.018), darkMullionMat, {
    edges: false,
    hull: true,
  });
  trackHeader.position.set(0, 2.48, 0);
  entranceGroup.add(trackHeader);

  const sensorPod = inkMesh(
    new RoundedBoxGeometry(0.32, 0.06, 0.08, 2, 0.015),
    createToonMaterial({ color: 0x111520, emissive: 0x22d890, emissiveIntensity: 0.35 }),
    { edges: false, subtle: true }
  );
  sensorPod.position.set(0, 2.51, 0.1);
  entranceGroup.add(sensorPod);

  // Transom glass above automatic door
  const doorTransomGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.22), wetGlassMat);
  doorTransomGlass.position.set(0, 2.66, 0.02);
  doorTransomGlass.renderOrder = 3;
  entranceGroup.add(doorTransomGlass);

  // Fixed outer glass sidelights (left: -1.01, right: +1.01)
  for (const sx of [-1.01, 1.01]) {
    const frameL = inkMesh(new THREE.BoxGeometry(0.05, 2.42, 0.08), darkMullionMat);
    frameL.position.set(sx - 0.31, 1.21, 0);
    entranceGroup.add(frameL);

    const frameR = inkMesh(new THREE.BoxGeometry(0.05, 2.42, 0.08), darkMullionMat);
    frameR.position.set(sx + 0.31, 1.21, 0);
    entranceGroup.add(frameR);

    const sidePane = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 2.38), wetGlassMat);
    sidePane.position.set(sx, 1.21, 0);
    sidePane.renderOrder = 3;
    entranceGroup.add(sidePane);
  }

  // Animated Double Sliding Automatic Door Leaves
  function createSlidingLeaf(): THREE.Group {
    const leaf = new THREE.Group();
    const stiles = [
      { x: -0.33, y: 1.19, w: 0.045, h: 2.38 },
      { x: 0.33, y: 1.19, w: 0.045, h: 2.38 },
      { x: 0, y: 2.36, w: 0.66, h: 0.05 },
      { x: 0, y: 0.05, w: 0.66, h: 0.1 },
    ];
    for (const s of stiles) {
      const m = inkMesh(new THREE.BoxGeometry(s.w, s.h, 0.045), darkMullionMat);
      m.position.set(s.x, s.y, 0);
      leaf.add(m);
    }

    // Safety horizontal decal strip ("自動ドア")
    const safetyStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.055, 0.05),
      createToonMaterial({
        color: 0x1e8ce0,
        emissive: 0x1e8ce0,
        emissiveIntensity: 0.45,
      })
    );
    safetyStrip.position.set(0, 1.12, 0);
    leaf.add(safetyStrip);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.24), wetGlassMat);
    glass.position.set(0, 1.2, 0);
    glass.renderOrder = 3;
    leaf.add(glass);

    return leaf;
  }

  const leftDoorLeaf = createSlidingLeaf();
  const rightDoorLeaf = createSlidingLeaf();
  leftDoorLeaf.position.set(-0.355, 0, 0.045);
  rightDoorLeaf.position.set(0.355, 0, 0.045);
  entranceGroup.add(leftDoorLeaf, rightDoorLeaf);

  function setDoorOpenAmount(open01: number) {
    const slide = THREE.MathUtils.clamp(open01, 0, 1) * 0.63;
    leftDoorLeaf.position.x = -0.355 - slide;
    rightDoorLeaf.position.x = 0.355 + slide;
  }

  // Entrance Floor Mats ("门口地垫" — exterior & interior threshold)
  const matTex = createWelcomeMatTexture();
  const welcomeMatMat = createToonMaterial({
    map: matTex,
    color: 0xd0d8e8,
    wetRim: true,
    wetRimStrength: 0.15,
  });
  const outerMat = inkMesh(new THREE.BoxGeometry(1.48, 0.018, 0.82), welcomeMatMat, {
    subtle: true,
    castShadow: false,
  });
  outerMat.position.set(0, -0.008, 0.56);
  entranceGroup.add(outerMat);

  const innerMat = inkMesh(
    new THREE.BoxGeometry(1.38, 0.014, 0.72),
    createToonMaterial({ map: matTex, color: 0xffffff, interior: true }),
    { subtle: true, interior: true, castShadow: false }
  );
  innerMat.position.set(0, 0.008, -0.48);
  entranceGroup.add(innerMat);

  // Window Promotional Posters ("宣传海报" generated in 2x2 anime poster grid)
  const postersTex = loadPublicTexture('/textures/konbini_posters_grid.jpg');
  const posterMat = createToonMaterial({
    map: postersTex,
    color: 0xffffff,
    emissive: 0xffe4b8,
    emissiveMap: postersTex,
    emissiveIntensity: 0.48,
  });
  const posterPositions = [
    { x: -2.42, y: 1.55, z: 1.66, ry: 0, quad: 0 },
    { x: 0.75, y: 1.55, z: 1.66, ry: 0, quad: 1 },
    { x: 3.66, y: 1.55, z: -2.72, ry: Math.PI / 2, quad: 2 },
  ];
  for (const pp of posterPositions) {
    const posterMesh = inkMesh(
      createQuadAtlasBoxGeometry(pp.quad, 0.56, 0.82, 0.018, 0.044, 0.036, 0.006),
      posterMat,
      { subtle: true, castShadow: false }
    );
    posterMesh.position.set(pp.x, pp.y, pp.z);
    posterMesh.rotation.y = pp.ry;
    group.add(posterMesh);
  }

  // Subtle glowing neon window accent frames hanging just inside upper glass transoms
  function addWindowNeonBar(x: number, y: number, z: number, ry: number, colHex: number) {
    const neonGroup = new THREE.Group();
    neonGroup.position.set(x, y, z);
    neonGroup.rotation.y = ry;
    const neonMat = createToonMaterial({
      color: colHex,
      emissive: colHex,
      emissiveIntensity: 1.45,
      interior: true,
    });
    const borderTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.024, 0.024), neonMat);
    borderTop.position.y = 0.11;
    const borderBot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.024, 0.024), neonMat);
    borderBot.position.y = -0.11;
    const borderL = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.024), neonMat);
    borderL.position.x = -0.33;
    const borderR = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.024), neonMat);
    borderR.position.x = 0.33;
    const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.018), neonMat);
    neonGroup.add(borderTop, borderBot, borderL, borderR, centerBar);
    group.add(neonGroup);
  }
  addWindowNeonBar(-0.83, 2.53, 1.62, 0, 0xff8a4c); // Warm coral-amber neon frame in front transom
  addWindowNeonBar(3.62, 2.53, -1.22, Math.PI / 2, 0x4ad8ff); // Cool cyan neon frame in side transom

  // =========================================================================
  // 5. LUMINOUS MULTI-STRIPE KONBINI FASCIA SIGNBOARD ("便利店招牌", 1:1 unstretched ratios!)
  // =========================================================================
  const signMainTex = createKonbiniSignTexture(true, false, 1406);
  const signCompactTex = createKonbiniSignTexture(true, true, 744);
  const signStripesOnlyTex = createKonbiniSignTexture(false, true, 1140);

  const signMainMat = createToonMaterial({
    map: signMainTex,
    emissive: 0xfff5e0,
    emissiveMap: signMainTex,
    emissiveIntensity: 0.42,
  });
  const signCornerMat = createToonMaterial({
    map: signCompactTex,
    emissive: 0xfff5e0,
    emissiveMap: signCompactTex,
    emissiveIntensity: 0.42,
  });
  const signSideMat = createToonMaterial({
    map: signStripesOnlyTex,
    emissive: 0xfff5e0,
    emissiveMap: signStripesOnlyTex,
    emissiveIntensity: 0.38,
  });
  const flickerMaterials: AnimeToonMaterial[] = [signSideMat];

  // Helper to place signboard box with dark frame border
  function addSignSegment(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    faceMat: AnimeToonMaterial
  ) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    // Outward normal for clockwise/CCW path from left->front->chamfer->right:
    // If going from (-3.68, 1.92) to (1.84, 1.92): dx > 0, dz = 0 -> outward is +Z (rotY = 0)
    const rotY = Math.atan2(-dz, dx);

    const seg = new THREE.Group();
    const housing = inkMesh(new RoundedBoxGeometry(len, 0.84, 0.18, 2, 0.022), darkMullionMat, {
      edges: false,
      hull: true,
    });
    seg.add(housing);

    const face = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, 0.78), faceMat);
    face.position.z = 0.104;
    seg.add(face);

    seg.position.set((x1 + x2) * 0.5, 3.42, (z1 + z2) * 0.5);
    seg.rotation.y = rotY;
    group.add(seg);
  }

  // Front fascia: (-3.68, 1.92) -> (1.84, 1.92)
  addSignSegment(-3.68, 1.92, 1.84, 1.92, signMainMat);
  // 45° Chamfer fascia: (1.84, 1.92) -> (3.92, -0.16)
  addSignSegment(1.84, 1.92, 3.92, -0.16, signCornerMat);
  // Right side fascia: (3.92, -0.16) -> (3.92, -4.65)
  addSignSegment(3.92, -0.16, 3.92, -4.65, signSideMat);

  // =========================================================================
  // 6. PROJECTING EAVE AWNING / RAIN CANOPY ("屋檐雨棚") + DRIP POINTS
  // =========================================================================
  const canopyFrameMat = createToonMaterial({
    color: 0x263145,
    wetRim: true,
    wetRimStrength: 0.35,
  });
  const canopyGlassMat = createToonMaterial({
    color: 0x8fc0eb,
    emissive: 0x5288ba,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.78,
    wetRim: true,
  });
  const soffitLightMat = createToonMaterial({
    color: 0xfff5dc,
    emissive: 0xffdf9e,
    emissiveIntensity: 0.82,
  });

  const eaveDripPoints: THREE.Vector3[] = [];

  function addCanopySection(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    outwardDepth = 0.92
  ) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const rotY = Math.atan2(-dz, dx);

    const cg = new THREE.Group();
    // Slightly sloped canopy roof (tilts down 5 degrees outward so rainwater drips off lip!)
    const slopeGroup = new THREE.Group();
    slopeGroup.rotation.x = 0.085;

    const frame = inkMesh(new THREE.BoxGeometry(len, 0.065, outwardDepth), canopyFrameMat);
    frame.position.z = outwardDepth * 0.5;
    slopeGroup.add(frame);

    const roofPane = new THREE.Mesh(
      new THREE.BoxGeometry(len - 0.08, 0.075, outwardDepth - 0.08),
      canopyGlassMat
    );
    roofPane.position.z = outwardDepth * 0.5;
    slopeGroup.add(roofPane);

    // Warm recessed soffit strip underneath canopy
    const soffit = new THREE.Mesh(
      new THREE.BoxGeometry(len - 0.35, 0.025, 0.14),
      soffitLightMat
    );
    soffit.position.set(0, -0.038, outwardDepth * 0.42);
    slopeGroup.add(soffit);

    // Support tie rods anchored cleanly on the frieze BELOW the fascia sign (Y <= 2.97m, 0% signboard pierce!)
    const rodCount = Math.max(2, Math.round(len / 1.8));
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < rodCount; i++) {
      const rx = -len * 0.4 + (i / Math.max(1, rodCount - 1)) * (len * 0.8);
      const pCanopyLug = new THREE.Vector3(rx, 0.022, outwardDepth * 0.56);
      const pWallLug = new THREE.Vector3(rx, 0.108, 0.03);
      const span = new THREE.Vector3().subVectors(pWallLug, pCanopyLug);
      const spanLen = span.length();

      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, spanLen, 12), canopyFrameMat);
      rod.position.copy(pCanopyLug).add(pWallLug).multiplyScalar(0.5);
      rod.quaternion.setFromUnitVectors(yAxis, span.clone().normalize());
      cg.add(rod);

      const clevis = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.036, 12), canopyFrameMat);
      clevis.position.copy(pCanopyLug);
      cg.add(clevis);

      const wallPlate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.024), canopyFrameMat);
      wallPlate.position.copy(pWallLug);
      cg.add(wallPlate);
    }

    cg.add(slopeGroup);
    cg.position.set((x1 + x2) * 0.5, 2.86, (z1 + z2) * 0.5);
    cg.rotation.y = rotY;
    group.add(cg);

    // Compute world-space drip points along outer lip of this eave section!
    const samples = Math.max(3, Math.floor(len * 1.6));
    const nx = Math.sin(rotY);
    const nz = Math.cos(rotY);
    const tx = Math.cos(rotY);
    const tz = -Math.sin(rotY);
    const cx = (x1 + x2) * 0.5;
    const cz = (z1 + z2) * 0.5;

    for (let i = 0; i < samples; i++) {
      const along = ((i + 0.5) / samples - 0.5) * (len - 0.2);
      const wx = cx + tx * along + nx * outwardDepth;
      const wz = cz + tz * along + nz * outwardDepth;
      const wy = 2.86 - Math.sin(0.085) * outwardDepth - 0.03;
      eaveDripPoints.push(new THREE.Vector3(wx, wy, wz));
    }
  }

  addCanopySection(-3.55, 1.82, 1.78, 1.82, 0.88);
  addCanopySection(1.78, 1.82, 3.82, -0.22, 1.05);
  addCanopySection(3.82, -0.22, 3.82, -3.65, 0.82);

  // =========================================================================
  // 7. ROOFTOP ARCHITECTURAL DETAILS & REAR STAFF DOOR
  // =========================================================================
  const roofDeckTex = createRoofDeckTexture();
  const roofDeckMat = createToonMaterial({
    map: roofDeckTex,
    color: 0xb6c5de,
    wetRim: true,
    wetRimColor: 0x8ac2ff,
    wetRimStrength: 0.34,
  });
  const roofDeckGeo = new THREE.ExtrudeGeometry(makeBuildingFootprintShape(0.2), {
    depth: 0.04,
    bevelEnabled: false,
  });
  roofDeckGeo.rotateX(-Math.PI / 2);
  const rdPos = roofDeckGeo.attributes.position;
  const rdUv = roofDeckGeo.attributes.uv;
  for (let i = 0; i < rdPos.count; i++) {
    rdUv.setXY(i, (rdPos.getX(i) + 4) / 8, (rdPos.getZ(i) + 5) / 7);
  }
  rdUv.needsUpdate = true;
  const roofDeck = inkMesh(roofDeckGeo, roofDeckMat, { subtle: true, castShadow: false });
  roofDeck.position.y = 4.05;
  group.add(roofDeck);

  // Rooftop commercial HVAC unit & galvanized ductwork (brushed metal panel seams!)
  const brushedMetalTex = createBrushedMetalTexture();
  const hvacMat = createToonMaterial({ map: brushedMetalTex, color: 0xbfc8d6, wetRim: true, roughness: 0.52 });
  const ductMat = createToonMaterial({ map: brushedMetalTex, color: 0x8e9bb0, wetRim: true, roughness: 0.45 });

  const hvacBox = inkMesh(new RoundedBoxGeometry(1.55, 0.72, 1.15, 2, 0.03), hvacMat, {
    edges: false,
    hull: true,
  });
  hvacBox.position.set(-1.6, 4.45, -2.5);
  group.add(hvacBox);

  for (const fx of [-2.0, -1.2]) {
    const fanShroud = inkMesh(new THREE.CylinderGeometry(0.28, 0.3, 0.1, 24), darkMullionMat, {
      edges: false,
      hull: true,
    });
    fanShroud.position.set(fx, 4.86, -2.5);
    group.add(fanShroud);

    const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), ductMat);
    fanHub.position.set(fx, 4.88, -2.5);
    group.add(fanHub);

    for (const rotY of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.014, 0.014), ductMat);
      bar.position.set(fx, 4.915, -2.5);
      bar.rotation.y = rotY;
      group.add(bar);
    }
  }

  // L-shaped roof duct + rooftop access hatch + antenna mast + galvanized rainwater downspout
  const duct1 = inkMesh(new RoundedBoxGeometry(1.6, 0.32, 0.36, 2, 0.02), ductMat, {
    edges: false,
    hull: true,
  });
  duct1.position.set(-0.1, 4.35, -2.5);
  group.add(duct1);
  const duct2 = inkMesh(new RoundedBoxGeometry(0.36, 0.32, 1.2, 2, 0.02), ductMat, {
    edges: false,
    hull: true,
  });
  duct2.position.set(0.52, 4.35, -3.1);
  group.add(duct2);

  const hatch = inkMesh(
    new RoundedBoxGeometry(0.95, 0.28, 0.95, 2, 0.025),
    createToonMaterial({ color: 0x6f7e94, wetRim: true }),
    { edges: false, hull: true }
  );
  hatch.position.set(1.9, 4.23, -2.9);
  group.add(hatch);

  const downspout = inkMesh(new THREE.CylinderGeometry(0.036, 0.036, 3.85, 14), ductMat, {
    edges: false,
    hull: true,
  });
  downspout.position.set(-3.62, 2.1, -4.45);
  group.add(downspout);
  for (const sy of [0.8, 1.85, 2.95, 3.7]) {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.035, 14), darkMullionMat);
    strap.position.set(-3.62, sy, -4.45);
    group.add(strap);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.65, 14), ductMat);
  mast.position.set(-2.9, 4.88, -3.8);
  group.add(mast);
  for (let i = 0; i < 3; i++) {
    const crossBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.65 - i * 0.12, 6),
      ductMat
    );
    crossBar.rotation.z = Math.PI / 2;
    crossBar.position.set(-2.9, 5.25 + i * 0.2, -3.8);
    group.add(crossBar);
  }

  // Rear service door on back wall (Z = -4.62, X = -1.8)
  const rearDoor = inkMesh(
    new THREE.BoxGeometry(0.92, 2.05, 0.06),
    createToonMaterial({ color: 0x7b8799, wetRim: true })
  );
  rearDoor.position.set(-1.8, 1.18, -4.61);
  group.add(rearDoor);

  const rearHoodLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    createToonMaterial({ color: 0xffe4a8, emissive: 0xffb84d, emissiveIntensity: 1.2 })
  );
  rearHoodLight.position.set(-1.8, 2.38, -4.68);
  group.add(rearHoodLight);

  return {
    group,
    glassUniforms,
    flickerMaterials,
    setDoorOpenAmount,
    eaveDripPoints,
  };
}
