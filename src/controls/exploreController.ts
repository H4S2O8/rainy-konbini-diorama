import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ExploreMode = 'orbit' | 'walk';

export interface ExploreControllerOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  container: HTMLElement;
  orbitControls: OrbitControls;
  raycastTargets: THREE.Object3D[];
  getDoorOpenAmount: () => number;
  orbitFov?: number;
  walkFov?: number;
  orbitNear?: number;
  walkNear?: number;
}

export interface ExploreController {
  getMode: () => ExploreMode;
  getDoorProximity: () => number | null;
  isInsideKonbini: () => boolean;
  enterWalkAt: (x: number, z: number, lookTargetX?: number, lookTargetZ?: number) => void;
  returnToOrbit: () => void;
  update: (delta: number) => void;
  dispose: () => void;
}

interface Aabb2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Circle2D {
  x: number;
  z: number;
  r: number;
}

const PLAYER_RADIUS = 0.20;
const EYE_HEIGHT = 1.54;
const WALK_SPEED = 2.45;
const RUN_SPEED = 3.95;

// Entrance doorway center & rotation matching konbiniBuilding.ts (2.74, 0.16, 0.74, rotY = PI/4)
const DOOR_X = 2.74;
const DOOR_Z = 0.74;
const COS45 = Math.SQRT1_2;

// Building wall & interior fixture colliders (carefully tuned to preserve every 0.78m+ retail aisle)
const STATIC_BOXES: Aabb2D[] = [
  // Exterior building solid walls (leaving chamfered entrance corner open for entrance check)
  { minX: -3.66, maxX: 3.86, minZ: -4.66, maxZ: -4.34 }, // Back wall
  { minX: -3.66, maxX: -3.35, minZ: -4.66, maxZ: 1.84 }, // Left alley wall
  { minX: -3.66, maxX: 1.72, minZ: 1.58, maxZ: 1.84 }, // Front panoramic window wall
  { minX: 3.57, maxX: 3.86, minZ: -4.66, maxZ: -0.26 }, // Right rear pier + window wall

  // Interior fixtures
  { minX: -3.40, maxX: -1.70, minZ: -1.48, maxZ: 0.44 }, // Checkout counter + coffee + hot case
  { minX: -3.02, maxX: -0.48, minZ: 1.14, maxZ: 1.60 }, // Front window magazine rack
  { minX: -0.20, maxX: 1.30, minZ: 0.80, maxZ: 1.56 }, // Island ice cream chest freezer
  { minX: -0.78, maxX: -0.06, minZ: -2.52, maxZ: 0.10 }, // Left double-sided gondola + end-cap
  { minX: 0.76, maxX: 1.48, minZ: -2.52, maxZ: 0.10 }, // Right double-sided gondola + end-cap
  { minX: 2.52, maxX: 3.32, minZ: -2.69, maxZ: -0.63 }, // Right dessert parfait open chiller
  { minX: -2.14, maxX: 3.55, minZ: -4.38, maxZ: -3.68 }, // Back bento showcase + 5-door cold drink wall
  { minX: 3.00, maxX: 3.58, minZ: -3.59, maxZ: -2.73 }, // Rear-right parcel locker tower

  // Exterior buildings & large rectilinear street props
  { minX: -8.95, maxX: -5.85, minZ: -7.45, maxZ: -1.80 }, // Neighboring cottage annex
  { minX: -4.46, maxX: -3.54, minZ: 1.14, maxZ: 1.82 }, // Front-left vending machine
  { minX: 3.82, maxX: 4.48, minZ: -4.52, maxZ: -3.60 }, // Side blue vending machine
  { minX: -7.40, maxX: -5.35, minZ: 0.55, maxZ: 1.30 }, // Neighborhood bulletin board
  { minX: -4.12, maxX: -0.38, minZ: 4.08, maxZ: 4.24 }, // Front street guardrails
  { minX: 5.08, maxX: 5.24, minZ: -3.92, maxZ: -0.18 }, // Right street guardrails
  { minX: 7.86, maxX: 8.78, minZ: 4.38, maxZ: 5.32 }, // Traffic signal island pedestal
];

