//=============================================================================
// QA / Edward - live regression suite for MonlineJp.js.
//
// Runs against the REAL rpg_objects.js / rpg_managers.js / data / plugin order
// (see qa_jp_env.js), and includes MUTATION tests: a constant is flipped in
// the source *text* before evaluation, and the suite asserts the observable
// behaviour actually moves.  A hook that is present but dead cannot survive
// that - which is exactly the failure mode from the previous round.
//
//   node qa_jp_live.js
//=============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const env = require('./qa_jp_env');

const JP_FILE = path.join(env.PLUGINS, 'MonlineJp.js');
const SRC = env.read(JP_FILE);

let fails = 0;
let total = 0;
function ok(label, cond, detail) {
    total++;
    if (cond) {
        console.log('  ok    ' + label);
    } else {
        fails++;
        console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : ''));
    }
}
function eq(label, got, want) {
    ok(label + ' (got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want) + ')',
       got === want);
}

/** Replace one constant in the MonlineJp.js source; fail loudly if it misses. */
function mutate(name, value) {
    const re = new RegExp('(' + name + ':\\s+)0(,)');
    if (!re.test(SRC)) { throw new Error('mutation target not found: ' + name); }
    const out = SRC.replace(re, '$1' + value + '$2');
    if (out === SRC) { throw new Error('mutation did not change the source: ' + name); }
    return function(src) { return src === SRC ? out : src; };
}

console.log('=== QA live suite: MonlineJp against the real MV engine ===');
console.log('engine : ' + path.join(env.JS, 'rpg_objects.js'));
console.log('plugin : ' + JP_FILE);
console.log();

//--------------------------------------------------------------------------
// helpers
//--------------------------------------------------------------------------
const JP_GAIN = /<[ ]*(?:JP_GAIN|jp gain):[ ]*(\d+)[ ]*>/i;

function firstUntaggedEnemyId(g) {
    for (let i = 1; i < g.$dataEnemies.length; i++) {
        const e = g.$dataEnemies[i];
        if (e && !JP_GAIN.test(e.note || '')) { return i; }
    }
    return null;
}

/** Silence dice so the victory flow is reproducible. */
function freezeRng(g) { vm.runInContext('Math.random = function(){ return 0; };', g); }

/**
 * Force every action to connect.
 * Freezing Math.random to 0 does NOT do it: `itemEva` is 5% here, and
 * `evaded = (Math.random() < itemEva)` is then always true - every attack
 * would be dodged and `applyItemUserEffect` would never be reached.  Pin the
 * two rates instead; `Game_Action#apply` still gates on `result.isHit()`, so
 * the JP hook is only reached on a genuine hit.
 */
function forceHit(g) {
    g.Game_Action.prototype.itemHit = function() { return 1; };
    g.Game_Action.prototype.itemEva = function() { return 0; };
}

/** Record the order in which the real processVictory steps fire. */
function instrumentVictory(g, log) {
    const wrap = function(obj, name, tag) {
        const orig = obj[name];
        if (typeof orig !== 'function') { throw new Error('no such step: ' + tag); }
        obj[name] = function() { log.push(tag); return orig.apply(this, arguments); };
    };
    wrap(g.$gameParty, 'removeBattleStates', 'removeBattleStates');
    wrap(g.$gameParty, 'performVictory', 'performVictory');
    wrap(g.BattleManager, 'playVictoryMe', 'playVictoryMe');
    wrap(g.BattleManager, 'replayBgmAndBgs', 'replayBgmAndBgs');
    wrap(g.BattleManager, 'makeRewards', 'makeRewards');
    wrap(g.BattleManager, 'displayVictoryMessage', 'displayVictoryMessage');
    wrap(g.BattleManager, 'displayRewards', 'displayRewards');
    wrap(g.BattleManager, 'gainRewards', 'gainRewards');
    wrap(g.BattleManager, 'endBattle', 'endBattle');
}

