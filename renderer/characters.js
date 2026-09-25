// 테마마다 실루엣과 종이 다른 캐릭터 듀오. 아케이드·CRT는 픽셀 아트로 렌더링한다.
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

// Every theme gets its own cast. The character silhouette, face, and props change
// with the visual world, while the quota state still drives the expression.
function expression(state, { x1 = 46, x2 = 74, y = 61, mouthY = 78, ink = '#49362f', glow = null } = {}) {
  const stroke = glow || ink;
  let eyes;
  if (state === 'fresh') eyes = `<path d="M${x1 - 5} ${y} q5 -8 10 0 M${x2 - 5} ${y} q5 -8 10 0" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round"/>`;
  else if (state === 'tired') eyes = `<path d="M${x1 - 5} ${y} q5 3 10 0 M${x2 - 5} ${y} q5 3 10 0" fill="none" stroke="${stroke}" stroke-width="3.4" stroke-linecap="round"/><path d="M${x1 - 5} ${y - 4} h10 M${x2 - 5} ${y - 4} h10" stroke="${ink}" stroke-width="1.5" opacity=".45"/>`;
  else if (state === 'dizzy') eyes = `<path d="M${x1 - 4} ${y - 5} l8 9 m0 -9 l-8 9 M${x2 - 4} ${y - 5} l8 9 m0 -9 l-8 9" fill="none" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round"/>`;
  else if (state === 'sleep') eyes = `<path d="M${x1 - 5} ${y} q5 5 10 0 M${x2 - 5} ${y} q5 5 10 0" fill="none" stroke="${stroke}" stroke-width="3.1" stroke-linecap="round"/>`;
  else if (state === 'none') eyes = `<circle cx="${x1}" cy="${y}" r="4" fill="none" stroke="${stroke}" stroke-width="2.2"/><circle cx="${x2}" cy="${y}" r="4" fill="none" stroke="${stroke}" stroke-width="2.2"/>`;
  else eyes = `<ellipse cx="${x1}" cy="${y}" rx="3.3" ry="4.3" fill="${stroke}"/><ellipse cx="${x2}" cy="${y}" rx="3.3" ry="4.3" fill="${stroke}"/><circle cx="${x1 + 1}" cy="${y - 1.5}" r="1.1" fill="#fff" opacity=".9"/><circle cx="${x2 + 1}" cy="${y - 1.5}" r="1.1" fill="#fff" opacity=".9"/>`;
  const mouth = state === 'fresh' ? `<path d="M${x1 + 2} ${mouthY} Q60 ${mouthY + 10} ${x2 - 2} ${mouthY} Q60 ${mouthY + 13} ${x1 + 2} ${mouthY}Z" fill="#9d4d53"/><path d="M55 ${mouthY + 5} Q60 ${mouthY + 9} 65 ${mouthY + 5}" stroke="#ffc3bd" stroke-width="2" fill="none"/>`
    : state === 'dizzy' ? `<path d="M53 ${mouthY + 2} q3 -4 6 0 q3 4 6 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
      : state === 'tired' || state === 'sleep' ? `<ellipse cx="60" cy="${mouthY + 2}" rx="2.7" ry="2" fill="${ink}"/>`
        : `<path d="M54 ${mouthY} Q60 ${mouthY + 6} 66 ${mouthY}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
  return `${eyes}${mouth}`;
}

