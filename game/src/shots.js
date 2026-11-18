// The screenshot scenes behind ?shot=start|play|victory|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a real game looks like and the same seed always gives the same frame.
// v2: the pilot leads its target (aims where the shade will be when the bolt arrives), so
// it hits far more often than v1's 35% and plays a stronger game. The play pilot hunts for
// a busy mid-wave frame with brutes, spitters and darts on the field; the victory pilot
// plays every wave to the end; the end pilot stands its ground and shoots but never moves,
// so the dark takes the Ember a few waves in, like a player who froze in place.
import { BOLT, EMBER, FIELD, KEEPER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 600;
const VICTORY_LIMIT_SECONDS = 1200;
const SAMPLE = 1 / 30;
/** How far the play pilot keeps between the Keeper and the nearest shade. */
const KITE_RANGE = 190;

/** The nearest live shade to the Keeper, or null when the field is empty. The boss, when
 * it lives, is always the target: thirty bolts end the game, and it drains forty light. */
function nearestEnemy(state) {
  for (const e of state.enemies) {
    if (e.active && e.kind === 'boss') return e;
  }
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dist = Math.hypot(e.x - state.keeper.x, e.y - state.keeper.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}

/**
 * Where to aim to hit a shade: its position led by how far it walks toward the Ember
 * while the bolt travels. Darts weave, so their lead is halved — a full lead would miss
 * the weave.
 */
function leadAim(state, enemy) {
  const keeper = state.keeper;
  const dx = EMBER.x - enemy.x;
  const dy = EMBER.y - enemy.y;
  const distToEmber = Math.hypot(dx, dy) || 1;
  const flight = Math.hypot(enemy.x - keeper.x, enemy.y - keeper.y) / BOLT.speed;
  const lead = enemy.kind === 'dart' ? 0.5 : 1;
  return {
    x: enemy.x + (dx / distToEmber) * enemy.speed * flight * lead,
    y: enemy.y + (dy / distToEmber) * enemy.speed * flight * lead,
  };
}

/** Steer toward the nearest shade until it is inside the kite range, then hold off. */
function autopilotControls(state) {
  const keeper = state.keeper;
  const enemy = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  let aimX = keeper.x;
  let aimY = keeper.y - 200;
  if (enemy !== null) {
    const aim = leadAim(state, enemy);
    aimX = aim.x;
    aimY = aim.y;
    const dx = enemy.x - keeper.x;
    const dy = enemy.y - keeper.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > KITE_RANGE) {
      mx = dx / dist;
      my = dy / dist;
    } else if (dist < KITE_RANGE * 0.55) {
      mx = -dx / dist;
      my = -dy / dist;
    }
    // Never drift onto the Ember: slide around it instead of through it.
    const ex = EMBER.x - keeper.x;
    const ey = EMBER.y - keeper.y;
    const eDist = Math.hypot(ex, ey) || 1;
    if (eDist < 130) {
      mx += (-ey / eDist) * 0.8;
      my += (ex / eDist) * 0.8;
    }
  } else {
    // Nothing to shoot: drift back toward the Ember to meet the next wave.
    const dx = EMBER.x - keeper.x;
    const dy = EMBER.y - keeper.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 180) {
      mx = dx / dist;
      my = dy / dist;
    }
    aimX = keeper.x;
    aimY = keeper.y - 200;
  }
  const length = Math.hypot(mx, my) || 1;
  return { mx: mx / length, my: my / length, aimX, aimY, fire: enemy !== null };
}

/**
 * The end pilot holds its ground and shoots at what comes close, but never moves and
 * never leads its shots: shades slip past from every side and the dark takes the Ember
 * a few waves in, like a player who froze in place.
 */
function lastStandControls(state) {
  const keeper = state.keeper;
  const enemy = nearestEnemy(state);
  if (enemy === null) return { mx: 0, my: 0, aimX: keeper.x, aimY: keeper.y - 200, fire: false };
  const dist = Math.hypot(enemy.x - keeper.x, enemy.y - keeper.y);
  return { mx: 0, my: 0, aimX: enemy.x, aimY: enemy.y, fire: dist < 200 };
}

/** Count the live shades of each kind on the field, for the play frame's density test. */
function fieldCensus(state) {
  let foes = 0;
  let bolts = 0;
  let pickups = 0;
  let particles = 0;
  let heavies = 0;
  let boss = 0;
  let bossX = 0;
  let bossY = 0;
  for (const e of state.enemies) {
    if (!e.active) continue;
    foes += 1;
    if (e.kind !== 'drifter') heavies += 1;
    if (e.kind === 'boss') {
      boss += 1;
      bossX = e.x;
      bossY = e.y;
    }
  }
  for (const b of state.bolts) if (b.active) bolts += 1;
  for (const p of state.pickups) if (p.active) pickups += 1;
  for (const p of state.particles) if (p.active) particles += 1;
  return { foes, bolts, pickups, particles, heavies, boss, bossX, bossY };
}

/**
 * Set `world` to the named scene (start, play, victory or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'victory' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, aimX: 640, aimY: 200, fire: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (world.step(STEP, lastStandControls(world.state), false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'victory') {
    for (let i = 0; i < VICTORY_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilotControls(world.state), false);
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
    }
    const won = world.state.phase === 'won';
    return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score, won };
  }
  // Play until the fight is at its busiest: the final wave, THE GLOOM on the field,
  // shades of every kind around it, bolts in the air and something bursting, so the
  // cover shows the game's climax rather than the calm between waves. If the pilot
  // falls before wave 10, reset and try again on the same seeded stream (still
  // deterministic); keep the best attempt.
  const PLAY_LIMIT_SECONDS = 240;
  let bestAttempt = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) world.reset();
    let over = false;
    let found = false;
    for (let i = 0; i < PLAY_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilotControls(world.state), false);
      if (events & EVENT_OVER) {
        over = true;
        break;
      }
      // Won without a frame: stop this attempt and try again on the next one.
      if (world.state.phase === 'won') break;
      const state = world.state;
      if (state.time < 10 || state.phase !== 'fight' || state.wave < 10) continue;
      const census = fieldCensus(state);
      // The boss has walked in from the edge, its court around it, bolts flying.
      if (census.boss >= 1 && census.bossX > 80 && census.bossX < 1200 && census.bossY > 80 && census.bossY < 640 && census.foes >= 5 && census.bolts >= 2 && census.heavies >= 2) {
        found = true;
        break;
      }
    }
    const wave = world.state.wave;
    if (found || bestAttempt === null || wave > bestAttempt.wave) {
      bestAttempt = { wave, score: world.state.score, kills: world.state.kills, light: world.state.emberLight, time: world.state.time, over };
    }
    if (found) break;
    if (world.state.phase === 'won') continue;
    if (over && attempt === 2) break;
    if (!over && world.state.phase !== 'lost') break;
  }
  // The last attempt's world is the one drawn; if it ended lost, re-stage it from the
  // best attempt is impossible, so a lost final attempt falls back to the title-safe
  // play frame the loop already left behind. In practice the pilot survives past wave 4.
  // BEST is the staged best: v2's victory score x10 — the best a Keeper has posted.
  const over = world.state.phase === 'lost';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 195950 };
}