/**
 * The negative control: cut the graft out of processVictory and keep every
 * other line.  If the suite still reported JP afterwards, the payout would be
 * coming from somewhere other than the hook we think we tested.
 */
function cutGraft(src) {
    const before = src;
    const out = src.replace('this.gainJp();\n                return _processVictory',
                            'return _processVictory');
    if (out === before) { throw new Error('could not locate the processVictory graft'); }
    return out;
}

/** Run one scripted victory and report the JP each actor got. */
function victory(opts) {
    const g = env.build({ jpTransform: opts.jpTransform });
    freezeRng(g);
    const actors = env.setParty(g, opts.party);
    env.setTroop(g, opts.enemies);
    const before = actors.map(function(a) { return a.jp(); });
    if (opts.inBattle) { g.$gameParty.onBattleStart(); }
    if (opts.killAll) { g.$gameTroop.members().forEach(function(m) { env.kill(g, m); }); }
    if (opts.kill) { opts.kill.forEach(function(i) { env.kill(g, g.$gameTroop.members()[i]); }); }
    if (opts.log) { instrumentVictory(g, opts.log); }
    g.BattleManager.processVictory();
    const after = actors.map(function(a) { return a.jp(); });
    return { g: g, actors: actors, gains: after.map(function(v, i) { return v - before[i]; }) };
}

//==========================================================================
console.log('--- D. semantics on real engine objects ---');

// D1 a tagged enemy that actually died pays; a live one does not
{
    const untagged = firstUntaggedEnemyId(env.build());
    ok('found an enemy with no <jp gain:> tag', untagged !== null, 'id=' + untagged);

    const live = victory({ party: [1], enemies: [1], kill: [], inBattle: true });
    eq('an enemy nobody killed pays nothing', live.gains[0], 0);
    eq('  its troop jpTotal is 0', live.g.$gameTroop.jpTotal(), 0);

    const dead = victory({ party: [1], enemies: [1], kill: [0], inBattle: true });
    eq('a killed Holstaurus pays 10', dead.gains[0], 10);

    // two enemies, only one of them dead
    const mixed = victory({ party: [1], enemies: [1, 1], kill: [1], inBattle: true });
    eq('two Holstaurus, one killed -> 10 (not 20)', mixed.gains[0], 10);

    // untagged enemy contributes the ENEMY_KILL fallback = 0
    const noTag = victory({ party: [1], enemies: [untagged], kill: [0], inBattle: true });
    eq('a tagless dead enemy pays the 0 fallback', noTag.gains[0], 0);
}

// D2 reserve members are not paid (VX Ace: members == battle_members in battle)
{
    const ids = [1, 2, 3, 4, 5];
    const r = victory({ party: ids, enemies: [1], kill: [0], inBattle: true });
    const names = r.actors.map(function(a) { return a.name(); });
    console.log('       party = ' + names.join(', ') + '  (max 4 battle members)');
    console.log('       gains = ' + r.gains.join(', '));
    ok('the four battle members were paid',
       r.gains.slice(0, 4).every(function(v) { return v === 10; }),
       r.gains.join(','));
    eq('the 5th (reserve) member got nothing', r.gains[4], 0);
    ok('none of them carries a <jp rate:>',
       r.actors.every(function(a) {
           return !/<[ ]*(?:JP_RATE|jp rate)/i.test((a.actor() || {}).note || '');
       }));
}

// D3 PXE's 0% rate
{
    const r = victory({ party: [1, 25], enemies: [1], kill: [0], inBattle: true });
    console.log('       actor 1 (' + r.actors[0].name() + ') gain=' + r.gains[0] +
                ', actor 25 (' + r.actors[1].name() + ') gain=' + r.gains[1]);
    eq('a normal member takes the full amount', r.gains[0], 10);
    eq('PXE (actor 25, <jp rate: 0%>) takes nothing', r.gains[1], 0);
    eq('PXE jpr is 0', r.actors[1].jpRate(), 0);
    eq('normal member jpr is 1', r.actors[0].jpRate(), 1);
}

