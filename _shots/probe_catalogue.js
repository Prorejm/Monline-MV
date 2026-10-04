// Exercise the ported bestiary (0147.rb) in a real browser: reveal the whole
// roster, open Scene_MonsterCatalogue, walk the category tabs and screenshot.
//   node probe_catalogue.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(5000);
  for (let i = 0; i < 40; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(120);
    const st = await p.evaluate(() => ({ b: $gameMessage.isBusy(), e: $gameMap.isEventRunning() }));
    if (!st.b && !st.e) break;
  }

  const info = await p.evaluate(() => {
    const out = {};
    out.enemies = $dataEnemies.length - 1;
    out.cats = MonlineMonsterCatalogue.CFG.shown_categories.length;
    // 1. the notetag readers
    const e1 = $dataEnemies[1];
    const i1 = MonlineMonsterCatalogue.info(e1);
    out.enemy1 = { name: e1.name, species: i1.species, icon: i1.icon,
                   cats: i1.categories, hide: i1.hide,
                   desc: i1.description.slice(0, 40) };
    // 2. tracking starts empty and the scene reveals from switches
    out.before = $gameSystem.mamcEncounterAry().length;
    $gameSwitches.setValue(101, true);
    $gameSwitches.setValue(102, true);
    const sc = new Scene_MonsterCatalogue();
    sc.beastiaryCheck();
    out.afterSwitch = $gameSystem.mamcEncounterAry().slice();
    // 3. reveal everything so the scene has something to show
    const all = [];
    for (let i = 1; i < $dataEnemies.length; i++) all.push(i);
    $gameSystem.mamcEncounterMonster.apply($gameSystem, all);
    out.afterAll = $gameSystem.mamcEncounterAry().length;
    out.hidden = $gameSystem.mamcHideAry().length;
    return out;
  });
  console.log('INFO ' + JSON.stringify(info, null, 1));

  await p.evaluate(() => { SceneManager.push(Scene_MonsterCatalogue); });
  await sleep(2500);
  await p.screenshot({ path: OUT + 'catalogue_1.png' });
  const s1 = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      scene: sc.constructor.name,
      stopped: !!SceneManager._stopped,
      err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
             .replace(/<[^>]+>/g, '').slice(0, 200),
      list: sc._monsterListWindow ? sc._monsterListWindow._data.length : -1,
      first: sc._monsterListWindow && sc._monsterListWindow._data[0]
             ? sc._monsterListWindow._data[0].name : null,
      card: sc._monsterCardWindow ? sc._monsterCardWindow._monsterId : -1,
      stats: sc._monsterCardWindow ? sc._monsterCardWindow.shownStats() : [],
      label: sc._categoryLabelWindow ? sc._categoryLabelWindow._category : -1,
      completion: sc._categoryLabelWindow ? sc._categoryLabelWindow.getCompletion() : null
    };
  });
  console.log('SCENE ' + JSON.stringify(s1));

  // select a later entry so the card redraws with a battler
  await p.evaluate(() => { SceneManager._scene._monsterListWindow.select(3); });
  await sleep(1800);
  await p.screenshot({ path: OUT + 'catalogue_3.png' });
  console.log('CARD ' + JSON.stringify(await p.evaluate(() => {
    const sc = SceneManager._scene;
    const c = sc._monsterCardWindow;
    return { idx: sc._monsterListWindow.index(), card: c._monsterId,
             name: c.monsterName(), stats: c.shownStats(), statY: c.statY(),
             err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
                    .replace(/<[^>]+>/g, '').slice(0, 200) };
  })));

  // walk the category tabs to the right
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => { Input._currentState.right = true; });
    await sleep(400);
  }
  await sleep(800);
  await p.screenshot({ path: OUT + 'catalogue_2.png' });
  const s2 = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      cat: sc._categoryWindow ? sc._categoryWindow.index() : -1,
      label: sc._categoryLabelWindow ? sc._categoryLabelWindow._category : -1,
      list: sc._monsterListWindow ? sc._monsterListWindow._data.length : -1,
      err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
             .replace(/<[^>]+>/g, '').slice(0, 200)
    };
  });
  console.log('AFTER-TABS ' + JSON.stringify(s2));

  // move down the list so the card redraws with a battler
  await p.evaluate(() => { SceneManager._scene._monsterListWindow.select(2); });
  await sleep(1800);
  await p.screenshot({ path: OUT + 'catalogue_3.png' });
  const s3 = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      idx: sc._monsterListWindow ? sc._monsterListWindow.index() : -1,
      card: sc._monsterCardWindow ? sc._monsterCardWindow._monsterId : -1,
      name: sc._monsterCardWindow ? sc._monsterCardWindow.monsterName() : null,
      err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
             .replace(/<[^>]+>/g, '').slice(0, 200)
    };
  });
  console.log('AFTER-MOVE ' + JSON.stringify(s3));

  // cancel out
  await p.evaluate(() => { Input._currentState.escape = true; });
  await sleep(1200);
  console.log('AFTER-CANCEL ' + JSON.stringify(await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null
  }))));

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
