// NEWS-1-1: "The World, Tuesday 17 November 2026 - one front page".
// A code-drawn front page (SVG built in code, rasterised to PNG by a small
// built-in renderer). Node 22 standard library only, no network, no fonts:
// text is drawn with a 5x7 bitmap font written out below. Deterministic:
// the same bytes on every run.
//
// Layout (1024x1024, cream paper #F6F1E6, ink #1A1A1A, one red accent
// #B3261E): masthead + date; lead story (Kerch Bridge) with a flat vector
// illustration, ~40% of the page; six secondary stories in a 2x3 grid,
// each a region label + headline (<=10 words) + one summary line; footer
// with sources. About 119 words in total, legible at half size.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 230];
const INK = [26, 26, 26];
const RED = [179, 38, 30];
const SEA = [157, 180, 192];
const WHITE = [255, 255, 255];
const W = 1024;
const H = 1024;

// ------------------------------------------------------------- 5x7 font
// Each glyph is 7 rows of 5 bits, '1' = filled. Uppercase + digits +
// punctuation only; all copy in the image is set in capitals.
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
};

// ------------------------------------------------------------- rasteriser
class Canvas {
  data = new Uint8Array(W * H * 3);
  constructor() {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = PAPER[0];
      this.data[i * 3 + 1] = PAPER[1];
      this.data[i * 3 + 2] = PAPER[2];
    }
  }
  px(x: number, y: number, c: number[]) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: number[]) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  // Stroke-only rectangle (border of width t).
  frame(x: number, y: number, w: number, h: number, c: number[], t: number) {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number[], w: number) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const r = Math.max(0, Math.floor(w / 2));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + (dx * i) / steps);
      const y = Math.round(y0 + (dy * i) / steps);
      for (let yy = y - r; yy <= y + r; yy++)
        for (let xx = x - r; xx <= x + r; xx++) this.px(xx, yy, c);
    }
  }
  polyline(pts: number[][], c: number[], w: number) {
    for (let i = 0; i + 1 < pts.length; i++)
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, w);
  }
  polygon(pts: number[][], c: number[]) {
    // Scanline fill.
    let minY = H;
    let maxY = 0;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(Math.round(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = xs[i]; x <= xs[i + 1]; x++) this.px(x, y, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: number[]) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.px(x, y, c);
  }
  // Draw one line of text. size = cap height in px (multiple of 7).
  // (x, baselineY): left edge / baseline for anchor=start, centre for middle.
  text(s: string, x: number, baselineY: number, size: number, c: number[], anchor = 'start') {
    const scale = Math.max(1, Math.round(size / 7));
    const adv = 6 * scale;
    let total = 0;
    for (const ch of s) total += ch === ' ' ? adv : adv;
    let cx = anchor === 'middle' ? x - Math.floor(total / 2) : x;
    const top = baselineY - 7 * scale;
    for (const ch of s) {
      const g = FONT[ch] ?? FONT['?'];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 5; col++)
          if (g[row][col] === '1')
            this.rect(cx + col * scale, top + row * scale, scale, scale, c);
      cx += adv;
    }
  }
}