const STATIC_CIRCLES: Circle2D[] = [
  { x: 2.86, z: -0.12, r: 0.36 }, // Corner ATM kiosk
  { x: 4.62, z: 3.18, r: 0.22 }, // Main corner utility pole
  { x: 5.14, z: 2.55, r: 0.14 }, // Convex mirror pole
  { x: 3.12, z: 4.02, r: 0.16 }, // Corner streetlight
  { x: 2.95, z: 4.12, r: 0.12 }, // Crosswalk sign pole
  { x: -1.28, z: 4.12, r: 0.12 }, // Stop sign pole
  { x: 0.55, z: 2.68, r: 0.45 }, // Parked mint bicycle
  { x: 1.25, z: 2.22, r: 0.22 }, // Umbrella stand
  { x: 3.52, z: 4.08, r: 0.36 }, // Corner guardrail segments
  { x: 4.42, z: 3.68, r: 0.36 },
  { x: 4.96, z: 2.98, r: 0.34 },
  { x: -8.45, z: 3.88, r: 0.28 }, // Pylon sign post
  { x: -5.35, z: 0.65, r: 0.28 }, // Alley lantern gate pillar
];

function pushOutCircleAabb(pos: { x: number; z: number }, r: number, box: Aabb2D) {
  const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.z = cz + (dz / d) * r;
    return;
  }

  const dLeft = pos.x - box.minX;
  const dRight = box.maxX - pos.x;
  const dBack = pos.z - box.minZ;
  const dFront = box.maxZ - pos.z;
  const m = Math.min(dLeft, dRight, dBack, dFront);
  if (m === dLeft) pos.x = box.minX - r;
  else if (m === dRight) pos.x = box.maxX + r;
  else if (m === dBack) pos.z = box.minZ - r;
  else pos.z = box.maxZ + r;
}

function resolveChamferDoorWall(pos: { x: number; z: number }, r: number, doorOpen: number) {
  // Transform world XZ into entranceGroup local space (origin 2.74, 0.74, local +Z = +X/+Z)
  const dx = pos.x - DOOR_X;
  const dz = pos.z - DOOR_Z;
  const local = {
    x: dx * COS45 - dz * COS45,
    z: dx * COS45 + dz * COS45,
  };

  // Fixed left & right chamfered sidelights + corner columns
  pushOutCircleAabb(local, r, { minX: -1.62, maxX: -0.68, minZ: -0.16, maxZ: 0.16 });
  pushOutCircleAabb(local, r, { minX: 0.68, maxX: 1.62, minZ: -0.16, maxZ: 0.16 });

  // Central automatic doors block passage only when closed (< 0.42 open)
  if (doorOpen < 0.42) {
    pushOutCircleAabb(local, r, { minX: -0.68, maxX: 0.68, minZ: -0.09, maxZ: 0.12 });
  }

  // Transform back to world XZ
  pos.x = DOOR_X + local.x * COS45 + local.z * COS45;
  pos.z = DOOR_Z - local.x * COS45 + local.z * COS45;
}

function isInsideStoreFootprint(x: number, z: number): boolean {
  return x >= -3.52 && x <= 3.68 && z >= -4.52 && z <= 1.70 && x + z <= 3.55;
}

function getSurfaceHeight(x: number, z: number): number {
  if (isInsideStoreFootprint(x, z)) return 0.16;
  // Main L-shaped sidewalk apron with rounded corner fillet around (4.0, 3.0), R = 1.4
  if (x >= -4.4 && x <= 5.4 && z >= -8.98 && z <= 4.4) {
    if (!(x > 4.0 && z > 3.0 && Math.hypot(x - 4.0, z - 3.0) > 1.4)) {
      return 0.14;
    }
  }
  // Left neighborhood courtyard raised pad
  if (x >= -8.98 && x <= -5.35 && z >= -8.98 && z <= 0.65) return 0.14;
  // Traffic signal concrete island
  if (x >= 7.84 && x <= 8.80 && z >= 4.37 && z <= 5.33) return 0.14;
  return 0.0;
}

function resolveAllCollisions(pos: { x: number; z: number }, doorOpen: number) {
  for (let pass = 0; pass < 2; pass++) {
    pos.x = THREE.MathUtils.clamp(pos.x, -8.65, 8.65);
    pos.z = THREE.MathUtils.clamp(pos.z, -8.65, 8.65);

    for (const box of STATIC_BOXES) {
      pushOutCircleAabb(pos, PLAYER_RADIUS, box);
    }
    for (const c of STATIC_CIRCLES) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minD = PLAYER_RADIUS + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        const d = Math.max(1e-4, Math.sqrt(d2));
        pos.x = c.x + (dx / d) * minD;
        pos.z = c.z + (dz / d) * minD;
      }
    }
    resolveChamferDoorWall(pos, PLAYER_RADIUS, doorOpen);
  }
}

