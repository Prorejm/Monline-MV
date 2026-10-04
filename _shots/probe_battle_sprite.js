// Monline's battle sprite controls - VX Ace 0238.rb (Hime Enemy Re-position)
// and 0256.rb (Hime Battle Sprite Zoom).
//   NODE_PATH=<pw> node _shots/probe_battle_sprite.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function ok(label, cond, detail) {
  if (!cond) failures++;
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + label +
              (cond ? '' : '\n        ' + detail));
}
const sceneName = p => p.evaluate(() =>
  SceneManager._scene ? SceneManager._scene.constructor.name : null);

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required',
           '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t))
      errors.push('CONSOLE: ' + t);
  });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName(p) === 'Scene_Map') break;
    await sleep(250);
  }
  ok('we reached the map', await sceneName(p) === 'Scene_Map', await sceneName(p));

  // ------------------------------------------------------------------ the API
  console.log('--- the calls ---');
  const api = await p.evaluate(() => ({
    cfg: window.MonlineBattleSprite ? MonlineBattleSprite.CFG : null,
    win: ['position_enemy', 'move_enemy', 'zoom_enemy_sprite']
      .map(n => typeof window[n]),
    gi: ['position_enemy', 'move_enemy', 'zoom_enemy_sprite']
      .map(n => typeof Game_Interpreter.prototype[n]),
    ruby: ['position_enemy', 'move_enemy', 'zoom_enemy_sprite']
      .map(n => !!(window.MonlineRuby && MonlineRuby.F &&
                   typeof MonlineRuby.F[n] === 'function'))
  }));
  console.log('  ' + JSON.stringify(api));
  ok('the plugin reports its settings', !!api.cfg, JSON.stringify(api));
  ok('all three calls exist as globals',
     api.win.every(t => t === 'function'), JSON.stringify(api.win));
  ok('all three calls exist on Game_Interpreter',
     api.gi.every(t => t === 'function'), JSON.stringify(api.gi));
  ok('all three calls reach the Ruby bridge',
     api.ruby.every(Boolean), JSON.stringify(api.ruby));

  // --------------------------------------------------------------- the battle
  console.log('--- in battle ---');
  const started = await p.evaluate(() => {
    // pick a troop that actually has members
    for (let id = 1; id < $dataTroops.length; id++) {
      const t = $dataTroops[id];
      if (t && t.members && t.members.length >= 2) {
        BattleManager.setup(id, false, false);
        SceneManager.push(Scene_Battle);
        return id;
      }
    }
    return 0;
  });
  ok('a battle was started', started > 0, 'troop ' + started);

  // wait for the enemy sprites to be built and their bitmaps loaded
  let ready = false;
  for (let i = 0; i < 120; i++) {
    ready = await p.evaluate(() => {
      const s = SceneManager._scene;
      if (!s || !s._spriteset) return false;
      const es = s._spriteset._enemySprites || [];
      return es.length >= 2 && es[0].visible && es[0].bitmap &&
             es[0].bitmap.width > 0;
    });
    if (ready) break;
    await sleep(250);
  }
  ok('two enemy sprites are on screen', ready, 'sprites never became ready');

  // Spriteset_Battle sorts _enemySprites by screen y/x, so sprite[i] is NOT
  // $gameTroop.members()[i].  Resolve by battler identity instead.
  await p.evaluate(() => {
    window.__spriteOf = function (oneBased) {
      const member = $gameTroop.members()[oneBased - 1];
      if (!member) return null;
      return SceneManager._scene._spriteset._enemySprites
        .filter(s => s._battler === member)[0] || null;
    };
  });

  const before = await p.evaluate(() => {
    const s0 = __spriteOf(1), s1 = __spriteOf(2);
    return { n: SceneManager._scene._spriteset._enemySprites.length,
             x: s0._homeX, y: s0._homeY,
             sx: s0.scale.x, sy: s0.scale.y, s1x: s1.scale.x };
  });
  console.log('  before ' + JSON.stringify(before));
  ok('the sprites start un-zoomed', before.sx === 1 && before.sy === 1,
     JSON.stringify(before));

  // -------------------------------------------------------- position_enemy
  const abs = await p.evaluate(() => {
    const r = position_enemy(1, 400, 300);
    return r;
  });
  ok('position_enemy accepts the call', abs === true, 'returned ' + abs);
  await sleep(1500);
  const afterAbs = await p.evaluate(() => {
    const s0 = __spriteOf(1);
    return { x: s0._homeX, y: s0._homeY,
             moving: $gameTroop.members()[0]._mbs.moving };
  });
  console.log('  after position_enemy ' + JSON.stringify(afterAbs));
  ok('the sprite glided to the absolute spot',
     Math.abs(afterAbs.x - 400) < 1 && Math.abs(afterAbs.y - 300) < 1,
     JSON.stringify(afterAbs));
  ok('the move finished', afterAbs.moving === false, JSON.stringify(afterAbs));

  // ------------------------------------------------------------ move_enemy
  const rel = await p.evaluate(() => move_enemy(1, 0, 55));
  ok('move_enemy accepts the call', rel === true, 'returned ' + rel);
  await sleep(1200);
  const afterRel = await p.evaluate(() => {
    const s0 = __spriteOf(1);
    return { x: s0._homeX, y: s0._homeY };
  });
  console.log('  after move_enemy ' + JSON.stringify(afterRel));
  ok('move_enemy shifted down 55 from where it was',
     Math.abs(afterRel.x - 400) < 1 && Math.abs(afterRel.y - 355) < 1,
     JSON.stringify(afterRel));

  // ----------------------------------------------------- zoom_enemy_sprite
  const z1 = await p.evaluate(() => zoom_enemy_sprite(1, 0.25));
  await sleep(300);
  const afterZ1 = await p.evaluate(() => {
    const s0 = __spriteOf(1), s1 = __spriteOf(2);
    return { sx: s0.scale.x, sy: s0.scale.y, sx2: s1.scale.x };
  });
  ok('zoom_enemy_sprite(i, z) scales both axes',
     z1 === true && Math.abs(afterZ1.sx - 0.25) < 0.001 &&
       Math.abs(afterZ1.sy - 0.25) < 0.001,
     JSON.stringify(afterZ1));
  ok('zooming one enemy leaves the others alone',
     afterZ1.sx2 === 1, 'second sprite scale ' + afterZ1.sx2);

  const z2 = await p.evaluate(() => zoom_enemy_sprite(2, 2, 1));
  await sleep(300);
  const afterZ2 = await p.evaluate(() => {
    const s1 = __spriteOf(2);
    return { sx: s1.scale.x, sy: s1.scale.y };
  });
  ok('zoom_enemy_sprite(i, zx, zy) scales the axes separately',
     z2 === true && afterZ2.sx === 2 && afterZ2.sy === 1,
     JSON.stringify(afterZ2));

  // ------------------------------------------------------------ bad indices
  const bad = await p.evaluate(() => ({
    zero: position_enemy(0, 10, 10),
    huge: position_enemy(99, 10, 10),
    nan: position_enemy('x', 10, 10),
    zoomBad: zoom_enemy_sprite(0, 2)
  }));
  ok('out-of-range indices are refused rather than throwing',
     bad.zero === false && bad.huge === false && bad.nan === false &&
       bad.zoomBad === false,
     JSON.stringify(bad));

  // ---------------------------------------------- the calls reach real events
  const viaRuby = await p.evaluate(() => {
    MonlineRuby.F.zoom_enemy_sprite(1, 1.5);
    return true;
  });
  await sleep(300);
  const afterRuby = await p.evaluate(() => __spriteOf(1).scale.x);
  ok('the Ruby bridge name drives the sprite too',
     viaRuby === true && Math.abs(afterRuby - 1.5) < 0.001, 'scale ' + afterRuby);

  // ------------------------------------------------------------------ errors
  console.log('--- errors ---');
  ok('no page errors', errors.length === 0, errors.slice(0, 6).join('\n        '));

  await p.screenshot({ path: '_shots/battle_sprite.png' });
  await b.close();
  console.log(failures ? '\nBATTLE SPRITE PROBE FAILED (' + failures + ')'
                       : '\nBATTLE SPRITE PROBE PASSED');
  process.exit(failures ? 1 : 0);
})();
