import * as THREE from 'three';

export interface ToonMatOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  emissiveMap?: THREE.Texture | null;
  interior?: boolean;
  wetRim?: boolean;
  wetRimColor?: THREE.ColorRepresentation;
  wetRimStrength?: number;
  roughness?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  polygonOffset?: boolean;
  polygonOffsetFactor?: number;
}

export class AnimeToonMaterial extends THREE.ShaderMaterial {
  declare uniforms: {
    uColor: { value: THREE.Color };
    uMap: { value: THREE.Texture | null };
    uHasMap: { value: number };
    uMapRepeat: { value: THREE.Vector2 };
    uEmissive: { value: THREE.Color };
    uEmissiveIntensity: { value: number };
    uEmissiveMap: { value: THREE.Texture | null };
    uHasEmissiveMap: { value: number };
    uInterior: { value: number };
    uWetRim: { value: number };
    uWetRimColor: { value: THREE.Color };
    uRoughness: { value: number };
    uOpacity: { value: number };
  };

  constructor(opts: ToonMatOptions) {
    const mapTex = opts.map ?? null;
    const emMapTex = opts.emissiveMap ?? null;
    const repeat = mapTex
      ? mapTex.repeat.clone()
      : emMapTex
      ? emMapTex.repeat.clone()
      : new THREE.Vector2(1, 1);

    const uniforms = {
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uMap: { value: mapTex },
      uHasMap: { value: mapTex ? 1.0 : 0.0 },
      uMapRepeat: { value: repeat },
      uEmissive: {
        value:
          opts.emissive !== undefined
            ? new THREE.Color(opts.emissive)
            : new THREE.Color(0x000000),
      },
      uEmissiveIntensity: { value: opts.emissiveIntensity ?? 0.0 },
      uEmissiveMap: { value: emMapTex },
      uHasEmissiveMap: { value: emMapTex ? 1.0 : 0.0 },
      uInterior: { value: opts.interior ? 1.0 : 0.0 },
      uWetRim: { value: opts.wetRim ? (opts.wetRimStrength ?? 0.26) : 0.0 },
      uWetRimColor: { value: new THREE.Color(opts.wetRimColor ?? 0x7cb8ff) },
      uRoughness: { value: opts.roughness ?? 0.48 },
      uOpacity: { value: opts.opacity ?? 1.0 },
    };

    super({
      uniforms,
      transparent: opts.transparent ?? false,
      side: opts.side ?? THREE.FrontSide,
      polygonOffset: opts.polygonOffset ?? false,
      polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
      polygonOffsetUnits: opts.polygonOffset ? 1 : 0,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vInstColor;

        void main() {
          vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vInstColor = instanceColor;
          #else
            vInstColor = vec3(1.0);
          #endif

          vec4 localPos = vec4(position, 1.0);
          vec3 localNormal = normal;

          #ifdef USE_INSTANCING
            localPos = instanceMatrix * localPos;
            localNormal = mat3(instanceMatrix) * localNormal;
          #endif

          vec4 wp = modelMatrix * localPos;
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform sampler2D uMap;
        uniform float uHasMap;
        uniform vec2 uMapRepeat;
        uniform vec3 uEmissive;
        uniform float uEmissiveIntensity;
        uniform sampler2D uEmissiveMap;
        uniform float uHasEmissiveMap;
        uniform float uInterior;
        uniform float uWetRim;
        uniform vec3 uWetRimColor;
        uniform float uRoughness;
        uniform float uOpacity;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vInstColor;

        // NaN-free sRGB-to-linear curve so CanvasTextures match ACES + OutputPass accurately
        vec3 decodeSRGB(vec3 c) {
          vec3 s = clamp(c, 0.0, 1.0);
          return s * (s * 0.72 + 0.28);
        }

        float celBand3(float x, float t1, float t2, float v0, float v1, float v2) {
          float s1 = smoothstep(t1 - 0.03, t1 + 0.03, x);
          float s2 = smoothstep(t2 - 0.03, t2 + 0.03, x);
          return mix(mix(v0, v1, s1), v2, s2);
        }

        float hash31(vec3 p) {
          p = fract(p * vec3(127.1, 311.7, 74.7));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float vnoise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float n000 = hash31(i);
          float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
          float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
          float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
          float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
          float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
          float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
          float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
          return mix(
            mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
            mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
            f.z
          );
        }

        void main() {
          vec3 N = normalize(vWorldNormal);
          if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(cameraPosition - vWorldPos);

          vec3 base = decodeSRGB(uColor) * decodeSRGB(vInstColor);
          float alpha = uOpacity;

          if (uHasMap > 0.5) {
            vec4 texel = texture2D(uMap, vUv * uMapRepeat);
            base *= decodeSRGB(texel.rgb);
            alpha *= texel.a;
          }

          // Multi-scale painterly patina, rain-streaked weathering & fine surface tooth (zero plastic look!)
          float macroPatina = vnoise3(vWorldPos * 1.9 + vec3(2.3, 0.7, 4.1)) * 0.14 - 0.07;
          float microTooth = vnoise3(vWorldPos * 16.0) * 0.07 - 0.035;
          float vertRainStreak = (vnoise3(vec3(vWorldPos.x * 5.2, vWorldPos.y * 0.7, vWorldPos.z * 5.2)) - 0.5)
            * 0.11 * (1.0 - abs(N.y));
          float surfaceTex = 1.0 + macroPatina * (0.45 + uRoughness * 0.65)
            + microTooth * (0.5 + uRoughness * 0.7)
            + (uInterior < 0.5 ? vertRainStreak : 0.0);

          vec3 celLight;
          float wetSpec = 0.0;
          float ao = 1.0;

          if (uInterior > 0.5) {
            // WARM JAPANESE KONBINI INTERIOR CEL LIGHTING WITH REAL DEPTH CONTRAST
            vec3 indoorDir = normalize(vec3(0.32, 0.86, 0.40));
            float ndl = dot(N, indoorDir) * 0.5 + 0.5;
            float band = celBand3(ndl, 0.36, 0.70, 0.52, 0.77, 0.96);
            celLight = mix(vec3(0.92, 0.76, 0.58), vec3(1.04, 0.94, 0.80), clamp(ndl, 0.0, 1.0)) * band;
            // Subtle floor kick & ceiling cove contact AO inside store
            float floorAo = mix(0.76, 1.0, smoothstep(0.16, 0.54, vWorldPos.y));
            float ceilAo = mix(1.0, 0.86, smoothstep(2.45, 2.86, vWorldPos.y));
            ao = floorAo * ceilAo;
            // Crisp satin shelf / package specular highlight ONLY on low-roughness items
            vec3 H = normalize(indoorDir + V);
            float specPow = mix(0.90, 0.97, 1.0 - clamp(uRoughness, 0.0, 1.0));
            wetSpec = smoothstep(specPow, specPow + 0.025, dot(N, H)) * (1.0 - uRoughness * 0.85) * 0.22;
          } else {
            // COOL NOCTURNAL RAINY NIGHT ANIME CEL LIGHTING + WARM/NEON SPATIAL POOLS
            vec3 moonDir = normalize(vec3(0.42, 0.78, 0.46));
            float ndl = dot(N, moonDir) * 0.5 + 0.5;
            float skyUp = N.y * 0.5 + 0.5;
            float baseTone = celBand3(ndl * 0.72 + skyUp * 0.28, 0.38, 0.68, 0.16, 0.31, 0.49);
            celLight = vec3(0.56, 0.74, 1.10) * baseTone;

            // Grounding Contact AO: sidewalk curb & wall bases + upright prop bases
            if (vWorldPos.y >= 0.12 && vWorldPos.y < 0.17 && N.y > 0.7) {
              // Soft AO where konbini building walls & alley walls meet sidewalk
              float bDist = length(max(vec2(0.0), abs(vWorldPos.xz - vec2(0.1, -1.4)) - vec2(3.65, 3.15)));
              ao *= mix(0.68, 1.0, smoothstep(0.0, 0.38, bDist));
            } else if (vWorldPos.y >= 0.14 && vWorldPos.y < 0.65 && N.y < 0.8) {
              // Subtle contact shadow at bottom of vending machines, rails, poles, bins, bike
              ao *= mix(0.76, 1.0, smoothstep(0.14, 0.46, vWorldPos.y));
            }

            // 1. Warm golden konbini window & chamfered doorway spill onto exterior props/sidewalk!
            vec3 toFrontWin = vec3(-0.6, 1.65, 1.65) - vWorldPos;
            float dFront = length(toFrontWin * vec3(0.38, 0.55, 0.65));
            float faceFront = clamp(dot(N, normalize(vec3(0.0, 0.35, -0.94))) * 0.5 + 0.65, 0.0, 1.0);
            float frontMask = step(1.65, vWorldPos.z) * exp(-dFront * 1.15) * faceFront;

            vec3 toCornerDoor = vec3(2.85, 1.55, 0.85) - vWorldPos;
            float dCorner = length(toCornerDoor * vec3(0.5, 0.55, 0.5));
            float cornerMask = step(0.2, vWorldPos.x + vWorldPos.z - 2.6) * exp(-dCorner * 1.15);

            vec3 toSideWin = vec3(3.65, 1.65, -1.95) - vWorldPos;
            float dSide = length(toSideWin * vec3(0.65, 0.55, 0.42));
            float sideMask = step(3.65, vWorldPos.x) * exp(-dSide * 1.2);

            float warmStoreSpill = clamp(frontMask * 0.72 + cornerMask * 0.68 + sideMask * 0.58, 0.0, 0.85);
            celLight += vec3(1.06, 0.75, 0.38) * warmStoreSpill;

            // 2. Streetlamp crisp cool-white pool at corner (+3.85, 4.95, 4.95)
            float dLamp = length((vWorldPos - vec3(3.75, 1.2, 4.45)) * vec3(0.36, 0.22, 0.36));
            celLight += vec3(0.58, 0.74, 0.98) * exp(-dLamp * 1.2) * clamp(N.y * 0.5 + 0.65, 0.0, 1.0) * 0.68;

            // 3. Vending machines cool cyan-blue neon spill
            float dVend1 = length((vWorldPos - vec3(-4.0, 1.1, 2.05)) * vec3(0.65, 0.55, 0.65));
            float dVend2 = length((vWorldPos - vec3(4.55, 1.1, -4.06)) * vec3(0.65, 0.55, 0.65));
            celLight += vec3(0.24, 0.68, 1.02) * (exp(-dVend1 * 1.35) + exp(-dVend2 * 1.35)) * 0.58;

            // 4. Alleyway warm lantern + Community bulletin board warm hood light
            float dAlley = length((vWorldPos - vec3(-5.25, 1.85, 0.75)) * vec3(0.55, 0.48, 0.55));
            float dBoard = length((vWorldPos - vec3(-6.95, 1.45, 1.05)) * vec3(0.62, 0.62, 0.65));
            celLight += vec3(1.02, 0.68, 0.34) * (exp(-dAlley * 1.25) * 0.65 + exp(-dBoard * 1.4) * 0.58);

            // 5. Canopy soffit warm downlight right under the eaves!
            float underCanopy = smoothstep(3.0, 2.2, vWorldPos.y) * smoothstep(0.0, 0.5, vWorldPos.y);
            float nearEave = exp(-length(max(vec2(0.0), abs(vWorldPos.xz - vec2(0.4, -0.8)) - vec2(3.8, 2.9))) * 2.2);
            celLight += vec3(0.92, 0.72, 0.44) * underCanopy * nearEave * 0.22;

            // 6. Roughness-aware stylized cel wet-film specular glint on rain-slicked surfaces
            if (uWetRim > 0.01) {
              vec3 H1 = normalize(moonDir + V);
              vec3 lampDir = normalize(vec3(3.85, 4.95, 4.95) - vWorldPos);
              vec3 H2 = normalize(lampDir + V);
              float specTight = mix(0.945, 0.90, uRoughness);
              float s1 = smoothstep(specTight - 0.02, specTight + 0.01, dot(N, H1)) * 0.52;
              float s2 = smoothstep(specTight, specTight + 0.025, dot(N, H2)) * 0.44;
              wetSpec = (s1 + s2) * clamp(uWetRim * 1.6, 0.12, 0.52) * (1.1 - uRoughness * 0.78);
            }
          }

          // Emissive contribution (attenuate diffuse celLight slightly on backlit panels so signage stays crisp)
          vec3 em = decodeSRGB(uEmissive) * uEmissiveIntensity;
          if (uHasEmissiveMap > 0.5) {
            vec3 emTex = decodeSRGB(texture2D(uEmissiveMap, vUv * uMapRepeat).rgb);
            em *= emTex;
          }
          float selfLitDamp = 1.0 - clamp(uEmissiveIntensity, 0.0, 0.7) * 0.48;

          // Wet rainy-night anime grazing rim sheen
          float fBase = clamp(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 0.0, 1.0);
          float rim = fBase * fBase * fBase * clamp(N.y * 0.6 + 0.5, 0.0, 1.0) * uWetRim;

          vec3 outCol = base * celLight * surfaceTex * ao * selfLitDamp + em + decodeSRGB(uWetRimColor) * (rim + wetSpec);
          gl_FragColor = vec4(clamp(outCol, 0.0, 2.5), alpha);
        }
      `,
    });
  }

  get emissiveIntensity(): number {
    return this.uniforms.uEmissiveIntensity.value;
  }

  set emissiveIntensity(v: number) {
    this.uniforms.uEmissiveIntensity.value = v;
  }
}

const matCache = new Map<string, AnimeToonMaterial>();

export function createToonMaterial(opts: ToonMatOptions): AnimeToonMaterial {
  const isSimpleCacheable =
    !opts.map &&
    !opts.emissiveMap &&
    !opts.transparent &&
    !opts.polygonOffset &&
    opts.side === undefined &&
    opts.emissiveIntensity === undefined;

  const cacheKey = isSimpleCacheable
    ? `${opts.color ?? '#ffffff'}|${opts.emissive ?? '#000000'}|${!!opts.interior}|${!!opts.wetRim}|${opts.wetRimColor ?? ''}|${opts.wetRimStrength ?? ''}|${opts.roughness ?? 0.48}`
    : '';

  if (cacheKey && matCache.has(cacheKey)) {
    return matCache.get(cacheKey)!;
  }

  const mat = new AnimeToonMaterial(opts);
  if (cacheKey) {
    matCache.set(cacheKey, mat);
  }
  return mat;
}

const edgeLineMatExterior = new THREE.LineBasicMaterial({
  color: 0x0f1629,
  transparent: true,
  opacity: 0.65,
});

const edgeLineMatInterior = new THREE.LineBasicMaterial({
  color: 0x4a2f20,
  transparent: true,
  opacity: 0.45,
});

const edgeLineMatSubtle = new THREE.LineBasicMaterial({
  color: 0x1a2644,
  transparent: true,
  opacity: 0.36,
});

const hullMatCache = new Map<string, THREE.ShaderMaterial>();

export function getSilhouetteMaterial(thickness = 0.012, colorHex = 0x101628): THREE.ShaderMaterial {
  const key = `${thickness.toFixed(4)}_${colorHex}`;
  if (hullMatCache.has(key)) return hullMatCache.get(key)!;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(colorHex) },
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec3 displaced = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
  hullMatCache.set(key, mat);
  return mat;
}

export interface InkOptions {
  edges?: boolean;
  thresholdAngle?: number;
  interior?: boolean;
  subtle?: boolean;
  hull?: boolean;
  hullThickness?: number;
  hullColor?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function inkMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  opts: InkOptions = {}
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  if (opts.edges !== false) {
    const edgeGeo = new THREE.EdgesGeometry(geometry, opts.thresholdAngle ?? 26);
    const lineMat = opts.interior
      ? edgeLineMatInterior
      : opts.subtle
      ? edgeLineMatSubtle
      : edgeLineMatExterior;
    const lines = new THREE.LineSegments(edgeGeo, lineMat);
    lines.renderOrder = 1;
    mesh.add(lines);
  }

  if (opts.hull) {
    const hull = new THREE.Mesh(
      geometry,
      getSilhouetteMaterial(
        opts.hullThickness ?? 0.012,
        opts.hullColor ?? (opts.interior ? 0x3b2519 : 0x101628)
      )
    );
    mesh.add(hull);
  }

  return mesh;
}