function svgDefs() {
  return `<defs>
    <linearGradient id="furAmber" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffbd7b"/><stop offset="1" stop-color="#dd6d39"/></linearGradient>
    <linearGradient id="furCream" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff6e8"/><stop offset="1" stop-color="#e8c9a1"/></linearGradient>
    <linearGradient id="shellBlue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9ed8ff"/><stop offset="1" stop-color="#587de0"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f2f5f8"/><stop offset=".55" stop-color="#aeb9c8"/><stop offset="1" stop-color="#68778a"/></linearGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b4e879"/><stop offset="1" stop-color="#4f9b60"/></linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2"/><feOffset dy="2"/><feComponentTransfer><feFuncA type="linear" slope=".2"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

const CAST = {
  cyber: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M28 52 L24 13 Q41 18 51 35 Q72 15 96 17 L89 55 Q103 71 95 92 L105 118 Q61 135 18 117 L29 91 Q18 74 28 52Z" fill="#222944" stroke="#5de7f1" stroke-width="2"/><path d="M30 51 L28 21 Q40 27 48 42 M91 48 L96 25 Q83 29 74 42" fill="#ef8758" stroke="#ffb276" stroke-width="2"/><path d="M34 50 Q60 33 86 50 L88 75 Q85 94 60 98 Q35 94 32 75Z" fill="url(#furAmber)"/><path d="M33 76 Q45 67 60 76 Q75 67 87 76 Q81 94 60 96 Q39 94 33 76Z" fill="#fff1df"/><path d="M27 51 Q60 34 91 51 L89 60 Q60 48 29 61Z" fill="#1b2342" stroke="#52dce8" stroke-width="2"/><path d="M44 52 h14 M64 52 h14" stroke="#6efffb" stroke-width="4" stroke-linecap="round"/><circle cx="38" cy="69" r="3" fill="#ffb18d" opacity=".65"/><circle cx="82" cy="69" r="3" fill="#ffb18d" opacity=".65"/>${expression(s,{x1:49,x2:71,y:72,mouthY:83,ink:'#482e2a',glow:'#59f0ed'})}<path d="M35 103 Q60 96 85 103 L94 122 H25Z" fill="#34446b" stroke="#63d8e7" stroke-width="2"/><path d="M45 105 l15 10 15-10" fill="#ef8758"/><path d="M49 116 h22" stroke="#73f3ed" stroke-width="2" stroke-linecap="round"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M60 16 L91 33 L101 62 L87 91 L60 108 L33 91 L19 62 L29 33Z" fill="#24204c" stroke="#8c7cff" stroke-width="2.5"/><path d="M60 24 L82 37 L90 61 L80 82 L60 94 L40 82 L30 61 L38 37Z" fill="#102c4a" stroke="#48e9ff" stroke-width="2"/><path d="M35 47 Q60 36 85 47 L84 70 Q60 82 36 70Z" fill="#101a38" stroke="#559eff" stroke-width="2"/><path d="M44 59 h10 M66 59 h10" stroke="#6efff0" stroke-width="4" stroke-linecap="round"/>${expression(s,{x1:49,x2:71,y:60,mouthY:72,ink:'#92dfff',glow:'#64fff0'})}<path d="M37 93 l-8 16 M83 93 l8 16 M26 52 l-9-7 M94 52 l9-7" stroke="#7e72ff" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="14" r="5" fill="#62efff"/><circle cx="16" cy="42" r="2.5" fill="#ff76c8"/><circle cx="104" cy="43" r="2.5" fill="#62efff"/><path d="M60 108 v10" stroke="#62efff" stroke-width="3" stroke-dasharray="2 3"/></g>`,
  },
  engine: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M19 115 Q21 91 39 89 H81 Q99 91 101 115 L91 124 H29Z" fill="#e6edf3" stroke="#78899a" stroke-width="2"/><path d="M39 91 l21 24 21-24" fill="#f2a642"/><path d="M20 56 Q20 16 60 13 Q100 16 100 56 L93 84 Q84 99 60 101 Q36 99 27 84Z" fill="#dce9f2" stroke="#7a8c9a" stroke-width="3"/><path d="M27 56 Q29 24 60 23 Q91 24 93 56 L85 77 H35Z" fill="#7db9d8" stroke="#f9f1d7" stroke-width="3"/><path d="M36 49 Q60 39 84 49" stroke="#fff" stroke-width="4" opacity=".8" fill="none"/><path d="M44 60 Q49 55 54 60 M66 60 Q71 55 76 60" stroke="#283c50" stroke-width="3" stroke-linecap="round" fill="none"/>${expression(s,{x1:49,x2:71,y:63,mouthY:77,ink:'#59443b'})}<path d="M18 44 l-8 8 8 7 M102 44 l8 8-8 7" fill="#e6a949" stroke="#a26c2e" stroke-width="2"/><path d="M47 104 h26" stroke="#647789" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="110" r="5" fill="#ffbd53"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M22 86 l-13-14 7-7 18 13 M98 86 l13-14-7-7-18 13" fill="none" stroke="#8c9cac" stroke-width="7" stroke-linecap="round"/><path d="M25 55 Q60 34 95 55 L89 94 Q60 111 31 94Z" fill="url(#metal)" stroke="#626f7b" stroke-width="3"/><path d="M30 57 Q19 48 18 38 Q37 37 44 50 M90 57 Q101 48 102 38 Q83 37 76 50" fill="#ed9741" stroke="#ab5f30" stroke-width="3"/><circle cx="48" cy="69" r="5" fill="#39c6e8"/><circle cx="72" cy="69" r="5" fill="#39c6e8"/><path d="M37 83 Q60 95 83 83" fill="none" stroke="#596f82" stroke-width="3" stroke-linecap="round"/><path d="M35 98 l-9 14 M53 101 l-3 15 M67 101 l3 15 M85 98 l9 14" stroke="#aeb9c8" stroke-width="5" stroke-linecap="round"/><path d="M18 32 Q7 20 13 10 Q29 13 30 29 M102 32 Q113 20 107 10 Q91 13 90 29" fill="#efaa4e" stroke="#a96735" stroke-width="2"/><path d="M48 52 q12-12 24 0" stroke="#ffd077" stroke-width="3" fill="none"/></g>`,
  },
  mascot: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M23 57 Q12 40 17 26 Q35 27 44 45 M97 57 Q108 40 103 26 Q85 27 76 45" fill="#c98250" stroke="#955536" stroke-width="2"/><path d="M28 101 Q14 91 16 116 H104 Q106 91 92 101" fill="#f1a45c"/><path d="M25 61 Q25 38 60 36 Q95 38 95 61 L88 84 Q76 99 60 99 Q44 99 32 84Z" fill="#df9255" stroke="#a9653b" stroke-width="2"/><path d="M30 73 Q40 69 48 78 Q60 85 72 78 Q81 69 90 73 Q85 93 60 96 Q35 93 30 73Z" fill="url(#furCream)"/><ellipse cx="45" cy="72" rx="4" ry="5" fill="#50372c"/><ellipse cx="75" cy="72" rx="4" ry="5" fill="#50372c"/><circle cx="46" cy="70" r="1.5" fill="#fff"/><circle cx="76" cy="70" r="1.5" fill="#fff"/><path d="M55 80 Q60 75 65 80 Q63 86 60 85 Q57 86 55 80Z" fill="#71453d"/><path d="M60 85 v4 M60 89 q-5 5-9 0 M60 89 q5 5 9 0" stroke="#71453d" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="39" cy="80" rx="6" ry="3" fill="#f58b86" opacity=".55"/><ellipse cx="81" cy="80" rx="6" ry="3" fill="#f58b86" opacity=".55"/><path d="M39 101 Q60 112 81 101 L90 123 H30Z" fill="#e97158"/><path d="M47 106 l13 11 13-11" fill="#fff0d4"/><circle cx="60" cy="114" r="4" fill="#f6c858"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M40 53 Q31 9 38 7 Q53 7 55 48 M80 53 Q89 9 82 7 Q67 7 65 48" fill="#faf7f1" stroke="#a5b8d8" stroke-width="3"/><path d="M42 44 Q39 17 43 15 Q51 17 52 45 M78 44 Q81 17 77 15 Q69 17 68 45" fill="#8ba8e8"/><path d="M24 66 Q25 40 60 38 Q95 40 96 66 L88 93 Q75 104 60 104 Q45 104 32 93Z" fill="#f9f8f4" stroke="#9badd0" stroke-width="2.5"/><path d="M29 71 Q38 61 47 68 M73 68 Q82 61 91 71" stroke="#9ab0e6" stroke-width="7" stroke-linecap="round" fill="none"/><ellipse cx="46" cy="70" rx="3.4" ry="4.4" fill="#37456c"/><ellipse cx="74" cy="70" rx="3.4" ry="4.4" fill="#37456c"/><circle cx="47" cy="68" r="1.3" fill="#fff"/><circle cx="75" cy="68" r="1.3" fill="#fff"/><path d="M57 81 Q60 78 63 81 Q62 85 60 85 Q58 85 57 81Z" fill="#df8f9c"/><path d="M60 85 q-4 5-8 0 M60 85 q4 5 8 0" stroke="#596a9a" stroke-width="1.6" fill="none"/><path d="M35 101 Q60 94 85 101 L94 123 H26Z" fill="#7d98d6"/><path d="M42 104 Q60 114 78 104" stroke="#dae4ff" stroke-width="5" fill="none"/><path d="M97 92 q12 2 8 13 q-9 3-12-5Z" fill="#adbbeb"/></g>`,
  },
  arcade: {
    claude: (s) => `<g shape-rendering="crispEdges"><path d="M28 88 L17 59 L27 42 L21 21 L44 31 L59 21 L75 31 L96 19 L92 43 L104 58 L92 88 L102 113 L74 120 L60 111 L43 120 L18 111Z" fill="#8a6bff" stroke="#e2c3ff" stroke-width="3"/><path d="M31 64 L18 47 L38 50 M88 64 L103 47 L83 50" fill="#53dfbc" stroke="#d8fff2" stroke-width="2"/><path d="M36 53 Q60 37 84 53 L83 78 Q60 91 37 78Z" fill="#91df78"/><path d="M44 64 h7 M69 64 h7" stroke="#291a4d" stroke-width="5"/><path d="M53 77 h14 v5 h-14z" fill="#592a61"/><path d="M40 97 h40 v10 h-40z" fill="#f1a86f"/><path d="M25 34 l5-10 5 10 M88 31 l5-9 5 9" fill="#ffcf63"/><path d="M104 83 h7 v7 h-7z M13 76 h7 v7 h-7z" fill="#66f4e1"/></g>`,
    codex: (s) => `<g shape-rendering="crispEdges"><path d="M25 67 V46 H35 V35 H45 V29 H75 V35 H85 V46 H95 V67 H89 V96 H80 V105 H40 V96 H31 V67Z" fill="#57b8ff" stroke="#ddf4ff" stroke-width="3"/><path d="M37 54 h12 v12 H37z M70 54 h12 v12 H70z" fill="#292061"/><path d="M40 57 h5 v6 h-5z M73 57 h5 v6 h-5z" fill="#ffec75"/><path d="M47 78 h26 v7 H47z" fill="#6d53c7"/><path d="M36 99 h11 v10 H36z M74 99 h11 v10 H74z" fill="#d9edff"/><path d="M52 29 V17 H68 V29" fill="#ff7cb9" stroke="#ffe1f1" stroke-width="2"/><path d="M14 42 h9 v9 h-9z M97 78 h9 v9 h-9z" fill="#a18aff"/></g>`,
  },
  glass: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M22 88 Q13 82 17 70 Q18 60 31 59 Q31 39 49 38 Q62 23 75 42 Q94 38 96 58 Q109 62 105 77 Q104 89 92 91Z" fill="#fff" fill-opacity=".83" stroke="#b4d7f4" stroke-width="2.5"/><path d="M32 60 Q38 45 53 49 M68 44 Q80 43 86 55" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/><ellipse cx="47" cy="67" rx="3.2" ry="4" fill="#5b78a0"/><ellipse cx="74" cy="67" rx="3.2" ry="4" fill="#5b78a0"/><circle cx="48" cy="65" r="1.2" fill="#fff"/><circle cx="75" cy="65" r="1.2" fill="#fff"/><path d="M55 77 Q60 82 65 77" stroke="#7d96b6" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M45 94 Q60 88 75 94 L81 116 Q60 127 39 116Z" fill="#c8e8f5" fill-opacity=".7" stroke="#a9d8e8" stroke-width="2"/><path d="M39 103 Q60 111 81 103" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/><circle cx="60" cy="106" r="4" fill="#ffcf8a"/><path d="M28 103 Q18 97 17 89 M92 103 Q102 97 103 89" stroke="#a4cee5" stroke-width="4" stroke-linecap="round"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M24 51 Q25 24 60 20 Q95 24 96 51 Q95 76 82 82 L78 112 Q74 121 69 111 L64 87 H56 L51 112 Q46 121 42 112 L38 82 Q25 76 24 51Z" fill="#9de5ed" fill-opacity=".66" stroke="#65bfd2" stroke-width="2.5"/><path d="M31 50 Q35 28 60 28 Q85 28 89 50 Q84 69 60 73 Q36 69 31 50Z" fill="#d5f7f5" fill-opacity=".82" stroke="#b1eeed" stroke-width="2"/><path d="M40 47 Q60 40 80 47" stroke="#fff" stroke-width="4" opacity=".9" fill="none"/><ellipse cx="49" cy="54" rx="3.2" ry="4" fill="#4a829d"/><ellipse cx="71" cy="54" rx="3.2" ry="4" fill="#4a829d"/><path d="M55 64 Q60 68 65 64" stroke="#588da0" stroke-width="2" fill="none"/><path d="M40 82 Q31 99 34 111 M53 86 Q47 104 50 117 M68 86 Q74 104 70 117 M82 82 Q91 99 87 111" stroke="#72c9d5" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="29" cy="43" r="4" fill="#fff" opacity=".8"/><circle cx="94" cy="64" r="3" fill="#fff" opacity=".8"/></g>`,
  },
  crt: {
    claude: (s) => `<g shape-rendering="crispEdges"><path d="M24 105 V28 H36 V18 H84 V28 H96 V95 H88 V105 H24Z" fill="#07180c" stroke="#65ff8e" stroke-width="3"/><path d="M34 39 H86 V81 H34Z" fill="#0e3219" stroke="#38c96d" stroke-width="2"/><path d="M39 48 h12 v12 H39z M69 48 h12 v12 H69z" fill="#70ff9a"/><path d="M43 51 h5 v7 h-5z M73 51 h5 v7 h-5z" fill="#06170a"/><path d="M46 68 H74 V73 H46z" fill="#5aff83"/><path d="M43 89 H77 V93 H43z" fill="#45cf70"/><path d="M17 51 H26 M94 51 H103 M40 110 h40" stroke="#7cff9e" stroke-width="4"/><path d="M44 28 V12 H51 V28 M70 28 V12 H77 V28" fill="#51e47a"/><path d="M101 23 l5 5 -5 5" stroke="#d7ff73" stroke-width="2" fill="none"/></g>`,
    codex: (s) => `<g shape-rendering="crispEdges"><path d="M28 37 H42 V27 H78 V37 H92 V83 H83 V96 H72 V106 H48 V96 H37 V83 H28Z" fill="#12391c" stroke="#77ff8e" stroke-width="3"/><path d="M38 42 H82 V71 H38Z" fill="#071c0e" stroke="#48d86c" stroke-width="2"/><path d="M43 49 h11 v12 H43z M66 49 h11 v12 H66z" fill="#92ff69"/><path d="M52 65 h16 v4 H52z" fill="#52da79"/><path d="M41 80 H79 V88 H41z" fill="#69e987"/><path d="M20 56 h8 v10 h-8z M92 56 h8 v10 h-8z" fill="#a0ff76"/><path d="M47 27 V16 H54 V27 M66 27 V12 H73 V27" stroke="#66ff8d" stroke-width="4"/><path d="M45 106 h30" stroke="#a0ff76" stroke-width="4"/></g>`,
  },
  industrial: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M21 83 Q14 63 29 50 L27 36 Q36 24 60 25 Q84 24 93 36 L91 55 Q105 66 98 91 L90 105 H31Z" fill="#8a5639" stroke="#593a2b" stroke-width="3"/><path d="M17 43 Q19 14 60 13 Q101 14 103 43 H17Z" fill="#f0b827" stroke="#b47717" stroke-width="3"/><path d="M29 39 Q60 33 91 39" stroke="#ffe69a" stroke-width="3"/><path d="M32 54 Q60 44 88 54 L86 72 Q78 88 60 90 Q42 88 34 72Z" fill="#c87d4d"/><path d="M43 61 l9 6 M68 67 l9-6" stroke="#392a25" stroke-width="4" stroke-linecap="round"/><path d="M55 76 H65 V87 H55Z" fill="#fff4de" stroke="#9a6b4a" stroke-width="1.5"/><path d="M35 98 Q60 91 85 98 L94 122 H26Z" fill="#f0b827" stroke="#ad7818" stroke-width="2"/><path d="M41 102 l19 13 19-13" fill="#35434b"/><path d="M15 96 Q3 102 10 116 Q23 120 34 109Z" fill="#8f5d3a" stroke="#573a2c" stroke-width="2"/><circle cx="42" cy="71" r="3" fill="#ef8b7c" opacity=".65"/><circle cx="78" cy="71" r="3" fill="#ef8b7c" opacity=".65"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M24 41 H69 V51 H84 V86 H99 V94 H112 V103 H89 V94 H81 V75 H71 V101 H24Z" fill="#e9b627" stroke="#5b5547" stroke-width="3"/><path d="M31 49 H70 V70 H31Z" fill="#263342" stroke="#8799a7" stroke-width="2"/><path d="M37 55 Q50 49 64 55 V65 H37Z" fill="#101d2a"/><path d="M42 59 h5 M55 59 h5" stroke="#6fe5e9" stroke-width="3" stroke-linecap="round"/><circle cx="42" cy="102" r="11" fill="#30353b" stroke="#c6d0d3" stroke-width="3"/><circle cx="42" cy="102" r="4" fill="#8c989b"/><circle cx="87" cy="102" r="11" fill="#30353b" stroke="#c6d0d3" stroke-width="3"/><circle cx="87" cy="102" r="4" fill="#8c989b"/><path d="M20 40 V17 H28 V40 M13 17 H37 M20 25 H36" stroke="#d9dfe0" stroke-width="4" stroke-linecap="square"/><path d="M97 89 V48 H104 V89 M104 81 H115" stroke="#d9dfe0" stroke-width="4"/><path d="M75 33 l8-8 8 8" stroke="#ffcf47" stroke-width="3" fill="none"/></g>`,
  },
  garden: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M28 71 Q14 47 28 36 Q42 45 43 62 M42 58 Q44 28 63 23 Q76 41 61 62 M72 62 Q83 35 101 39 Q104 59 82 73" fill="#a57843" stroke="#705332" stroke-width="2"/><path d="M29 70 Q31 47 60 43 Q89 47 91 70 L83 92 Q71 101 60 101 Q49 101 37 92Z" fill="#d8a368" stroke="#956d49" stroke-width="2"/><path d="M40 70 Q50 64 56 71 M64 71 Q72 64 81 70" stroke="#44352d" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M55 81 q5-4 10 0 q-2 6-5 6 q-3 0-5-6Z" fill="#533c31"/><path d="M60 87 q-5 5-9 0 M60 87 q5 5 9 0" stroke="#533c31" stroke-width="1.7" fill="none"/><path d="M32 101 Q60 94 88 101 L94 123 H26Z" fill="#67814d"/><path d="M43 102 l17 13 17-13" fill="#e8d9b2"/><path d="M60 112 V96 M60 100 Q47 89 42 97 Q49 106 60 100 M60 98 Q72 85 79 92 Q72 103 60 98" fill="#86b95a" stroke="#5f8d44" stroke-width="1.5"/><circle cx="41" cy="80" r="4" fill="#f29a8b" opacity=".6"/><circle cx="79" cy="80" r="4" fill="#f29a8b" opacity=".6"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M60 64 V35" stroke="#548a50" stroke-width="6" stroke-linecap="round"/><path d="M59 50 Q29 20 23 37 Q34 58 59 56 M62 43 Q85 11 99 28 Q94 51 62 51" fill="url(#leaf)" stroke="#488754" stroke-width="2"/><path d="M32 63 Q33 41 60 39 Q87 41 88 63 L82 83 Q72 92 60 92 Q48 92 38 83Z" fill="#b4dc79" stroke="#5f9d62" stroke-width="2.5"/><ellipse cx="48" cy="64" rx="3.2" ry="4.3" fill="#3b694e"/><ellipse cx="72" cy="64" rx="3.2" ry="4.3" fill="#3b694e"/><circle cx="49" cy="62" r="1.2" fill="#fff"/><circle cx="73" cy="62" r="1.2" fill="#fff"/><path d="M54 76 Q60 81 66 76" stroke="#518060" stroke-width="2" fill="none"/><path d="M34 89 H86 L79 119 Q60 127 41 119Z" fill="#b36f4c" stroke="#7f513d" stroke-width="2.5"/><path d="M40 96 H80 M44 104 H76" stroke="#d99868" stroke-width="3"/><path d="M28 71 Q18 77 25 88 M92 71 Q102 77 95 88" stroke="#79aa5d" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="15" r="6" fill="#ffdd6e"/><path d="M60 5 v-4 M49 15 h-5 M76 15 h-5" stroke="#f1c954" stroke-width="2"/></g>`,
  },
  anime: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M25 47 Q21 17 60 16 Q99 17 95 47 L91 84 Q81 99 60 100 Q39 99 29 84Z" fill="#f3c7a1" stroke="#754d69" stroke-width="2"/><path d="M24 52 Q17 16 54 11 Q87 5 99 34 L84 31 L75 24 L68 41 L58 29 L49 45 L39 34 L29 58Z" fill="#e77b69" stroke="#9f5268" stroke-width="2"/><path d="M38 54 Q46 46 54 55 M66 55 Q74 46 82 54" stroke="#503a55" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="46" cy="62" rx="4" ry="6" fill="#7a68bf"/><ellipse cx="74" cy="62" rx="4" ry="6" fill="#7a68bf"/><circle cx="47" cy="60" r="1.4" fill="#fff"/><circle cx="75" cy="60" r="1.4" fill="#fff"/><path d="M55 78 Q60 84 65 78" stroke="#974e65" stroke-width="2" fill="none"/><path d="M33 99 Q60 93 87 99 L99 124 H21Z" fill="#526bb6" stroke="#354883" stroke-width="2"/><path d="M47 99 L60 113 L73 99" fill="#f5d278"/><path d="M13 32 Q27 4 60 4 Q93 4 107 32 L87 30 Q60 19 33 30Z" fill="#393c77" stroke="#aaa5ef" stroke-width="2.5"/><path d="M57 9 l3-7 3 7" fill="#ffdc70"/><path d="M84 41 l5 7-9-2" fill="#ffda74"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M26 48 L18 30 L38 37 L48 20 L61 36 L77 19 L83 39 L103 31 L94 54 L89 81 Q78 94 60 95 Q42 94 31 81Z" fill="#718ee8" stroke="#354c9c" stroke-width="2.5"/><path d="M31 58 Q60 45 89 58 L83 76 Q60 91 37 76Z" fill="#d8e5ff"/><path d="M46 60 l7 2 M67 62 l7-2" stroke="#344783" stroke-width="4" stroke-linecap="round"/><path d="M54 75 Q60 80 66 75" stroke="#536cae" stroke-width="2" fill="none"/><path d="M33 89 Q60 81 87 89 L95 113 L78 122 H42 L25 113Z" fill="#f3f0ff" stroke="#9bafe9" stroke-width="2"/><path d="M31 53 L12 44 L18 71 L38 75 M89 53 L108 44 L102 71 L82 75" fill="#8da6f6" stroke="#4f6ac4" stroke-width="2"/><path d="M60 95 l-7 13 7 6 7-6Z" fill="#ffcf67"/><path d="M46 43 l-4-10 M74 42 l5-12" stroke="#f8d778" stroke-width="3"/><circle cx="60" cy="18" r="5" fill="#ffd86c"/><path d="M11 89 l3 6 6 2-6 2-3 6-2-6-6-2 6-2z" fill="#fff0a4"/></g>`,
  },
  editorial: {
    claude: (s) => `<g filter="url(#softShadow)"><path d="M24 87 Q22 45 32 34 Q36 9 60 12 Q84 9 88 34 Q98 45 96 87 L84 107 H36Z" fill="#b38b58" stroke="#69583f" stroke-width="2.5"/><path d="M31 55 Q31 33 60 30 Q89 33 89 55 L81 80 Q70 92 60 92 Q50 92 39 80Z" fill="#e9d7b6"/><path d="M38 53 Q48 44 55 54 M65 54 Q72 44 82 53" stroke="#534a40" stroke-width="3" fill="none"/><circle cx="47" cy="61" r="7" fill="none" stroke="#7b6750" stroke-width="2.5"/><circle cx="73" cy="61" r="7" fill="none" stroke="#7b6750" stroke-width="2.5"/><path d="M54 61 H66" stroke="#7b6750" stroke-width="2"/><path d="M56 72 L60 78 L64 72Z" fill="#be7d42"/><path d="M57 81 Q60 84 63 81" stroke="#665546" stroke-width="1.5" fill="none"/><path d="M31 97 Q60 88 89 97 L98 123 H22Z" fill="#6e8790" stroke="#465f67" stroke-width="2"/><path d="M49 97 L60 110 L71 97" fill="#f3e8d3"/><path d="M60 110 v9 M55 114 h10" stroke="#b98c52" stroke-width="2"/><path d="M37 33 Q46 18 60 21 Q74 18 83 33" fill="none" stroke="#d7bd86" stroke-width="3"/></g>`,
    codex: (s) => `<g filter="url(#softShadow)"><path d="M31 49 Q17 29 25 14 Q42 20 49 37 M89 49 Q103 29 95 14 Q78 20 71 37" fill="#293746" stroke="#172733" stroke-width="2.5"/><path d="M29 49 Q32 28 60 27 Q88 28 91 49 L85 78 Q73 94 60 94 Q47 94 35 78Z" fill="#283b4a"/><path d="M39 55 Q48 48 55 55 M65 55 Q72 48 81 55" stroke="#d6c7a7" stroke-width="3" fill="none"/><circle cx="47" cy="62" r="3" fill="#d8ac63"/><circle cx="73" cy="62" r="3" fill="#d8ac63"/><path d="M55 73 L60 80 L65 73Z" fill="#d18a43"/><path d="M42 83 Q60 93 78 83" stroke="#9eb0b5" stroke-width="2" fill="none"/><path d="M32 96 Q60 89 88 96 L96 123 H24Z" fill="#485963" stroke="#243943" stroke-width="2"/><path d="M41 102 Q60 114 79 102" stroke="#c5b999" stroke-width="4" fill="none"/><path d="M87 98 Q104 80 108 58 Q95 72 82 76" fill="#e4d2af" stroke="#9b8866" stroke-width="2"/><path d="M103 60 q-8 0-9-7 q8 1 9 7" fill="#b5a078"/><circle cx="20" cy="47" r="3" fill="#d1b16e"/><circle cx="101" cy="43" r="2" fill="#d1b16e"/></g>`,
  },
};

