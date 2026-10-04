// The in-battle monster card (0147.rb:1319/1351) and whether the catalogue's
// encounter data survives a save - the two things the port was missing.
//   NODE_PATH=<pw> node _shots/probe_battle_card.js
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

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required',
           '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' +
       (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text()))
      errors.push('CONSOLE: ' + m.text());
  });

  const snap = () => p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    stopped: !!SceneManager._stopped,
    showed: !!Graphics._errorShowed,
    err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
           .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)
  }));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(5000);

  // ------------------------------------------------------- the battle card
  console.log('--- the battle installs a monster card window ---');
  const troop = await p.evaluate(() => {
    // the first troop that actually has members
    for (let i = 1; i < $dataTroops.length; i++) {
      if ($dataTroops[i] && $dataTroops[i].members.length) { return i; }
    }
    return 1;
  });
  await p.evaluate((id) => {
    BattleManager.setup(id, false, false);
    $gameParty.setupBattleTestMembers ? null : null;
    SceneManager.push(Scene_Battle);
  }, troop);
  await sleep(3500);
  let s = await snap();
  console.log('  battle ' + JSON.stringify(s));
  ok('the battle starts', s.scene === 'Scene_Battle', JSON.stringify(s));

  const card = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._monsterCardWindow;
    if (!w) { return { none: true }; }
    return {
      cls: w.constructor.name,
      z: w.z, openness: w.openness,
      logZ: (sc._logWindow && typeof sc._logWindow.z === 'number') ? sc._logWindow.z : -1,
      hasOk: !!w._handlers.ok, hasCancel: !!w._handlers.cancel,
      gauges: /drawActorHp/.test(w.drawStat.toString()),
      active: w.active
    };
  });
  console.log('  card   ' + JSON.stringify(card));
  ok('a monster card window exists in battle', !card.none, JSON.stringify(card));
  ok('it is a Window_MonsterCard', card.cls === 'Window_MonsterCard', JSON.stringify(card));
  ok('it sits above the log window, and at least at z 200 (0147.rb:1364)',
     card.z >= 200 && card.z > card.logZ, JSON.stringify(card));
  ok('it starts closed', card.openness === 0 && card.active === false,
     JSON.stringify(card));
  ok('ok and cancel both close it', card.hasOk && card.hasCancel, JSON.stringify(card));
  ok('the battle card draws HP/MP as gauges', card.gauges === true, JSON.stringify(card));

  console.log('--- analyzing an enemy opens its card ---');
  const opened = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const e = $gameTroop.members()[0];
    if (!e) { return { noEnemy: true }; }
    // what an \analyze item does (0147.rb:593)
    $gameSystem.mamcAnalyzeMonster(e.enemyId());
    e._mamcAnalyzeNow = true;
    sc.update();
    return {
      id: e.enemyId(),
      shown: sc._monsterCardWindow._monsterId,
      live: sc._monsterCardWindow._monster === e,
      active: sc._monsterCardWindow.active,
      openness: sc._monsterCardWindow.openness,
      flag: e._mamcAnalyzeNow
    };
  });
  console.log('  open   ' + JSON.stringify(opened));
  ok('the analyzed enemy fills the card', opened.shown === opened.id,
     JSON.stringify(opened));
  ok('the card holds the live enemy, not a copy', opened.live === true,
     JSON.stringify(opened));
  ok('the card is open and active', opened.active === true, JSON.stringify(opened));
  ok('the flag is cleared so it fires once', opened.flag === false,
     JSON.stringify(opened));

  await sleep(1200);
  s = await snap();
  ok('the frozen battle does not crash', !s.stopped && !s.showed && !s.err,
     JSON.stringify(s) + errors.slice(0, 2).join(' | '));

  console.log('--- closing it unfreezes the battle ---');
  // MV reports only one triggered button per frame, and the very first press
  // after the card opens lands on the frame that is still settling, so press a
  // few times instead of once.
  await p.evaluate(() => {
    const w = SceneManager._scene._monsterCardWindow;
    window.__hits = 0;
    const h = w._handlers.ok;
    w._handlers.ok = function () { window.__hits++; return h.apply(this, arguments); };
  });
  for (let i = 0; i < 5; i++) {
    await p.keyboard.down('Enter'); await sleep(80); await p.keyboard.up('Enter');
    await sleep(80);
    if (!(await p.evaluate(() => SceneManager._scene._monsterCardWindow.active))) break;
  }
  await sleep(800);
  const closed = await p.evaluate(() => {
    const w = SceneManager._scene._monsterCardWindow;
    return { active: w.active, openness: w.openness, hits: window.__hits };
  });
  console.log('  closed ' + JSON.stringify(closed));
  ok('pressing ok closes the card', closed.active === false, JSON.stringify(closed));
  s = await snap();
  ok('still no crash', !s.stopped && !s.showed && !s.err, JSON.stringify(s));

  // ------------------------------------------- does the book survive a save?
  console.log('--- the bestiary survives save / load ---');
  const persist = await p.evaluate(() => {
    $gameSystem.mamcEncounterMonster(1, 2, 3);
    $gameSystem.mamcAnalyzeMonster(4);
    const before = {
      enc: $gameSystem.mamcEncounterAry().slice(),
      ana: $gameSystem.mamcAnalyzeAry().slice()
    };
    DataManager.saveGame(1);
    // wipe the live copy, then load it back off disk
    $gameSystem._mamcEncounterAry = [];
    $gameSystem._mamcAnalyzeAry = [];
    DataManager.loadGame(1);
    return {
      before: before,
      after: {
        enc: $gameSystem.mamcEncounterAry().slice(),
        ana: $gameSystem.mamcAnalyzeAry().slice()
      }
    };
  });
  console.log('  save   ' + JSON.stringify(persist));
  ok('encountered monsters survive a save',
     JSON.stringify(persist.before.enc) === JSON.stringify(persist.after.enc),
     JSON.stringify(persist));
  ok('analyzed monsters survive a save',
     JSON.stringify(persist.before.ana) === JSON.stringify(persist.after.ana),
     JSON.stringify(persist));

  // ------------------------------------- and the reveal switches still work
  console.log('--- beastiarycheck ---');
  const reveal = await p.evaluate(() => {
    $gameSystem._mamcEncounterAry = [];
    $gameSwitches.setValue(101, true);   // Holstaurus
    $gameSwitches.setValue(102, true);   // Honey Bee + kin
    Scene_MonsterCatalogue.prototype.beastiaryCheck.call({});
    return { seen: $gameSystem.mamcEncounterAry().slice().sort(function (a, b) { return a - b; }) };
  });
  console.log('  reveal ' + JSON.stringify(reveal));
  deepEq(reveal.seen, [1, 2, 3]);
  function deepEq(got, want) {
    ok('switch 101/102 reveal monsters 1, 2, 3',
       JSON.stringify(got) === JSON.stringify(want),
       'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
  }

  await p.screenshot({ path: OUT + 'battle_card.png' });
  await b.close();
  console.log('');
  console.log(failures ? 'BATTLE CARD FAILED: ' + failures + ' assertion(s)'
                       : 'BATTLE CARD PASSED: all assertions held');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(2); });
