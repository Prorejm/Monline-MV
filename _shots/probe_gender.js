// Monline's gender system (VX Ace 0153.rb, Mr. Bubble's Gender Functions).
//   NODE_PATH=<pw> node _shots/probe_gender.js
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

  // -------------------------------------------------------------- the plugin
  console.log('--- the plugin ---');
  const cfg = await p.evaluate(() => ({
    cfg: window.MonlineGender ? MonlineGender.CFG : null,
    battlerGender: typeof $gameParty.leader().gender,
    male: typeof $gameParty.leader().male,
    female: typeof $gameParty.leader().female,
    genderless: typeof $gameParty.leader().genderless
  }));
  console.log('  cfg    ' + JSON.stringify(cfg));
  ok('MonlineGender reports its settings', !!cfg.cfg, JSON.stringify(cfg));
  ok('battlers answer gender / male / female / genderless',
     cfg.battlerGender === 'function' && cfg.male === 'function' &&
       cfg.female === 'function' && cfg.genderless === 'function',
     JSON.stringify(cfg));

  // ------------------------------------------------------------ the notetags
  console.log('--- the notetags in the shipped data ---');
  const tags = await p.evaluate(() => {
    let male = 0, female = 0, genderless = 0;
    $dataActors.forEach(function (a) {
      if (!a) { return; }
      var g = MonlineGender.genderOf(a, true);
      if (g === 1) { male++; } else if (g === 2) { female++; } else { genderless++; }
    });
    let eMale = 0, eFemale = 0, eGenderless = 0;
    $dataEnemies.forEach(function (e) {
      if (!e) { return; }
      var g = MonlineGender.genderOf(e, false);
      if (g === 1) { eMale++; } else if (g === 2) { eFemale++; } else { eGenderless++; }
    });
    return {
      actors: { male, female, genderless },
      enemies: { male: eMale, female: eFemale, genderless: eGenderless },
      total: male + female + eMale + eFemale
    };
  });
  console.log('  tags   ' + JSON.stringify(tags));
  ok('the data really carries genders (123 tags were converted)',
     tags.total > 0, JSON.stringify(tags));
  ok('both male and female turn up somewhere',
     tags.actors.male + tags.enemies.male > 0 &&
       tags.actors.female + tags.enemies.female > 0, JSON.stringify(tags));

  // Direct notetag parsing, including the <sex:> alias and last-line-wins.
  const parse = await p.evaluate(() => ({
    m: MonlineGender.genderOf({ note: '<gender: m>' }, true),
    female: MonlineGender.genderOf({ note: '<gender: female>' }, true),
    f: MonlineGender.genderOf({ note: '<gender: f>' }, true),
    none: MonlineGender.genderOf({ note: '<gender: none>' }, true),
    genderless: MonlineGender.genderOf({ note: '<gender: genderless>' }, true),
    sexAlias: MonlineGender.genderOf({ note: '<sex: male>' }, false),
    upper: MonlineGender.genderOf({ note: '<GENDER: F>' }, true),
    lastWins: MonlineGender.genderOf({ note: '<gender: m>\n<gender: f>' }, true),
    untagged: MonlineGender.genderOf({ note: '' }, true)
  }));
  console.log('  parse  ' + JSON.stringify(parse));
  ok('m / male is 1', parse.m === 1 && parse.sexAlias === 1, JSON.stringify(parse));
  ok('f / female is 2', parse.f === 2 && parse.female === 2 && parse.upper === 2,
     JSON.stringify(parse));
  ok('none / genderless is 0', parse.none === 0 && parse.genderless === 0,
     JSON.stringify(parse));
  ok('the last matching line wins', parse.lastWins === 2, JSON.stringify(parse));
  ok('an untagged battler falls back to genderless',
     parse.untagged === 0, JSON.stringify(parse));

  // -------------------------------------------------------------- script calls
  console.log('--- the script calls ---');
  const calls = await p.evaluate(() => {
    const names = Object.keys(MonlineGender.CALLS);
    const missing = names.filter(function (n) {
      return typeof window[n] !== 'function';
    });
    return { count: names.length, missing, names: names.slice(0, 6) };
  });
  console.log('  calls  ' + JSON.stringify(calls));
  ok('every script call is published as a global',
     calls.missing.length === 0 && calls.count >= 27, JSON.stringify(calls));

  // Exercise them against a known actor.
  const behaviour = await p.evaluate(() => {
    // Find one male and one female actor in the database.
    let maleId = 0, femaleId = 0;
    $dataActors.forEach(function (a) {
      if (!a) { return; }
      var g = MonlineGender.genderOf(a, true);
      if (g === 1 && !maleId) { maleId = a.id; }
      if (g === 2 && !femaleId) { femaleId = a.id; }
    });
    const res = { maleId, femaleId };
    if (maleId) {
      res.actorMale = window.actor_male(maleId);
      res.actorFemale = window.actor_female(maleId);
      res.actorGenderless = window.actor_genderless(maleId);
    }
    if (femaleId) {
      res.femaleIsFemale = window.actor_female(femaleId);
      res.femaleIsMale = window.actor_male(femaleId);
    }
    // A nonsense id must be false, not a crash.
    res.bogus = window.actor_male(9999);
    // Counts.
    res.allMale = window.all_party_male_count();
    res.allFemale = window.all_party_female_count();
    res.allGenderless = window.all_party_genderless_count();
    res.battleMale = window.battle_party_male_count();
    res.reserveMale = window.reserve_party_male_count();
    res.allBattleAll = window.battle_party_all_male();
    res.leaderMale = window.leader_male();
    res.leaderFemale = window.leader_female();
    res.leaderGenderless = window.leader_genderless();
    res.party0Male = window.party_member_male(0);
    return res;
  });
  console.log('  behave ' + JSON.stringify(behaviour));
  ok('a male actor answers male, not female',
     behaviour.actorMale === true && behaviour.actorFemale === false &&
       behaviour.actorGenderless === false, JSON.stringify(behaviour));
  ok('a female actor answers female, not male',
     behaviour.femaleIsFemale === true && behaviour.femaleIsMale === false,
     JSON.stringify(behaviour));
  ok('an unknown actor id is simply false', behaviour.bogus === false,
     JSON.stringify(behaviour));
  ok('the counts split the party consistently',
     behaviour.allMale === behaviour.battleMale + behaviour.reserveMale,
     JSON.stringify(behaviour));
  ok('exactly one of the leader predicates is true',
     (behaviour.leaderMale ? 1 : 0) + (behaviour.leaderFemale ? 1 : 0) +
       (behaviour.leaderGenderless ? 1 : 0) === 1, JSON.stringify(behaviour));
  ok('party_member_male(0) agrees with the leader',
     behaviour.party0Male === behaviour.leaderMale, JSON.stringify(behaviour));

  // ---------------------------------------------------- ruby syntax handling
  console.log('--- ruby syntax ---');
  const tr = await p.evaluate(() => ({
    bare: MonlineRuby.translate('leader_male?'),
    call: MonlineRuby.translate('party_member_female?(0)'),
    method: MonlineRuby.translate('a.male?'),
    inIf: MonlineRuby.translate('if leader_male? then 1 else 2 end'),
    ternary: MonlineRuby.translate('a ? b : c')
  }));
  console.log('  tr     ' + JSON.stringify(tr));
  ok('leader_male? becomes a call', /\bleader_male\(\)/.test(tr.bare), tr.bare);
  ok('party_member_female?(0) keeps its argument',
     /party_member_female\(0\)/.test(tr.call), tr.call);
  ok('member.male? becomes member.male()', /\.male\(\)/.test(tr.method), tr.method);
  ok('a real ternary is left alone', tr.ternary.indexOf('?') >= 0, tr.ternary);

  // ------------------------------------------------------------------ errors
  console.log('--- errors ---');
  ok('no javascript errors along the way', errors.length === 0,
     errors.join('\n        '));

  await b.close();
  console.log(failures === 0
    ? '\nGENDER PASSED: all assertions held'
    : '\nGENDER FAILED: ' + failures + ' assertion(s)');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('THREW: ' + e.stack); process.exit(2); });