// D4 earn vs gain: only earn applies the rate
{
    const g = env.build();
    const actors = env.setParty(g, [25, 1]);
    const pxe = actors[0], normal = actors[1];
    pxe.gainJp(100); eq('gainJp(100) bypasses the 0% rate', pxe.jp(), 100);
    pxe.jp();   // no-op
    const before = pxe.jp();
    pxe.earnJp(100);
    eq('earnJp(100) applies the 0% rate -> no change', pxe.jp() - before, 0);
    const b2 = normal.jp();
    normal.earnJp(100);
    eq('earnJp(100) on a 100% actor adds 100', normal.jp() - b2, 100);
    const b3 = pxe.jp();
    pxe.earn_jp(100);
    eq('the Ruby alias earn_jp behaves the same', pxe.jp() - b3, 0);
}

// D5 the JP is on the actor before MV clears battle states
{
    const log = [];
    const g = env.build();
    freezeRng(g);
    const actors = env.setParty(g, [1]);
    env.setTroop(g, [1]);
    env.kill(g, g.$gameTroop.members()[0]);
    g.$gameParty.onBattleStart();
    // give the actor a battle state so removeBattleStates has real work to do
    actors[0].addState(2);
    const seen = [];
    const origRemove = g.$gameParty.removeBattleStates;
    g.$gameParty.removeBattleStates = function() {
        seen.push('removeBattleStates(jp=' + actors[0].jp() + ')');
        return origRemove.apply(this, arguments);
    };
    const origEarn = g.Game_Actor.prototype.earnJp;
    g.Game_Actor.prototype.earnJp = function() {
        seen.push('earnJp');
        return origEarn.apply(this, arguments);
    };
    g.BattleManager.processVictory();
    console.log('       order: ' + seen.join(' -> '));
    ok('earnJp ran before removeBattleStates',
       seen.indexOf('earnJp') >= 0 && seen.indexOf('earnJp') <
       seen.findIndex(function(s) { return s.indexOf('removeBattleStates') === 0; }),
       seen.join(' -> '));
    ok('the JP was already banked when removeBattleStates ran',
       /removeBattleStates\(jp=10\)/.test(seen.join('|')), seen.join('|'));
    ok(log.length === 0, 'unused log');
}

// D6 processVictory order: the graft must not disturb the existing steps
{
    const without = [];
    const g1 = env.build({ pluginOrder: ['MonlineShim.js', 'MonlineScenes.js'] });
    freezeRng(g1);
    env.setParty(g1, [1]);
    env.setTroop(g1, [1]);
    env.kill(g1, g1.$gameTroop.members()[0]);
    g1.$gameParty.onBattleStart();
    instrumentVictory(g1, without);
    g1.BattleManager.processVictory();

    const with_ = [];
    const g2 = env.build();
    freezeRng(g2);
    env.setParty(g2, [1]);
    env.setTroop(g2, [1]);
    env.kill(g2, g2.$gameTroop.members()[0]);
    g2.$gameParty.onBattleStart();
    instrumentVictory(g2, with_);
    // also record where the grafted gainJp lands
    const origGain = g2.BattleManager.gainJp;
    g2.BattleManager.gainJp = function() { with_.push('gainJp'); return origGain(); };
    g2.BattleManager.processVictory();

    console.log('       without JP plugin: ' + without.join(' -> '));
    console.log('       with    JP plugin: ' + with_.join(' -> '));
    eq('same number of steps', with_.length, without.length + 1);
    eq('the only new step is gainJp, in front',
       with_.slice(1).join('|'), without.join('|'));
    eq('gainJp is the first thing that happens', with_[0], 'gainJp');
    eq('removeBattleStates is still the first *original* step', without[0],
       'removeBattleStates');
}

//==========================================================================
console.log();
console.log('--- C. mutation tests: prove each hook is really wired ---');

