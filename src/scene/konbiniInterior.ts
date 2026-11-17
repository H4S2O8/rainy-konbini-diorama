import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createToonMaterial, inkMesh } from '../materials/toonMaterials';
import {
  createBackroomDoorTexture,
  createBeverageLabelPrintTexture,
  createCabinetPanelTexture,
  createCategoryLightboxTexture,
  createCigaretteAtlasTexture,
  createCounterUiAtlasTexture,
  createCounterWoodTexture,
  createCupNoodleLabelTexture,
  createFreezerGlassTexture,
  createFreezerHeaderTexture,
  createFreezerTempTexture,
  createIceCreamAtlasTexture,
  createInteriorFloorTexture,
  createPegboardTexture,
  createPopWobblerTexture,
  createPriceRailTexture,
  createQuadAtlasBoxGeometry,
  createQueueDecalTexture,
  createSnackBoxPrintTexture,
  createSnackPouchPrintTexture,
  cropGeometryUv,
  loadPublicTexture,
} from '../textures/proceduralTextures';

export interface KonbiniInteriorResult {
  group: THREE.Group;
  clutterGroup: THREE.Group;
  steamSprites: THREE.Mesh[];
}

interface InstanceSpec {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  quad?: number;
}

/** High-subdivision puffed foil chip pouch with accordion heat-seal crimps & soft pillow swell. */
function createChipPouchGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1, 6, 16, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = y + 0.5;
    const isSeal = ny < 0.13 || ny > 0.87;
    const seamThick = isSeal
      ? 0.09 + 0.025 * Math.sin(z * 48.0)
      : 0.22 + 0.90 * Math.pow(Math.sin(ny * Math.PI), 0.78);
    const zEdgeTaper = 1.0 - 0.36 * Math.pow(Math.abs(z) * 2.0, 2);
    const gussetPinch = isSeal ? 1.0 : 1.0 - 0.08 * Math.exp(-Math.pow((ny - 0.5) * 4.0, 2));
    pos.setX(i, x * seamThick * zEdgeTaper);
    pos.setZ(i, z * (isSeal ? 1.04 : 1.0) * gussetPinch);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Smooth 20-segment lathe cup-noodle tub with stepped base, slight rib taper & rolled curl lip. */
function createCupNoodleGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.36, -0.49),
    new THREE.Vector2(0.38, -0.43),
    new THREE.Vector2(0.41, -0.1),
    new THREE.Vector2(0.46, 0.22),
    new THREE.Vector2(0.49, 0.42),
    new THREE.Vector2(0.52, 0.46),
    new THREE.Vector2(0.50, 0.5),
    new THREE.Vector2(0.46, 0.48),
    new THREE.Vector2(0.0, 0.475),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

/** Smooth 20-segment Japanese beverage aluminum can with bottom chime & tapered neck flange. */
function createCanGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.41, -0.49),
    new THREE.Vector2(0.49, -0.42),
    new THREE.Vector2(0.50, 0.34),
    new THREE.Vector2(0.43, 0.45),
    new THREE.Vector2(0.46, 0.5),
    new THREE.Vector2(0.41, 0.48),
    new THREE.Vector2(0.0, 0.46),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

/** Smooth 20-segment tapered parfait / pudding dessert glass cup with delicate pedestal ring. */
function createDessertCupGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.38, -0.49),
    new THREE.Vector2(0.30, -0.40),
    new THREE.Vector2(0.34, -0.25),
    new THREE.Vector2(0.44, 0.08),
    new THREE.Vector2(0.50, 0.46),
    new THREE.Vector2(0.47, 0.5),
    new THREE.Vector2(0.42, 0.42),
    new THREE.Vector2(0.0, 0.36),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

/** Fluted piped whipped cream swirl cone with star-tip spiral ridges for parfaits. */
function createWhippedCreamGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.5, 1.0, 20, 8, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // [-0.5 .. 0.5]
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.001) {
      const ang = Math.atan2(z, x);
      const ny = y + 0.5;
      const flute = 1.0 + 0.16 * Math.sin(ang * 6.0 + ny * 8.5);
      const swell = Math.sin(ny * Math.PI * 0.85) * 0.14;
      const scale = flute + swell;
      pos.setX(i, x * scale);
      pos.setZ(i, z * scale);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Sculpted 1L gabled paper carton (milk / tea / juice) with V-folded side gussets & top crimp. */
function createGabledCartonGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1, 4, 8, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    let xScale = 1.0;
    let zScale = 1.0;
    if (y > 0.39) {
      xScale = 0.10;
    } else if (y > 0.16) {
      const t = (y - 0.16) / 0.23;
      xScale = 1.0 - t * 0.90;
      zScale = 1.0 - t * 0.06 * Math.max(0, 1 - Math.abs(x) * 2.0);
    }
    pos.setX(i, x * xScale);
    pos.setZ(i, z * zScale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Contoured 20-segment PET beverage bottle with grip ribs, rounded shoulder & neck collar ring. */
function createPetBottleBodyGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.45, -0.49),
    new THREE.Vector2(0.50, -0.42),
    new THREE.Vector2(0.50, -0.18),
    new THREE.Vector2(0.43, -0.09),
    new THREE.Vector2(0.47, -0.02),
    new THREE.Vector2(0.43, 0.05),
    new THREE.Vector2(0.50, 0.14),
    new THREE.Vector2(0.48, 0.24),
    new THREE.Vector2(0.32, 0.37),
    new THREE.Vector2(0.21, 0.42),
    new THREE.Vector2(0.26, 0.445),
    new THREE.Vector2(0.21, 0.46),
    new THREE.Vector2(0.20, 0.5),
    new THREE.Vector2(0.0, 0.5),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

/** Wide flared Japanese Donbei udon / ramen soup bowl (distinct from tall cup noodles). */
function createWideBowlGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.28, -0.49),
    new THREE.Vector2(0.32, -0.32),
    new THREE.Vector2(0.45, 0.14),
    new THREE.Vector2(0.50, 0.42),
    new THREE.Vector2(0.53, 0.47),
    new THREE.Vector2(0.49, 0.50),
    new THREE.Vector2(0.0, 0.48),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

/** Squared craft tea/coffee PET bottle (Craft Boss style) tapering to threaded neck. */
function createSquareBottleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1, 4, 8, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = y + 0.5;
    let s = 1.0;
    if (ny > 0.72) {
      const t = (ny - 0.72) / 0.28;
      s = Math.max(0.26, 1.0 - t * 0.76);
    } else if (ny > 0.35 && ny < 0.55) {
      s = 0.92;
    }
    // Soft rounded corners
    const cornerRound = 1.0 - 0.14 * Math.pow(Math.abs(x * z) * 4.0, 1.2);
    pos.setX(i, x * s * cornerRound);
    pos.setZ(i, z * s * cornerRound);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Tall slender 250ml energy-drink aluminum can silhouette. */
function createEnergyCanGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.5),
    new THREE.Vector2(0.34, -0.49),
    new THREE.Vector2(0.38, -0.44),
    new THREE.Vector2(0.39, 0.38),
    new THREE.Vector2(0.34, 0.46),
    new THREE.Vector2(0.36, 0.50),
    new THREE.Vector2(0.0, 0.48),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

/** Bagged sliced Shokupan milk-bread loaf with gathered twist-tie neck peak. */
function createBakeryLoafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1, 4, 8, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = y + 0.5;
    let sx = 1.0;
    let sz = 1.0;
    if (ny > 0.84) {
      const t = (ny - 0.84) / 0.16;
      sx = 0.35 + Math.abs(t - 0.35) * 0.65;
      sz = 0.35 + Math.abs(t - 0.35) * 0.55;
    } else if (ny > 0.64) {
      const t = (ny - 0.64) / 0.2;
      sx = 1.0 - t * 0.65;
      sz = 1.0 - t * 0.65;
    }
    pos.setX(i, x * sx);
    pos.setZ(i, z * sz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Domed sweet bakery bun / Melonpan silhouette. */
function createPastryBunGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0, -0.45),
    new THREE.Vector2(0.46, -0.45),
    new THREE.Vector2(0.50, -0.18),
    new THREE.Vector2(0.45, 0.15),
    new THREE.Vector2(0.28, 0.38),
    new THREE.Vector2(0.0, 0.46),
  ];
  return new THREE.LatheGeometry(pts, 16);
}

/** Smooth rounded triangular prism for authentic upright Japanese onigiri & sandos. */
function createOnigiriPrismGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = 0.46;
  shape.moveTo(-r * 0.85, -0.34);
  shape.quadraticCurveTo(0, -0.44, r * 0.85, -0.34);
  shape.quadraticCurveTo(r * 1.05, -0.26, r * 0.88, -0.02);
  shape.lineTo(0.16, 0.4);
  shape.quadraticCurveTo(0, 0.52, -0.16, 0.4);
  shape.lineTo(-r * 0.88, -0.02);
  shape.quadraticCurveTo(-r * 1.05, -0.26, -r * 0.85, -0.34);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.72,
    curveSegments: 8,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.05,
    bevelThickness: 0.05,
  });
  geo.center();
  return geo;
}

