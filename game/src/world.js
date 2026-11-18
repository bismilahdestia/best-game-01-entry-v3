// The game's rules and state, with no drawing and no browser in it: the Keeper, the Ember,
// the shades that hunt it, bolts, pickups, particles and waves. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (sounds, announcements)
// without the world knowing about screens or sound. Nothing here allocates after createWorld
// returns, and every roll comes from the seeded random, so a seed replays the same game.
import { BOLT, BOSS_NAME, BRUTE_FIRST_WAVE, COMBO_MAX, COMBO_WINDOW, DART_FIRST_WAVE, DART_WEAVE, DROP_CHANCE, EMBER, ENEMY, ENEMY_SPEED_PER_WAVE, FIELD, GIFTS, KEEPER, PICKUPS, PICKUP_LIFE, POOL, SPITTER_FIRST_WAVE, SURGE_EVERY, SURGE_SPAWN_FACTOR, WAVES, WAVE_CLEAR_MEND, WAVE_GAP } from './config.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_DART = 'dart';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_BOSS = 'boss';

export const EVENT_EMBER_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_SHOOT = 64;
export const EVENT_FOE_SHOOT = 128;
export const EVENT_NOVA = 256;
export const EVENT_HIT = 512;
export const EVENT_SHIELD = 1024;
export const EVENT_SURGE = 2048;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const keeper = { x: FIELD.width / 2, y: FIELD.height - 120, stun: 0, fireTimer: 0, angle: -Math.PI / 2 };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, drain: 0, score: 0, shootTimer: 0, flash: 0, zig: 0 });
  }
  const bolts = [];
  for (let i = 0; i < POOL.bolts; i += 1) bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const foeBolts = [];
  for (let i = 0; i < POOL.foeBolts; i += 1) foeBolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const pickups = [];
  for (let i = 0; i < POOL.pickups; i += 1) pickups.push({ active: false, kind: 'mend', x: 0, y: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  const texts = [];
  for (let i = 0; i < POOL.texts; i += 1) texts.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#ffffff', size: 18 });
  const rings = [];
  for (let i = 0; i < POOL.rings; i += 1) rings.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, maxRadius: 60, color: '#ffffff' });
  const queue = [];

  const state = {
    keeper, enemies, bolts, foeBolts, pickups, particles, texts, rings, queue,
    emberLight: EMBER.light, wave: 1, phase: 'gap', gapTimer: 2, spawnTimer: 0,
    score: 0, kills: 0, sparks: 0, shotsFired: 0, shotsHit: 0,
    spreadTimer: 0, rapidTimer: 0, shake: 0, time: 0,
    banner: '', bannerTimer: 0, enemiesLeft: 0,
    combo: 0, comboTimer: 0, maxCombo: 0, emberShield: false, surge: false, spawnGap: 1,
    muzzle: 0,
    // Gifts: one granted per night cleared, for the first six nights; they persist.
    gifts: [], secondWind: false, fireRateMult: 1, boltLifeMult: 1, spreadGift: false, mendBonus: 0,
  };

  function reset() {
    keeper.x = FIELD.width / 2;
    keeper.y = FIELD.height - 120;
    keeper.stun = 0;
    keeper.fireTimer = 0;
    keeper.angle = -Math.PI / 2;
    for (const e of enemies) e.active = false;
    for (const b of bolts) b.active = false;
    for (const b of foeBolts) b.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    for (const t of texts) t.active = false;
    for (const r of rings) r.active = false;
    queue.length = 0;
    state.emberLight = EMBER.light;
    state.wave = 1;
    state.phase = 'gap';
    state.gapTimer = 2;
    state.spawnTimer = 0;
    state.score = 0;
    state.kills = 0;
    state.sparks = 0;
    state.shotsFired = 0;
    state.shotsHit = 0;
    state.spreadTimer = 0;
    state.rapidTimer = 0;
    state.shake = 0;
    state.time = 0;
    state.banner = 'NIGHT 1';
    state.bannerTimer = 2;
    state.enemiesLeft = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.maxCombo = 0;
    state.emberShield = false;
    state.surge = false;
    state.spawnGap = 1;
    state.muzzle = 0;
    state.gifts.length = 0;
    state.secondWind = false;
    state.fireRateMult = 1;
    state.boltLifeMult = 1;
    state.spreadGift = false;
    state.mendBonus = 0;
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * power;
      p.vy = Math.sin(angle) * power;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
    }
  }

  function floatText(x, y, text, color, size) {
    const t = free(texts);
    if (t === null) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.life = 0.9;
    t.text = text;
    t.color = color;
    t.size = size || 18;
  }

  /** An expanding shockwave ring, drawn by the renderer as it fades. */
  function spawnRing(x, y, color, maxRadius) {
    const r = free(rings);
    if (r === null) return;
    r.active = true;
    r.x = x;
    r.y = y;
    r.maxLife = 0.45;
    r.life = r.maxLife;
    r.maxRadius = maxRadius;
    r.color = color;
  }

  /** Grant one Gift and apply its effect at once; the banner names it. */
  function grantGift(gift) {
    state.gifts.push(gift.name);
    if (gift.id === 'emberheart') state.emberLight = Math.min(EMBER.light, state.emberLight + 25);
    else if (gift.id === 'swiftwisp') state.fireRateMult *= 1.15;
    else if (gift.id === 'widenet') state.spreadGift = true;
    else if (gift.id === 'longfuse') state.boltLifeMult *= 1.5;
    else if (gift.id === 'brightring') state.mendBonus += 10;
    else if (gift.id === 'secondwind') state.secondWind = true;
    state.banner = `GIFT — ${gift.name.toUpperCase()}!`;
    state.bannerTimer = 2.2;
    spawnRing(EMBER.x, EMBER.y, '#ffd166', 160);
  }

  function buildWave(wave) {
    queue.length = 0;
    const count = 6 + wave * 3;
    let brutes = 0;
    let spitters = 0;
    let darts = 0;
    if (wave >= BRUTE_FIRST_WAVE) brutes = 1 + Math.floor((wave - BRUTE_FIRST_WAVE) / 2);
    if (wave >= SPITTER_FIRST_WAVE) spitters = Math.min(2 + Math.floor(wave / 2), 8);
    if (wave >= DART_FIRST_WAVE) darts = Math.min(2 + wave, 10);
    const drifters = Math.max(2, count - brutes - spitters - darts);
    for (let i = 0; i < drifters; i += 1) queue.push(KIND_DRIFTER);
    for (let i = 0; i < darts; i += 1) queue.push(KIND_DART);
    for (let i = 0; i < spitters; i += 1) queue.push(KIND_SPITTER);
    for (let i = 0; i < brutes; i += 1) queue.push(KIND_BRUTE);
    // Shuffle the queue so kinds arrive mixed.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    // The boss is always the last shade of the final wave.
    if (wave === WAVES) queue.push(KIND_BOSS);
    state.enemiesLeft = queue.length;
    state.surge = wave % SURGE_EVERY === 0;
  }

  function spawnFromEdge(kind) {
    const e = free(enemies);
    if (e === null) return;
    const spec = ENEMY[kind];
    // A point on the field's border, then just outside it, so shades walk in from the dark.
    const side = Math.floor(random() * 4);
    const along = random();
    let x = 0;
    let y = 0;
    if (side === 0) { x = along * FIELD.width; y = -30; } else if (side === 1) { x = FIELD.width + 30; y = along * FIELD.height; } else if (side === 2) { x = along * FIELD.width; y = FIELD.height + 30; } else { x = -30; y = along * FIELD.height; }
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.hp = spec.hp;
    e.maxHp = spec.hp;
    e.speed = spec.speed + ENEMY_SPEED_PER_WAVE * (state.wave - 1) + random() * 12;
    e.radius = spec.radius;
    e.drain = spec.drain;
    e.score = spec.score;
    e.shootTimer = 1 + random() * spec.shoot;
    e.flash = 0;
    e.zig = random() * Math.PI * 2;
  }

  function dropPickup(x, y) {
    if (random() >= DROP_CHANCE) return;
    const p = free(pickups);
    if (p === null) return;
    const total = PICKUPS.mend.weight + PICKUPS.spread.weight + PICKUPS.rapid.weight + PICKUPS.shield.weight + PICKUPS.nova.weight;
    let roll = random() * total;
    let kind = 'mend';
    for (const name of ['mend', 'spread', 'rapid', 'shield', 'nova']) {
      roll -= PICKUPS[name].weight;
      if (roll <= 0) { kind = name; break; }
    }
    p.active = true;
    p.kind = kind;
    p.x = Math.min(FIELD.width - 20, Math.max(20, x));
    p.y = Math.min(FIELD.height - 20, Math.max(20, y));
    p.life = PICKUP_LIFE;
  }

  function killEnemy(e, events) {
    e.active = false;
    state.kills += 1;
    state.sparks += 1;
    // Chained kills raise the combo, and the combo multiplies the kill's score.
    if (state.comboTimer > 0) state.combo = Math.min(COMBO_MAX, state.combo + 1);
    else state.combo = 1;
    state.comboTimer = COMBO_WINDOW;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const gained = e.score * state.combo;
    state.score += gained;
    state.enemiesLeft -= 1;
    const color = e.kind === KIND_BRUTE ? '#ff7a59' : e.kind === KIND_SPITTER ? '#e06fd8' : e.kind === KIND_DART ? '#a8ff60' : '#9d8cff';
    burst(e.x, e.y, color, e.kind === KIND_BRUTE ? 26 : 12, e.kind === KIND_BRUTE ? 260 : 170, 3);
    spawnRing(e.x, e.y, color, e.kind === KIND_BRUTE ? 90 : 48);
    // Big kills pop bigger: a maxed combo or the boss fills the frame with its score.
    const popSize = e.kind === KIND_BOSS ? 34 : state.combo >= COMBO_MAX ? 30 : state.combo >= 3 ? 24 : 18;
    floatText(e.x, e.y - 10, state.combo > 1 ? `+${gained} x${state.combo}` : `+${gained}`, '#ffc94d', popSize);
    if (e.kind === KIND_BRUTE) state.shake = Math.min(14, state.shake + 8);
    if (e.kind === KIND_BOSS) {
      state.shake = Math.min(14, state.shake + 12);
      state.banner = `${BOSS_NAME} FALLS!`;
      state.bannerTimer = 2.5;
    }
    dropPickup(e.x, e.y);
    return events | EVENT_KILL;
  }

  function fireBolt(angle) {
    const b = free(bolts);
    if (b === null) return;
    b.active = true;
    b.x = keeper.x + Math.cos(angle) * (KEEPER.radius + 8);
    b.y = keeper.y + Math.sin(angle) * (KEEPER.radius + 8);
    b.vx = Math.cos(angle) * BOLT.speed;
    b.vy = Math.sin(angle) * BOLT.speed;
    b.life = BOLT.life * state.boltLifeMult;
    state.shotsFired += 1;
  }

  function applyPickup(p, events) {
    p.active = false;
    if (p.kind === 'mend') {
      state.emberLight = Math.min(EMBER.light, state.emberLight + PICKUPS.mend.light);
      floatText(keeper.x, keeper.y - 24, `+${PICKUPS.mend.light} LIGHT`, '#7dffa8');
    } else if (p.kind === 'spread') {
      state.spreadTimer = PICKUPS.spread.seconds;
      floatText(keeper.x, keeper.y - 24, 'SPREAD SHOT!', '#ffd166');
    } else if (p.kind === 'rapid') {
      state.rapidTimer = PICKUPS.rapid.seconds;
      floatText(keeper.x, keeper.y - 24, 'RAPID FIRE!', '#6fc3ff');
    } else if (p.kind === 'shield') {
      state.emberShield = true;
      floatText(keeper.x, keeper.y - 24, 'EMBER SHIELDED!', '#d9b8ff');
    } else if (p.kind === 'nova') {
      burst(keeper.x, keeper.y, '#ffffff', 40, 420, 4);
      for (const e of enemies) {
        if (e.active) events = killEnemy(e, events);
      }
      state.shake = Math.min(14, state.shake + 10);
      events |= EVENT_NOVA;
    }
    burst(keeper.x, keeper.y, '#7dffa8', 10, 120, 3);
    return events | EVENT_PICKUP;
  }

  /**
   * One fixed step. `controls` is {mx, my, aimX, aimY, fire} in field space. With `harmless`
   * set (the title screen's backdrop) shades drift in and fade at the Ember, but nothing is
   * drained, nothing scores and the Keeper never fires.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.spreadTimer > 0) state.spreadTimer -= dt;
    if (state.rapidTimer > 0) state.rapidTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.muzzle > 0) state.muzzle -= dt;
    if (keeper.stun > 0) keeper.stun -= dt;
    if (keeper.fireTimer > 0) keeper.fireTimer -= dt;

    // The Keeper steers and aims. While stunned, a spitter's bolt has knocked the light out
    // of it: it drifts, cannot move and cannot fire.
    const stunned = keeper.stun > 0;
    if (!harmless && !stunned) {
      const length = Math.hypot(controls.mx, controls.my) || 1;
      keeper.x = Math.min(FIELD.width - 24, Math.max(24, keeper.x + (controls.mx / length) * KEEPER.speed * dt * (controls.mx !== 0 || controls.my !== 0 ? 1 : 0)));
      keeper.y = Math.min(FIELD.height - 24, Math.max(24, keeper.y + (controls.my / length) * KEEPER.speed * dt * (controls.mx !== 0 || controls.my !== 0 ? 1 : 0)));
      keeper.angle = Math.atan2(controls.aimY - keeper.y, controls.aimX - keeper.x);
      if (controls.fire && keeper.fireTimer <= 0) {
        // Swift Wisp multiplies the base fire rate for the rest of the run.
        const rate = BOLT.fireRate * state.fireRateMult * (state.rapidTimer > 0 ? 1.8 : 1);
        keeper.fireTimer = 1 / rate;
        state.muzzle = 0.09;
        // Wide Net makes every shot a spread shot, even without the spread pickup.
        if (state.spreadTimer > 0 || state.spreadGift) {
          fireBolt(keeper.angle - 0.14);
          fireBolt(keeper.angle);
          fireBolt(keeper.angle + 0.14);
        } else {
          fireBolt(keeper.angle);
        }
        events |= EVENT_SHOOT;
      }
    }

    // Waves: a gap with a banner, then a stream of shades, then the clear bonus.
    if (!harmless && state.phase === 'gap') {
      state.gapTimer -= dt;
      if (state.gapTimer <= 0) {
        state.phase = 'fight';
        buildWave(state.wave);
        state.spawnGap = (1.1 - state.wave * 0.07) * (state.surge ? SURGE_SPAWN_FACTOR : 1);
        state.spawnTimer = 0.4;
        state.banner = state.surge ? `NIGHT ${state.wave} — SURGE!` : `NIGHT ${state.wave}`;
        state.bannerTimer = 2.2;
        if (state.surge) events |= EVENT_SURGE;
      }
    } else if (!harmless && state.phase === 'fight') {
      if (queue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const kind = queue.shift();
          spawnFromEdge(kind);
          if (kind === KIND_BOSS) {
            state.banner = `${BOSS_NAME} WAKES!`;
            state.bannerTimer = 2.5;
            // The Gloom arrives with its court: six shades walk in behind it.
            for (let i = 0; i < 4; i += 1) queue.push(KIND_DRIFTER);
            for (let i = 0; i < 2; i += 1) queue.push(KIND_DART);
            state.enemiesLeft += 6;
          }
          state.spawnTimer = Math.max(0.3, state.spawnGap);
        }
      } else if (state.enemiesLeft <= 0 && !enemies.some((e) => e.active)) {
        state.score += 500 * state.wave;
        state.emberLight = Math.min(EMBER.light, state.emberLight + WAVE_CLEAR_MEND + state.mendBonus);
        events |= EVENT_WAVE_CLEAR;
        const clearedWave = state.wave;
        if (state.wave >= WAVES) {
          state.phase = 'won';
          events |= EVENT_WIN;
        } else {
          state.wave += 1;
          state.phase = 'gap';
          state.gapTimer = WAVE_GAP;
          state.banner = `NIGHT ${state.wave}`;
          state.bannerTimer = WAVE_GAP;
        }
        // Clearing one of the first six nights grants that night's Gift; its banner
        // replaces the next-night banner for the gap, so the player sees what they earned.
        if (clearedWave <= GIFTS.length) grantGift(GIFTS[clearedWave - 1]);
      }
    } else if (harmless && state.phase === 'gap') {
      // The title backdrop keeps a gentle trickle of shades walking in for show.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && enemies.filter((e) => e.active).length < 6) {
        spawnFromEdge(KIND_DRIFTER);
        state.spawnTimer = 1.2;
      }
    }

    // Shades walk toward the Ember; spitters hold their range and shoot at the Keeper.
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const dx = EMBER.x - e.x;
      const dy = EMBER.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (e.kind === KIND_SPITTER && dist < ENEMY.spitter.range && !harmless) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && state.phase === 'fight') {
          e.shootTimer = ENEMY.spitter.shoot;
          const b = free(foeBolts);
          if (b !== null) {
            const aim = Math.atan2(keeper.y - e.y, keeper.x - e.x);
            b.active = true;
            b.x = e.x;
            b.y = e.y;
            b.vx = Math.cos(aim) * ENEMY.spitter.boltSpeed;
            b.vy = Math.sin(aim) * ENEMY.spitter.boltSpeed;
            b.life = 4;
            events |= EVENT_FOE_SHOOT;
          }
        }
      } else {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
        if (e.kind === KIND_DART) {
          // Darts weave side to side as they close in: harder to lead, easy to spot.
          const weave = Math.sin(state.time * 4 + e.zig) * DART_WEAVE * dt;
          e.x += (-dy / dist) * weave;
          e.y += (dx / dist) * weave;
        }
      }
      if (dist < EMBER.radius + e.radius * 0.6) {
        e.active = false;
        state.enemiesLeft -= 1;
        burst(EMBER.x, EMBER.y, '#ff5d5d', 14, 200, 3);
        if (!harmless) {
          if (state.emberShield) {
            state.emberShield = false;
            spawnRing(EMBER.x, EMBER.y, '#d9b8ff', 110);
            floatText(EMBER.x, EMBER.y - 56, 'SHIELD HELD!', '#d9b8ff');
            events |= EVENT_SHIELD;
          } else {
            state.emberLight -= e.drain;
            state.combo = 0;
            state.comboTimer = 0;
            state.shake = Math.min(14, state.shake + 6);
            events |= EVENT_EMBER_HIT;
            if (state.emberLight <= 0) {
              // Second Wind spends itself once instead of losing the run.
              if (state.secondWind) {
                state.secondWind = false;
                state.emberLight = 30;
                state.banner = 'SECOND WIND!';
                state.bannerTimer = 2.5;
                spawnRing(EMBER.x, EMBER.y, '#7dffa8', 140);
              } else {
                state.emberLight = 0;
                state.phase = 'lost';
                events |= EVENT_OVER;
              }
            }
          }
        }
      }
    }

    // The Keeper's bolts fly and burst shades they touch.
    for (const b of bolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + BOLT.radius) {
          b.active = false;
          e.hp -= BOLT.damage;
          e.flash = 0.12;
          state.shotsHit += 1;
          burst(b.x, b.y, '#aef7ff', 5, 130, 2);
          if (e.hp <= 0) events = killEnemy(e, events);
          else events |= EVENT_HIT;
          break;
        }
      }
    }

    // A spitter's bolt stuns the Keeper it touches.
    for (const b of foeBolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (!harmless && keeper.stun <= 0 && Math.hypot(keeper.x - b.x, keeper.y - b.y) < KEEPER.radius + 6) {
        b.active = false;
        keeper.stun = KEEPER.stun;
        burst(keeper.x, keeper.y, '#ff5d8f', 12, 180, 3);
      }
    }

    // Pickups wait, bob, fade, and are gathered by touch.
    for (const p of pickups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (!harmless && Math.hypot(keeper.x - p.x, keeper.y - p.y) < KEEPER.radius + PICKUPS[p.kind].radius) {
        events = applyPickup(p, events);
      }
    }

    // Particles and floating texts age out.
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
    for (const t of texts) {
      if (!t.active) continue;
      t.y -= 34 * dt;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
    }
    for (const r of rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) r.active = false;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