// C1 ENEMY_KILL - the fallback a tagless enemy pays
{
    const untagged = firstUntaggedEnemyId(env.build());
    const base = victory({ party: [1], enemies: [untagged], kill: [0], inBattle: true });
    const mut = victory({ party: [1], enemies: [untagged], kill: [0], inBattle: true,
                          jpTransform: mutate('ENEMY_KILL', 7) });
    console.log('       ENEMY_KILL=0 -> gain ' + base.gains[0] +
                ' ; ENEMY_KILL=7 -> gain ' + mut.gains[0]);
    eq('ENEMY_KILL=0: a tagless enemy pays 0', base.gains[0], 0);
    eq('ENEMY_KILL=7: the same battle pays 7', mut.gains[0], 7);
    ok('flipping ENEMY_KILL changes the victory payout',
       base.gains[0] !== mut.gains[0]);

    // and a tagged enemy is unaffected by the constant - the tag wins
    const tagged = victory({ party: [1], enemies: [1], kill: [0], inBattle: true,
                             jpTransform: mutate('ENEMY_KILL', 7) });
    eq('a tagged enemy still pays its tag, not the constant', tagged.gains[0], 10);
    // restored
    const restored = victory({ party: [1], enemies: [1], kill: [0], inBattle: true });
    eq('restored source still pays 10', restored.gains[0], 10);
}

// C1b negative control: with the graft cut out, the payout must vanish
{
    const withGraft = victory({ party: [1], enemies: [1], kill: [0], inBattle: true });
    const without = victory({ party: [1], enemies: [1], kill: [0], inBattle: true,
                              jpTransform: cutGraft });
    console.log('       with graft -> gain ' + withGraft.gains[0] +
                ' ; graft cut out -> gain ' + without.gains[0]);
    eq('the graft is what pays the 10 JP', withGraft.gains[0], 10);
    eq('cut the graft out and the 10 JP disappears', without.gains[0], 0);
    // ...but the rest of the JP machinery is still there and still callable
    const b = without.actors[0].jp();
    without.actors[0].earnJp(42);
    eq('Game_Actor#earnJp still works with the graft removed',
       without.actors[0].jp() - b, 42);
}

// C2 ACTION_JP - JP for using a skill
function actionJp(transform) {
    const g = env.build({ jpTransform: transform });
    freezeRng(g);
    forceHit(g);
    const actors = env.setParty(g, [1]);
    env.setTroop(g, [1]);
    const actor = actors[0];
    const enemy = g.$gameTroop.members()[0];
    enemy.appear();
    const before = actor.jp();
    const action = new g.Game_Action(actor);
    action.setSkill(1);
    const res = enemy.result();
    action.apply(enemy);
    return { g: g, gain: actor.jp() - before, hit: res.isHit(), used: res.used };
}
{
    const base = actionJp(null);
    const mut = actionJp(mutate('ACTION_JP', 3));
    console.log('       ACTION_JP=0 -> gain ' + base.gain +
                ' ; ACTION_JP=3 -> gain ' + mut.gain +
                '  (hit=' + mut.hit + ')');
    ok('the skill really connected (otherwise the test proves nothing)',
       base.hit === true && mut.hit === true,
       'hit base=' + base.hit + ' mut=' + mut.hit);
    eq('ACTION_JP=0: using a skill pays 0', base.gain, 0);
    eq('ACTION_JP=3: using a skill pays 3', mut.gain, 3);
    ok('flipping ACTION_JP changes the payout', base.gain !== mut.gain);
    eq('restored source still pays 0', actionJp(null).gain, 0);
}

// C3 LEVEL_UP
{
    function levelUp(transform) {
        const g = env.build({ jpTransform: transform });
        const actors = env.setParty(g, [1]);
        const a = actors[0];
        const before = a.jp();
        a.levelUp();
        return a.jp() - before;
    }
    const base = levelUp(null);
    const mut = levelUp(mutate('LEVEL_UP', 5));
    console.log('       LEVEL_UP=0 -> gain ' + base + ' ; LEVEL_UP=5 -> gain ' + mut);
    eq('LEVEL_UP=0: levelling pays 0', base, 0);
    eq('LEVEL_UP=5: levelling pays 5', mut, 5);
    ok('flipping LEVEL_UP changes the payout', base !== mut);
    eq('restored source still pays 0', levelUp(null), 0);
}

