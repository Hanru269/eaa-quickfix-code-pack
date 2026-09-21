#!/usr/bin/env node
// contrast-check.js - zero-dependency WCAG contrast calculator.
//   node tools/contrast-check.js "#999999" "#ffffff"         -> ratio, pass/fail, nearest passing colour
//   node tools/contrast-check.js --css css/tokens.css         -> checks every "check" line in the file, exit 1 on failure
const fs = require('fs');
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('bad colour: ' + h); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function lum([r, g, b]) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
// Move the foreground toward black or white (whichever is the direction of more contrast) until it passes.
function nearestPassing(fg, bg, min) {
  const target = lum(bg) > 0.179 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1.0001; t += 0.01) { const c = fg.map((v, i) => v + (target[i] - v) * t); if (ratio(c, bg) >= min) return toHex(c); }
  return toHex(target);
}
function parseCss(src) {
  const themes = {};
  src.replace(/([^{}]+)\{([^}]*)\}/g, (m, sel, body) => {
    const theme = /data-theme="dark"/.test(sel) ? 'dark' : 'light'; themes[theme] = themes[theme] || {};
    body.replace(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g, (mm, k, v) => { themes[theme][k] = v; });
  });
  const checks = []; src.replace(/check(?: (\w+))?:\s*(--[\w-]+)\s+(--[\w-]+)\s+([\d.]+)/g, (m, th, fg, bg, min) => { checks.push({ theme: th || 'light', fg, bg, min: +min }); });
  return { themes, checks };
}
function main(argv) {
  if (argv[0] === '--css') {
    const { themes, checks } = parseCss(fs.readFileSync(argv[1], 'utf8')); let bad = 0;
    for (const c of checks) {
      const vars = Object.assign({}, themes.light, c.theme === 'light' ? {} : themes[c.theme]);
      if (!vars[c.fg] || !vars[c.bg]) { console.log(`MISSING  [${c.theme}] ${c.fg} on ${c.bg}`); bad++; continue; }
      const r = ratio(hex2rgb(vars[c.fg]), hex2rgb(vars[c.bg])), ok = r >= c.min; if (!ok) bad++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  [${c.theme}] ${c.fg} ${vars[c.fg]} on ${c.bg} ${vars[c.bg]}  ${r.toFixed(2)}:1 (needs ${c.min})`);
    }
    console.log(bad ? `${bad} pair(s) failed` : `all ${checks.length} pairs pass`); return bad ? 1 : 0;
  }
  if (argv.length < 2) { console.log('usage: contrast-check.js <fg> <bg> [min=4.5]   |   --css file.css'); return 2; }
  const min = argv[2] ? +argv[2] : 4.5, fg = hex2rgb(argv[0]), bg = hex2rgb(argv[1]), r = ratio(fg, bg);
  console.log(`${r.toFixed(2)}:1  ${r >= min ? 'PASS' : 'FAIL'} (needs ${min}:1)`);
  if (r < min) console.log(`nearest passing foreground: ${nearestPassing(fg, bg, min)}`);
  return r >= min ? 0 : 1;
}
if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { ratio, hex2rgb, nearestPassing, parseCss };