export function createExploreController(opts: ExploreControllerOptions): ExploreController {
  const orbitFov = opts.orbitFov ?? 34;
  const walkFov = opts.walkFov ?? 56;
  const orbitNear = opts.orbitNear ?? 0.25;
  const walkNear = opts.walkNear ?? 0.08;

  let mode: ExploreMode = 'orbit';
  let transitionActive = false;
  let transitionT = 0;
  const TRANSITION_DUR = 0.72;

  const startPos = new THREE.Vector3();
  const startQuat = new THREE.Quaternion();
  const targetPos = new THREE.Vector3();
  const targetQuat = new THREE.Quaternion();
  let startFov = orbitFov;
  let goalFov = orbitFov;
  let startNear = orbitNear;
  let goalNear = orbitNear;
  let transitionEndMode: ExploreMode = 'orbit';

  // Saved Orbit state so returning to Orbit restores exact viewing perspective
  const savedOrbitPos = opts.camera.position.clone();
  const savedOrbitTarget = opts.orbitControls.target.clone();

  // First-person player state (default entrance threshold looking straight inside!)
  const playerPos = new THREE.Vector3(4.18, 0.14 + EYE_HEIGHT, 2.18);
  let yaw = Math.PI * 0.25; // Looking NW straight into corner automatic doors
  let pitch = -0.04;
  let wheelStepImpulse = 0;
  let bobPhase = 0;

  const keysDown = new Set<string>();
  let isDragging = false;
  let activePointerId = -1;
  let lastPointerX = 0;
  let lastPointerY = 0;

  // =========================================================================
  // Minimal Frosted Glass HUD Pill (Compact, Unobtrusive, Stops Drag Leaks)
  // =========================================================================
  const hud = document.createElement('div');
  hud.id = 'explore-hud';
  hud.innerHTML = `
    <style>
      #explore-hud {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 30;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif;
        pointer-events: none;
      }
      #explore-hud .hud-bar {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 6px;
        border-radius: 999px;
        background: rgba(11, 19, 36, 0.76);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(148, 178, 224, 0.24);
        box-shadow: 0 8px 26px rgba(2, 6, 18, 0.45);
        pointer-events: auto;
      }
      #explore-hud button {
        appearance: none;
        border: none;
        background: transparent;
        color: #cbd5e1;
        font-size: 12.5px;
        font-weight: 600;
        padding: 6px 13px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 0.18s ease, color 0.18s ease, transform 0.12s ease;
        white-space: nowrap;
      }
      #explore-hud button:hover {
        color: #ffffff;
        background: rgba(148, 178, 224, 0.16);
      }
      #explore-hud button.active {
        background: linear-gradient(135deg, #0ea5e9, #2563eb);
        color: #ffffff;
        box-shadow: 0 2px 10px rgba(37, 99, 235, 0.42);
      }
      #explore-hud .hud-sep {
        width: 1px;
        height: 16px;
        background: rgba(148, 178, 224, 0.22);
        margin: 0 2px;
      }
      #explore-hud .walk-tools {
        display: none;
        align-items: center;
        gap: 4px;
      }
      #explore-hud.is-walk .walk-tools {
        display: flex;
      }
      #explore-hud .walk-tools button {
        font-size: 11.5px;
        padding: 5px 10px;
        color: #94a3b8;
      }
      #explore-hud .walk-tools button:hover {
        color: #f8fafc;
      }
      #explore-hud .hud-tip {
        font-size: 11px;
        letter-spacing: 0.02em;
        color: rgba(203, 213, 225, 0.72);
        background: rgba(9, 15, 30, 0.55);
        padding: 3px 12px;
        border-radius: 999px;
        backdrop-filter: blur(8px);
      }
    </style>
    <div class="hud-bar">
      <button type="button" data-mode="orbit" class="active">微缩全景</button>
      <button type="button" data-mode="walk">进店探索</button>
      <div class="walk-tools">
        <span class="hud-sep"></span>
        <button type="button" data-spot="entrance">门外</button>
        <button type="button" data-spot="aisles">货架区</button>
        <button type="button" data-spot="counter">收银台</button>
        <button type="button" data-spot="cooler">饮料便当</button>
        <span class="hud-sep"></span>
        <button type="button" data-action="lock">锁视角</button>
      </div>
    </div>
    <div class="hud-tip">点击「进店探索」或双击地面进店 · WASD/滚轮移动 · 拖拽环顾 · Esc 退回全景</div>
  `;
  opts.container.appendChild(hud);

  const btnOrbit = hud.querySelector<HTMLButtonElement>('button[data-mode="orbit"]')!;
  const btnWalk = hud.querySelector<HTMLButtonElement>('button[data-mode="walk"]')!;
  const btnLock = hud.querySelector<HTMLButtonElement>('button[data-action="lock"]')!;
  const tipEl = hud.querySelector<HTMLElement>('.hud-tip')!;

  const stopBubble = (e: Event) => e.stopPropagation();
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'dblclick'] as const) {
    hud.addEventListener(ev, stopBubble);
  }

  function syncHudState() {
    const isWalk = mode === 'walk' || (transitionActive && transitionEndMode === 'walk');
    hud.classList.toggle('is-walk', isWalk);
    btnOrbit.classList.toggle('active', !isWalk);
    btnWalk.classList.toggle('active', isWalk);
    opts.container.style.cursor = isWalk ? (document.pointerLockElement ? 'none' : 'grab') : 'grab';
    tipEl.textContent = isWalk
      ? 'WASD/方向键/滚轮 移动 · 拖拽或点「锁视角」自由环顾 · F/Esc 退回全景'
      : '点击「进店探索」或双击街道/店内地面 · 按 F 快速漫步';
  }

  function computeLookQuat(yAngle: number, pAngle: number): THREE.Quaternion {
    const euler = new THREE.Euler(pAngle, yAngle, 0, 'YXZ');
    return new THREE.Quaternion().setFromEuler(euler);
  }

  function startSwoop(destMode: ExploreMode, destPos: THREE.Vector3, destQuat: THREE.Quaternion) {
    transitionActive = true;
    transitionT = 0;
    transitionEndMode = destMode;
    startPos.copy(opts.camera.position);
    startQuat.copy(opts.camera.quaternion);
    targetPos.copy(destPos);
    targetQuat.copy(destQuat);
    startFov = opts.camera.fov;
    goalFov = destMode === 'walk' ? walkFov : orbitFov;
    startNear = opts.camera.near;
    goalNear = destMode === 'walk' ? walkNear : orbitNear;
    opts.orbitControls.enabled = false;
    syncHudState();
  }

  function enterWalkAt(x: number, z: number, lookTargetX?: number, lookTargetZ?: number) {
    if (mode === 'orbit' && !transitionActive) {
      savedOrbitPos.copy(opts.camera.position);
      savedOrbitTarget.copy(opts.orbitControls.target);
    }

    const pos2d = { x, z };
    resolveAllCollisions(pos2d, 1.0);
    const groundY = getSurfaceHeight(pos2d.x, pos2d.z);
    playerPos.set(pos2d.x, groundY + EYE_HEIGHT, pos2d.z);

    if (lookTargetX !== undefined && lookTargetZ !== undefined) {
      yaw = Math.atan2(-(lookTargetX - pos2d.x), -(lookTargetZ - pos2d.z));
      pitch = -0.05;
    } else {
      // Face toward entrance / konbini center cleanly
      yaw = Math.atan2(-(0.2 - pos2d.x), -(-0.8 - pos2d.z));
      pitch = -0.04;
    }

    mode = 'walk';
    wheelStepImpulse = 0;
    const goalQuat = computeLookQuat(yaw, pitch);
    startSwoop('walk', playerPos, goalQuat);
  }

  function returnToOrbit() {
    if (document.pointerLockElement === opts.domElement) {
      document.exitPointerLock();
    }
    if (mode === 'orbit' && !transitionActive) return;

    keysDown.clear();
    isDragging = false;
    wheelStepImpulse = 0;
    mode = 'orbit';

    const tempCam = opts.camera.clone();
    tempCam.position.copy(savedOrbitPos);
    tempCam.lookAt(savedOrbitTarget);
    opts.orbitControls.target.copy(savedOrbitTarget);
    startSwoop('orbit', savedOrbitPos, tempCam.quaternion);
  }

  // Preset indoor/entrance exploration spots
  const SPOTS: Record<string, [number, number, number, number]> = {
    entrance: [4.18, 2.18, 2.40, 0.40],
    aisles: [0.35, 0.42, 0.35, -2.50],
    counter: [-1.18, -0.35, -2.25, -0.55],
    cooler: [2.05, -0.55, 1.85, -3.95],
  };

  btnOrbit.addEventListener('click', () => returnToOrbit());
  btnWalk.addEventListener('click', () => {
    if (mode === 'walk') return;
    const [x, z, lx, lz] = SPOTS.entrance;
    enterWalkAt(x, z, lx, lz);
  });

  hud.querySelectorAll<HTMLButtonElement>('button[data-spot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sp = SPOTS[btn.dataset.spot ?? 'entrance'];
      if (sp) enterWalkAt(sp[0], sp[1], sp[2], sp[3]);
    });
  });

  btnLock.addEventListener('click', () => {
    if (document.pointerLockElement === opts.domElement) {
      document.exitPointerLock();
    } else {
      opts.domElement.requestPointerLock?.();
    }
  });

  // Keyboard & Pointer Look handlers
  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'KeyF') {
      e.preventDefault();
      if (mode === 'orbit') {
        const [x, z, lx, lz] = SPOTS.entrance;
        enterWalkAt(x, z, lx, lz);
      } else {
        returnToOrbit();
      }
      return;
    }
    if (e.code === 'Escape' && mode === 'walk') {
      if (document.pointerLockElement !== opts.domElement) {
        returnToOrbit();
      }
      return;
    }

    const isMoveKey =
      e.code === 'KeyW' ||
      e.code === 'KeyA' ||
      e.code === 'KeyS' ||
      e.code === 'KeyD' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight';

    if (isMoveKey && mode === 'orbit' && !transitionActive) {
      const [x, z, lx, lz] = SPOTS.entrance;
      enterWalkAt(x, z, lx, lz);
    }

    keysDown.add(e.code);
  }

  function onKeyUp(e: KeyboardEvent) {
    keysDown.delete(e.code);
  }

  function onPointerDown(e: PointerEvent) {
    if (mode !== 'walk' || transitionActive) return;
    if (e.button !== 0 && e.button !== 2) return;
    isDragging = true;
    activePointerId = e.pointerId;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    opts.container.style.cursor = 'grabbing';
  }

  function onPointerMove(e: PointerEvent) {
    if (mode !== 'walk' || transitionActive) return;
    if (document.pointerLockElement === opts.domElement) {
      yaw -= e.movementX * 0.0024;
      pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0024, -1.22, 1.22);
      return;
    }
    if (!isDragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    yaw += dx * 0.0036;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0034, -1.22, 1.22);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId === activePointerId) {
      isDragging = false;
      activePointerId = -1;
      if (mode === 'walk') {
        opts.container.style.cursor = document.pointerLockElement ? 'none' : 'grab';
      }
    }
  }

  function onWheel(e: WheelEvent) {
    if (mode !== 'walk' || transitionActive) return;
    e.preventDefault();
    const dir = -Math.sign(e.deltaY);
    wheelStepImpulse = THREE.MathUtils.clamp(wheelStepImpulse + dir * 0.72, -1.4, 1.4);
  }

  const raycaster = new THREE.Raycaster();
  const clickNdc = new THREE.Vector2();
  function onDblClick(e: MouseEvent) {
    const rect = opts.domElement.getBoundingClientRect();
    clickNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    clickNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(clickNdc, opts.camera);
    const hits = raycaster.intersectObjects(opts.raycastTargets, true);
    const groundHit = hits.find((h) => h.point.y >= -0.05 && h.point.y <= 1.15);
    if (!groundHit) return;
    const hx = groundHit.point.x;
    const hz = groundHit.point.z;
    if (Math.abs(hx) <= 8.6 && Math.abs(hz) <= 8.6) {
      const lookX = isInsideStoreFootprint(hx, hz) ? hx - Math.sin(yaw) * 2.0 : 2.5;
      const lookZ = isInsideStoreFootprint(hx, hz) ? hz - Math.cos(yaw) * 2.0 : 0.4;
      enterWalkAt(hx, hz, lookX, lookZ);
    }
  }

  function onPointerLockChange() {
    const locked = document.pointerLockElement === opts.domElement;
    btnLock.classList.toggle('active', locked);
    syncHudState();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  opts.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  opts.domElement.addEventListener('wheel', onWheel, { passive: false });
  opts.domElement.addEventListener('dblclick', onDblClick);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  syncHudState();

  function update(delta: number) {
    const dt = Math.min(delta, 0.05);

    if (transitionActive) {
      transitionT += dt / TRANSITION_DUR;
      const rawT = Math.min(1, transitionT);
      // Smooth cubic ease-in-out
      const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      opts.camera.position.lerpVectors(startPos, targetPos, ease);
      opts.camera.quaternion.slerpQuaternions(startQuat, targetQuat, ease);

      const newFov = THREE.MathUtils.lerp(startFov, goalFov, ease);
      const newNear = THREE.MathUtils.lerp(startNear, goalNear, ease);
      if (Math.abs(newFov - opts.camera.fov) > 0.01 || Math.abs(newNear - opts.camera.near) > 0.001) {
        opts.camera.fov = newFov;
        opts.camera.near = newNear;
        opts.camera.updateProjectionMatrix();
      }

      if (rawT >= 1) {
        transitionActive = false;
        mode = transitionEndMode;
        if (mode === 'orbit') {
          opts.orbitControls.enabled = true;
          opts.orbitControls.update();
        }
        syncHudState();
      }
      return;
    }

    if (mode !== 'walk') {
      opts.orbitControls.update();
      return;
    }

    // First-person movement along XZ ground plane
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let moveF = 0;
    let moveR = 0;
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveF += 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveF -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveR += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveR -= 1;

    let speed = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    const hasKeyMove = moveF !== 0 || moveR !== 0;
    if (hasKeyMove) {
      const len = Math.hypot(moveF, moveR);
      moveF /= len;
      moveR /= len;
    }

    let vx = (fwdX * moveF + rightX * moveR) * speed;
    let vz = (fwdZ * moveF + rightZ * moveR) * speed;

    if (Math.abs(wheelStepImpulse) > 0.005) {
      vx += fwdX * wheelStepImpulse * 3.2;
      vz += fwdZ * wheelStepImpulse * 3.2;
      wheelStepImpulse *= Math.exp(-8.0 * dt);
    } else {
      wheelStepImpulse = 0;
    }

    const nextPos = {
      x: playerPos.x + vx * dt,
      z: playerPos.z + vz * dt,
    };
    resolveAllCollisions(nextPos, opts.getDoorOpenAmount());

    const movedDist = Math.hypot(nextPos.x - playerPos.x, nextPos.z - playerPos.z);
    playerPos.x = nextPos.x;
    playerPos.z = nextPos.z;

    const targetGroundY = getSurfaceHeight(playerPos.x, playerPos.z) + EYE_HEIGHT;
    playerPos.y += (targetGroundY - playerPos.y) * Math.min(1, dt * 14.0);

    if (movedDist > 0.001) {
      bobPhase += movedDist * 5.2;
    }
    const subtleBob = movedDist > 0.001 ? Math.sin(bobPhase) * 0.014 : 0;

    opts.camera.position.set(playerPos.x, playerPos.y + subtleBob, playerPos.z);
    opts.camera.rotation.order = 'YXZ';
    opts.camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function getDoorProximity(): number | null {
    if (mode !== 'walk' && !(transitionActive && transitionEndMode === 'walk')) return null;
    const px = transitionActive ? targetPos.x : playerPos.x;
    const pz = transitionActive ? targetPos.z : playerPos.z;
    return Math.hypot(px - DOOR_X, pz - DOOR_Z);
  }

  function isInsideKonbini(): boolean {
    if (mode !== 'walk') return false;
    return isInsideStoreFootprint(playerPos.x, playerPos.z);
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    opts.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    opts.domElement.removeEventListener('wheel', onWheel);
    opts.domElement.removeEventListener('dblclick', onDblClick);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    hud.remove();
  }

  return {
    getMode: () => mode,
    getDoorProximity,
    isInsideKonbini,
    enterWalkAt,
    returnToOrbit,
    update,
    dispose,
  };
}
