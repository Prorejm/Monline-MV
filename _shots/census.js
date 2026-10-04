// Data-wide census of the *unported* Ruby systems still hit by event scripts.
// Runtime RUBY_PENDING only samples the paths a smoke walk happens to take;
// this counts every call site in the whole data set so Phase 2 can be ordered
// by real magnitude instead of by luck.  The payload extraction is the exact
// one unit_check.js uses (recursive over `list`, joining 355 + 655 the way
// Game_Interpreter.command355 does).
const fs = require('fs');
const path = require('path');
const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const DATA = path.join(ROOT, 'data');

const SYSTEMS = [
  'map_effects', 'log_window', 'nel_textpop',
  'show_fog', 'fade_fog', 'tint_fog',
  'cam_center', 'cam_set', 'cam_follow', 'cam_freeze', 'cam_reset',
  'chain_commands', 'combine_choices', 'hide_choice', 'disable_choice',
  'disable_good', 'hide_good', 'snooze_bar', 'remove_bar',
  'zoom_event_sprite', 'zoom_player_sprite', 'zoom_good',
  'global_save', 'global_load', 'call_monster_catalogue',
  'char_effects', 'reflect_sprite', 'set_flash', 'screen_flash',
  'Tidloc', 'set_symbols', 'rename_event', 'instance_eval', 'Fiber',
  'get_shop', 'price_good', 'break_loop', 'end_loop', 'light', 'shadow',
];

function scriptsIn(obj, out) {
  if (Array.isArray(obj)) { obj.forEach(v => scriptsIn(v, out)); return; }
  if (!obj || typeof obj !== 'object') return;
  const lst = obj.list;
  if (Array.isArray(lst)) {
    for (let i = 0; i < lst.length; i++) {
      const cmd = lst[i];
      if (!cmd || typeof cmd !== 'object') continue;
      const p = cmd.parameters || [];
      if (cmd.code === 355 && typeof p[0] === 'string') {
        let script = p[0] + '\n';
        while (i + 1 < lst.length && lst[i + 1] && lst[i + 1].code === 655) {
          i++;
          script += (lst[i].parameters || [])[0] + '\n';
        }
        out.push(script);
      } else if (cmd.code === 45 && typeof p[0] === 'string') {
        out.push(p[0]);
      } else if (cmd.code === 111 && p[0] === 12 && typeof p[1] === 'string') {
        out.push(p[1]);
      } else if (cmd.code === 122 && p[3] === 4 && typeof p[4] === 'string') {
        out.push(p[4]);
      }
    }
  }
  Object.keys(obj).forEach(k => scriptsIn(obj[k], out));
}

const counts = {};
SYSTEMS.forEach(k => { counts[k] = 0; });
let n = 0;
const perFile = {};

for (const f of fs.readdirSync(DATA).filter(f => /\.json$/i.test(f))) {
  let obj;
  try { obj = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { continue; }
  const out = [];
  scriptsIn(obj, out);
  n += out.length;
  const all = out.join('\n');
  for (const k of SYSTEMS) {
    const rx = new RegExp('\\b' + k.replace(/[$]/g, '\\$') + '\\b', 'g');
    const c = (all.match(rx) || []).length;
    if (c) {
      counts[k] += c;
      (perFile[k] = perFile[k] || []).push(f + ':' + c);
    }
  }
}

console.log('script payloads scanned: ' + n);
const rows = Object.keys(counts).filter(k => counts[k] > 0).sort((a, b) => counts[b] - counts[a]);
rows.forEach(k => console.log('  ' + k.padEnd(24) + String(counts[k]).padStart(5)
    + '   files: ' + perFile[k].length));
