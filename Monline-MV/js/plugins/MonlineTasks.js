//=============================================================================
// MonlineTasks.js
// Quest / task tracking for the Monline port.
//=============================================================================
/*:
 * @plugindesc A quest/task system: take, track, complete and fail tasks; a
 * task screen with type tabs, an on-map tracking HUD, and signs above events.
 * @author Monline port
 *
 * @help
 * Monline 0.9.8 ships no task system of its own, so this is modelled on the
 * one used by "未定型大陆调查记" (XdRs_TaskSystem): the same data shape, the
 * same script API and the same feature set, rewritten for MV.
 *
 * Tasks live in `data/Tasks.json` - a 1-based array, entry 0 is null:
 *
 *   { "id": 1, "name": "...", "type": 0, "difficulty": 1,
 *     "autoFinish": false, "issuer": "", "introduce": "...",
 *     "conditions": [...], "prizes": [...],
 *     "failCode": "", "finishCode": "", "note": "" }
 *
 *   condition: { "type": N, "dataId": id, "demand": n, "text": "", "code": "" }
 *     N  0 gold      1 variable   2 switch      3 actor
 *        4 enemy kills (counted from when the task was taken)
 *        5 item      6 weapon     7 armour      8 code
 *   prize:     { "type": N, "dataId": id, "num": n, "text": "", "code": "" }
 *     N  0 exp       1 gold       2 variable    3 item
 *        4 weapon    5 armour     6 code
 *
 * The 'code' fields (condition 8, prize 6, finishCode, failCode) are evaluated
 * as JavaScript, since that is what MV runs.
 *
 * Script API (also reachable from translated VX Ace script calls):
 *   $gameParty.takeTask(id)            接取任务
 *   $gameParty.completeTask(id[, force])
 *   $gameParty.failTask(id)
 *   $gameParty.restartTask(id)
 *   $gameParty.hasTask(id)
 *   $gameParty.isTaskCompleted(id)
 *   $gameParty.isCompletedBranch(id, n1, n2...)
 *   $gameParty.canTaskComplete(id)
 *   $gameParty.takeRandomTask(id1, id2...)
 *   $gameParty.clearKilledData()
 *   SceneManager.push(Scene_Task)      open the task screen
 *   $gameSystem.setEventSignImg(mapId, eventId, imgName)
 *
 * @param menuEnabled
 * @text Always show in the menu
 * @desc Turn this off to gate the Tasks command behind a switch.
 * @default true
 *
 * @param menuSwitch
 * @text Menu switch
 * @desc When "Always show in the menu" is off, the Tasks command appears only
 * while this switch is ON. 0 disables the gate.
 * @default 0
 *
 * @param infoSwitch
 * @text Toast switch
 * @desc When this switch is ON, taking / completing / failing a task shows a
 * message. 0 disables the messages.
 * @default 0
 *
 * @param trackCount
 * @text Max tracked tasks
 * @default 3
 *
 * @param trackKey
 * @text Tracking key
 * @desc Keyboard code that shows / hides the tracking window (P is 80).
 * @default 80
 *
 * @param trackPos
 * @text Tracking window position
 * @desc x,y of the tracking window.
 * @default 0,200
 *
 * @param taskTypes
 * @text Type names
 * @desc Names for task `type`, in order.
 * @default ["Main","Side"]
 */
var MonlineTasks = MonlineTasks || {};

