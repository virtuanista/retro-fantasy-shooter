/* GameManager: estado general de la partida, máquina de estados, menús
 * (título, opciones, controles, récords, tienda, equipamiento, pausa),
 * récords persistentes y modo de depuración. Sin dependencias de render. */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  const store = {
    get(k, d) { try { const v = root.localStorage && root.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { root.localStorage && root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  RFS.store = store;

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.cfg = RFS.CONFIG;
      this.t = 0;
      this.debug = { enabled: !!opts.debug, invincible: false };
      this.hooks = opts.hooks || {};
      this.settings = Object.assign({ music: 0.55, sfx: 0.7, scale: 0 }, store.get('rfs.settings', {}));
      if (this.settings.bindings && this.settings.bindingsV === 2) RFS.Input.bindings = Object.assign(RFS.Input.bindings, this.settings.bindings);
      RFS.Audio.setVolumes(this.settings.music, this.settings.sfx);
      this.records = store.get(this.cfg.records.key, []);
      this.notices = []; this.fx = []; this.shake = 0; this.flashT = 0;
      this.menu = { i: 0 };
      this.W = 2048; this.camX = 0; this.level = this.cfg.levels[0];
      this.enemies = []; this.shots = []; this.bombs = []; this.ebullets = []; this.coins = []; this.bases = []; this.hazards = [];
      this.player = RFS.PlayerController.create(0, 100);
      this.inv = new RFS.EquipmentInventory();
      this.setState('title');
      this.playMusic('title', this.cfg.music.title);
    }

    // ------------------------------------------------------------------ util
    setState(s) { this.prevState = this.state; this.state = s; this.stateT = 0; }
    notice(text) { this.notices.push({ text, t: 0 }); if (this.notices.length > 3) this.notices.shift(); }
    popText(x, y, text, kind) { this.fx.push({ type: 'text', x, y, text, kind, t: 0, life: 40 }); }
    playMusic(key, spec) { RFS.Audio.playMusic(key, spec); }
    saveSettings() { this.settings.bindings = RFS.Input.bindings; this.settings.bindingsV = 2; store.set('rfs.settings', this.settings); }

    newGame(startIdx) {
      this.money = 0; this.score = 0; this.lives = this.cfg.player.startLives;
      this.inv = new RFS.EquipmentInventory(); this.econ = new RFS.EconomyManager();
      this.stats = { kills: 0, bases: 0, coins: 0, shots: 0, bombs: 0, deaths: 0, purchases: 0, bossDamage: 0, bossesDefeated: 0, startFrame: this.t };
      this.gameOverT = 0; this.recordSaved = false; this.newRecordRank = -1;
      RFS.StageManager.load(this, startIdx || 0);
    }

    // ------------------------------------------------------------- eventos
    onAllBasesDestroyed() {
      this.spawnsStopped = true; this.balloon = null; this.token = null;
      this.setState('bosswarn'); this.warnT = 0;
      RFS.Audio.stopMusic(); RFS.Audio.sfx('warning');
    }
    onBossDefeated(b) {
      const L = this.level, C = this.cfg;
      this.stats.bossesDefeated++;
      this.score += C.score.bossMult * b.maxHp;
      const cx = U.mod(this.camX + C.screen.w / 2, this.W);
      RFS.CurrencySystem.rain(this, cx, C.coins.bossRainCount * (b.final ? 2 : 1), b.def.reward * L.rewardMult);
      this.setState('coinrain'); this.rainT = C.coins.bossRainDuration;
      this.lastBoss = b;
      if (L.gauntlet) {
        this.gIdx++;
        if (!b.final && this.gIdx % C.gauntlet.shopEvery === 0) RFS.ShopController.spawnBalloon(this, true);
      }
      RFS.Audio.stopMusic(); RFS.Audio.sfx('clear');
      this.notice(b.name + ' DERROTADO');
    }
    openShop() {
      this.setState('shop'); this.shopCur = { c: 0, r: 0 }; this.shopMsg = '';
      RFS.Audio.sfx('shop'); this.playMusic('shop', this.cfg.music.shop);
    }
    closeShop() {
      this.setState(this.prevReturn || 'play'); this.player.invuln = Math.max(this.player.invuln, 60);
      this.resumeMusic();
    }
    openEquip() {
      this.returnState = this.state; this.setState('equip'); this.equipCur = 0; RFS.Audio.sfx('power');
    }
    resumeMusic() {
      if (this.boss) this.playMusic(this.boss.final ? 'final' : 'boss', this.boss.final ? this.cfg.music.final : this.cfg.music.boss);
      else if (this.state === 'play' || this.state === 'coinrain') this.playMusic('level' + this.level.id, this.level.music);
    }
    gameOver() {
      this.setState('gameover'); RFS.Audio.stopMusic(); RFS.Audio.sfx('gameover'); this.saveRecord(false);
    }
    victory() {
      this.setState('victory'); this.playMusic('victory', this.cfg.music.victory); this.saveRecord(true);
    }
    saveRecord(won) {
      if (this.recordSaved) return; this.recordSaved = true;
      const rec = { score: this.score, stage: won ? 'FIN' : String(this.level.id), money: this.stats.coins, date: new Date().toISOString().slice(0, 10) };
      this.records.push(rec); this.records.sort((a, b) => b.score - a.score);
      this.records = this.records.slice(0, this.cfg.records.keep);
      this.newRecordRank = this.records.indexOf(rec);
      store.set(this.cfg.records.key, this.records);
    }
    hiScore() { return this.records.length ? Math.max(this.records[0].score, this.score || 0) : (this.score || 0); }

    // ------------------------------------------------------------- bucle
    update() {
      const I = RFS.Input;
      I.update();
      this.t++; this.stateT++;
      if (this.shake > 0) this.shake *= 0.85, this.shake < 0.3 && (this.shake = 0);
      if (this.flashT > 0) this.flashT--;
      for (const n of this.notices) n.t++;
      this.notices = this.notices.filter(n => n.t < 150);
      if (this.debug.enabled) this.debugKeys();
      const m = this['st_' + this.state];
      if (m) m.call(this, I);
    }
    world() {
      RFS.PlayerController.update(this);
      RFS.EnemySpawner.update(this);
      RFS.EnemyController.update(this);
      RFS.EnemyBase.update(this);
      RFS.BossController.update(this);
      RFS.ProjectileSystem.update(this);
      RFS.CurrencySystem.update(this);
      RFS.ShopController.update(this);
      RFS.HazardSystem.update(this);
      this.updateFx();
      if (this.gameOverT > 0 && --this.gameOverT <= 0) this.gameOver();
    }
    updateFx() {
      for (const f of this.fx) { f.t++; if (f.type === 'text') f.y -= 0.4; }
      this.fx = this.fx.filter(f => f.t < f.life);
    }
    pauseCheck(I) {
      if (I.pressed('pause')) { this.returnState = this.state; this.setState('pause'); this.menu.i = 0; RFS.Audio.sfx('pause'); return true; }
      if (I.pressed('equip') && this.cfg.shop.allowDirectEquip && this.player.alive) { this.openEquip(); return true; }
      return false;
    }

    // ---------------------------------------------------------- estados
    st_title(I) {
      const items = ['title_start', 'title_options', 'title_records'];
      this.menuNav(I, items.length);
      if (I.pressed('fire') || I.pressed('pause')) {
        RFS.Audio.unlock(); RFS.Audio.sfx('buy');
        const it = items[this.menu.i];
        if (it === 'title_start') this.newGame(0);
        else if (it === 'title_options') { this.setState('options'); this.menu.i = 0; }
        else { this.setState('records'); }
      }
    }
    menuNav(I, n) {
      if (I.pressed('up')) { this.menu.i = (this.menu.i + n - 1) % n; RFS.Audio.sfx('cursor'); }
      if (I.pressed('down')) { this.menu.i = (this.menu.i + 1) % n; RFS.Audio.sfx('cursor'); }
    }
    optionItems() { return ['music', 'sfx', 'scale', 'fullscreen', 'controls', 'resetkeys', 'back']; }
    st_options(I) {
      const items = this.optionItems(); this.menuNav(I, items.length);
      const it = items[this.menu.i], s = this.settings;
      const d = (I.pressed('right') ? 1 : 0) - (I.pressed('left') ? 1 : 0);
      if (d) {
        if (it === 'music') s.music = U.clamp(Math.round((s.music + d * 0.1) * 10) / 10, 0, 1);
        if (it === 'sfx') s.sfx = U.clamp(Math.round((s.sfx + d * 0.1) * 10) / 10, 0, 1);
        if (it === 'scale') s.scale = (s.scale + d + 5) % 5;
        RFS.Audio.setVolumes(s.music, s.sfx); RFS.Audio.sfx('cursor'); this.saveSettings();
        if (it === 'scale' && this.hooks.resize) this.hooks.resize();
      }
      if (I.pressed('fire')) {
        if (it === 'fullscreen' && this.hooks.fullscreen) this.hooks.fullscreen();
        if (it === 'controls') { this.setState('controls'); this.ctl = { i: 0, wait: false }; }
        if (it === 'resetkeys') { RFS.Input.resetBindings(); this.saveSettings(); this.notice('CONTROLES RESTABLECIDOS'); }
        if (it === 'back') { this.setState('title'); this.menu.i = 1; }
        RFS.Audio.sfx('buy');
      }
      if (I.pressed('back')) { this.setState('title'); this.menu.i = 1; }
    }
    st_controls(I) {
      const acts = RFS.Input.ACTIONS, c = this.ctl;
      if (c.wait) {
        const k = RFS.Input.lastKey;
        if (k && k !== c.before && this.stateT > 5) {
          if (k !== 'Escape') { RFS.Input.bindings[acts[c.i]] = [k].concat(RFS.Input.bindings[acts[c.i]].filter(x => x !== k).slice(0, 1)); this.saveSettings(); }
          c.wait = false; RFS.Audio.sfx('buy'); RFS.Input.prev = Object.assign({}, RFS.Input.cur, { fire: true, back: true });
        }
        return;
      }
      if (I.pressed('up')) { c.i = (c.i + acts.length) % (acts.length + 1); RFS.Audio.sfx('cursor'); }
      if (I.pressed('down')) { c.i = (c.i + 1) % (acts.length + 1); RFS.Audio.sfx('cursor'); }
      if (I.pressed('fire')) {
        if (c.i === acts.length) { this.setState('options'); this.menu.i = 4; return; }
        c.wait = true; c.before = RFS.Input.lastKey = null; this.stateT = 0; RFS.Audio.sfx('cursor');
      }
      if (I.pressed('back')) { this.setState('options'); this.menu.i = 4; }
    }
    st_records(I) { if (I.pressed('fire') || I.pressed('back') || I.pressed('pause')) { this.setState('title'); this.menu.i = 2; } }

    st_intro(I) {
      this.introT++;
      this.updateFx();
      if (this.introT > 150 || (this.introT > 40 && I.pressed('fire'))) {
        if (this.level.gauntlet) { this.setState('bosswarn'); this.warnT = 60; this.spawnsStopped = true; RFS.Audio.sfx('warning'); }
        else this.setState('play');
      }
    }
    st_play(I) {
      if (this.pauseCheck(I)) return;
      this.world();
    }
    st_bosswarn(I) {
      if (this.pauseCheck(I)) return;
      this.warnT++;
      if (this.warnT === 40) for (const e of this.enemies) { e.dead = true; this.fx.push({ type: 'boom', x: e.x, y: e.y, t: 0, life: 16, size: 8 }); }
      this.world();
      if (this.warnT >= 170 && this.player.alive) RFS.StageManager.startBoss(this, RFS.StageManager.nextBossKey(this));
    }
    st_boss(I) {
      if (this.pauseCheck(I)) return;
      this.world();
    }
    st_coinrain(I) {
      if (this.pauseCheck(I)) return;
      this.world();
      if (--this.rainT <= 0 && this.player.alive && this.state === 'coinrain') {
        const L = this.level;
        if (L.gauntlet && !(this.lastBoss && this.lastBoss.final)) {
          this.coins.length = 0; this.balloon = null;
          this.setState('bosswarn'); this.warnT = 170 - this.cfg.gauntlet.pauseBetween; RFS.Audio.sfx('warning');
        } else {
          this.setState('clear'); this.clearT = 0;
          this.clearBonus = this.cfg.score.stageClear * L.id;
          this.score += this.clearBonus;
          RFS.Audio.sfx('clear');
        }
      }
    }
    st_clear(I) {
      this.clearT++;
      this.updateFx();
      if (this.clearT > 260 || (this.clearT > 60 && I.pressed('fire'))) {
        if (this.level.gauntlet) this.victory();
        else RFS.StageManager.load(this, this.levelIdx + 1);
      }
    }
    st_shop(I) {
      const cats = this.cfg.shop.categories, cur = this.shopCur;
      if (I.pressed('left')) { cur.c = (cur.c + 3) % 4; RFS.Audio.sfx('cursor'); }
      if (I.pressed('right')) { cur.c = (cur.c + 1) % 4; RFS.Audio.sfx('cursor'); }
      if (I.pressed('up')) { cur.r = (cur.r + 4) % 5; RFS.Audio.sfx('cursor'); }
      if (I.pressed('down')) { cur.r = (cur.r + 1) % 5; RFS.Audio.sfx('cursor'); }
      if (I.pressed('back') || I.pressed('bomb') || (I.pressed('fire') && cur.r === 4)) { RFS.Audio.sfx('cursor'); this.closeShop(); return; }
      if (I.pressed('fire')) {
        const item = RFS.ShopInventory.byCategory(cats[cur.c].id)[cur.r];
        const err = this.econ.buy(this, item.id);
        if (err) { this.shopMsg = err; RFS.Audio.sfx('error'); }
        else { this.shopMsg = '¡' + item.name + ' COMPRADO!'; RFS.Audio.sfx('buy'); }
        this.shopMsgT = 90;
      }
      if (this.shopMsgT > 0) this.shopMsgT--;
    }
    equipLists() {
      return [[null].concat(this.inv.ownedWeapons()), [null].concat(this.inv.ownedBombs())];
    }
    st_equip(I) {
      const lists = this.equipLists();
      if (I.pressed('up') || I.pressed('down')) { this.equipCur = 1 - this.equipCur; RFS.Audio.sfx('cursor'); }
      const d = (I.pressed('right') ? 1 : 0) - (I.pressed('left') ? 1 : 0);
      if (d) {
        const list = lists[this.equipCur], key = this.equipCur === 0 ? 'activeWeapon' : 'activeBomb';
        const i = list.indexOf(this.inv[key]);
        this.inv[key] = list[(i + d + list.length) % list.length];
        RFS.Audio.sfx('cursor');
      }
      if (I.pressed('fire') || I.pressed('back') || I.pressed('equip') || I.pressed('bomb')) {
        this.setState(this.returnState || 'play'); this.player.invuln = Math.max(this.player.invuln, 40); RFS.Audio.sfx('buy');
      }
    }
    st_pause(I) {
      this.menuNav(I, 2);
      if (I.pressed('pause') || (I.pressed('fire') && this.menu.i === 0) || I.pressed('back') && this.menu.i === 0) { this.setState(this.returnState); RFS.Audio.sfx('pause'); }
      else if (I.pressed('fire') && this.menu.i === 1) { this.saveRecord(false); this.toTitle(); }
    }
    st_gameover(I) { if (this.stateT > 90 && (I.pressed('fire') || I.pressed('pause'))) this.toTitle(); }
    st_victory(I) { this.updateFx(); if (this.stateT > 240 && (I.pressed('fire') || I.pressed('pause'))) this.toTitle(); }
    toTitle() { this.setState('title'); this.menu.i = 0; this.boss = null; this.playMusic('title', this.cfg.music.title); }

    // st_shop se abre desde play; recordar a qué estado volver
    set state(v) { this._state = v; if (v === 'shop') this.prevReturn = this.prevState === 'shop' ? this.prevReturn : this.prevState; }
    get state() { return this._state; }

    // ----------------------------------------------------------- depuración
    debugKeys() {
      const k = RFS.Input.keys, e = this._dbg || (this._dbg = {});
      const edge = c => { const v = !!k[c], r = v && !e[c]; e[c] = v; return r; };
      if (!this.econ) return;
      if (edge('Digit1')) this.debugKillBases();
      if (edge('Digit2')) { this.money += 10000; this.notice('DEBUG +10000'); }
      if (edge('Digit3')) { this.debug.invincible = !this.debug.invincible; this.notice('INVENCIBLE ' + (this.debug.invincible ? 'ON' : 'OFF')); }
      if (edge('Digit4') && this.boss) { for (const p of this.boss.parts) p.hp = 0, p.dead = true; this.boss.reserve = 0; if (this.boss.waves) this.boss.wave = this.boss.waves.length; }
      if (edge('Digit5')) RFS.StageManager.load(this, Math.min(this.levelIdx + 1, RFS.StageManager.count() - 1));
      if (edge('Digit6')) RFS.StageManager.load(this, RFS.StageManager.count() - 1);
      if (edge('Digit7')) { RFS.ShopController.spawnBalloon(this, this.arena); }
    }
    debugKillBases() { for (const b of this.bases) if (!b.dead) RFS.EnemyBase.damage(this, b, 99999); }
  }
  RFS.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
