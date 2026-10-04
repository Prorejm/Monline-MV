// "Learning a skill then leaving the screen crashes" - repro + regression.
//   NODE_PATH=<pw> node _shots/probe_learn_skill.js
//
// Walks the real 0126.rb flow: open Scene_LearnSkill, pick a skill, confirm
// the cost window (which actually calls Game_Actor#learnSkill), close it, then
// walk back out of the screen the way a player would - cancel to the command
// window, cancel to whatever called the scene.  Any page error along the way
// is a hard failure.
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
       (e.stack || '').split('\n').slice(0, 6).join('\n')));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text()))
      errors.push('CONSOLE: ' + m.text());
  });

  const snap = () => p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    stopped: !!SceneManager._stopped,
    showed: !!Graphics._errorShowed,
    err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
           .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300),
    stack: SceneManager._stack ? SceneManager._stack.map(s => s.constructor.name) : []
  }));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(6000);
  for (let i = 0; i < 60; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(120);
    await p.evaluate(() => { Input._currentState.ok = false; });
    if (i % 10 === 9) {
      const st = await p.evaluate(() => ({ b: $gameMessage.isBusy(), e: $gameMap.isEventRunning() }));
      if (!st.b && !st.e) break;
    }
  }

  // MV's Input only reports ONE triggered button per frame, so each key needs
  // its own frame.
  const ALL = ['ok', 'escape', 'down', 'up', 'shift',
               'monlineA', 'monlineS', 'monlineD'];
  const setKeys = (k) => p.evaluate(k => {
    ['ok', 'escape', 'down', 'up', 'shift',
     'monlineA', 'monlineS', 'monlineD'].forEach(x => { Input._currentState[x] = false; });
    if (k) { Input._currentState[k] = true; }
  }, k);
  const tap = async (k, n) => {
    for (let i = 0; i < (n || 1); i++) {
      await setKeys(k); await sleep(50); await setKeys(null); await sleep(50);
    }
  };

  // ---------------------------------------------------------------- open it
  // The real route is Scene_Skill -> Scene_LearnSkill, not a bare push, so the
  // pop lands back on Scene_Skill exactly as it does for a player.
  console.log('--- open Scene_LearnSkill ---');
  await p.evaluate(() => {
    $gameParty.setMenuActor($gameActors.actor(1));
    SceneManager.push(Scene_Skill);
  });
  await sleep(1500);
  await p.evaluate(() => { SceneManager.push(Scene_LearnSkill); });
  await sleep(1500);
  let s = await snap();
  console.log('  open   ' + JSON.stringify(s));
  ok('Scene_LearnSkill opens', s.scene === 'Scene_LearnSkill', JSON.stringify(s));

  const listing = await p.evaluate(() => {
    const w = SceneManager._scene._skillWindow;
    return { items: w ? (w._data ? w._data.length : -1) : -2,
             maxItems: w ? w.maxItems() : -1,
             index: w ? w.index() : -1,
             hasCost: !!SceneManager._scene._costWindow,
             actor: SceneManager._scene.actor() ? SceneManager._scene.actor().name() : null };
  });
  console.log('  list   ' + JSON.stringify(listing));
  ok('the learn list is populated', listing.items > 0, JSON.stringify(listing));

  // ------------------------------------------------------- choose + confirm
  console.log('--- pick the first learnable skill ---');
  const chosen = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._skillWindow.activate();
    sc._skillWindow.select(0);
    sc._skillWindow.refresh();
    const skill = sc._skillWindow.item();
    if (!skill) { return { none: true }; }
    sc.onSkillOk();
    return { id: skill.id, name: skill.name,
             cost: sc._costWindow.skill() ? sc._costWindow.skill().id : -1 };
  });
  console.log('  chosen ' + JSON.stringify(chosen));
  ok('a skill was offered and the cost window took it',
     !chosen.none && chosen.cost === chosen.id, JSON.stringify(chosen));

  await sleep(600);
  const learned = await p.evaluate((id) => {
    const sc = SceneManager._scene;
    // the learn has to be *payable* for on_cost_ok to take the branch that
    // teaches the skill - 0126.rb:1351 deducts JP/EXP/gold first
    const a = sc.actor();
    if (a.gainJp) { a.gainJp(9999); }
    if ($gameParty.gainGold) { $gameParty.gainGold(99999); }
    const before = a.isLearnedSkill(id);
    const cost = MonlineScenes.parseLearn($dataSkills[id]);
    const payable = MonlineScenes.canLearn(a, $dataSkills[id]);
    sc.onCostOk();
    return { before, after: a.isLearnedSkill(id), cost, payable,
             jp: a.jp ? a.jp() : -1,
             active: sc._costWindow.active, open: sc._costWindow.isOpen() };
  }, chosen.id);
  console.log('  learn  ' + JSON.stringify(learned));
  ok('the learn is payable', learned.payable === true, JSON.stringify(learned));
  ok('the skill was actually learned', learned.after === true, JSON.stringify(learned));

  await sleep(600);
  s = await snap();
  console.log('  after  ' + JSON.stringify(s));
  ok('no crash right after learning', !s.stopped && !s.showed && !s.err &&
     errors.length === 0, JSON.stringify(s) + ' | ' + errors.join(' | '));

  // ------------------------------------------- walk out with real key presses
  // A player does not call onSkillCancel() directly; they press the cancel key
  // on the (now shorter) list, then cancel again on the command window.
  console.log('--- leave the screen (real keys) ---');
  await tap('escape', 6);        // list -> command window -> pop
  await sleep(1500);
  s = await snap();
  console.log('  exit   ' + JSON.stringify(s));
  ok('leaving after a learn does not crash',
     !s.stopped && !s.showed && !s.err, JSON.stringify(s));
  ok('the scene stack unwound', s.scene === 'Scene_Skill' || s.scene === 'Scene_Map',
     JSON.stringify(s));
  await tap('escape', 4);
  await sleep(1200);
  s = await snap();
  console.log('  exit2  ' + JSON.stringify(s));
  ok('no page errors at all', errors.length === 0, errors.slice(0, 3).join('\n---\n'));

  // --------------------------------------- scenario 2: PXE's own learn menu
  // 0148.rb:76 - `command_to_pxelearn` sets the menu subject to actor 25 first.
  console.log('--- PXE (actor 25) learn menu ---');
  await p.evaluate(() => {
    $gameParty.setMenuActor($gameActors.actor(25));
    SceneManager.push(Scene_LearnSkill);
  });
  await sleep(1500);
  const pxe = await p.evaluate(() => {
    const sc = SceneManager._scene;
    if (!sc._skillWindow) { return { noWindow: true }; }
    const n = sc._skillWindow._data.length;
    // learn every offer, one after another, exactly like a player grinding
    let learned = 0;
    for (let i = 0; i < 12 && sc._skillWindow._data.length; i++) {
      sc._skillWindow.select(0);
      sc.onSkillOk();
      const a = sc.actor();
      if (a && a.gainJp) { a.gainJp(9999); }
      if (a && a.gainExp) { a.gainExp(9999); }
      if ($gameParty.gainGold) { $gameParty.gainGold(99999); }
      sc.onCostOk();
      learned++;
    }
    return { offered: n, learned, scene: SceneManager._scene.constructor.name };
  });
  console.log('  pxe    ' + JSON.stringify(pxe));
  await sleep(800);
  await tap('escape', 6);
  await sleep(1500);
  s = await snap();
  console.log('  pxeout ' + JSON.stringify(s));
  ok('PXE learn menu: no crash on the way out',
     !s.stopped && !s.showed && !s.err, JSON.stringify(s));

  // -------------------------------- scenario 3: every actor, one learn each
  console.log('--- every actor ---');
  const all = await p.evaluate(async () => {
    const out = [];
    const ids = [];
    for (let i = 1; i <= 40; i++) {
      if ($gameActors.actor(i)) { ids.push(i); }
    }
    for (const id of ids) {
      try {
        $gameParty.setMenuActor($gameActors.actor(id));
        SceneManager.push(Scene_LearnSkill);
        await new Promise(r => setTimeout(r, 120));
        const sc = SceneManager._scene;
        const n = sc._skillWindow ? sc._skillWindow._data.length : -1;
        if (n > 0) {
          sc._skillWindow.select(0);
          sc.onSkillOk();
          const a = sc.actor();
          if (a && a.gainJp) { a.gainJp(9999); }
          if ($gameParty.gainGold) { $gameParty.gainGold(99999); }
          sc.onCostOk();
        }
        sc.popScene();
        await new Promise(r => setTimeout(r, 120));
        out.push([id, n]);
      } catch (e) {
        out.push([id, 'ERR ' + e.message]);
      }
    }
    return out;
  });
  console.log('  actors ' + JSON.stringify(all));
  await sleep(1200);
  s = await snap();
  console.log('  done   ' + JSON.stringify(s));
  ok('every actor: no crash while learning and leaving',
     !s.stopped && !s.showed && !s.err &&
     !all.some(a => String(a[1]).indexOf('ERR') === 0),
     JSON.stringify(s) + ' ' + JSON.stringify(all.filter(a => String(a[1]).indexOf('ERR') === 0)));

  await p.screenshot({ path: OUT + 'learn_skill_exit.png' });
  await b.close();
  console.log('');
  console.log(failures ? 'LEARN SKILL FAILED: ' + failures + ' assertion(s)'
                       : 'LEARN SKILL PASSED: all assertions held');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(2); });