//==========================================================================
console.log();
console.log('--- more semantics ---');

// enemy users never earn action JP (0173.rb:449 `if user.actor?`)
{
    const g = env.build({ jpTransform: mutate('ACTION_JP', 3) });
    freezeRng(g);
    forceHit(g);
    const actors = env.setParty(g, [1]);
    env.setTroop(g, [1]);
    const actor = actors[0];
    const enemy = g.$gameTroop.members()[0];
    enemy.appear();

    let enemyEarned = 0;
    enemy.earnJp = function() { enemyEarned++; return 0; };

    const before = actor.jp();
    const action = new g.Game_Action(enemy);
    action.setSkill(1);
    action.apply(actor);
    console.log('       enemy-used skill: enemy.earnJp calls = ' + enemyEarned +
                ', actor jp delta = ' + (actor.jp() - before));
    eq('an enemy user never earns action JP', enemyEarned, 0);
    eq('the actor *target* is not paid either (only the user is)', actor.jp() - before, 0);
}

// a <jp gain:> on a skill pays the user, enemy users still excluded
{
    const g = env.build();
    freezeRng(g);
    forceHit(g);
    const fakeSkill = JSON.parse(JSON.stringify(g.$dataSkills[1]));
    fakeSkill.id = 90001;
    fakeSkill.name = 'QA JP skill';
    fakeSkill.note = '<jp gain: 9>';
    fakeSkill.damage = { type: 0, elementId: 0, formula: '0', variance: 20, critical: false };
    fakeSkill.effects = [];
    fakeSkill.tpGain = 0;
    g.$dataSkills[90001] = env.inContext(g, JSON.stringify(fakeSkill));

    const actors = env.setParty(g, [1]);
    env.setTroop(g, [1]);
    const actor = actors[0];
    const enemy = g.$gameTroop.members()[0];
    enemy.appear();
    const before = actor.jp();
    const action = new g.Game_Action(actor);
    action.setSkill(90001);
    action.apply(enemy);
    console.log('       <jp gain: 9> skill, ACTION_JP=0 -> actor gain ' +
                (actor.jp() - before));
    eq('a <jp gain: 9> skill pays 9 even though ACTION_JP is 0', actor.jp() - before, 9);
}

// jpTotal 0 / no dead members never throws
{
    let threw = null;
    try {
        const r = victory({ party: [1], enemies: [1, 1], kill: [], inBattle: true });
        if (r.gains[0] !== 0) { threw = 'expected 0, got ' + r.gains[0]; }
    } catch (e) { threw = e.message; }
    ok('a victory with no dead members does not throw', threw === null, threw);

    const g = env.build();
    env.setTroop(g, [1]);
    eq('empty troop jpTotal is 0', g.$gameTroop.jpTotal(), 0);
    let threw2 = null;
    try { g.BattleManager.gainJp(); } catch (e) { threw2 = e.message; }
    ok('BattleManager.gainJp with jpTotal 0 does not throw', threw2 === null, threw2);
}

// jpRate multiplies actor x class x equips x states
{
    const g = env.build();
    const actors = env.setParty(g, [1]);
    const a = actors[0];
    eq('a plain actor is 100%', a.jpRate(), 1.0);
    // a state carrying a rate tag must be multiplied in
    g.$dataStates[90001] = env.inContext(g, JSON.stringify({
        id: 90001, name: 'QA half JP', note: '<jp rate: 50%>',
        iconIndex: 0, maxIcons: 1, priority: 50,
        autoRemovalTiming: 0, minTurns: 1, maxTurns: 1,
        chanceByDamage: 0, removeByDamage: false, removeAtBattleEnd: true,
        removeByRestriction: false, removeByWalking: false, stepsToRemove: 1,
        message1: '', message2: '', message3: '', message4: '', motion: 0,
        overlay: 0, restriction: 0, plusStateSet: [], minusStateSet: [],
        traits: [], removeByRestrictedRestriction: false
    }));
    a.addState(90001);
    eq('a 50% state halves the rate', a.jpRate(), 0.5);
    const before = a.jp();
    a.earnJp(20);
    eq('earnJp(20) at 50% banks 10', a.jp() - before, 10);
}

