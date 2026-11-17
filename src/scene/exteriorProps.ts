import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { AnimeToonMaterial, createToonMaterial, inkMesh } from '../materials/toonMaterials';
import {
  createAddressPlateTexture,
  createBeverageLabelPrintTexture,
  createBrushedMetalTexture,
  createConcreteBlockTexture,
  createCrosswalkSignTexture,
  createKawaraRoofTexture,
  createNoboriFlagTextures,
  createPedestrianLedTextures,
  createPoleHazardCollarTexture,
  createPylonSignTexture,
  createSignalMetalTexture,
  createStopSignTexture,
  createTrafficLedLensTextures,
  createTrashBinFrontTexture,
  createVendingMarqueeTexture,
  createVendingShowcaseBackdropTexture,
  createVendingSideDecalTexture,
  loadPublicTexture,
} from '../textures/proceduralTextures';

export interface TrafficSignalHandle {
  greenLens: AnimeToonMaterial;
  amberLens: AnimeToonMaterial;
  redLens: AnimeToonMaterial;
  pedRedMat: AnimeToonMaterial;
  pedGreenMat: AnimeToonMaterial;
}

export interface ExteriorPropsResult {
  group: THREE.Group;
  acFanMeshes: THREE.Object3D[];
  trafficSignal: TrafficSignalHandle;
  extraFlickerMaterials: AnimeToonMaterial[];
  extraDripPoints: THREE.Vector3[];
  noboriUniforms: { uTime: { value: number } };
  updateMirrorReflection: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void;
}

