// Full-data asset audit: every reference in data/*.json resolved against the
// real img/ and audio/ layout, per category.
//
// Why this exists: the runtime MISSING_ASSETS counter only covers the paths a
// smoke walk happens to take (and it reported 0 while 13 battlebacks and a pile
// of BGM were genuinely absent).  This walks the whole project.
//
// Two layout facts it has to respect, both learned the hard way:
//   * MV reads `$dataMap.width/.data/.events` off the parsed object
//     (DataManager.makeEmptyMap proves it), so a map file is a plain object.
//     Accept the editor's [{...}] form too, or the audit silently sees nothing.
//   * audio lives in audio/bgm|bgs|me|se/, so the *kind* of each reference has
//     to be carried, not just the name.
const fs = require('fs'), path = require('path');
const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const DATA = path.join(ROOT, 'data');

// MonlineImageExt resolves a name to whichever extension actually exists.
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.bmp', '.gif', '.webp'];
const AUD_EXT = ['.ogg', '.m4a', '.mp3', '.wav', '.OGG', '.M4A', '.MP3'];

function findAsset(rootDir, name, exts) {
  if (!name || typeof name !== 'string') { return null; }
  const base = path.join(rootDir, name);
  try { if (fs.statSync(base).isFile()) { return base; } } catch (e) {}
  for (const e of exts) {
    try { if (fs.statSync(base + e).isFile()) { return base + e; } } catch (e2) {}
  }
  return null;
}

const refs = {};                                   // cat -> Map(key -> count)
function add(cat, name) {
  if (!name || typeof name !== 'string') { return; }
  if (!refs[cat]) { refs[cat] = new Map(); }
  refs[cat].set(name, (refs[cat].get(name) || 0) + 1);
}
// audio: `<kind>/<name>` -- the subfolder is part of the identity
function addAud(kind, name) {
  if (!name || typeof name !== 'string') { return; }
  add('audio:' + kind, name);
}

const files = fs.readdirSync(DATA).filter(f => /\.json$/i.test(f));
const db = {};
for (const f of files) {
  try { db[f] = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) {}
}

// ---- database ------------------------------------------------------------
(db['Tilesets.json'] || []).forEach(t => t && (t.tilesetNames || []).forEach(n => add('tilesets', n)));
(db['Actors.json'] || []).forEach(a => {
  if (!a) { return; }
  add('faces', a.faceName); add('characters', a.characterName); add('sv_actors', a.battlerName);
});
(db['Enemies.json'] || []).forEach(e => e && add('enemies', e.battlerName));
(db['Animations.json'] || []).forEach(a => {
  if (!a) { return; }
  add('animations', a.animation1Name); add('animations', a.animation2Name);
});

// ---- System --------------------------------------------------------------
const sys = db['System.json'] || {};
add('titles1', sys.title1Name); add('titles2', sys.title2Name);
addAud('bgm', sys.titleBgm && sys.titleBgm.name);
addAud('bgm', sys.battleBgm && sys.battleBgm.name);
['victoryMe', 'defeatMe', 'gameoverMe', 'battleEndMe'].forEach(k => addAud('me', sys[k] && sys[k].name));
['boat', 'ship', 'airship'].forEach(k => {
  if (!sys[k]) { return; }
  add('characters', sys[k].characterName);
  addAud('bgm', sys[k].bgm && sys[k].bgm.name);
});

// ---- event commands that name an asset directly --------------------------
function walkList(list) {
  if (!Array.isArray(list)) { return; }
  for (const c of list) {
    if (!c || typeof c.code !== 'number') { continue; }
    const p = c.parameters || [];
    if (c.code === 231) { add('pictures', p[1]); }                                  // Show Picture
    if (c.code === 283) { add('battlebacks1', p[0]); add('battlebacks2', p[1]); }    // Change Battleback
    if (c.code === 241) { addAud('bgm', p[0] && p[0].name); }                       // Play BGM
    if (c.code === 245) { addAud('bgs', p[0] && p[0].name); }                       // Play BGS
    if (c.code === 249) { addAud('me', p[0] && p[0].name); }                        // Play ME
    if (c.code === 250) { addAud('se', p[0] && p[0].name); }                        // Play SE
    if (c.code === 355 && typeof p[0] === 'string') {
      const m = /\bshow_fog\s*\(\s*[^,]+,\s*"([^"]*)"/.exec(p[0]);
      if (m) { add('fogs', m[1]); }
    }
    if (Array.isArray(c.parameters)) { walkList(c.parameters); }
  }
}

let mapCount = 0;
for (const f of files) {
  if (!/^Map\d+\.json$/i.test(f)) { continue; }
  mapCount++;
  const d = db[f];
  const info = Array.isArray(d) ? d[0] : d;
  if (!info) { continue; }
  add('parallaxes', info.parallaxName);
  add('battlebacks1', info.battleback1Name);
  add('battlebacks2', info.battleback2Name);
  addAud('bgm', info.bgm && info.bgm.name);
  addAud('bgs', info.bgs && info.bgs.name);
  (info.events || []).forEach(ev => {
    if (!ev || !ev.pages) { return; }
    ev.pages.forEach(pg => {
      if (pg && pg.image) { add('characters', pg.image.characterName); }
      walkList(pg && pg.list);
    });
  });
}
(db['CommonEvents.json'] || []).forEach(ce => ce && walkList(ce.list));
(db['Troops.json'] || []).forEach(tr => ((tr && tr.pages) || []).forEach(pg => walkList(pg && pg.list)));

// ---- report -------------------------------------------------------------
function pad(v, n) { v = String(v); return v + ' '.repeat(Math.max(0, n - v.length)); }
const IMG_DIRS = {
  tilesets: 'img/tilesets', faces: 'img/faces', characters: 'img/characters',
  enemies: 'img/enemies', sv_actors: 'img/sv_actors', animations: 'img/animations',
  titles1: 'img/titles1', titles2: 'img/titles2', parallaxes: 'img/parallaxes',
  battlebacks1: 'img/battlebacks1', battlebacks2: 'img/battlebacks2',
  pictures: 'img/pictures', fogs: 'img/fogs',
};
console.log('maps scanned: ' + mapCount + '\n');
let grandMissing = 0;
const detail = [];
for (const cat of Object.keys(refs).sort()) {
  const rows = [...refs[cat].entries()].filter(([n]) => n && n !== '');
  if (!rows.length) { continue; }
  const total = rows.reduce((s, r) => s + r[1], 0);
  let dir, exts;
  if (cat.indexOf('audio:') === 0) { dir = 'audio/' + cat.slice(6); exts = AUD_EXT; }
  else { dir = IMG_DIRS[cat]; exts = IMG_EXT; }
  if (!dir) { continue; }
  const full = path.join(ROOT, dir);
  const miss = rows.filter(([n]) => !findAsset(full, n, exts));
  console.log(pad(cat, 16) + ' refs=' + pad(total, 5) + ' distinct=' + pad(rows.length, 4)
    + ' missing=' + pad(miss.length, 4)
    + (miss.length ? 'e.g. ' + miss.slice(0, 3).map(r => r[0] + '(' + r[1] + ')').join(', ') : 'ok'));
  grandMissing += miss.length;
  miss.forEach(([n, c]) => detail.push([cat, n, c]));
}
console.log('\nTOTAL missing distinct assets: ' + grandMissing);
if (detail.length) {
  console.log('\n--- every missing asset, by reference count ---');
  detail.sort((a, b) => b[2] - a[2]).forEach(d =>
    console.log('  ' + pad(d[0], 16) + pad(d[1], 36) + 'x' + d[2]));
}