export function createKonbiniInterior(): KonbiniInteriorResult {
  const group = new THREE.Group();
  group.name = 'KonbiniInterior';

  // High-res 2D graphic design elements & multi-brand packaging atlases
  const postersGridTex = loadPublicTexture('/textures/konbini_posters_grid.jpg');
  const counterMenuTex = loadPublicTexture('/textures/counter_menu_strip.jpg');
  const magGridTex = loadPublicTexture('/textures/magazine_covers_grid.jpg');
  const cupNoodleTex = createCupNoodleLabelTexture();
  const pouchPrintTex = createSnackPouchPrintTexture();
  const snackBoxTex = createSnackBoxPrintTexture();
  const bevLabelTex = createBeverageLabelPrintTexture();
  const priceRailTex = createPriceRailTexture();
  const pegboardTex = createPegboardTexture();
  const popWobblerTex = createPopWobblerTexture();
  const iceAtlasTex = createIceCreamAtlasTexture();
  const cigAtlasTex = createCigaretteAtlasTexture();
  const counterUiTex = createCounterUiAtlasTexture();

  // High-detail sculpted 3D merchandise batched via InstancedMesh (hidden in puddle reflection)
  const clutterGroup = new THREE.Group();
  clutterGroup.name = 'KonbiniClutter';
  group.add(clutterGroup);

  const boxSpecs: InstanceSpec[] = [];
  const packedBoxSpecs: InstanceSpec[] = [];
  const cigPackSpecs: InstanceSpec[] = [];
  const iceBoxSpecs: InstanceSpec[] = [];
  const icePouchSpecs: InstanceSpec[] = [];
  const iceCupSpecs: InstanceSpec[] = [];
  const cylSpecs: InstanceSpec[] = [];
  const cupNoodleSpecs: InstanceSpec[] = [];
  const wideBowlSpecs: InstanceSpec[] = [];
  const pouchSpecs: InstanceSpec[] = [];
  const cartonSpecs: InstanceSpec[] = [];
  const petSpecs: InstanceSpec[] = [];
  const sqBottleSpecs: InstanceSpec[] = [];
  const canSpecs: InstanceSpec[] = [];
  const energyCanSpecs: InstanceSpec[] = [];
  const loafSpecs: InstanceSpec[] = [];
  const bunSpecs: InstanceSpec[] = [];
  const bevWrapSpecs: InstanceSpec[] = [];
  const dessertCupSpecs: InstanceSpec[] = [];
  const whipSpecs: InstanceSpec[] = [];
  const onigiriTriSpecs: InstanceSpec[] = [];
  const magCoverSpecs: InstanceSpec[] = [];
  const popWobblerSpecs: InstanceSpec[] = [];
  const clearDividerSpecs: InstanceSpec[] = [];
  const metalHardwareSpecs: InstanceSpec[] = [];

  const Y0 = 0.16; // Interior floor level

  // =========================================================================
  // 1. WARM GLOSSY FLOOR & QUEUE GUIDE DECALS ("地面导视")
  // =========================================================================
  const floorTex = createInteriorFloorTexture();
  const floorMat = createToonMaterial({
    map: floorTex,
    color: 0xf7e7cf,
    emissive: 0xffd79c,
    emissiveIntensity: 0.14,
    interior: true,
  });

  const floorShape = new THREE.Shape();
  floorShape.moveTo(-3.42, 4.42);
  floorShape.lineTo(3.6, 4.42);
  floorShape.lineTo(3.6, 0.22);
  floorShape.lineTo(1.78, -1.62);
  floorShape.lineTo(-3.42, -1.62);
  floorShape.closePath();

  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.02, bevelEnabled: false });
  floorGeo.rotateX(-Math.PI / 2);
  const posAttr = floorGeo.attributes.position;
  const uvAttr = floorGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    uvAttr.setXY(i, (posAttr.getX(i) + 3.5) / 7.2, (posAttr.getZ(i) + 4.5) / 6.4);
  }
  uvAttr.needsUpdate = true;

  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = Y0;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Queue floor guide decal in front of checkout counter
  const queueTex = createQueueDecalTexture();
  const queueMat = new THREE.MeshBasicMaterial({
    map: queueTex,
    transparent: true,
    depthWrite: false,
  });
  const queueDecal1 = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.34), queueMat);
  queueDecal1.rotation.x = -Math.PI / 2;
  queueDecal1.position.set(-1.38, Y0 + 0.024, 0.38);
  group.add(queueDecal1);

  const queueDecal2 = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.28), queueMat);
  queueDecal2.rotation.x = -Math.PI / 2;
  queueDecal2.position.set(-1.38, Y0 + 0.024, -0.45);
  group.add(queueDecal2);

  // =========================================================================
  // 2. LUMINOUS WARM CEILING GRID & HANGING CATEGORY LIGHTBOXES ("店内灯箱")
  // =========================================================================
  const ceilingMat = createToonMaterial({
    color: 0xfff8ea,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.42,
    interior: true,
    side: THREE.DoubleSide,
  });
  const ceilingPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.05, 6.05), ceilingMat);
  ceilingPlane.rotation.x = Math.PI / 2;
  ceilingPlane.position.set(0.08, 2.76, -1.4);
  group.add(ceilingPlane);

  const ledPanelMat = createToonMaterial({
    color: 0xffffff,
    emissive: 0xfff0cc,
    emissiveIntensity: 0.92,
    interior: true,
  });
  for (const lx of [-2.2, -0.5, 1.2, 2.6]) {
    for (const lz of [-3.3, -1.7, -0.1, 1.05]) {
      // Skip chamfer exterior corner
      if (lx > 2.1 && lz > 0.4) continue;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 0.28), ledPanelMat);
      panel.position.set(lx, 2.74, lz);
      group.add(panel);
    }
  }

  // Hanging Aisle Category Lightboxes ("店内灯箱")
  const lightboxDefs = [
    { x: -1.85, z: -0.55, ry: Math.PI / 2, jp: 'レジ・おでん・珈琲', en: 'COUNTER & HOT FOOD', col: '#ff7838' },
    { x: -0.95, z: -3.55, ry: 0, jp: 'お弁当・おにぎり', en: 'FRESH BENTO & ONIGIRI', col: '#20b67e' },
    { x: 1.85, z: -3.55, ry: 0, jp: 'ドリンク・お酒', en: 'CHILLED DRINKS & BEER', col: '#189be8' },
    { x: 2.85, z: -2.85, ry: -Math.PI / 2, jp: 'ATM・宅配ロッカー', en: 'LOCKERS & SERVICE', col: '#8b5cf6' },
  ];
  const rodMat = createToonMaterial({ color: 0x9aa5b5, interior: true });

  for (const lb of lightboxDefs) {
    const tex = createCategoryLightboxTexture(lb.jp, lb.en, lb.col);
    const mat = createToonMaterial({
      map: tex,
      emissive: 0xfff6e5,
      emissiveMap: tex,
      emissiveIntensity: 0.85,
      interior: true,
    });
    const box = inkMesh(new THREE.BoxGeometry(1.28, 0.3, 0.07), mat, { interior: true });
    box.position.set(lb.x, 2.36, lb.z);
    box.rotation.y = lb.ry;
    group.add(box);

    for (const dx of [-0.45, 0.45]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), rodMat);
      wire.position.set(
        lb.x + Math.cos(lb.ry) * dx,
        2.58,
        lb.z - Math.sin(lb.ry) * dx
      );
      group.add(wire);
    }
  }

  // =========================================================================
  // 3. CHECKOUT COUNTER + POS + COFFEE MACHINE + ODEN COUNTER ("收银台/咖啡机/关东煮")
  // =========================================================================
  const counterWoodTex = createCounterWoodTexture();
  const cabinetPanelTex = createCabinetPanelTexture();
  const woodCounterMat = createToonMaterial({
    map: counterWoodTex,
    color: 0xffffff,
    roughness: 0.82,
    interior: true,
  });
  const creamCabinetMat = createToonMaterial({
    map: cabinetPanelTex,
    color: 0xf7efe0,
    roughness: 0.65,
    interior: true,
  });
  const counterTopMat = createToonMaterial({ color: 0xfffaf0, roughness: 0.42, interior: true });
  const darkMetalMat = createToonMaterial({ color: 0x2b3342, roughness: 0.45, interior: true });
  const stainlessMat = createToonMaterial({ color: 0xcbd4e0, roughness: 0.25, interior: true });
  const clearAcrylicMat = createToonMaterial({
    color: 0xdff2ff,
    emissive: 0x8ac8f5,
    emissiveIntensity: 0.14,
    transparent: true,
    opacity: 0.28,
    roughness: 0.12,
    interior: true,
  });

  // Main Checkout Counter along left side (X = -2.23, Z in [-1.88, +0.84], facing +X!)
  const Y_CT = Y0 + 0.93;
  const counterPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.08, 2.58), darkMetalMat);
  counterPlinth.position.set(-2.27, Y0 + 0.04, -0.52);
  group.add(counterPlinth);

  const counterBase = inkMesh(new RoundedBoxGeometry(0.76, 0.80, 2.64, 2, 0.022), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  counterBase.position.set(-2.25, Y0 + 0.48, -0.52);
  group.add(counterBase);

  const woodFront = inkMesh(new RoundedBoxGeometry(0.05, 0.74, 2.56, 2, 0.014), woodCounterMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  woodFront.position.set(-1.85, Y0 + 0.47, -0.52);
  group.add(woodFront);

  // Customer Stainless Bag-Rest Rail along front wood counter face
  const bagRail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.38, 12), stainlessMat);
  bagRail.rotation.x = Math.PI / 2;
  bagRail.position.set(-1.77, Y0 + 0.72, -0.52);
  group.add(bagRail);
  for (const bz of [-1.62, -0.88, -0.15, 0.58]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.018), stainlessMat);
    bracket.position.set(-1.81, Y0 + 0.72, bz);
    group.add(bracket);
  }

  const counterTop = inkMesh(new RoundedBoxGeometry(0.86, 0.05, 2.72, 2, 0.018), counterTopMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  counterTop.position.set(-2.23, Y0 + 0.905, -0.52);
  group.add(counterTop);

  // Back-wall behind-counter fixture: 1:1 unstretched 2D menu strip + under-shelf LED + 4x2 textured cigarette rack
  const backRack = inkMesh(new THREE.BoxGeometry(0.34, 2.24, 2.4), creamCabinetMat, {
    interior: true,
  });
  backRack.position.set(-3.21, Y0 + 1.12, -0.6);
  group.add(backRack);

  // counter_menu_strip.jpg (1376x768) cropped region [0.03..0.97] x [0.228..0.772] has 3.096:1 aspect -> 2.34m x 0.756m!
  const menuBoardGeo = cropGeometryUv(new THREE.PlaneGeometry(2.34, 0.756), 0.03, 0.228, 0.97, 0.772);
  const backMenuLightbox = new THREE.Mesh(
    menuBoardGeo,
    createToonMaterial({
      map: counterMenuTex,
      color: 0xffffff,
      emissive: 0xffe4bc,
      emissiveMap: counterMenuTex,
      emissiveIntensity: 0.48,
      interior: true,
    })
  );
  backMenuLightbox.rotation.y = Math.PI / 2;
  backMenuLightbox.position.set(-3.034, Y0 + 1.80, -0.6);
  group.add(backMenuLightbox);

  for (const bz of [-1.79, 0.59]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.24, 0.04), darkMetalMat);
    stile.position.set(-3.03, Y0 + 1.12, bz);
    group.add(stile);
  }
  const menuDivider = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 2.38), darkMetalMat);
  menuDivider.position.set(-3.025, Y0 + 1.40, -0.6);
  group.add(menuDivider);

  const cigLedBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.012, 2.28),
    createToonMaterial({ color: 0xffffff, emissive: 0xfff0cc, emissiveIntensity: 0.65, interior: true })
  );
  cigLedBar.position.set(-2.98, Y0 + 1.38, -0.6);
  group.add(cigLedBar);

  for (let row = 0; row < 5; row++) {
    const sy = Y0 + 0.65 + row * 0.145;
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 2.26), stainlessMat);
    tray.position.set(-3.00, sy, -0.6);
    group.add(tray);

    const priceBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.02, 2.26),
      createToonMaterial({ color: 0xffca28, interior: true })
    );
    priceBar.position.set(-2.928, sy, -0.6);
    group.add(priceBar);

    for (let col = 0; col < 14; col++) {
      const pz = -1.61 + col * 0.155;
      const py = sy + 0.068;
      const qCig = (row * 3 + Math.floor(col / 2)) % 8;
      cigPackSpecs.push({ x: -2.99, y: py, z: pz, rz: -0.08, sx: 0.044, sy: 0.114, sz: 0.116, color: 0xffffff, quad: qCig });
      boxSpecs.push({ x: -2.921, y: sy, z: pz, sx: 0.008, sy: 0.018, sz: 0.072, color: 0xffffff });
    }
  }

  for (let r = 0; r < 6; r++) {
    cylSpecs.push({ x: -2.99, y: Y0 + 0.24, z: -1.45 + r * 0.11, sx: 0.042, sy: 0.085, sz: 0.042, color: 0xfcfaf5 });
  }

  // Shared helper mapping exact UV sub-regions of 1024x512 Counter UI Atlas (1:1 aspect ratio, 0 stretch!)
  const counterUiMat = createToonMaterial({
    map: counterUiTex,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: counterUiTex,
    emissiveIntensity: 0.62,
    interior: true,
  });
  // UV bands matching pixel bounds in createCounterUiAtlasTexture (flipY=true -> v = 1 - y/512)
  const uiRegions: ReadonlyArray<[number, number, number, number]> = [
    [0.004, 0.504, 360 / 1024 - 0.004, 0.996], // 0: POS Screen (360x256 -> 1.406:1)
    [384 / 1024 + 0.004, 0.504, 640 / 1024 - 0.004, 0.996], // 1: IC Pad (256x256 -> 1.000:1)
    [0.004, 0.004, 580 / 1024 - 0.004, 0.496], // 2: Coffee Panel (580x256 -> 2.266:1)
    [600 / 1024 + 0.004, 1 - 346 / 512 + 0.004, 0.996, 0.496], // 3: Hot Case Marquee (424x90 -> 4.711:1)
  ];
  function createCounterUiPlane(regionIdx: number, w: number, h: number): THREE.Mesh {
    const [u0, v0, u1, v1] = uiRegions[regionIdx];
    const geo = cropGeometryUv(new THREE.PlaneGeometry(w, h), u0, v0, u1, v1);
    return new THREE.Mesh(geo, counterUiMat);
  }

  // Station 1 & 2 (Z = -1.52, -0.96): Realistic POS Checkout Terminals, Receipt Printers, IC Tap Pads & Cash Trays
  for (const rz of [-1.52, -0.96]) {
    const posDrawer = inkMesh(new RoundedBoxGeometry(0.36, 0.08, 0.38, 2, 0.012), darkMetalMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    posDrawer.position.set(-2.26, Y_CT + 0.04, rz);
    group.add(posDrawer);

    const drawerHandle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.14), stainlessMat);
    drawerHandle.position.set(-2.445, Y_CT + 0.04, rz);
    group.add(drawerHandle);

    // Chrome dual-monitor neck rising from drawer
    const posStand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.17, 12), stainlessMat);
    posStand.position.set(-2.20, Y_CT + 0.14, rz);
    group.add(posStand);

    // Dual-facing POS display (clerk touchscreen -X + customer display +X!)
    const posMonitor = inkMesh(new RoundedBoxGeometry(0.045, 0.21, 0.28, 2, 0.010), darkMetalMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    posMonitor.position.set(-2.19, Y_CT + 0.26, rz);
    posMonitor.rotation.z = -0.18;
    group.add(posMonitor);

    const custScreen = createCounterUiPlane(0, 0.24, 0.17);
    custScreen.rotation.y = Math.PI / 2;
    custScreen.position.set(0.025, 0, 0);
    posMonitor.add(custScreen);

    const clerkScreen = createCounterUiPlane(0, 0.24, 0.17);
    clerkScreen.rotation.y = -Math.PI / 2;
    clerkScreen.position.set(-0.025, 0, 0);
    posMonitor.add(clerkScreen);

    // Thermal Receipt Printer + emerging paper slip
    const printer = inkMesh(new RoundedBoxGeometry(0.11, 0.09, 0.12, 2, 0.012), darkMetalMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    printer.position.set(-2.26, Y_CT + 0.125, rz + 0.13);
    group.add(printer);
    const receiptSlip = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.055), createToonMaterial({ color: 0xfefcf6, interior: true }));
    receiptSlip.position.set(-2.26, Y_CT + 0.19, rz + 0.13);
    receiptSlip.rotation.z = 0.22;
    group.add(receiptSlip);

    // Contactless IC / Suica / QR Card Tap Reader angled toward customer
    const icReader = inkMesh(new RoundedBoxGeometry(0.11, 0.036, 0.12, 2, 0.010), darkMetalMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    icReader.position.set(-1.94, Y_CT + 0.035, rz + 0.12);
    icReader.rotation.z = -0.38;
    group.add(icReader);
    const icPad = createCounterUiPlane(1, 0.095, 0.095);
    icPad.rotation.x = -Math.PI / 2;
    icPad.position.set(0, 0.020, 0);
    icReader.add(icPad);

    // Blue/Navy Rubber Coin & Cash Tray ("カルトン")
    const cashTray = new THREE.Mesh(
      new RoundedBoxGeometry(0.14, 0.016, 0.19, 2, 0.006),
      createToonMaterial({ color: 0x1e3a8a, interior: true, roughness: 0.72 })
    );
    cashTray.position.set(-1.94, Y_CT + 0.008, rz - 0.10);
    group.add(cashTray);

    // Handheld Barcode Scanner resting in chrome cradle + Acrylic Splash Shield
    const scanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.08, 10), stainlessMat);
    scanBase.position.set(-2.06, Y_CT + 0.04, rz - 0.17);
    group.add(scanBase);
    const scanHead = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.032, 0.035), darkMetalMat);
    scanHead.position.set(-2.04, Y_CT + 0.095, rz - 0.17);
    scanHead.rotation.z = -0.45;
    group.add(scanHead);

    const acrylicScreen = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.36, 0.34), clearAcrylicMat);
    acrylicScreen.position.set(-1.86, Y_CT + 0.22, rz);
    group.add(acrylicScreen);
  }

  // Countertop Donation Box & Mint/Gum Mini-Basket at back POS corner (Z = -1.78)
  const mintBox = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.055, 0.14, 2, 0.008), darkMetalMat);
  mintBox.position.set(-1.93, Y_CT + 0.028, -1.78);
  group.add(mintBox);
  for (let mp = 0; mp < 3; mp++) {
    packedBoxSpecs.push({ x: -1.93, y: Y_CT + 0.068, z: -1.82 + mp * 0.04, sx: 0.08, sy: 0.07, sz: 0.028, color: 0xffffff, quad: mp + 2 });
  }

  // Blue Konbini Shopping Basket Stack positioned cleanly clear of front wood panel
  const basketMat = createToonMaterial({ color: 0x1c7ed6, interior: true });
  for (let b = 0; b < 4; b++) {
    const basket = inkMesh(new THREE.BoxGeometry(0.32, 0.11, 0.44), basketMat, { interior: true });
    basket.position.set(-1.58, Y0 + 0.075 + b * 0.085, 0.66);
    group.add(basket);
  }

  // Station 3 (Z = -0.38): Framed Glass Hot Snack & Nikuman Showcase ("ホットスナック・肉まん")
  const hotGroup = new THREE.Group();
  hotGroup.position.set(-2.14, Y_CT, -0.38);

  const hcBase = inkMesh(new RoundedBoxGeometry(0.38, 0.06, 0.44, 2, 0.012), stainlessMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  hcBase.position.y = 0.03;
  hotGroup.add(hcBase);

  const hcTop = inkMesh(new RoundedBoxGeometry(0.38, 0.105, 0.44, 2, 0.012), darkMetalMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  hcTop.position.y = 0.43;
  hotGroup.add(hcTop);

  // Exact 4.71:1 marquee banner on customer +X top bezel (0.40 x 0.085 -> 0 stretch!)
  const hcMarquee = createCounterUiPlane(3, 0.40, 0.085);
  hcMarquee.rotation.y = Math.PI / 2;
  hcMarquee.position.set(0.193, 0.43, 0);
  hotGroup.add(hcMarquee);

  // Warm golden ceiling lamp strip illuminating inside of hot case
  const hcWarmLamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.012, 0.36),
    createToonMaterial({ color: 0xfff3c4, emissive: 0xffa726, emissiveIntensity: 0.95, interior: true })
  );
  hcWarmLamp.position.y = 0.372;
  hotGroup.add(hcWarmLamp);

  // 4 Corner steel stiles & crystal-clear glass enclosure (no solid orange block!)
  for (const sx of [-0.175, 0.175]) {
    for (const sz of [-0.205, 0.205]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.018), stainlessMat);
      post.position.set(sx, 0.22, sz);
      hotGroup.add(post);
    }
  }
  const hcGlassMat = createToonMaterial({
    color: 0xfff8eb,
    transparent: true,
    opacity: 0.22,
    interior: true,
    roughness: 0.08,
  });
  hcGlassMat.depthWrite = false;
  const hcFrontGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.32), hcGlassMat);
  hcFrontGlass.rotation.y = Math.PI / 2;
  hcFrontGlass.position.set(0.185, 0.22, 0);
  hotGroup.add(hcFrontGlass);

  // Dual stainless wire shelves inside hot case: Golden Fried L-Chiki (lower) & Plump Steamed Nikuman (upper)
  for (const [rackY, isTop] of [
    [0.105, false],
    [0.245, true],
  ] as const) {
    boxSpecs.push({ x: -2.14, y: Y_CT + rackY, z: -0.38, sx: 0.31, sy: 0.010, sz: 0.37, color: 0xdbe2ea });
    for (let hx = -0.075; hx <= 0.075; hx += 0.075) {
      for (let hz = -0.11; hz <= 0.11; hz += 0.11) {
        if (isTop) {
          // Steamed pleated white & curry buns on crisp parchment squares
          boxSpecs.push({ x: -2.14 + hx, y: Y_CT + rackY + 0.007, z: -0.38 + hz, sx: 0.056, sy: 0.004, sz: 0.056, color: 0xffffff });
          bunSpecs.push({
            x: -2.14 + hx,
            y: Y_CT + rackY + 0.028,
            z: -0.38 + hz,
            sx: 0.060,
            sy: 0.044,
            sz: 0.060,
            color: hx > 0 ? 0xf6c96e : 0xfff9f0,
          });
        } else {
          // Crispy golden breaded chicken cutlets sitting inside red/cream paper boats
          boxSpecs.push({ x: -2.14 + hx, y: Y_CT + rackY + 0.010, z: -0.38 + hz, sx: 0.065, sy: 0.012, sz: 0.088, color: 0xfef2f2 });
          bunSpecs.push({
            x: -2.14 + hx,
            y: Y_CT + rackY + 0.024,
            z: -0.38 + hz,
            sx: 0.056,
            sy: 0.026,
            sz: 0.076,
            color: hz < 0 ? 0xc26d1b : 0xd98628,
          });
        }
      }
    }
  }
  group.add(hotGroup);

  // Station 4 (Z = +0.16): Recessed 6-Grid Stainless Oden Vat + Clear Glass Sneeze Shield + Tongs & Cup Stack
  const odenGroup = new THREE.Group();
  odenGroup.position.set(-2.14, Y_CT, 0.16);

  // Hollow perimeter wooden-trim & stainless vat jacket
  const odenJacket = inkMesh(new RoundedBoxGeometry(0.42, 0.12, 0.44, 2, 0.014), darkMetalMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  odenJacket.position.y = 0.06;
  odenGroup.add(odenJacket);

  const odenRim = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.014, 0.42), stainlessMat);
  odenRim.position.y = 0.125;
  odenGroup.add(odenRim);

  const brothMat = createToonMaterial({
    color: 0xf4c868,
    emissive: 0xe6a035,
    emissiveIntensity: 0.48,
    interior: true,
    roughness: 0.16,
  });
  const broth = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.38), brothMat);
  broth.rotation.x = -Math.PI / 2;
  broth.position.y = 0.133;
  odenGroup.add(broth);

  // 2x3 Stainless Broth Compartment Dividers
  for (const gx of [0]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.028, 0.38), stainlessMat);
    div.position.set(gx, 0.138, 0);
    odenGroup.add(div);
  }
  for (const gz of [-0.065, 0.065]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.028, 0.010), stainlessMat);
    div.position.set(0, 0.138, gz);
    odenGroup.add(div);
  }

  // Sculpted Oden Ingredients simmering cleanly inside broth compartments
  const daikonMat = createToonMaterial({ color: 0xfdf5dc, interior: true, roughness: 0.32 });
  const eggMat = createToonMaterial({ color: 0xf2d49b, interior: true, roughness: 0.25 });
  const konnyakuMat = createToonMaterial({ color: 0x707784, interior: true, roughness: 0.42 });
  const chikuwaMat = createToonMaterial({ color: 0xc8843c, interior: true, roughness: 0.55 });
  for (let i = 0; i < 6; i++) {
    const ox = i % 2 === 0 ? -0.095 : 0.095;
    const oz = -0.13 + Math.floor(i / 2) * 0.13;
    let item: THREE.Mesh;
    if (i === 0 || i === 3) {
      item = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.028, 14), daikonMat);
    } else if (i === 1) {
      item = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), eggMat);
      item.scale.set(1.0, 1.25, 1.0);
    } else if (i === 2) {
      item = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.022, 3), konnyakuMat);
    } else {
      item = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.088, 12), chikuwaMat);
      item.rotation.z = Math.PI / 2;
      item.rotation.y = 0.4;
    }
    item.position.set(ox, 0.140, oz);
    odenGroup.add(item);
  }

  // 3-sided Glass Sneeze Shield + Ladle/Tongs Cup + Takeout Bowl Stack
  const odenShieldF = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.22, 0.42), clearAcrylicMat);
  odenShieldF.position.set(0.195, 0.23, 0);
  odenGroup.add(odenShieldF);
  const odenShieldTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.010, 0.42), clearAcrylicMat);
  odenShieldTop.position.set(0.08, 0.34, 0);
  odenGroup.add(odenShieldTop);

  // Soft rising steam wisps over oden pot
  const steamSprites: THREE.Mesh[] = [];
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xfff9ee,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let s = 0; s < 3; s++) {
    const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.060, 8, 8), steamMat.clone());
    wisp.position.set(-2.14 + (s - 1) * 0.08, Y_CT + 0.25 + s * 0.10, 0.16 + (s % 2) * 0.06);
    wisp.userData.baseY = Y_CT + 0.21;
    wisp.userData.phase = s * 2.1;
    steamSprites.push(wisp);
    group.add(wisp);
  }
  group.add(odenGroup);

  // Station 5 (Z = +0.64): Recessed Self-Serve Espresso & Iced Coffee Brewer + Translucent Bean Hoppers & Cup/Lid Caddy
  const coffeeMachine = new THREE.Group();
  coffeeMachine.position.set(-2.22, Y_CT, 0.64);

  // Main rear tower + overhanging brew head creating real recessed C-shaped coffee alcove!
  const cmTower = inkMesh(new RoundedBoxGeometry(0.22, 0.58, 0.34, 2, 0.018), darkMetalMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  cmTower.position.set(-0.09, 0.29, 0);
  coffeeMachine.add(cmTower);

  const cmHead = inkMesh(new RoundedBoxGeometry(0.38, 0.16, 0.34, 2, 0.016), darkMetalMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  cmHead.position.set(0.01, 0.50, 0);
  coffeeMachine.add(cmHead);

  const cmAlcoveBack = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.34, 0.29), stainlessMat);
  cmAlcoveBack.position.set(0.025, 0.22, 0);
  coffeeMachine.add(cmAlcoveBack);

  const cmMenuFace = createCounterUiPlane(2, 0.29, 0.128);
  cmMenuFace.rotation.y = Math.PI / 2;
  cmMenuFace.position.set(0.203, 0.50, 0);
  coffeeMachine.add(cmMenuFace);

  const dripTray = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.028, 0.32), stainlessMat);
  dripTray.position.set(0.09, 0.014, 0);
  coffeeMachine.add(dripTray);

  for (const nz of [-0.045, 0.045]) {
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.008, 0.055, 12), stainlessMat);
    spout.position.set(0.11, 0.40, nz);
    coffeeMachine.add(spout);
  }

  // Twin translucent smoked-glass bean hoppers on top showing dark roasted beans inside!
  const hopperGlassMat = createToonMaterial({
    color: 0x3b2618,
    transparent: true,
    opacity: 0.62,
    interior: true,
    roughness: 0.14,
  });
  hopperGlassMat.depthWrite = false;
  const roastBeanMat = createToonMaterial({ color: 0x3b1f0e, interior: true, roughness: 0.78 });
  for (const hz of [-0.075, 0.075]) {
    const beans = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.048, 0.09, 14), roastBeanMat);
    beans.position.set(-0.08, 0.625, hz);
    coffeeMachine.add(beans);

    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 0.14, 16), hopperGlassMat);
    hopper.position.set(-0.08, 0.65, hz);
    coffeeMachine.add(hopper);

    const hCap = new THREE.Mesh(new THREE.CylinderGeometry(0.080, 0.080, 0.018, 16), darkMetalMat);
    hCap.position.set(-0.08, 0.728, hz);
    coffeeMachine.add(hCap);
  }

  // Freshly brewed cup under nozzle + Stacked paper cups & sleek black lid/stirrer organizer caddy!
  const activeCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.032, 0.095, 16),
    createToonMaterial({ color: 0xfff8ed, interior: true })
  );
  activeCup.position.set(0.11, 0.076, 0);
  coffeeMachine.add(activeCup);
  const cupSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.038, 0.042, 16),
    createToonMaterial({ color: 0x9c6644, interior: true })
  );
  cupSleeve.position.set(0.11, 0.076, 0);
  coffeeMachine.add(cupSleeve);

  // Lid/straw/sugar caddy neatly beside coffee machine on front corner
  const caddy = inkMesh(new RoundedBoxGeometry(0.14, 0.11, 0.14, 2, 0.010), darkMetalMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  caddy.position.set(0.24, 0.055, 0.14);
  coffeeMachine.add(caddy);
  const lidStack = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.09, 14), createToonMaterial({ color: 0x1e293b, interior: true }));
  lidStack.position.set(0.24, 0.135, 0.14);
  coffeeMachine.add(lidStack);
  group.add(coffeeMachine);

  // =========================================================================
  // 4. WINDOW-FRONT MAGAZINE RACK ("杂志架") & ISLAND FREEZER ("冰柜")
  // =========================================================================
  // Magazine Rack along front window (X in [-3.05, -0.45], Z = +1.36)
  const magRackGroup = new THREE.Group();
  magRackGroup.position.set(-1.75, Y0, 1.36);

  const magBase = inkMesh(new RoundedBoxGeometry(2.55, 0.34, 0.48, 2, 0.022), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  magBase.position.y = 0.17;
  magRackGroup.add(magBase);

  const magSlope = inkMesh(new RoundedBoxGeometry(2.52, 0.72, 0.08, 2, 0.016), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  magSlope.position.set(0, 0.62, 0.12);
  magSlope.rotation.x = 0.35;
  magRackGroup.add(magSlope);

  // Clear acrylic front retainer strips holding the 3 tiers of magazines + chrome dividers
  for (let tier = 0; tier < 3; tier++) {
    const retainer = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.055, 0.012), clearAcrylicMat);
    retainer.position.set(0, 0.38 + tier * 0.21, 0.065 + tier * 0.075);
    retainer.rotation.x = 0.35;
    magRackGroup.add(retainer);
  }
  for (let div = -1; div <= 1; div++) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.68, 12), stainlessMat);
    rod.position.set(div * 0.82, 0.62, 0.18);
    rod.rotation.x = 0.35;
    magRackGroup.add(rod);
  }

  for (let tier = 0; tier < 3; tier++) {
    for (let m = 0; m < 12; m++) {
      const mx = -1.75 - 1.12 + m * 0.202;
      const my = Y0 + 0.42 + tier * 0.21;
      const mz = 1.36 + 0.02 + tier * 0.075;
      // Crisp white paper page block peeking along top & side edges
      boxSpecs.push({
        x: mx,
        y: my,
        z: mz,
        rx: 0.35,
        sx: 0.176,
        sy: 0.224,
        sz: 0.022,
        color: 0xfbf7ee,
      });
      // Illustrated Japanese magazine cover plate (sampled from 2x2 Gemini cover grid)
      magCoverSpecs.push({
        x: mx,
        y: my,
        z: mz,
        rx: 0.35,
        sx: 0.168,
        sy: 0.218,
        sz: 0.030,
        color: 0xffffff,
        quad: (tier * 3 + m) % 4,
      });
    }
  }
  group.add(magRackGroup);

  // Commercial Island Ice Cream Chest Freezer ("アイス冷凍ケース" w/ hollow cold well, chrome baskets & frosted glass) at (X = +0.55, Z = +1.18)
  const freezerGroup = new THREE.Group();
  freezerGroup.position.set(0.55, Y0, 1.18);

  const priceTagMat = createToonMaterial({ map: priceRailTex, color: 0xffffff, interior: true });
  const yellowRailTrimMat = createToonMaterial({ color: 0xf0b828, interior: true });
  function createPriceRailMesh(w: number, h: number, d: number, face: '+z' | '+x' | '-x'): THREE.Mesh {
    const faceIdx = face === '+x' ? 0 : face === '-x' ? 1 : 4;
    const mats: THREE.Material[] = [
      yellowRailTrimMat,
      yellowRailTrimMat,
      yellowRailTrimMat,
      yellowRailTrimMat,
      yellowRailTrimMat,
      yellowRailTrimMat,
    ];
    mats[faceIdx] = priceTagMat;
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  }
  const frostLinerMat = createToonMaterial({ color: 0xe6f3ff, roughness: 0.34, interior: true });
  const freezerLedMat = createToonMaterial({
    color: 0xffffff,
    emissive: 0xdff6ff,
    emissiveIntensity: 0.78,
    interior: true,
  });
  const freezerBumperMat = createToonMaterial({ color: 0x0284c7, roughness: 0.42, interior: true });

  // Recessed compressor plinth + horizontal intake condenser louver vents
  const freezerPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.14, 0.68), darkMetalMat);
  freezerPlinth.position.y = 0.07;
  freezerGroup.add(freezerPlinth);

  for (let lv = 0; lv < 3; lv++) {
    const slatF = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.014, 0.016), stainlessMat);
    slatF.position.set(0, 0.045 + lv * 0.028, 0.344);
    freezerGroup.add(slatF);
  }

  // Lower insulated compressor/deck body (y = 0.12 .. 0.46)
  const freezerLowerShell = inkMesh(new RoundedBoxGeometry(1.52, 0.34, 0.76, 2, 0.024), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  freezerLowerShell.position.y = 0.29;
  freezerGroup.add(freezerLowerShell);

  // Recessed frosty cold-well floor (y = 0.50) + perforated bottom evaporator deck inside hollow tub
  const coldFloor = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.024, 0.62), frostLinerMat);
  coldFloor.position.y = 0.50;
  freezerGroup.add(coldFloor);

  // Hollow Upper Perimeter Walls (y = 0.45 .. 0.78) forming real open-top frozen tub cavity
  for (const wz of [-0.345, 0.345]) {
    const longWall = inkMesh(new THREE.BoxGeometry(1.52, 0.33, 0.07), creamCabinetMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    longWall.position.set(0, 0.615, wz);
    freezerGroup.add(longWall);

    const innerLiner = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.28, 0.010), frostLinerMat);
    innerLiner.position.set(0, 0.635, wz > 0 ? 0.305 : -0.305);
    freezerGroup.add(innerLiner);

    // Sub-zero cool white LED lighting tucked under upper inner rim
    const coveLed = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.014, 0.016), freezerLedMat);
    coveLed.position.set(0, 0.752, wz > 0 ? 0.294 : -0.294);
    freezerGroup.add(coveLed);
  }
  for (const wx of [-0.725, 0.725]) {
    const endWall = inkMesh(new THREE.BoxGeometry(0.07, 0.33, 0.62), creamCabinetMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    endWall.position.set(wx, 0.615, 0);
    freezerGroup.add(endWall);

    const endLiner = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.28, 0.62), frostLinerMat);
    endLiner.position.set(wx > 0 ? 0.685 : -0.685, 0.635, 0);
    freezerGroup.add(endLiner);
  }

  // Side intake vent grille on -X doorway end-wall
  const endVentPlate = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 0.44), darkMetalMat);
  endVentPlate.position.set(-0.764, 0.28, 0);
  freezerGroup.add(endVentPlate);
  for (let sv = 0; sv < 4; sv++) {
    const vs = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.40), stainlessMat);
    vs.position.set(-0.766, 0.23 + sv * 0.032, 0);
    freezerGroup.add(vs);
  }

  // Hollow 4-piece Sky-Blue Cart Bumper Frame around top rim (keeps central glass opening clear!)
  for (const bz of [-0.382, 0.382]) {
    const bBar = new THREE.Mesh(new RoundedBoxGeometry(1.56, 0.052, 0.042, 2, 0.012), freezerBumperMat);
    bBar.position.set(0, 0.748, bz);
    freezerGroup.add(bBar);
  }
  for (const bx of [-0.762, 0.762]) {
    const sBar = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.052, 0.79, 2, 0.012), freezerBumperMat);
    sBar.position.set(bx, 0.748, 0);
    freezerGroup.add(sBar);
  }

  // Front & Back printed commercial graphic skirt banners + price strip + unclipped -19.2°C LED thermometer
  const freezerBannerTex = createFreezerHeaderTexture();
  const freezerBannerMat = createToonMaterial({
    map: freezerBannerTex,
    color: 0xffffff,
    emissive: 0xd8f3ff,
    emissiveMap: freezerBannerTex,
    emissiveIntensity: 0.16,
    interior: true,
  });
  for (const fz of [0.384, -0.384]) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.24), freezerBannerMat);
    banner.position.set(0, 0.545, fz);
    if (fz < 0) banner.rotation.y = Math.PI;
    freezerGroup.add(banner);
  }
  const fzPriceRail = createPriceRailMesh(1.26, 0.022, 0.010, '+z');
  fzPriceRail.position.set(-0.08, 0.692, 0.384);
  freezerGroup.add(fzPriceRail);

  const freezerTempTex = createFreezerTempTexture();
  const tempDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.118, 0.042),
    createToonMaterial({
      map: freezerTempTex,
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveMap: freezerTempTex,
      emissiveIntensity: 0.65,
      interior: true,
    })
  );
  tempDisplay.position.set(0.62, 0.692, 0.386);
  freezerGroup.add(tempDisplay);

  // Dual aluminum sliding-door track rails + edge-frosted framed tempered glass lids
  for (const tz of [-0.32, 0.32]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.020, 0.032), stainlessMat);
    track.position.set(0, 0.788, tz);
    freezerGroup.add(track);
  }
  const freezerGlassTex = createFreezerGlassTexture();
  const freezerGlassMat = createToonMaterial({
    map: freezerGlassTex,
    color: 0xffffff,
    emissive: 0xd0f0ff,
    emissiveMap: freezerGlassTex,
    emissiveIntensity: 0.10,
    transparent: true,
    opacity: 1.0,
    interior: true,
    roughness: 0.08,
  });
  freezerGlassMat.depthWrite = false;

  for (const [sx, sy] of [
    [-0.345, 0.802],
    [0.345, 0.818],
  ]) {
    const pane = new THREE.Group();
    pane.position.set(sx, sy, 0);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.69, 0.61), freezerGlassMat);
    glass.rotation.x = -Math.PI / 2;
    pane.add(glass);

    // 4-sided extruded dark-aluminum perimeter frame stiles + black finger grip pocket
    for (const fz of [-0.308, 0.308]) {
      const stileZ = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.014, 0.022), darkMetalMat);
      stileZ.position.set(0, 0, fz);
      pane.add(stileZ);
    }
    for (const fx of [-0.348, 0.348]) {
      const stileX = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.635), darkMetalMat);
      stileX.position.set(fx, 0, 0);
      pane.add(stileX);
    }
    const handlePocket = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.020, 0.14), darkMetalMat);
    handlePocket.position.set(sx < 0 ? 0.318 : -0.318, 0.008, 0);
    pane.add(handlePocket);
    freezerGroup.add(pane);
  }

  // Chrome wire freezer basket dividers + basket floor grate partitioning the recessed well into 5 bays
  metalHardwareSpecs.push({ x: 0.55, y: Y0 + 0.535, z: 1.18, sx: 1.35, sy: 0.006, sz: 0.58, color: 0xdbeafe });
  for (let b = 1; b < 5; b++) {
    const divX = 0.55 - 0.68 + b * 0.272;
    metalHardwareSpecs.push({ x: divX, y: Y0 + 0.635, z: 1.18, sx: 0.007, sy: 0.20, sz: 0.59, color: 0xe2e8f0 });
  }
  metalHardwareSpecs.push({ x: 0.55, y: Y0 + 0.73, z: 1.18, sx: 1.35, sy: 0.008, sz: 0.008, color: 0xe2e8f0 });
  for (const railZ of [-0.28, 0.28]) {
    metalHardwareSpecs.push({ x: 0.55, y: Y0 + 0.73, z: 1.18 + railZ, sx: 1.35, sy: 0.008, sz: 0.008, color: 0xe2e8f0 });
  }

  // Brand-printed Ice Cream Multipacks, Luxury Tubs, Yuki Mochi Trays & Choco Monaka Bars stocked up to load-line!
  const bayCentersX = [-0.54, -0.27, 0.0, 0.27, 0.54];
  for (let b = 0; b < bayCentersX.length; b++) {
    const bx = 0.55 + bayCentersX[b];
    for (const rowIdx of [0, 1]) {
      const bz = 1.18 + (rowIdx === 0 ? -0.145 : 0.145);
      if (b === 0) {
        // Garigari Soda Multipack Cartons stacked 3-high up to cold load line
        for (let st = 0; st < 3; st++) {
          iceBoxSpecs.push({
            x: bx,
            y: Y0 + 0.568 + st * 0.064,
            z: bz,
            ry: st * 0.04,
            sx: 0.21,
            sy: 0.060,
            sz: 0.22,
            color: 0xffffff,
            quad: 0,
          });
        }
      } else if (b === 1) {
        // Luxury Vanilla & Matcha Pint Tubs stacked 2-high on basket tray with vivid printed lid decals
        const cupQ = rowIdx === 0 ? 1 : 2;
        for (const ox of [-0.056, 0.056]) {
          for (let st = 0; st < 2; st++) {
            const cy = Y0 + 0.58 + st * 0.082;
            iceCupSpecs.push({ x: bx + ox, y: cy, z: bz, sx: 0.050, sy: 0.078, sz: 0.050, color: 0xffffff, quad: cupQ });
            iceBoxSpecs.push({ x: bx + ox, y: cy + 0.041, z: bz, sx: 0.092, sy: 0.006, sz: 0.092, color: 0xffffff, quad: cupQ });
          }
        }
      } else if (b === 2) {
        // Strawberry Cups in back row & Yukimi Mochi Daifuku boxes stacked 3-high cleanly in front row!
        if (rowIdx === 0) {
          for (const ox of [-0.056, 0.056]) {
            for (let st = 0; st < 2; st++) {
              const cy = Y0 + 0.58 + st * 0.082;
              iceCupSpecs.push({ x: bx + ox, y: cy, z: bz, sx: 0.050, sy: 0.078, sz: 0.050, color: 0xffffff, quad: 3 });
              iceBoxSpecs.push({ x: bx + ox, y: cy + 0.041, z: bz, sx: 0.092, sy: 0.006, sz: 0.092, color: 0xffffff, quad: 3 });
            }
          }
        } else {
          for (let st = 0; st < 3; st++) {
            iceBoxSpecs.push({
              x: bx,
              y: Y0 + 0.566 + st * 0.054,
              z: bz,
              rx: -0.10,
              sx: 0.21,
              sy: 0.048,
              sz: 0.22,
              color: 0xffffff,
              quad: 5,
            });
          }
        }
      } else if (b === 3) {
        // Shingled foil-wrapped Choco Monaka Jumbo bars stacked 2 tiers high angled cleanly upward!
        for (const [sh, yOff] of [
          [-0.048, 0.58],
          [0.048, 0.615],
          [-0.048, 0.655],
          [0.048, 0.690],
        ] as const) {
          icePouchSpecs.push({
            x: bx,
            y: Y0 + yOff,
            z: bz + sh,
            rx: 0.24,
            rz: Math.PI / 2,
            sx: 0.044,
            sy: 0.175,
            sz: 0.092,
            color: 0xffffff,
            quad: 4,
          });
        }
      } else {
        // Pino 6-Grain Red Boxes stacked 3-high in back, Crunch Choco Ice Bars shingled high in front!
        if (rowIdx === 0) {
          for (let st = 0; st < 3; st++) {
            iceBoxSpecs.push({
              x: bx,
              y: Y0 + 0.566 + st * 0.058,
              z: bz,
              sx: 0.21,
              sy: 0.054,
              sz: 0.22,
              color: 0xffffff,
              quad: 6,
            });
          }
        } else {
          for (const [sh, yOff] of [
            [-0.048, 0.58],
            [0.048, 0.615],
            [-0.048, 0.655],
            [0.048, 0.690],
          ] as const) {
            icePouchSpecs.push({
              x: bx,
              y: Y0 + yOff,
              z: bz + sh,
              rx: 0.24,
              rz: Math.PI / 2,
              sx: 0.044,
              sy: 0.175,
              sz: 0.088,
              color: 0xffffff,
              quad: 7,
            });
          }
        }
      }
    }
  }
  group.add(freezerGroup);

  // =========================================================================
  // 5. CENTRAL DOUBLE-SIDED GONDOLA SHELVES ("リアル陳列棚 + SKUフェイス + PEGBOARD")
  // =========================================================================
  const shelfMetalMat = createToonMaterial({ color: 0xf7f1e3, interior: true, roughness: 0.58 });
  const pegboardMat = createToonMaterial({ map: pegboardTex, color: 0xffffff, interior: true, roughness: 0.72 });
  const darkSteelMat = createToonMaterial({ color: 0x475569, interior: true, roughness: 0.42 });
  const gondolaLedMat = createToonMaterial({
    color: 0xffffff,
    emissive: 0xfff0cc,
    emissiveIntensity: 0.62,
    interior: true,
  });

  // Authentic drink liquid tones matching 4x2 Beverage Label Atlas (quad 0..7)
  const bevSkus = [
    { q: 0, bottle: 0x4d7c0f, cap: 0x15803d, carton: 0xf0fdf4 }, // Green Tea
    { q: 1, bottle: 0x78350f, cap: 0x92400e, carton: 0xfffbeb }, // Roasted Oolong
    { q: 2, bottle: 0x261a14, cap: 0x111827, carton: 0x292524 }, // Black Coffee
    { q: 3, bottle: 0xe7d3b4, cap: 0xf8fafc, carton: 0xfef3c7 }, // Cafe Latte / Milk
    { q: 4, bottle: 0xdbeafe, cap: 0x0284c7, carton: 0xf8fafc }, // Water / Sports
    { q: 5, bottle: 0x1f0a06, cap: 0xdc2626, carton: 0xef4444 }, // Cola
    { q: 6, bottle: 0xfde047, cap: 0xeab308, carton: 0xfef08a }, // Lemon C
    { q: 7, bottle: 0xe2e8f0, cap: 0x94a3b8, carton: 0xe2e8f0 }, // Silver Dry
  ];

  type GondolaSkuKind =
    | 'cup'
    | 'bowlStack'
    | 'yakisobaStack'
    | 'pouch'
    | 'peggedPouch'
    | 'pocky'
    | 'pdqChoco'
    | 'snackBox'
    | 'curryBox'
    | 'cerealBox'
    | 'canister'
    | 'loaf'
    | 'bun'
    | 'carton1L'
    | 'petBottle'
    | 'sixPack';

  interface FacingBlock {
    kind: GondolaSkuKind;
    count: number;
    quad: number;
    pop?: number; // 0 = "新発売!", 1 = "特価!"
  }

  const SKU_PITCH_Z: Record<GondolaSkuKind, number> = {
    cup: 0.112,
    bowlStack: 0.155,
    yakisobaStack: 0.165,
    pouch: 0.132,
    peggedPouch: 0.125,
    pocky: 0.088,
    pdqChoco: 0.30,
    snackBox: 0.132,
    curryBox: 0.145,
    cerealBox: 0.165,
    canister: 0.095,
    loaf: 0.138,
    bun: 0.128,
    carton1L: 0.096,
    petBottle: 0.102,
    sixPack: 0.215,
  };

  /** Emit one 3D merchandise item (with optional 2-high stack / multi-part caps) at world coords. */
  function placeGondolaSku(
    kind: GondolaSkuKind,
    px: number,
    yBase: number,
    pz: number,
    side: number,
    quad: number,
    endCap = false,
    variant = 0
  ) {
    const q = quad & 7;
    if (kind === 'cup') {
      cupNoodleSpecs.push({ x: px, y: yBase + 0.068, z: pz, sx: 0.104, sy: 0.126, sz: 0.104, color: 0xffffff, quad: q });
      cylSpecs.push({ x: px, y: yBase + 0.133, z: pz, sx: 0.050, sy: 0.010, sz: 0.050, color: 0xfefcf6 });
      // Stack a 2nd cup cleanly on some columns for varied retail silhouette height
      if (variant % 3 !== 2) {
        cupNoodleSpecs.push({ x: px, y: yBase + 0.194, z: pz, ry: 0.18, sx: 0.102, sy: 0.122, sz: 0.102, color: 0xffffff, quad: q });
        cylSpecs.push({ x: px, y: yBase + 0.256, z: pz, sx: 0.049, sy: 0.009, sz: 0.049, color: 0xfefcf6 });
      }
    } else if (kind === 'bowlStack') {
      for (let st = 0; st < 2; st++) {
        const by = yBase + 0.045 + st * 0.082;
        wideBowlSpecs.push({ x: px, y: by, z: pz, ry: st * 0.25, sx: 0.142, sy: 0.084, sz: 0.142, color: 0xffffff, quad: q });
        cylSpecs.push({ x: px, y: by + 0.044, z: pz, sx: 0.070, sy: 0.008, sz: 0.070, color: 0xfffaf0 });
      }
    } else if (kind === 'yakisobaStack') {
      for (let st = 0; st < 2; st++) {
        const by = yBase + 0.032 + st * 0.060;
        wideBowlSpecs.push({ x: px, y: by, z: pz, sx: 0.158, sy: 0.058, sz: 0.158, color: 0xffffff, quad: 7 });
        cylSpecs.push({ x: px, y: by + 0.030, z: pz, sx: 0.077, sy: 0.008, sz: 0.077, color: 0x18181b });
      }
    } else if (kind === 'pouch') {
      const h = q === 6 ? 0.155 : 0.195;
      pouchSpecs.push({
        x: px,
        y: yBase + h * 0.5 + 0.004,
        z: pz,
        ry: endCap ? Math.PI / 2 : 0,
        rz: endCap ? -0.16 : side * -0.15,
        sx: 0.086,
        sy: h,
        sz: q === 6 ? 0.105 : 0.128,
        color: 0xffffff,
        quad: q,
      });
    } else if (kind === 'pocky') {
      packedBoxSpecs.push({
        x: px,
        y: yBase + 0.088,
        z: pz,
        sx: endCap ? 0.078 : 0.048,
        sy: 0.172,
        sz: endCap ? 0.048 : 0.078,
        color: 0xffffff,
        quad: q,
      });
    } else if (kind === 'snackBox') {
      packedBoxSpecs.push({
        x: px,
        y: yBase + 0.082,
        z: pz,
        sx: endCap ? 0.122 : 0.068,
        sy: 0.162,
        sz: endCap ? 0.068 : 0.122,
        color: 0xffffff,
        quad: q,
      });
    } else if (kind === 'curryBox') {
      packedBoxSpecs.push({
        x: px,
        y: yBase + 0.088,
        z: pz,
        sx: endCap ? 0.132 : 0.044,
        sy: 0.172,
        sz: endCap ? 0.044 : 0.132,
        color: 0xffffff,
        quad: 5,
      });
    } else if (kind === 'cerealBox') {
      packedBoxSpecs.push({
        x: px,
        y: yBase + 0.114,
        z: pz,
        sx: endCap ? 0.152 : 0.072,
        sy: 0.224,
        sz: endCap ? 0.072 : 0.152,
        color: 0xffffff,
        quad: 6,
      });
    } else if (kind === 'canister') {
      cupNoodleSpecs.push({ x: px, y: yBase + 0.072, z: pz, sx: 0.084, sy: 0.142, sz: 0.084, color: 0xffffff, quad: q });
      cylSpecs.push({ x: px, y: yBase + 0.146, z: pz, sx: 0.042, sy: 0.010, sz: 0.042, color: 0xffffff });
    } else if (kind === 'loaf') {
      const col = variant % 2 === 0 ? 0xf5deb3 : 0xfce7b2;
      loafSpecs.push({ x: px, y: yBase + 0.084, z: pz, sx: 0.112, sy: 0.164, sz: 0.124, color: col });
      boxSpecs.push({ x: px, y: yBase + 0.144, z: pz, sx: 0.036, sy: 0.014, sz: 0.036, color: variant % 2 === 0 ? 0xdc2626 : 0x2563eb });
    } else if (kind === 'bun') {
      bunSpecs.push({ x: px, y: yBase + 0.046, z: pz, sx: 0.114, sy: 0.088, sz: 0.114, color: variant % 2 === 0 ? 0xebb159 : 0xc6823a });
    } else if (kind === 'carton1L') {
      const b = bevSkus[q];
      cartonSpecs.push({ x: px, y: yBase + 0.105, z: pz, sx: 0.082, sy: 0.205, sz: 0.082, color: b.carton });
      boxSpecs.push({
        x: px + (endCap ? 0 : side * 0.042),
        y: yBase + 0.108,
        z: pz + (endCap ? 0.042 : 0),
        sx: endCap ? 0.068 : 0.006,
        sy: 0.072,
        sz: endCap ? 0.006 : 0.068,
        color: b.cap,
      });
    } else if (kind === 'petBottle') {
      const b = bevSkus[q];
      petSpecs.push({ x: px, y: yBase + 0.112, z: pz, sx: 0.092, sy: 0.215, sz: 0.092, color: b.bottle });
      bevWrapSpecs.push({ x: px, y: yBase + 0.104, z: pz, sx: 0.048, sy: 0.072, sz: 0.048, color: 0xffffff, quad: q });
      cylSpecs.push({ x: px, y: yBase + 0.225, z: pz, sx: 0.016, sy: 0.022, sz: 0.016, color: b.cap });
    } else if (kind === 'sixPack') {
      for (let st = 0; st < (variant % 2 === 0 ? 2 : 1); st++) {
        packedBoxSpecs.push({
          x: px,
          y: yBase + 0.068 + st * 0.136,
          z: pz,
          sx: 0.135,
          sy: 0.134,
          sz: 0.202,
          color: 0xffffff,
          quad: 7,
        });
      }
    }
  }

  function createGondolaAisle(centerX: number, centerZ: number, lengthZ = 2.35, seed = 1) {
    const g = new THREE.Group();
    g.position.set(centerX, Y0, centerZ);
    const spineH = 1.54;

    // Perforated Konbini Pegboard Spine + Dark Steel Upright Bay Standards
    const spine = inkMesh(new RoundedBoxGeometry(0.06, spineH, lengthZ, 2, 0.008), pegboardMat, {
      edges: false,
      hull: true,
      interior: true,
    });
    spine.position.y = spineH * 0.5;
    g.add(spine);

    const spineCap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.035, lengthZ + 0.02), darkSteelMat);
    spineCap.position.y = spineH + 0.015;
    g.add(spineCap);

    const postZs = [-lengthZ * 0.48, -0.38, 0.38, lengthZ * 0.48];
    for (const uz of postZs) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.082, spineH, 0.032), darkSteelMat);
      post.position.set(0, spineH * 0.5, uz);
      g.add(post);
    }

    const baseDeck = inkMesh(new RoundedBoxGeometry(0.76, 0.12, lengthZ, 2, 0.016), shelfMetalMat, {
      edges: false,
      hull: true,
      interior: true,
    });
    baseDeck.position.y = 0.06;
    g.add(baseDeck);

    // End-cap Pegboard Back + Stepped Merchandising Shelves (+Z Entrance Facing!)
    const endCapBack = inkMesh(new RoundedBoxGeometry(0.74, 1.50, 0.05, 2, 0.010), pegboardMat, {
      edges: false,
      hull: true,
      interior: true,
    });
    endCapBack.position.set(0, 0.75, lengthZ * 0.5 + 0.025);
    g.add(endCapBack);

    const endBase = inkMesh(new RoundedBoxGeometry(0.74, 0.12, 0.30, 2, 0.016), shelfMetalMat, {
      edges: false,
      hull: true,
      interior: true,
    });
    endBase.position.set(0, 0.06, lengthZ * 0.5 + 0.15);
    g.add(endBase);

    const endShelfYs = [0.125, 0.45, 0.78, 1.11];
    for (let es = 0; es < endShelfYs.length; es++) {
      const sy = endShelfYs[es];
      if (es > 0) {
        const esBoard = inkMesh(new RoundedBoxGeometry(0.72, 0.024, 0.28, 2, 0.008), shelfMetalMat, {
          edges: false,
          subtle: true,
          interior: true,
        });
        esBoard.position.set(0, sy, lengthZ * 0.5 + 0.15);
        g.add(esBoard);

        const esRail = createPriceRailMesh(0.72, 0.024, 0.012, '+z');
        esRail.position.set(0, sy, lengthZ * 0.5 + 0.292);
        g.add(esRail);

        const esLed = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.012, 0.016), gondolaLedMat);
        esLed.position.set(0, sy - 0.016, lengthZ * 0.5 + 0.26);
        g.add(esLed);
      }

      const ecRet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.032, 0.008), clearAcrylicMat);
      ecRet.position.set(0, sy + 0.026, lengthZ * 0.5 + 0.284);
      g.add(ecRet);

      const yTop = Y0 + sy + (es === 0 ? 0.0 : 0.012);
      const pzFront = centerZ + lengthZ * 0.5 + 0.18;
      if (es === 3) {
        // Hanging Pegboard Rail on upper end-cap + Cup Noodles / Stacked Udon Bowl Promo!
        metalHardwareSpecs.push({ x: centerX, y: Y0 + 1.44, z: centerZ + lengthZ * 0.5 + 0.056, sx: 0.66, sy: 0.018, sz: 0.012, color: 0xe2e8f0 });
        for (let hi = 0; hi < 4; hi++) {
          const hx = centerX - 0.24 + hi * 0.16;
          const qPeg = hi < 2 ? 6 : 7;
          metalHardwareSpecs.push({ x: hx, y: Y0 + 1.43, z: centerZ + lengthZ * 0.5 + 0.15, sx: 0.007, sy: 0.007, sz: 0.19, color: 0xcbd5e1 });
          for (const hzOff of [0.11, 0.19]) {
            pouchSpecs.push({
              x: hx,
              y: Y0 + 1.335,
              z: centerZ + lengthZ * 0.5 + hzOff,
              ry: Math.PI / 2,
              rz: (hi % 2 === 0 ? 0.02 : -0.02),
              sx: 0.055,
              sy: 0.145,
              sz: 0.108,
              color: 0xffffff,
              quad: qPeg,
            });
          }
        }
        // Bottom deck below peg hooks still carries featured promo Yakisoba & Bowls!
        placeGondolaSku('bowlStack', centerX - 0.18, yTop, pzFront, 0, seed === 1 ? 4 : 5, true, 0);
        clearDividerSpecs.push({ x: centerX, y: yTop + 0.04, z: pzFront, sx: 0.006, sy: 0.06, sz: 0.22, color: 0xe0f2fe });
        placeGondolaSku('cup', centerX + 0.14, yTop, pzFront, 0, seed === 1 ? 0 : 1, true, 0);
        placeGondolaSku('cup', centerX + 0.255, yTop, pzFront, 0, seed === 1 ? 0 : 1, true, 1);
        popWobblerSpecs.push({ x: centerX + 0.19, y: Y0 + sy, z: centerZ + lengthZ * 0.5 + 0.305, sx: 0.078, sy: 0.062, sz: 0.008, color: 0xffffff, quad: 0 });
      } else if (es === 2) {
        // Dense 5-unit facing of foil Chip Bags properly turned to +Z!
        for (let ex = 0; ex < 5; ex++) {
          const px = centerX - 0.26 + ex * 0.13;
          placeGondolaSku('pouch', px, yTop, pzFront, 0, ex < 3 ? (seed === 1 ? 0 : 2) : (seed === 1 ? 1 : 3), true, ex);
        }
        clearDividerSpecs.push({ x: centerX + 0.065, y: yTop + 0.04, z: pzFront, sx: 0.006, sy: 0.06, sz: 0.22, color: 0xe0f2fe });
      } else if (es === 1) {
        // Promo Confectionery / Curry Boxes + Pocky Soldier Row!
        for (let ex = 0; ex < 3; ex++) {
          placeGondolaSku('pocky', centerX - 0.27 + ex * 0.095, yTop, pzFront, 0, seed === 1 ? 0 : 1, true, ex);
        }
        clearDividerSpecs.push({ x: centerX - 0.03, y: yTop + 0.04, z: pzFront, sx: 0.006, sy: 0.06, sz: 0.22, color: 0xe0f2fe });
        for (let ex = 0; ex < 2; ex++) {
          placeGondolaSku('curryBox', centerX + 0.09 + ex * 0.145, yTop, pzFront, 0, 5, true, ex);
        }
        popWobblerSpecs.push({ x: centerX - 0.17, y: Y0 + sy, z: centerZ + lengthZ * 0.5 + 0.305, sx: 0.078, sy: 0.062, sz: 0.008, color: 0xffffff, quad: 1 });
      } else {
        // Bottom End-cap Base: 5 Promo 2L Drinks!
        for (let ex = 0; ex < 5; ex++) {
          placeGondolaSku('petBottle', centerX - 0.24 + ex * 0.12, yTop, pzFront, 0, ex < 3 ? (seed === 1 ? 0 : 5) : (seed === 1 ? 4 : 1), true, ex);
        }
        clearDividerSpecs.push({ x: centerX + 0.06, y: yTop + 0.04, z: pzFront, sx: 0.006, sy: 0.06, sz: 0.22, color: 0xe0f2fe });
      }
    }

    // Raised Printed Promo Poster Header above End-Cap Pegboard (clear of peg rail)
    const popQuad = seed % 2 === 1 ? 0 : 1;
    const popCard = inkMesh(
      createQuadAtlasBoxGeometry(popQuad, 0.40, 0.44, 0.018, 0.044, 0.036, 0.006),
      createToonMaterial({
        map: postersGridTex,
        color: 0xffffff,
        emissive: 0xffe4b8,
        emissiveMap: postersGridTex,
        emissiveIntensity: 0.45,
        interior: true,
      }),
      { subtle: true, interior: true }
    );
    popCard.position.set(0, 1.72, lengthZ * 0.5 + 0.08);
    g.add(popCard);

    // Distinct Category Planograms per Aisle Side ([shelf 0..3][facing blocks])
    const leftCheckoutPlanogram: FacingBlock[][] = [
      [
        { kind: 'sixPack', count: 3, quad: 7 },
        { kind: 'carton1L', count: 4, quad: 4 },
        { kind: 'carton1L', count: 3, quad: 1 },
        { kind: 'petBottle', count: 4, quad: 0 },
      ],
      [
        { kind: 'curryBox', count: 4, quad: 5, pop: 0 },
        { kind: 'pocky', count: 4, quad: 0 },
        { kind: 'snackBox', count: 4, quad: 4 },
        { kind: 'pocky', count: 4, quad: 1 },
      ],
      [
        { kind: 'pdqChoco', count: 1, quad: 2, pop: 1 },
        { kind: 'snackBox', count: 4, quad: 3 },
        { kind: 'pouch', count: 4, quad: 5 },
        { kind: 'pouch', count: 4, quad: 6 },
      ],
      [
        { kind: 'loaf', count: 4, quad: 0, pop: 0 },
        { kind: 'loaf', count: 3, quad: 1 },
        { kind: 'bun', count: 4, quad: 0 },
        { kind: 'bun', count: 4, quad: 1 },
      ],
    ];
    const centerLeftPlanogram: FacingBlock[][] = [
      [
        { kind: 'petBottle', count: 4, quad: 5, pop: 1 },
        { kind: 'petBottle', count: 4, quad: 0 },
        { kind: 'carton1L', count: 4, quad: 3 },
        { kind: 'sixPack', count: 3, quad: 7 },
      ],
      [
        { kind: 'cerealBox', count: 3, quad: 6, pop: 0 },
        { kind: 'snackBox', count: 4, quad: 4 },
        { kind: 'pdqChoco', count: 1, quad: 2 },
        { kind: 'curryBox', count: 4, quad: 5 },
      ],
      [
        { kind: 'pouch', count: 4, quad: 0 },
        { kind: 'pouch', count: 4, quad: 1, pop: 0 },
        { kind: 'pouch', count: 4, quad: 2 },
        { kind: 'pocky', count: 4, quad: 0 },
      ],
      [
        { kind: 'cup', count: 4, quad: 0, pop: 0 },
        { kind: 'cup', count: 4, quad: 1 },
        { kind: 'bowlStack', count: 3, quad: 4 },
        { kind: 'yakisobaStack', count: 3, quad: 7 },
      ],
    ];
    const centerRightPlanogram: FacingBlock[][] = [
      [
        { kind: 'carton1L', count: 4, quad: 0 },
        { kind: 'petBottle', count: 4, quad: 4, pop: 1 },
        { kind: 'petBottle', count: 4, quad: 6 },
        { kind: 'sixPack', count: 3, quad: 7 },
      ],
      [
        { kind: 'canister', count: 4, quad: 3 },
        { kind: 'curryBox', count: 4, quad: 5 },
        { kind: 'snackBox', count: 4, quad: 3, pop: 0 },
        { kind: 'cerealBox', count: 3, quad: 6 },
      ],
      [
        { kind: 'pouch', count: 4, quad: 3 },
        { kind: 'pouch', count: 4, quad: 6 },
        { kind: 'pdqChoco', count: 1, quad: 2, pop: 1 },
        { kind: 'pouch', count: 4, quad: 7 },
      ],
      [
        { kind: 'cup', count: 4, quad: 2 },
        { kind: 'cup', count: 4, quad: 3, pop: 0 },
        { kind: 'bowlStack', count: 3, quad: 5 },
        { kind: 'bowlStack', count: 3, quad: 6 },
      ],
    ];
    // Right Gondola +X faces right into Storefront Window & Dessert Case — max retail showcase!
    const rightWindowPlanogram: FacingBlock[][] = [
      [
        { kind: 'sixPack', count: 3, quad: 7, pop: 1 },
        { kind: 'petBottle', count: 4, quad: 1 },
        { kind: 'petBottle', count: 4, quad: 4 },
        { kind: 'carton1L', count: 4, quad: 3 },
      ],
      [
        { kind: 'cerealBox', count: 3, quad: 6, pop: 0 },
        { kind: 'pdqChoco', count: 1, quad: 2 },
        { kind: 'pocky', count: 5, quad: 0 },
        { kind: 'snackBox', count: 3, quad: 3 },
        { kind: 'curryBox', count: 3, quad: 5 },
      ],
      [
        { kind: 'pouch', count: 4, quad: 3, pop: 1 },
        { kind: 'pouch', count: 4, quad: 0 },
        { kind: 'pouch', count: 4, quad: 1 },
        { kind: 'pouch', count: 3, quad: 7 },
      ],
      [
        { kind: 'peggedPouch', count: 5, quad: 6, pop: 0 },
        { kind: 'cup', count: 4, quad: 0 },
        { kind: 'cup', count: 3, quad: 1 },
        { kind: 'bowlStack', count: 3, quad: 4 },
      ],
    ];

    const shelfHeights = [0.125, 0.46, 0.80, 1.15];
    for (let sIdx = 0; sIdx < shelfHeights.length; sIdx++) {
      const sy = shelfHeights[sIdx];
      if (sIdx > 0) {
        const board = inkMesh(new RoundedBoxGeometry(0.72, 0.026, lengthZ, 2, 0.008), shelfMetalMat, {
          edges: false,
          subtle: true,
          interior: true,
        });
        board.position.y = sy;
        g.add(board);

        for (const side of [-1, 1]) {
          const strip = createPriceRailMesh(0.012, 0.024, lengthZ, side > 0 ? '+x' : '-x');
          strip.position.set(side * 0.366, sy - 0.001, 0);
          g.add(strip);

          const retainer = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, lengthZ - 0.04), clearAcrylicMat);
          retainer.position.set(side * 0.35, sy + 0.026, 0);
          g.add(retainer);

          // Recessed warm under-shelf LED bar illuminating merchandise tier beneath
          const shelfLed = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, lengthZ - 0.08), gondolaLedMat);
          shelfLed.position.set(side * 0.32, sy - 0.016, 0);
          g.add(shelfLed);

          // Cantilever steel shelf brackets anchoring board into upright standards
          for (const bz of postZs) {
            metalHardwareSpecs.push({ x: centerX + side * 0.16, y: Y0 + sy - 0.024, z: centerZ + bz, sx: 0.27, sy: 0.018, sz: 0.014, color: 0x64748b });
            metalHardwareSpecs.push({
              x: centerX + side * 0.10,
              y: Y0 + sy - 0.056,
              z: centerZ + bz,
              rz: side * 0.58,
              sx: 0.16,
              sy: 0.012,
              sz: 0.012,
              color: 0x64748b,
            });
          }
        }
      }

      const yTop = Y0 + sy + (sIdx === 0 ? 0.0 : 0.012);
      for (const side of [-1, 1]) {
        const plan =
          seed === 1
            ? side < 0
              ? leftCheckoutPlanogram[sIdx]
              : centerLeftPlanogram[sIdx]
            : side < 0
              ? centerRightPlanogram[sIdx]
              : rightWindowPlanogram[sIdx];

        let zCur = centerZ - lengthZ * 0.455;
        const zMax = centerZ + lengthZ * 0.455;
        for (let bIdx = 0; bIdx < plan.length; bIdx++) {
          const blk = plan[bIdx];
          const pitch = SKU_PITCH_Z[blk.kind];
          const blockStart = zCur;

          if (blk.kind === 'peggedPouch') {
            // Chrome Pegboard Hang-Bar & Individual J-Hooks dangling vertical Candy/Gummy pouches!
            const barW = blk.count * pitch;
            metalHardwareSpecs.push({
              x: centerX + side * 0.042,
              y: Y0 + 1.445,
              z: blockStart + barW * 0.5,
              sx: 0.012,
              sy: 0.016,
              sz: barW,
              color: 0xdbeafe,
            });
            for (let i = 0; i < blk.count; i++) {
              const pz = zCur + pitch * 0.5;
              if (pz > zMax - 0.03) break;
              // Horizontal chrome J-hook wire sticking out from pegboard spine
              metalHardwareSpecs.push({
                x: centerX + side * 0.145,
                y: Y0 + 1.432,
                z: pz,
                sx: 0.21,
                sy: 0.007,
                sz: 0.007,
                color: 0xcbd5e1,
              });
              metalHardwareSpecs.push({
                x: centerX + side * 0.246,
                y: Y0 + 1.442,
                z: pz,
                sx: 0.008,
                sy: 0.022,
                sz: 0.008,
                color: 0xe2e8f0,
              });
              for (const depthX of [0.115, 0.205]) {
                pouchSpecs.push({
                  x: centerX + side * depthX,
                  y: Y0 + 1.335,
                  z: pz,
                  rx: (i % 2 === 0 ? 0.025 : -0.025),
                  sx: 0.055,
                  sy: 0.145,
                  sz: 0.105,
                  color: 0xffffff,
                  quad: depthX > 0.15 ? blk.quad : 7,
                });
              }
              zCur += pitch;
            }
          } else if (blk.kind === 'pdqChoco') {
            // Countertop Open Cardboard PDQ Display Caddy holding 5 tight Chocolate Tablet Bars!
            const trayCenterZ = zCur + pitch * 0.5;
            if (trayCenterZ <= zMax - 0.12) {
              const trayX = centerX + side * 0.235;
              boxSpecs.push({ x: trayX, y: yTop + 0.006, z: trayCenterZ, sx: 0.13, sy: 0.010, sz: 0.268, color: 0x3b1e10 });
              boxSpecs.push({ x: trayX + side * 0.062, y: yTop + 0.024, z: trayCenterZ, sx: 0.008, sy: 0.040, sz: 0.268, color: 0x5c2d16 });
              boxSpecs.push({ x: trayX, y: yTop + 0.032, z: trayCenterZ - 0.130, sx: 0.13, sy: 0.056, sz: 0.008, color: 0x5c2d16 });
              boxSpecs.push({ x: trayX, y: yTop + 0.032, z: trayCenterZ + 0.130, sx: 0.13, sy: 0.056, sz: 0.008, color: 0x5c2d16 });
              for (let cBar = 0; cBar < 5; cBar++) {
                packedBoxSpecs.push({
                  x: trayX,
                  y: yTop + 0.072,
                  z: trayCenterZ - 0.098 + cBar * 0.049,
                  rz: side * -0.10,
                  sx: 0.088,
                  sy: 0.128,
                  sz: 0.036,
                  color: 0xffffff,
                  quad: blk.quad,
                });
              }
            }
            zCur += pitch;
          } else {
            for (let i = 0; i < blk.count; i++) {
              const pz = zCur + pitch * 0.5;
              if (pz > zMax - 0.02) break;
              // Back row 100% stocked; Front row leaves occasional natural customer-grab hole
              for (const depthIdx of [0, 1]) {
                const grabHole = depthIdx === 1 && ((seed + sIdx * 3 + bIdx * 5 + i * 7) % 11 === 4);
                if (grabHole) continue;
                const px = centerX + side * (depthIdx === 0 ? 0.115 : 0.252);
                placeGondolaSku(blk.kind, px, yTop, pz, side, blk.quad, false, i + depthIdx);
              }
              zCur += pitch;
            }
          }

          // Angled Retail POP Shelf-Talker Wobbler clipping onto price rail for featured blocks!
          if (blk.pop !== undefined && bIdx < plan.length && zCur <= zMax) {
            const popZ = (blockStart + Math.min(zCur, zMax)) * 0.5;
            popWobblerSpecs.push({
              x: centerX + side * 0.376,
              y: Y0 + sy - 0.004,
              z: popZ,
              ry: side > 0 ? Math.PI / 2 : -Math.PI / 2,
              sx: 0.078,
              sy: 0.062,
              sz: 0.007,
              color: 0xffffff,
              quad: blk.pop,
            });
          }

          // Clear acrylic SKU separator fin ("仕切り") between consecutive brand facings
          if (bIdx < plan.length - 1 && zCur < zMax - 0.04) {
            clearDividerSpecs.push({
              x: centerX + side * 0.19,
              y: yTop + 0.038,
              z: zCur + 0.004,
              sx: 0.28,
              sy: 0.056,
              sz: 0.005,
              color: 0xe0f2fe,
            });
            zCur += 0.012;
          }
        }
      }
    }

    group.add(g);
  }

  createGondolaAisle(-0.42, -1.35, 2.35, 1);
  createGondolaAisle(1.12, -1.35, 2.35, 4);

  // High-detail Stepped Open Dessert Island Case along Right Window (center foreground, clear of locker & ATM!)
  const rightLowChiller = new THREE.Group();
  rightLowChiller.position.set(2.92, Y0, -1.66);

  // Dark recessed toe-kick base + rounded white refrigerated body
  const lcPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 1.96), darkMetalMat);
  lcPlinth.position.y = 0.04;
  rightLowChiller.add(lcPlinth);

  const lcBody = inkMesh(new RoundedBoxGeometry(0.78, 0.78, 2.02, 2, 0.028), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  lcBody.position.y = 0.47;
  rightLowChiller.add(lcBody);

  // Stainless bumper rail + front yellow price strip + perforated air louver
  const lcBumper = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.045, 2.05, 2, 0.014), stainlessMat);
  lcBumper.position.y = 0.76;
  rightLowChiller.add(lcBumper);

  const lcPriceRail = createPriceRailMesh(0.014, 0.028, 1.96, '+x');
  lcPriceRail.position.set(0.394, 0.84, 0);
  rightLowChiller.add(lcPriceRail);

  const lcWellGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.04, 1.90),
    createToonMaterial({
      color: 0xfff9eb,
      emissive: 0xffe4ad,
      emissiveIntensity: 0.58,
      interior: true,
    })
  );
  lcWellGlow.position.y = 0.87;
  rightLowChiller.add(lcWellGlow);

  // Stepped inner display tier + twin acrylic front & back sneeze-guard shields on chrome posts
  const lcStep = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.05, 1.88, 2, 0.012), shelfMetalMat);
  lcStep.position.set(-0.16, 0.90, 0);
  rightLowChiller.add(lcStep);

  for (const gx of [-0.33, 0.33]) {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 1.96), clearAcrylicMat);
    shield.position.set(gx, 0.94, 0);
    rightLowChiller.add(shield);

    for (const pz of [-0.90, 0, 0.90]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.19, 12), stainlessMat);
      post.position.set(gx, 0.94, pz);
      rightLowChiller.add(post);
    }
  }

  // Sculpted 20-segment Parfaits (with fluted whipped-cream swirls) & Custard Puddings
  for (let row = 0; row < 2; row++) {
    const tierOffset = row === 0 ? 0.045 : 0.0;
    for (let col = 0; col < 9; col++) {
      const dx = 2.92 - 0.16 + row * 0.30;
      const dz = -1.66 - 0.86 + col * 0.215;
      const py = Y0 + 0.92 + tierOffset;

      dessertCupSpecs.push({
        x: dx,
        y: py,
        z: dz,
        sx: 0.095,
        sy: 0.088,
        sz: 0.095,
        color: row === 0 ? (col % 2 === 0 ? 0xffc6d6 : 0xb2e4b8) : 0xffe082,
      });

      if (row === 0) {
        // Piped helical whipped-cream swirl + glossy strawberry half on top
        whipSpecs.push({ x: dx, y: py + 0.056, z: dz, sx: 0.064, sy: 0.048, sz: 0.064, color: 0xfffaf2 });
        cylSpecs.push({ x: dx + 0.01, y: py + 0.072, z: dz + 0.008, sx: 0.016, sy: 0.018, sz: 0.016, color: 0xe53935 });
      } else {
        // Glossy caramel glaze sauce dome cap + mini cream dab
        cylSpecs.push({ x: dx, y: py + 0.046, z: dz, sx: 0.042, sy: 0.018, sz: 0.042, color: 0x6d361a });
        whipSpecs.push({ x: dx, y: py + 0.064, z: dz, sx: 0.028, sy: 0.022, sz: 0.028, color: 0xfffaf2 });
      }
    }
  }
  group.add(rightLowChiller);

  // =========================================================================
  // 6. OPEN REFRIGERATED BENTO & ONIGIRI WALL ("便当区、饭团陈列")
  //    Along Back-Center-Left Wall (X in [-2.05, +0.25], Z = -4.02) facing +Z!
  // =========================================================================
  const bentoShowcase = new THREE.Group();
  bentoShowcase.position.set(-0.9, Y0, -4.02);

  // Open-front refrigerated showcase: back panel + side panels + base deck
  const bcBackPanel = inkMesh(new THREE.BoxGeometry(2.32, 2.18, 0.08), creamCabinetMat, {
    interior: true,
  });
  bcBackPanel.position.set(0, 1.09, -0.28);
  bentoShowcase.add(bcBackPanel);

  const bcBaseDeck = inkMesh(new THREE.BoxGeometry(2.32, 0.36, 0.66), creamCabinetMat, {
    interior: true,
  });
  bcBaseDeck.position.set(0, 0.18, 0.01);
  bentoShowcase.add(bcBaseDeck);

  for (const sx of [-1.13, 1.13]) {
    const sideWall = inkMesh(new THREE.BoxGeometry(0.06, 2.18, 0.64), creamCabinetMat, {
      interior: true,
    });
    sideWall.position.set(sx, 1.09, 0.0);
    bentoShowcase.add(sideWall);
  }

  // Crisp warm luminous metal backwall inside open bento chiller
  const bcGlowBack = new THREE.Mesh(
    new THREE.PlaneGeometry(2.16, 1.62),
    createToonMaterial({
      color: 0xfffaf0,
      emissive: 0xffe3a8,
      emissiveIntensity: 0.48,
      interior: true,
    })
  );
  bcGlowBack.position.set(0, 1.18, -0.22);
  bentoShowcase.add(bcGlowBack);

  for (const vy of [0.39, 1.94]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.02), stainlessMat);
    vent.position.set(0, vy, -0.2);
    bentoShowcase.add(vent);
  }

  // Green header canopy strip on bento chiller
  const bcHeader = inkMesh(
    new THREE.BoxGeometry(2.34, 0.22, 0.72),
    createToonMaterial({
      color: 0x20b27c,
      emissive: 0x168058,
      emissiveIntensity: 0.45,
      interior: true,
    }),
    { interior: true }
  );
  bcHeader.position.y = 2.08;
  bentoShowcase.add(bcHeader);

  const riceMat = createToonMaterial({ color: 0xffffff, interior: true });
  const noriMat = createToonMaterial({ color: 0x1d2b24, interior: true });
  const bentoTrayMat = createToonMaterial({ color: 0x2b2220, interior: true });
  const bentoFoodColors = [0xff8a50, 0xffd54f, 0x81c784, 0xe57373];

  const bcTiers = [0.42, 0.78, 1.14, 1.5, 1.82];
  for (let t = 0; t < bcTiers.length; t++) {
    const ty = bcTiers[t];
    const shelf = inkMesh(new THREE.BoxGeometry(2.2, 0.028, 0.54), shelfMetalMat, {
      subtle: true,
      interior: true,
    });
    shelf.position.set(0, ty, 0.05);
    bentoShowcase.add(shelf);

    // Yellow shelf price rail (front +Z printed only, clear of shelf top lip!) + warm under-shelf LED tube
    const bcPriceStrip = createPriceRailMesh(2.18, 0.024, 0.012, '+z');
    bcPriceStrip.position.set(0, ty - 0.002, 0.322);
    bentoShowcase.add(bcPriceStrip);

    const bcLed = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.014, 0.02),
      createToonMaterial({ color: 0xffffff, emissive: 0xffe9b5, emissiveIntensity: 0.78, interior: true })
    );
    bcLed.position.set(0, ty - 0.018, 0.25);
    bentoShowcase.add(bcLed);

    if (t >= 3) {
      // Top two tiers: Double-row upright rounded-triangle ONIGIRI with dark nori wraps & flavor seals
      const sealColors = [0xe53935, 0xff9800, 0x43a047, 0xec407a, 0x29b6f6];
      for (const rzOff of [0.02, 0.16]) {
        let oIdx = 0;
        for (let ox = -0.94; ox <= 0.94; ox += 0.16) {
          const onx = -0.9 + ox;
          const ony = Y0 + ty + 0.058;
          const onz = -4.02 + rzOff;
          // Soft white rounded-triangle rice body
          onigiriTriSpecs.push({ x: onx, y: ony, z: onz, sx: 0.092, sy: 0.088, sz: 0.044, color: 0xfefcf6 });
          // Roasted crispy nori sea-weed jacket hugging the base & sides cleanly
          onigiriTriSpecs.push({ x: onx, y: ony - 0.009, z: onz, sx: 0.096, sy: 0.073, sz: 0.047, color: 0x1a261f });
          // Vertical tear-open ribbon & proud front flavor sticker badge (no coplanar overlap)
          boxSpecs.push({ x: onx, y: ony - 0.012, z: onz + 0.021, sx: 0.01, sy: 0.058, sz: 0.005, color: 0xffd54f });
          boxSpecs.push({
            x: onx,
            y: ony + 0.008,
            z: onz + 0.025,
            sx: 0.038,
            sy: 0.028,
            sz: 0.006,
            color: sealColors[(oIdx + t) % sealColors.length],
          });
          oIdx++;
        }
      }
    } else if (t === 2) {
      // Tier 2: Edge-facing 4-layer Triangle Sandwiches (Bread + Egg/Berry + Lettuce + Bread, 0 coplanar overlap!)
      const fillColors = [0xffd54f, 0xff8a80, 0xfbbf24, 0xf43f5e];
      for (const rzOff of [0.02, 0.16]) {
        let sIdx = 0;
        for (let sx = -0.9; sx <= 0.9; sx += 0.175) {
          const swx = -0.9 + sx;
          const swy = Y0 + ty + 0.068;
          const swz = -4.02 + rzOff;
          const ry = Math.PI * 0.5 - 0.24;
          const nx = Math.sin(ry);
          const nz = Math.cos(ry);
          const fillCol = fillColors[sIdx % fillColors.length];
          onigiriTriSpecs.push({ x: swx - nx * 0.016, y: swy, z: swz - nz * 0.016, ry, sx: 0.104, sy: 0.114, sz: 0.022, color: 0xfff5dc });
          onigiriTriSpecs.push({ x: swx + nx * 0.016, y: swy, z: swz + nz * 0.016, ry, sx: 0.104, sy: 0.114, sz: 0.022, color: 0xfff5dc });
          onigiriTriSpecs.push({ x: swx - nx * 0.003, y: swy - 0.002, z: swz - nz * 0.003, ry, sx: 0.095, sy: 0.104, sz: 0.010, color: fillCol });
          onigiriTriSpecs.push({ x: swx + nx * 0.003, y: swy - 0.002, z: swz + nz * 0.003, ry, sx: 0.093, sy: 0.102, sz: 0.009, color: 0x66bb6a });
          sIdx++;
        }
      }
    } else {
      // Bottom two tiers: Deep rows of multi-compartment Bento Trays + Non-overlapping Donburi Curry Bowls
      let bIdx = 0;
      for (const rzOff of [-0.02, 0.18]) {
        for (let bx = -0.9; bx <= 0.9; bx += 0.285) {
          const btx = -0.9 + bx;
          const bty = Y0 + ty + 0.036;
          const btz = -4.02 + rzOff;
          if ((bIdx + t) % 5 === 2) {
            // Round Curry / Katsudon bowl with strictly vertical-separated rice bed, curry pool & crispy katsu
            cylSpecs.push({ x: btx, y: bty + 0.008, z: btz, sx: 0.105, sy: 0.056, sz: 0.105, color: 0x2b201e });
            cylSpecs.push({ x: btx, y: bty + 0.028, z: btz, sx: 0.088, sy: 0.012, sz: 0.088, color: 0xfffdf5 });
            cylSpecs.push({ x: btx + 0.022, y: bty + 0.036, z: btz, sx: 0.056, sy: 0.008, sz: 0.062, color: 0x9e561c });
            boxSpecs.push({ x: btx + 0.008, y: bty + 0.043, z: btz, sx: 0.072, sy: 0.010, sz: 0.036, color: 0xd98028 });
          } else {
            // Lacquered tray + rice + umeboshi + protein + tamagoyaki + green veggies + price sticker
            boxSpecs.push({ x: btx, y: bty, z: btz, sx: 0.245, sy: 0.042, sz: 0.175, color: (bIdx % 3 === 0 ? 0x6d1b1b : 0x241d1c) });
            boxSpecs.push({ x: btx - 0.056, y: bty + 0.023, z: btz, sx: 0.095, sy: 0.028, sz: 0.135, color: 0xfffdf5 });
            boxSpecs.push({ x: btx - 0.056, y: bty + 0.040, z: btz, sx: 0.022, sy: 0.008, sz: 0.022, color: 0xd93838 });
            boxSpecs.push({
              x: btx + 0.054,
              y: bty + 0.023,
              z: btz - 0.026,
              sx: 0.095,
              sy: 0.028,
              sz: 0.082,
              color: bentoFoodColors[(bIdx + t) % bentoFoodColors.length],
            });
            boxSpecs.push({ x: btx + 0.035, y: bty + 0.023, z: btz + 0.044, sx: 0.048, sy: 0.024, sz: 0.048, color: 0xffd54f });
            boxSpecs.push({ x: btx + 0.084, y: bty + 0.023, z: btz + 0.044, sx: 0.038, sy: 0.024, sz: 0.048, color: 0x66bb6a });
            // Printed white price/nutrition corner badge cleanly atop rice surface
            boxSpecs.push({ x: btx - 0.075, y: bty + 0.040, z: btz + 0.055, sx: 0.052, sy: 0.006, sz: 0.036, color: 0xfff3c4 });
          }
          bIdx++;
        }
      }
    }
  }
  group.add(bentoShowcase);

  // =========================================================================
  // 7. WALK-IN GLASS-DOOR BEVERAGE COOLERS ("饮料柜")
  //    Along Back-Right Wall (X in [+0.32, +3.52], Z = -4.05) facing +Z!
  // =========================================================================
  const drinkWall = new THREE.Group();
  drinkWall.position.set(1.92, Y0, -4.05);

  // Open-front refrigerated drink wall: back wall + side walls + base + top header
  const dwBackWall = inkMesh(new THREE.BoxGeometry(3.16, 2.32, 0.08), stainlessMat, {
    interior: true,
  });
  dwBackWall.position.set(0, 1.16, -0.26);
  drinkWall.add(dwBackWall);

  const dwBase = inkMesh(new THREE.BoxGeometry(3.16, 0.28, 0.62), stainlessMat, {
    interior: true,
  });
  dwBase.position.set(0, 0.14, 0.01);
  drinkWall.add(dwBase);

  const dwTop = inkMesh(new THREE.BoxGeometry(3.16, 0.22, 0.64), stainlessMat, {
    interior: true,
  });
  dwTop.position.set(0, 2.21, 0.02);
  drinkWall.add(dwTop);

  for (const sx of [-1.55, 1.55]) {
    const dwSide = inkMesh(new THREE.BoxGeometry(0.06, 2.32, 0.62), stainlessMat, {
      interior: true,
    });
    dwSide.position.set(sx, 1.16, 0.01);
    drinkWall.add(dwSide);
  }

  // Frosted luminous white-cyan refrigerated backplate inside glass-door beverage cooler
  const dwBackGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.84),
    createToonMaterial({
      color: 0xf4fbff,
      emissive: 0xd9f2ff,
      emissiveIntensity: 0.50,
      interior: true,
    })
  );
  dwBackGlow.position.set(0, 1.18, -0.2);
  drinkWall.add(dwBackGlow);

  // 5 full double-depth shelves of grouped SKU facings (PET bottles, craft cans & 1L cartons) + wire dividers
  const coolerLedMat = createToonMaterial({
    color: 0xffffff,
    emissive: 0xd8f3ff,
    emissiveIntensity: 0.72,
    interior: true,
  });

  const rows = 5;
  const cols = 24;
  // Each shelf has 6 distinct SKU bays of 4 facing units each (indices into bevSkus 0..7)
  const coolerBaySkus = [
    [3, 4, 1, 0, 5, 6], // r=0 Bottom: Milk, Sports, Oolong, Tea, Cola, Lemon (cartons left / 1L+600ml right)
    [0, 1, 5, 6, 4, 0], // r=1 Lower Mid: Green Tea, Oolong, Cola, Lemon, Aquarius, Green Tea
    [2, 3, 2, 1, 0, 5], // r=2 Upper Mid: Craft Boss Black/Latte square bottles + Tea/Cola
    [4, 5, 6, 0, 1, 3], // r=3 Eye-level: Water, Cola, Lemon, Tea, Oolong, Milk Tea
    [7, 2, 3, 7, 6, 5], // r=4 Top Cans: Dry Silver, Coffee, Latte, Dry 250ml, Lemon Energy, Cola Mini
  ];

  for (let r = 0; r < rows; r++) {
    const sy = 0.34 + r * 0.38;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.02, 0.024, 0.44), stainlessMat);
    shelf.position.set(0, sy, 0.12);
    drinkWall.add(shelf);

    const rail = createPriceRailMesh(3.0, 0.024, 0.01, '+z');
    rail.position.set(0, sy, 0.344);
    drinkWall.add(rail);

    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.014, 0.018), coolerLedMat);
    ledStrip.position.set(0, sy - 0.016, 0.3);
    drinkWall.add(ledStrip);

    // Clear acrylic SKU lane dividers & promotional POP wobblers along cooler shelves
    for (let divIdx = 1; divIdx < 6; divIdx++) {
      const divX = 1.92 - 1.42 + (divIdx * 4 - 0.5) * 0.122;
      clearDividerSpecs.push({ x: divX, y: Y0 + sy + 0.044, z: -4.05 + 0.08, sx: 0.005, sy: 0.062, sz: 0.36, color: 0xffffff });
    }
    if (r === 1 || r === 3) {
      popWobblerSpecs.push({
        x: 1.92 - 1.42 + (r === 1 ? 9.5 : 17.5) * 0.122,
        y: Y0 + sy - 0.004,
        z: -4.05 + 0.354,
        sx: 0.078,
        sy: 0.062,
        sz: 0.007,
        color: 0xffffff,
        quad: r === 1 ? 0 : 1,
      });
    }

    for (const rowZ of [-0.04, 0.16]) {
      for (let c = 0; c < cols; c++) {
        // Leave occasional front bottle sold out for natural evening stock feel
        if (rowZ > 0 && ((r * 7 + c * 11) % 19 === 6)) continue;

        const wx = 1.92 - 1.42 + c * 0.122;
        const wz = -4.05 + rowZ;
        const qDrink = coolerBaySkus[r][Math.floor(c / 4)];
        const bSku = bevSkus[qDrink];

        if (r === 4) {
          // Top shelf mix: 350ml craft beer/coffee cans & tall slim 250ml energy cans
          if (c >= 12) {
            energyCanSpecs.push({ x: wx, y: Y0 + sy + 0.088, z: wz, sx: 0.062, sy: 0.152, sz: 0.062, color: 0xffffff, quad: qDrink });
            cylSpecs.push({ x: wx, y: Y0 + sy + 0.165, z: wz, sx: 0.022, sy: 0.008, sz: 0.022, color: 0xe2e8f0 });
          } else {
            canSpecs.push({ x: wx, y: Y0 + sy + 0.072, z: wz, sx: 0.064, sy: 0.118, sz: 0.064, color: 0xffffff, quad: qDrink });
            cylSpecs.push({ x: wx, y: Y0 + sy + 0.131, z: wz, sx: 0.028, sy: 0.008, sz: 0.028, color: 0xe2e8f0 });
          }
        } else if (r === 0 && c < 12) {
          // Bottom-left bays: 1L Gabled Paper Milk / Cafe Latte / Tea Cartons
          cartonSpecs.push({ x: wx, y: Y0 + sy + 0.125, z: wz, sx: 0.084, sy: 0.22, sz: 0.084, color: bSku.carton });
          boxSpecs.push({ x: wx, y: Y0 + sy + 0.125, z: wz + 0.044, sx: 0.068, sy: 0.088, sz: 0.006, color: bSku.cap });
        } else if (r === 2 && c < 12) {
          // Mid shelf left: Squared Craft Boss coffee & tea PET bottles
          sqBottleSpecs.push({ x: wx, y: Y0 + sy + 0.095, z: wz, sx: 0.068, sy: 0.175, sz: 0.068, color: bSku.bottle });
          bevWrapSpecs.push({ x: wx, y: Y0 + sy + 0.088, z: wz, sx: 0.037, sy: 0.066, sz: 0.037, color: 0xffffff, quad: qDrink });
          cylSpecs.push({ x: wx, y: Y0 + sy + 0.19, z: wz, sx: 0.015, sy: 0.02, sz: 0.015, color: bSku.cap });
        } else {
          // Sculpted PET Bottles grouped cleanly by SKU with full-color 4x2 brand labels & caps
          const hScale = r === 0 ? 1.16 : 0.96;
          petSpecs.push({ x: wx, y: Y0 + sy + 0.105 * hScale, z: wz, sx: 0.072, sy: 0.185 * hScale, sz: 0.072, color: bSku.bottle });
          bevWrapSpecs.push({ x: wx, y: Y0 + sy + 0.095 * hScale, z: wz, sx: 0.038, sy: 0.070, sz: 0.038, color: 0xffffff, quad: qDrink });
          cylSpecs.push({
            x: wx,
            y: Y0 + sy + 0.205 * hScale,
            z: wz,
            sx: 0.015,
            sy: 0.022,
            sz: 0.015,
            color: bSku.cap,
          });
        }
      }
    }
  }

  // 5 Glass Door mullions, frosted glass panes & curved stainless handles across front of drink cooler
  for (let d = 0; d <= 5; d++) {
    const dx = -1.52 + d * 0.608;
    const stile = inkMesh(new RoundedBoxGeometry(0.04, 2.1, 0.05, 2, 0.01), stainlessMat, {
      edges: false,
      subtle: true,
      interior: true,
    });
    stile.position.set(dx, 1.16, 0.34);
    drinkWall.add(stile);

    if (d < 5) {
      const doorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 2.02),
        createToonMaterial({
          color: 0xd9f2ff,
          emissive: 0x8cc8ef,
          emissiveIntensity: 0.08,
          transparent: true,
          opacity: 0.14,
          interior: true,
        })
      );
      doorGlass.position.set(dx + 0.304, 1.16, 0.34);
      drinkWall.add(doorGlass);

      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 12), stainlessMat);
      handle.position.set(dx + 0.52, 1.12, 0.385);
      drinkWall.add(handle);
    }
  }
  group.add(drinkWall);

  // =========================================================================
  // 8. BACKROOM DOOR ("后场门"), PARCEL LOCKERS ("储物柜") & ATM / COPIER
  // =========================================================================
  // Backroom Staff Door on Back-Left Wall (X = -2.78, Z = -4.36)
  const staffDoorTex = createBackroomDoorTexture();
  const staffDoor = inkMesh(
    new THREE.BoxGeometry(0.92, 2.06, 0.05),
    createToonMaterial({ map: staffDoorTex, color: 0xffffff, interior: true }),
    { interior: true }
  );
  staffDoor.position.set(-2.78, Y0 + 1.03, -4.36);
  group.add(staffDoor);

  // Round porthole window in staff door
  const porthole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16),
    createToonMaterial({
      color: 0xffe4b3,
      emissive: 0xffc870,
      emissiveIntensity: 0.55,
      interior: true,
    })
  );
  porthole.rotation.x = Math.PI / 2;
  porthole.position.set(-2.78, Y0 + 1.48, -4.35);
  group.add(porthole);

  // Parcel Pickup Lockers ("PUDO 宅配ロッカー") clear of beverage cooler doors (z = -3.16 -> -3.58..-2.74)
  const lockerUnit = new THREE.Group();
  lockerUnit.position.set(3.30, Y0, -3.16);

  const lockerBody = inkMesh(
    new RoundedBoxGeometry(0.52, 1.88, 0.84, 2, 0.022),
    createToonMaterial({ color: 0x3b82c4, interior: true }),
    { edges: false, hull: true, interior: true }
  );
  lockerBody.position.y = 0.94;
  lockerUnit.add(lockerBody);

  // Locker compartment doors, recessed handle bars & glowing control touchscreen console facing -X
  const lockerDoorMat = createToonMaterial({ color: 0xdbeafe, interior: true });
  for (let lr = 0; lr < 4; lr++) {
    for (let lc = 0; lc < 2; lc++) {
      if (lr === 2 && lc === 1) {
        // Control console bay with recessed touchscreen & scanner window
        const panel = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.38, 0.36, 2, 0.008), darkMetalMat);
        panel.position.set(-0.265, 0.32 + lr * 0.42, -0.2 + lc * 0.4);
        lockerUnit.add(panel);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.24, 0.18),
          createToonMaterial({ color: 0xffd54f, emissive: 0xffb300, emissiveIntensity: 0.65, interior: true })
        );
        screen.rotation.y = -Math.PI / 2;
        screen.position.set(-0.283, 0.36 + lr * 0.42, -0.2 + lc * 0.4);
        lockerUnit.add(screen);
      } else {
        const door = inkMesh(new RoundedBoxGeometry(0.025, 0.38, 0.36, 2, 0.008), lockerDoorMat, {
          edges: false,
          subtle: true,
          interior: true,
        });
        door.position.set(-0.265, 0.32 + lr * 0.42, -0.2 + lc * 0.4);
        lockerUnit.add(door);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.02), darkMetalMat);
        handle.position.set(-0.28, 0.32 + lr * 0.42, -0.2 + lc * 0.4 + 0.12);
        lockerUnit.add(handle);
      }
    }
  }
  group.add(lockerUnit);

  // Bank ATM / Multifunction Copy Station next to front-right corner (X = +2.86, Z = -0.12, clear of dessert chiller!)
  const atmGroup = new THREE.Group();
  atmGroup.position.set(2.86, Y0, -0.12);
  atmGroup.rotation.y = -Math.PI * 0.75;

  // Lower beveled copier / paper-cassette cabinet + 3 recessed drawer pulls
  const atmLower = inkMesh(new RoundedBoxGeometry(0.58, 0.88, 0.6, 2, 0.024), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  atmLower.position.y = 0.44;
  atmGroup.add(atmLower);

  for (let dr = 0; dr < 3; dr++) {
    const tray = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.16, 0.03, 2, 0.008), shelfMetalMat);
    tray.position.set(0, 0.18 + dr * 0.21, 0.295);
    atmGroup.add(tray);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.015), darkMetalMat);
    grip.position.set(0, 0.21 + dr * 0.21, 0.312);
    atmGroup.add(grip);
  }

  // Intermediate control deck + cash/card/receipt bezel
  const atmDeck = inkMesh(new RoundedBoxGeometry(0.56, 0.14, 0.62, 2, 0.02), stainlessMat, {
    edges: false,
    subtle: true,
    interior: true,
  });
  atmDeck.position.set(0, 0.93, 0.02);
  atmGroup.add(atmDeck);

  const pinPad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.12), darkMetalMat);
  pinPad.position.set(-0.12, 1.005, 0.22);
  atmGroup.add(pinPad);

  const cardReader = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.025, 0.04),
    createToonMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.75, interior: true })
  );
  cardReader.position.set(0.14, 1.005, 0.24);
  atmGroup.add(cardReader);

  // Upper sloped console hood with privacy blinders & glowing touchscreen + bank marquee
  const atmUpper = inkMesh(new RoundedBoxGeometry(0.56, 0.38, 0.44, 2, 0.022), creamCabinetMat, {
    edges: false,
    hull: true,
    interior: true,
  });
  atmUpper.position.set(0, 1.18, -0.06);
  atmGroup.add(atmUpper);

  for (const wx of [-0.25, 0.25]) {
    const wing = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.3, 0.16, 2, 0.008), darkMetalMat);
    wing.position.set(wx, 1.18, 0.20);
    atmGroup.add(wing);
  }

  const atmScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.24),
    createToonMaterial({ color: 0x8be4ff, emissive: 0x38bdf8, emissiveIntensity: 0.65, interior: true })
  );
  atmScreen.position.set(0, 1.19, 0.166);
  atmScreen.rotation.x = -0.22;
  atmGroup.add(atmScreen);

  const atmTopSign = inkMesh(
    new RoundedBoxGeometry(0.56, 0.18, 0.42, 2, 0.018),
    createToonMaterial({ color: 0x22a876, emissive: 0x168058, emissiveIntensity: 0.42, interior: true }),
    { edges: false, subtle: true, interior: true }
  );
  atmTopSign.position.set(0, 1.46, -0.06);
  atmGroup.add(atmTopSign);

  const atmBackPoster = inkMesh(
    createQuadAtlasBoxGeometry(2, 0.42, 0.64, 0.014, 0.044, 0.036, 0.006),
    createToonMaterial({
      map: postersGridTex,
      color: 0xffffff,
      emissive: 0xffe4b8,
      emissiveMap: postersGridTex,
      emissiveIntensity: 0.36,
      interior: true,
    }),
    { subtle: true, interior: true }
  );
  atmBackPoster.position.set(0, 0.90, -0.312);
  atmBackPoster.rotation.y = Math.PI;
  atmGroup.add(atmBackPoster);
  group.add(atmGroup);

  // Interior Matcha Parfait Promotional Wall Poster near Checkout (Quad 3 of 2x2 poster sheet)
  const innerPoster = new THREE.Mesh(
    createQuadAtlasBoxGeometry(3, 0.54, 0.78, 0.012, 0.044, 0.036, 0.006),
    createToonMaterial({
      map: postersGridTex,
      color: 0xffffff,
      emissive: 0xfff0d0,
      emissiveMap: postersGridTex,
      emissiveIntensity: 0.42,
      interior: true,
    })
  );
  innerPoster.rotation.y = Math.PI / 2;
  innerPoster.position.set(-3.36, Y0 + 1.68, 0.95);
  group.add(innerPoster);

  // Build InstancedMeshes for all collected high-detail 3D merchandise inside clutterGroup
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const instBaseMat = createToonMaterial({ color: 0xffffff, interior: true, roughness: 0.48 });
  const hardwareMatInst = createToonMaterial({ color: 0xffffff, interior: true, roughness: 0.30 });
  const dividerMatInst = createToonMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.34,
    interior: true,
    roughness: 0.12,
  });
  const cupMatInst = createToonMaterial({ map: cupNoodleTex, color: 0xffffff, interior: true, roughness: 0.58 });
  const pouchMatInst = createToonMaterial({ map: pouchPrintTex, color: 0xffffff, interior: true, roughness: 0.25 });
  const boxMatInst = createToonMaterial({ map: snackBoxTex, color: 0xffffff, interior: true, roughness: 0.55 });
  const bevMatInst = createToonMaterial({ map: bevLabelTex, color: 0xffffff, interior: true, roughness: 0.24 });
  const iceMatInst = createToonMaterial({ map: iceAtlasTex, color: 0xffffff, interior: true, roughness: 0.32 });
  const cigMatInst = createToonMaterial({ map: cigAtlasTex, color: 0xffffff, interior: true, roughness: 0.42 });
  const popWobblerMatInst = createToonMaterial({
    map: popWobblerTex,
    color: 0xffffff,
    emissive: 0xffe4b8,
    emissiveMap: popWobblerTex,
    emissiveIntensity: 0.24,
    interior: true,
    roughness: 0.42,
  });
  const foodMatInst = createToonMaterial({ color: 0xffffff, interior: true, roughness: 0.85 });

  function buildInstanced(
    geo: THREE.BufferGeometry,
    specs: InstanceSpec[],
    mat = instBaseMat
  ) {
    if (specs.length === 0) return;
    const inst = new THREE.InstancedMesh(geo, mat, specs.length);
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      dummy.position.set(sp.x, sp.y, sp.z);
      dummy.rotation.set(sp.rx ?? 0, sp.ry ?? 0, sp.rz ?? 0);
      dummy.scale.set(sp.sx, sp.sy, sp.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      cTmp.setHex(sp.color);
      inst.setColorAt(i, cTmp);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    clutterGroup.add(inst);
  }

  function buildAtlasInstanced(
    baseGeoFactory: () => THREE.BufferGeometry,
    specs: InstanceSpec[],
    mat: ReturnType<typeof createToonMaterial>,
    cols = 4,
    rows = 2,
    pad = 0.005
  ) {
    const total = cols * rows;
    const uW = 1 / cols;
    const vH = 1 / rows;
    for (let q = 0; q < total; q++) {
      const qSpecs = specs.filter((s) => ((s.quad ?? 0) % total) === q);
      if (qSpecs.length === 0) continue;
      const geo = baseGeoFactory();
      const col = q % cols;
      const rowBottom = rows - 1 - Math.floor(q / cols);
      cropGeometryUv(
        geo,
        col * uW + pad,
        rowBottom * vH + pad,
        (col + 1) * uW - pad,
        (rowBottom + 1) * vH - pad
      );
      buildInstanced(geo, qSpecs, mat);
    }
  }

  buildInstanced(new THREE.BoxGeometry(1, 1, 1), boxSpecs);
  buildInstanced(new THREE.BoxGeometry(1, 1, 1), metalHardwareSpecs, hardwareMatInst);
  buildInstanced(new THREE.BoxGeometry(1, 1, 1), clearDividerSpecs, dividerMatInst);
  buildAtlasInstanced(() => new THREE.BoxGeometry(1, 1, 1), popWobblerSpecs, popWobblerMatInst, 2, 1, 0.006);
  buildAtlasInstanced(() => new THREE.BoxGeometry(1, 1, 1), packedBoxSpecs, boxMatInst, 4, 2, 0.005);
  buildAtlasInstanced(() => new THREE.BoxGeometry(1, 1, 1), cigPackSpecs, cigMatInst, 4, 2, 0.005);
  buildAtlasInstanced(() => new THREE.BoxGeometry(1, 1, 1), iceBoxSpecs, iceMatInst, 4, 2, 0.005);
  buildAtlasInstanced(createChipPouchGeometry, icePouchSpecs, iceMatInst, 4, 2, 0.005);
  buildAtlasInstanced(() => new THREE.CylinderGeometry(1, 0.78, 1, 20), iceCupSpecs, iceMatInst, 4, 2, 0.005);
  buildInstanced(new THREE.CylinderGeometry(1, 0.85, 1, 20), cylSpecs);
  buildAtlasInstanced(createCupNoodleGeometry, cupNoodleSpecs, cupMatInst, 4, 2, 0.005);
  buildAtlasInstanced(createWideBowlGeometry, wideBowlSpecs, cupMatInst, 4, 2, 0.005);
  buildAtlasInstanced(createChipPouchGeometry, pouchSpecs, pouchMatInst, 4, 2, 0.005);
  buildInstanced(createGabledCartonGeometry(), cartonSpecs);
  buildInstanced(createPetBottleBodyGeometry(), petSpecs);
  buildInstanced(createSquareBottleGeometry(), sqBottleSpecs);
  buildAtlasInstanced(createCanGeometry, canSpecs, bevMatInst, 4, 2, 0.005);
  buildAtlasInstanced(createEnergyCanGeometry, energyCanSpecs, bevMatInst, 4, 2, 0.005);
  buildAtlasInstanced(() => new THREE.CylinderGeometry(1, 0.94, 1, 20), bevWrapSpecs, bevMatInst, 4, 2, 0.005);
  buildInstanced(createBakeryLoafGeometry(), loafSpecs, foodMatInst);
  buildInstanced(createPastryBunGeometry(), bunSpecs, foodMatInst);
  buildInstanced(createDessertCupGeometry(), dessertCupSpecs);
  buildInstanced(createWhippedCreamGeometry(), whipSpecs, foodMatInst);
  buildInstanced(createOnigiriPrismGeometry(), onigiriTriSpecs, foodMatInst);

  if (magCoverSpecs.length > 0) {
    const magMat = createToonMaterial({
      map: magGridTex,
      color: 0xffffff,
      emissive: 0xfff8ec,
      emissiveMap: magGridTex,
      emissiveIntensity: 0.18,
      interior: true,
    });
    for (let q = 0; q < 4; q++) {
      const qSpecs = magCoverSpecs.filter((s) => (s.quad ?? 0) === q);
      if (qSpecs.length === 0) continue;
      const geo = createQuadAtlasBoxGeometry(q, 1, 1, 1, 0.005, 0.005, 0.005);
      const magInst = new THREE.InstancedMesh(geo, magMat, qSpecs.length);
      for (let i = 0; i < qSpecs.length; i++) {
        const sp = qSpecs[i];
        dummy.position.set(sp.x, sp.y, sp.z);
        dummy.rotation.set(sp.rx ?? 0, sp.ry ?? 0, sp.rz ?? 0);
        dummy.scale.set(sp.sx, sp.sy, sp.sz);
        dummy.updateMatrix();
        magInst.setMatrixAt(i, dummy.matrix);
        cTmp.setHex(sp.color);
        magInst.setColorAt(i, cTmp);
      }
      magInst.instanceMatrix.needsUpdate = true;
      if (magInst.instanceColor) magInst.instanceColor.needsUpdate = true;
      clutterGroup.add(magInst);
    }
  }

  return {
    group,
    clutterGroup,
    steamSprites,
  };
}