function characterSVG(theme, svc, state) {
  const render = (CAST[theme] || CAST.cyber)[svc] || CAST.cyber[svc];
  const zzz = state === 'sleep' ? `<g fill="#7896e8" font-family="sans-serif" font-weight="800"><text class="zzz" x="92" y="24" font-size="15">z</text><text class="zzz z2" x="105" y="13" font-size="10">z</text></g>` : '';
  return uniqueIds(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 124" class="chr" style="overflow:visible">${svgDefs()}${render(state)}${zzz}</svg>`);
}

// 그라디언트 id가 여러 그림에서 겹치면, 숨겨진(display:none) 그림의 정의를 참조해 색이 사라진다 → 그림마다 고유 id
let svgSeq = 0;
function uniqueIds(svg) {
  const n = ++svgSeq;
  return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`);
}

function drawCharacter(theme, svc, state) {
  const safeTheme = CAST[theme] ? theme : 'cyber';
  const safeSvc = svc === 'codex' ? 'codex' : 'claude';
  const safeState = ['fresh', 'ok', 'tired', 'dizzy', 'sleep', 'none'].includes(state) ? state : 'none';
  return `<span class="artchar artchar-${safeTheme} artchar-${safeSvc} st-${safeState}" aria-hidden="true"></span>`;
}
