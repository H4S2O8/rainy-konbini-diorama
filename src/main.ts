import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { createDioramaBase } from './scene/dioramaBase';
import { createKonbiniBuilding } from './scene/konbiniBuilding';
import { createKonbiniInterior } from './scene/konbiniInterior';
import { createExteriorProps } from './scene/exteriorProps';
import { createWeatherEffects } from './scene/weatherEffects';
import { setupNightAmbience } from './audio/nightAmbience';
import { createExploreController } from './controls/exploreController';

const container = document.getElementById('app')!;

// ============================================================================
// 1. RENDERER, SCENE & COLLECTIBLE DIORAMA SKY BACKDROP
// ============================================================================
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.90;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Smooth nocturnal anime gradient sky sphere with drifting soft rainy night clouds
const skyGeo = new THREE.SphereGeometry(68, 32, 24);
const skyUniforms = {
  uTime: { value: 0 },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: skyUniforms,
  vertexShader: `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vWorldPos;

    float hash21(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 34.5);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
      vec3 dir = normalize(vWorldPos);
      float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

      // Deep theatrical midnight indigo sky -> rainy twilight navy horizon
      vec3 nadir = vec3(0.005, 0.009, 0.025);
      vec3 horizon = vec3(0.022, 0.036, 0.082);
      vec3 zenith = vec3(0.006, 0.011, 0.032);

      vec3 col = h < 0.5
        ? mix(nadir, horizon, smoothstep(0.16, 0.5, h))
        : mix(horizon, zenith, smoothstep(0.5, 0.90, h));

      // Subtle drifting anime night rainclouds above horizon
      vec2 cloudUv = dir.xz / (abs(dir.y) + 0.35) * 1.4 + vec2(uTime * 0.008, uTime * 0.004);
      float c1 = noise2(cloudUv * 1.6);
      float c2 = noise2(cloudUv * 3.3 + 4.1);
      float cloud = smoothstep(0.42, 0.85, c1 * 0.65 + c2 * 0.35);
      float upperMask = smoothstep(0.48, 0.68, h) * (1.0 - smoothstep(0.82, 0.98, h));
      col += vec3(0.016, 0.028, 0.062) * cloud * upperMask;

      // Soft nocturnal atmospheric mist band right along horizon line
      float horizonGlow = exp(-abs(dir.y) * 8.5);
      col += vec3(0.014, 0.022, 0.048) * horizonGlow;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

// Subtle atmospheric night mist only at far distance so diorama remains crisp
scene.fog = new THREE.FogExp2(0x0d1629, 0.0085);

// ============================================================================
// 2. CAMERA & FREE ORBIT CONTROLS (ZERO UI)
// ============================================================================
const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / window.innerHeight,
  0.25,
  150
);
const initAspect = window.innerWidth / Math.max(1, window.innerHeight);
const distScale = initAspect < 1.15 ? 1.16 / Math.max(0.68, initAspect) : 1.06;
camera.position.set(19.2 * distScale, 13.6 * distScale, 20.2 * distScale);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.0, 1.25, 0.15);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.rotateSpeed = 0.78;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.75;
controls.screenSpacePanning = true;
controls.minDistance = 1.8;
controls.maxDistance = 48.0;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.492;
controls.update();

// ============================================================================
// 3. LIGHT STATE HANDLES (Analytical Toon Shaders Compute Spatial Pools Directly)
// ============================================================================
const doorwayWarmLight = new THREE.PointLight(0xffcf82, 2.6, 6.8, 1.45);
const trafficLight = new THREE.PointLight(0x1ce092, 2.4, 8.8, 1.4);

// ============================================================================
// 4. BUILD DIORAMA SCENE MODULES
// ============================================================================
const dioramaGroup = new THREE.Group();
scene.add(dioramaGroup);

const base = createDioramaBase();
dioramaGroup.add(base.group);

const building = createKonbiniBuilding();
dioramaGroup.add(building.group);

const interior = createKonbiniInterior();
dioramaGroup.add(interior.group);

const exterior = createExteriorProps();
dioramaGroup.add(exterior.group);

const allDripPoints = [...building.eaveDripPoints, ...exterior.extraDripPoints];
const allFlickerMats = [...building.flickerMaterials, ...exterior.extraFlickerMaterials];

const ambience = setupNightAmbience(renderer.domElement);
let getDoorProximityFn: () => number | null = () => null;

const weather = createWeatherEffects({
  eaveDripPoints: allDripPoints,
  flickerMaterials: allFlickerMats,
  steamSprites: interior.steamSprites,
  acFanMeshes: exterior.acFanMeshes,
  trafficSignal: exterior.trafficSignal,
  trafficLight,
  doorwayWarmLight,
  setDoorOpenAmount: building.setDoorOpenAmount,
  roadUniforms: base.roadUniforms,
  glassUniforms: building.glassUniforms,
  noboriUniforms: exterior.noboriUniforms,
  onDoorOpen: ambience.notifyDoorOpen,
  getDoorProximity: () => getDoorProximityFn(),
});
dioramaGroup.add(weather.group);

const explore = createExploreController({
  camera,
  domElement: renderer.domElement,
  container,
  orbitControls: controls,
  raycastTargets: [base.group, building.group, interior.group],
  getDoorOpenAmount: weather.getDoorOpenAmount,
});
getDoorProximityFn = explore.getDoorProximity;

// ============================================================================
// 5. MSAA POST-PROCESSING (ANIME HALATION BLOOM + OUTPUT)
// ============================================================================
const rtWidth = Math.floor(window.innerWidth * renderer.getPixelRatio());
const rtHeight = Math.floor(window.innerHeight * renderer.getPixelRatio());
const msaaTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
  samples: 2,
  type: THREE.UnsignedByteType,
});

const composer = new EffectComposer(renderer, msaaTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.15, // Subtle controlled cinema halation only on genuine light sources
  0.45,
  1.08
);
composer.addPass(bloomPass);

// Cinematic Film Look Pass: subtle anamorphic flare, split-tone grading, corner CA, vignette & 35mm grain
const cinemaPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uTexel;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec3 highlightTap(vec2 uv) {
      vec3 s = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
      float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
      return s * smoothstep(1.08, 1.85, lum);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Edge-weighted micro chromatic aberration (zero at center so text stays razor sharp!)
      vec2 caShift = centered * r2 * 0.0038;
      float r = texture2D(tDiffuse, clamp(vUv + caShift, 0.001, 0.999)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, clamp(vUv - caShift, 0.001, 0.999)).b;
      vec3 col = vec3(r, g, b);

      // Gentle horizontal anamorphic cinema lens streak strictly on peak light emitters
      vec3 streak = (
        highlightTap(vUv + vec2(uTexel.x * 7.0, 0.0)) +
        highlightTap(vUv - vec2(uTexel.x * 7.0, 0.0)) +
        highlightTap(vUv + vec2(uTexel.x * 16.0, 0.0)) * 0.65 +
        highlightTap(vUv - vec2(uTexel.x * 16.0, 0.0)) * 0.65 +
        highlightTap(vUv + vec2(uTexel.x * 28.0, 0.0)) * 0.35 +
        highlightTap(vUv - vec2(uTexel.x * 28.0, 0.0)) * 0.35
      ) * 0.055;
      col += streak * vec3(0.66, 0.84, 1.12);

      // Theatrical anime split-tone color grading (cool sapphire shadows / soft creamy highlights)
      float lum = clamp(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.5);
      float shadowMask = 1.0 - smoothstep(0.04, 0.36, lum);
      float highlightMask = smoothstep(0.32, 0.95, lum);
      col *= mix(vec3(1.0), vec3(0.86, 0.94, 1.14), shadowMask * 0.55);
      col *= mix(vec3(1.0), vec3(1.01, 0.98, 0.93), highlightMask * 0.35);

      // Soft filmic shoulder roll-off so highlights never clip flat white
      col = col / (1.0 + col * 0.16);

      // Soft optical cinema vignette
      float vigDist = length(centered * vec2(1.12, 1.0));
      float vignette = mix(1.0, 0.58, smoothstep(0.34, 0.88, vigDist));
      col *= vignette;

      // Ultra-fine 35mm film grain
      float grain = (hash12(vUv * 1280.0 + fract(uTime * 17.3) * 193.0) - 0.5) * 0.013;
      col += grain * (1.0 - clamp(lum * 0.75, 0.0, 0.9));

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
});
composer.addPass(cinemaPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ============================================================================
// 6. RESIZE & ANIMATION LOOP
// ============================================================================
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
  cinemaPass.uniforms.uTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
});

const clock = new THREE.Clock();
const panClampMin = new THREE.Vector3(-5.5, -0.2, -5.5);
const panClampMax = new THREE.Vector3(5.5, 4.5, 5.5);
const reflectionHidden: THREE.Object3D[] = [weather.group, interior.clutterGroup];
const lastCamPos = new THREE.Vector3().copy(camera.position);
let frameIdx = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  skyUniforms.uTime.value = elapsed;
  cinemaPass.uniforms.uTime.value = elapsed;

  explore.update(delta);
  if (explore.getMode() === 'orbit') {
    controls.target.clamp(panClampMin, panClampMax);
  }
  ambience.setInsideKonbini(explore.isInsideKonbini());

  weather.update(elapsed, delta);

  // Render street puddle reflections + convex corner mirror reflection
  const camMoved = lastCamPos.distanceToSquared(camera.position) > 0.0002;
  if (camMoved || (frameIdx & 1) === 0) {
    base.updateReflection(renderer, scene, camera, reflectionHidden);
    lastCamPos.copy(camera.position);
  }
  exterior.updateMirrorReflection(renderer, scene);
  frameIdx++;

  // Render main scene with MSAA + Anime Halation Bloom
  composer.render();
}

animate();
