// Monline's gear loadouts (VX Ace 0149/0150.rb Scene_Loadout plus the
// Save/Load commands the equip screen gains in 0060/0098.rb).
//   NODE_PATH=<pw> node _shots/probe_loadout.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
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

  // ------------------------------------------------------------- boot to map
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName(p) === 'Scene_Map') break;
    await sleep(250);
  }
  ok('we reached the map', await sceneName(p) === 'Scene_Map', await sceneName(p));

  // -------------------------------------------------------------- the plugin
  console.log('--- the plugin ---');
  const cfg = await p.evaluate(() => ({
    cfg: window.MonlineLoadout ? MonlineLoadout.CFG : null,
    saveScene: typeof window.Scene_SaveLoadout,
    loadScene: typeof window.Scene_LoadLoadout,
    winS: typeof window.Window_SLoadout,
    winL: typeof window.Window_LLoadout
  }));
  console.log('  cfg    ' + JSON.stringify(cfg.cfg));
  ok('MonlineLoadout reports its settings', !!cfg.cfg, JSON.stringify(cfg));
  ok('both scenes and both windows are reachable',
     cfg.saveScene === 'function' && cfg.loadScene === 'function' &&
       cfg.winS === 'function' && cfg.winL === 'function',
     JSON.stringify(cfg));
  ok('the storage slots are variables 204/205/206 and actor 207',
     JSON.stringify(cfg.cfg.SLOT_VARS) === JSON.stringify([204, 205, 206]) &&
       cfg.cfg.ACTOR_VAR === 207, JSON.stringify(cfg.cfg));
  ok('the window keeps the VX Ace spot (202,168)',
     cfg.cfg.WIN_X === 202 && cfg.cfg.WIN_Y === 168, JSON.stringify(cfg.cfg));

  // --------------------------------------------------- equip screen commands
  console.log('--- the equip screen ---');
  await p.evaluate(() => { SceneManager.push(Scene_Equip); });
  await sleep(1500);
  const equip = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return {
      symbols: w._list.map(c => c.symbol),
      names: w._list.map(c => c.name),
      cols: w.maxCols(),
      rows: w.numVisibleRows(),
      handlers: Object.keys(w._handlers || {}).sort()
    };
  });
  console.log('  equip  ' + JSON.stringify(equip));
  ok('the command row is Equip / Optimize / Clear / Save / Load',
     JSON.stringify(equip.symbols) ===
       JSON.stringify(['equip', 'optimize', 'clear', 'Saveout', 'Loadout']),
     JSON.stringify(equip.symbols));
  ok('five commands on one line (VX Ace col_max = 5)',
     equip.cols === 5 && equip.rows === 1,
     'cols=' + equip.cols + ' rows=' + equip.rows);
  ok('both new commands have handlers',
     equip.handlers.indexOf('Saveout') >= 0 &&
       equip.handlers.indexOf('Loadout') >= 0, JSON.stringify(equip.handlers));

  // ------------------------------------------------- open the save-loadout UI
  console.log('--- saving a loadout ---');
  await p.evaluate(() => {
    // Give the leader some real gear so the loadout is not all zeros - it has
    // to be something the actor can actually wear, and the party has to own it
    // for changeEquip's trade to go through.
    const a = $gameParty.leader();
    let weapon = null;
    for (let i = 1; i < $dataWeapons.length && !weapon; i++) {
      if ($dataWeapons[i] && a.canEquip($dataWeapons[i])) { weapon = $dataWeapons[i]; }
    }
    let helm = null;
    for (let i = 1; i < $dataArmors.length && !helm; i++) {
      if ($dataArmors[i] && $dataArmors[i].etypeId === 3 && a.canEquip($dataArmors[i])) {
        helm = $dataArmors[i];
      }
    }
    if (weapon) { $gameParty.gainItem(weapon, 1); a.changeEquip(0, weapon); }
    if (helm) { $gameParty.gainItem(helm, 1); a.changeEquip(2, helm); }
    SceneManager._scene.commandSaveout();
  });
  await sleep(1500);
  const saveSceneState = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._commandWindow;
    return {
      scene: sc.constructor.name,
      symbols: w ? w._list.map(c => c.symbol) : null,
      x: w ? w.x : null, y: w ? w.y : null,
      bgOpacity: sc._backgroundSprite ? sc._backgroundSprite.opacity : null,
      actorVar: $gameVariables.value(207),
      leaderId: $gameParty.leader().actorId()
    };
  });
  console.log('  save   ' + JSON.stringify(saveSceneState));
  ok('Save opens the save-loadout screen',
     saveSceneState.scene === 'Scene_SaveLoadout', JSON.stringify(saveSceneState));
  ok('it offers Slot 1 / Slot 2 / Slot 3 / Cancel',
     JSON.stringify(saveSceneState.symbols) ===
       JSON.stringify(['SLoadout1', 'SLoadout2', 'SLoadout3', 'cancel']),
     JSON.stringify(saveSceneState.symbols));
  ok('the window sits at 202,168', saveSceneState.x === 202 &&
     saveSceneState.y === 168, JSON.stringify(saveSceneState));
  ok('the map behind it is dimmed to 128', saveSceneState.bgOpacity === 128,
     JSON.stringify(saveSceneState));
  ok('the actor id is parked in variable 207',
     saveSceneState.actorVar === saveSceneState.leaderId &&
       saveSceneState.actorVar > 0, JSON.stringify(saveSceneState));

  await p.screenshot({ path: OUT + 'loadout_save.png' });

  // Save into slot 2 so we prove the slot index is honoured.
  await p.evaluate(() => { SceneManager._scene.commandSlot(1); });
  await sleep(1500);
  const afterSave = await p.evaluate(() => {
    const a = $gameParty.leader();
    return {
      scene: SceneManager._scene.constructor.name,
      v204: $gameVariables.value(204),
      v205: $gameVariables.value(205),
      v206: $gameVariables.value(206),
      v207: $gameVariables.value(207),
      equips: a.equips().map(e => e ? e.id : 0)
    };
  });
  console.log('  saved  ' + JSON.stringify(afterSave));
  ok('choosing a slot returns to the equip screen',
     afterSave.scene === 'Scene_Equip', afterSave.scene);
  ok('slot 2 holds the leader equipment',
     Array.isArray(afterSave.v205) && afterSave.v205.length === 5 &&
       afterSave.v205[0] === afterSave.equips[0] &&
       afterSave.v205[2] === afterSave.equips[2],
     JSON.stringify(afterSave));
  ok('slot 1 and 3 were left untouched',
     !Array.isArray(afterSave.v204) && !Array.isArray(afterSave.v206),
     JSON.stringify(afterSave));
  ok('variable 207 is cleared afterwards', afterSave.v207 === 0,
     JSON.stringify(afterSave));

  // ---------------------------------------------------- load it back again
  console.log('--- loading a loadout ---');
  await p.evaluate(() => {
    const a = $gameParty.leader();
    for (let i = 1; i <= 5; i++) { a.changeEquipById(i, 0); }
    SceneManager._scene.commandLoadout();
  });
  await sleep(1500);
  const loadState = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return {
      scene: SceneManager._scene.constructor.name,
      symbols: w ? w._list.map(c => c.symbol) : null,
      enabled: w ? w._list.map(c => !!c.enabled) : null,
      actorVar: $gameVariables.value(207),
      equips: $gameParty.leader().equips().map(e => e ? e.id : 0)
    };
  });
  console.log('  load   ' + JSON.stringify(loadState));
  ok('Load opens the load-loadout screen',
     loadState.scene === 'Scene_LoadLoadout', JSON.stringify(loadState));
  ok('it offers the same three slots',
     JSON.stringify(loadState.symbols) ===
       JSON.stringify(['LLoadout1', 'LLoadout2', 'LLoadout3', 'cancel']),
     JSON.stringify(loadState.symbols));
  ok('only the slot that was actually saved can be chosen',
     loadState.enabled[0] === false && loadState.enabled[1] === true &&
       loadState.enabled[2] === false, JSON.stringify(loadState.enabled));
  ok('the leader is stripped bare first',
     loadState.equips.every(id => id === 0), JSON.stringify(loadState));

  await p.evaluate(() => { SceneManager._scene.commandSlot(1); });
  await sleep(1500);
  const afterLoad = await p.evaluate(() => ({
    scene: SceneManager._scene.constructor.name,
    equips: $gameParty.leader().equips().map(e => e ? e.id : 0),
    v207: $gameVariables.value(207)
  }));
  console.log('  loaded ' + JSON.stringify(afterLoad));
  ok('loading puts the gear back on',
     JSON.stringify(afterLoad.equips) === JSON.stringify(afterSave.equips),
     JSON.stringify(afterLoad) + ' vs ' + JSON.stringify(afterSave.equips));
  ok('loading returns to the equip screen',
     afterLoad.scene === 'Scene_Equip', afterLoad.scene);
  ok('variable 207 is cleared after loading too', afterLoad.v207 === 0,
     JSON.stringify(afterLoad));

  // ------------------------------------------------------------ plugin command
  console.log('--- plugin command ---');
  const pc = await p.evaluate(() => {
    const gi = new Game_Interpreter();
    const a = $gameParty.leader();
    gi.pluginCommand('Loadout', ['save', '3']);
    const v206 = $gameVariables.value(206);
    for (let i = 1; i <= 5; i++) { a.changeEquipById(i, 0); }
    const stripped = a.equips().map(e => e ? e.id : 0);
    gi.pluginCommand('Loadout', ['load', '3']);
    return { v206, stripped, restored: a.equips().map(e => e ? e.id : 0) };
  });
  console.log('  cmd    ' + JSON.stringify(pc));
  ok('Loadout save <n> writes the right slot',
     Array.isArray(pc.v206) && pc.v206[0] === afterSave.equips[0],
     JSON.stringify(pc));
  ok('Loadout load <n> restores it',
     JSON.stringify(pc.restored) === JSON.stringify(afterSave.equips),
     JSON.stringify(pc));

  // ------------------------------------------- the common events that ship
  // Monline also carries event-driven versions of both menus (common events
  // 92 "Gear Store Loadout" and 93 "Gear Restore Loadout"), which drive the
  // same variables through VX Ace script calls.  They are reachable, so the
  // calls they make have to work.
  console.log('--- the shipped common events ---');
  const ce = await p.evaluate(() => {
    const names = {};
    $dataCommonEvents.forEach(function (e) {
      if (e) { names[e.id] = e.name; }
    });
    const gi = new Game_Interpreter();
    // VX Ace wrote change_equip_by_id(slot, id) with a 0-based slot.
    const leader = $gameParty.leader();
    const translated = MonlineRuby.translate(
      '$game_actors[$game_variables[207]].change_equip_by_id(0, a)');
    return {
      store: names[92], restore: names[93],
      hasSlotMethod: typeof leader.changeEquipBySlot,
      translated: translated
    };
  });
  console.log('  ce     ' + JSON.stringify(ce));
  ok('common events 92 and 93 are the loadout pair',
     /Loadout/.test(ce.store || '') && /Loadout/.test(ce.restore || ''),
     JSON.stringify(ce));
  ok('Game_Actor#changeEquipBySlot exists for the VX Ace numbering',
     ce.hasSlotMethod === 'function', JSON.stringify(ce));
  ok('the bridge renames change_equip_by_id to changeEquipBySlot',
     /changeEquipBySlot\(/.test(ce.translated) &&
       !/change_equip_by_id/.test(ce.translated), ce.translated);

  const slotCheck = await p.evaluate(() => {
    const a = $gameParty.leader();
    // Put a known item on and read it back through the Ace numbering.
    let weapon = null;
    for (let i = 1; i < $dataWeapons.length && !weapon; i++) {
      if ($dataWeapons[i] && a.canEquip($dataWeapons[i])) { weapon = $dataWeapons[i]; }
    }
    let helm = null;
    for (let i = 1; i < $dataArmors.length && !helm; i++) {
      if ($dataArmors[i] && $dataArmors[i].etypeId === 3 && a.canEquip($dataArmors[i])) {
        helm = $dataArmors[i];
      }
    }
    for (let i = 1; i <= 5; i++) { a.changeEquipById(i, 0); }
    if (helm) { $gameParty.gainItem(helm, 1); a.changeEquipBySlot(2, helm.id); }
    const afterSlot2 = a.equips().map(e => e ? e.id : 0);
    a.changeEquipBySlot(2, 0);
    const afterClear = a.equips().map(e => e ? e.id : 0);
    return { helmId: helm ? helm.id : 0, afterSlot2, afterClear };
  });
  console.log('  slot   ' + JSON.stringify(slotCheck));
  ok('slot 2 in the Ace numbering is headgear, not the weapon',
     slotCheck.afterSlot2[0] === 0 && slotCheck.afterSlot2[2] === slotCheck.helmId,
     JSON.stringify(slotCheck));
  ok('slot 2 with id 0 clears just that slot',
     slotCheck.afterClear.every(id => id === 0), JSON.stringify(slotCheck));

  // ------------------------------------------------------------------ errors
  console.log('--- errors ---');
  ok('no javascript errors along the way', errors.length === 0,
     errors.join('\n        '));

  await b.close();
  console.log(failures === 0
    ? '\nLOADOUT PASSED: all assertions held'
    : '\nLOADOUT FAILED: ' + failures + ' assertion(s)');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('THREW: ' + e.stack); process.exit(2); });
