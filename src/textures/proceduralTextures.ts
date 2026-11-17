import * as THREE from 'three';

const publicTextureCache = new Map<string, THREE.Texture>();
const sharedTexLoader = new THREE.TextureLoader();

/** Load and cache a static public graphic asset in sRGB space with crisp filtering (Pages base-safe). */
export function loadPublicTexture(path: string): THREE.Texture {
  const resolved = path.startsWith('/') ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;
  const cached = publicTextureCache.get(resolved);
  if (cached) return cached;
  const tex = sharedTexLoader.load(resolved);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  publicTextureCache.set(resolved, tex);
  return tex;
}

/** Remap a BufferGeometry's normalized 0..1 UVs into a sub-rectangle [u0..u1, v0..v1]. */
export function cropGeometryUv<T extends THREE.BufferGeometry>(
  geo: T,
  u0: number,
  v0: number,
  u1: number,
  v1: number
): T {
  const uv = geo.attributes.uv;
  const du = u1 - u0;
  const dv = v1 - v0;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Build a BoxGeometry(w,h,d) whose UVs sample one quadrant of a 2x2 graphic atlas. */
export function createQuadAtlasBoxGeometry(
  quad: number,
  w = 1,
  h = 1,
  d = 1,
  outerPadU = 0.005,
  outerPadV = 0.005,
  seamPad = 0.005
): THREE.BoxGeometry {
  const col = quad % 2;
  const rowBottom = quad < 2 ? 1 : 0; // quad 0,1 = top row; quad 2,3 = bottom row
  const u0 = col === 0 ? outerPadU : 0.5 + seamPad;
  const u1 = col === 0 ? 0.5 - seamPad : 1.0 - outerPadU;
  const v0 = rowBottom === 0 ? outerPadV : 0.5 + seamPad;
  const v1 = rowBottom === 0 ? 0.5 - seamPad : 1.0 - outerPadV;
  return cropGeometryUv(new THREE.BoxGeometry(w, h, d), u0, v0, u1, v1);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function toTex(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX > 1 || repeatY > 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createKonbiniSignTexture(
  withLogo = true,
  compact = false,
  widthPx = compact ? 744 : 1406
): THREE.CanvasTexture {
  const w = widthPx;
  const h = 200;
  const [c, ctx] = makeCanvas(w, h);

  // Luminous warm ivory-white face
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fffdf7');
  bg.addColorStop(0.5, '#fff9eb');
  bg.addColorStop(1, '#f4ebd8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Classic anime konbini multi-stripe bands (top & bottom)
  ctx.fillStyle = '#189be8';
  ctx.fillRect(0, 10, w, 26);
  ctx.fillStyle = '#20b980';
  ctx.fillRect(0, 41, w, 19);

  ctx.fillStyle = '#ff7838';
  ctx.fillRect(0, h - 42, w, 22);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(0, h - 17, w, 9);

  // Subtle vertical acrylic panel seams
  ctx.strokeStyle = 'rgba(80, 95, 115, 0.16)';
  ctx.lineWidth = 2;
  const panels = compact ? 4 : 8;
  for (let i = 1; i < panels; i++) {
    const px = (w / panels) * i;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }

  if (withLogo) {
    // Compute 1:1 unstretched emblem + kanji layout centered inside exact panel geometry aspect
    const badgeX = compact ? w * 0.21 : w * 0.24;
    ctx.fillStyle = '#198bd6';
    ctx.beginPath();
    ctx.roundRect(badgeX - 36, 70, 72, 72, 14);
    ctx.fill();

    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath();
    ctx.arc(badgeX - 5, 106, 18, 0.25 * Math.PI, 1.65 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#198bd6';
    ctx.beginPath();
    ctx.arc(badgeX + 3, 100, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fe3ff';
    ctx.beginPath();
    ctx.moveTo(badgeX + 14, 90);
    ctx.quadraticCurveTo(badgeX + 24, 107, badgeX + 14, 120);
    ctx.quadraticCurveTo(badgeX + 4, 107, badgeX + 14, 90);
    ctx.fill();

    ctx.fillStyle = '#183254';
    ctx.font = `900 ${compact ? 48 : 58}px "Hiragino Kaku Gothic ProN", "Noto Sans JP", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = compact ? w * 0.60 : w * 0.50;
    ctx.fillText('雨夜マート', textX, 102);

    if (!compact) {
      ctx.fillStyle = '#20a070';
      ctx.font = '800 17px sans-serif';
      ctx.fillText('AMAYA KONBINI  •  EVERYDAY FRESH', textX, 139);

      const badge24X = w * 0.77;
      ctx.fillStyle = '#ff6d33';
      ctx.beginPath();
      ctx.roundRect(badge24X, 72, 118, 66, 12);
      ctx.fill();
      ctx.fillStyle = '#fffdf8';
      ctx.font = '900 34px sans-serif';
      ctx.fillText('24H', badge24X + 59, 97);
      ctx.font = '800 15px sans-serif';
      ctx.fillText('OPEN', badge24X + 59, 123);
    }
  }

  return toTex(c);
}


export function createPylonSignTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#fffcf2';
  ctx.fillRect(0, 0, 256, 512);

  // Top header block
  ctx.fillStyle = '#189be8';
  ctx.fillRect(14, 14, 228, 155);
  ctx.fillStyle = '#20b980';
  ctx.fillRect(14, 174, 228, 22);
  ctx.fillStyle = '#ff7838';
  ctx.fillRect(14, 200, 228, 18);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 54px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  ctx.fillText('雨夜', 128, 82);
  ctx.font = '900 38px sans-serif';
  ctx.fillText('マート', 128, 136);

  // 24H Banner
  ctx.fillStyle = '#193254';
  ctx.font = '900 52px sans-serif';
  ctx.fillText('24H', 128, 278);
  ctx.fillStyle = '#ff6c30';
  ctx.font = '800 22px sans-serif';
  ctx.fillText('年中無休 OPEN', 128, 312);

  // Services sub-panels
  ctx.fillStyle = '#e9eef5';
  ctx.fillRect(20, 336, 216, 3);

  ctx.fillStyle = '#d9483b';
  ctx.beginPath();
  ctx.roundRect(24, 352, 208, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 24px sans-serif';
  ctx.fillText('酒 ・ たばこ', 128, 382);

  ctx.fillStyle = '#209f6c';
  ctx.beginPath();
  ctx.roundRect(24, 406, 208, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('銀行 ATM', 128, 435);

  ctx.fillStyle = '#1e5aa8';
  ctx.beginPath();
  ctx.roundRect(24, 458, 208, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px sans-serif';
  ctx.fillText('P 駐車場あり', 128, 486);

  return toTex(c);
}


export function createExteriorTileTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#bfb6a6'; // Deep crisp mortar joints
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 4;
  const tw = 256 / cols;
  const th = 256 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * tw + offset;
      const y = r * th;
      const shade = 224 + ((r * 13 + col * 29) % 14) - 7;
      ctx.fillStyle = `rgb(${shade}, ${shade - 6}, ${shade - 15})`;
      ctx.fillRect(x + 2, y + 2, tw - 4, th - 4);
      // Subtle top bevel & bottom shadow per ceramic tile
      ctx.fillStyle = 'rgba(255, 252, 245, 0.25)';
      ctx.fillRect(x + 2, y + 2, tw - 4, 2);
      ctx.fillStyle = 'rgba(70, 60, 50, 0.14)';
      ctx.fillRect(x + 2, y + th - 4, tw - 4, 2);
    }
  }
  return toTex(c, 5, 4);
}

export function createSidewalkTileTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#242e42';
  ctx.fillRect(0, 0, 256, 256);

  const n = 4;
  const step = 256 / n;
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      const v = ((r * 17 + col * 31) % 16) - 8;
      ctx.fillStyle = `rgb(${76 + v}, ${90 + v}, ${116 + v})`;
      ctx.fillRect(col * step + 2, r * step + 2, step - 4, step - 4);
      // Crisp top-left bevel highlight & bottom-right shadow seam
      ctx.fillStyle = 'rgba(185, 215, 255, 0.14)';
      ctx.fillRect(col * step + 2, r * step + 2, step - 4, 3);
      ctx.fillRect(col * step + 2, r * step + 2, 3, step - 4);
      ctx.fillStyle = 'rgba(10, 15, 28, 0.28)';
      ctx.fillRect(col * step + 2, (r + 1) * step - 5, step - 4, 3);
    }
  }

  // Fine mineral concrete speckles
  for (let i = 0; i < 650; i++) {
    const sx = (i * 173) % 256;
    const sy = (i * 229) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(200, 220, 250, 0.08)' : 'rgba(12, 18, 30, 0.12)';
    ctx.fillRect(sx, sy, 2, 2);
  }
  return toTex(c, 8, 8);
}

export function createBrailleTileTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#d9ac22';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#9e7810';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 124);

  for (let r = 0; r < 5; r++) {
    for (let col = 0; col < 5; col++) {
      const cx = 18 + col * 23;
      const cy = 18 + r * 23;
      ctx.fillStyle = '#b48914';
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 2, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6cf46';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTex(c, 6, 1);
}

export function createConcreteBlockTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#3b4456';
  ctx.fillRect(0, 0, 512, 256);

  const rows = 5;
  const cols = 6;
  const bw = 512 / cols;
  const bh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off;
      const y = r * bh;
      const v = ((r * 19 + col * 23) % 14) - 7;
      ctx.fillStyle = `rgb(${84 + v}, ${95 + v}, ${116 + v})`;
      ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  }

  // Damp rain darkening & subtle moss gradient near bottom of block wall
  const damp = ctx.createLinearGradient(0, 140, 0, 256);
  damp.addColorStop(0, 'rgba(20, 30, 42, 0)');
  damp.addColorStop(0.7, 'rgba(22, 42, 46, 0.35)');
  damp.addColorStop(1, 'rgba(18, 38, 36, 0.62)');
  ctx.fillStyle = damp;
  ctx.fillRect(0, 140, 512, 116);

  return toTex(c, 2, 1);
}

export function createInteriorFloorTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#ead8bc';
  ctx.fillRect(0, 0, 256, 256);

  const n = 4;
  const s = 256 / n;
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      const warm = (r + col) % 2 === 0 ? '#fbf0dc' : '#f4e6cd';
      ctx.fillStyle = warm;
      ctx.fillRect(col * s + 2, r * s + 2, s - 4, s - 4);
    }
  }
  return toTex(c, 5, 5);
}

export function createQueueDecalTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);

  // Green konbini queue guide bar
  ctx.fillStyle = '#20a672';
  ctx.beginPath();
  ctx.roundRect(12, 18, 488, 92, 18);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(20, 26, 472, 76, 12);
  ctx.stroke();

  // Cute anime shoe/footprint icons + text
  ctx.fillStyle = '#fffef8';
  for (const fx of [72, 98]) {
    ctx.beginPath();
    ctx.ellipse(fx, 64, 9, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ここでお待ちください  ▶', 305, 75);

  return toTex(c);
}


export function createCategoryLightboxTexture(
  jp: string,
  en: string,
  accent: string
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 120);
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, 512, 120);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 26, 120);
  ctx.fillRect(0, 105, 512, 15);

  ctx.fillStyle = '#233248';
  ctx.font = '900 40px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(jp, 48, 60);

  ctx.fillStyle = accent;
  ctx.font = '800 21px sans-serif';
  ctx.fillText(en, 50, 92);

  return toTex(c);
}


export function createPosterTextures(): THREE.CanvasTexture[] {
  const configs = [
    {
      bg1: '#fff3d6',
      bg2: '#ffd089',
      accent: '#d9482b',
      title: 'あつあつ',
      sub: 'おでん解禁',
      badge: '70円〜',
      drawArt: (ctx: CanvasRenderingContext2D) => {
        // Oden bowl illustration
        ctx.fillStyle = '#5a3222';
        ctx.beginPath();
        ctx.arc(128, 265, 76, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#f2dca6';
        ctx.beginPath();
        ctx.ellipse(128, 265, 74, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        // Skewer with kinchaku / daikon / konnyaku
        ctx.fillStyle = '#fff5d8';
        ctx.beginPath();
        ctx.arc(105, 255, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5b841';
        ctx.beginPath();
        ctx.arc(150, 258, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7e8694';
        ctx.beginPath();
        ctx.moveTo(126, 224);
        ctx.lineTo(156, 250);
        ctx.lineTo(116, 254);
        ctx.closePath();
        ctx.fill();
      },
    },
    {
      bg1: '#23385c',
      bg2: '#3f6ca8',
      accent: '#ffad3b',
      title: '淹れたて',
      sub: '夜カフェ珈琲',
      badge: '110円',
      drawArt: (ctx: CanvasRenderingContext2D) => {
        // Hot coffee cup + steam
        ctx.fillStyle = '#fff8ee';
        ctx.beginPath();
        ctx.moveTo(88, 210);
        ctx.lineTo(168, 210);
        ctx.lineTo(154, 326);
        ctx.lineTo(102, 326);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b97745';
        ctx.fillRect(94, 245, 68, 46);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 5;
        for (const sx of [112, 132, 148]) {
          ctx.beginPath();
          ctx.moveTo(sx, 198);
          ctx.quadraticCurveTo(sx - 10, 178, sx + 4, 162);
          ctx.stroke();
        }
      },
    },
    {
      bg1: '#ffe6ee',
      bg2: '#ffc0d4',
      accent: '#e34275',
      title: '秋限定',
      sub: '濃厚プリン',
      badge: 'NEW',
      drawArt: (ctx: CanvasRenderingContext2D) => {
        // Custard pudding illustration
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(128, 305, 74, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcf56';
        ctx.beginPath();
        ctx.moveTo(82, 300);
        ctx.lineTo(98, 226);
        ctx.lineTo(158, 226);
        ctx.lineTo(174, 300);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6e2c14';
        ctx.beginPath();
        ctx.ellipse(128, 228, 31, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e83856';
        ctx.beginPath();
        ctx.arc(128, 212, 12, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    {
      bg1: '#e4f7f0',
      bg2: '#a8e6cf',
      accent: '#169668',
      title: '雨の日割',
      sub: 'おにぎり全品',
      badge: '20円引',
      drawArt: (ctx: CanvasRenderingContext2D) => {
        // Crisp anime onigiri triangle
        ctx.fillStyle = '#fffdf9';
        ctx.beginPath();
        ctx.moveTo(128, 196);
        ctx.quadraticCurveTo(192, 296, 174, 316);
        ctx.lineTo(82, 316);
        ctx.quadraticCurveTo(64, 296, 128, 196);
        ctx.fill();
        ctx.fillStyle = '#1d2824';
        ctx.fillRect(98, 262, 60, 55);
      },
    },
  ];

  return configs.map((cfg) => {
    const [c, ctx] = makeCanvas(256, 384);
    const g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, cfg.bg1);
    g.addColorStop(1, cfg.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 384);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 240, 368);

    const isDark = cfg.bg1.startsWith('#2');
    ctx.fillStyle = isDark ? '#fff8eb' : '#242a38';
    ctx.textAlign = 'center';
    ctx.font = '900 34px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
    ctx.fillText(cfg.title, 128, 62);
    ctx.fillStyle = cfg.accent;
    ctx.font = '900 36px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
    ctx.fillText(cfg.sub, 128, 108);

    cfg.drawArt(ctx);

    ctx.fillStyle = cfg.accent;
    ctx.beginPath();
    ctx.arc(196, 326, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px sans-serif';
    ctx.fillText(cfg.badge, 196, 334);

    return toTex(c);
  });
}

export function createBulletinBoardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 320);
  // Warm corkboard base
  ctx.fillStyle = '#9c734b';
  ctx.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(65,42,20,0.16)' : 'rgba(215,175,130,0.14)';
    ctx.fillRect((i * 73) % 512, (i * 47) % 320, 4, 4);
  }

  const flyers = [
    { x: 24, y: 22, w: 136, h: 178, bg: '#fff8ea', bar: '#e2553e', t1: '町内会だより', t2: '夜間防犯灯点検' },
    { x: 176, y: 28, w: 148, h: 132, bg: '#eef8ff', bar: '#2b86d9', t1: '資源ごみ収集', t2: '毎週水・土曜日' },
    { x: 342, y: 20, w: 144, h: 184, bg: '#fff3f6', bar: '#e04f7b', t1: '迷い猫探してます', t2: '茶トラ・青い首輪' },
    { x: 34, y: 214, w: 196, h: 86, bg: '#f1faee', bar: '#2ea36b', t1: '虹ヶ丘二丁目 防災訓練', t2: '11月23日 午前9時 公園集合' },
    { x: 248, y: 176, w: 84, h: 120, bg: '#fff5cc', bar: '#d98a1e', t1: '秋祭り', t2: '御礼' },
  ];

  for (const f of flyers) {
    ctx.fillStyle = 'rgba(20, 12, 6, 0.28)';
    ctx.fillRect(f.x + 4, f.y + 5, f.w, f.h);
    ctx.fillStyle = f.bg;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = f.bar;
    ctx.fillRect(f.x, f.y, f.w, 26);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.t1, f.x + f.w / 2, f.y + 18);

    ctx.fillStyle = '#2c3545';
    ctx.font = '700 13px sans-serif';
    ctx.fillText(f.t2, f.x + f.w / 2, f.y + 50);

    // Mock lines or cat silhouette
    if (f.t1.includes('猫')) {
      ctx.fillStyle = '#d9843b';
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + 108, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(f.x + f.w / 2 - 22, f.y + 94);
      ctx.lineTo(f.x + f.w / 2 - 14, f.y + 72);
      ctx.lineTo(f.x + f.w / 2 - 4, f.y + 88);
      ctx.moveTo(f.x + f.w / 2 + 22, f.y + 94);
      ctx.lineTo(f.x + f.w / 2 + 14, f.y + 72);
      ctx.lineTo(f.x + f.w / 2 + 4, f.y + 88);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60,75,95,0.25)';
      for (let ly = f.y + 66; ly < f.y + f.h - 14; ly += 14) {
        ctx.fillRect(f.x + 14, ly, f.w - 28, 5);
      }
    }

    // Red/yellow thumbtack
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.arc(f.x + f.w / 2, f.y + 7, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  return toTex(c);
}


export function createStopSignTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);

  // Inverted rounded red triangle (Japanese Tomare sign)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(18, 28);
  ctx.lineTo(238, 28);
  ctx.lineTo(128, 236);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.moveTo(32, 38);
  ctx.lineTo(224, 38);
  ctx.lineTo(128, 218);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 44px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  ctx.fillText('止まれ', 128, 96);
  ctx.font = '800 22px sans-serif';
  ctx.fillText('STOP', 128, 134);

  return toTex(c);
}


export function createCrosswalkSignTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);

  // Authentic Japanese Road Sign 407-A Pentagon ("横断歩道") with rounded mitered corners
  const outer = [
    [128, 16],
    [232, 104],
    [208, 236],
    [48, 236],
    [24, 104],
  ];
  const tracePoly = (pts: number[][], inset = 0) => {
    const cx = 128;
    const cy = 136;
    ctx.beginPath();
    pts.forEach(([px, py], idx) => {
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      const nx = cx + dx * ((d - inset) / d);
      const ny = cy + dy * ((d - inset) / d);
      if (idx === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    });
    ctx.closePath();
  };

  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 14;
  tracePoly(outer, 4);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.strokeStyle = '#1560bd';
  ctx.lineWidth = 8;
  tracePoly(outer, 14);
  ctx.stroke();
  ctx.fillStyle = '#1560bd';
  ctx.fill();

  // Perspective crosswalk zebra bars & striding pedestrian + hat pictogram
  ctx.fillStyle = '#ffffff';
  const stripes = [
    [58, 190, 20, 26],
    [90, 190, 22, 26],
    [124, 190, 24, 26],
    [158, 190, 22, 26],
    [186, 190, 18, 26],
  ];
  for (const [sx, sy, sw, sh] of stripes) {
    ctx.fillRect(sx, sy, sw, sh);
  }
  ctx.beginPath();
  ctx.arc(124, 82, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 11;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(124, 98);
  ctx.lineTo(122, 140);
  ctx.lineTo(100, 178);
  ctx.moveTo(122, 140);
  ctx.lineTo(148, 178);
  ctx.moveTo(102, 124);
  ctx.lineTo(148, 118);
  ctx.stroke();

  return toTex(c);
}


export function createAddressPlateTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(96, 320);
  ctx.fillStyle = '#1b4f9c';
  ctx.fillRect(0, 0, 96, 320);
  ctx.strokeStyle = '#e8f1ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, 86, 310);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 30px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  const chars = ['虹', 'ヶ', '丘', '二', '丁', '目'];
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, 48, 48 + idx * 36);
  });
  ctx.fillStyle = '#ffcf48';
  ctx.font = '900 26px sans-serif';
  ctx.fillText('4-12', 48, 288);

  return toTex(c);
}


export function createBackroomDoorTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#e6ddd0';
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = '#b9ae9e';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 496);

  // Metal kickplate at bottom
  ctx.fillStyle = '#9aa4b2';
  ctx.fillRect(12, 412, 232, 92);

  // Staff only plaque
  ctx.fillStyle = '#20639b';
  ctx.fillRect(42, 218, 172, 54);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '800 18px sans-serif';
  ctx.fillText('STAFF ONLY', 128, 242);
  ctx.font = '700 15px sans-serif';
  ctx.fillText('関係者以外立入禁止', 128, 264);

  return toTex(c);
}


export function createWelcomeMatTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 160);
  ctx.fillStyle = '#232834';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#333b4d';
  ctx.fillRect(12, 12, 232, 136);

  ctx.strokeStyle = '#1fb482';
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, 220, 124);

  for (let y = 24; y < 136; y += 8) {
    ctx.fillStyle = 'rgba(15, 18, 26, 0.35)';
    ctx.fillRect(22, y, 212, 3);
  }
  ctx.fillStyle = '#d9e4f5';
  ctx.font = '800 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WELCOME', 128, 86);

  return toTex(c);
}


export interface RoadMaps {
  albedoMap: THREE.CanvasTexture;
  puddleMaskMap: THREE.CanvasTexture;
}

/**
 * World-mapped 1024x1024 road texture covering X in [-9, +9], Z in [-9, +9]
 * UV mapping on a PlaneGeometry(18, 18) rotated -PI/2 around X:
 *   u = (x + 9) / 18  -> canvas x = u * 1024
 *   v = 1 - (z + 9) / 18 -> canvas y = (1 - v) * 1024 = ((z + 9) / 18) * 1024
 */
export function createWorldRoadMaps(): RoadMaps {
  const S = 1024;
  const [ac, actx] = makeCanvas(S, S);
  const [pc, pctx] = makeCanvas(S, S);

  const wx = (x: number) => ((x + 9) / 18) * S;
  const wz = (z: number) => ((z + 9) / 18) * S;
  const ws = (len: number) => (len / 18) * S;

  // 1. Base wet anime night asphalt color
  actx.fillStyle = '#1b2436';
  actx.fillRect(0, 0, S, S);

  // Subtle illustrative asphalt grain & aggregate variation
  for (let i = 0; i < 4500; i++) {
    const gx = (i * 197) % S;
    const gy = (i * 353) % S;
    actx.fillStyle = i % 2 === 0 ? 'rgba(110, 145, 195, 0.045)' : 'rgba(10, 14, 24, 0.09)';
    actx.fillRect(gx, gy, 3, 3);
  }

  // Slightly warmer/darker tone for alley floor & parking pad
  actx.fillStyle = '#20293d';
  actx.fillRect(wx(-8.9), wz(0.6), ws(4.6), ws(3.9));
  actx.fillStyle = '#232c3f';
  actx.fillRect(wx(-5.6), wz(-8.9), ws(2.1), ws(9.7));

  // Road white outer lane lines
  actx.fillStyle = '#d7e2f4';
  // Front street curb-side white edge line (interrupted for parking cut and crosswalk)
  actx.fillRect(wx(-8.8), wz(4.78), ws(0.3), ws(0.11));
  actx.fillRect(wx(-4.4), wz(4.78), ws(4.3), ws(0.11));
  // Far edge of front street
  actx.fillRect(wx(-8.9), wz(8.62), ws(17.8), ws(0.11));
  // Side street edge lines
  actx.fillRect(wx(5.78), wz(-8.9), ws(0.11), ws(7.9));
  actx.fillRect(wx(8.62), wz(-8.9), ws(0.11), ws(17.6));

  // Dashed center-ish neighborhood lane line on front street (left side)
  for (let x = -8.5; x <= -2.2; x += 1.45) {
    actx.fillRect(wx(x), wz(6.68), ws(0.82), ws(0.11));
  }

  // Stop line (停止線) before crosswalk on front street
  actx.fillStyle = '#e5eefc';
  actx.fillRect(wx(-1.15), wz(4.95), ws(0.24), ws(3.55));

  // "止まれ" road paint stencil before stop line
  actx.save();
  actx.translate(wx(-2.25), wz(5.85));
  actx.rotate(-Math.PI / 2);
  actx.fillStyle = 'rgba(226, 236, 252, 0.86)';
  actx.font = '900 28px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  actx.textAlign = 'center';
  actx.fillText('止まれ', 0, 0);
  actx.restore();

  // Reflective Crosswalk #1 across Front Main Street (X in [0.25, 2.75], Z in [5.05, 8.4])
  actx.fillStyle = '#edf4ff';
  for (let z = 5.12; z <= 8.25; z += 0.62) {
    actx.fillRect(wx(0.25), wz(z), ws(2.45), ws(0.34));
  }

  // Reflective Crosswalk #2 across Right Side Street (X in [5.98, 8.48], Z in [0.15, 2.55])
  for (let x = 6.02; x <= 8.32; x += 0.58) {
    actx.fillRect(wx(x), wz(0.15), ws(0.32), ws(2.35));
  }
  // Stop line on side street
  actx.fillRect(wx(5.95), wz(-0.75), ws(2.55), ws(0.22));

  // Konbini Parking Space ("停车位") in X in [-8.45, -5.05], Z in [0.85, 4.35]
  actx.strokeStyle = '#dce7fa';
  actx.lineWidth = ws(0.1);
  // Stall 1 & Stall 2 U-lines
  for (const sx of [-8.35, -6.72]) {
    actx.beginPath();
    actx.moveTo(wx(sx), wz(4.25));
    actx.lineTo(wx(sx), wz(0.95));
    actx.lineTo(wx(sx + 1.52), wz(0.95));
    actx.lineTo(wx(sx + 1.52), wz(4.25));
    actx.stroke();

    // "P" mark inside parking bay
    actx.fillStyle = 'rgba(220, 233, 252, 0.78)';
    actx.font = '900 26px sans-serif';
    actx.textAlign = 'center';
    actx.fillText('P', wx(sx + 0.76), wz(3.15));
  }

  // Darken gutter strip & subtle worn tire-track bands so asphalt feels lived-in
  actx.fillStyle = 'rgba(8, 12, 22, 0.38)';
  actx.fillRect(wx(-4.4), wz(4.4), ws(8.6), ws(0.34));
  actx.fillRect(wx(5.4), wz(-8.9), ws(0.34), ws(12.1));

  // Subtle dark wheel-track wear across crosswalks and main lanes
  actx.fillStyle = 'rgba(14, 19, 32, 0.18)';
  actx.fillRect(wx(-8.9), wz(5.55), ws(17.8), ws(0.75));
  actx.fillRect(wx(-8.9), wz(7.15), ws(17.8), ws(0.75));
  actx.fillRect(wx(6.35), wz(-8.9), ws(0.68), ws(17.8));
  actx.fillRect(wx(7.65), wz(-8.9), ws(0.68), ws(17.8));

  // Fine asphalt stone grit over road markings for authentic road-paint texture
  for (let i = 0; i < 3200; i++) {
    const gx = (i * 313) % S;
    const gy = (i * 571) % S;
    actx.fillStyle = 'rgba(16, 22, 36, 0.14)';
    actx.fillRect(gx, gy, 2, 2);
  }

  // 2. Build Puddle Mask (R = mirror puddle mask, G = general wet sheen)
  pctx.fillStyle = 'rgb(28, 145, 0)'; // damp asphalt everywhere by default
  pctx.fillRect(0, 0, S, S);

  const puddles: Array<{ x: number; z: number; rx: number; rz: number; rot: number; strength: number }> = [
    // Large hero puddle across front street & crosswalk catching konbini + neon reflection!
    { x: 1.15, z: 5.95, rx: 2.35, rz: 1.18, rot: 0.14, strength: 0.96 },
    // Puddle near front-left vending machines & stop line
    { x: -2.65, z: 5.45, rx: 1.85, rz: 0.95, rot: -0.18, strength: 0.92 },
    // Puddle at street corner curve catching streetlamp & traffic signal!
    { x: 5.35, z: 5.65, rx: 1.95, rz: 1.35, rot: 0.35, strength: 0.95 },
    // Side street puddle across second crosswalk
    { x: 7.15, z: 1.65, rx: 1.15, rz: 1.95, rot: -0.12, strength: 0.9 },
    // Side street rear puddle reflecting traffic light / utility pole
    { x: 6.85, z: -3.4, rx: 1.05, rz: 1.65, rot: 0.2, strength: 0.85 },
    // Parking space puddle
    { x: -6.8, z: 2.85, rx: 1.25, rz: 0.95, rot: 0.25, strength: 0.88 },
    // Gutter water ribbon along front curb
    { x: -0.2, z: 4.58, rx: 3.8, rz: 0.28, rot: 0, strength: 0.86 },
    // Alley entrance puddle
    { x: -4.55, z: 0.2, rx: 0.68, rz: 1.25, rot: 0.08, strength: 0.84 },
    // Far front street puddle catching pylon sign glow
    { x: -6.4, z: 7.15, rx: 1.95, rz: 0.92, rot: 0.1, strength: 0.88 },
  ];

  for (const p of puddles) {
    // Draw 3 overlapping organic lobes per puddle so shapes look natural rather than rigid ovals
    const lobes = [
      { ox: 0, oz: 0, sx: 1.0, sz: 1.0, rot: p.rot },
      { ox: p.rx * 0.38, oz: p.rz * 0.22, sx: 0.72, sz: 0.78, rot: p.rot + 0.45 },
      { ox: -p.rx * 0.34, oz: -p.rz * 0.18, sx: 0.76, sz: 0.68, rot: p.rot - 0.35 },
    ];
    for (const lb of lobes) {
      pctx.save();
      pctx.translate(wx(p.x + lb.ox), wz(p.z + lb.oz));
      pctx.rotate(lb.rot);
      pctx.scale(ws(p.rx * lb.sx), ws(p.rz * lb.sz));
      const grad = pctx.createRadialGradient(0, 0, 0.14, 0, 0, 1.0);
      const peak = Math.round(p.strength * 255);
      grad.addColorStop(0, `rgba(${peak}, 245, 0, 0.95)`);
      grad.addColorStop(0.62, `rgba(${Math.round(peak * 0.88)}, 230, 0, 0.85)`);
      grad.addColorStop(0.86, `rgba(95, 185, 0, 0.40)`);
      grad.addColorStop(1, `rgba(28, 145, 0, 0)`);
      pctx.fillStyle = grad;
      pctx.beginPath();
      pctx.arc(0, 0, 1.0, 0, Math.PI * 2);
      pctx.fill();
      pctx.restore();
    }
  }

  return {
    albedoMap: toTex(ac),
    puddleMaskMap: toTex(pc, 1, 1, false),
  };
}

export function createNoboriFlagTextures(): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const specs = [
    {
      bg1: '#ff6e30',
      bg2: '#d83a1e',
      stripe: '#ffd54f',
      chars: ['お', 'で', 'ん'],
      top: 'あつあつ',
    },
    {
      bg1: '#2b4c8c',
      bg2: '#1a2d59',
      stripe: '#ff9e40',
      chars: ['夜', '珈', '琲'],
      top: '淹れたて',
    },
  ];

  const out = specs.map((sp) => {
    const [c, ctx] = makeCanvas(128, 384);
    const g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, sp.bg1);
    g.addColorStop(1, sp.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 384);

    ctx.fillStyle = sp.stripe;
    ctx.fillRect(0, 0, 14, 384);
    ctx.fillRect(0, 358, 128, 18);

    // Top small horizontal badge
    ctx.fillStyle = '#fff9ec';
    ctx.beginPath();
    ctx.roundRect(24, 18, 90, 36, 8);
    ctx.fill();
    ctx.fillStyle = sp.bg2;
    ctx.textAlign = 'center';
    ctx.font = '900 18px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
    ctx.fillText(sp.top, 69, 43);

    // Bold vertical Japanese characters
    ctx.fillStyle = '#fffdf7';
    ctx.font = '900 66px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
    sp.chars.forEach((ch, idx) => {
      ctx.fillText(ch, 70, 128 + idx * 88);
    });

    return toTex(c);
  });

  return [out[0], out[1]];
}

export function createRoofDeckTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#3c495e';
  ctx.fillRect(0, 0, 256, 256);

  // Waterproof sheet seams & maintenance paver grid
  ctx.strokeStyle = 'rgba(18, 25, 40, 0.45)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  for (let i = 0; i < 900; i++) {
    const x = (i * 137) % 256;
    const y = (i * 251) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 155, 190, 0.08)' : 'rgba(15, 20, 32, 0.12)';
    ctx.fillRect(x, y, 2, 2);
  }
  return toTex(c, 3, 3);
}

export function createKawaraRoofTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#253147';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 8;
  const rw = 256 / cols;
  const rh = 256 / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * rw;
      const y = r * rh;
      const shade = ((r * 7 + col * 11) % 8) - 4;
      ctx.fillStyle = `rgb(${44 + shade}, ${58 + shade}, ${84 + shade})`;
      ctx.fillRect(x + 1, y + 1, rw - 2, rh - 3);
      // Curved ceramic tile highlight ridge & overlap shadow
      ctx.fillStyle = 'rgba(155, 190, 240, 0.18)';
      ctx.fillRect(x + rw * 0.25, y + 2, rw * 0.4, rh - 5);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.55)';
      ctx.fillRect(x, y + rh - 3, rw, 3);
    }
  }
  return toTex(c, 3, 2);
}

export function createVendingMarqueeTexture(variant: 'red' | 'blue'): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 64);
  const g = ctx.createLinearGradient(0, 0, 256, 64);
  if (variant === 'red') {
    g.addColorStop(0, '#ff6b4a');
    g.addColorStop(1, '#d93226');
  } else {
    g.addColorStop(0, '#2ab4ff');
    g.addColorStop(1, '#146bc4');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 64);

  // Clean anime wave highlight band
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 42);
  ctx.quadraticCurveTo(128, 18, 256, 38);
  ctx.lineTo(256, 64);
  ctx.lineTo(0, 64);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fffdf8';
  ctx.textAlign = 'center';
  ctx.font = '900 22px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  ctx.fillText(variant === 'red' ? 'つめた〜い・あったか〜い' : 'DRINK  &  CAFE', 128, 30);
  ctx.font = '800 13px sans-serif';
  ctx.fillStyle = '#fff3cf';
  ctx.fillText(variant === 'red' ? '24H REFRESHMENT' : 'COLD  •  HOT  COFFEE', 128, 52);

  return toTex(c);
}


export function createVendingShowcaseBackdropTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 320);
  const g = ctx.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, '#f4faff');
  g.addColorStop(0.65, '#e8f3ff');
  g.addColorStop(1, '#fff3eb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 320);

  // Subtle vertical interior fluorescent diffuser strips
  for (let x = 22; x < 245; x += 36) {
    ctx.fillStyle = 'rgba(180, 210, 240, 0.22)';
    ctx.fillRect(x, 0, 2, 320);
  }

  // 3 horizontal shelf rails with COLD (blue) / HOT (red-orange) price badges
  const rowYs = [96, 198, 298];
  rowYs.forEach((ry, idx) => {
    const isHot = idx === 2;
    ctx.fillStyle = '#d3dce8';
    ctx.fillRect(4, ry - 20, 248, 22);
    ctx.fillStyle = isHot ? '#e84828' : '#1488e0';
    ctx.fillRect(6, ry - 16, 244, 15);

    // Mini price tags & white Japanese label ticks across 7 slots
    for (let s = 0; s < 7; s++) {
      const sx = 14 + s * 33;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, ry - 14, 24, 11);
      ctx.fillStyle = isHot ? '#c62828' : '#0d5ea8';
      ctx.font = '800 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isHot ? '¥140' : s % 2 === 0 ? '¥150' : '¥130', sx + 12, ry - 6);
    }
  });

  return toTex(c);
}


export function createVendingSideDecalTexture(variant: 'red' | 'blue'): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(192, 512);
  ctx.fillStyle = variant === 'red' ? '#f2f4f8' : '#248fd6';
  ctx.fillRect(0, 0, 192, 512);

  // Vertical accent stripe & clean graphic badge
  ctx.fillStyle = variant === 'red' ? '#e54b3c' : '#1462a3';
  ctx.fillRect(0, 0, 28, 512);
  ctx.fillStyle = variant === 'red' ? '#ff9d76' : '#58c4ff';
  ctx.fillRect(28, 0, 8, 512);

  // Subtle circular emblem
  ctx.fillStyle = variant === 'red' ? '#e54b3c' : '#ffffff';
  ctx.beginPath();
  ctx.arc(108, 150, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = variant === 'red' ? '#ffffff' : '#1462a3';
  ctx.textAlign = 'center';
  ctx.font = '900 22px sans-serif';
  ctx.fillText('DRINK', 108, 157);

  // Lower subtle safety & power rating sticker + louver panel border
  ctx.fillStyle = variant === 'red' ? '#d4dbe6' : '#1b77b8';
  ctx.fillRect(48, 390, 112, 82);
  ctx.fillStyle = variant === 'red' ? '#7a879c' : '#8ad2ff';
  for (let ly = 402; ly < 464; ly += 10) {
    ctx.fillRect(58, ly, 92, 4);
  }

  return toTex(c);
}

export function createMagazineCoverTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 176);
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, 128, 176);

  // Bold magazine masthead band (tinted per instance color)
  ctx.fillStyle = '#e6e9f2';
  ctx.fillRect(8, 8, 112, 28);
  ctx.fillStyle = '#222b3d';
  ctx.font = '900 16px "Hiragino Kaku Gothic ProN", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('週間マート', 64, 28);

  // Center illustration frame
  ctx.fillStyle = '#d4dcea';
  ctx.fillRect(14, 44, 100, 92);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 90, 26, 0, Math.PI * 2);
  ctx.fill();

  // Headline pills & tiny barcode at bottom
  ctx.fillStyle = '#222b3d';
  ctx.fillRect(14, 144, 64, 8);
  ctx.fillStyle = '#556278';
  ctx.fillRect(14, 156, 48, 6);
  ctx.fillStyle = '#1f2533';
  ctx.fillRect(90, 144, 24, 18);

  return toTex(c);
}

/** High-detail 4x2 (8-brand) full-color atlas for cup noodles, udon bowls & yakisoba trays (designed for un-tinted 0xffffff rendering). */
export function createCupNoodleLabelTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  const styles = [
    { qx: 0, qy: 0, title: 'しょうゆ', sub: 'ORIGINAL', bg: '#fbf6ea', band: '#d62828', trim: '#c59b27', badge: '#ffffff', ink: '#1e293b', motif: 'cup' },
    { qx: 1, qy: 0, title: '海鮮', sub: 'SEAFOOD', bg: '#e8f4fc', band: '#0369a1', trim: '#38bdf8', badge: '#0f2e5e', ink: '#ffffff', motif: 'wave' },
    { qx: 2, qy: 0, title: '辛トマト', sub: 'CHILI', bg: '#dc2626', band: '#7f1d1d', trim: '#facc15', badge: '#fffbeb', ink: '#991b1b', motif: 'flame' },
    { qx: 3, qy: 0, title: 'カレー', sub: 'CURRY', bg: '#fbbf24', band: '#5c2d0c', trim: '#b45309', badge: '#fffbeb', ink: '#451a03', motif: 'bowl' },
    { qx: 0, qy: 1, title: 'きつね', sub: 'うどん', bg: '#14532d', band: '#eab308', trim: '#ca8a04', badge: '#fefce8', ink: '#14532d', motif: 'crest' },
    { qx: 1, qy: 1, title: '天そば', sub: '出汁和風', bg: '#3b1d5e', band: '#e11d48', trim: '#f59e0b', badge: '#fff1f2', ink: '#3b1d5e', motif: 'crest' },
    { qx: 2, qy: 1, title: '豚骨', sub: '黒マー油', bg: '#1c1917', band: '#dc2626', trim: '#d97706', badge: '#fef2f2', ink: '#1c1917', motif: 'stripe' },
    { qx: 3, qy: 1, title: '焼そば', sub: '濃厚ソース', bg: '#111827', band: '#b91c1c', trim: '#facc15', badge: '#fee2e2', ink: '#7f1d1d', motif: 'diag' },
  ];
  for (const st of styles) {
    const ox = st.qx * 256;
    const oy = st.qy * 256;
    ctx.fillStyle = st.bg;
    ctx.fillRect(ox, oy, 256, 256);

    // Metallic rim lip + colorful top & bottom collar bands
    ctx.fillStyle = st.trim;
    ctx.fillRect(ox, oy, 256, 14);
    ctx.fillStyle = st.band;
    ctx.fillRect(ox, oy + 14, 256, 30);
    ctx.fillRect(ox, oy + 206, 256, 50);

    // Subtle graphic background pattern per SKU
    if (st.motif === 'wave') {
      ctx.fillStyle = '#bae6fd';
      for (let rx = 0; rx < 256; rx += 28) ctx.fillRect(ox + rx, oy + 52, 12, 146);
    } else if (st.motif === 'diag') {
      ctx.fillStyle = '#991b1b';
      for (let rx = -32; rx < 256; rx += 40) {
        ctx.beginPath();
        ctx.moveTo(ox + rx, oy + 46);
        ctx.lineTo(ox + rx + 22, oy + 46);
        ctx.lineTo(ox + rx - 10, oy + 204);
        ctx.lineTo(ox + rx - 32, oy + 204);
        ctx.closePath();
        ctx.fill();
      }
    } else if (st.motif === 'stripe') {
      ctx.fillStyle = '#292524';
      for (let ry = 56; ry < 196; ry += 22) ctx.fillRect(ox, oy + ry, 256, 10);
    } else if (st.motif === 'cup') {
      // Classic triangular red rim frieze
      ctx.fillStyle = '#d62828';
      for (let rx = 0; rx < 256; rx += 16) {
        ctx.beginPath();
        ctx.moveTo(ox + rx, oy + 44);
        ctx.lineTo(ox + rx + 8, oy + 58);
        ctx.lineTo(ox + rx + 16, oy + 44);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Repeated 4-angle cylindrical wrap medallions so any cylinder rotation reads clearly
    for (let x = 0; x < 256; x += 64) {
      ctx.fillStyle = st.trim;
      ctx.beginPath();
      ctx.ellipse(ox + x + 32, oy + 124, 27, 46, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = st.badge;
      ctx.beginPath();
      ctx.ellipse(ox + x + 32, oy + 124, 23, 41, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = st.ink;
      ctx.font = '900 13px "Hiragino Kaku Gothic ProN", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.title, ox + x + 32, oy + 118);

      ctx.fillStyle = st.band === st.badge ? st.ink : st.band;
      ctx.fillRect(ox + x + 13, oy + 128, 38, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 8px sans-serif';
      ctx.fillText(st.sub, ox + x + 32, oy + 139);
    }

    // Appetizing garnish food circles & barcode footer
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 16, oy + 214, 52, 30);
    ctx.fillStyle = '#111827';
    for (let bx = 20; bx < 64; bx += 4) ctx.fillRect(ox + bx, oy + 218, bx % 8 === 0 ? 3 : 1, 22);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(ox + 196, oy + 230, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c);
}

/** 4x2 (8-brand) full-color foil snack pouch atlas (Chips / Seaweed / Consomme / Butter / Honey / Rice Crackers / Gummies / Chili). */
export function createSnackPouchPrintTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  const styles = [
    { qx: 0, qy: 0, title: 'うすしお', sub: 'ポテトチップス', base: '#d92b2b', sec: '#991b1b', crest: '#fef08a', accent: '#b91c1c', mode: 'diag' },
    { qx: 1, qy: 0, title: 'のり塩', sub: '青海苔仕立て', base: '#15803d', sec: '#064e3b', crest: '#ecfccb', accent: '#166534', mode: 'nori' },
    { qx: 2, qy: 0, title: 'コンソメ', sub: 'Wパンチ', base: '#ea580c', sec: '#7c2d12', crest: '#fffbeb', accent: '#c2410c', mode: 'diag' },
    { qx: 3, qy: 0, title: 'じゃがバター', sub: '北海道産', base: '#eab308', sec: '#1d4ed8', crest: '#ffffff', accent: '#1e40af', mode: 'check' },
    { qx: 0, qy: 1, title: 'はちみつ', sub: 'スイート味', base: '#f59e0b', sec: '#b45309', crest: '#fffef2', accent: '#92400e', mode: 'honey' },
    { qx: 1, qy: 1, title: '堅焼煎餅', sub: '醤油米菓', base: '#312e81', sec: '#b91c1c', crest: '#fefce8', accent: '#7f1d1d', mode: 'washi' },
    { qx: 2, qy: 1, title: '果汁グミ', sub: 'ぶどう100%', base: '#6d28d9', sec: '#db2777', crest: '#fdf4ff', accent: '#9d174d', mode: 'fruit' },
    { qx: 3, qy: 1, title: 'カラムーチョ', sub: '激辛チリ', base: '#18181b', sec: '#dc2626', crest: '#fef2f2', accent: '#dc2626', mode: 'flame' },
  ];
  for (const st of styles) {
    const ox = st.qx * 256;
    const oy = st.qy * 256;

    // Rich foil bag gradient
    const g = ctx.createLinearGradient(ox, oy, ox + 256, oy + 256);
    g.addColorStop(0, st.base);
    g.addColorStop(0.55, st.base);
    g.addColorStop(1, st.sec);
    ctx.fillStyle = g;
    ctx.fillRect(ox, oy, 256, 256);

    // Metallic crimped foil top/bottom seals & hang-peg hole detail on top seal
    ctx.fillStyle = st.sec;
    ctx.fillRect(ox, oy, 256, 28);
    ctx.fillRect(ox, oy + 226, 256, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let x = 0; x < 256; x += 8) {
      ctx.fillRect(ox + x, oy, 3, 24);
      ctx.fillRect(ox + x, oy + 230, 3, 24);
    }
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(ox + 128, oy + 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Accent motif overlay
    if (st.mode === 'diag') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(ox, oy + 62);
      ctx.lineTo(ox + 256, oy + 36);
      ctx.lineTo(ox + 256, oy + 58);
      ctx.lineTo(ox, oy + 84);
      ctx.closePath();
      ctx.fill();
    } else if (st.mode === 'check') {
      ctx.fillStyle = '#1e3a8a';
      for (let x = 0; x < 256; x += 32) {
        ctx.fillRect(ox + x, oy + 30, 16, 16);
        ctx.fillRect(ox + x + 16, oy + 46, 16, 16);
      }
    } else if (st.mode === 'washi') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(ox + 22, oy + 34, 44, 184);
      ctx.fillStyle = '#fefce8';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('名', ox + 44, oy + 82);
      ctx.fillText('代', ox + 44, oy + 114);
      ctx.fillText('煎', ox + 44, oy + 146);
    } else if (st.mode === 'nori') {
      ctx.fillStyle = '#064e3b';
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(ox + ((i * 53) % 230) + 10, oy + ((i * 37) % 160) + 42, 10, 6);
      }
    } else if (st.mode === 'fruit') {
      ctx.fillStyle = '#a855f7';
      for (const [cx, cy] of [[56, 186], [84, 198], [190, 184], [208, 166]]) {
        ctx.beginPath();
        ctx.arc(ox + cx, oy + cy, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.mode === 'flame') {
      ctx.fillStyle = '#ef4444';
      for (let x = 0; x < 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(ox + x, oy + 226);
        ctx.lineTo(ox + x + 16, oy + 166);
        ctx.lineTo(ox + x + 32, oy + 226);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Golden chip / cracker illustration cluster behind badge
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    for (const [cx, cy, rot] of [[72, 184, -0.3], [186, 182, 0.35], [130, 198, 0.1]]) {
      ctx.beginPath();
      ctx.ellipse(ox + cx, oy + cy, 24, 16, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Central high-contrast retail logo medallion
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(ox + 132, oy + 114, 86, 50, -0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = st.crest;
    ctx.beginPath();
    ctx.ellipse(ox + 132, oy + 110, 82, 46, -0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '900 28px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.title, ox + 132, oy + 108);
    ctx.fillStyle = st.accent;
    ctx.font = '900 15px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillText(st.sub, ox + 132, oy + 136);
  }
  return toTex(c);
}

/** 4x2 (8-brand) full-color confectionery, curry, biscuit, cereal & 6-pack carton atlas. */
export function createSnackBoxPrintTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  const styles = [
    { qx: 0, qy: 0, title: 'POCKY', sub: '極細チョコ', bg: '#c81e1e', band: '#7f1d1d', panel: '#fff5f5', accent: '#b91c1c', kind: 'sticks' },
    { qx: 1, qy: 0, title: '抹茶ポッキー', sub: '宇治抹茶', bg: '#166534', band: '#052e16', panel: '#f0fdf4', accent: '#15803d', kind: 'sticks' },
    { qx: 2, qy: 0, title: 'CACAO72%', sub: '濃厚チョコ', bg: '#2b170e', band: '#d97706', panel: '#fef3c7', accent: '#451a03', kind: 'bar' },
    { qx: 3, qy: 0, title: 'バターサブレ', sub: '発酵バター', bg: '#1e3a8a', band: '#d48806', panel: '#ffffff', accent: '#1e3a8a', kind: 'round' },
    { qx: 0, qy: 1, title: 'パイの実', sub: 'チョコたっぷり', bg: '#eab308', band: '#92400e', panel: '#fffbeb', accent: '#78350f', kind: 'round' },
    { qx: 1, qy: 1, title: '熟カレー', sub: '中辛・5皿分', bg: '#7f1d1d', band: '#f59e0b', panel: '#fff8eb', accent: '#991b1b', kind: 'bowl' },
    { qx: 2, qy: 1, title: 'フルグラ', sub: '果実グラノーラ', bg: '#fef2f2', band: '#dc2626', panel: '#ffffff', accent: '#dc2626', kind: 'bowl' },
    { qx: 3, qy: 1, title: 'DRY 6缶', sub: 'SILVER PACK', bg: '#cbd5e1', band: '#0f172a', panel: '#f8fafc', accent: '#b91c1c', kind: 'sixpack' },
  ];
  for (const st of styles) {
    const ox = st.qx * 256;
    const oy = st.qy * 256;
    ctx.fillStyle = st.bg;
    ctx.fillRect(ox, oy, 256, 256);

    ctx.fillStyle = st.band;
    ctx.fillRect(ox, oy, 256, 32);
    ctx.fillRect(ox, oy + 210, 256, 46);

    ctx.fillStyle = st.panel;
    ctx.beginPath();
    ctx.moveTo(ox, oy + 62);
    ctx.lineTo(ox + 256, oy + 38);
    ctx.lineTo(ox + 256, oy + 178);
    ctx.lineTo(ox, oy + 202);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = st.band;
    ctx.lineWidth = 5;
    ctx.stroke();

    if (st.kind === 'sticks') {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = st.qx === 1 ? '#15803d' : '#3e2010';
        ctx.fillRect(ox + 158 + i * 16, oy + 92, 9, 76);
        ctx.fillStyle = '#e6b86a';
        ctx.fillRect(ox + 158 + i * 16, oy + 148, 9, 20);
      }
    } else if (st.kind === 'round') {
      ctx.fillStyle = '#e6b86a';
      ctx.beginPath();
      ctx.arc(ox + 190, oy + 124, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9c6621';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (st.kind === 'bar') {
      ctx.fillStyle = '#4a2512';
      ctx.fillRect(ox + 148, oy + 94, 78, 62);
      ctx.strokeStyle = '#783f22';
      ctx.strokeRect(ox + 156, oy + 102, 28, 22);
      ctx.strokeRect(ox + 190, oy + 102, 28, 22);
    } else if (st.kind === 'sixpack') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(ox + 150, oy + 90, 86, 62);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(ox + 193, oy + 121, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(ox + 186, oy + 130, 40, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ox + 170, oy + 126, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#111827';
    ctx.font = '900 24px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(st.title, ox + 16, oy + 116);
    ctx.fillStyle = st.accent;
    ctx.font = '900 14px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillText(st.sub, ox + 16, oy + 144);
  }
  return toTex(c);
}

/** 4x2 (8-brand) full-color Japanese cold drink & can label wrap atlas (Green Tea / Oolong / Coffee / Latte / Sports / Cola / Lemon / Silver Dry). */
export function createBeverageLabelPrintTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 256);
  const drinks = [
    { qx: 0, qy: 0, ch1: '緑', ch2: '茶', bg: '#15803d', band: '#fef08a', card: '#ffffff', ink: '#14532d' },
    { qx: 1, qy: 0, ch1: '烏', ch2: '龍', bg: '#78350f', band: '#f59e0b', card: '#fffbeb', ink: '#78350f' },
    { qx: 2, qy: 0, ch1: '珈琲', ch2: '無糖', bg: '#1c1917', band: '#d97706', card: '#fef3c7', ink: '#1c1917' },
    { qx: 3, qy: 0, ch1: '牛乳', ch2: 'オレ', bg: '#f59e0b', band: '#78350f', card: '#ffffff', ink: '#92400e' },
    { qx: 0, qy: 1, ch1: '氷', ch2: '水', bg: '#0284c7', band: '#ffffff', card: '#e0f2fe', ink: '#0369a1' },
    { qx: 1, qy: 1, ch1: '炭', ch2: '酸', bg: '#dc2626', band: '#ffffff', card: '#ffffff', ink: '#b91c1c' },
    { qx: 2, qy: 1, ch1: '檸檬', ch2: 'C', bg: '#eab308', band: '#15803d', card: '#fefce8', ink: '#713f12' },
    { qx: 3, qy: 1, ch1: 'DRY', ch2: '爽', bg: '#cbd5e1', band: '#0f172a', card: '#ffffff', ink: '#0f172a' },
  ];
  for (const d of drinks) {
    const ox = d.qx * 256;
    const oy = d.qy * 128;
    ctx.fillStyle = d.bg;
    ctx.fillRect(ox, oy, 256, 128);
    ctx.fillStyle = d.band;
    ctx.fillRect(ox, oy + 6, 256, 10);
    ctx.fillRect(ox, oy + 112, 256, 10);

    for (const cx of [52, 184]) {
      ctx.fillStyle = d.card;
      ctx.fillRect(ox + cx - 28, oy + 22, 56, 84);
      ctx.strokeStyle = d.band;
      ctx.lineWidth = 3;
      ctx.strokeRect(ox + cx - 28, oy + 22, 56, 84);

      ctx.fillStyle = d.ink;
      ctx.font = '900 20px "Hiragino Kaku Gothic ProN", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.ch1, ox + cx, oy + 54);
      ctx.fillText(d.ch2, ox + cx, oy + 86);
    }

    // Nutrition label + barcode panel on back side
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 104, oy + 28, 42, 72);
    ctx.fillStyle = '#475569';
    for (let ry = 36; ry < 76; ry += 10) ctx.fillRect(ox + 108, oy + ry, 34, 3);
    ctx.fillStyle = '#111827';
    for (let bx = 108; bx < 142; bx += 4) ctx.fillRect(ox + bx, oy + 82, 2, 14);
  }
  return toTex(c);
}

/** Crisp repeating shelf price rail strip with yen price tags & slot ticks. */
export function createPriceRailTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 32);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, 0, 512, 32);
  ctx.fillStyle = '#e5a918';
  ctx.fillRect(0, 27, 512, 5);

  const prices = ['¥158', '¥198', '¥128', '¥248', '¥108', '¥298', '¥168', '¥140'];
  for (let i = 0; i < 8; i++) {
    const x = i * 64 + 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, 4, 52, 22);
    if (i % 3 === 0) {
      ctx.fillStyle = '#e53935';
      ctx.fillRect(x, 4, 14, 22);
    }
    ctx.fillStyle = '#1f2937';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(prices[i], x + 32, 20);
  }
  return toTex(c, 3, 1);
}

/** Warm vertical cedar wood louver slat texture for checkout counter front & interior trim. */
export function createCounterWoodTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#d4a16a';
  ctx.fillRect(0, 0, 256, 256);

  const slatW = 16;
  for (let x = 0; x < 256; x += slatW) {
    const tone = (x / slatW) % 3 === 0 ? '#cc945b' : (x / slatW) % 3 === 1 ? '#dca974' : '#d29c64';
    ctx.fillStyle = tone;
    ctx.fillRect(x, 0, slatW - 2, 256);
    ctx.fillStyle = 'rgba(72, 42, 18, 0.35)';
    ctx.fillRect(x + slatW - 2, 0, 2, 256);
    // Subtle wood grain fibers
    ctx.fillStyle = 'rgba(110, 68, 30, 0.14)';
    ctx.fillRect(x + 3, (x * 13) % 180, 2, 68);
    ctx.fillRect(x + 8, (x * 29) % 140, 1, 92);
  }
  return toTex(c, 4, 1);
}

/** Subtle konbini painted sheet-metal cabinet texture with panel seams, kick vents & fasteners. */
export function createCabinetPanelTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#fcfaf4';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle vertical brushed sheen
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.82, 'rgba(0,0,0,0.03)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Cabinet door seam groove lines + louver air-intake slots along bottom toe kick
  ctx.fillStyle = 'rgba(55, 65, 82, 0.22)';
  ctx.fillRect(126, 12, 3, 210);
  ctx.fillRect(8, 12, 240, 2);
  for (let lx = 24; lx < 232; lx += 12) {
    ctx.fillRect(lx, 232, 7, 10);
  }
  return toTex(c, 2, 1);
}

/** Weathered galvanized industrial metal paneling with rain streaks & seam rivets (HVAC / ducts). */
export function createBrushedMetalTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#cfd7e3';
  ctx.fillRect(0, 0, 256, 256);

  // Panel seam lines & louver vent ribs
  ctx.strokeStyle = 'rgba(35, 45, 65, 0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 114, 240);
  ctx.strokeRect(134, 8, 114, 240);

  // Fine brushed streaks & rain-grime drip shadows from top lip
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(30, 40, 58, 0.22)');
  g.addColorStop(0.28, 'rgba(255, 255, 255, 0.08)');
  g.addColorStop(1, 'rgba(28, 36, 52, 0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(30, 42, 62, 0.34)';
  for (let y = 38; y < 140; y += 12) {
    ctx.fillRect(22, y, 84, 4);
  }
  return toTex(c);
}

/** Japanese convenience store waste sorting front placard sticker for outdoor trash/recycling bins. */
export function createTrashBinFrontTexture(isBottleBin: boolean): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(192, 256);
  ctx.fillStyle = '#edf1f7';
  ctx.fillRect(0, 0, 192, 256);

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 224, 192, 32);

  // Printed sorting graphic placard
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 28, 152, 168);
  ctx.strokeStyle = isBottleBin ? '#1b88d9' : '#209f6c';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 28, 152, 168);

  ctx.fillStyle = isBottleBin ? '#1b88d9' : '#209f6c';
  ctx.fillRect(20, 28, 152, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 18px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isBottleBin ? 'カン・ペット' : 'もえるゴミ', 96, 56);

  // Minimal pictograms (PET bottle + can / paper wrap)
  ctx.fillStyle = isBottleBin ? '#1e88e5' : '#2e7d32';
  if (isBottleBin) {
    ctx.fillRect(54, 96, 26, 56);
    ctx.fillRect(61, 84, 12, 12);
    ctx.fillRect(108, 106, 28, 46);
  } else {
    ctx.beginPath();
    ctx.arc(96, 128, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#334155';
  ctx.font = '800 13px sans-serif';
  ctx.fillText(isBottleBin ? 'RECYCLABLE' : 'BURNABLE', 96, 180);

  return toTex(c);
}

/** Island chest freezer front graphic skirt banner ("ICE CREAM / アイス"). */
export function createFreezerHeaderTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 128);
  const g = ctx.createLinearGradient(0, 0, 512, 128);
  g.addColorStop(0, '#075985');
  g.addColorStop(0.5, '#0284c7');
  g.addColorStop(1, '#075985');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);

  // Icy wave graphic band + clean white stripe border
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(0, 86);
  ctx.quadraticCurveTo(128, 66, 256, 86);
  ctx.quadraticCurveTo(384, 106, 512, 82);
  ctx.lineTo(512, 128);
  ctx.lineTo(0, 128);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 8);
  ctx.fillRect(0, 114, 512, 6);

  // Popsicle & cone icon accents flanking Japanese header
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(28, 30, 18, 34);
  ctx.fillStyle = '#e5b887';
  ctx.fillRect(35, 64, 4, 14);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 34px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('❄  アイス・氷菓  ICE CREAM  ❄', 268, 62);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '800 16px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('モナカ・カップ・マルチパック   ¥120 〜 ¥420', 268, 98);
  return toTex(c);
}

/** Konbini gondola perforated steel pegboard backing texture (repeating hole grid + brushed channel seams). */
export function createPegboardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle vertical steel bay joint seams
  ctx.fillStyle = '#d6cfc2';
  ctx.fillRect(0, 0, 5, 256);
  ctx.fillRect(126, 0, 4, 256);

  // Crisp konbini gondola peg holes on uniform 16px pitch
  for (let y = 8; y < 256; y += 16) {
    for (let x = 8; x < 256; x += 16) {
      ctx.fillStyle = '#8b93a1';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fcfaf4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 0.6, y + 0.8, 1.8, Math.PI * 0.1, Math.PI * 1.1);
      ctx.stroke();
    }
  }
  return toTex(c, 5, 3);
}

/** Crisp 2x1 retail POP shelf-talker wobbler atlas ("新発売!" / "期間限定 特価"). */
export function createPopWobblerTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);

  // Tile 0: Bright Crimson + Yellow "新発売!"
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(10, 12, 108, 34);
  ctx.fillStyle = '#991b1b';
  ctx.font = '900 20px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('新発売！', 64, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('おすすめ', 64, 82);
  ctx.fillStyle = '#fef08a';
  ctx.font = '900 18px sans-serif';
  ctx.fillText('¥158', 64, 108);

  // Tile 1: Yellow + Black "期間限定 特価"
  ctx.fillStyle = '#facc15';
  ctx.fillRect(128, 0, 128, 128);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 6;
  ctx.strokeRect(133, 5, 118, 118);
  ctx.fillStyle = '#111827';
  ctx.fillRect(138, 12, 108, 34);
  ctx.fillStyle = '#facc15';
  ctx.font = '900 19px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('期間限定', 192, 36);
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 28px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('特価!', 192, 84);
  ctx.fillStyle = '#111827';
  ctx.font = '900 18px sans-serif';
  ctx.fillText('¥118', 192, 108);

  return toTex(c);
}

/** Weathered Japanese cast-aluminum traffic signal housing & galvanized mast surface texture. */
export function createSignalMetalTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#c6cfd9');
  g.addColorStop(0.25, '#b6c0cc');
  g.addColorStop(0.75, '#a4afbd');
  g.addColorStop(1, '#7e8999');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle brushed aluminum grain & rain grime streaks (tile-safe for both cylinders & housings)
  ctx.fillStyle = 'rgba(22, 30, 44, 0.12)';
  for (let x = 6; x < 256; x += 18) {
    ctx.fillRect(x, 0, 2, 256);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  for (let x = 14; x < 256; x += 28) {
    ctx.fillRect(x, 0, 2, 256);
  }
  ctx.fillStyle = 'rgba(20, 28, 42, 0.20)';
  ctx.fillRect(0, 0, 256, 4);
  ctx.fillRect(0, 248, 256, 8);
  return toTex(c);
}

/** Yellow/black reflective diagonal hazard collar texture for roadside signal poles. */
export function createPoleHazardCollarTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#141820';
  for (let x = -128; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 84, 128);
    ctx.lineTo(x + 60, 128);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 118, 256, 10);
  return toTex(c, 2, 1);
}

/** LED honeycomb emitter + Fresnel polycarbonate ring lens texture pair (diffuse map + emissiveMap). */
export function createTrafficLedLensTextures(
  hue: 'green' | 'amber' | 'red'
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const palette = {
    green: { dark: '#071b18', mid: '#0d3d34', glow: '#6effcf', rim: '#058c64' },
    amber: { dark: '#1e1406', mid: '#482e08', glow: '#ffe169', rim: '#c46c04' },
    red: { dark: '#21080b', mid: '#4a1216', glow: '#ff8a8a', rim: '#b81422' },
  }[hue];

  // Diffuse map: dark smoked polycarbonate cover + Fresnel rings + visible dormant diode matrix + subtle glass sheen
  const [cMap, mCtx] = makeCanvas(256, 256);
  const radMap = mCtx.createRadialGradient(128, 128, 10, 128, 128, 118);
  radMap.addColorStop(0, palette.mid);
  radMap.addColorStop(0.76, palette.dark);
  radMap.addColorStop(1, '#0b0e14');
  mCtx.fillStyle = radMap;
  mCtx.fillRect(0, 0, 256, 256);

  // Emissive map: sharp mask so ONLY hexagonal LED diodes + soft inner core bloom
  const [cEm, eCtx] = makeCanvas(256, 256);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 256);

  const hotCore = eCtx.createRadialGradient(128, 128, 4, 128, 128, 96);
  hotCore.addColorStop(0, 'rgba(255,255,255,0.42)');
  hotCore.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  hotCore.addColorStop(1, 'rgba(0,0,0,0)');
  eCtx.fillStyle = hotCore;
  eCtx.beginPath();
  eCtx.arc(128, 128, 98, 0, Math.PI * 2);
  eCtx.fill();

  // Concentric Fresnel glass refraction rings & hexagonal LED diode array
  for (let r = 18; r <= 104; r += 12) {
    mCtx.strokeStyle = 'rgba(255,255,255,0.09)';
    mCtx.lineWidth = 1.5;
    mCtx.beginPath();
    mCtx.arc(128, 128, r, 0, Math.PI * 2);
    mCtx.stroke();
  }

  const spacing = 13;
  for (let row = -8; row <= 8; row++) {
    const y = 128 + row * (spacing * 0.866);
    const xOffset = Math.abs(row) % 2 === 1 ? spacing * 0.5 : 0;
    for (let col = -8; col <= 8; col++) {
      const x = 128 + col * spacing + xOffset;
      const dist = Math.hypot(x - 128, y - 128);
      if (dist > 94) continue;
      const falloff = 1 - Math.pow(dist / 102, 1.8);

      // Subtle diode pearl dot in diffuse glass
      mCtx.fillStyle = palette.rim;
      mCtx.beginPath();
      mCtx.arc(x, y, 3.2, 0, Math.PI * 2);
      mCtx.fill();

      // Bright optical LED dot in emissiveMap with center hotspot
      eCtx.fillStyle = falloff > 0.65 ? '#ffffff' : `rgba(255, 255, 255, ${0.42 + falloff * 0.58})`;
      eCtx.beginPath();
      eCtx.arc(x, y, 3.6, 0, Math.PI * 2);
      eCtx.fill();
    }
  }

  // Outer rubber bezel edge + subtle specular curved glass reflection crescent
  mCtx.strokeStyle = '#0c0f16';
  mCtx.lineWidth = 22;
  mCtx.beginPath();
  mCtx.arc(128, 128, 118, 0, Math.PI * 2);
  mCtx.stroke();

  mCtx.strokeStyle = 'rgba(255,255,255,0.22)';
  mCtx.lineWidth = 4;
  mCtx.beginPath();
  mCtx.arc(128, 128, 86, Math.PI * 1.12, Math.PI * 1.48);
  mCtx.stroke();

  return { map: toTex(cMap), emissiveMap: toTex(cEm) };
}

/** Japanese pedestrian signal standing (red) & striding (green) LED pictogram lens texture pair. */
export function createPedestrianLedTextures(
  kind: 'red' | 'green'
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const [cMap, mCtx] = makeCanvas(256, 256);
  mCtx.fillStyle = '#080c12';
  mCtx.fillRect(0, 0, 256, 256);

  // Draw clean figure mask onto an offscreen canvas, then sample LED micro-dots onto emissiveMap
  const [cMask, kCtx] = makeCanvas(256, 256);
  kCtx.fillStyle = '#000000';
  kCtx.fillRect(0, 0, 256, 256);
  kCtx.fillStyle = '#ffffff';
  kCtx.strokeStyle = '#ffffff';
  kCtx.lineCap = 'round';
  kCtx.lineJoin = 'round';

  if (kind === 'red') {
    // Classic Japanese standing red pedestrian icon
    kCtx.beginPath();
    kCtx.arc(128, 56, 18, 0, Math.PI * 2);
    kCtx.fill();
    kCtx.lineWidth = 22;
    kCtx.beginPath();
    kCtx.moveTo(128, 84);
    kCtx.lineTo(128, 152);
    kCtx.stroke();
    // Arms hanging cleanly beside torso
    kCtx.lineWidth = 14;
    kCtx.beginPath();
    kCtx.moveTo(100, 92);
    kCtx.lineTo(94, 146);
    kCtx.moveTo(156, 92);
    kCtx.lineTo(162, 146);
    kCtx.stroke();
    // Straight legs
    kCtx.lineWidth = 16;
    kCtx.beginPath();
    kCtx.moveTo(116, 150);
    kCtx.lineTo(114, 214);
    kCtx.moveTo(140, 150);
    kCtx.lineTo(142, 214);
    kCtx.stroke();
  } else {
    // Classic Japanese striding emerald-cyan pedestrian icon (hatted silhouette style)
    kCtx.beginPath();
    kCtx.arc(132, 54, 17, 0, Math.PI * 2);
    kCtx.fill();
    kCtx.fillRect(114, 42, 38, 6);
    kCtx.lineWidth = 22;
    kCtx.beginPath();
    kCtx.moveTo(128, 80);
    kCtx.lineTo(124, 142);
    kCtx.stroke();
    // Swinging arms
    kCtx.lineWidth = 13;
    kCtx.beginPath();
    kCtx.moveTo(124, 92);
    kCtx.lineTo(86, 130);
    kCtx.moveTo(132, 92);
    kCtx.lineTo(172, 118);
    kCtx.stroke();
    // Wide striding legs
    kCtx.lineWidth = 16;
    kCtx.beginPath();
    kCtx.moveTo(120, 140);
    kCtx.lineTo(84, 210);
    kCtx.moveTo(130, 140);
    kCtx.lineTo(168, 212);
    kCtx.stroke();
  }

  const maskData = kCtx.getImageData(0, 0, 256, 256).data;
  const [cEm, eCtx] = makeCanvas(256, 256);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 256);

  const tint = kind === 'red' ? '#52151a' : '#0f3f36';
  for (let y = 10; y < 246; y += 8) {
    for (let x = 10; x < 246; x += 8) {
      const idx = (y * 256 + x) * 4;
      if (maskData[idx] > 128) {
        mCtx.fillStyle = tint;
        mCtx.beginPath();
        mCtx.arc(x, y, 2.5, 0, Math.PI * 2);
        mCtx.fill();

        eCtx.fillStyle = '#ffffff';
        eCtx.beginPath();
        eCtx.arc(x, y, 2.8, 0, Math.PI * 2);
        eCtx.fill();
      }
    }
  }

  // Dark optical louver anti-sun horizontal slats & recessed bezel frame
  mCtx.fillStyle = 'rgba(4, 8, 14, 0.52)';
  for (let ly = 0; ly < 256; ly += 16) mCtx.fillRect(0, ly, 256, 4);
  eCtx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  for (let ly = 0; ly < 256; ly += 16) eCtx.fillRect(0, ly, 256, 3);

  mCtx.strokeStyle = '#111827';
  mCtx.lineWidth = 16;
  mCtx.strokeRect(4, 4, 248, 248);

  return { map: toTex(cMap), emissiveMap: toTex(cEm) };
}

/** 4x2 (8-brand) full-color Japanese ice-cream multipack, cup & monaka bar atlas (for un-tinted 0xffffff rendering). */
export function createIceCreamAtlasTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  const items = [
    { qx: 0, qy: 0, title: 'ソーダ', sub: '爽快アイス 7本', bg: '#0284c7', band: '#0369a1', crest: '#ffffff', ink: '#075985', motif: 'frost' },
    { qx: 1, qy: 0, title: 'VANILLA', sub: '濃厚バニラ', bg: '#6d102b', band: '#f59e0b', crest: '#fffbeb', ink: '#4c0519', motif: 'gold' },
    { qx: 2, qy: 0, title: '宇治抹茶', sub: '石臼挽き茶葉', bg: '#14532d', band: '#eab308', crest: '#f0fdf4', ink: '#14532d', motif: 'gold' },
    { qx: 3, qy: 0, title: 'いちご', sub: '練乳みるく', bg: '#e11d48', band: '#881337', crest: '#fff1f2', ink: '#9f1239', motif: 'berry' },
    { qx: 0, qy: 1, title: 'モナカ', sub: 'チョコジャンボ', bg: '#d97706', band: '#451a03', crest: '#fef3c7', ink: '#78350f', motif: 'waffle' },
    { qx: 1, qy: 1, title: '雪見もち', sub: '2個入り', bg: '#f8fafc', band: '#dc2626', crest: '#ffffff', ink: '#b91c1c', motif: 'mochi' },
    { qx: 2, qy: 1, title: 'ピノ 6粒', sub: 'ひとくちチョコ', bg: '#dc2626', band: '#7f1d1d', crest: '#fff5f5', ink: '#991b1b', motif: 'pino' },
    { qx: 3, qy: 1, title: 'ザク黒', sub: 'チョコバー', bg: '#18181b', band: '#eab308', crest: '#fef08a', ink: '#18181b', motif: 'lightning' },
  ];

  for (const st of items) {
    const ox = st.qx * 256;
    const oy = st.qy * 256;
    ctx.fillStyle = st.bg;
    ctx.fillRect(ox, oy, 256, 256);

    ctx.fillStyle = st.band;
    ctx.fillRect(ox, oy, 256, 28);
    ctx.fillRect(ox, oy + 224, 256, 32);

    if (st.motif === 'waffle') {
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
      ctx.lineWidth = 4;
      for (let gx = 0; gx < 256; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(ox + gx, oy + 28);
        ctx.lineTo(ox + gx, oy + 224);
        ctx.stroke();
      }
      for (let gy = 36; gy < 224; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + gy);
        ctx.lineTo(ox + 256, oy + gy);
        ctx.stroke();
      }
    } else if (st.motif === 'frost') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let rx = 18; rx < 250; rx += 54) {
        ctx.beginPath();
        ctx.arc(ox + rx, oy + 62, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (st.motif === 'mochi') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      for (const mx of [76, 180]) {
        ctx.beginPath();
        ctx.arc(ox + mx, oy + 186, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Crisp brand seal / medallion readable both head-on & top-down
    ctx.fillStyle = st.band;
    ctx.beginPath();
    ctx.ellipse(ox + 128, oy + 122, 92, 54, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = st.crest;
    ctx.beginPath();
    ctx.ellipse(ox + 128, oy + 120, 86, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = st.ink;
    ctx.font = '900 30px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.title, ox + 128, oy + 118);
    ctx.fillStyle = st.band;
    ctx.font = '900 15px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillText(st.sub, ox + 128, oy + 146);
  }
  return toTex(c);
}

/** Sub-zero frosted-edge transparent sliding lid glass texture (clear window center + frost border). */
export function createFreezerGlassTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);

  // Subtle icy center transparency + frosty perimeter condensation border
  ctx.fillStyle = 'rgba(216, 242, 255, 0.14)';
  ctx.fillRect(0, 0, 256, 256);

  const rimGrad = ctx.createRadialGradient(128, 128, 56, 128, 128, 152);
  rimGrad.addColorStop(0, 'rgba(230, 248, 255, 0.0)');
  rimGrad.addColorStop(0.65, 'rgba(220, 244, 255, 0.18)');
  rimGrad.addColorStop(1, 'rgba(235, 248, 255, 0.56)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle diagonal glass specular reflection glint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(74, 0);
  ctx.lineTo(24, 256);
  ctx.lineTo(0, 256);
  ctx.lineTo(0, 140);
  ctx.closePath();
  ctx.fill();

  return toTex(c);
}

/** Digital "-19.2°C" glowing LED thermometer readout plaque for chest freezer bezel. */
export function createFreezerTempTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 48);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 128, 48);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 44);

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(16, 24, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 24px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('-19.2℃', 118, 32);
  return toTex(c);
}

/** 4x2 (8-brand) Japanese behind-counter cigarette & heatstick carton front atlas. */
export function createCigaretteAtlasTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  const packs = [
    { qx: 0, qy: 0, brand: 'SEVEN', sub: 'SOFT', bg: '#f8fafc', band: '#1e293b', accent: '#cbd5e1', ink: '#0f172a' },
    { qx: 1, qy: 0, brand: 'MEVIUS', sub: 'LIGHT', bg: '#1e3a8a', band: '#38bdf8', accent: '#ffffff', ink: '#ffffff' },
    { qx: 2, qy: 0, brand: 'RED BOX', sub: 'RICH', bg: '#dc2626', band: '#ffffff', accent: '#111827', ink: '#ffffff' },
    { qx: 3, qy: 0, brand: 'MINT', sub: 'MENTHOL', bg: '#065f46', band: '#34d399', accent: '#ffffff', ink: '#ffffff' },
    { qx: 0, qy: 1, brand: 'PEACE', sub: 'AROMA', bg: '#ca8a04', band: '#1e293b', accent: '#fef08a', ink: '#1e293b' },
    { qx: 1, qy: 1, brand: 'LARK', sub: 'SMOOTH', bg: '#b91c1c', band: '#0f172a', accent: '#fca5a5', ink: '#ffffff' },
    { qx: 2, qy: 1, brand: 'HOPE', sub: 'SHORT', bg: '#0f172a', band: '#facc15', accent: '#ffffff', ink: '#facc15' },
    { qx: 3, qy: 1, brand: 'HEAT', sub: 'BLADE', bg: '#0d9488', band: '#111827', accent: '#99f6e4', ink: '#ffffff' },
  ];

  for (const pk of packs) {
    const ox = pk.qx * 256;
    const oy = pk.qy * 256;
    ctx.fillStyle = pk.bg;
    ctx.fillRect(ox, oy, 256, 256);

    // Flip-top lid crease & contrasting crest band
    ctx.fillStyle = pk.band;
    ctx.fillRect(ox, oy, 256, 68);
    ctx.fillStyle = pk.accent;
    ctx.fillRect(ox, oy + 68, 256, 10);

    // Brand emblem & typography
    ctx.fillStyle = pk.ink;
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.brand, ox + 128, oy + 128);
    ctx.font = '800 16px sans-serif';
    ctx.fillText(pk.sub, ox + 128, oy + 154);

    // Authentic lower-third Japanese white health-warning placard box
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 12, oy + 174, 232, 70);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox + 12, oy + 174, 232, 70);
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 14px "Hiragino Kaku Gothic ProN", sans-serif';
    ctx.fillText('喫煙は健康に', ox + 128, oy + 202);
    ctx.fillText('悪影響を及ぼします', ox + 128, oy + 226);
  }
  return toTex(c);
}

/** 1024x512 aspect-matched Counter UI Atlas (0: POS 360x256, 1: IC Pad 256x256, 2: Coffee 580x256, 3: Hot Case 424x90). */
export function createCounterUiAtlasTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 512);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 512);

  // Region 0 (0..360, 0..256 -> 1.406:1): POS Register Screen UI
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(10, 10, 340, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 19px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('レジ #01   お会計', 22, 36);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(12, 56, 214, 140);
  ctx.fillStyle = '#1e293b';
  ctx.font = '700 14px monospace';
  ctx.fillText('おにぎり 鮭     ¥148', 20, 84);
  ctx.fillText('緑茶 600ml      ¥138', 20, 110);
  ctx.fillText('からあげ棒      ¥198', 20, 136);
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 20px monospace';
  ctx.fillText('合計    ¥484', 20, 180);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(236, 56, 112, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('確定', 292, 134);
  ctx.fillStyle = '#334155';
  ctx.fillRect(12, 204, 336, 40);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 15px sans-serif';
  ctx.fillText('現金 / クレジット / 電子マネー', 180, 230);

  // Region 1 (384..640, 0..256 -> 1.000:1): IC Card / Cashless Tap Terminal
  ctx.fillStyle = '#111827';
  ctx.fillRect(384, 0, 256, 256);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(402, 22, 220, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('タッチ決済', 512, 54);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(512, 142, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(512, 142, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 16px sans-serif';
  ctx.fillText('Suica / PASMO / QR', 512, 224);

  // Region 2 (0..580, 256..512 -> 2.266:1): Self-Serve Coffee Machine Header Panel
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 256, 580, 256);
  ctx.fillStyle = '#451a03';
  ctx.fillRect(14, 270, 552, 54);
  ctx.fillStyle = '#fef3c7';
  ctx.font = '900 26px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('☕ 本格挽きたてカフェ珈琲', 290, 306);
  const cBtns = [
    { x: 16, w: 128, bg: '#dc2626', top: 'HOT R', pr: '¥110' },
    { x: 156, w: 128, bg: '#991b1b', top: 'HOT L', pr: '¥160' },
    { x: 296, w: 128, bg: '#0284c7', top: 'ICE R', pr: '¥110' },
    { x: 436, w: 128, bg: '#0369a1', top: 'ICE L', pr: '¥180' },
  ];
  for (const b of cBtns) {
    ctx.fillStyle = b.bg;
    ctx.fillRect(b.x, 342, b.w, 150);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x, 342, b.w, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px sans-serif';
    ctx.fillText(b.top, b.x + b.w * 0.5, 404);
    ctx.fillStyle = '#fef08a';
    ctx.font = '800 22px sans-serif';
    ctx.fillText(b.pr, b.x + b.w * 0.5, 456);
  }

  // Region 3 (600..1024, 256..346 -> 4.711:1): Hot Case / Nikuman Marquee Banner
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(600, 256, 424, 90);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(600, 256, 424, 8);
  ctx.fillRect(600, 338, 424, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 25px "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillText('揚げたて・ほかほか 肉まん & からあげ', 812, 302);
  ctx.fillStyle = '#fef08a';
  ctx.font = '800 16px sans-serif';
  ctx.fillText('L-CHIKI / KARAAGE / NIKUMAN  ¥130~', 812, 328);

  return toTex(c);
}