(function () {
    'use strict';

    var params = PluginManager.parameters('MonlineTasks');
    var CFG = {
        MENU_ALWAYS: String(params.menuEnabled || 'true') === 'true',
        MENU_SWITCH: Number(params.menuSwitch || 0),
        INFO_SWITCH: Number(params.infoSwitch || 0),
        TRACK_COUNT: Math.max(1, Math.min(5, Number(params.trackCount || 3))),
        TRACK_KEY: Number(params.trackKey || 80),
        TRACK_POS: String(params.trackPos || '0,200').split(',').map(Number),
        TYPES: (function () {
            try { return JSON.parse(params.taskTypes || '["Main","Side"]'); }
            catch (e) { return ['Main', 'Side']; }
        })()
    };

    //-------------------------------------------------------------------------
    // data/Tasks.json
    //-------------------------------------------------------------------------
    DataManager._databaseFiles.push({ name: '$dataTasks', src: 'Tasks.json' });

    // The task database is optional: without it every call below no-ops rather
    // than crashing, so a project that has not authored tasks still boots.
    function tasks() { return window.$dataTasks || [null]; }
    MonlineTasks.tasks = tasks;
    MonlineTasks.CFG = CFG;

    /** 0119.rb's `group` spelling, reused for the reward numbers. */
    function group(n) {
        return String(n).replace(/(\d)(?=\d{3}(?:\.|$))(\d{3}\..*)?/, '$1,$2');
    }

    /** `$gameTemp.taskTypes()[type]` - the configured names, 0-based. */
    Game_Temp.prototype.taskTypes = function () {
        return CFG.TYPES;
    };

    //-------------------------------------------------------------------------
    // Game_TaskCondition
    //-------------------------------------------------------------------------
    function Game_TaskCondition() { this.initialize.apply(this, arguments); }
    Game_TaskCondition.prototype.initialize = function (taskId, data) {
        this._taskId = taskId;
        this._data = data;
        this.recordCurrentNum();
    };
    Game_TaskCondition.prototype.recordCurrentNum = function () {
        this._dataNum = this.getCurrentNum();
    };
    // 0 gold 1 variable 2 switch 3 actor 4 kills 5 item 6 weapon 7 armour 8 code
    Game_TaskCondition.prototype.getCurrentNum = function () {
        var id = this._data.dataId;
        switch (this._data.type) {
            case 0: return $gameParty.gold();
            case 1: return $gameVariables.value(id);
            case 2: return $gameSwitches.value(id) ? 1 : 0;
            case 3: return $gameParty.allMembers().some(function (a) {
                        return a.actorId() === id; }) ? 1 : 0;
            case 4: return $gameParty.enemyKilledNums(id);
            case 5: return $gameParty.numItems($dataItems[id]);
            case 6: return $gameParty.numItems($dataWeapons[id]);
            case 7: return $gameParty.numItems($dataArmors[id]);
            case 8: return this.evalCode();
        }
        return 0;
    };
    Game_TaskCondition.prototype.evalCode = function () {
        try {
            /* jshint evil:true */
            return (0, eval)(this._data.code) || 0;
        } catch (e) {
            console.error('[MonlineTasks] condition code, task ' + this._taskId +
                          ': ' + e.message);
            return 0;
        }
    };
    /** Kill counts are counted from the moment the task was taken. */
    Game_TaskCondition.prototype.nowNum = function () {
        if (this._data.type !== 4) { return this.getCurrentNum(); }
        return Math.max(0, this.getCurrentNum() - (this._dataNum || 0));
    };
    Game_TaskCondition.prototype.needNum = function () {
        return this._data.demand || 1;
    };
    Game_TaskCondition.prototype.text = function () {
        var id = this._data.dataId;
        var type = this._data.type;
        if (type === 5) { return itemLabel($dataItems[id]); }
        if (type === 6) { return itemLabel($dataWeapons[id]); }
        if (type === 7) { return itemLabel($dataArmors[id]); }
        switch (type) {
            case 0: return TextManager.currencyUnit;
            case 1: return $dataSystem.variables[id] || ('V' + id);
            case 2: return $dataSystem.switches[id] || ('S' + id);
            case 3: {
                var actor = $dataActors[id];
                return actor ? actor.name : ('Actor ' + id);
            }
            case 4: {
                var enemy = $dataEnemies[id];
                return enemy ? enemy.name : ('Enemy ' + id);
            }
            case 8: return this._data.text || 'Code';
        }
        return '';
    };
    Game_TaskCondition.prototype.numText = function () {
        if (this._data.type === 2 || this._data.type === 3) { return ''; }
        var now = Math.min(this.nowNum(), this.needNum());
        return now + '/' + this.needNum();
    };
    Game_TaskCondition.prototype.barScale = function () {
        return Math.min(1, this.nowNum() / this.needNum());
    };
    Game_TaskCondition.prototype.isSatisfy = function () {
        if (this._data.type === 2 || this._data.type === 3) {
            return this.getCurrentNum() > 0;
        }
        return this.nowNum() >= this.needNum();
    };
    function itemLabel(item) {
        return item ? '\\i[' + item.iconIndex + ']' + item.name : '???';
    }
    window.Game_TaskCondition = Game_TaskCondition;

    //-------------------------------------------------------------------------
    // Game_TaskPrize
    //-------------------------------------------------------------------------
    function Game_TaskPrize() { this.initialize.apply(this, arguments); }
    Game_TaskPrize.prototype.initialize = function (taskId, data) {
        this._taskId = taskId;
        this._data = data;
    };
    Game_TaskPrize.prototype.text = function () {
        var id = this._data.dataId;
        var type = this._data.type;
        if (type === 3) { return itemLabel($dataItems[id]); }
        if (type === 4) { return itemLabel($dataWeapons[id]); }
        if (type === 5) { return itemLabel($dataArmors[id]); }
        switch (type) {
            case 0: return TextManager.exp;
            case 1: return TextManager.currencyUnit;
            case 2: return $dataSystem.variables[id] || ('V' + id);
            case 6: return this._data.text || 'Code';
        }
        return '';
    };
    Game_TaskPrize.prototype.numText = function () {
        var num = this._data.num || 0;
        return num > 0 ? String(num) : '';
    };
    // 0 exp 1 gold 2 variable 3 item 4 weapon 5 armour 6 code
    Game_TaskPrize.prototype.gain = function () {
        var num = this._data.num || 0;
        var id = this._data.dataId;
        switch (this._data.type) {
            case 0:
                $gameParty.members().forEach(function (m) { m.gainExp(num); });
                return;
            case 1: $gameParty.gainGold(num); return;
            case 2:
                $gameVariables.setValue(id, $gameVariables.value(id) + num);
                return;
            case 3: $gameParty.gainItem($dataItems[id], num); return;
            case 4: $gameParty.gainItem($dataWeapons[id], num); return;
            case 5: $gameParty.gainItem($dataArmors[id], num); return;
            case 6:
                try {
                    /* jshint evil:true */
                    (0, eval)(this._data.code);
                } catch (e) {
                    console.error('[MonlineTasks] prize code, task ' +
                                  this._taskId + ': ' + e.message);
                }
                return;
        }
    };
    window.Game_TaskPrize = Game_TaskPrize;

    //-------------------------------------------------------------------------
    // Game_Task
    //-------------------------------------------------------------------------
    // 0 running, 1 ready to hand in, 2 completed, 3 failed
    function Game_Task() { this.initialize.apply(this, arguments); }
    Game_Task.prototype.initialize = function (id) {
        this._id = id;
        this.setup();
    };
    Game_Task.prototype.id = function () { return this._id; };
    Game_Task.prototype.data = function () { return tasks()[this._id]; };
    Game_Task.prototype.setup = function () {
        this._status = 0;
        this._prizes = [];
        this._conditions = [];
        this._identifiers = [];
        var d = this.data() || {};
        (d.prizes || []).forEach(function (p) {
            this._prizes.push(new Game_TaskPrize(this._id, p));
        }, this);
        (d.conditions || []).forEach(function (c) { this.addCondition(c); }, this);
    };
    Game_Task.prototype.runCode = function (sym) {
        var code = (this.data() || {})[sym];
        if (!code) { return; }
        try {
            /* jshint evil:true */
            (0, eval)(code);
        } catch (e) {
            console.error('[MonlineTasks] ' + sym + ', task ' + this._id + ': ' +
                          e.message);
        }
    };
    Game_Task.prototype.name = function () {
        return (this.data() || {}).name || '';
    };
    Game_Task.prototype.type = function () {
        return (this.data() || {}).type || 0;
    };
    Game_Task.prototype.typeText = function () {
        return CFG.TYPES[this.type()] || '';
    };
    Game_Task.prototype.difficulty = function () {
        return (this.data() || {}).difficulty || 1;
    };
    Game_Task.prototype.issuer = function () {
        return (this.data() || {}).issuer || '';
    };
    Game_Task.prototype.introduce = function () {
        return (this.data() || {}).introduce || '';
    };
    Game_Task.prototype.status = function () { return this._status; };
    Game_Task.prototype.statusText = function () {
        return ['Running', 'Ready', 'Done', 'Failed'][this._status] || '';
    };
    Game_Task.prototype.prizes = function () { return this._prizes; };
    Game_Task.prototype.conditions = function () { return this._conditions; };
    Game_Task.prototype.barScale = function () {
        if (this._conditions.length === 0) { return this.isCompleted() ? 1 : 0; }
        var done = this._conditions.filter(function (c) { return c.isSatisfy(); });
        return Math.min(1, done.length / this._conditions.length);
    };
    /** `labels` are 0..3 = status, 4+n = type n. */
    Game_Task.prototype.matchLabels = function (labels) {
        if (!labels || labels.length === 0) { return true; }
        return labels.some(function (lab) {
            if (lab < 4) { return this.status() === lab; }
            return this.type() === lab - 4;
        }, this);
    };
    Game_Task.prototype.again = function () {
        this._status = 0;
        this._conditions.forEach(function (c) { c.recordCurrentNum(); });
        this.refresh();
    };
    Game_Task.prototype.addCondition = function (data, refresh) {
        if (this.isCompleted() || this.isFailed()) { return; }
        this._identifiers.push(data.type + '_' + (data.dataId || 0));
        this._conditions.push(new Game_TaskCondition(this._id, data));
        if (refresh) { this.refresh(); }
    };
    /** Re-evaluate; `idSym` is the "<type>_<id>" of whatever just changed. */
    Game_Task.prototype.refresh = function (idSym) {
        if (this.isCompleted() || this.isFailed()) { return; }
        var relevant = idSym === undefined ||
            this._identifiers.indexOf(idSym) >= 0;
        if (!relevant) { return; }
        $gameTemp.registerTaskRefreshIndex(this._id);
        if (this.canCompleted() && this._status === 0) { this._status = 1; }
        if (this._status === 1 && (this.data() || {}).autoFinish) {
            this.complete();
        }
    };
    Game_Task.prototype.isCompleted = function () { return this._status === 2; };
    Game_Task.prototype.isFailed = function () { return this._status === 3; };
    Game_Task.prototype.canTrack = function () {
        return this._status === 0 || this._status === 1;
    };
    Game_Task.prototype.currentConditionData = function () {
        for (var i = 0; i < this._conditions.length; i++) {
            if (!this._conditions[i].isSatisfy()) {
                return { num: i + 1, cod: this._conditions[i] };
            }
        }
        return null;
    };
    Game_Task.prototype.isCompletedBranch = function () {
        var args = Array.prototype.slice.call(arguments);
        return args.every(function (index) {
            var c = this._conditions[index - 1];
            return c ? c.isSatisfy() : true;
        }, this);
    };
    Game_Task.prototype.canCompleted = function () {
        if (this.isCompleted() || this.isFailed()) { return false; }
        if (this._conditions.length === 0) { return false; }
        return this._conditions.every(function (c) { return c.isSatisfy(); });
    };
    Game_Task.prototype.complete = function (force) {
        if (!force && (this.isCompleted() || this.isFailed())) { return; }
        if (!force && !this.canCompleted()) { return; }
        $gameTemp.registerTaskRefreshIndex(this._id);
        $gameTemp.requestTaskPromptInfo(this.name(), 1);
        this._status = 2;
        this._prizes.forEach(function (p) { p.gain(); });
        this.runCode('finishCode');
        $gameSystem.cancelTaskTracking(this._id);
    };
    Game_Task.prototype.fail = function () {
        if (this.isCompleted() || this.isFailed()) { return; }
        $gameTemp.registerTaskRefreshIndex(this._id);
        $gameTemp.requestTaskPromptInfo(this.name(), 2);
        this._status = 3;
        this.runCode('failCode');
        $gameSystem.cancelTaskTracking(this._id);
    };
    window.Game_Task = Game_Task;

    //-------------------------------------------------------------------------
    // Game_Temp - the refresh queue and the toast queue
    //-------------------------------------------------------------------------
    var _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function () {
        _Game_Temp_initialize.call(this);
        this._taskRefreshQueue = [];
        this._taskPromptInfos = [];
        this._taskNeedRefresh = false;
    };
    Game_Temp.prototype.isTaskNeedRefresh = function () {
        return this._taskNeedRefresh;
    };
    Game_Temp.prototype.setTaskNeedRefresh = function (state) {
        this._taskNeedRefresh = !!state;
        if (this._taskNeedRefresh) { this._taskRefreshQueue.length = 0; }
    };
    Game_Temp.prototype.registerTaskRefreshIndex = function (id) {
        var q = this._taskRefreshQueue;
        if (q.indexOf(id) < 0) { q.push(id); }
        this._taskNeedRefresh = true;
    };
    /** 0 = taken, 1 = completed, 2 = failed. */
    Game_Temp.prototype.requestTaskPromptInfo = function (name, kind) {
        this._taskPromptInfos.push({ name: name, kind: kind });
    };
    Game_Temp.prototype.shiftTaskPromptInfo = function () {
        return this._taskPromptInfos.shift() || null;
    };
    Game_Temp.prototype.clearTaskPromptInfo = function () {
        this._taskPromptInfos.length = 0;
    };

    //-------------------------------------------------------------------------
    // Game_System - tracking list and event signs
    //-------------------------------------------------------------------------
    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _Game_System_initialize.call(this);
        this._trackedTasks = [];
        this._taskSigns = {};
        this._taskTrackerVisible = true;
    };
    Game_System.prototype.isTaskEnabled = function () {
        if (CFG.MENU_ALWAYS) { return true; }
        return CFG.MENU_SWITCH > 0 && $gameSwitches.value(CFG.MENU_SWITCH);
    };
    Game_System.prototype.trackedTasks = function () {
        if (!this._trackedTasks) { this._trackedTasks = []; }
        return this._trackedTasks;
    };
    Game_System.prototype.isTaskTracked = function (taskId) {
        return this.trackedTasks().indexOf(taskId) >= 0;
    };
    Game_System.prototype.trackTask = function (taskId) {
        var list = this.trackedTasks();
        if (list.indexOf(taskId) >= 0) { return true; }
        if (list.length >= CFG.TRACK_COUNT) { return false; }
        list.push(taskId);
        return true;
    };
    Game_System.prototype.cancelTaskTracking = function (taskId) {
        var list = this.trackedTasks();
        var i = list.indexOf(taskId);
        if (i >= 0) { list.splice(i, 1); }
    };
    Game_System.prototype.isTaskTrackerVisible = function () {
        return this._taskTrackerVisible !== false;
    };
    Game_System.prototype.setTaskTrackerVisible = function (v) {
        this._taskTrackerVisible = !!v;
    };
    Game_System.prototype.toggleTaskTracker = function () {
        this.setTaskTrackerVisible(!this.isTaskTrackerVisible());
        return this.isTaskTrackerVisible();
    };
    /** Signs are keyed "mapId_eventId" (0120-style event head pictures). */
    Game_System.prototype.eventSignImg = function (mapId, eventId) {
        if (!this._taskSigns) { this._taskSigns = {}; }
        return this._taskSigns[mapId + '_' + eventId] || '';
    };
    Game_System.prototype.setEventSignImg = function (mapId, eventId, imgName) {
        if (!this._taskSigns) { this._taskSigns = {}; }
        this._taskSigns[mapId + '_' + eventId] = imgName;
    };
    Game_System.prototype.clearEventSign = function (mapId, eventId) {
        if (!this._taskSigns) { this._taskSigns = {}; }
        delete this._taskSigns[mapId + '_' + eventId];
    };

    //-------------------------------------------------------------------------
    // Game_Party - the task list
    //-------------------------------------------------------------------------
    var _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function () {
        _Game_Party_initialize.call(this);
        this._tasks = {};
        this._killedEnemies = {};
    };
    Game_Party.prototype.allTasks = function () {
        if (!this._tasks) { this._tasks = {}; }
        return this._tasks;
    };
    Game_Party.prototype.killedEnemies = function () {
        if (!this._killedEnemies) { this._killedEnemies = {}; }
        return this._killedEnemies;
    };
    Game_Party.prototype.clearKilledData = function () {
        this._killedEnemies = {};
    };
    Game_Party.prototype.enemyKilledNums = function (enemyId) {
        return this.killedEnemies()[enemyId] || 0;
    };
    Game_Party.prototype.recordEnemyKilled = function (enemyId, num) {
        var k = this.killedEnemies();
        k[enemyId] = (k[enemyId] || 0) + (num || 1);
        this.refreshTasks('4_' + enemyId);
    };
    Game_Party.prototype.hasTask = function (taskId) {
        return !!this.allTasks()[taskId];
    };
    Game_Party.prototype.task = function (taskId) {
        if (!this.hasTask(taskId)) {
            if (!tasks()[taskId]) { return null; }
            this._tasks[taskId] = new Game_Task(taskId);
        }
        return this._tasks[taskId];
    };
    /** 接取任务 */
    Game_Party.prototype.takeTask = function (taskId) {
        var t = this.task(taskId);
        if (!t) { return false; }
        $gameTemp.requestTaskPromptInfo(t.name(), 0);
        this.refreshTasks();
        return true;
    };
    Game_Party.prototype.takeRandomTask = function () {
        var args = Array.prototype.slice.call(arguments).filter(function (id) {
            return id && !this.hasTask(id);
        }, this);
        if (args.length === 0) { return false; }
        return this.takeTask(args[Math.floor(Math.random() * args.length)]);
    };
    Game_Party.prototype.addTaskCondition = function (taskId, data) {
        var t = this.task(taskId);
        if (t) { t.addCondition(data, true); }
    };
    Game_Party.prototype.isTaskCompleted = function (taskId) {
        var t = this.allTasks()[taskId];
        return !!t && t.isCompleted();
    };
    Game_Party.prototype.isCompletedBranch = function (taskId) {
        var t = this.allTasks()[taskId];
        if (!t) { return false; }
        return t.isCompletedBranch.apply(t, Array.prototype.slice.call(arguments, 1));
    };
    Game_Party.prototype.canTaskComplete = function (taskId) {
        var t = this.allTasks()[taskId];
        return !!t && t.canCompleted();
    };
    Game_Party.prototype.completeTask = function (taskId, force) {
        var t = this.allTasks()[taskId];
        if (t) { t.complete(force); }
    };
    Game_Party.prototype.failTask = function (taskId) {
        var t = this.allTasks()[taskId];
        if (t) { t.fail(); }
    };
    Game_Party.prototype.restartTask = function (taskId) {
        var t = this.allTasks()[taskId];
        if (t) { t.again(); }
    };
    Game_Party.prototype.acceptedTasks = function () {
        var self = this;
        return Object.keys(this.allTasks()).map(function (id) {
            return self.allTasks()[id];
        });
    };
    /** Re-check every tracked task; `idSym` limits it to one kind of change. */
    Game_Party.prototype.refreshTasks = function (idSym) {
        this.acceptedTasks().forEach(function (t) { t.refresh(idSym); });
        this.consumeTaskRefresh();
    };
    Game_Party.prototype.consumeTaskRefresh = function () {
        if (!$gameTemp.isTaskNeedRefresh()) { return; }
        $gameTemp.setTaskNeedRefresh(false);
        // the tracker watches this counter instead of polling every task
        MonlineTasks.refreshStamp = (MonlineTasks.refreshStamp || 0) + 1;
    };

    // Anything that feeds a condition tells the task list to re-check.
    var _Game_Party_gainGold = Game_Party.prototype.gainGold;
    Game_Party.prototype.gainGold = function (amount) {
        _Game_Party_gainGold.call(this, amount);
        if (window.$gameParty) { this.refreshTasks('0_0'); }
    };
    var _Game_Party_gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
        _Game_Party_gainItem.call(this, item, amount, includeEquip);
        if (!item) { return; }
        if (window.$gameParty) { this.refreshTasks(this.itemSym(item)); }
    };
    var _Game_Party_loseItem = Game_Party.prototype.loseItem;
    Game_Party.prototype.loseItem = function (item, amount, includeEquip) {
        _Game_Party_loseItem.call(this, item, amount, includeEquip);
        if (!item) { return; }
        if (window.$gameParty) { this.refreshTasks(this.itemSym(item)); }
    };
    Game_Party.prototype.itemSym = function (item) {
        if (DataManager.isItem(item)) { return '5_' + item.id; }
        if (DataManager.isWeapon(item)) { return '6_' + item.id; }
        if (DataManager.isArmor(item)) { return '7_' + item.id; }
        return undefined;
    };
    var _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function (actorId) {
        _Game_Party_addActor.call(this, actorId);
        if (window.$gameParty) { this.refreshTasks('3_' + actorId); }
    };
    var _Game_Switches_setValue = Game_Switches.prototype.setValue;
    Game_Switches.prototype.setValue = function (switchId, value) {
        _Game_Switches_setValue.call(this, switchId, value);
        if (window.$gameParty) { $gameParty.refreshTasks('2_' + switchId); }
    };
    var _Game_Variables_setValue = Game_Variables.prototype.setValue;
    Game_Variables.prototype.setValue = function (variableId, value) {
        _Game_Variables_setValue.call(this, variableId, value);
        if (window.$gameParty) { $gameParty.refreshTasks('1_' + variableId); }
    };
    // A fresh party has empty tables (e.g. right after a load).
    Game_Party.prototype.allTasksSafe = function () {
        if (!this._tasks) { this._tasks = {}; }
        if (!this._killedEnemies) { this._killedEnemies = {}; }
        return this._tasks;
    };

    // kills are recorded when a battle is won
    var _BattleManager_processVictory = BattleManager.processVictory;
    BattleManager.processVictory = function () {
        $gameTroop.members().forEach(function (enemy) {
            if (enemy && enemy.isDead()) {
                $gameParty.recordEnemyKilled(enemy.enemyId(), 1);
            }
        });
        _BattleManager_processVictory.call(this);
    };

    //-------------------------------------------------------------------------
    // Window_MenuCommand - the Tasks entry
    //-------------------------------------------------------------------------
    var _MenuCommand_addOriginalCommands =
        Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function () {
        _MenuCommand_addOriginalCommands.call(this);
        if (!$gameSystem.isTaskEnabled()) { return; }
        this.addCommand('Tasks', 'monlineTasks', true);
    };
    var _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler('monlineTasks', this.commandTasks.bind(this));
    };
    Scene_Menu.prototype.commandTasks = function () {
        SceneManager.push(Scene_Task);
    };

    //-------------------------------------------------------------------------
    // Window_TaskLabel - the type / status tabs down the left (0119.rb layout)
    //-------------------------------------------------------------------------
    function Window_TaskLabel() { this.initialize.apply(this, arguments); }
    Window_TaskLabel.prototype = Object.create(Window_Command.prototype);
    Window_TaskLabel.prototype.constructor = Window_TaskLabel;

    Window_TaskLabel.prototype.initialize = function () {
        // Window_Command#initialize calls refresh() -> drawItem before it
        // returns, so the label list has to exist first.
        this._labels = [];
        this.multiLabel = true;
        Window_Command.prototype.initialize.call(this, 0, 70);
    };
    Window_TaskLabel.prototype.windowWidth = function () { return 58; };
    Window_TaskLabel.prototype.windowHeight = function () { return 120; };
    Window_TaskLabel.prototype.numVisibleRows = function () {
        return Math.ceil(this.maxItems() / this.maxCols());
    };
    Window_TaskLabel.prototype.maxCols = function () { return 1; };
    Window_TaskLabel.prototype.itemHeight = function () { return 24; };
    Window_TaskLabel.prototype.makeCommandList = function () {
        var i;
        for (i = 0; i < 4; i++) {
            this.addCommand(['Run', 'Ready', 'Done', 'Fail'][i], 'status', true, i);
        }
        for (i = 0; i < CFG.TYPES.length; i++) {
            this.addCommand(CFG.TYPES[i], 'type', true, 4 + i);
        }
    };
    Window_TaskLabel.prototype.labels = function () { return this._labels; };
    Window_TaskLabel.prototype.toggleLabel = function (index) {
        if (!this.multiLabel) { this._labels = []; }
        var i = this._labels.indexOf(index);
        if (i >= 0) { this._labels.splice(i, 1); }
        else { this._labels.push(index); }
        if (!this.multiLabel && this._labels.length > 1) {
            this._labels = [index];
        }
    };
    Window_TaskLabel.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        var on = this._labels.indexOf(this._list[index].ext) >= 0;
        this.changeTextColor(on ? this.textColor(6) : this.normalColor());
        this.drawText(this.commandName(index).slice(0, 4), rect.x, rect.y,
                      rect.width);
    };
    Window_TaskLabel.prototype.itemRectForText = function (index) {
        var rect = Window_Command.prototype.itemRectForText.call(this, index);
        rect.x += 4;
        rect.width -= 8;
        return rect;
    };

    //-------------------------------------------------------------------------
    // Window_TaskList
    //-------------------------------------------------------------------------
    function Window_TaskList() { this.initialize.apply(this, arguments); }
    Window_TaskList.prototype = Object.create(Window_Selectable.prototype);
    Window_TaskList.prototype.constructor = Window_TaskList;

    Window_TaskList.prototype.initialize = function () {
        // Window_Selectable#initialize ends in deactivate() -> reselect() ->
        // ensureCursorVisible() -> maxItems(), so the item array has to exist
        // before the super call.
        this._data = [];
        Window_Selectable.prototype.initialize.call(this, 0, 190, 326,
                                                    Graphics.boxHeight - 190);
        this.refresh();
        this.setTopRow(0);
        this.select(0);
        this.activate();
    };
    Window_TaskList.prototype.setLabelWindow = function (labelWindow) {
        this._labelWindow = labelWindow;
    };
    Window_TaskList.prototype.makeItemList = function () {
        var labels = this._labelWindow ? this._labelWindow.labels() : [];
        var self = this;
        this._data = $gameParty.acceptedTasks().filter(function (t) {
            return t.matchLabels(labels);
        });
        this._data.sort(function (a, b) {
            return a.id() - b.id();
        });
        // Window_Selectable starts at _index -1, so nothing would be selected
        // until the player happened to press a direction key.
        if (this._data.length === 0) { this._index = -1; }
        else { this._index = Math.max(0, Math.min(this._index, this._data.length - 1)); }
    };
    Window_TaskList.prototype.task = function (index) {
        if (index === undefined) { index = this.index(); }
        return this._data[index] || null;
    };
    Window_TaskList.prototype.maxItems = function () { return this._data.length; };
    Window_TaskList.prototype.maxCols = function () { return 1; };
    Window_TaskList.prototype.itemHeight = function () { return 36; };
    Window_TaskList.prototype.refresh = function () {
        this.makeItemList();
        this.createContents();
        this.drawAllItems();
    };
    Window_TaskList.prototype.drawItem = function (index) {
        var task = this._data[index];
        if (!task) { return; }
        var rect = this.itemRect(index);
        var sx = this.textPadding();
        this.changePaintOpacity(task.canTrack());
        // ...this build's drawGauge is (x, y, width, rate, c1, c2) - there is no
        // height argument, and passing one would land a number in color1.
        this.drawGauge(rect.x + 4, rect.y, rect.width - 8,
                       task.barScale(), this.hpGaugeColor1(),
                       this.hpGaugeColor2());
        this.changeTextColor(this.normalColor());
        this.drawText(task.name(), rect.x + 4, rect.y, rect.width - 8);
        this.changePaintOpacity(true);
    };

    //-------------------------------------------------------------------------
    // Window_TaskInfo
    //-------------------------------------------------------------------------
    function Window_TaskInfo() { this.initialize.apply(this, arguments); }
    Window_TaskInfo.prototype = Object.create(Window_Base.prototype);
    Window_TaskInfo.prototype.constructor = Window_TaskInfo;

    Window_TaskInfo.prototype.initialize = function (listWindow) {
        Window_Base.prototype.initialize.call(
            this, 326, 70, Graphics.boxWidth - 326, Graphics.boxHeight - 120);
        this._listWindow = listWindow;
        this._taskId = -1;
        this.refresh();
    };
    Window_TaskInfo.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        var task = this._listWindow.task();
        var id = task ? task.id() : -1;
        if (this._taskId === id) { return; }
        this._taskId = id;
        this.refresh();
    };
    Window_TaskInfo.prototype.refresh = function () {
        this.contents.clear();
        this.resetFontSettings();
        var task = this._listWindow.task();
        if (!task) { return; }
        var w = this.contentsWidth();
        this.changeTextColor(this.systemColor());
        this.drawText(task.typeText(), 0, 0, w);
        this.changeTextColor(this.normalColor());
        this.drawText(task.name(), 0, this.lineHeight(), w);
        this.drawText(task.statusText(), 0, 0, w, 'right');
        var y = this.lineHeight() * 2;
        if (task.issuer()) {
            this.changeTextColor(this.systemColor());
            this.drawText('Client', 0, y, w);
            this.changeTextColor(this.normalColor());
            this.drawText(task.issuer(), this.textWidth('Client '), y, w);
            y += this.lineHeight();
        }
        // The description is wrapped, and this build's drawTextEx hands back
        // the finishing x rather than the finishing y - so measure first.
        var intro = task.introduce();
        if (intro) {
            var textState = { index: 0, x: 0, y: y, left: 0 };
            textState.text = this.convertEscapeCharacters(intro);
            textState.height = this.calcTextHeight(textState, false);
            this.drawTextEx(intro, 0, y);
            y += textState.height;
        }
        y = Math.max(y, this.lineHeight() * 4);
        y += this.lineHeight() / 2;
        this.changeTextColor(this.systemColor());
        this.drawText('Conditions', 0, y, w);
        y += this.lineHeight();
        if (task.conditions().length === 0) {
            this.changeTextColor(this.normalColor());
            this.drawText('-', 0, y, w);
            y += this.lineHeight();
        }
        task.conditions().forEach(function (c, i) {
            var rect = new Rectangle(0, y, w, this.lineHeight());
            this.changeTextColor(c.isSatisfy() ? this.textColor(6)
                                               : this.normalColor());
            this.drawText((i + 1) + '. ' + c.text(), 0, y, w - 80);
            this.drawText(c.numText(), 0, y, w, 'right');
            y += this.lineHeight();
        }, this);
        y += this.lineHeight() / 2;
        this.changeTextColor(this.systemColor());
        this.drawText('Rewards', 0, y, w);
        y += this.lineHeight();
        if (task.prizes().length === 0) {
            this.changeTextColor(this.normalColor());
            this.drawText('-', 0, y, w);
        }
        task.prizes().forEach(function (p) {
            this.changeTextColor(this.normalColor());
            this.drawTextEx(p.text(), 0, y);
            this.drawText(p.numText(), 0, y, w, 'right');
            y += this.lineHeight();
        }, this);
    };

    //-------------------------------------------------------------------------
    // Scene_Task
    //-------------------------------------------------------------------------
    function Scene_Task() { this.initialize.apply(this, arguments); }
    Scene_Task.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Task.prototype.constructor = Scene_Task;

    Scene_Task.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        this.createTitleWindow();
        this.createLabelWindow();
        this.createListWindow();
        this.createInfoWindow();
    };
    Scene_Task.prototype.createTitleWindow = function () {
        this._titleWindow = new Window_Base(0, 0, 326, 70);
        this.addWindow(this._titleWindow);
        var w = this._titleWindow;
        w.contents.fontSize = 24;
        w.changeTextColor(w.normalColor());
        w.drawText('Tasks', 0, 0, w.contentsWidth(), 'center');
        w.resetFontSettings();
    };
    Scene_Task.prototype.createLabelWindow = function () {
        this._labelWindow = new Window_TaskLabel();
        this._labelWindow.setHandler('ok', this.onLabelOk.bind(this));
        this._labelWindow.setHandler('cancel', this.onLabelCancel.bind(this));
        this._labelWindow._onRight = this.onLabelRight.bind(this);
        this.addWindow(this._labelWindow);
    };
    Scene_Task.prototype.onLabelRight = function () {
        if (this._listWindow.maxItems() === 0) {
            this._labelWindow.activate();
            return;
        }
        this._listWindow.activate();
    };
    Scene_Task.prototype.createListWindow = function () {
        this._listWindow = new Window_TaskList();
        this._listWindow.setLabelWindow(this._labelWindow);
        this._listWindow.setHandler('ok', this.onListOk.bind(this));
        this._listWindow.setHandler('cancel', this.onListCancel.bind(this));
        this._listWindow._onLeft = this.onListCancel.bind(this);
        this.addWindow(this._listWindow);
    };
    Scene_Task.prototype.createInfoWindow = function () {
        this._infoWindow = new Window_TaskInfo(this._listWindow);
        this.addWindow(this._infoWindow);
        this._helpWindow = new Window_Base(0, Graphics.boxHeight - 50,
                                           326, 50);
        this.addWindow(this._helpWindow);
        this.refreshHelp();
    };
    Scene_Task.prototype.refreshHelp = function () {
        var w = this._helpWindow;
        var task = this._listWindow.task();
        var text;
        if (task && task.canCompleted()) { text = 'Enter: complete'; }
        else if (task) { text = 'Enter: track/untrack'; }
        else { text = 'No task selected'; }
        w.contents.clear();
        w.changeTextColor(w.systemColor());
        w.drawText(text, 0, 0, w.contentsWidth());
    };
    Scene_Task.prototype.start = function () {
        Scene_MenuBase.prototype.start.call(this);
        this._labelWindow.activate();
        this._listWindow.deactivate();
    };
    Scene_Task.prototype.update = function () {
        Scene_MenuBase.prototype.update.call(this);
        if (this._listWindow.active) { this.refreshHelp(); }
    };
    // tabs
    Scene_Task.prototype.onLabelOk = function () {
        this._labelWindow.toggleLabel(this._labelWindow.currentExt());
        this._labelWindow.refresh();
        this._labelWindow.activate();
        this._listWindow.refresh();
        this._infoWindow.refresh();
    };
    Scene_Task.prototype.onLabelCancel = function () {
        this.popScene();
    };
    // list
    Scene_Task.prototype.onListOk = function () {
        var task = this._listWindow.task();
        if (!task) { this._listWindow.activate(); return; }
        if (task.canCompleted()) {
            $gameParty.completeTask(task.id());
        } else if ($gameSystem.isTaskTracked(task.id())) {
            $gameSystem.cancelTaskTracking(task.id());
        } else if (!$gameSystem.trackTask(task.id())) {
            SoundManager.playBuzzer();
        } else {
            SoundManager.playOk();
        }
        this._listWindow.refresh();
        this._listWindow.activate();
        this._infoWindow.refresh();
    };
    Scene_Task.prototype.onListCancel = function () {
        this._listWindow.deactivate();
        this._labelWindow.activate();
    };

    // right on the tab strip drops into the list, left comes back out
    Window_TaskLabel.prototype.cursorRight = function () {
        if (!this._onRight) { return; }
        this.deactivate();
        this._onRight();
    };
    Window_TaskList.prototype.cursorLeft = function () {
        if (!this._onLeft) { return; }
        this.deactivate();
        this._onLeft();
    };

    //-------------------------------------------------------------------------
    // Window_TaskTracker - the on-map HUD
    //-------------------------------------------------------------------------
    function Window_TaskTracker() { this.initialize.apply(this, arguments); }
    Window_TaskTracker.prototype = Object.create(Window_Base.prototype);
    Window_TaskTracker.prototype.constructor = Window_TaskTracker;

    Window_TaskTracker.prototype.initialize = function () {
        var x = CFG.TRACK_POS[0] || 0;
        var y = CFG.TRACK_POS[1] || 0;
        var h = this.fittingHeight(CFG.TRACK_COUNT * 2 + 1);
        Window_Base.prototype.initialize.call(this, x, y, 320, h);
        this.opacity = 160;
        this.refresh();
    };
    Window_TaskTracker.prototype.refresh = function () {
        this.contents.clear();
        this.resetFontSettings();
        var w = this.contentsWidth();
        this.changeTextColor(this.systemColor());
        this.drawText('Tasks', 0, 0, w);
        var y = this.lineHeight();
        var tracked = $gameSystem.trackedTasks();
        if (tracked.length === 0) {
            this.changeTextColor(this.normalColor());
            this.drawText('-', 8, y, w);
            return;
        }
        tracked.forEach(function (taskId) {
            var task = $gameParty.allTasks()[taskId];
            if (!task) { return; }
            var cur = task.currentConditionData();
            this.changeTextColor(this.normalColor());
            this.drawText(task.name(), 8, y, w - 16);
            y += this.lineHeight() - 6;
            var text = cur ? ('  ' + cur.cod.text() + '  ' + cur.cod.numText())
                           : '  Ready';
            this.changeTextColor(cur ? this.textColor(6) : this.textColor(6));
            this.drawText(text, 8, y, w - 16);
            y += this.lineHeight();
        }, this);
    };
    Window_TaskTracker.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        // redraw only when the tracked set or some task's progress moved
        var key = $gameSystem.trackedTasks().join(',') + '|' +
                  (MonlineTasks.refreshStamp || 0);
        if (this._lastKey === key) { return; }
        this._lastKey = key;
        this.refresh();
    };

    Scene_Map.prototype.createTaskTracker = function () {
        this._taskTracker = new Window_TaskTracker();
        this._taskTracker.z = 200;
        this.addWindow(this._taskTracker);
    };
    var _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects = function () {
        _Scene_Map_createDisplayObjects.call(this);
        this.createTaskTracker();
        this.createTaskSigns();
    };
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        if (this._taskTracker) {
            // the HUD hides while the story is talking - an overlay fighting
            // the message window (e.g. the intro narration) reads as a bug
            this._taskTracker.visible = $gameSystem.isTaskTrackerVisible() &&
                !$gameMessage.isBusy();
        }
        if (CFG.TRACK_KEY > 0 && Input.isTriggered('monlineTaskTrack')) {
            $gameSystem.toggleTaskTracker();
            SoundManager.playOk();
        }
    };
    if (CFG.TRACK_KEY > 0) {
        Input.keyMapper[CFG.TRACK_KEY] = 'monlineTaskTrack';
    }

    //-------------------------------------------------------------------------
    // Event signs
    //-------------------------------------------------------------------------
    function Sprite_TaskSign() { this.initialize.apply(this, arguments); }
    Sprite_TaskSign.prototype = Object.create(Sprite.prototype);
    Sprite_TaskSign.prototype.constructor = Sprite_TaskSign;

    Sprite_TaskSign.prototype.initialize = function (event) {
        Sprite.prototype.initialize.call(this);
        this._event = event;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this._lastName = '';
        this.update();
    };
    Sprite_TaskSign.prototype.update = function () {
        Sprite.prototype.update.call(this);
        var name = $gameSystem.eventSignImg($gameMap.mapId(),
                                            this._event.eventId());
        if (name !== this._lastName) {
            this._lastName = name;
            if (!name) {
                this.bitmap = null;
                this.visible = false;
            } else {
                this.bitmap = ImageManager.loadPicture(name);
                this.visible = true;
            }
        }
        if (!this.visible) { return; }
        // stand the sign on top of the walking graphic
        this.x = this._event.screenX();
        this.y = this._event.screenY() - 24;
        this.z = this._event.screenZ() + 1;
    };
    Scene_Map.prototype.createTaskSigns = function () {
        this._taskSigns = [];
        var self = this;
        $gameMap.events().forEach(function (ev) {
            if (!ev) { return; }
            var sign = new Sprite_TaskSign(ev);
            self._spriteset.addChild(sign);
            self._taskSigns.push(sign);
        });
    };

    //-------------------------------------------------------------------------
    // Toasts: taking / completing / failing a task
    //-------------------------------------------------------------------------
    var _Scene_Map_updateTaskToasts = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_updateTaskToasts.call(this);
        if (this._taskToastBusy) { return; }
        if (CFG.INFO_SWITCH > 0 && !$gameSwitches.value(CFG.INFO_SWITCH)) {
            $gameTemp.clearTaskPromptInfo();
            return;
        }
        var info = $gameTemp.shiftTaskPromptInfo();
        if (!info) { return; }
        var verb = ['Accepted: ', 'Completed: ', 'Failed: '][info.kind] || '';
        $gameMessage.add(verb + info.name);
    };

    //-------------------------------------------------------------------------
    // Ruby bridge - the VX Ace spellings the event scripts would use
    //-------------------------------------------------------------------------
    MonlineTasks.installRubyBridge = function () {
        var F = window.MonlineRuby && window.MonlineRuby.F;
        if (!F) { return false; }
        F.take_task = function (id) { return $gameParty.takeTask(id); };
        F.complete_task = function (id, force) {
            $gameParty.completeTask(id, force);
        };
        F.fail_task = function (id) { $gameParty.failTask(id); };
        F.restart_task = function (id) { $gameParty.restartTask(id); };
        F.has_task = function (id) { return $gameParty.hasTask(id); };
        F.is_task_completed = function (id) {
            return $gameParty.isTaskCompleted(id);
        };
        F.is_completed_branch = function () {
            return $gameParty.isCompletedBranch.apply($gameParty, arguments);
        };
        F.can_task_complete = function (id) {
            return $gameParty.canTaskComplete(id);
        };
        F.take_random_task = function () {
            return $gameParty.takeRandomTask.apply($gameParty, arguments);
        };
        F.clear_killed_data = function () { $gameParty.clearKilledData(); };
        F.set_event_sign = function (mapId, eventId, img) {
            $gameSystem.setEventSignImg(mapId, eventId, img);
        };
        F.open_task_scene = function () { SceneManager.push(Scene_Task); };
        return true;
    };
    MonlineTasks.installRubyBridge();

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    MonlineTasks.Game_Task = Game_Task;
    MonlineTasks.Game_TaskCondition = Game_TaskCondition;
    MonlineTasks.Game_TaskPrize = Game_TaskPrize;
    MonlineTasks.Window_TaskLabel = Window_TaskLabel;
    MonlineTasks.Window_TaskList = Window_TaskList;
    MonlineTasks.Window_TaskInfo = Window_TaskInfo;
    MonlineTasks.Window_TaskTracker = Window_TaskTracker;
    MonlineTasks.group = group;
    window.MonlineTasks = MonlineTasks;
    window.Game_Task = Game_Task;
    window.Game_TaskCondition = Game_TaskCondition;
    window.Game_TaskPrize = Game_TaskPrize;
    window.Scene_Task = Scene_Task;
    window.Window_TaskLabel = Window_TaskLabel;
    window.Window_TaskList = Window_TaskList;
    window.Window_TaskInfo = Window_TaskInfo;
    window.Window_TaskTracker = Window_TaskTracker;
    window.Sprite_TaskSign = Sprite_TaskSign;

    console.log('[MonlineTasks] loaded');
})();