export function createExteriorProps(): ExteriorPropsResult {
  const group = new THREE.Group();
  group.name = 'ExteriorProps';

  const acFanMeshes: THREE.Object3D[] = [];
  const extraFlickerMaterials: AnimeToonMaterial[] = [];
  const extraDripPoints: THREE.Vector3[] = [];

  const Y_SW = 0.14; // Sidewalk height

  const darkSteelMat = createToonMaterial({ color: 0x263042, wetRim: true, wetRimStrength: 0.3 });
  const galvSteelMat = createToonMaterial({ color: 0x9aa6b8, wetRim: true, wetRimStrength: 0.32 });
  const chromeMat = createToonMaterial({ color: 0xd9e2ef, wetRim: true, wetRimStrength: 0.4 });
  const whiteEnamelMat = createToonMaterial({ color: 0xeef3fa, wetRim: true, wetRimStrength: 0.28 });

  // =========================================================================
  // 1. DETAILED JAPANESE DRINK VENDING MACHINES ("自动贩卖机")
  //    #1 at Front-Left Pier (-4.0, Y_SW, +1.48) facing +Z
  //    #2 at Right-Rear Solid Pier (+4.15, Y_SW, -4.06) facing +X
  // =========================================================================
  const showcaseTex = createVendingShowcaseBackdropTexture();
  const vmShowcaseGlassMat = createToonMaterial({
    color: 0xdcf0ff,
    emissive: 0x70a8d8,
    emissiveIntensity: 0.14,
    transparent: true,
    opacity: 0.24,
    wetRim: true,
    wetRimStrength: 0.45,
  });

  function createVendingMachine(
    bodyHex: number,
    accentHex: number,
    variant: 'red' | 'blue',
    flicker = false
  ): THREE.Group {
    const vm = new THREE.Group();
    const bodyMat = createToonMaterial({ color: bodyHex, wetRim: true, wetRimStrength: 0.28 });
    const accentMat = createToonMaterial({ color: accentHex, wetRim: true, wetRimStrength: 0.3 });

    // 1A. 4 Dark Steel Leveling Feet raising cabinet slightly above wet sidewalk
    for (const fx of [-0.34, 0.34]) {
      for (const fz of [-0.22, 0.22]) {
        const foot = inkMesh(new THREE.CylinderGeometry(0.036, 0.046, 0.055, 16), darkSteelMat);
        foot.position.set(fx, 0.028, fz);
        vm.add(foot);
      }
    }

    // 1B. Beveled Main Insulated Cabinet + Chamfered Top Rain Cap + Side Graphic Panels
    const cabinet = inkMesh(new RoundedBoxGeometry(0.86, 1.84, 0.62, 2, 0.028), bodyMat, {
      edges: false,
      hull: true,
    });
    cabinet.position.y = 0.97;
    vm.add(cabinet);

    // Side decal panels (+X and -X)
    const sideDecalTex = createVendingSideDecalTexture(variant);
    const sideDecalMat = createToonMaterial({
      map: sideDecalTex,
      color: 0xffffff,
      wetRim: true,
      wetRimStrength: 0.24,
    });
    for (const sx of [-0.433, 0.433]) {
      const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.72), sideDecalMat);
      sidePanel.position.set(sx, 0.97, 0);
      sidePanel.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      vm.add(sidePanel);
    }

    // Illuminated Top Marquee Header ("つめた〜い・あったか〜い" / "DRINK & CAFE")
    const marqueeTex = createVendingMarqueeTexture(variant);
    const marqueeMat = createToonMaterial({
      map: marqueeTex,
      emissive: 0xfff5e8,
      emissiveMap: marqueeTex,
      emissiveIntensity: 0.56,
    });
    const topCap = inkMesh(new RoundedBoxGeometry(0.88, 0.22, 0.65, 2, 0.024), accentMat, {
      edges: false,
      hull: true,
    });
    topCap.position.y = 1.82;
    vm.add(topCap);

    const marqueeFace = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.16), marqueeMat);
    marqueeFace.position.set(0, 1.82, 0.328);
    vm.add(marqueeFace);

    // Subtle stainless protective rain brow above showcase window
    const rainVisor = inkMesh(new RoundedBoxGeometry(0.82, 0.028, 0.1, 2, 0.008), chromeMat, {
      edges: false,
      subtle: true,
    });
    rainVisor.position.set(0, 1.69, 0.34);
    rainVisor.rotation.x = 0.15;
    vm.add(rainVisor);

    // 1C. Recessed Showcase Frame & Backlit Shelf Backdrop
    const displayBackMat = createToonMaterial({
      map: showcaseTex,
      color: 0xffffff,
      emissive: 0xd8eeff,
      emissiveMap: showcaseTex,
      emissiveIntensity: 0.54,
    });
    if (flicker) extraFlickerMaterials.push(displayBackMat);

    // Frame trim surrounding display (top, bottom, left, right)
    const frameBars = [
      { x: 0, y: 1.66, w: 0.78, h: 0.045 },
      { x: 0, y: 0.80, w: 0.78, h: 0.045 },
      { x: -0.37, y: 1.23, w: 0.045, h: 0.90 },
      { x: 0.37, y: 1.23, w: 0.045, h: 0.90 },
    ];
    for (const fb of frameBars) {
      const bar = inkMesh(new THREE.BoxGeometry(fb.w, fb.h, 0.055), chromeMat, { subtle: true });
      bar.position.set(fb.x, fb.y, 0.328);
      vm.add(bar);
    }

    const displayBack = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.84), displayBackMat);
    displayBack.position.set(0, 1.23, 0.314);
    vm.add(displayBack);

    // 1D. 3D Contoured PET Bottles + Coffee/Soda Cans + Illuminated Selection Buttons
    const canColors = [
      0xe53935, 0x1e88e5, 0x43a047, 0xffb300, 0x8d6e63, 0x26c6da, 0xf4511e, 0xab47bc, 0xfff8e1,
    ];
    const drinkGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, -0.06),
        new THREE.Vector2(0.024, -0.058),
        new THREE.Vector2(0.026, 0.015),
        new THREE.Vector2(0.022, 0.032),
        new THREE.Vector2(0.014, 0.052),
        new THREE.Vector2(0.014, 0.062),
        new THREE.Vector2(0.0, 0.062),
      ],
      18
    );
    const capGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.024, 16);
    const btnGeo = new THREE.BoxGeometry(0.046, 0.018, 0.018);

    const drinkMat = createToonMaterial({
      map: createBeverageLabelPrintTexture(),
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.25,
      wetRim: true,
      wetRimStrength: 0.35,
      roughness: 0.22,
    });
    const capMat = createToonMaterial({ color: 0xffffff, emissive: 0x222222, emissiveIntensity: 0.18 });
    const btnMat = createToonMaterial({
      color: 0xffffff,
      emissive: 0x99d6ff,
      emissiveIntensity: 0.65,
    });

    const drinksInst = new THREE.InstancedMesh(drinkGeo, drinkMat, 21);
    const capsInst = new THREE.InstancedMesh(capGeo, capMat, 14); // Top 2 rows have PET bottles!
    const btnsInst = new THREE.InstancedMesh(btnGeo, btnMat, 21);

    const dDummy = new THREE.Object3D();
    const dCol = new THREE.Color();
    let dIdx = 0;
    let capIdx = 0;

    for (let r = 0; r < 3; r++) {
      // Match backdrop shelf heights (row 0 = top, row 1 = mid, row 2 = bottom hot cans)
      const ry = 1.48 - r * 0.27;
      for (let c = 0; c < 7; c++) {
        const dx = -0.27 + c * 0.09;
        const isBottle = r < 2 && (c + r) % 2 === 0;
        const colHex = canColors[(r * 5 + c * 2) % canColors.length];

        // Drink body
        dDummy.position.set(dx, ry + (isBottle ? 0.01 : -0.01), 0.332);
        dDummy.scale.set(1, isBottle ? 1.15 : 0.78, 0.55);
        dDummy.updateMatrix();
        drinksInst.setMatrixAt(dIdx, dDummy.matrix);
        dCol.setHex(colHex);
        drinksInst.setColorAt(dIdx, dCol);

        // Selection push button right beneath each drink on the HOT/COLD strip
        dDummy.position.set(dx, ry - 0.088, 0.336);
        dDummy.scale.set(1, 1, 1);
        dDummy.updateMatrix();
        btnsInst.setMatrixAt(dIdx, dDummy.matrix);
        dCol.setHex(r === 2 ? 0xffa670 : 0x8be0ff);
        btnsInst.setColorAt(dIdx, dCol);
        dIdx++;

        // PET bottle neck + screw cap on upper two rows
        if (r < 2) {
          if (isBottle) {
            dDummy.position.set(dx, ry + 0.092, 0.332);
            dDummy.scale.set(1, 1, 0.55);
          } else {
            // Hide cap for short aluminum cans
            dDummy.position.set(dx, ry, 0.31);
            dDummy.scale.set(0.001, 0.001, 0.001);
          }
          dDummy.updateMatrix();
          capsInst.setMatrixAt(capIdx, dDummy.matrix);
          dCol.setHex(c % 3 === 0 ? 0xef5350 : 0xffffff);
          capsInst.setColorAt(capIdx, dCol);
          capIdx++;
        }
      }
    }
    drinksInst.instanceMatrix.needsUpdate = true;
    if (drinksInst.instanceColor) drinksInst.instanceColor.needsUpdate = true;
    capsInst.instanceMatrix.needsUpdate = true;
    if (capsInst.instanceColor) capsInst.instanceColor.needsUpdate = true;
    btnsInst.instanceMatrix.needsUpdate = true;
    if (btnsInst.instanceColor) btnsInst.instanceColor.needsUpdate = true;
    vm.add(drinksInst, capsInst, btnsInst);

    // Clear glass showcase window in front of drinks
    const showcaseGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.84), vmShowcaseGlassMat);
    showcaseGlass.position.set(0, 1.23, 0.354);
    vm.add(showcaseGlass);

    // 1E. Detailed Coin / Bill / IC Card Control Panel (Mid-Right)
    const ctrlHousing = inkMesh(new THREE.BoxGeometry(0.25, 0.31, 0.045), darkSteelMat);
    ctrlHousing.position.set(0.25, 0.59, 0.322);
    vm.add(ctrlHousing);

    // 7-Segment LED price display ("130")
    const ledReadout = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.036),
      createToonMaterial({ color: 0x80ffaa, emissive: 0x20e070, emissiveIntensity: 0.95 })
    );
    ledReadout.position.set(0.21, 0.69, 0.348);
    vm.add(ledReadout);

    // Bill acceptor slot with green indicator arrow
    const billSlot = inkMesh(new THREE.BoxGeometry(0.11, 0.035, 0.025), chromeMat, { subtle: true });
    billSlot.position.set(0.21, 0.62, 0.348);
    vm.add(billSlot);

    const billGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.01),
      createToonMaterial({ color: 0x69f0ae, emissive: 0x00e676, emissiveIntensity: 0.95 })
    );
    billGlow.position.set(0.21, 0.62, 0.362);
    vm.add(billGlow);

    // IC Card (Suica / Pasmo) contactless touch pad
    const icPad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.085),
      createToonMaterial({ color: 0x4cc8ff, emissive: 0x1a9be8, emissiveIntensity: 0.72 })
    );
    icPad.position.set(0.32, 0.65, 0.348);
    vm.add(icPad);

    // Chrome coin slot + coin return lever + recessed coin return cup
    const coinSlot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), chromeMat);
    coinSlot.rotation.x = Math.PI / 2;
    coinSlot.position.set(0.32, 0.56, 0.345);
    vm.add(coinSlot);

    const coinReturnCup = inkMesh(new THREE.BoxGeometry(0.07, 0.065, 0.03), darkSteelMat, {
      subtle: true,
    });
    coinReturnCup.position.set(0.22, 0.5, 0.342);
    vm.add(coinReturnCup);

    // 1F. Recessed Pickup Chute + Smoked Acrylic Flap + Lower Louver Grille + Door Lock Hinge
    const pickupBezel = inkMesh(new THREE.BoxGeometry(0.56, 0.23, 0.045), chromeMat, { subtle: true });
    pickupBezel.position.set(-0.07, 0.25, 0.316);
    vm.add(pickupBezel);

    const pickupRecess = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.17, 0.05), darkSteelMat);
    pickupRecess.position.set(-0.07, 0.25, 0.322);
    vm.add(pickupRecess);

    const pushFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.14, 0.015),
      createToonMaterial({ color: 0x3b4860, wetRim: true, wetRimStrength: 0.35 })
    );
    pushFlap.position.set(-0.07, 0.26, 0.345);
    pushFlap.rotation.x = -0.14;
    vm.add(pushFlap);

    // Bottom cooling intake louver slats
    for (let lv = 0; lv < 3; lv++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.014, 0.018), darkSteelMat);
      slat.position.set(0, 0.075 + lv * 0.024, 0.316);
      vm.add(slat);
    }

    // Stainless T-handle door latch & hinge knuckles along right/left edge
    const latch = inkMesh(new THREE.BoxGeometry(0.032, 0.09, 0.03), chromeMat, { subtle: true });
    latch.position.set(0.405, 0.92, 0.322);
    vm.add(latch);

    for (const hy of [0.35, 1.55]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.065, 8), chromeMat);
      hinge.position.set(-0.432, hy, 0.305);
      vm.add(hinge);
    }

    return vm;
  }

  const vm1 = createVendingMachine(0xf4f6fa, 0xe54b3c, 'red', true);
  vm1.position.set(-4.0, Y_SW, 1.48);
  group.add(vm1);

  const vm2 = createVendingMachine(0x2898e0, 0x1666a8, 'blue', false);
  vm2.position.set(4.15, Y_SW, -4.06);
  vm2.rotation.y = Math.PI / 2;
  group.add(vm2);

  // =========================================================================
  // 2. KONBINI TRASH & RECYCLING BINS ("垃圾桶") with printed sorting placards
  // =========================================================================
  const binBrushedMat = createToonMaterial({
    map: createBrushedMetalTexture(),
    color: 0xe6ebf2,
    wetRim: true,
    roughness: 0.68,
  });
  const binFrontBurnableTex = createTrashBinFrontTexture(false);
  const binFrontRecycleTex = createTrashBinFrontTexture(true);

  function createTrashBin(accentColor: number, isBottleBin: boolean): THREE.Group {
    const bin = new THREE.Group();
    const body = inkMesh(
      new RoundedBoxGeometry(0.46, 0.72, 0.38, 2, 0.022),
      binBrushedMat,
      { edges: false, hull: true }
    );
    body.position.y = 0.36;
    bin.add(body);

    // Front waste classification placard ("もえるゴミ" / "カン・ペット")
    const frontTex = isBottleBin ? binFrontRecycleTex : binFrontBurnableTex;
    const frontLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.54),
      createToonMaterial({ map: frontTex, color: 0xffffff, roughness: 0.78 })
    );
    frontLabel.position.set(0, 0.38, 0.194);
    bin.add(frontLabel);

    const hood = inkMesh(
      new RoundedBoxGeometry(0.48, 0.16, 0.4, 2, 0.024),
      createToonMaterial({ color: accentColor, wetRim: true, roughness: 0.45 }),
      { edges: false, hull: true }
    );
    hood.position.y = 0.76;
    bin.add(hood);

    if (isBottleBin) {
      for (const hx of [-0.1, 0.1]) {
        const holeRim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.009, 10, 20), chromeMat);
        holeRim.position.set(hx, 0.76, 0.195);
        bin.add(holeRim);
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 20), darkSteelMat);
        hole.rotation.x = Math.PI / 2;
        hole.position.set(hx, 0.76, 0.192);
        bin.add(hole);
      }
    } else {
      const slotBezel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.02), chromeMat);
      slotBezel.position.set(0, 0.76, 0.193);
      bin.add(slotBezel);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.03), darkSteelMat);
      slot.position.set(0, 0.76, 0.196);
      bin.add(slot);
    }
    return bin;
  }

  const bin1 = createTrashBin(0x209f6c, false);
  bin1.position.set(-2.82, Y_SW, 2.06);
  group.add(bin1);

  const bin2 = createTrashBin(0x1b88d9, true);
  bin2.position.set(-2.3, Y_SW, 2.06);
  group.add(bin2);

  // Dedicated empty-bottle & can recycling bin beside the right-side vending machine
  const vmBin = createTrashBin(0x1e88e5, true);
  vmBin.scale.set(0.78, 0.92, 0.78);
  vmBin.position.set(4.12, Y_SW, -4.72);
  vmBin.rotation.y = Math.PI / 2;
  group.add(vmBin);

  // =========================================================================
  // 3. STAINLESS UMBRELLA STAND + UMBRELLAS ("雨伞架" - hollow open grid, 0 clipping!)
  // =========================================================================
  const umbStand = new THREE.Group();
  umbStand.position.set(1.66, Y_SW, 2.08);
  umbStand.rotation.y = 0.25;

  // Recessed hollow drip tray bottom pan + raised 4-wall border rim
  const trayPan = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.014, 0.26), galvSteelMat);
  trayPan.position.y = 0.007;
  umbStand.add(trayPan);

  const panFrontBack = [
    { x: 0, z: -0.125, w: 0.45, d: 0.016 },
    { x: 0, z: 0.125, w: 0.45, d: 0.016 },
    { x: -0.22, z: 0, w: 0.016, d: 0.26 },
    { x: 0.22, z: 0, w: 0.016, d: 0.26 },
  ];
  for (const w of panFrontBack) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w.w, 0.044, w.d), chromeMat);
    lip.position.set(w.x, 0.022, w.z);
    umbStand.add(lip);
  }

  // Open tubular perimeter top frame (y = 0.52) + slender wire grid dividers (6 open pockets)
  for (const tz of [-0.12, 0, 0.12]) {
    const xBar = new THREE.Mesh(
      new THREE.CylinderGeometry(tz === 0 ? 0.006 : 0.009, tz === 0 ? 0.006 : 0.009, 0.44, 10),
      chromeMat
    );
    xBar.rotation.z = Math.PI / 2;
    xBar.position.set(0, 0.52, tz);
    umbStand.add(xBar);
  }
  for (const gx of [-0.22, -0.075, 0.075, 0.22]) {
    const zBar = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.abs(gx) > 0.2 ? 0.009 : 0.006, Math.abs(gx) > 0.2 ? 0.009 : 0.006, 0.24, 10),
      chromeMat
    );
    zBar.rotation.x = Math.PI / 2;
    zBar.position.set(gx, 0.52, 0);
    umbStand.add(zBar);
  }

  for (const cx of [-0.215, 0.215]) {
    for (const cz of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.52, 12), chromeMat);
      leg.position.set(cx, 0.26, cz);
      umbStand.add(leg);
    }
  }

  // 3 slender furled umbrellas cleanly centered in separate open pockets resting inside drip tray
  const umbConfigs = [
    { x: -0.145, z: -0.06, rx: 0.025, rz: 0.02, col: 0xdff2ff, handle: 0xf5f7fa, vinyl: true },
    { x: 0.0, z: 0.06, rx: -0.02, rz: 0.015, col: 0xffd54f, handle: 0x5d4037, vinyl: false },
    { x: 0.145, z: -0.06, rx: 0.02, rz: -0.025, col: 0xef5350, handle: 0x4e342e, vinyl: false },
  ];

  for (const u of umbConfigs) {
    const umb = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.78, 12), chromeMat);
    shaft.position.y = 0.40;
    umb.add(shaft);

    const canopy = inkMesh(
      new THREE.ConeGeometry(0.044, 0.50, 16),
      createToonMaterial({
        color: u.col,
        transparent: u.vinyl,
        opacity: u.vinyl ? 0.58 : 1.0,
        wetRim: true,
        roughness: u.vinyl ? 0.2 : 0.85,
      }),
      { edges: false, hull: !u.vinyl, hullThickness: 0.007 }
    );
    canopy.rotation.x = Math.PI;
    canopy.position.y = 0.34;
    umb.add(canopy);

    const handleHook = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.009, 10, 18, Math.PI),
      createToonMaterial({ color: u.handle, roughness: 0.55 })
    );
    handleHook.position.set(0.032, 0.79, 0);
    umb.add(handleHook);

    umb.position.set(u.x, 0.02, u.z);
    umb.rotation.set(u.rx, 0, u.rz);
    umbStand.add(umb);
  }
  group.add(umbStand);

  // =========================================================================
  // 4. DETAILED JAPANESE MAMACHARI BICYCLE ("自行车")
  // =========================================================================
  const bike = new THREE.Group();
  bike.position.set(0.55, Y_SW, 2.68);
  bike.rotation.y = 0.34;
  bike.rotation.x = 0.075; // Resting slightly leaned on kickstand

  const bikeFrameMat = createToonMaterial({
    color: 0x56b8a8, // Mint-teal anime mamachari frame!
    wetRim: true,
    wetRimStrength: 0.32,
  });
  const tireMat = createToonMaterial({ color: 0x1c222e, wetRim: true });
  const leatherMat = createToonMaterial({ color: 0x6d452b, wetRim: true });

  // Front & Rear Wheels (high-segment smooth tires, rims, hub flanges & 12 spokes)
  for (const wx of [-0.52, 0.52]) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, 0.32, 0);

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 14, 36), tireMat);
    wheelGroup.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 10, 36), chromeMat);
    wheelGroup.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.07, 16), chromeMat);
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(hub);

    for (let s = 0; s < 10; s++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.54, 6), chromeMat);
      spoke.rotation.z = (s / 10) * Math.PI;
      wheelGroup.add(spoke);
    }

    const fender = new THREE.Mesh(
      new THREE.TorusGeometry(0.335, 0.022, 12, 28, Math.PI * 0.95),
      chromeMat
    );
    fender.rotation.z = wx < 0 ? 0.15 : -0.1;
    wheelGroup.add(fender);

    bike.add(wheelGroup);
  }

  function addTube(p1: THREE.Vector3, p2: THREE.Vector3, r = 0.018, mat = bikeFrameMat) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
    cyl.position.copy(p1).add(p2).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    cyl.castShadow = true;
    bike.add(cyl);
  }

  const pHeadTop = new THREE.Vector3(-0.38, 0.78, 0);
  const pHeadBot = new THREE.Vector3(-0.42, 0.58, 0);
  const pBB = new THREE.Vector3(0.02, 0.3, 0);
  const pSeatTop = new THREE.Vector3(0.16, 0.74, 0);
  const seatDir = new THREE.Vector3().subVectors(pSeatTop, pBB).normalize();
  const pSeatPostEnd = pSeatTop.clone().addScaledVector(seatDir, 0.095);

  addTube(pHeadTop, pHeadBot, 0.022);
  addTube(pHeadBot, new THREE.Vector3(-0.52, 0.32, 0.045), 0.014);
  addTube(pHeadBot, new THREE.Vector3(-0.52, 0.32, -0.045), 0.014);
  addTube(pHeadBot, pBB, 0.02);
  addTube(new THREE.Vector3(-0.39, 0.66, 0), new THREE.Vector3(0.08, 0.46, 0), 0.016);
  addTube(pBB, pSeatTop, 0.02);
  addTube(pBB, new THREE.Vector3(0.52, 0.32, 0.05), 0.013);
  addTube(pBB, new THREE.Vector3(0.52, 0.32, -0.05), 0.013);
  addTube(new THREE.Vector3(0.13, 0.66, 0), new THREE.Vector3(0.52, 0.32, 0.05), 0.012);
  addTube(new THREE.Vector3(0.13, 0.66, 0), new THREE.Vector3(0.52, 0.32, -0.05), 0.012);

  // Seat clamp collar + chrome seatpost cleanly bridging seat-tube into saddle underside
  const seatClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 14), darkSteelMat);
  seatClamp.position.copy(pSeatTop);
  seatClamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), seatDir);
  bike.add(seatClamp);
  addTube(pSeatTop.clone().addScaledVector(seatDir, -0.01), pSeatPostEnd, 0.014, chromeMat);

  // Chainring crank, chainguard, crank arms & pedals
  const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 20), chromeMat);
  chainring.rotation.x = Math.PI / 2;
  chainring.position.set(0.02, 0.3, 0.035);
  bike.add(chainring);

  const chainGuard = inkMesh(new RoundedBoxGeometry(0.54, 0.085, 0.028, 2, 0.012), bikeFrameMat, {
    edges: false,
    subtle: true,
  });
  chainGuard.position.set(0.27, 0.31, 0.048);
  bike.add(chainGuard);

  for (const [cz, dx, dy] of [
    [0.068, 0.07, -0.10],
    [-0.068, -0.07, 0.10],
  ] as const) {
    addTube(new THREE.Vector3(0.02, 0.3, cz * 0.72), new THREE.Vector3(0.02 + dx, 0.3 + dy, cz), 0.008, chromeMat);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.022, 0.048), tireMat);
    pedal.position.set(0.02 + dx, 0.3 + dy, cz + (cz > 0 ? 0.025 : -0.025));
    bike.add(pedal);
  }

  // Handlebars + Grips + Chrome Bell
  addTube(pHeadTop, new THREE.Vector3(-0.35, 0.94, 0), 0.015, chromeMat);
  addTube(new THREE.Vector3(-0.35, 0.94, -0.22), new THREE.Vector3(-0.35, 0.94, 0.22), 0.013, chromeMat);
  for (const gz of [-0.24, 0.24]) {
    addTube(
      new THREE.Vector3(-0.35, 0.94, gz * 0.85),
      new THREE.Vector3(-0.24, 0.92, gz * 1.05),
      0.018,
      leatherMat
    );
  }
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), chromeMat);
  bell.position.set(-0.35, 0.965, 0.14);
  bike.add(bell);

  // Open Wire Mesh Front Basket ("前カゴ") mounted rigidly to head tube & front fork axle
  for (const by of [0.68, 0.78, 0.88]) {
    for (const bx of [-0.63, -0.41]) {
      addTube(new THREE.Vector3(bx, by, -0.15), new THREE.Vector3(bx, by, 0.15), 0.006, darkSteelMat);
    }
    for (const bz of [-0.15, 0.15]) {
      addTube(new THREE.Vector3(-0.63, by, bz), new THREE.Vector3(-0.41, by, bz), 0.006, darkSteelMat);
    }
  }
  for (const bx of [-0.63, -0.41]) {
    for (const bz of [-0.15, 0.15]) {
      addTube(new THREE.Vector3(bx, 0.68, bz), new THREE.Vector3(bx, 0.88, bz), 0.006, darkSteelMat);
    }
  }
  const basketFloor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.30), darkSteelMat);
  basketFloor.position.set(-0.52, 0.68, 0);
  bike.add(basketFloor);

  // Rigid front basket stays connecting head tube & front axle to basket frame
  addTube(new THREE.Vector3(-0.39, 0.76, 0), new THREE.Vector3(-0.41, 0.76, 0), 0.009, darkSteelMat);
  addTube(new THREE.Vector3(-0.42, 0.68, 0), new THREE.Vector3(-0.40, 0.65, 0), 0.008, darkSteelMat);
  for (const bz of [-0.08, 0.08]) {
    addTube(new THREE.Vector3(-0.52, 0.32, bz * 0.56), new THREE.Vector3(-0.52, 0.68, bz), 0.006, chromeMat);
  }

  // Headlamp mounted cleanly onto fork crown bracket (no floating lamp!)
  addTube(new THREE.Vector3(-0.44, 0.54, 0), new THREE.Vector3(-0.55, 0.60, 0), 0.008, chromeMat);
  const headlamp = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.06, 16), chromeMat);
  headlamp.rotation.z = Math.PI / 2;
  headlamp.position.set(-0.56, 0.61, 0);
  bike.add(headlamp);

  // Sculpted Teardrop Leather Mamachari Saddle + Seat Rails anchored directly onto pSeatPostEnd
  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(-0.115, 0);
  saddleShape.bezierCurveTo(-0.115, 0.026, -0.055, 0.028, -0.01, 0.052);
  saddleShape.bezierCurveTo(0.045, 0.082, 0.11, 0.082, 0.115, 0);
  saddleShape.bezierCurveTo(0.11, -0.082, 0.045, -0.082, -0.01, -0.052);
  saddleShape.bezierCurveTo(-0.055, -0.028, -0.115, -0.026, -0.115, 0);
  const saddleGeo = new THREE.ExtrudeGeometry(saddleShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  saddleGeo.rotateX(Math.PI / 2);
  const saddle = inkMesh(saddleGeo, leatherMat, {
    edges: false,
    hull: true,
    hullThickness: 0.008,
  });
  saddle.position.set(pSeatPostEnd.x + 0.025, pSeatPostEnd.y + 0.032, 0);
  bike.add(saddle);

  for (const rz of [-0.028, 0.028]) {
    addTube(
      new THREE.Vector3(pSeatPostEnd.x - 0.015, pSeatPostEnd.y - 0.022, rz),
      new THREE.Vector3(pSeatPostEnd.x + 0.085, pSeatPostEnd.y - 0.014, rz),
      0.005,
      chromeMat
    );
  }

  // Rear Carrier Rack ("リアキャリア") with side frame stays down to rear axle + front seatstay bridge
  const rearRack = inkMesh(new RoundedBoxGeometry(0.36, 0.025, 0.16, 2, 0.008), chromeMat, {
    edges: false,
    subtle: true,
  });
  rearRack.position.set(0.46, 0.68, 0);
  bike.add(rearRack);
  for (const rz of [-0.065, 0.065]) {
    addTube(new THREE.Vector3(0.56, 0.68, rz), new THREE.Vector3(0.52, 0.32, rz * 0.78), 0.007, chromeMat);
    addTube(new THREE.Vector3(0.31, 0.68, rz), new THREE.Vector3(0.145, 0.66, 0), 0.007, chromeMat);
  }

  // Dual-leg rear kickstand firmly grounded onto wet sidewalk
  addTube(new THREE.Vector3(0.52, 0.32, -0.06), new THREE.Vector3(0.56, -0.004, -0.15), 0.01, darkSteelMat);
  addTube(new THREE.Vector3(0.52, 0.32, 0.06), new THREE.Vector3(0.56, -0.004, 0.12), 0.01, darkSteelMat);

  group.add(bike);

  // =========================================================================
  // 5. STREET CORNER PEDESTRIAN GUARDRAILS ("街角护栏" with smooth flanges & rings)
  // =========================================================================
  function addGuardrailUnit(x: number, z: number, rotY: number, width = 1.12) {
    const gr = new THREE.Group();
    const h = 0.74;
    for (const px of [-width * 0.5, width * 0.5]) {
      const baseFlange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.056, 0.025, 16),
        whiteEnamelMat
      );
      baseFlange.position.set(px, 0.0125, 0);
      gr.add(baseFlange);

      const post = inkMesh(new THREE.CylinderGeometry(0.028, 0.028, h, 16), whiteEnamelMat, {
        edges: false,
        hull: true,
        hullThickness: 0.008,
      });
      post.position.set(px, h * 0.5, 0);
      gr.add(post);

      const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.028, 14, 10), whiteEnamelMat);
      capDome.position.set(px, h, 0);
      gr.add(capDome);
    }
    for (const py of [0.36, 0.7]) {
      const rail = inkMesh(new THREE.CylinderGeometry(0.024, 0.024, width, 16), whiteEnamelMat, {
        edges: false,
        hull: true,
        hullThickness: 0.008,
      });
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, py, 0);
      gr.add(rail);
    }
    // Smooth high-segment Tokyo-style decorative center ring emblem + weld saddles
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 12, 28), whiteEnamelMat);
    ring.position.set(0, 0.53, 0);
    gr.add(ring);

    for (const sy of [0.43, 0.63]) {
      const saddleWeld = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), whiteEnamelMat);
      saddleWeld.position.set(0, sy, 0);
      gr.add(saddleWeld);
    }

    gr.position.set(x, Y_SW, z);
    gr.rotation.y = rotY;
    group.add(gr);
  }

  // Front street guardrails left of crosswalk
  addGuardrailUnit(-3.55, 4.16, 0, 1.15);
  addGuardrailUnit(-2.25, 4.16, 0, 1.15);
  addGuardrailUnit(-0.95, 4.16, 0, 1.15);

  // Corner guardrails curving smoothly between the two crosswalks!
  addGuardrailUnit(3.52, 4.08, 0.28, 0.92);
  addGuardrailUnit(4.42, 3.68, 0.78, 0.92);
  addGuardrailUnit(4.96, 2.98, 1.28, 0.85);

  // Side street guardrails beyond second crosswalk
  addGuardrailUnit(5.16, -0.75, Math.PI / 2, 1.15);
  addGuardrailUnit(5.16, -2.05, Math.PI / 2, 1.15);
  addGuardrailUnit(5.16, -3.35, Math.PI / 2, 1.15);

  // =========================================================================
  // 6. CURVED JAPANESE STREETLIGHT ("路灯") + VOLUMETRIC ANIME HALO
  // =========================================================================
  const streetLamp = new THREE.Group();
  streetLamp.position.set(3.12, Y_SW, 4.02);
  streetLamp.rotation.y = 0.55; // Angled gracefully out over street corner & crosswalk

  const lampPoleMat = createToonMaterial({ color: 0x2c384e, wetRim: true, wetRimStrength: 0.35 });
  const baseCollar = inkMesh(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 10), lampPoleMat);
  baseCollar.position.y = 0.225;
  streetLamp.add(baseCollar);

  const mainShaft = inkMesh(new THREE.CylinderGeometry(0.052, 0.072, 4.5, 10), lampPoleMat, {
    edges: false,
    hull: true,
    hullThickness: 0.01,
  });
  mainShaft.position.y = 2.45;
  streetLamp.add(mainShaft);

  // Curved gooseneck arm extending outward
  const armCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 4.65, 0),
    new THREE.Vector3(0, 5.25, 0.45),
    new THREE.Vector3(0, 5.1, 1.25)
  );
  const armGeo = new THREE.TubeGeometry(armCurve, 12, 0.036, 8, false);
  const armMesh = inkMesh(armGeo, lampPoleMat, { edges: false, hull: true, hullThickness: 0.008 });
  streetLamp.add(armMesh);

  // Lamp head hood + bright glowing diffuser
  const lampHood = inkMesh(new THREE.BoxGeometry(0.32, 0.1, 0.54), lampPoleMat);
  lampHood.position.set(0, 5.1, 1.38);
  streetLamp.add(lampHood);

  const lampBulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.06, 0.44),
    createToonMaterial({
      color: 0xffffff,
      emissive: 0xdff0ff,
      emissiveIntensity: 1.25,
    })
  );
  lampBulb.position.set(0, 5.04, 1.38);
  streetLamp.add(lampBulb);

  // Soft anime volumetric light cone in rainy mist (with Fresnel edge feathering!)
  const coneGeo = new THREE.ConeGeometry(2.35, 4.85, 24, 1, true);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
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
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        // vUv.y = 1 at apex, 0 at bottom base (NaN-free polynomial fade + soft silhouette!)
        float ySafe = clamp(vUv.y, 0.0, 1.0);
        float vertFade = ySafe * sqrt(ySafe) * smoothstep(0.0, 0.28, ySafe);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float edgeSoft = clamp(abs(dot(normalize(vWorldNormal), viewDir)), 0.0, 1.0);
        edgeSoft = edgeSoft * edgeSoft;
        gl_FragColor = vec4(0.68, 0.85, 1.0, vertFade * edgeSoft * 0.115);
      }
    `,
  });
  const lightCone = new THREE.Mesh(coneGeo, coneMat);
  lightCone.position.set(0, 2.62, 1.38);
  streetLamp.add(lightCone);

  group.add(streetLamp);

  // =========================================================================
  // 7. CONCRETE UTILITY POLE ("电线杆") + OVERHEAD CATENARY WIRES ("电线")
  // =========================================================================
  const concretePoleMat = createToonMaterial({
    color: 0x8a95a8,
    wetRim: true,
    wetRimStrength: 0.26,
  });

  // Main Corner Utility Pole at (+4.62, Y_SW, +3.18)
  const mainPolePos = new THREE.Vector3(4.62, Y_SW, 3.18);
  const poleGroup = new THREE.Group();
  poleGroup.position.copy(mainPolePos);

  const poleShaft = inkMesh(new THREE.CylinderGeometry(0.115, 0.175, 7.2, 12), concretePoleMat, {
    edges: false,
    hull: true,
    hullThickness: 0.012,
  });
  poleShaft.position.y = 3.6;
  poleGroup.add(poleShaft);

  // Blue town address plaque ("虹ヶ丘二丁目 4-12") wrapped on pole
  const addrTex = createAddressPlateTexture();
  const addrPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.162, 0.168, 0.92, 12, 1, true, -0.5, 1.0),
    createToonMaterial({ map: addrTex, color: 0xffffff })
  );
  addrPlate.position.y = 2.15;
  addrPlate.rotation.y = 0.65;
  poleGroup.add(addrPlate);

  // Properly anchored guy-wire steel cable + yellow/black safety guard ("支線ガード")
  const pGuyTop = new THREE.Vector3(0, 4.85, 0);
  const pGuyBot = new THREE.Vector3(-0.62, 0.02, 0.44);
  const guyDir = new THREE.Vector3().subVectors(pGuyBot, pGuyTop);
  const guyLen = guyDir.length();
  const guyUnit = guyDir.clone().normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);

  // Pole attachment clamp collar at Y = 4.85
  const poleClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.142, 0.07, 12), galvSteelMat);
  poleClamp.position.copy(pGuyTop);
  poleGroup.add(poleClamp);

  // Ground anchor plate & turnbuckle socket on sidewalk inside corner guardrail
  const anchorPlate = inkMesh(new THREE.CylinderGeometry(0.055, 0.07, 0.05, 8), darkSteelMat, {
    subtle: true,
  });
  anchorPlate.position.set(pGuyBot.x, 0.025, pGuyBot.z);
  poleGroup.add(anchorPlate);

  // Upper bare galvanized steel guy cable (top 54% of span)
  const cableLen = guyLen * 0.56;
  const guyCable = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, cableLen, 6), galvSteelMat);
  guyCable.position.copy(pGuyTop).addScaledVector(guyUnit, cableLen * 0.5);
  guyCable.quaternion.setFromUnitVectors(yAxis, guyUnit);
  poleGroup.add(guyCable);

  // Lower yellow protective guard sleeve with black warning bands (lower 44% anchored to ground!)
  const guardLen = guyLen * 0.44;
  const guyWireGuard = inkMesh(
    new THREE.CylinderGeometry(0.024, 0.024, guardLen, 8),
    createToonMaterial({ color: 0xf4c430, wetRim: true })
  );
  guyWireGuard.position.copy(pGuyTop).addScaledVector(guyUnit, cableLen + guardLen * 0.5);
  guyWireGuard.quaternion.setFromUnitVectors(yAxis, guyUnit);
  poleGroup.add(guyWireGuard);

  const stripeMat = createToonMaterial({ color: 0x1e2430 });
  for (const frac of [0.22, 0.5, 0.78]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0255, 0.0255, 0.16, 8),
      stripeMat
    );
    band.position
      .copy(pGuyTop)
      .addScaledVector(guyUnit, cableLen + guardLen * frac);
    band.quaternion.setFromUnitVectors(yAxis, guyUnit);
    poleGroup.add(band);
  }

  // Twin Pole-Mounted Cylindrical Transformers ("柱上変圧器") with cooling fin rings & bushings
  const transMat = createToonMaterial({ color: 0x6b778a, wetRim: true });
  for (const tz of [-0.28, 0.24]) {
    const bucket = inkMesh(new THREE.CylinderGeometry(0.19, 0.18, 0.64, 20), transMat, {
      edges: false,
      hull: true,
      hullThickness: 0.01,
    });
    bucket.position.set(-0.24, 5.15, tz);
    poleGroup.add(bucket);

    const topLid = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.04, 20), darkSteelMat);
    topLid.position.set(-0.24, 5.48, tz);
    poleGroup.add(topLid);

    for (const fy of [4.95, 5.12, 5.29]) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), transMat);
      fin.position.set(-0.24, fy, tz);
      poleGroup.add(fin);
    }
  }

  // Ribbed ceramic skirt insulators & crossarms with diagonal galvanized braces
  const insulatorMat = createToonMaterial({ color: 0xf4f7fc });
  const ribbedInsGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.022, 0.0),
      new THREE.Vector2(0.044, 0.03),
      new THREE.Vector2(0.024, 0.05),
      new THREE.Vector2(0.04, 0.075),
      new THREE.Vector2(0.022, 0.1),
      new THREE.Vector2(0.032, 0.125),
      new THREE.Vector2(0.0, 0.13),
    ],
    14
  );
  for (const cy of [6.05, 6.72]) {
    const crossArm = inkMesh(new RoundedBoxGeometry(1.42, 0.07, 0.07, 2, 0.01), galvSteelMat, {
      edges: false,
      hull: true,
    });
    crossArm.position.set(0, cy, 0);
    crossArm.rotation.y = 0.45;
    poleGroup.add(crossArm);

    for (const ix of [-0.56, -0.18, 0.18, 0.56]) {
      const ins = new THREE.Mesh(ribbedInsGeo, insulatorMat);
      ins.position.set(Math.cos(0.45) * ix, cy + 0.035, -Math.sin(0.45) * ix);
      poleGroup.add(ins);
    }
  }

  // Climbing step bolts along pole
  for (let sy = 1.6; sy < 6.4; sy += 0.42) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), darkSteelMat);
    step.position.set(sy % 0.84 < 0.4 ? 0.16 : -0.16, sy, 0);
    poleGroup.add(step);
  }
  group.add(poleGroup);

  // Secondary Rear-Right Utility Pole at (+4.92, Y_SW, -8.35) & Rear-Left Alley Pole at (-5.58, Y_SW, -8.15)
  function addSecondaryPole(x: number, z: number, height = 6.5) {
    const p = new THREE.Group();
    p.position.set(x, Y_SW, z);
    const shaft = inkMesh(
      new THREE.CylinderGeometry(0.095, 0.145, height, 10),
      concretePoleMat,
      { edges: false, hull: true, hullThickness: 0.01 }
    );
    shaft.position.y = height * 0.5;
    p.add(shaft);
    const arm = inkMesh(new THREE.BoxGeometry(1.05, 0.06, 0.06), galvSteelMat);
    arm.position.y = height - 0.35;
    p.add(arm);
    group.add(p);
  }
  addSecondaryPole(4.92, -8.35, 6.65);
  addSecondaryPole(-5.58, -8.15, 6.25);

  // Sagging Overhead Catenary Wires ("电线") strictly inside the 18x18 diorama!
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x0e1424 });
  function addCatenaryWire(a: THREE.Vector3, b: THREE.Vector3, sag = 0.48, radius = 0.012) {
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius, 5, false), wireMat);
    group.add(tube);
  }

  // Span 1: Main Corner Pole -> Rear-Right Pole (3 parallel high/low wires along side street)
  for (const dx of [-0.36, 0.0, 0.36]) {
    addCatenaryWire(
      new THREE.Vector3(4.62 + dx, 6.82, 3.18),
      new THREE.Vector3(4.92 + dx * 0.8, 6.45, -8.35),
      0.58
    );
  }
  addCatenaryWire(new THREE.Vector3(4.55, 5.55, 3.18), new THREE.Vector3(4.88, 5.35, -8.35), 0.45, 0.016);

  // Span 2: Rear-Right Pole -> Rear-Left Alley Pole (framing back skyline cleanly!)
  for (const dy of [0, -0.45]) {
    addCatenaryWire(
      new THREE.Vector3(4.92, 6.42 + dy, -8.35),
      new THREE.Vector3(-5.58, 6.02 + dy, -8.15),
      0.52
    );
  }

  // Span 3: Service drop wires from Main Pole to Konbini Rooftop Mast!
  addCatenaryWire(new THREE.Vector3(4.45, 5.85, 3.05), new THREE.Vector3(2.95, 4.35, -0.35), 0.34, 0.011);
  addCatenaryWire(new THREE.Vector3(-5.58, 5.75, -8.15), new THREE.Vector3(-2.9, 5.2, -3.8), 0.36, 0.011);

  // =========================================================================
  // 8. STREET SIGNS, CONVEX MIRROR & CANTILEVERED TRAFFIC SIGNAL ("路牌 / 信号灯")
  // =========================================================================
  // 8A. Red Japanese "止まれ" STOP Sign before front stop line (-1.28, Y_SW, +4.12)
  const stopTex = createStopSignTexture();
  const stopGroup = new THREE.Group();
  stopGroup.position.set(-1.28, Y_SW, 4.12);
  const stopFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.03, 16), galvSteelMat);
  stopFlange.position.y = 0.015;
  stopGroup.add(stopFlange);
  const stopPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.35, 16), galvSteelMat);
  stopPole.position.y = 1.175;
  stopGroup.add(stopPole);

  const stopHead = new THREE.Group();
  stopHead.position.set(0, 2.25, 0);
  stopHead.rotation.y = -Math.PI * 0.42; // Faces oncoming front-street lane
  const stopBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.56),
    new THREE.MeshBasicMaterial({ map: stopTex, transparent: true, side: THREE.FrontSide })
  );
  stopBoard.position.z = 0.044;
  stopHead.add(stopBoard);

  // Matching beveled aluminum inverted triangle sign plate + pole clamp ribs
  const stopBackShape = new THREE.Shape();
  stopBackShape.moveTo(-0.24, 0.22);
  stopBackShape.lineTo(0.24, 0.22);
  stopBackShape.lineTo(0, -0.235);
  stopBackShape.closePath();
  const stopPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(stopBackShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.006,
      bevelSegments: 2,
    }),
    galvSteelMat
  );
  stopPlate.position.z = 0.031;
  stopHead.add(stopPlate);
  for (const ry of [0.1, -0.06]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.02), galvSteelMat);
    rib.position.set(0, ry, 0.022);
    stopHead.add(rib);
  }
  stopGroup.add(stopHead);
  group.add(stopGroup);

  // 8B. Authentic Japanese Pentagon Crosswalk Sign ("横断歩道" 407-A) at (+2.95, Y_SW, +4.12)
  const cwTex = createCrosswalkSignTexture();
  const cwGroup = new THREE.Group();
  cwGroup.position.set(2.95, Y_SW, 4.12);
  const cwFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.03, 16), galvSteelMat);
  cwFlange.position.y = 0.015;
  cwGroup.add(cwFlange);
  const cwPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.45, 16), galvSteelMat);
  cwPole.position.y = 1.225;
  cwGroup.add(cwPole);

  const cwHead = new THREE.Group();
  cwHead.position.set(0, 2.36, 0);
  cwHead.rotation.y = -0.35;
  const cwBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.54, 0.54),
    new THREE.MeshBasicMaterial({ map: cwTex, transparent: true, side: THREE.FrontSide })
  );
  cwBoard.position.z = 0.044;
  cwHead.add(cwBoard);

  // Exact matching Japanese Pentagon aluminum backing plate (peaks up, shoulders out, flat base!)
  const cwBackShape = new THREE.Shape();
  cwBackShape.moveTo(0, 0.245);
  cwBackShape.lineTo(0.222, 0.056);
  cwBackShape.lineTo(0.17, -0.226);
  cwBackShape.lineTo(-0.17, -0.226);
  cwBackShape.lineTo(-0.222, 0.056);
  cwBackShape.closePath();
  const cwPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cwBackShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.006,
      bevelSegments: 2,
    }),
    galvSteelMat
  );
  cwPlate.position.z = 0.031;
  cwHead.add(cwPlate);
  for (const ry of [0.09, -0.09]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.02), galvSteelMat);
    rib.position.set(0, ry, 0.022);
    cwHead.add(rib);
  }
  cwGroup.add(cwHead);
  group.add(cwGroup);

  // 8C. TRUE REFLECTIVE Convex Street Corner Mirror ("カーブミラー") with Real-Time CubeCamera!
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(5.14, Y_SW, 2.55);

  const mirrorFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.03, 16), galvSteelMat);
  mirrorFlange.position.y = 0.015;
  mirrorGroup.add(mirrorFlange);

  const mirrorPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.038, 2.75, 18),
    createToonMaterial({ color: 0xf5c230, wetRim: true, roughness: 0.42 })
  );
  mirrorPole.position.y = 1.375;
  mirrorGroup.add(mirrorPole);

  for (const sy of [0.55, 0.85, 1.15]) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.12, 18), darkSteelMat);
    stripe.position.y = sy;
    mirrorGroup.add(stripe);
  }

  const mirrorHead = new THREE.Group();
  mirrorHead.position.set(0, 2.68, 0.06);
  mirrorHead.rotation.y = Math.PI * 0.3; // Angled toward intersection

  // Twin rear mounting U-clamp collar & swivel arm
  const clampCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.14, 16), galvSteelMat);
  clampCollar.position.set(0, 0, -0.07);
  mirrorHead.add(clampCollar);

  // Sleek orange outer safety ring shell + curved domed rear backing
  const orangeShell = inkMesh(
    new THREE.CylinderGeometry(0.35, 0.34, 0.06, 36),
    createToonMaterial({ color: 0xff6d1c, wetRim: true, roughness: 0.38 }),
    { edges: false, hull: true, hullThickness: 0.01 }
  );
  orangeShell.rotation.x = Math.PI / 2;
  mirrorHead.add(orangeShell);

  const rearDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 28, 14, 0, Math.PI * 2, 0, 0.58),
    createToonMaterial({ color: 0xf25c12, wetRim: true, roughness: 0.45 })
  );
  rearDome.rotation.x = -Math.PI / 2;
  rearDome.position.z = 0.49;
  mirrorHead.add(rearDome);

  // Protective top rain hood visor wrapping upper rim cleanly
  const mirrorHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.364, 0.364, 0.15, 36, 1, true, -Math.PI * 0.44, Math.PI * 0.88),
    createToonMaterial({ color: 0xff6d1c, side: THREE.DoubleSide, wetRim: true, roughness: 0.35 })
  );
  mirrorHood.rotation.x = Math.PI / 2;
  mirrorHood.position.z = 0.045;
  mirrorHead.add(mirrorHood);

  const gasketRing = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.014, 14, 36), darkSteelMat);
  gasketRing.position.z = 0.032;
  mirrorHead.add(gasketRing);

  // Real-time CubeCamera capturing the live konbini corner & wet street right from the mirror face!
  const mirrorCubeRT = new THREE.WebGLCubeRenderTarget(128, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const mirrorCubeCam = new THREE.CubeCamera(0.25, 42, mirrorCubeRT);
  mirrorCubeCam.position.set(5.14 + 0.12, Y_SW + 2.68, 2.55 + 0.08);
  group.add(mirrorCubeCam);

  // Full-aperture convex mirror sphere cap (R = 0.62, rim radius = 0.312m -> fills ~90% of mirror face!)
  const convexMirrorMat = new THREE.ShaderMaterial({
    uniforms: {
      uCubeMap: { value: mirrorCubeRT.texture },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform samplerCube uCubeMap;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, N);
        vec3 refl = textureCube(uCubeMap, R).rgb;
        float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.8);
        vec3 col = mix(refl * 1.12, vec3(0.75, 0.88, 1.05), fresnel * 0.22);
        // Subtle convex acrylic glass rim glare
        col += vec3(0.95, 0.98, 1.0) * smoothstep(0.92, 0.99, dot(N, normalize(V + vec3(0.35, 0.65, 0.25)))) * 0.28;
        gl_FragColor = vec4(clamp(col, 0.0, 2.2), 1.0);
      }
    `,
  });
  const convexGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 36, 20, 0, Math.PI * 2, 0, 0.528),
    convexMirrorMat
  );
  convexGlass.rotation.x = Math.PI / 2;
  convexGlass.position.z = -0.51;
  mirrorHead.add(convexGlass);
  mirrorGroup.add(mirrorHead);
  group.add(mirrorGroup);

  let mirrorFrameCount = 0;
  function updateMirrorReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    if (mirrorFrameCount % 6 !== 0) {
      mirrorFrameCount++;
      return;
    }
    mirrorFrameCount++;
    mirrorHead.visible = false;
    mirrorCubeCam.update(renderer, scene);
    mirrorHead.visible = true;
  }

  // 8D. CANTILEVERED JAPANESE TRAFFIC SIGNAL ("远处交通信号灯微弱变化")
  const signalMetalTex = createSignalMetalTexture();
  const hazardCollarTex = createPoleHazardCollarTexture();
  const signalMetalMat = createToonMaterial({
    map: signalMetalTex,
    color: 0xffffff,
    roughness: 0.28,
    wetRim: true,
    wetRimStrength: 0.44,
  });
  const signalHoodMat = createToonMaterial({
    color: 0x161b24,
    roughness: 0.42,
    side: THREE.DoubleSide,
    wetRim: true,
    wetRimStrength: 0.28,
  });
  const rubberBezelMat = createToonMaterial({
    color: 0x11151d,
    roughness: 0.78,
  });
  const signalBackRimMat = createToonMaterial({
    color: 0xe6edf5,
    roughness: 0.24,
    wetRim: true,
    wetRimStrength: 0.35,
  });

  const sigGroup = new THREE.Group();
  sigGroup.position.set(8.32, 0.0, 4.85);

  const sigIsland = inkMesh(
    new RoundedBoxGeometry(0.95, 0.14, 0.95, 2, 0.03),
    createToonMaterial({ color: 0x546072, roughness: 0.88, wetRim: true, wetRimStrength: 0.16 }),
    { edges: false, hull: true }
  );
  sigIsland.position.y = 0.07;
  sigGroup.add(sigIsland);

  // Cast steel bolted baseplate + 4 hex anchor studs
  const sigFlange = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.32), darkSteelMat);
  sigFlange.position.y = 0.156;
  sigGroup.add(sigFlange);
  for (const bx of [-0.11, 0.11]) {
    for (const bz of [-0.11, 0.11]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.036, 6), galvSteelMat);
      bolt.position.set(bx, 0.184, bz);
      sigGroup.add(bolt);
    }
  }

  // Tapered galvanized steel mast + reflective hazard stripe collar + maintenance hatch + top finial cap
  const sigPole = inkMesh(new THREE.CylinderGeometry(0.072, 0.106, 4.78, 20), signalMetalMat, {
    edges: false,
    hull: true,
    hullThickness: 0.009,
  });
  sigPole.position.y = 2.54;
  sigGroup.add(sigPole);

  const hazardCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.101, 0.105, 0.44, 20, 1, true),
    createToonMaterial({ map: hazardCollarTex, color: 0xffffff, roughness: 0.36, wetRim: true, wetRimStrength: 0.25 })
  );
  hazardCollar.position.y = 0.92;
  sigGroup.add(hazardCollar);

  const poleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.076, 0.06, 20), darkSteelMat);
  poleCap.position.y = 4.95;
  sigGroup.add(poleCap);

  // Pole-mounted Relay Junction Box + Pedestrian Push-Button Box ("歩行者用押しボタン箱")
  const relayBox = inkMesh(new RoundedBoxGeometry(0.16, 0.26, 0.14, 2, 0.014), signalMetalMat, {
    edges: false,
    subtle: true,
  });
  relayBox.position.set(0.13, 3.32, 0);
  sigGroup.add(relayBox);

  const pushButtonBand = new THREE.Mesh(new THREE.CylinderGeometry(0.099, 0.101, 0.04, 18), galvSteelMat);
  pushButtonBand.position.y = 1.24;
  sigGroup.add(pushButtonBand);

  const pushBtnBox = inkMesh(
    new RoundedBoxGeometry(0.11, 0.22, 0.13, 2, 0.014),
    createToonMaterial({ color: 0xfacc15, roughness: 0.34, wetRim: true, wetRimStrength: 0.3 }),
    { edges: false, subtle: true }
  );
  pushBtnBox.position.set(-0.14, 1.24, 0.04);
  sigGroup.add(pushBtnBox);

  const pushBtnPad = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 16), chromeMat);
  pushBtnPad.rotation.x = Math.PI / 2;
  pushBtnPad.position.set(-0.14, 1.21, 0.106);
  sigGroup.add(pushBtnPad);

  const pushBtnLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.026, 0.008),
    createToonMaterial({ color: 0xff5a1f, emissive: 0xff3b00, emissiveIntensity: 1.1 })
  );
  pushBtnLed.position.set(-0.14, 1.285, 0.106);
  sigGroup.add(pushBtnLed);

  // Cantilevered Steel Arm (Y = 4.56) with twin bolted pole clamp bands + diagonal tension stay rod!
  for (const cy of [4.56, 4.82]) {
    const armClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.065, 18), darkSteelMat);
    armClamp.position.y = cy;
    sigGroup.add(armClamp);
  }
  const sigArm = inkMesh(new THREE.CylinderGeometry(0.038, 0.052, 2.02, 16), signalMetalMat, {
    edges: false,
    hull: true,
    hullThickness: 0.008,
  });
  sigArm.rotation.z = Math.PI / 2;
  sigArm.position.set(-1.01, 4.56, 0);
  sigGroup.add(sigArm);

  const stayLen = Math.hypot(1.32, 0.26);
  const stayRod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, stayLen, 10), galvSteelMat);
  stayRod.position.set(-0.66, 4.69, 0);
  stayRod.rotation.z = Math.PI / 2 + Math.atan2(0.26, 1.32);
  sigGroup.add(stayRod);

  // Twin vertical cast hanger saddles suspending the slim signal head below the arm!
  for (const hx of [-1.62, -1.08]) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 14), darkSteelMat);
    clamp.rotation.z = Math.PI / 2;
    clamp.position.set(hx, 4.56, 0);
    sigGroup.add(clamp);

    const dropStem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.055), darkSteelMat);
    dropStem.position.set(hx, 4.44, 0);
    sigGroup.add(dropStem);
  }

  // Slim Powder-Coated Cast Aluminum 3-Lens Vehicle Signal Head (Green - Amber - Red)
  const sigCenterY = 4.19;
  const sigHousing = inkMesh(new RoundedBoxGeometry(1.10, 0.34, 0.19, 2, 0.022), signalMetalMat, {
    edges: false,
    hull: true,
    hullThickness: 0.008,
  });
  sigHousing.position.set(-1.35, sigCenterY, 0);
  sigGroup.add(sigHousing);

  // Domed polycarbonate lens cap geometry with flat circular planar UVs matching concentric LED texture
  function createDomedLensGeometry(rimRadius: number): THREE.BufferGeometry {
    const thetaMax = Math.PI * 0.32;
    const sphereR = rimRadius / Math.sin(thetaMax);
    const geo = new THREE.SphereGeometry(sphereR, 24, 12, 0, Math.PI * 2, 0, thetaMax);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -sphereR * Math.cos(thetaMax));
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, 0.5 + pos.getX(i) / (2 * rimRadius), 0.5 + pos.getY(i) / (2 * rimRadius));
    }
    uv.needsUpdate = true;
    return geo;
  }

  // Top-shielded slant-cut tunnel visor geometry wrapping upper 200 degrees cleanly above lens!
  function createSlantVisorGeometry(radius: number, depth: number): THREE.BufferGeometry {
    const geo = new THREE.CylinderGeometry(radius, radius, depth, 24, 1, true, Math.PI * 0.44, Math.PI * 1.12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // Extend top crown slightly further out than lower cheek edge (-z is +Y top after Rx(+PI/2))
      if (y > 0) {
        pos.setY(i, y + Math.max(0, -z / radius) * (depth * 0.28));
      }
    }
    geo.computeVertexNormals();
    geo.rotateX(Math.PI / 2);
    return geo;
  }

  const greenTexPair = createTrafficLedLensTextures('green');
  const amberTexPair = createTrafficLedLensTextures('amber');
  const redTexPair = createTrafficLedLensTextures('red');

  const greenLens = createToonMaterial({
    map: greenTexPair.map,
    emissiveMap: greenTexPair.emissiveMap,
    color: 0xdce6ee,
    emissive: 0x16f2a6,
    emissiveIntensity: 2.0,
    roughness: 0.06,
    wetRim: true,
    wetRimStrength: 0.55,
  });
  const amberLens = createToonMaterial({
    map: amberTexPair.map,
    emissiveMap: amberTexPair.emissiveMap,
    color: 0xdce6ee,
    emissive: 0xffa600,
    emissiveIntensity: 0.02,
    roughness: 0.06,
    wetRim: true,
    wetRimStrength: 0.55,
  });
  const redLens = createToonMaterial({
    map: redTexPair.map,
    emissiveMap: redTexPair.emissiveMap,
    color: 0xdce6ee,
    emissive: 0xff2238,
    emissiveIntensity: 0.02,
    roughness: 0.06,
    wetRim: true,
    wetRimStrength: 0.55,
  });

  const lensSlots = [
    { x: -0.33, mat: greenLens },
    { x: 0.0, mat: amberLens },
    { x: 0.33, mat: redLens },
  ];
  const lensDomeGeo = createDomedLensGeometry(0.112);
  const lensBezelGeo = new THREE.TorusGeometry(0.114, 0.015, 10, 24);
  const visorGeo = createSlantVisorGeometry(0.126, 0.19);

  for (const dir of [1, -1]) {
    const faceGroup = new THREE.Group();
    faceGroup.position.set(-1.35, sigCenterY, dir * 0.096);
    if (dir < 0) faceGroup.rotation.y = Math.PI;

    // White-silver reflective contrast bezel border around the signal face
    const targetRim = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.31, 0.008), signalBackRimMat);
    faceGroup.add(targetRim);

    for (const slot of lensSlots) {
      const chamber = new THREE.Mesh(new THREE.CircleGeometry(0.118, 22), rubberBezelMat);
      chamber.position.set(slot.x, 0, 0.006);
      faceGroup.add(chamber);

      const gasket = new THREE.Mesh(lensBezelGeo, rubberBezelMat);
      gasket.position.set(slot.x, 0, 0.010);
      faceGroup.add(gasket);

      const dome = new THREE.Mesh(lensDomeGeo, slot.mat);
      dome.position.set(slot.x, 0, 0.008);
      faceGroup.add(dome);

      const hood = new THREE.Mesh(visorGeo, signalHoodMat);
      hood.position.set(slot.x, 0, 0.095);
      faceGroup.add(hood);
    }
    sigGroup.add(faceGroup);
  }

  // Japanese Pedestrian Signal Housing ("歩行者用信号灯器") with dual bracket arms & hooded LED pictograms
  const pedX = -0.30;
  const pedY = 2.74;
  for (const by of [2.94, 2.54]) {
    const pArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.30, 12), signalMetalMat);
    pArm.rotation.z = Math.PI / 2;
    pArm.position.set(-0.15, by, 0);
    sigGroup.add(pArm);

    const pBand = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.096, 0.04, 16), darkSteelMat);
    pBand.position.y = by;
    sigGroup.add(pBand);
  }

  const pedBox = inkMesh(new RoundedBoxGeometry(0.26, 0.56, 0.16, 2, 0.018), signalMetalMat, {
    edges: false,
    hull: true,
    hullThickness: 0.008,
  });
  pedBox.position.set(pedX, pedY, 0);
  sigGroup.add(pedBox);

  const pedRedPair = createPedestrianLedTextures('red');
  const pedGreenPair = createPedestrianLedTextures('green');
  const pedRedMat = createToonMaterial({
    map: pedRedPair.map,
    emissiveMap: pedRedPair.emissiveMap,
    color: 0xdce6ee,
    emissive: 0xff2838,
    emissiveIntensity: 0.02,
    roughness: 0.08,
    wetRim: true,
    wetRimStrength: 0.45,
  });
  const pedGreenMat = createToonMaterial({
    map: pedGreenPair.map,
    emissiveMap: pedGreenPair.emissiveMap,
    color: 0xdce6ee,
    emissive: 0x16f4a8,
    emissiveIntensity: 1.75,
    roughness: 0.08,
    wetRim: true,
    wetRimStrength: 0.45,
  });

  for (const dir of [1, -1]) {
    const pedFace = new THREE.Group();
    pedFace.position.set(pedX, pedY, dir * 0.082);
    if (dir < 0) pedFace.rotation.y = Math.PI;

    for (const [cy, mat] of [
      [0.135, pedRedMat],
      [-0.135, pedGreenMat],
    ] as const) {
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.206, 0.206, 0.010), rubberBezelMat);
      bezel.position.set(0, cy, 0.002);
      pedFace.add(bezel);

      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.184, 0.184), mat);
      panel.position.set(0, cy, 0.010);
      pedFace.add(panel);

      // 3-sided pedestrian visor hood (angled top brim + left/right cheeks)
      const hoodTop = new THREE.Mesh(new THREE.BoxGeometry(0.214, 0.012, 0.10), signalHoodMat);
      hoodTop.position.set(0, cy + 0.104, 0.052);
      hoodTop.rotation.x = 0.08;
      pedFace.add(hoodTop);
      for (const sx of [-0.101, 0.101]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.185, 0.085), signalHoodMat);
        cheek.position.set(sx, cy + 0.010, 0.044);
        pedFace.add(cheek);
      }
    }
    sigGroup.add(pedFace);
  }

  group.add(sigGroup);

  // =========================================================================
  // 9. FREESTANDING KONBINI PYLON SIGN ("路边便利店立柱灯箱")
  // =========================================================================
  const pylonTex = createPylonSignTexture();
  const pylonGroup = new THREE.Group();
  pylonGroup.position.set(-8.55, Y_SW, 3.88);

  const pylonPost = inkMesh(new THREE.CylinderGeometry(0.11, 0.13, 4.65, 10), darkSteelMat);
  pylonPost.position.y = 2.325;
  pylonGroup.add(pylonPost);

  const pylonMat = createToonMaterial({
    map: pylonTex,
    emissive: 0xfff8ea,
    emissiveMap: pylonTex,
    emissiveIntensity: 0.55,
  });
  const pylonCabinet = inkMesh(new THREE.BoxGeometry(0.95, 1.88, 0.22), darkSteelMat);
  pylonCabinet.position.set(0.38, 3.75, 0);
  pylonGroup.add(pylonCabinet);

  for (const fz of [-0.115, 0.115]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.8), pylonMat);
    face.position.set(0.38, 3.75, fz);
    if (fz < 0) face.rotation.y = Math.PI;
    pylonGroup.add(face);
  }
  group.add(pylonGroup);

  // =========================================================================
  // 10. ALLEY ENTRANCE, BLOCK WALL, AC UNITS & BULLETIN BOARD
  //     ("小巷入口、空调外机、小型公告栏或海报栏")
  // =========================================================================
  const blockTex = createConcreteBlockTexture();
  const blockWallMat = createToonMaterial({
    map: blockTex,
    color: 0xaab7cc,
    wetRim: true,
    wetRimStrength: 0.24,
  });
  const cedarWoodMat = createToonMaterial({ color: 0x5c3d28, wetRim: true });

  // Alley left boundary concrete block wall (X = -5.36, Z in [-8.6, +0.62])
  const alleyWallSide = inkMesh(new THREE.BoxGeometry(0.22, 1.62, 9.22), blockWallMat);
  alleyWallSide.position.set(-5.36, Y_SW + 0.81, -3.99);
  group.add(alleyWallSide);

  // Cedar wood slat topper along alley wall
  const woodFenceTop = inkMesh(new THREE.BoxGeometry(0.12, 0.36, 9.18), cedarWoodMat);
  woodFenceTop.position.set(-5.36, Y_SW + 1.8, -3.99);
  group.add(woodFenceTop);

  // Front courtyard wall facing parking space (Z = +0.58, X in [-8.75, -5.36])
  const alleyWallFront = inkMesh(new THREE.BoxGeometry(3.42, 1.38, 0.22), blockWallMat);
  alleyWallFront.position.set(-7.05, Y_SW + 0.69, 0.58);
  group.add(alleyWallFront);

  // Warm Frosted Alleyway Gate Lamp right at the Alley Entrance pillar (-5.36, +0.62)!
  const gatePillar = inkMesh(new THREE.BoxGeometry(0.34, 1.95, 0.34), blockWallMat);
  gatePillar.position.set(-5.36, Y_SW + 0.975, 0.6);
  group.add(gatePillar);

  const alleyLantern = inkMesh(
    new THREE.BoxGeometry(0.22, 0.26, 0.22),
    createToonMaterial({
      color: 0xffe8b5,
      emissive: 0xffb347,
      emissiveIntensity: 1.35,
    })
  );
  alleyLantern.position.set(-5.36, Y_SW + 2.08, 0.6);
  group.add(alleyLantern);

  const lanternRoof = inkMesh(new THREE.ConeGeometry(0.21, 0.12, 4), darkSteelMat);
  lanternRoof.rotation.y = Math.PI / 4;
  lanternRoof.position.set(-5.36, Y_SW + 2.26, 0.6);
  group.add(lanternRoof);

  // Traditional Japanese tiled low garden eave & wet greenery/hydrangeas behind courtyard wall
  const kawaraTex = createKawaraRoofTexture();
  const kawaraTileMat = createToonMaterial({
    map: kawaraTex,
    color: 0xb2c2de,
    wetRim: true,
    wetRimStrength: 0.42,
  });
  const neighborCottage = inkMesh(
    new THREE.BoxGeometry(2.85, 2.55, 5.4),
    createToonMaterial({ color: 0xd8d0c1, wetRim: true })
  );
  neighborCottage.position.set(-7.35, Y_SW + 1.275, -4.6);
  group.add(neighborCottage);

  // Softly glowing frosted warm shoji/curtain window on neighbor house (no people, pure mood!)
  const cozyWin = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.78),
    createToonMaterial({
      color: 0xffdfa0,
      emissive: 0xffae42,
      emissiveIntensity: 0.82,
    })
  );
  cozyWin.rotation.y = Math.PI / 2;
  cozyWin.position.set(-5.91, Y_SW + 1.68, -3.4);
  group.add(cozyWin);

  // Refined pitched Japanese kawara gable roof with overhanging eaves & ridge beam
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-1.72, 0);
  gableShape.lineTo(0, 0.88);
  gableShape.lineTo(1.72, 0);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: 5.88,
    bevelEnabled: false,
  });
  const gPos = gableGeo.attributes.position;
  const gUv = gableGeo.attributes.uv;
  for (let i = 0; i < gPos.count; i++) {
    gUv.setXY(i, gPos.getZ(i) / 5.88, Math.abs(gPos.getX(i)) / 1.72);
  }
  gUv.needsUpdate = true;
  const gableRoof = inkMesh(gableGeo, kawaraTileMat, { subtle: true });
  gableRoof.position.set(-7.35, Y_SW + 2.52, -7.54);
  group.add(gableRoof);

  const ridgeBeam = inkMesh(
    new THREE.BoxGeometry(0.18, 0.14, 5.98),
    createToonMaterial({ color: 0x3b4963, wetRim: true })
  );
  ridgeBeam.position.set(-7.35, Y_SW + 3.42, -4.6);
  group.add(ridgeBeam);

  // =========================================================================
  // 11. SWAYING JAPANESE KONBINI NOBORI BANNERS ("のぼり旗" おでん & 夜珈琲)
  // =========================================================================
  const noboriUniforms = { uTime: { value: 0 } };
  const [odenFlagTex, coffeeFlagTex] = createNoboriFlagTextures();
  const ballastMat = createToonMaterial({ color: 0xd0dae8, wetRim: true });

  function addNoboriBanner(
    x: number,
    z: number,
    rotY: number,
    tex: THREE.CanvasTexture,
    phase: number
  ) {
    const ng = new THREE.Group();
    ng.position.set(x, Y_SW, z);
    ng.rotation.y = rotY;

    // Sculpted 2-tier chamfered plastic water-weighted ballast stand + filler cap + mast socket
    const baseTank = inkMesh(new RoundedBoxGeometry(0.34, 0.09, 0.34, 2, 0.025), ballastMat, {
      edges: false,
      hull: true,
    });
    baseTank.position.y = 0.045;
    ng.add(baseTank);

    const baseShoulder = inkMesh(
      new THREE.CylinderGeometry(0.08, 0.15, 0.09, 18),
      ballastMat,
      { edges: false, subtle: true }
    );
    baseShoulder.position.y = 0.13;
    ng.add(baseShoulder);

    const mastCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.08, 16), whiteEnamelMat);
    mastCollar.position.set(0, 0.175, 0);
    ng.add(mastCollar);

    const fillerCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.025, 14),
      createToonMaterial({ color: 0x1b88d9, wetRim: true })
    );
    fillerCap.position.set(0.095, 0.098, 0.095);
    ng.add(fillerCap);

    // Smooth white vertical pole rising straight from water-tank center socket + top finial + arm + mounting loops
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 2.05, 16), whiteEnamelMat);
    pole.position.set(0, 1.06, 0);
    ng.add(pole);

    const topFinial = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), whiteEnamelMat);
    topFinial.position.set(0, 2.09, 0);
    ng.add(topFinial);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.48, 12), whiteEnamelMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.24, 2.02, 0);
    ng.add(arm);

    for (const ly of [0.85, 1.15, 1.48, 1.82]) {
      const chichi = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 8, 16), whiteEnamelMat);
      chichi.rotation.x = Math.PI / 2;
      chichi.position.set(0.01, ly, 0);
      ng.add(chichi);
    }
    for (const lx of [0.08, 0.24, 0.40]) {
      const topLoop = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0045, 8, 16), whiteEnamelMat);
      topLoop.rotation.y = Math.PI / 2;
      topLoop.position.set(lx, 2.01, 0);
      ng.add(topLoop);
    }

    // Subdivided cloth banner with gentle wind ripple shader
    const flagGeo = new THREE.PlaneGeometry(0.44, 1.32, 8, 18);
    const flagMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: noboriUniforms.uTime,
        uTex: { value: tex },
        uPhase: { value: phase },
      },
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Attached along left edge (uv.x == 0) and top edge (uv.y == 1)
          float freeX = clamp(uv.x, 0.0, 1.0);
          float freeY = clamp(1.0 - uv.y, 0.0, 1.0);
          float swayAmt = freeX * (0.35 + 0.65 * freeY);
          float wave = sin(uTime * 2.8 + uPhase + p.y * 3.4 - p.x * 2.2) * 0.065
                     + cos(uTime * 1.7 + uPhase * 0.7) * 0.025;
          p.z += wave * swayAmt;
          p.x += sin(uTime * 2.1 + uPhase + p.y * 2.0) * 0.018 * swayAmt;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec2 vUv;
        void main() {
          vec3 col = texture2D(uTex, vUv).rgb;
          // Subtle warm night illumination so banner reads vividly without blowing out
          gl_FragColor = vec4(col * 0.92, 1.0);
        }
      `,
    });

    const cloth = new THREE.Mesh(flagGeo, flagMat);
    cloth.position.set(0.24, 1.32, 0);
    ng.add(cloth);
    group.add(ng);
  }

  // Oden banner near front-left sidewalk edge, Night-Coffee banner along right sidewalk facing street!
  addNoboriBanner(-0.55, 3.65, 0.25, odenFlagTex, 0.4);
  addNoboriBanner(4.65, -1.65, Math.PI / 2 - 0.22, coffeeFlagTex, 2.3);

  // Wet lush shrubs & rainy-night Hydrangea garden beds ("紫陽花") firmly grounded on courtyard & alley!
  const foliageMat = createToonMaterial({
    color: 0x265c4a,
    wetRim: true,
    wetRimColor: 0x7bd4ff,
    wetRimStrength: 0.3,
  });
  const foliageLightMat = createToonMaterial({
    color: 0x34755d,
    wetRim: true,
    wetRimColor: 0x8be0ff,
    wetRimStrength: 0.28,
  });
  const hydrangeaBlueMat = createToonMaterial({ color: 0x6ea8ff, wetRim: true });
  const hydrangeaVioletMat = createToonMaterial({ color: 0xa78bfa, wetRim: true });
  const soilMat = createToonMaterial({ color: 0x2c221b, wetRim: true });
  const gardenStoneMat = createToonMaterial({ color: 0x647287, wetRim: true });
  const potMat = createToonMaterial({ color: 0x8f523a, wetRim: true });

  // Stone-edged courtyard raised garden beds resting directly on alleyPad (Y_SW)
  function addGardenBed(cx: number, cz: number, w: number, d: number) {
    const border = inkMesh(new THREE.BoxGeometry(w, 0.14, d), gardenStoneMat, { subtle: true });
    border.position.set(cx, Y_SW + 0.07, cz);
    group.add(border);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.14, 0.15, d - 0.14), soilMat);
    soil.position.set(cx, Y_SW + 0.08, cz);
    group.add(soil);
  }

  addGardenBed(-6.6, -0.82, 2.15, 2.38);
  addGardenBed(-6.45, -7.85, 1.85, 1.45);

  function addGroundedHydrangea(sx: number, baseY: number, sz: number, rad: number, seed: number) {
    // Cluster of 4 overlapping flattened foliage mounds seated into the soil
    const offsets = [
      [0, 0, 1.0],
      [-rad * 0.42, rad * 0.28, 0.72],
      [rad * 0.4, -rad * 0.26, 0.75],
      [rad * 0.12, rad * 0.44, 0.68],
    ];
    offsets.forEach(([ox, oz, sc], idx) => {
      const r = rad * sc;
      const mound = inkMesh(
        new THREE.DodecahedronGeometry(r, 1),
        idx % 2 === 0 ? foliageMat : foliageLightMat,
        { edges: false, hull: true, hullThickness: 0.012 }
      );
      mound.scale.set(1.08, 0.74, 1.08);
      mound.position.set(sx + ox, baseY + r * 0.36, sz + oz);
      group.add(mound);
    });

    // 5 soft rounded hydrangea blossom clusters nestled into upper foliage
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2 + seed * 0.9;
      const dist = rad * (0.28 + (b % 2) * 0.22);
      const bloom = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rad * 0.24, 1),
        (seed + b) % 2 === 0 ? hydrangeaBlueMat : hydrangeaVioletMat
      );
      bloom.position.set(
        sx + Math.cos(ang) * dist,
        baseY + rad * 0.64 + (b % 2) * 0.05,
        sz + Math.sin(ang) * dist
      );
      group.add(bloom);
    }
  }

  const soilSurfaceY = Y_SW + 0.15;
  addGroundedHydrangea(-6.1, soilSurfaceY, -0.22, 0.46, 0);
  addGroundedHydrangea(-6.95, soilSurfaceY, -0.78, 0.52, 1);
  addGroundedHydrangea(-6.05, soilSurfaceY, -1.48, 0.48, 2);
  addGroundedHydrangea(-6.25, soilSurfaceY, -7.85, 0.50, 3);

  // Ceramic potted hydrangea sitting firmly on the alley ground (Y = 0)
  const potGroup = new THREE.Group();
  potGroup.position.set(-5.05, 0.0, -0.58);
  const pot = inkMesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 12), potMat, { subtle: true });
  pot.position.y = 0.17;
  potGroup.add(pot);
  const potRim = inkMesh(new THREE.CylinderGeometry(0.26, 0.25, 0.05, 12), potMat, { subtle: true });
  potRim.position.y = 0.32;
  potGroup.add(potRim);
  const potSoil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), soilMat);
  potSoil.position.y = 0.33;
  potGroup.add(potSoil);
  group.add(potGroup);
  addGroundedHydrangea(-5.05, 0.34, -0.58, 0.26, 4);

  // ROOFED COMMUNITY BULLETIN BOARD ("小型公告栏或海报栏") at (-6.95, Y_SW, +0.76) facing +Z!
  const bbTex = loadPublicTexture('/textures/bulletin_board.jpg');
  const bbGroup = new THREE.Group();
  bbGroup.position.set(-6.95, Y_SW, 0.78);

  for (const lx of [-0.68, 0.68]) {
    const post = inkMesh(new THREE.BoxGeometry(0.08, 1.85, 0.08), cedarWoodMat);
    post.position.set(lx, 0.925, 0);
    bbGroup.add(post);
  }

  const bbFrame = inkMesh(new THREE.BoxGeometry(1.48, 0.96, 0.1), cedarWoodMat);
  bbFrame.position.set(0, 1.32, 0.02);
  bbGroup.add(bbFrame);

  const bbFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 0.84),
    createToonMaterial({
      map: bbTex,
      emissive: 0xffe5b8,
      emissiveMap: bbTex,
      emissiveIntensity: 0.24,
    })
  );
  bbFace.position.set(0, 1.32, 0.075);
  bbGroup.add(bbFace);

  // Green tin rain hood over bulletin board + warm fluorescent tube
  const bbRoof = inkMesh(
    new THREE.BoxGeometry(1.64, 0.06, 0.38),
    createToonMaterial({ color: 0x266e58, wetRim: true, wetRimStrength: 0.35 })
  );
  bbRoof.position.set(0, 1.86, 0.08);
  bbRoof.rotation.x = 0.22;
  bbGroup.add(bbRoof);

  const bbLight = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.03, 0.04),
    createToonMaterial({ color: 0xfff3d6, emissive: 0xffcf75, emissiveIntensity: 1.3 })
  );
  bbLight.position.set(0, 1.8, 0.16);
  bbGroup.add(bbLight);

  group.add(bbGroup);
  extraDripPoints.push(new THREE.Vector3(-7.35, Y_SW + 1.82, 0.98));
  extraDripPoints.push(new THREE.Vector3(-6.55, Y_SW + 1.82, 0.98));

  // DOUBLE-STACKED AC OUTDOOR UNITS ("空调外机") on Konbini Left Alley Wall (X = -3.62)
  const acBodyMat = createToonMaterial({
    map: createBrushedMetalTexture(),
    color: 0xded9ce,
    wetRim: true,
    roughness: 0.55,
  });
  function addACUnit(z: number, y: number) {
    const ac = new THREE.Group();
    ac.position.set(-3.84, y, z);

    // Wall mounting steel brackets
    for (const bz of [-0.3, 0.3]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), galvSteelMat);
      bracket.position.set(0.05, -0.28, bz);
      ac.add(bracket);
    }

    const box = inkMesh(new RoundedBoxGeometry(0.36, 0.54, 0.78, 2, 0.025), acBodyMat, {
      edges: false,
      hull: true,
    });
    ac.add(box);

    // Circular dark fan shroud + protective grille rings + 3D spinning fan blades
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), darkSteelMat);
    shroud.rotation.z = Math.PI / 2;
    shroud.position.set(-0.185, 0, -0.1);
    ac.add(shroud);

    for (const grR of [0.1, 0.16]) {
      const grilleRing = new THREE.Mesh(new THREE.TorusGeometry(grR, 0.006, 8, 24), galvSteelMat);
      grilleRing.rotation.y = Math.PI / 2;
      grilleRing.position.set(-0.202, 0, -0.1);
      ac.add(grilleRing);
    }

    const fanRotor = new THREE.Group();
    fanRotor.position.set(-0.195, 0, -0.1);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.07), galvSteelMat);
      blade.position.set(0, 0.07, 0);
      const pivot = new THREE.Group();
      pivot.rotation.x = (b / 3) * Math.PI * 2;
      pivot.add(blade);
      fanRotor.add(pivot);
    }
    ac.add(fanRotor);
    acFanMeshes.push(fanRotor);

    // Insulated refrigerant pipe curving into wall
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6),
      createToonMaterial({ color: 0xc9beae })
    );
    pipe.position.set(0.1, 0.35, 0.44);
    ac.add(pipe);

    group.add(ac);
  }

  addACUnit(-1.05, 0.88);
  addACUnit(-1.05, 1.66);
  addACUnit(-2.35, 0.88);
  extraDripPoints.push(new THREE.Vector3(-3.98, 0.58, -1.05));

  // Stacked Blue Plastic Beer Crates ("ビールケース") in alley behind AC units
  const crateBlueMat = createToonMaterial({ color: 0x1c64b8, wetRim: true });
  const crateYellowMat = createToonMaterial({ color: 0xd99b26, wetRim: true });
  for (let c = 0; c < 3; c++) {
    const crate = inkMesh(
      new THREE.BoxGeometry(0.38, 0.28, 0.46),
      c === 2 ? crateYellowMat : crateBlueMat
    );
    crate.position.set(-3.86, Y_SW + 0.14 + c * 0.28, -3.35);
    crate.rotation.y = (c - 1) * 0.06;
    group.add(crate);
  }

  return {
    group,
    acFanMeshes,
    trafficSignal: {
      greenLens,
      amberLens,
      redLens,
      pedRedMat,
      pedGreenMat,
    },
    extraFlickerMaterials,
    extraDripPoints,
    noboriUniforms,
    updateMirrorReflection,
  };
}