//==========================================================================
console.log();
console.log('--- E. boundaries with the existing implementation ---');

// E1 MonlineScenes' per-class storage still behaves the way the learn UI needs
{
    const g = env.build();
    const actors = env.setParty(g, [1]);
    const a = actors[0];
    const c1 = a.jpClassId();
    const c2 = (c1 === 1) ? 2 : 1;
    a.gainJp(50, c1);
    eq('class 1 pool', a.jp(c1), 50);
    eq('class 2 pool stays separate', a.jp(c2), 0);
    a.loseJp(20, c1);
    eq('loseJp subtracts', a.jp(c1), 30);
    a.loseJp(9999, c1);
    eq('JP clamps at 0, never negative', a.jp(c1), 0);
    a.gainJp(g.MonlineScenes.LearnConfig.MAX_JP + 1000, c1);
    eq('JP clamps at MAX_JP', a.jp(c1), g.MonlineScenes.LearnConfig.MAX_JP);
    // fractional earn truncates, like Ruby's .to_i
    a.initJp();
    a.gainJp(7.9);
    eq('a fractional amount truncates (0173.rb:491 jp.to_i)', a.jp(), 7);
}

// E2 the shim's empty gain_jp stub is NOT what runs
{
    const g = env.build();
    const actors = env.setParty(g, [1]);
    const a = actors[0];
    const body = String(g.Game_Actor.prototype.gain_jp).replace(/\s+/g, ' ');
    ok('Game_Actor#gain_jp is not the shim blank', body !== 'function () {}', body);
    const before = a.jp();
    a.gain_jp(5);
    eq('gain_jp(5) really adds 5 (shim stub would add 0)', a.jp() - before, 5);
    const b2 = a.jp();
    a.lose_jp(2);
    eq('lose_jp(2) really subtracts 2', a.jp() - b2, -2);
    ok('MonlineShim installed its stub first',
       /gain_jp/.test(env.read(path.join(env.PLUGINS, 'MonlineShim.js'))));
}

// E3 the other MonlineScenes scenes survived
{
    const g = env.build();
    ['Scene_Crafting', 'Scene_LearnSkill', 'Scene_PXEBestChoose',
     'Scene_MonsterCatalogue'].forEach(function(n) {
        ok(n + ' still defined', typeof g[n] === 'function', typeof g[n]);
    });
    ok('MonlineScenes still publishes LearnConfig',
       g.MonlineScenes && typeof g.MonlineScenes.LearnConfig === 'object');
    ok('Game_Actor#jp is still MonlineScenes\' per-class reader',
       /jpStorage|jpClassId/.test(String(g.Game_Actor.prototype.jp)));
}

// E4 MonlineJp must not shadow the storage it depends on
{
    const g = env.build();
    ok('MonlineJp does not redefine Game_Actor#jp',
       /jpStorage|jpClassId/.test(String(g.Game_Actor.prototype.jp)));
    ok('MonlineJp does not redefine Game_Actor#gainJp',
       /jpStorage|jpClassId/.test(String(g.Game_Actor.prototype.gainJp)));
    ok('MonlineJp#earnJp delegates to gainJp',
       /gainJp/.test(String(g.Game_Actor.prototype.earnJp)));
}

