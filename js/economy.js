/* Economía: CurrencySystem (monedas físicas), EconomyManager (precios e
 * inflación), ShopInventory (catálogo) y EquipmentInventory (equipamiento). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  // ---------------------------------------------------------------------
  RFS.ShopInventory = {
    items() { return RFS.CONFIG.shop.items; },
    get(id) { return RFS.CONFIG.shop.items.find(i => i.id === id); },
    byCategory(cat) { return RFS.CONFIG.shop.items.filter(i => i.cat === cat); }
  };

  // ---------------------------------------------------------------------
  class EquipmentInventory {
    constructor() { this.reset(); }
    reset() {
      this.engines = [];        // ids de motores comprados (acumulativos)
      this.weapons = {};        // id -> munición (disparos) o duración (frames)
      this.activeWeapon = null; // null = disparo básico doble
      this.bombs = {};          // id -> usos
      this.activeBomb = null;   // null = bomba básica
      this.shield = null;       // {hits, time}
      this.flash = 0;
      this.auto = false;
    }
    speed() {
      let s = RFS.CONFIG.player.baseSpeed;
      for (const id of this.engines) s = Math.max(s, RFS.ShopInventory.get(id).speed);
      return s;
    }
    ownedWeapons() { return Object.keys(this.weapons).filter(k => this.weapons[k] > 0); }
    ownedBombs() { return Object.keys(this.bombs).filter(k => this.bombs[k] > 0); }
    /** Consume munición/tiempo del arma activa; vuelve al básico al agotarse. */
    consumeWeapon(kind) {
      const id = this.activeWeapon; if (!id) return;
      const it = RFS.ShopInventory.get(id);
      if ((it.mode === 'ammo' && kind === 'shot') || (it.mode === 'time' && kind === 'tick')) {
        this.weapons[id] -= 1;
        if (this.weapons[id] <= 0) { delete this.weapons[id]; this.activeWeapon = null; return 'expired'; }
      }
    }
    consumeBomb() {
      const id = this.activeBomb; if (!id) return;
      this.bombs[id] -= 1;
      if (this.bombs[id] <= 0) { delete this.bombs[id]; this.activeBomb = null; }
    }
    weaponRemaining() {
      const id = this.activeWeapon; if (!id) return null;
      const it = RFS.ShopInventory.get(id);
      return it.mode === 'time' ? Math.ceil(this.weapons[id] / 60) + 's' : String(this.weapons[id]);
    }
    /** Al morir: se recupera el equipamiento básico (configurable). */
    onDeath() {
      if (!RFS.CONFIG.player.loseEquipmentOnDeath) { this.shield = null; return; }
      const flash = this.flash; this.reset(); this.flash = flash; // Flash Burst se conserva como consumible
    }
  }
  RFS.EquipmentInventory = EquipmentInventory;

  // ---------------------------------------------------------------------
  class EconomyManager {
    constructor() { this.bought = {}; }
    count(id) { return this.bought[id] || 0; }
    price(id) {
      const it = RFS.ShopInventory.get(id);
      const p = it.price * Math.pow(it.growth, this.count(id));
      return Math.round(p / 10) * 10;
    }
    /** Devuelve null si se puede comprar o un motivo si no. */
    blocked(g, id) {
      const it = RFS.ShopInventory.get(id), inv = g.inv;
      if (it.cat === 'engine' && inv.engines.includes(id)) return 'EQUIPADO';
      if (id === 'auto' && inv.auto) return 'EQUIPADO';
      if (g.money < this.price(id)) return 'SIN FONDOS';
      return null;
    }
    buy(g, id) {
      const why = this.blocked(g, id);
      if (why) return why;
      const it = RFS.ShopInventory.get(id), inv = g.inv;
      g.money -= this.price(id);
      this.bought[id] = this.count(id) + 1;
      switch (it.cat) {
        case 'engine': inv.engines.push(id); break;
        case 'weapon':
          inv.weapons[id] = (inv.weapons[id] || 0) + (it.mode === 'time' ? it.amount * 60 : it.amount);
          inv.activeWeapon = id; break;
        case 'bomb': inv.bombs[id] = (inv.bombs[id] || 0) + it.uses; inv.activeBomb = id; break;
        case 'special':
          if (id === 'shield') inv.shield = { hits: it.hits, time: it.time * 60 };
          else if (id === 'flash') inv.flash += it.uses;
          else if (id === 'auto') inv.auto = true;
          else if (id === 'extra') g.lives += 1;
          break;
      }
      g.stats.purchases++;
      return null;
    }
  }
  RFS.EconomyManager = EconomyManager;

  // ---------------------------------------------------------------------
  RFS.CurrencySystem = {
    spawn(g, x, y, type, mult, vx, vy) {
      const C = RFS.CONFIG.coins, c = C[type];
      const value = Math.max(10, Math.round(c.value * (mult || 1) / 10) * 10);
      g.coins.push({ x: U.mod(x, g.W), y, vx: vx || 0, vy: vy == null ? -1.2 : vy, type, value, r: c.r, life: C.life, t: 0 });
    },
    drop(g, x, y, type) { this.spawn(g, x, y, type, g.level ? g.level.rewardMult : 1); },
    rain(g, cx, count, mult) {
      for (let i = 0; i < count; i++) {
        const type = i % 4 === 0 ? 'boss' : 'large';
        this.spawn(g, cx + (Math.random() * 280 - 140), RFS.CONFIG.screen.topY - 10 - Math.random() * 160, type, mult, (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.4);
      }
    },
    update(g) {
      const C = RFS.CONFIG.coins, S = RFS.CONFIG.screen, p = g.player;
      for (let i = g.coins.length - 1; i >= 0; i--) {
        const c = g.coins[i];
        c.t++; c.life--;
        c.vy = Math.min(c.vy + 0.05, C.fallSpeed + (c.type === 'boss' ? 0.3 : 0));
        c.x = U.mod(c.x + c.vx, g.W); c.y += c.vy; c.vx *= 0.98;
        if (c.y > S.groundY - c.r) { c.y = S.groundY - c.r; c.vy = 0; }
        if (p.alive && U.dist(p.x, p.y, c.x, c.y, g.W) < C.pickupR + c.r) {
          g.money += c.value; g.score += Math.round(c.value / 10); g.stats.coins += c.value;
          g.popText(c.x, c.y, String(c.value), c.type);
          RFS.Audio.sfx(c.value >= 500 ? 'bigcoin' : 'coin');
          g.coins.splice(i, 1); continue;
        }
        if (c.life <= 0) g.coins.splice(i, 1);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
