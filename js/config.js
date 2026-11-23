/* =====================================================================
 * RETRO FANTASY SHOOTER — CONFIGURACIÓN DE BALANCE (GDD §13, §14)
 * ---------------------------------------------------------------------
 * Todos los valores de balance están aquí, fuera de los comportamientos.
 * Unidades: posiciones en píxeles lógicos (pantalla 320x224),
 * velocidades en píxeles por frame, tiempos en frames (60 = 1 segundo)
 * salvo que se indique "s" (segundos).
 * ===================================================================== */
(function (root) {
  const RFS = root.RFS = root.RFS || {};

  RFS.CONFIG = {
    screen: { w: 320, h: 224, hudH: 18, radarH: 14, groundY: 196, topY: 24 },

    player: {
      startLives: 3,
      baseSpeed: 1.35,             // velocidad sin motores
      hitbox: { hw: 5, hh: 3 },    // semiejes de la hitbox (más pequeña que el sprite)
      respawnDelay: 100,
      invulnAfterRespawn: 150,
      loseEquipmentOnDeath: true,  // motores, armas, bombas y Auto Shot se pierden al morir
      cameraLead: 64,              // espacio de visión por delante de la nave
      cameraLerp: 0.09
    },

    basicShot: {
      damage: 1, speed: 6.5, maxOnScreen: 6, tapCooldown: 5,
      autoCadence: 6, spreadY: 3, life: 48
    },

    basicBomb: { damage: 4, gravity: 0.12, maxOnScreen: 2, cooldown: 14, life: 140 },

    // Tope de daño contra jefes como fracción de su vida máxima (GDD §10)
    bossDamageCap: { smart: 0.05, flash: 0.05, heavy: 0.10, missile: 0.03 },

    coins: {
      small:  { value: 10,   r: 3, color: 'small' },
      medium: { value: 50,   r: 4, color: 'medium' },
      large:  { value: 200,  r: 5, color: 'large' },
      base:   { value: 1000, r: 7, color: 'base' },
      boss:   { value: 500,  r: 6, color: 'boss' },
      life: 600, blinkAt: 150, fallSpeed: 0.45, pickupR: 11,
      bossRainCount: 24, bossRainDuration: 330
    },

    // ------------------------------------------------------------------
    // TIENDA (GDD §8) — price = base * growth^comprasPrevias (redondeado)
    // ------------------------------------------------------------------
    shop: {
      balloonSpeed: 0.35, balloonLife: 1500,
      equipTokenLife: 900,
      allowDirectEquip: true,   // cambio directo con tecla (plataformas modernas)
      categories: [
        { id: 'engine',  name: 'MOTORES' },
        { id: 'weapon',  name: 'ARMAS' },
        { id: 'bomb',    name: 'BOMBAS' },
        { id: 'special', name: 'ESPECIAL' }
      ],
      items: [
        // Motores: mejoras permanentes durante la vida actual
        { id: 'fins',    cat: 'engine', name: 'FEATHER FINS', desc: 'Velocidad: mejora pequeña', price: 400,  growth: 2.0, speed: 1.75 },
        { id: 'ionjet',  cat: 'engine', name: 'ION JET',      desc: 'Velocidad: mejora media', price: 1200, growth: 2.0, speed: 2.15 },
        { id: 'turbo',   cat: 'engine', name: 'TURBO CORE',   desc: 'Velocidad: mejora alta', price: 3500, growth: 2.0, speed: 2.55 },
        { id: 'comet',   cat: 'engine', name: 'COMET DRIVE',  desc: 'Velocidad máxima',   price: 8000, growth: 2.0, speed: 3.0 },
        // Armas principales: munición o duración limitada
        { id: 'rear',    cat: 'weapon', name: 'REAR SHOT',    desc: 'Dispara también atrás', price: 700,  growth: 1.6, mode: 'ammo', amount: 320 },
        { id: 'fan',     cat: 'weapon', name: 'FAN SHOT',     desc: '5 proyectiles en abanico', price: 2200, growth: 1.6, mode: 'time', amount: 25 },
        { id: 'laser',   cat: 'weapon', name: 'BEAM LASER',   desc: 'Láser perforante potente', price: 4500, growth: 1.6, mode: 'time', amount: 20 },
        { id: 'seeker',  cat: 'weapon', name: 'SEEKER SHOT',  desc: 'Proyectiles teledirigidos', price: 6500, growth: 1.6, mode: 'time', amount: 25 },
        // Bombas: usos limitados
        { id: 'twinbomb',  cat: 'bomb', name: 'TWIN DROP',    desc: 'Dos bombas seguidas',      price: 500,  growth: 1.5, uses: 12 },
        { id: 'nova',      cat: 'bomb', name: 'NOVA BOMB',    desc: 'Destruye enemigos en pantalla', price: 2600, growth: 1.7, uses: 3 },
        { id: 'rockets',   cat: 'bomb', name: 'TWIN ROCKETS', desc: 'Dos misiles frontales',    price: 1600, growth: 1.5, uses: 10 },
        { id: 'megabomb',  cat: 'bomb', name: 'MEGA BOMB',    desc: 'Bomba de gran potencia',   price: 5200, growth: 1.7, uses: 3 },
        // Objetos especiales
        { id: 'shield',  cat: 'special', name: 'SHIELD',      desc: 'Absorbe 3 impactos (40 s)', price: 2200, growth: 1.6, hits: 3, time: 40 },
        { id: 'flash',   cat: 'special', name: 'FLASH BURST', desc: 'Ataque de área ({flash})',  price: 1800, growth: 1.5, uses: 1 },
        { id: 'auto',    cat: 'special', name: 'AUTO SHOT',   desc: 'Disparo automático',        price: 1200, growth: 1.8 },
        { id: 'extra',   cat: 'special', name: 'EXTRA SHIP',  desc: 'Una vida adicional',        price: 9000, growth: 1.8 }
      ]
    },

    weapons: {
      rear:   { damage: 1, speed: 6.5, tapCooldown: 5, autoCadence: 6 },
      fan:    { damage: 1, speed: 5.5, tapCooldown: 7, autoCadence: 8, angles: [-0.5, -0.25, 0, 0.25, 0.5] },
      laser:  { damage: 3, speed: 9,   tapCooldown: 4, autoCadence: 4, length: 26, pierce: true },
      seeker: { damage: 2, speed: 4.2, tapCooldown: 8, autoCadence: 9, turn: 0.13, life: 90 }
    },

    bombs: {
      twinbomb: { damage: 4, gap: 9 },
      nova:     { damage: 30, baseDamage: 10 },
      rockets:  { damage: 7, accel: 0.25, maxSpeed: 7, life: 70 },
      megabomb: { damage: 40, radius: 34, gravity: 0.1 }
    },

    flash: { damage: 25, baseDamage: 6 },

    // ------------------------------------------------------------------
    // FAMILIAS DE ENEMIGOS (GDD §9) — valores base, se escalan por nivel
    // reward: tipo de moneda; score: puntos
    // ------------------------------------------------------------------
    enemies: {
      patrol:    { hp: 1,  speed: 0.9, damage: 1, fireRate: 0,   bullet: null,     reward: 'small',  score: 100, hw: 6, hh: 5 },
      chaser:    { hp: 2,  speed: 1.0, damage: 1, fireRate: 0,   bullet: null,     reward: 'small',  score: 150, hw: 6, hh: 5, accel: 0.05 },
      vertical:  { hp: 2,  speed: 1.0, damage: 1, fireRate: 0,   bullet: null,     reward: 'small',  score: 150, hw: 5, hh: 6 },
      shooter:   { hp: 3,  speed: 0.6, damage: 1, fireRate: 140, bullet: 'aimed',  reward: 'medium', score: 250, hw: 6, hh: 6 },
      spreader:  { hp: 4,  speed: 0.5, damage: 1, fireRate: 170, bullet: 'radial', reward: 'medium', score: 300, hw: 7, hh: 6, shots: 6 },
      tank:      { hp: 12, speed: 0.35,damage: 2, fireRate: 200, bullet: 'aimed',  reward: 'large',  score: 600, hw: 9, hh: 8 },
      formation: { hp: 1,  speed: 1.3, damage: 1, fireRate: 0,   bullet: null,     reward: 'small',  score: 120, hw: 5, hh: 5, groupSize: 5, groupBonus: 'large' },
      guardian:  { hp: 3,  speed: 0.04,damage: 1, fireRate: 180, bullet: 'aimed',  reward: 'medium', score: 250, hw: 5, hh: 5, orbitR: 30 }
    },

    // ------------------------------------------------------------------
    // JEFES (GDD §10)
    // ------------------------------------------------------------------
    bosses: {
      maw:       { name: 'MAW ENGINE',      hp: 60,  bulletSpeed: 1.6, fireRate: 56, reward: 1.0 },
      cinder:    { name: 'CINDER WHEEL',    hp: 90,  bulletSpeed: 1.7, fireRate: 70, ringShots: 10, reward: 1.2 },
      frost:     { name: 'FROST HYDRA',     hp: 120, bulletSpeed: 2.0, fireRate: 60, dashSpeed: 4.5, reward: 1.4 },
      leviathan: { name: 'ABYSS LEVIATHAN', hp: 150, bulletSpeed: 2.1, fireRate: 52, dashSpeed: 5, reward: 1.6 },
      storm:     { name: 'STORM FLOCK',     hp: 180, bulletSpeed: 2.2, fireRate: 90, waves: 3, reward: 1.8 },
      dune:      { name: 'DUNE BEHEMOTH',   hp: 220, bulletSpeed: 2.2, fireRate: 44, reward: 2.0 },
      colossus:  { name: 'CORE COLOSSUS',   hp: 280, bulletSpeed: 2.4, fireRate: 40, reward: 2.4 },
      crown:     { name: 'ABYSSAL CROWN',   hp: 420, bulletSpeed: 2.4, fireRate: 34, reward: 4.0 }
    },

    // ------------------------------------------------------------------
    // NIVELES (GDD §5, §6, §13)
    // ------------------------------------------------------------------
    levels: [
      {
        id: 1, name: 'BOSQUE ORGÁNICO', theme: 'forest', worldW: 1792,
        baseHp: 12, baseSpawn: { fam: 'patrol', every: 420 },
        hpMult: 1.0, speedMult: 1.0, fireMult: 1.0, bulletSpeed: 1.5,
        spawnInterval: 95, maxEnemies: 5, rewardMult: 1.0, boss: 'maw',
        table: { patrol: 6, chaser: 2, formation: 2 },
        shop: { first: 900, interval: 1500 }, equipToken: { first: 2400, interval: 3000 },
        music: { seed: 11, tempo: 132, scale: 'major', root: 60 }
      },
      {
        id: 2, name: 'MUNDO ÍGNEO', theme: 'fire', worldW: 2048,
        baseHp: 18, baseSpawn: { fam: 'shooter', every: 400 },
        hpMult: 1.2, speedMult: 1.08, fireMult: 1.0, bulletSpeed: 1.9,
        spawnInterval: 80, maxEnemies: 7, rewardMult: 1.15, boss: 'cinder',
        table: { patrol: 3, chaser: 2, shooter: 4, spreader: 2, formation: 1 },
        shop: { first: 900, interval: 1500 }, equipToken: { first: 2000, interval: 2800 },
        music: { seed: 23, tempo: 148, scale: 'minor', root: 57 }
      },
      {
        id: 3, name: 'MUNDO GLACIAL', theme: 'ice', worldW: 2048,
        baseHp: 24, baseSpawn: { fam: 'chaser', every: 380 },
        hpMult: 1.45, speedMult: 1.2, fireMult: 1.1, bulletSpeed: 2.0,
        spawnInterval: 66, maxEnemies: 9, rewardMult: 1.3, boss: 'frost',
        table: { chaser: 5, patrol: 2, vertical: 2, shooter: 2, formation: 2 },
        shop: { first: 900, interval: 1600 }, equipToken: { first: 2000, interval: 2800 },
        music: { seed: 37, tempo: 124, scale: 'dorian', root: 62 }
      },
      {
        id: 4, name: 'MUNDO ACUÁTICO', theme: 'water', worldW: 2304,
        baseHp: 30, baseSpawn: { fam: 'vertical', every: 360 },
        hpMult: 1.7, speedMult: 1.25, fireMult: 1.15, bulletSpeed: 2.1,
        spawnInterval: 62, maxEnemies: 10, rewardMult: 1.45, boss: 'leviathan',
        table: { vertical: 5, patrol: 2, shooter: 3, chaser: 2, tank: 1 },
        shop: { first: 900, interval: 1600 }, equipToken: { first: 2000, interval: 2600 },
        music: { seed: 41, tempo: 116, scale: 'lydian', root: 59 }
      },
      {
        id: 5, name: 'MUNDO DE NUBES', theme: 'cloud', worldW: 2304,
        baseHp: 36, baseSpawn: { fam: 'formation', every: 420 },
        hpMult: 1.95, speedMult: 1.32, fireMult: 1.25, bulletSpeed: 2.3,
        spawnInterval: 58, maxEnemies: 11, rewardMult: 1.6, boss: 'storm',
        table: { formation: 5, patrol: 2, shooter: 3, spreader: 2, chaser: 2 },
        shop: { first: 900, interval: 1700 }, equipToken: { first: 2000, interval: 2600 },
        music: { seed: 53, tempo: 140, scale: 'major', root: 65 }
      },
      {
        id: 6, name: 'MUNDO DESÉRTICO', theme: 'desert', worldW: 2560,
        baseHp: 44, baseSpawn: { fam: 'spreader', every: 380 },
        hpMult: 2.3, speedMult: 1.4, fireMult: 1.35, bulletSpeed: 2.4,
        spawnInterval: 54, maxEnemies: 12, rewardMult: 1.8, boss: 'dune',
        table: { spreader: 4, tank: 3, chaser: 3, shooter: 2, patrol: 1 },
        shop: { first: 900, interval: 1700 }, equipToken: { first: 2000, interval: 2500 },
        music: { seed: 67, tempo: 128, scale: 'phrygian', root: 57 }
      },
      {
        id: 7, name: 'ZONA FINAL', theme: 'final', worldW: 2560,
        baseHp: 56, baseSpawn: { fam: 'guardian', every: 300 },
        hpMult: 2.7, speedMult: 1.5, fireMult: 1.5, bulletSpeed: 2.6,
        spawnInterval: 48, maxEnemies: 13, rewardMult: 2.0, boss: 'colossus',
        table: { patrol: 2, chaser: 3, vertical: 2, shooter: 3, spreader: 3, tank: 2, formation: 2 },
        shop: { first: 900, interval: 1800 }, equipToken: { first: 1800, interval: 2400 },
        music: { seed: 79, tempo: 156, scale: 'minor', root: 55 }
      }
    ],

    // Fase final: repetición de jefes + jefe definitivo (GDD §6)
    gauntlet: {
      name: 'NÚCLEO ABISAL', theme: 'void', worldW: 1792,
      sequence: ['maw', 'cinder', 'frost', 'leviathan', 'storm', 'dune', 'colossus'],
      hpMult: 0.9, bulletSpeedMult: 1.15, fireMult: 1.2, rewardMult: 0.6,
      finalBoss: 'crown', pauseBetween: 120, shopEvery: 2,
      music: { seed: 97, tempo: 160, scale: 'phrygian', root: 52 }
    },

    // Obstáculos y peligros del escenario por tipo de zona (GDD §3.5)
    hazards: {
      forest: null,
      fire:   { type: 'geyser', every: 260, warn: 70, active: 60, height: 110 },
      ice:    { type: 'faller', every: 150, warn: 45, speed: 0.12 },
      water:  { type: 'riser',  every: 120, speed: 0.6 },
      cloud:  { type: 'bolt',   every: 220, warn: 60, active: 26 },
      desert: { type: 'geyser', every: 200, warn: 60, active: 55, height: 90 },
      final:  { type: 'bolt',   every: 170, warn: 55, active: 26 },
      void:   null
    },

    music: {
      title:   { seed: 5,  tempo: 120, scale: 'major',  root: 60 },
      boss:    { seed: 13, tempo: 168, scale: 'minor',  root: 57, boss: true },
      final:   { seed: 101,tempo: 176, scale: 'phrygian', root: 50, boss: true },
      shop:    { seed: 7,  tempo: 104, scale: 'major',  root: 67, soft: true },
      victory: { seed: 3,  tempo: 112, scale: 'major',  root: 60 }
    },

    score: { base: 1000, bossMult: 50, stageClear: 5000 },
    records: { key: 'rfs.records.v1', keep: 8 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
