// Smoke the harness itself: can the real engine + real plugins even load?
const env = require('./qa_jp_env');

let g;
try {
    g = env.build();
} catch (e) {
    console.log('BUILD THREW: ' + e.message);
    console.log(e.stack.split('\n').slice(0, 12).join('\n'));
    process.exit(1);
}
console.log('build ok');
console.log('  Game_Actor?            ' + typeof g.Game_Actor);
console.log('  Game_Enemy?            ' + typeof g.Game_Enemy);
console.log('  Game_Troop?            ' + typeof g.Game_Troop);
console.log('  BattleManager?         ' + typeof g.BattleManager);
console.log('  MonlineJp?             ' + typeof g.MonlineJp);
console.log('  MonlineScenes?         ' + typeof g.MonlineScenes);
console.log('  Game_Actor#gainJp      ' + typeof g.Game_Actor.prototype.gainJp);
console.log('  Game_Actor#gain_jp     ' + typeof g.Game_Actor.prototype.gain_jp);
console.log('  Game_Actor#earnJp      ' + typeof g.Game_Actor.prototype.earnJp);
console.log('  Game_Actor#earn_jp     ' + typeof g.Game_Actor.prototype.earn_jp);
console.log('  Game_Enemy#jp          ' + typeof g.Game_Enemy.prototype.jp);
console.log('  Game_Troop#jpTotal     ' + typeof g.Game_Troop.prototype.jpTotal);
console.log('  BattleManager.gainJp   ' + typeof g.BattleManager.gainJp);
console.log('  Game_Party#members     ' + typeof g.Game_Party.prototype.members);

// is the shim stub still winning?  (it must NOT be)
const body = String(g.Game_Actor.prototype.gain_jp);
console.log('  gain_jp body: ' + body.replace(/\s+/g, ' ').slice(0, 120));

// real data in place?
console.log('  $dataEnemies[1].name   ' + (g.$dataEnemies[1] && g.$dataEnemies[1].name));
console.log('  $dataActors[25].name   ' + (g.$dataActors[25] && g.$dataActors[25].name));

// --- a real battle
const actors = env.setParty(g, [1, 25]);
env.setTroop(g, [1]);
env.kill(g, g.$gameTroop.members()[0]);
console.log('  troop jpTotal          ' + g.$gameTroop.jpTotal());
console.log('  enemy jp               ' + g.$gameTroop.members()[0].jp());
console.log('  party inBattle         ' + g.$gameParty.inBattle());
try {
    g.BattleManager.processVictory();
    console.log('  processVictory ran');
} catch (e) {
    console.log('  processVictory THREW: ' + e.message);
    console.log(e.stack.split('\n').slice(0, 8).join('\n'));
}
console.log('  actor 1 jp             ' + env.jpOf(actors[0]));
console.log('  actor 25 (PXE) jp      ' + env.jpOf(actors[1]));