// ------------------------------------------------------------ SVG helpers
// The design is emitted as a small SVG document (rect/line/polyline/
// polygon/circle/text only) and rasterised by parseSvg below: SVG -> PNG.
const svgParts: string[] = [];
const esc = (s: string) => s.replace(/&/g, '&amp;');
function rect(x: number, y: number, w: number, h: number, fill: string) {
  svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
}
function frame(x: number, y: number, w: number, h: number, stroke: string, sw: number) {
  svgParts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
  );
}
function hline(x0: number, x1: number, y: number, stroke: string, sw: number) {
  svgParts.push(
    `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${stroke}" stroke-width="${sw}"/>`,
  );
}
function vline(x: number, y0: number, y1: number, stroke: string, sw: number) {
  svgParts.push(
    `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${stroke}" stroke-width="${sw}"/>`,
  );
}
function polyline(pts: number[][], stroke: string, sw: number) {
  svgParts.push(
    `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`,
  );
}
function polygon(pts: number[][], fill: string) {
  svgParts.push(
    `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}"/>`,
  );
}
function text(x: number, y: number, size: number, fill: string, s: string, anchor = 'start') {
  svgParts.push(
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`,
  );
}
const hex = (c: number[]) =>
  '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const INK_S = hex(INK);
const RED_S = hex(RED);
const SEA_S = hex(SEA);
const WHITE_S = hex(WHITE);
const PAPER_S = hex(PAPER);

function buildSvg(): string {
  // ---- frame
  frame(30, 30, 964, 960, INK_S, 3);
  // ---- masthead
  text(512, 139, 91, INK_S, 'THE WORLD', 'middle');
  hline(36, 988, 156, INK_S, 5);
  hline(36, 988, 164, INK_S, 1);
  rect(196, 188, 10, 10, RED_S);
  rect(818, 188, 10, 10, RED_S);
  text(512, 206, 28, INK_S, 'TUESDAY 17 NOVEMBER 2026', 'middle');
  // ---- lead story (left: words; right: flat illustration)
  text(36, 257, 21, RED_S, 'EUROPE - UKRAINE WAR');
  text(36, 317, 49, INK_S, 'KERCH BRIDGE');
  text(36, 373, 49, INK_S, 'FALLS AGAIN');
  text(36, 417, 21, INK_S, 'UKRAINE HITS THE ROAD SPAN');
  text(36, 447, 21, INK_S, 'A SECOND DAY; TWO KILLED,');
  text(36, 477, 21, INK_S, 'THE ARCH IN THE SEA.');
  // illustration: Kerch Strait, broken bridge, fallen arch in the sea
  frame(620, 224, 368, 332, INK_S, 2);
  // two small drones in the sky
  polygon([[660, 256], [676, 261], [660, 266], [665, 261]], INK_S);
  polygon([[706, 246], [720, 250], [706, 254], [710, 250]], INK_S);
  // sea
  rect(628, 420, 352, 128, SEA_S);
  // fallen arch, half under water (rounder curve)
  polyline([[798, 470], [812, 448], [832, 436], [860, 432], [888, 436], [908, 448], [922, 470]], INK_S, 7);
  // waves over the fallen arch
  polyline([[628, 452], [660, 444], [692, 452], [724, 444], [756, 452], [788, 444], [820, 452], [852, 444], [884, 452], [916, 444], [948, 452], [972, 446]], WHITE_S, 3);
  polyline([[628, 492], [664, 484], [700, 492], [736, 484], [772, 492], [808, 484], [844, 492], [880, 484], [916, 492], [952, 484], [972, 490]], WHITE_S, 3);
  // bridge deck: two spans with a gap where the road span fell
  rect(628, 340, 140, 12, INK_S);
  rect(806, 340, 174, 12, INK_S);
  // standing arch over the left span (rounder curve)
  polyline([[640, 340], [648, 302], [664, 278], [684, 264], [700, 262], [716, 264], [736, 278], [752, 302], [760, 340]], INK_S, 7);
  // broken stub on the right span
  polyline([[806, 340], [820, 310], [830, 300]], INK_S, 7);
  // pillars down to the sea
  rect(650, 352, 10, 68, INK_S);
  rect(740, 352, 10, 68, INK_S);
  rect(880, 352, 10, 68, INK_S);
  rect(950, 352, 10, 68, INK_S);
  // red burst where the span fell
  polygon([[787, 314], [791, 324], [801, 324], [793, 331], [796, 341], [787, 335], [778, 341], [781, 331], [773, 324], [783, 324]], RED_S);
  text(804, 540, 14, INK_S, 'KERCH STRAIT', 'middle');
  // ---- divider
  hline(36, 988, 572, INK_S, 3);
  // ---- six secondary stories, 2 columns x 3 rows
  const stories: { label: string; head: string[]; sum: string[] }[] = [
    {
      label: 'ASIA - DIPLOMACY',
      head: ['ASEAN CLOSES IN MANILA'],
      sum: ['TRUMP JOINS QUAD TALKS; US-THAI', 'TRADE DEAL SIGNED.'],
    },
    {
      label: 'AMERICAS - HEALTH',
      head: ['US LOSES MEASLES-FREE', 'STATUS'],
      sum: ['5,412 CASES IN 2026, THE MOST', 'SINCE 1991.'],
    },
    {
      label: 'ASIA - POLITICS',
      head: ['MONGOLIA PRESIDENT', 'TO RESIGN'],
      sum: ['$25M BRIBERY CLAIM DENIED;', 'PARLIAMENT TO DECIDE.'],
    },
    {
      label: 'ASIA - DEFENCE',
      head: ['JAPAN SCRAMBLES JETS'],
      sum: ['SUSPECTED RUSSIAN PLANES ENTER', 'AIRSPACE NEAR OKINOSHIMA.'],
    },
    {
      label: 'MIDDLE EAST - POLITICS',
      head: ['KNESSET ELECTS NEW', 'SPEAKER'],
      sum: ['KAHANA WINS 66-52 IN A BLOW', 'TO NETANYAHU.'],
    },
    {
      label: 'NORTH AMERICA - TECH',
      head: ['APPLE ICLOUD GOES DARK'],
      sum: ['OUTAGE HITS ALL USERS; FAA HALTS', 'JUNIPER ROLLOUT.'],
    },
  ];
  const colX = [36, 532];
  const rowT = [588, 710, 832];
  vline(512, 588, 944, INK_S, 1);
  hline(36, 988, 698, INK_S, 1);
  hline(36, 988, 820, INK_S, 1);
  stories.forEach((st, i) => {
    const x = colX[i % 2];
    const t = rowT[Math.floor(i / 2)];
    text(x, t + 14, 14, RED_S, st.label);
    st.head.forEach((ln, j) => text(x, t + 43 + j * 27, 21, INK_S, ln));
    const sumTop = t + 43 + (st.head.length - 1) * 27 + 8;
    st.sum.forEach((ln, j) => text(x, sumTop + 14 + j * 19, 14, INK_S, ln));
  });
  // ---- footer
  hline(36, 988, 956, INK_S, 2);
  text(512, 978, 14, INK_S, 'SOURCES: REUTERS, AP, AL JAZEERA, PAHO - FACTS AS OF 23:59 UTC', 'middle');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svgParts.join('')}</svg>`;
}

// --------------------------------------------------------- SVG -> pixels
function parseColor(s: string): number[] {
  if (s === 'none') return PAPER;
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) throw new Error(`bad colour ${s}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function attr(tag: string, name: string, def = ''): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : def;
}
function parseSvg(svg: string, cv: Canvas) {
  const re = /<(rect|line|polyline|polygon|circle|text)([^>]*)\/?>([^<]*)?(?:<\/\1>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const kind = m[1];
    const attrs = m[2];
    const body = (m[3] ?? '').trim();
    const num = (n: string) => Number(attr(attrs, n, '0'));
    if (kind === 'rect') {
      const fill = attr(attrs, 'fill', 'none');
      const stroke = attr(attrs, 'stroke', 'none');
      const sw = Number(attr(attrs, 'stroke-width', '1'));
      if (fill !== 'none')
        cv.rect(num('x'), num('y'), num('width'), num('height'), parseColor(fill));
      if (stroke !== 'none')
        cv.frame(num('x'), num('y'), num('width'), num('height'), parseColor(stroke), sw);
    } else if (kind === 'line') {
      cv.line(num('x1'), num('y1'), num('x2'), num('y2'), parseColor(attr(attrs, 'stroke')), Number(attr(attrs, 'stroke-width', '1')));
    } else if (kind === 'polyline') {
      const pts = attr(attrs, 'points')
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number));
      cv.polyline(pts, parseColor(attr(attrs, 'stroke')), Number(attr(attrs, 'stroke-width', '1')));
    } else if (kind === 'polygon') {
      const pts = attr(attrs, 'points')
        .trim()
        .split(/\s+/)
        .map((p) => p.split(',').map(Number));
      cv.polygon(pts, parseColor(attr(attrs, 'fill')));
    } else if (kind === 'circle') {
      cv.circle(num('cx'), num('cy'), num('r'), parseColor(attr(attrs, 'fill')));
    } else if (kind === 'text') {
      const decoded = body
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      cv.text(
        decoded,
        num('x'),
        num('y'),
        num('font-size'),
        parseColor(attr(attrs, 'fill')),
        attr(attrs, 'text-anchor', 'start'),
      );
    }
  }
}

// -------------------------------------------------------------- PNG write
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function toPng(cv: Canvas): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(cv.data.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const svg = buildSvg();
const cv = new Canvas();
parseSvg(svg, cv);
const png = toPng(cv);
writeFileSync(join(outDir, 'entry.png'), png);
console.log(
  `entry.png ${png.length} bytes sha256=${createHash('sha256').update(png).digest('hex')}`,
);
