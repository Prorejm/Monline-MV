const vm = require('vm');
const env = require('./qa_jp_env');

const g = env.build();
vm.runInContext('Math.random = function(){ return 0; };', g);
const actors = env.setParty(g, [1]);
env.setTroop(g, [1]);
const actor = actors[0];
const enemy = g.$gameTroop.members()[0];
enemy.appear();

const action = new g.Game_Action(actor);
action.setSkill(1);
console.log('isValid      :', action.isValid());
console.log('item().name  :', action.item() && action.item().name);
console.log('itemHit      :', action.itemHit(enemy));
console.log('itemEva      :', action.itemEva(enemy));
console.log('testApply    :', action.testApply(enemy));
const res = enemy.result();
action.apply(enemy);
console.log('used         :', res.used);
console.log('missed       :', res.missed);
console.log('evaded       :', res.evaded);
console.log('isHit        :', res.isHit());
console.log('hpDamage     :', res.hpDamage);

// retry with hit forced
const g2 = env.build();
const a2 = env.setParty(g2, [1]);
env.setTroop(g2, [1]);
const actor2 = a2[0], enemy2 = g2.$gameTroop.members()[0];
enemy2.appear();
g2.Game_Action.prototype.itemHit = function() { return 1; };
g2.Game_Action.prototype.itemEva = function() { return 0; };
const action2 = new g2.Game_Action(actor2);
action2.setSkill(1);
console.log('--- forced hit ---');
console.log('testApply    :', action2.testApply(enemy2));
const res2 = enemy2.result();
action2.apply(enemy2);
console.log('used         :', res2.used);
console.log('missed       :', res2.missed);
console.log('evaded       :', res2.evaded);
console.log('isHit        :', res2.isHit());
