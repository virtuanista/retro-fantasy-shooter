/* Jugador: PlayerController (movimiento + cámara), WeaponSystem (armas),
 * PlayerCombat (disparo, bombas, ataques especiales), PlayerHealth (vidas). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  RFS.PlayerController = {
    create(x, y) {
      return { x, y, vx: 0, vy: 0, facing: 1, alive: true, invuln: 0, respawnT: 0, anim: 0, fireCd: 0, bombCd: 0, pending: [], turn: 0 };
    },
    update(g) {
      const p = g.player, C = RFS.CONFIG, S = C.screen, I = RFS.Input;
      if (!p.alive) {
        if (--p.respawnT <= 0 && g.lives > 0) this.respawn(g);
        return;
      }
      p.anim++; if (p.invuln > 0) p.invuln--; if (p.turn > 0) p.turn--;
      let dx = (I.down('right') ? 1 : 0) - (I.down('left') ? 1 : 0);
      let dy = (I.down('down') ? 1 : 0) - (I.down('up') ? 1 : 0);
      if (dx !== 0 && dx !== p.facing) { p.facing = dx; p.turn = 8; }
      const sp = g.inv.speed() * (dx && dy ? 0.7071 : 1);
      p.vx = dx * sp; p.vy = dy * sp;
      p.y = U.clamp(p.y + p.vy, S.topY + 6, S.groundY - 8);
      if (g.arena) {
        const sx = U.clamp(U.wdx(g.camX, p.x, g.W) + p.vx, 10, S.w - 10);
        p.x = U.mod(g.camX + sx, g.W);
      } else {
        p.x = U.mod(p.x + p.vx, g.W);
        // cámara: sigue al jugador dejando espacio por delante
        const target = p.x - (S.w / 2 - p.facing * C.player.cameraLead);
        g.camX += U.wdx(g.camX, target, g.W) * C.player.cameraLerp;
        const sx = U.wdx(g.camX, p.x, g.W);
        if (sx < 24) g.camX -= 24 - sx; else if (sx > S.w - 24) g.camX += sx - (S.w - 24);
      }
      if (g.inv.shield) { if (--g.inv.shield.time <= 0) g.inv.shield = null; }
      if (g.inv.consumeWeapon('tick') === 'expired') { RFS.Audio.sfx('error'); g.notice('ARMA AGOTADA'); }
      RFS.PlayerCombat.update(g);
    },
    respawn(g) {
      const p = g.player, S = RFS.CONFIG.screen;
      p.alive = true; p.invuln = RFS.CONFIG.player.invulnAfterRespawn;
      p.x = U.mod(g.camX + S.w / 2, g.W); p.y = (S.topY + S.groundY) / 2; p.facing = 1; p.fireCd = 0; p.bombCd = 0;
      RFS.Audio.sfx('power');
    }
  };

  // ---------------------------------------------------------------------
  RFS.WeaponSystem = {
    countKind(g, kind) { let n = 0; for (const s of g.shots) if (s.kind === kind) n++; return n; },
    params(g) {
      const id = g.inv.activeWeapon;
      return id ? RFS.CONFIG.weapons[id] : RFS.CONFIG.basicShot;
    },
    fire(g) {
      const p = g.player, f = p.facing, B = RFS.CONFIG.basicShot, id = g.inv.activeWeapon;
      const P = RFS.ProjectileSystem, x = p.x + f * 8, y = p.y;
      if (!id) {
        if (this.countKind(g, 'basic') > B.maxOnScreen - 2) return false;
        P.shot(g, x, y - B.spreadY, f * B.speed, 0, { dmg: B.damage });
        P.shot(g, x, y + B.spreadY, f * B.speed, 0, { dmg: B.damage });
        RFS.Audio.sfx('shot');
      } else {
        const W = RFS.CONFIG.weapons[id];
        if (id === 'rear') {
          P.shot(g, x, y - 3, f * W.speed, 0, { dmg: W.damage });
          P.shot(g, x, y + 3, f * W.speed, 0, { dmg: W.damage });
          P.shot(g, p.x - f * 8, y, -f * W.speed, 0, { dmg: W.damage, kind: 'rear' });
          RFS.Audio.sfx('shot');
        } else if (id === 'fan') {
          for (const a of W.angles) P.shot(g, x, y, f * Math.cos(a) * W.speed, Math.sin(a) * W.speed, { dmg: W.damage, kind: 'fan' });
          RFS.Audio.sfx('shot');
        } else if (id === 'laser') {
          P.shot(g, x + f * 10, y, f * W.speed, 0, { dmg: W.damage, kind: 'laser', hw: W.length / 2, hh: 2, pierce: true, life: 40 });
          RFS.Audio.sfx('laser');
        } else if (id === 'seeker') {
          for (const a of [-0.35, 0.35]) P.shot(g, x, y, f * Math.cos(a) * W.speed, Math.sin(a) * W.speed, { dmg: W.damage, kind: 'seeker', turn: W.turn, life: W.life, hw: 3, hh: 3 });
          RFS.Audio.sfx('shot');
        }
        g.inv.consumeWeapon('shot');
      }
      g.stats.shots++;
      return true;
    }
  };

  // ---------------------------------------------------------------------
  RFS.PlayerCombat = {
    update(g) {
      const p = g.player, I = RFS.Input, C = RFS.CONFIG;
      if (p.fireCd > 0) p.fireCd--;
      if (p.bombCd > 0) p.bombCd--;
      const W = RFS.WeaponSystem.params(g);
      if (I.pressed('fire') && p.fireCd <= 0) { if (RFS.WeaponSystem.fire(g)) p.fireCd = W.tapCooldown; }
      else if (I.down('fire') && g.inv.auto && p.fireCd <= 0) { if (RFS.WeaponSystem.fire(g)) p.fireCd = W.autoCadence; }
      if (I.pressed('bomb') && p.bombCd <= 0) this.bomb(g);
      if (I.pressed('flash') && g.inv.flash > 0) { g.inv.flash--; this.areaAttack(g, C.flash.damage, C.flash.baseDamage, 'flash'); }
      // bombas diferidas (Twin Drop)
      for (let i = p.pending.length - 1; i >= 0; i--) {
        if (--p.pending[i].t <= 0) { const b = p.pending[i]; p.pending.splice(i, 1); RFS.ProjectileSystem.bomb(g, p.x, p.y + 6, p.facing * 1.2 + p.vx * 0.5, 0.5, { dmg: b.dmg, kind: 'twin' }); RFS.Audio.sfx('bomb'); }
      }
    },
    bomb(g) {
      const p = g.player, C = RFS.CONFIG, P = RFS.ProjectileSystem, id = g.inv.activeBomb, f = p.facing;
      p.bombCd = C.basicBomb.cooldown;
      if (!id) {
        let n = 0; for (const b of g.bombs) if (b.kind === 'basic') n++;
        if (n >= C.basicBomb.maxOnScreen) return;
        P.bomb(g, p.x, p.y + 6, f * 1.2 + p.vx * 0.5, 0.5, { dmg: C.basicBomb.damage });
        RFS.Audio.sfx('bomb');
      } else {
        const B = C.bombs[id];
        if (id === 'twinbomb') {
          P.bomb(g, p.x, p.y + 6, f * 1.2 + p.vx * 0.5, 0.5, { dmg: B.damage, kind: 'twin' });
          p.pending.push({ t: B.gap, dmg: B.damage });
          RFS.Audio.sfx('bomb');
        } else if (id === 'nova') {
          this.areaAttack(g, B.damage, B.baseDamage, 'smart');
        } else if (id === 'rockets') {
          for (const dy of [-6, 6]) P.bomb(g, p.x + f * 6, p.y + dy, f * 1.5, 0, { dmg: B.damage, kind: 'rocket', grav: 0, accel: B.accel, maxSpeed: B.maxSpeed, life: B.life, hw: 5, hh: 2 });
          RFS.Audio.sfx('missile');
        } else if (id === 'megabomb') {
          P.bomb(g, p.x, p.y + 6, f * 1.0 + p.vx * 0.4, 0.4, { dmg: B.damage, kind: 'mega', grav: B.gravity, hw: 6, hh: 6 });
          RFS.Audio.sfx('bomb');
        }
        g.inv.consumeBomb();
      }
      g.stats.bombs++;
    },
    /** Nova Bomb / Flash Burst: daña todo lo que hay en pantalla. */
    areaAttack(g, dmg, baseDmg, kind) {
      const S = RFS.CONFIG.screen;
      g.flashT = 18; g.shake = 10; RFS.Audio.sfx('flash');
      const on = x => { const sx = U.wdx(g.camX, x, g.W); return sx > -16 && sx < S.w + 16; };
      for (const e of g.enemies) if (!e.dead && on(e.x)) RFS.EnemyController.damage(g, e, dmg);
      for (const b of g.bases) if (!b.dead && on(b.x)) RFS.EnemyBase.damage(g, b, baseDmg);
      if (g.boss) RFS.BossController.areaHit(g, dmg, kind);
      g.ebullets.length = 0;
    }
  };

  // ---------------------------------------------------------------------
  RFS.PlayerHealth = {
    hurt(g, dmg) {
      const p = g.player;
      if (g.debug.invincible && p.alive && p.invuln <= 0 && g.stats) { g.stats.wouldDie = (g.stats.wouldDie || 0) + 1; p.invuln = 60; }
      if (!p.alive || p.invuln > 0 || g.debug.invincible || g.state === 'coinrain' || g.state === 'clear') return;
      if (g.inv.shield) {
        g.inv.shield.hits -= dmg || 1; p.invuln = 45; RFS.Audio.sfx('shieldhit');
        if (g.inv.shield.hits <= 0) { g.inv.shield = null; g.notice('ESCUDO ROTO'); }
        return;
      }
      this.kill(g);
    },
    kill(g) {
      const p = g.player;
      p.alive = false; p.respawnT = RFS.CONFIG.player.respawnDelay; p.pending.length = 0;
      g.lives--; g.stats.deaths++;
      g.inv.onDeath();
      g.ebullets.length = 0;
      for (let i = 0; i < 3; i++) g.fx.push({ type: 'boom', x: p.x + (i - 1) * 6, y: p.y + (i % 2) * 4, t: -i * 6, life: 26, size: 12 });
      g.shake = 12; RFS.Audio.sfx('death');
      if (g.lives <= 0) g.gameOverT = 140;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