//==========================================================================
// The whole suite again, against the second copy of the project.
//==========================================================================
console.log();
console.log('--- F. the same run against mv_project/ (the other copy) ---');
{
    const OTHER = 'G:/新建文件夹 (22)/Monline_MV/mv_project';
    const untagged = firstUntaggedEnemyId(env.build({ root: OTHER }));

    function v2(opts) {
        opts.root = OTHER;
        return victory(opts);
    }
    const a = v2({ party: [1, 25], enemies: [1], kill: [0], inBattle: true });
    console.log('       actor 1 gain=' + a.gains[0] + ', PXE gain=' + a.gains[1]);
    eq('mv_project: killed Holstaurus pays 10', a.gains[0], 10);
    eq('mv_project: PXE still earns nothing', a.gains[1], 0);
    eq('mv_project: a live enemy pays nothing',
       v2({ party: [1], enemies: [1], kill: [], inBattle: true }).gains[0], 0);
    eq('mv_project: ENEMY_KILL mutation still moves the needle',
       v2({ party: [1], enemies: [untagged], kill: [0], inBattle: true,
            jpTransform: mutate('ENEMY_KILL', 7) }).gains[0], 7);
    eq('mv_project: cutting the graft still kills the payout',
       v2({ party: [1], enemies: [1], kill: [0], inBattle: true,
            jpTransform: cutGraft }).gains[0], 0);
}

//==========================================================================
console.log();
console.log('--- G. the whole plugin stack (all 18, in plugins.js order) ---');
{
    const pj = fs.readFileSync(path.join(env.JS, 'plugins.js'), 'utf8');
    const names = (pj.match(/"name"\s*:\s*"([^"]+)"/g) || []).map(function(s) {
        return s.replace(/.*"name"\s*:\s*"/, '').replace(/"$/, '');
    });
    const order = names.map(function(n) { return n + '.js'; });
    let g = null, err = null;
    try { g = env.build({ pluginOrder: order }); } catch (e) { err = e.message; }
    ok('all ' + order.length + ' plugins load in plugins.js order', g !== null, err);
    if (g) {
        console.log('       ' + names.join(' -> '));
        ok('MonlineJp still present after the later plugins load',
           typeof g.MonlineJp === 'object');
        ok('BattleManager.gainJp survives MonlineRubyBridge (loaded last)',
           typeof g.BattleManager.gainJp === 'function');
        const actors = env.setParty(g, [1, 25]);
        env.setTroop(g, [1]);
        env.kill(g, g.$gameTroop.members()[0]);
        g.$gameParty.onBattleStart();
        const before = actors.map(function(a) { return a.jp(); });
        g.BattleManager.processVictory();
        const gains = actors.map(function(a, i) { return a.jp() - before[i]; });
        console.log('       gains with every plugin loaded: ' + gains.join(', '));
        eq('full stack: a normal member is paid', gains[0], 10);
        eq('full stack: PXE is still not', gains[1], 0);
    }
}

//==========================================================================
console.log();
console.log('--- H. the event-script path (why gain_jp must bypass the rate) ---');
{
    // the bridge is what turns the VX Ace event scripts into JS, so it has to
    // be part of this scenario
    const g = env.build({
        pluginOrder: ['MonlineShim.js', 'MonlineScenes.js', 'MonlineJp.js',
                      'MonlineRubyBridge.js']
    });
    const actors = env.setParty(g, [25]);
    const pxe = actors[0];
    const ruby = '$game_actors[25].gain_jp(1)';
    let js = null, err = null;
    try { js = g.MonlineRuby.translate(ruby); } catch (e) { err = e.message; }
    ok('the bridge translates ' + ruby, js !== null, err);
    if (js) {
        console.log('       -> ' + js);
        const before = pxe.jp();
        g.MonlineRuby.evalScript(js, null, 'event');
        eq('a 0% actor still receives gain_jp from an event', pxe.jp() - before, 1);
    }
    // and the battle path (earn) is what the 0% rate is supposed to block
    const b2 = pxe.jp();
    pxe.earnJp(1);
    eq('...while earnJp is blocked by the 0% rate', pxe.jp() - b2, 0);
}

console.log();
console.log('=== ' + (fails === 0 ? 'LIVE CHECK PASSED' : 'LIVE CHECK FAILED') +
            ': ' + (total - fails) + '/' + total + ' assertions held ===');
process.exit(fails === 0 ? 0 : 1);
