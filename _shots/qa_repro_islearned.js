// Minimal repro for the QA blocker: MonlineScenes.js calls actor.isLearned(id),
// but the real MV Game_Actor only exposes isLearnedSkill(id).
// No window/PIXI stubs are used for Game_Actor - only the real rpg_objects.js.
const fs = require('fs');
const path = require('path');
const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const g = globalThis;
g.window = g;
g.Rectangle = function() {};
g.Utils = { isOptionValid: () => false, generateRuntimeId: () => 'x' };
Array.prototype.contains = function(e) { return this.indexOf(e) >= 0; };
Number.prototype.clamp = function(a, b) { return Math.max(a, Math.min(b, this)); };

// MonlineScenes subclasses engine classes at load time
g.Stage = function() {};
g.Stage.prototype.initialize = function() {};
g.Window = function() {};
g.Window.prototype.initialize = function() {};
(0, eval)(fs.readFileSync(path.join(ROOT, 'js/rpg_objects.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js/rpg_scenes.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js/rpg_windows.js'), 'utf8'));

function loadJson(n) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', n), 'utf8')
        .replace(/^\uFEFF/, ''));
}
g.$dataActors = loadJson('Actors.json');
g.$dataClasses = loadJson('Classes.json');
g.$dataSkills = loadJson('Skills.json');
g.$dataItems = loadJson('Items.json');
g.$dataWeapons = loadJson('Weapons.json');
g.$dataArmors = loadJson('Armors.json');
g.$dataStates = loadJson('States.json');
g.$dataSystem = loadJson('System.json');

g.$gameTemp = new g.Game_Temp();
g.$gameSystem = new g.Game_System();
g.$gameSwitches = new g.Game_Switches();
g.$gameSwitches.onChange = function() {};
g.$gameVariables = new g.Game_Variables();
g.$gameActors = new g.Game_Actors();
g.$gameParty = new g.Game_Party();
g.$gameParty.initAllItems();
g.$gameParty.setupStartingMembers();

function loadPlugin(p) {
    (0, eval)(fs.readFileSync(path.join(ROOT, 'js/plugins', p), 'utf8'));
}
loadPlugin('MonlineShim.js');
loadPlugin('MonlineScenes.js');

const actor = g.$gameActors.actor(1);        // class 1 "Player"
const skill = g.$dataSkills[11];             // "Pinpoint Strike", <learn cost: 5 jp>

console.log('actor            :', actor.name(), '(class ' + actor._classId + ')');
console.log('skill            : #' + skill.id, skill.name, JSON.stringify(skill.note));
console.log('typeof isLearned :', typeof actor.isLearned);
console.log('typeof isLearnedSkill:', typeof actor.isLearnedSkill);
console.log('');

actor.gainJp(100);
try {
    const r = g.MonlineScenes.canLearn(actor, skill);
    console.log('canLearn ->', r);
} catch (e) {
    console.log('canLearn THREW  :', e.constructor.name + ': ' + e.message);
    console.log('  at:', (e.stack.split('\n')[1] || '').trim());
}
try {
    const r = g.MonlineScenes.enabledFor(actor, skill, [1]);
    console.log('enabledFor ->', r);
} catch (e) {
    console.log('enabledFor THREW:', e.constructor.name + ': ' + e.message);
    console.log('  at:', (e.stack.split('\n')[1] || '').trim());
}
try {
    const r = g.MonlineScenes.learnSkill(actor, skill, 1);
    console.log('learnSkill ->', r, '| learned now:', actor.isLearnedSkill(11));
} catch (e) {
    console.log('learnSkill THREW:', e.constructor.name + ': ' + e.message);
    console.log('  at:', (e.stack.split('\n')[1] || '').trim());
}
// Second skill: exercise the flow on a skill the actor does NOT know yet.
const skill2 = g.$dataSkills[12] || g.$dataSkills[13];
// #12 is switch 23 gated; open the gate so the purchase can actually happen.
g.$gameSwitches.setValue(23, true);
console.log('');
console.log('second skill : #' + skill2.id, skill2.name, JSON.stringify(skill2.note));
try {
    console.log('canLearn    ->', g.MonlineScenes.canLearn(actor, skill2));
    const paid = g.MonlineScenes.learnSkill(actor, skill2, 1);
    console.log('learnSkill  ->', paid, '| learned:', actor.isLearnedSkill(skill2.id),
                '| jp left:', actor.jp(1));
} catch (e) {
    console.log('THREW:', e.constructor.name + ': ' + e.message);
    console.log('  at:', (e.stack.split('\n')[1] || '').trim());
}

console.log('');
console.log('--- no polyfill is installed: typeof actor.isLearned =',
            typeof actor.isLearned, '(expected: undefined) ---');
if (typeof actor.isLearned === 'function') {
    console.log('  !! a polyfill is masking the result');
}
