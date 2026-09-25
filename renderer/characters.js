// 캐릭터 — Claude는 고글 쓴 여우 파일럿, Codex는 파란 바이저의 로봇.
// 디자인(테마)마다 소품·연출이 바뀐다. 아케이드·CRT는 픽셀아트로 렌더링한다.
// 표정(state): fresh 쌩쌩 / ok 보통 / tired 지침 / dizzy 한계 / sleep 한도 소진 / none 연결 안 됨

function charState(d) {
  if (!d || !d.fiveHour) return 'none';
  const w = d.fiveHour;
  if (w.resetsAt && w.resetsAt < Date.now()) return 'fresh';
  const p = Math.round(w.percent);
  const wk = d.weekly && !(d.weekly.resetsAt && d.weekly.resetsAt < Date.now()) ? Math.round(d.weekly.percent) : 0;
  if (p >= 100 || wk >= 100) return 'sleep';
  if (p >= 90) return 'dizzy';
  if (p >= 70) return 'tired';
  if (p >= 30) return 'ok';
  return 'fresh';
}

const INK = '#3a2620';

// ---------- 여우 파일럿 (Claude) ----------
function foxEyes(st) {
  const s = `stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none"`;
  switch (st) {
    case 'fresh': return `<path d="M40 60 Q47 52 54 60 M66 60 Q73 52 80 60" ${s}/>`;
    case 'ok': return `<ellipse cx="47" cy="59" rx="3.6" ry="4.6" fill="${INK}"/><ellipse cx="73" cy="59" rx="3.6" ry="4.6" fill="${INK}"/>
      <circle cx="48.3" cy="57.2" r="1.3" fill="#fff"/><circle cx="74.3" cy="57.2" r="1.3" fill="#fff"/>`;
    case 'tired': return `<path d="M41 59 Q47 62 53 59 M67 59 Q73 62 79 59" ${s}/><path d="M41 56 h12 M67 56 h12" stroke="${INK}" stroke-width="1.6" opacity=".5"/>
      <path d="M88 44 q4 7 0 10 q-4 -3 0 -10z" fill="#7cc4ff"/>`;
    case 'dizzy': return `<path d="M42 54 l9 9 m0 -9 l-9 9 M68 54 l9 9 m0 -9 l-9 9" ${s}/>`;
    case 'sleep': return `<path d="M40 58 Q47 64 54 58 M66 58 Q73 64 80 58" ${s}/>`;
    default: return `<circle cx="47" cy="59" r="3" fill="${INK}"/><circle cx="73" cy="59" r="3" fill="${INK}"/>`;
  }
}
function foxMouth(st) {
  if (st === 'fresh') return `<path d="M53 74 Q60 84 67 74 Z" fill="#8a2f2a"/><path d="M56 78 Q60 82 64 78" fill="#ff8a8a"/>`;
  if (st === 'dizzy') return `<path d="M52 77 q2 -3 4 0 q2 3 4 0 q2 -3 4 0 q2 3 4 0" stroke="${INK}" stroke-width="1.8" fill="none"/>`;
  if (st === 'sleep' || st === 'tired') return `<ellipse cx="60" cy="77" rx="2.4" ry="2" fill="${INK}"/>`;
  return `<path d="M53 74 Q56.5 78 60 74 Q63.5 78 67 74" stroke="${INK}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
}
function fox(st, o = {}) {
  const hatColor = o.hat;
  return `
  <defs>
    <linearGradient id="fxFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb068"/><stop offset="1" stop-color="#ec702c"/></linearGradient>
    <linearGradient id="fxJk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f5a37"/><stop offset="1" stop-color="#5a331d"/></linearGradient>
    <radialGradient id="fxLens" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f2fbff"/><stop offset=".55" stop-color="#a9d8f2"/><stop offset="1" stop-color="#5b8db6"/></radialGradient>
    <linearGradient id="fxRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="1" stop-color="#8e98a4"/></linearGradient>
  </defs>
  <path d="M86 108 Q116 96 108 66 Q102 88 82 96 Z" fill="url(#fxFur)"/><path d="M104 74 Q110 70 108 66 Q100 76 99 80Z" fill="#fff6ee"/>
  <path d="M28 120 Q28 92 60 90 Q92 92 92 120 Z" fill="url(#fxJk)"/>
  <path d="M44 92 L60 118 L76 92 Z" fill="#f4e9dc"/>
  <path d="M38 93 Q60 108 82 93 Q80 104 60 108 Q40 104 38 93Z" fill="${o.scarf || '#fff7ef'}"/>
  <rect x="55" y="103" width="10" height="8" rx="2" fill="#e9b24c" stroke="#9a6a1c" stroke-width="1"/>
  <path d="M31 42 L23 7 L52 27 Z" fill="url(#fxFur)"/><path d="M32 35 L28 15 L45 27 Z" fill="#ffd3c0"/>
  <path d="M89 42 L97 7 L68 27 Z" fill="url(#fxFur)"/><path d="M88 35 L92 15 L75 27 Z" fill="#ffd3c0"/>
  <path d="M25 58 Q23 27 60 23 Q97 27 95 58 Q95 81 78 89 Q60 97 42 89 Q25 81 25 58Z" fill="url(#fxFur)"/>
  <path d="M25 66 L18 72 L28 74 Z M95 66 L102 72 L92 74 Z" fill="#fff6ee"/>
  <path d="M33 66 Q40 55 60 64 Q80 55 87 66 Q85 86 60 91 Q35 86 33 66Z" fill="#fffaf3"/>
  ${hatColor ? '' : `
  <path d="M25 41 Q60 28 95 41 L95 49 Q60 37 25 49Z" fill="#5a3a28"/>
  <circle cx="45" cy="39" r="12" fill="url(#fxRim)"/><circle cx="45" cy="39" r="8.6" fill="url(#fxLens)"/>
  <circle cx="75" cy="39" r="12" fill="url(#fxRim)"/><circle cx="75" cy="39" r="8.6" fill="url(#fxLens)"/>
  <rect x="55" y="36" width="10" height="5" rx="2" fill="#7b838e"/>
  <ellipse cx="42" cy="35.5" rx="3" ry="2" fill="#fff" opacity=".85"/><ellipse cx="72" cy="35.5" rx="3" ry="2" fill="#fff" opacity=".85"/>`}
  ${hatColor ? `
  <path d="M30 40 Q32 12 60 12 Q88 12 90 40 Z" fill="${hatColor}"/><path d="M56 13 h8 v27 h-8z" fill="#000" opacity=".12"/>
  <rect x="22" y="36" width="76" height="8" rx="4" fill="${hatColor}" stroke="#000" stroke-opacity=".15"/>
  <path d="M36 32 Q60 26 84 32" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>
  <circle cx="45" cy="48" r="7" fill="url(#fxRim)" opacity=".0"/>` : ''}
  <ellipse cx="39" cy="69" rx="5.5" ry="3.2" fill="#ff8f7c" opacity=".5"/><ellipse cx="81" cy="69" rx="5.5" ry="3.2" fill="#ff8f7c" opacity=".5"/>
  ${foxEyes(st)}
  <ellipse cx="60" cy="69.5" rx="4.6" ry="3.4" fill="#2e1f1a"/><ellipse cx="58.6" cy="68.4" rx="1.4" ry=".9" fill="#fff" opacity=".7"/>
  ${foxMouth(st)}`;
}

// ---------- 로봇 (Codex) ----------
function robotEyes(st) {
  const g = '#62e3ff';
  const s = `stroke="${g}" stroke-width="4.6" stroke-linecap="round" fill="none" filter="url(#rbGlow)"`;
  switch (st) {
    case 'fresh': return `<path d="M41 60 Q48 50 55 60 M65 60 Q72 50 79 60" ${s}/>`;
    case 'ok': return `<rect x="44" y="50" width="7" height="12" rx="3.5" fill="${g}" filter="url(#rbGlow)"/><rect x="69" y="50" width="7" height="12" rx="3.5" fill="${g}" filter="url(#rbGlow)"/>`;
    case 'tired': return `<path d="M42 58 h12 M66 58 h12" ${s}/><path d="M90 40 q4 7 0 10 q-4 -3 0 -10z" fill="#7cc4ff"/>`;
    case 'dizzy': return `<path d="M43 51 l10 10 m0 -10 l-10 10 M67 51 l10 10 m0 -10 l-10 10" stroke="#ff6b6b" stroke-width="4" stroke-linecap="round" filter="url(#rbGlow)"/>`;
    case 'sleep': return `<path d="M42 56 Q48 62 54 56 M66 56 Q72 62 78 56" ${s} opacity=".55"/>`;
    default: return `<circle cx="48" cy="56" r="4" fill="${g}" opacity=".6"/><circle cx="72" cy="56" r="4" fill="${g}" opacity=".6"/>`;
  }
}
function robot(st, o = {}) {
  return `
  <defs>
    <linearGradient id="rbShell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4dcea"/></linearGradient>
    <linearGradient id="rbVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22336a"/><stop offset="1" stop-color="#0a1230"/></linearGradient>
    <linearGradient id="rbBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b97ff"/><stop offset="1" stop-color="#1c4fd8"/></linearGradient>
    <filter id="rbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="35" y="88" width="50" height="34" rx="15" fill="url(#rbShell)" stroke="#bcc7d8"/>
  <rect x="49" y="96" width="22" height="13" rx="4" fill="#15204a"/><circle cx="55" cy="102.5" r="2" fill="#62e3ff"/><circle cx="62" cy="102.5" r="2" fill="#7dff9a"/><circle cx="68" cy="102.5" r="1.6" fill="#ffcf5a"/>
  <ellipse cx="30" cy="102" rx="8" ry="10" fill="url(#rbBlue)"/><ellipse cx="90" cy="102" rx="8" ry="10" fill="url(#rbBlue)"/>
  ${o.hat ? '' : `<line x1="60" y1="22" x2="60" y2="9" stroke="#9fb0c8" stroke-width="3"/><circle cx="60" cy="8" r="5.5" fill="url(#rbBlue)"/><circle cx="58.3" cy="6.3" r="1.6" fill="#fff" opacity=".8"/>`}
  <rect x="13" y="42" width="13" height="28" rx="6.5" fill="url(#rbBlue)"/><rect x="94" y="42" width="13" height="28" rx="6.5" fill="url(#rbBlue)"/>
  <rect x="21" y="21" width="78" height="66" rx="29" fill="url(#rbShell)" stroke="#c3cddd"/>
  <rect x="29" y="35" width="62" height="40" rx="19" fill="url(#rbVisor)"/>
  <path d="M36 42 Q44 37 56 37" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${robotEyes(st)}
  <ellipse cx="33" cy="80" rx="4" ry="2.2" fill="#8fb6ff" opacity=".6"/><ellipse cx="87" cy="80" rx="4" ry="2.2" fill="#8fb6ff" opacity=".6"/>
  ${o.hat ? `
  <path d="M26 34 Q28 6 60 6 Q92 6 94 34 Z" fill="${o.hat}"/><path d="M56 7 h8 v27 h-8z" fill="#fff" opacity=".2"/>
  <rect x="18" y="30" width="84" height="8" rx="4" fill="${o.hat}" stroke="#000" stroke-opacity=".2"/>` : ''}`;
}

// ---------- 소품 ----------
const PROPS = {
  wrench: `<g transform="translate(92 88) rotate(35)"><rect x="-3" y="0" width="6" height="26" rx="3" fill="#aeb8c6"/><path d="M-8 0 a8 8 0 1 1 16 0 l-4 0 l0 -5 l-8 0 l0 5z" fill="#c9d2de"/></g>`,
  mug: `<g><rect x="36" y="94" width="22" height="22" rx="4" fill="#fffaf2" stroke="#d6c4a8" stroke-width="1.5"/><path d="M58 99 q8 0 7 7 q-1 6 -7 5" fill="none" stroke="#d6c4a8" stroke-width="3"/>
    <circle cx="47" cy="104" r="3" fill="#ee8a4a"/><circle cx="43" cy="100" r="1.4" fill="#ee8a4a"/><circle cx="47" cy="99" r="1.4" fill="#ee8a4a"/><circle cx="51" cy="100" r="1.4" fill="#ee8a4a"/>
    <ellipse cx="34" cy="106" rx="5" ry="6" fill="#f08a44"/><path d="M40 90 q-3 -5 0 -9 M47 90 q-3 -5 0 -9" stroke="#d8c8b0" stroke-width="1.6" fill="none" class="steam"/></g>`,
  laptop: `<g><path d="M38 96 L82 96 L86 116 L34 116 Z" fill="#2b3446"/><rect x="30" y="115" width="60" height="5" rx="2" fill="#8d97a8"/><path d="M52 104 l-4 3 4 3 M68 104 l4 3 -4 3 M62 102 l-4 10" stroke="#62e3ff" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`,
  sprout: `<g><path d="M40 100 H64 L60 118 H44 Z" fill="#b8703d"/><rect x="38" y="97" width="28" height="5" rx="2" fill="#cd8450"/>
    <path d="M52 98 V86" stroke="#4f8a2f" stroke-width="2.5"/><path d="M52 90 Q42 80 38 86 Q44 94 52 90Z" fill="#76c04a"/><path d="M52 87 Q60 76 66 81 Q61 90 52 87Z" fill="#8fd35e"/></g>`,
  can: `<g><path d="M76 98 h22 v18 h-22z" fill="#3e79d8" rx="3"/><path d="M98 102 L112 94" stroke="#3e79d8" stroke-width="4" stroke-linecap="round"/><path d="M80 98 q9 -10 18 0" stroke="#2c5fb5" stroke-width="3" fill="none"/>
    <path d="M113 98 l-2 5 M116 100 l-2 5 M110 101 l-2 5" stroke="#7fc6ff" stroke-width="1.6" stroke-linecap="round" class="rain"/></g>`,
  sparkles: `<g fill="#ffd66b"><path d="M14 20 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/><path d="M104 14 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z"/><path d="M110 60 l1.2 3.6 3.6 1.2 -3.6 1.2 -1.2 3.6 -1.2 -3.6 -3.6 -1.2 3.6 -1.2z"/></g>`,
  dome: (tint) => `<defs><radialGradient id="dome${tint.replace('#', '')}" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="${tint}" stop-opacity=".12"/><stop offset="1" stop-color="${tint}" stop-opacity=".35"/></radialGradient></defs>
    <circle cx="60" cy="60" r="56" fill="url(#dome${tint.replace('#', '')})" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
    <path d="M22 38 Q34 14 60 8" stroke="#fff" stroke-opacity=".75" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  cloud: `<path d="M8 118 Q6 104 20 104 Q24 94 36 98 Q46 90 58 98 Q70 90 82 98 Q96 94 100 104 Q114 104 112 118 Z" fill="#fff" opacity=".95"/>`,
  porthole: `<circle cx="60" cy="60" r="57" fill="none" stroke="#8a9099" stroke-width="6"/><circle cx="60" cy="60" r="53" fill="none" stroke="#2f343c" stroke-width="2"/>
    <g fill="#b9bfc8">${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${60 + 57 * Math.cos(a * Math.PI / 180)}" cy="${60 + 57 * Math.sin(a * Math.PI / 180)}" r="2.2"/>`).join('')}</g>`,
};

// 디자인별 연출
const LOOK = {
  cyber: { claude: { props: [] }, codex: { props: ['wrench'] } },
  engine: { claude: { props: [], over: ['porthole'], dome: '#ffb347' }, codex: { props: ['wrench'], over: ['porthole'], dome: '#6aa8ff' } },
  mascot: { claude: { props: ['mug'] }, codex: { props: ['laptop'] } },
  arcade: { claude: { props: [], pixel: 34 }, codex: { props: ['wrench'], pixel: 34 } },
  glass: { claude: { under: ['cloud'], dome: '#9cc8ff' }, codex: { props: ['laptop'], under: ['cloud'], dome: '#9cc8ff' } },
  crt: { claude: { props: ['laptop'], pixel: 30, mono: true }, codex: { props: ['laptop'], pixel: 30, mono: true } },
  industrial: { claude: { hat: '#f5b41a', props: ['wrench'] }, codex: { hat: '#2f6fe0', props: ['wrench'] } },
  garden: { claude: { props: ['sprout'], scarf: '#e7f3d6' }, codex: { props: ['can'] } },
  anime: { claude: { props: ['sparkles'] }, codex: { props: ['sparkles'] } },
  editorial: { claude: { props: ['mug'] }, codex: { props: ['laptop'] } },
};

function characterSVG(theme, svc, state) {
  const look = (LOOK[theme] || LOOK.cyber)[svc] || {};
  const body = svc === 'claude' ? fox(state, { hat: look.hat, scarf: look.scarf }) : robot(state, { hat: look.hat });
  const under = (look.under || []).map((k) => PROPS[k]).join('');
  const props = (look.props || []).map((k) => PROPS[k]).join('');
  const dome = look.dome ? PROPS.dome(look.dome) : '';
  const over = (look.over || []).map((k) => PROPS[k]).join('');
  const zzz = state === 'sleep' ? `<text class="zzz" x="96" y="26" font-size="16" font-weight="900" fill="#8fb6ff">z</text><text class="zzz z2" x="106" y="14" font-size="11" font-weight="900" fill="#8fb6ff">z</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 124" class="chr" style="overflow:visible">${under}${body}${props}${dome}${over}${zzz}</svg>`;
  return uniqueIds(svg);
}

// 그라디언트 id가 여러 그림에서 겹치면, 숨겨진(display:none) 그림의 정의를 참조해 색이 사라진다 → 그림마다 고유 id
let svgSeq = 0;
function uniqueIds(svg) {
  const n = ++svgSeq;
  return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`);
}

// 아케이드·CRT: 작은 캔버스에 그린 뒤 확대해서 도트 느낌을 낸다
const pixelCache = new Map();
function drawCharacter(theme, svc, state) {
  const look = (LOOK[theme] || LOOK.cyber)[svc] || {};
  const svg = characterSVG(theme, svc, state);
  if (!look.pixel) return svg;
  const key = `${theme}:${svc}:${state}`;
  return `<canvas class="pixchar${look.mono ? ' mono' : ''}" width="${look.pixel}" height="${Math.round(look.pixel * 124 / 120)}" data-pix="${key}"></canvas>`
    + `<template data-pix-src="${key}">${svg}</template>`;
}
function hydratePixels(root) {
  for (const cv of root.querySelectorAll('canvas[data-pix]')) {
    const key = cv.dataset.pix;
    const draw = (img) => { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height); };
    if (pixelCache.has(key)) { draw(pixelCache.get(key)); continue; }
    const tpl = root.querySelector(`template[data-pix-src="${key}"]`);
    if (!tpl) continue;
    const img = new Image();
    img.onload = () => { pixelCache.set(key, img); draw(img); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tpl.innerHTML);
  }
}
