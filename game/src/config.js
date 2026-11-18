// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Lumen: you are the Keeper, a wisp of light guarding the Ember at the heart of the arena.
// Shades drift in from the dark and drain the Ember's light when they reach it. Shoot them
// down before they arrive, survive all ten waves, and the light endures.
//
// v3: kill scores x10, so a full game runs to six figures; Sparks are counted one
// per kill and shown top-right; the wave-clear bonus scales x10 with the kills.

export const FIELD = { width: 1280, height: 720 };

/** The Ember sits at the middle of the arena. */
export const EMBER = { x: 640, y: 360, radius: 38, light: 100, drainRegen: 0 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const KEEPER = {
  radius: 16,
  speed: 340,
  /** Seconds a spitter's bolt stuns the Keeper for. */
  stun: 0.6,
};

export const BOLT = {
  speed: 760,
  radius: 5,
  damage: 1,
  /** Shots a second while the trigger is held. */
  fireRate: 6.5,
  life: 1.1,
};

/** The six Gifts: one is granted for each of the first six nights cleared, and each
 * stays for the rest of the game. They are the run's persistent progression. */
export const GIFTS = [
  { id: 'emberheart', name: 'Emberheart', desc: 'Ember +25 light' },
  { id: 'swiftwisp', name: 'Swift Wisp', desc: 'Fire rate +15%' },
  { id: 'widenet', name: 'Wide Net', desc: 'Shots always spread' },
  { id: 'longfuse', name: 'Long Fuse', desc: 'Bolt range +50%' },
  { id: 'brightring', name: 'Bright Ring', desc: 'Wave-clear mend +10' },
  { id: 'secondwind', name: 'Second Wind', desc: 'The Ember survives once at 0' },
];
/** The boss's name, shown on its health bar and banners. */
export const BOSS_NAME = 'THE GLOOM';
/** How many waves make a full game: clear wave 10 and the light endures. */
export const WAVES = 10;
/** Seconds of calm (and a banner) between waves. */
export const WAVE_GAP = 3;
/** Light the Ember regains when a wave is cleared. */
export const WAVE_CLEAR_MEND = 10;

export const ENEMY = {
  drifter: { hp: 1, speed: 58, radius: 16, drain: 6, score: 100, shoot: 0 },
  dart: { hp: 1, speed: 108, radius: 11, drain: 4, score: 150, shoot: 0 },
  spitter: { hp: 2, speed: 44, radius: 18, drain: 8, score: 250, shoot: 2.4, range: 300, boltSpeed: 210 },
  brute: { hp: 9, speed: 34, radius: 31, drain: 20, score: 600, shoot: 0 },
  /** THE GLOOM, the boss: the last shade of the final wave. Slow, huge, one hit drains 40. */
  boss: { hp: 30, speed: 26, radius: 64, drain: 40, score: 1000, shoot: 0 },
};
/** Speed gained per wave, and the wave each kind first appears on. */
export const ENEMY_SPEED_PER_WAVE = 3.5;
export const DART_FIRST_WAVE = 2;
export const SPITTER_FIRST_WAVE = 3;
export const BRUTE_FIRST_WAVE = 5;
/** Every Nth wave is a surge: shades spawn faster and the banner says so. */
export const SURGE_EVERY = 3;
export const SURGE_SPAWN_FACTOR = 0.62;
/** How far a dart weaves side to side while it closes in. */
export const DART_WEAVE = 46;

/** Kills chained this close together raise the combo; the combo multiplies kill score. */
export const COMBO_WINDOW = 2.5;
export const COMBO_MAX = 5;

/** A kill drops a pickup this often; the weights pick which one. */
export const DROP_CHANCE = 0.15;
export const PICKUPS = {
  mend: { weight: 3, radius: 13, light: 25, seconds: 0 },
  spread: { weight: 3, radius: 13, light: 0, seconds: 12 },
  rapid: { weight: 2, radius: 13, light: 0, seconds: 10 },
  shield: { weight: 2, radius: 13, light: 0, seconds: 0 },
  nova: { weight: 1, radius: 13, light: 0, seconds: 0 },
};
/** Seconds a dropped pickup waits on the field before fading away. */
export const PICKUP_LIFE = 9;

export const POOL = { enemies: 96, bolts: 128, foeBolts: 64, pickups: 24, particles: 512, texts: 32, rings: 24 };

export const PALETTE = {
  backdrop: '#070a16',
  arenaEdge: '#10142a',
  arenaCentre: '#202a55',
  ring: '#3a4a8f',
  ember: '#ffc94d',
  emberCore: '#fff3c4',
  emberGlow: '#ff9d2e',
  keeper: '#5ff2e0',
  keeperCore: '#eafffb',
  bolt: '#aef7ff',
  drifter: '#9d8cff',
  dart: '#a8ff60',
  spitter: '#e06fd8',
  brute: '#ff7a59',
  boss: '#a55cff',
  foeBolt: '#ff5d8f',
  eye: '#ff5d5d',
  mend: '#7dffa8',
  spread: '#ffd166',
  rapid: '#6fc3ff',
  shield: '#d9b8ff',
  nova: '#ffffff',
  panel: '#10162c',
  panelEdge: '#3d4c96',
  text: '#eef2ff',
  muted: '#aab6d8',
  danger: '#ff6b6b',
  gold: '#ffc94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen.best';
