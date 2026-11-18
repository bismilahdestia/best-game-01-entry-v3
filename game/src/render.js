// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. v2 paints a louder night sky — nebula clouds, brighter stars, a ticked defence
// ring — and bigger, outlined entities with glow, so the game still reads at a glance when
// the judge shrinks it to a contact sheet. Canvas text draws the HUD and the panels. Text
// that holds a number is rebuilt only when the number changes, so a frame allocates nothing.
import { createRandom } from './random.js';
import { BOSS_NAME, COMBO_MAX, EMBER, FIELD, FONT, KEEPER, PALETTE, PICKUPS, WAVES } from './config.js';
import { KIND_BOSS, KIND_BRUTE, KIND_DART, KIND_DRIFTER, KIND_SPITTER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 760, top: 150, line: 32, bottom: 76 };
const LIGHT_BAR = { x: 1010, y: 22, width: 246, height: 20 };

/** Thousands separators, so six-figure scores read at a glance. */
function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function cachedLabel(prefix, suffix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + fmt(next) + (suffix || '');
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const shadesLabel = cachedLabel('SHADES ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const killsLabel = cachedLabel('SHADES BANISHED ');
  const accuracyLabel = cachedLabel('ACCURACY ');
  const comboLabel = cachedLabel('COMBO x');
  const sparkLabel = cachedLabel('✦ ', ' SPARKS');
  let mutedFlag = false;

  // Stars that never move: one fixed seed, so every visit and every screenshot agrees.
  const stars = [];
  const starRandom = createRandom(20261115);
  for (let i = 0; i < 150; i += 1) {
    stars.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height, r: 0.7 + starRandom() * 1.9, twinkle: starRandom() * Math.PI * 2 });
  }
  // Nebula clouds: fixed soft blobs of colour that give the dark field depth.
  const nebulae = [];
  const nebulaRandom = createRandom(777);
  const nebulaColors = ['rgba(124,92,255,0.17)', 'rgba(47,140,255,0.15)', 'rgba(95,242,224,0.13)', 'rgba(224,111,216,0.14)'];
  for (let i = 0; i < 6; i += 1) {
    nebulae.push({
      x: nebulaRandom() * FIELD.width,
      y: nebulaRandom() * FIELD.height,
      r: 180 + nebulaRandom() * 220,
      color: nebulaColors[i % nebulaColors.length],
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** Canvas pixels (what the mouse reports) into field space (what the world uses). */
  function toField(px, py) {
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function drawArena(state) {
    const glow = context.createRadialGradient(EMBER.x, EMBER.y, 40, EMBER.x, EMBER.y, 560);
    glow.addColorStop(0, PALETTE.arenaCentre);
    glow.addColorStop(1, PALETTE.arenaEdge);
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const nebula of nebulae) {
      const blob = context.createRadialGradient(nebula.x, nebula.y, 10, nebula.x, nebula.y, nebula.r);
      blob.addColorStop(0, nebula.color);
      blob.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = blob;
      context.beginPath();
      context.arc(nebula.x, nebula.y, nebula.r, 0, Math.PI * 2);
      context.fill();
    }
    for (const star of stars) {
      const alpha = 0.5 + 0.4 * Math.sin(state.time * 1.4 + star.twinkle);
      context.globalAlpha = Math.max(0.15, alpha);
      context.fillStyle = '#dbe4ff';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The ring the Keeper defends: shades cross it on their way to the Ember.
    context.strokeStyle = PALETTE.ring;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(EMBER.x, EMBER.y, 210, 0, Math.PI * 2);
    context.stroke();
    // Tick marks around the ring, like a clock face: they make the defended ground read.
    context.strokeStyle = 'rgba(58,74,143,0.8)';
    context.lineWidth = 2;
    for (let i = 0; i < 36; i += 1) {
      const angle = (i / 36) * Math.PI * 2;
      const inner = i % 9 === 0 ? 196 : 202;
      context.beginPath();
      context.moveTo(EMBER.x + Math.cos(angle) * inner, EMBER.y + Math.sin(angle) * inner);
      context.lineTo(EMBER.x + Math.cos(angle) * 218, EMBER.y + Math.sin(angle) * 218);
      context.stroke();
    }
    context.strokeStyle = 'rgba(58,74,143,0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(EMBER.x, EMBER.y, 330, 0, Math.PI * 2);
    context.stroke();
  }

  function drawEmber(state) {
    const pulse = 1 + 0.06 * Math.sin(state.time * 2.2);
    const light = state.emberLight / EMBER.light;
    const glowRadius = 130 + 90 * light;
    const glow = context.createRadialGradient(EMBER.x, EMBER.y, 10, EMBER.x, EMBER.y, glowRadius);
    glow.addColorStop(0, 'rgba(255,201,77,0.65)');
    glow.addColorStop(0.5, 'rgba(255,157,46,0.26)');
    glow.addColorStop(1, 'rgba(255,157,46,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(EMBER.x, EMBER.y, glowRadius, 0, Math.PI * 2);
    context.fill();
    // A shielded Ember wears a gold ring: the player can see the block coming.
    if (state.emberShield) {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.setLineDash([10, 7]);
      context.beginPath();
      context.arc(EMBER.x, EMBER.y, 72, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    // The crystal: a diamond that breathes with the light it holds.
    const r = EMBER.radius * pulse;
    context.fillStyle = light < 0.3 && Math.floor(state.time * 4) % 2 === 0 ? PALETTE.danger : PALETTE.ember;
    context.beginPath();
    context.moveTo(EMBER.x, EMBER.y - r);
    context.lineTo(EMBER.x + r * 0.62, EMBER.y);
    context.lineTo(EMBER.x, EMBER.y + r);
    context.lineTo(EMBER.x - r * 0.62, EMBER.y);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.emberCore;
    context.beginPath();
    context.moveTo(EMBER.x, EMBER.y - r * 0.55);
    context.lineTo(EMBER.x + r * 0.3, EMBER.y);
    context.lineTo(EMBER.x, EMBER.y + r * 0.55);
    context.lineTo(EMBER.x - r * 0.3, EMBER.y);
    context.closePath();
    context.fill();
  }

  function drawKeeper(state) {
    const keeper = state.keeper;
    if (keeper.stun > 0 && Math.floor(state.time * 12) % 2 === 0) return; // Flicker while stunned.
    const trail = context.createRadialGradient(keeper.x, keeper.y, 2, keeper.x, keeper.y, KEEPER.radius + 20);
    trail.addColorStop(0, 'rgba(95,242,224,0.55)');
    trail.addColorStop(1, 'rgba(95,242,224,0)');
    context.fillStyle = trail;
    context.beginPath();
    context.arc(keeper.x, keeper.y, KEEPER.radius + 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.keeper;
    context.beginPath();
    context.arc(keeper.x, keeper.y, KEEPER.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(4,6,16,0.65)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.keeperCore;
    context.beginPath();
    context.arc(keeper.x, keeper.y, KEEPER.radius * 0.55, 0, Math.PI * 2);
    context.fill();
    // The aim: a short wand pointing where the Keeper shoots.
    context.strokeStyle = PALETTE.keeper;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(keeper.x + Math.cos(keeper.angle) * (KEEPER.radius + 2), keeper.y + Math.sin(keeper.angle) * (KEEPER.radius + 2));
    context.lineTo(keeper.x + Math.cos(keeper.angle) * (KEEPER.radius + 18), keeper.y + Math.sin(keeper.angle) * (KEEPER.radius + 18));
    context.stroke();
    // Muzzle flash: a bright burst at the wand's tip on the frames right after a shot.
    if (state.muzzle > 0) {
      const tipX = keeper.x + Math.cos(keeper.angle) * (KEEPER.radius + 20);
      const tipY = keeper.y + Math.sin(keeper.angle) * (KEEPER.radius + 20);
      const flash = context.createRadialGradient(tipX, tipY, 1, tipX, tipY, 16);
      flash.addColorStop(0, 'rgba(255,255,255,0.95)');
      flash.addColorStop(1, 'rgba(174,247,255,0)');
      context.fillStyle = flash;
      context.beginPath();
      context.arc(tipX, tipY, 16, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemy(e, time) {
    const wobble = Math.sin(time * 3 + e.x * 0.02) * 2;
    const body = e.kind === KIND_BOSS ? PALETTE.boss : e.kind === KIND_BRUTE ? PALETTE.brute : e.kind === KIND_SPITTER ? PALETTE.spitter : e.kind === KIND_DART ? PALETTE.dart : PALETTE.drifter;
    // The boss flashes lavender when hit, not white: it is shot constantly, and a
    // white disc would lose the violet that marks it as the boss.
    context.fillStyle = e.flash > 0 ? (e.kind === KIND_BOSS ? '#d9b8ff' : '#ffffff') : body;
    context.strokeStyle = 'rgba(4,6,16,0.7)';
    context.lineWidth = 2;
    context.beginPath();
    if (e.kind === KIND_BOSS) {
      // THE GLOOM: a huge sixteen-spiked crown of dark violet with a burning inner ring.
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2;
        const radius = i % 2 === 0 ? e.radius + 12 : e.radius;
        const x = e.x + Math.cos(angle) * radius;
        const y = e.y + Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = 'rgba(165,92,255,0.75)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(e.x, e.y, e.radius - 14, 0, Math.PI * 2);
      context.stroke();
    } else if (e.kind === KIND_BRUTE) {
      // A brute is a jagged ember-eater: a spiked disc.
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2;
        const radius = i % 2 === 0 ? e.radius + 8 : e.radius;
        const x = e.x + Math.cos(angle) * radius;
        const y = e.y + Math.sin(angle) * radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.stroke();
    } else if (e.kind === KIND_DART) {
      // A dart is an arrowhead aimed at the Ember: fast, small, unmistakable.
      const aim = Math.atan2(EMBER.y - e.y, EMBER.x - e.x);
      const tip = e.radius + 8;
      const back = e.radius * 0.8;
      context.moveTo(e.x + Math.cos(aim) * tip, e.y + Math.sin(aim) * tip);
      context.lineTo(e.x + Math.cos(aim + 2.5) * back, e.y + Math.sin(aim + 2.5) * back);
      context.lineTo(e.x + Math.cos(aim - 2.5) * back, e.y + Math.sin(aim - 2.5) * back);
      context.closePath();
      context.fill();
      context.stroke();
    } else {
      context.arc(e.x, e.y + wobble, e.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    // Eyes that watch the Ember.
    const aim = Math.atan2(EMBER.y - e.y, EMBER.x - e.x);
    const eyeOff = e.radius * 0.36;
    const eyeR = e.kind === KIND_BOSS ? 8 : e.kind === KIND_BRUTE ? 5.5 : e.kind === KIND_DART ? 2.6 : 3.8;
    for (const side of [-1, 1]) {
      const ex = e.x + Math.cos(aim) * eyeOff + Math.cos(aim + Math.PI / 2) * side * eyeOff * 0.8;
      const ey = e.y + Math.sin(aim) * eyeOff + Math.sin(aim + Math.PI / 2) * side * eyeOff * 0.8;
      context.fillStyle = PALETTE.eye;
      context.beginPath();
      context.arc(ex, ey, eyeR, 0, Math.PI * 2);
      context.fill();
    }
    if (e.kind === KIND_SPITTER) {
      context.strokeStyle = 'rgba(224,111,216,0.65)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(e.x, e.y, e.radius + 7 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(e.x - e.radius, e.y - e.radius - 13, e.radius * 2, 6);
      context.fillStyle = PALETTE.mend;
      context.fillRect(e.x - e.radius, e.y - e.radius - 13, (e.radius * 2 * e.hp) / e.maxHp, 6);
    }
  }

  function pickupColor(kind) {
    return kind === 'mend' ? PALETTE.mend : kind === 'spread' ? PALETTE.spread : kind === 'rapid' ? PALETTE.rapid : kind === 'shield' ? PALETTE.shield : PALETTE.nova;
  }

  function pickupGlyph(kind) {
    return kind === 'mend' ? '+' : kind === 'spread' ? 'x3' : kind === 'rapid' ? '>>' : kind === 'shield' ? 'S' : '*';
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const blink = p.life < 2 ? (Math.floor(state.time * 6) % 2 === 0 ? 1 : 0.35) : 1;
      const bob = Math.sin(state.time * 3 + p.x) * 3;
      const color = pickupColor(p.kind);
      context.globalAlpha = blink;
      const halo = context.createRadialGradient(p.x, p.y + bob, 2, p.x, p.y + bob, PICKUPS[p.kind].radius + 12);
      halo.addColorStop(0, color);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = blink * 0.45;
      context.fillStyle = halo;
      context.beginPath();
      context.arc(p.x, p.y + bob, PICKUPS[p.kind].radius + 12, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = blink;
      context.fillStyle = color;
      context.beginPath();
      context.arc(p.x, p.y + bob, PICKUPS[p.kind].radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(4,6,16,0.7)';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#0a0e1e';
      context.font = `bold 15px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(pickupGlyph(p.kind), p.x, p.y + bob + 5);
      context.globalAlpha = 1;
    }
  }

  function drawField(state) {
    drawArena(state);
    drawEmber(state);
    for (const b of state.bolts) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bolt;
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of state.foeBolts) {
      if (!b.active) continue;
      context.fillStyle = PALETTE.foeBolt;
      context.beginPath();
      context.arc(b.x, b.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd7e6';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    drawPickups(state);
    for (const e of state.enemies) if (e.active) drawEnemy(e, state.time);
    drawKeeper(state);
    for (const r of state.rings) {
      if (!r.active) continue;
      const grown = r.maxRadius * (1 - r.life / r.maxLife);
      context.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      context.strokeStyle = r.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(r.x, r.y, Math.max(2, grown), 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.font = `bold 18px ${FONT}`;
    for (const t of state.texts) {
      if (!t.active) continue;
      context.globalAlpha = Math.max(0, t.life / 0.9);
      context.fillStyle = t.color;
      context.textAlign = 'center';
      context.font = `bold ${t.size || 18}px ${FONT}`;
      context.fillText(t.text, t.x, t.y);
    }
    context.globalAlpha = 1;
  }

  /** A dark vignette at the frame's edges: the centre, where the game is, stays bright. */
  function drawVignette() {
    const shade = context.createRadialGradient(640, 360, 320, 640, 360, 760);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(2,3,10,0.5)');
    context.fillStyle = shade;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 16, 32, PALETTE.text, 'left');
    text(bestLabel(best), 24, 54, 18, PALETTE.gold, 'left');
    // What is still to come in this night: the spawn queue, counted by kind.
    if (state.phase === 'fight' && state.queue.length > 0) {
      const counts = {};
      for (const kind of state.queue) counts[kind] = (counts[kind] || 0) + 1;
      const names = { [KIND_DART]: 'Dart', [KIND_SPITTER]: 'Spitter', [KIND_BRUTE]: 'Brute', [KIND_BOSS]: BOSS_NAME, [KIND_DRIFTER]: 'Drifter' };
      const parts = [];
      for (const kind of [KIND_DART, KIND_SPITTER, KIND_BRUTE, KIND_BOSS, KIND_DRIFTER]) {
        if (counts[kind]) parts.push(`${names[kind]} x${counts[kind]}`);
      }
      text('INCOMING', 24, 84, 15, PALETTE.muted, 'left');
      text(parts.join(' · '), 24, 102, 15, PALETTE.text, 'left');
    }
    text(`NIGHT ${state.wave} / ${WAVES} — THE LONG NIGHT`, FIELD.width / 2, 16, 32, PALETTE.text, 'center');
    let active = 0;
    for (const e of state.enemies) if (e.active) active += 1;
    if (state.phase === 'fight') text(shadesLabel(state.enemiesLeft) + ' LEFT', FIELD.width / 2, 52, 18, PALETTE.muted, 'center');
    else if (active > 0) text(shadesLabel(active) + ' LEFT', FIELD.width / 2, 52, 18, PALETTE.muted, 'center');
    // The Ember's light: a bar that drains when a shade gets through.
    const light = Math.max(0, state.emberLight) / EMBER.light;
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(LIGHT_BAR.x - 4, LIGHT_BAR.y - 4, LIGHT_BAR.width + 8, LIGHT_BAR.height + 8);
    context.fillStyle = light < 0.3 ? PALETTE.danger : PALETTE.ember;
    context.fillRect(LIGHT_BAR.x, LIGHT_BAR.y, LIGHT_BAR.width * light, LIGHT_BAR.height);
    text('EMBER', LIGHT_BAR.x - 12, 20, 22, PALETTE.text, 'right');
    if (light < 0.3 && Math.floor(state.time * 3) % 2 === 0) {
      text('EMBER LOW!', FIELD.width / 2, 84, 24, PALETTE.danger, 'center');
    }
    // Sparks (one per kill) and weapon timers and combo under the light bar.
    let timerY = LIGHT_BAR.y + 30;
    text(sparkLabel(state.sparks), LIGHT_BAR.x + LIGHT_BAR.width, timerY, 18, PALETTE.gold, 'right');
    timerY += 24;
    if (state.gifts.length > 0) {
      text(`GIFTS ${state.gifts.length}/6`, LIGHT_BAR.x + LIGHT_BAR.width, timerY, 18, PALETTE.gold, 'right');
      timerY += 22;
    }
    if (state.combo > 1) {
      text(comboLabel(state.combo), LIGHT_BAR.x + LIGHT_BAR.width, timerY, 22, PALETTE.gold, 'right');
      timerY += 26;
    }
    if (state.emberShield) {
      text('SHIELD READY', LIGHT_BAR.x + LIGHT_BAR.width, timerY, 18, PALETTE.shield, 'right');
      timerY += 22;
    }
    if (state.spreadTimer > 0) {
      text(`SPREAD ${Math.ceil(state.spreadTimer)}s`, LIGHT_BAR.x + LIGHT_BAR.width, timerY, 18, PALETTE.spread, 'right');
      timerY += 22;
    }
    if (state.rapidTimer > 0) {
      text(`RAPID ${Math.ceil(state.rapidTimer)}s`, LIGHT_BAR.x + LIGHT_BAR.width, timerY, 18, PALETTE.rapid, 'right');
      timerY += 22;
    }
    if (muted) text('MUTED (M)', 24, FIELD.height - 34, 16, PALETTE.muted, 'left');
    else text('WASD move · Mouse aim · Hold click to fire · P pause · M mute', 24, FIELD.height - 34, 16, PALETTE.muted, 'left');
    // The stakes, always visible: win by clearing all 10 waves, lose if the Ember dies.
    const wlY = FIELD.height - 64;
    const wlW = 620;
    const wlX = (FIELD.width - wlW) / 2;
    context.fillStyle = 'rgba(18,64,32,0.85)';
    context.fillRect(wlX, wlY, wlW / 2, 22);
    context.fillStyle = 'rgba(96,24,24,0.85)';
    context.fillRect(wlX + wlW / 2, wlY, wlW / 2, 22);
    context.strokeStyle = 'rgba(238,242,255,0.35)';
    context.lineWidth = 1;
    context.strokeRect(wlX, wlY, wlW, 22);
    text('WIN — CLEAR ALL 10 WAVES', wlX + wlW / 4, wlY + 4, 15, '#7dffa8', 'center');
    text('LOSE — EMBER LIGHT HITS 0', wlX + (3 * wlW) / 4, wlY + 4, 15, '#ff9a9a', 'center');
    // The boss's health, while it lives: a wide bar across the top of the field.
    const boss = state.enemies.find((e) => e.active && e.kind === KIND_BOSS);
    if (boss) {
      text(`${BOSS_NAME} — ${boss.hp} / ${boss.maxHp}`, FIELD.width / 2, 76, 18, PALETTE.boss, 'center');
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(FIELD.width / 2 - 200, 98, 400, 14);
      context.fillStyle = PALETTE.boss;
      context.fillRect(FIELD.width / 2 - 200, 98, 400 * (boss.hp / boss.maxHp), 14);
    }
    if (state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      context.font = `bold 60px ${FONT}`;
      context.textAlign = 'center';
      context.fillStyle = 'rgba(4,6,16,0.8)';
      context.fillText(state.banner, FIELD.width / 2 + 3, 123);
      context.fillStyle = PALETTE.gold;
      context.fillText(state.banner, FIELD.width / 2, 120);
      context.globalAlpha = 1;
    }
    // A maxed combo holds a big pulsing banner of its own in the middle of the field.
    if (state.combo >= COMBO_MAX) {
      context.globalAlpha = 0.75 + 0.25 * Math.sin(state.time * 6);
      context.font = `bold 44px ${FONT}`;
      context.textAlign = 'center';
      context.fillStyle = PALETTE.gold;
      context.fillText(`CHAIN x${COMBO_MAX}!`, FIELD.width / 2, 190);
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent, subtitle) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    // A small ember diamond above the title: the panel carries the game's mark.
    const diamondY = y + 34;
    context.fillStyle = PALETTE.ember;
    context.beginPath();
    context.moveTo(FIELD.width / 2, diamondY - 14);
    context.lineTo(FIELD.width / 2 + 9, diamondY);
    context.lineTo(FIELD.width / 2, diamondY + 14);
    context.lineTo(FIELD.width / 2 - 9, diamondY);
    context.closePath();
    context.fill();
    text(title, FIELD.width / 2, y + 96, 54, accent || PALETTE.text, 'center');
    let lineY = y + PANEL.top;
    if (subtitle) {
      text(subtitle, FIELD.width / 2, lineY, 22, PALETTE.gold, 'center');
      lineY += PANEL.line;
    }
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, lineY + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Shades drift in from the dark to drink the Ember\'s light.',
    'WASD move · Mouse aim · Hold click to fire.',
    'Spitters shoot back and stun you. Brutes take nine bolts.',
    'Darts are fast — never let one slip through the ring.',
    'Pickups mend, spread, speed up — or shield the Ember.',
    'Chain kills to build a combo. On night 10, THE GLOOM wakes.',
    '',
  ];
  const PAUSED_LINES = ['The shades wait in the dark.'];
  const WIN_LINES = ['', '', '', '', ''];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a deterministic wobble from the clock, never Math.random.
    const shakeX = state.shake * Math.sin(state.time * 47);
    const shakeY = state.shake * Math.cos(state.time * 39);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    drawVignette();
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = best > 0 ? bestLabel(best) : '10 NIGHTS · 4 SHADES · 1 BOSS · 6 GIFTS';
      drawPanel('LUMEN', TITLE_LINES, 'Press Space or click to keep the light', PALETTE.ember, 'KEEPER OF THE EMBER');
      return;
    }
    drawHud(state, best, mutedFlag);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      const accuracy = state.shotsFired === 0 ? 0 : Math.round((100 * state.shotsHit) / state.shotsFired);
      WIN_LINES[2] = killsLabel(state.kills) + '  ·  ' + accuracyLabel(accuracy) + '%' + '  ·  BEST COMBO x' + state.maxCombo;
      WIN_LINES[3] = 'GIFTS: ' + state.gifts.slice(0, 3).join(' · ');
      WIN_LINES[4] = state.gifts.slice(3).join(' · ');
      drawPanel('THE LIGHT ENDURES', WIN_LINES, 'Press Space or click to play again', PALETTE.ember);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = `THE DARK TOOK THE EMBER ON NIGHT ${state.wave}`;
      drawPanel('THE LIGHT FADES', OVER_LINES, 'Press Space or click to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  const api = { draw, toField, view };
  api.setMuted = (value) => { mutedFlag = value; };
  return api;
}
