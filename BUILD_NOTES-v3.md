# Lumen v3 — BUILD_NOTES

Base: a copy of bot-v2 (HEAD 6009da7), committed as `6919d93` ("Lumen v3 base:
copy of v2"). All five top-100 winning-pattern patches landed, in order 2, 1, 3, 5,
4. Original code only — patterns, never copies from any other entry. bot-v2 was
never touched; nothing was submitted by this builder.

## Patch 2 — score x10, BEST in HUD, Sparks currency (commit 8a859ca)

- `config.js`: kill scores x10 (drifter 100, dart 150, spitter 250, brute 600);
  wave-clear bonus 50 → 500/wave. Boss score 1000 (see Patch 1).
- `world.js`: `state.sparks` counts 1 per kill (reset in `reset()`).
- `render.js`: numbers comma-formatted via `fmt()` inside `cachedLabel` (suffix
  support kept); HUD shows BEST (gold, under SCORE) and "✦ N SPARKS" top-right
  under the light bar; `drawHud` takes `best`; play staging returns a staged
  BEST (v2 victory score x10).
- Sim after Patch 2: play 136,850 / victory 195,950 / end 1,800, deterministic.

## Patch 1 — THE GLOOM boss + permanent WIN/LOSE bar (commit 8435ffb)

- `config.js`: boss spec `{hp 30, speed 26, radius 64, drain 40, score 1000}`,
  `BOSS_NAME = 'THE GLOOM'`, `PALETTE.boss = '#a55cff'`.
- `world.js`: `KIND_BOSS`; the boss is pushed LAST in the wave-10 queue (after the
  shuffle), so it walks in as the final shade; "THE GLOOM WAKES!" banner on spawn,
  "THE GLOOM FALLS!" + shake on boss kill. Boss hit-flash is lavender (`#d9b8ff`)
  instead of white: the pilot shoots it constantly, and a white disc would lose
  the violet that marks it as the boss.
- `render.js`: boss drawn as a 16-spiked violet crown disc with inner ring + big
  eyes (eyeR 8); permanent bottom WIN/LOSE bar (green "WIN — CLEAR ALL 10 WAVES"
  / red "LOSE — EMBER LIGHT HITS 0", 620×22 at y FIELD.height−64); boss HP bar
  top-center ("THE GLOOM — hp/maxHp" + 400×14 bar) while a boss lives.
- `shots.js`: autopilot targets a live boss first; `fieldCensus` counts boss +
  bossX/bossY; play staging requires wave ≥10 + boss alive and in-bounds
  (80..1200 x, 80..640 y) + foes ≥10 + bolts ≥2 + heavies ≥3 + (pickups ≥1 or
  particles ≥12); PLAY_LIMIT_SECONDS 150 → 240; a won-without-frame attempt
  retries instead of falling back.
- **Staging failure, diagnosed and fixed:** the first run hit the 240 s limit and
  returned the WON state as the PLAY screen — the pilot kills shades (~2.5/s)
  faster than wave 10 spawns them, so by the time the boss spawns last (~15 s
  into wave 10) almost all 36 shades are already dead and foes ≥10 never holds
  during the boss window. Fix: (a) the boss arrives with a court — on boss
  spawn, 4 drifters + 2 darts are pushed into the queue and `enemiesLeft += 6`;
  (b) staging threshold relaxed to foes ≥5, heavies ≥2. After the fix the play
  frame is captured at wave 10 with the boss alive (181,400, kills 215, 174 s).
- Sim after Patch 1: play 181,400 / victory 194,950 / end 1,800, deterministic.
  (Victory kills 221 vs 218 before — the 3 extra kills are the escort.)

## Patch 3 — cover density, CHAIN x5! banner, bigger popups, stronger glow (commit 8435ffb)

- `world.js`: floating score popups get a `size` (18 default; 24 at combo ≥3,
  30 at combo x5, 34 for the boss kill).
- `render.js`: ember glow radius 130 + 90·light (was 110 + 70·light), glow alphas
  0.65/0.26 (was 0.6/0.22); nebula alphas raised ~0.04 each; popups drawn at
  their own size; a maxed combo holds a big pulsing gold "CHAIN x5!" (44 px) at
  the middle of the field for as long as the combo is maxed.
- Cover density comes from Patch 1's boss + court: the captured frame shows the
  boss, ≥10 shades, a brute, bolts and a pickup.
- Sim unchanged (visual only): play 181,400 / victory 194,950 / end 1,800.

## Patch 5 — NIGHT naming, text only (commit 8435ffb)

- HUD: "NIGHT 9 / 10 — THE LONG NIGHT"; wave banners "NIGHT n" / "NIGHT n —
  SURGE!"; title line "Chain kills to build a combo. On night 10, THE GLOOM
  wakes."; title fallback "10 NIGHTS · 4 SHADES · 1 BOSS"; game-over line "THE
  DARK TOOK THE EMBER ON NIGHT n"; screen-reader announces updated to nights.
  (The fallback became "… · 1 BOSS · 6 GIFTS" once Patch 4 landed.)
- Sim unchanged: play 181,400 / victory 194,950 / end 1,800.

## Patch 4 — INCOMING queue + 6 named Gifts (commit 83a097c)

- `config.js`: `GIFTS` — Emberheart (+25 light), Swift Wisp (fire rate +15%),
  Wide Net (shots always spread), Long Fuse (bolt range +50%), Bright Ring
  (wave-clear mend +10), Second Wind (the Ember survives once at 0). One granted
  per night cleared, for the first six nights, in that fixed order.
- `world.js`: `state.gifts` (names granted), `secondWind`, `fireRateMult`,
  `boltLifeMult`, `spreadGift`, `mendBonus` (all reset in `reset()`); `grantGift()`
  applies the effect at once and raises a "GIFT — <NAME>!" banner (2.2 s) + a
  gold ring at the Ember. The grant runs AFTER the next-night banner is set, so
  the gift banner replaces it for the gap. Fire rate uses `fireRateMult`; spread
  fires when `spreadTimer > 0 || spreadGift`; bolt life uses `boltLifeMult`;
  wave-clear mend uses `WAVE_CLEAR_MEND + mendBonus`; Second Wind restores the
  Ember to 30 with a "SECOND WIND!" banner instead of losing the run, once.
  `state.queue` is exposed on the state for the HUD.
- `render.js`: left column "INCOMING" panel during a fight (queue counted by
  kind: Dart / Spitter / Brute / THE GLOOM / Drifter); right column "GIFTS n/6"
  (shown once the first gift is earned); victory panel lists all six gift names
  on two lines.
- No pick-1-of-2 choice variant (out of scope by design — no time, and the
  fixed order keeps the run deterministic).
- Sim after Patch 4: play 189,950 (wave 10, kills 221, light 100) / victory
  **209,950 won** (kills 231, light 100, gifts = all six in order) / end 1,900
  (wave 3, lost), deterministic. The gifts make the run stronger (victory
  194,950 → 209,950, light 70 → 100) and the loss still happens.

## Final sim (sim-test-v3.mjs, Node, seeded)

```
play:     screen=play score=189950 wave=10 light=100 kills=221 time=172s
victory:  screen=win  won=true score=209950 wave=10 light=100 kills=231 time=171s
          gifts=Emberheart,Swift Wisp,Wide Net,Long Fuse,Bright Ring,Second Wind
end:      screen=over score=1900 wave=3 light=0 kills=4 time=62s
deterministic play: true score 189950
```

Victory is achievable, loss is still possible, same seed → same score.

## Screenshots (all 4 re-rendered + viewed, final build, 15:26 UTC)

Rendered with `node render-shots-v3.mjs` (puppeteer + chrome-headless-shell at
`~/workspace/makefun/threejs-fps-02-render/chrome-headless-shell-linux64/chrome-headless-shell`,
args `--no-sandbox --disable-gpu --use-angle=swiftshader
--enable-unsafe-swiftshader --no-proxy-server`) while
`node bot-v3/serve.ts --port 8124` runs. All `shotReady OK`, zero errors.

- `1-play.jpg` (84,371 B): cover at wave 10 — THE GLOOM alive (22/30 HP, boss HP
  bar top-center, lavender crown disc bottom-right), "THE GLOOM WAKES!" + "CHAIN
  x5!" banners, SCORE 189,950 / BEST 195,950 / ✦ 221 SPARKS / GIFTS 6/6 /
  COMBO x5, INCOMING panel (Dart x2 — the queue is nearly spent this late in
  wave 10), big "+750 x5" popup, spread bolts across the field, WIN/LOSE bar.
- `2-start.jpg` (66,507 B): title panel clean, no overflow — "10 NIGHTS ·
  4 SHADES · 1 BOSS · 6 GIFTS", "On night 10, THE GLOOM wakes.", "Press Space
  or click to keep the light".
- `3-victory.jpg` (84,266 B): "THE LIGHT ENDURES", SCORE 209,950, BEST 209,950,
  SHADES BANISHED 231 · ACCURACY 17% · BEST COMBO x5, "GIFTS: Emberheart ·
  Swift Wisp · Wide Net / Long Fuse · Bright Ring · Second Wind", "Press Space
  or click to play again".
- `4-end.jpg` (65,333 B): "THE LIGHT FADES", SCORE 1,900, "THE DARK TOOK THE
  EMBER ON NIGHT 3", "Press Space or click to try again", GIFTS 2/6 (the
  losing pilot had cleared 2 nights), EMBER bar empty.

All ≤256 KiB, 1280×800.

## Kit check (level-20 kit, builder-only bundle)

Bundle `~/workspace/makefun/best-game-01/transcripts-v3-builder.tar.gz`
(4,627,175 B, sha256 `c681ddb75f46a28256831e22744143073740f1ac03a469ecb9615bab323ee0f5`)
from my session only + `--parent-session` of the parent chat (the first bundle
attempt without it failed: my session opens with a resumed-conversation summary,
so the run record was not whole; adding the parent session fixed it — run
record whole, prompt handed-off, system prompt uploaded).

Check from `~/workspace/makefun/best-game-01-kit-v2/best-game-01-kit/`:
**11 passed, 2 failed, 6 skipped, 5 at-submission** — both failures are the
expected builder-only ones the parent re-bundles to fix:

- FAIL `thinking_reproduces` 161/1408 (11.4%) — most lines are v2 code brought
  in with `cp -r`; fix is the parent's re-bundle including the v1 builder
  session (`01ac16c4-5b5b-4bd8-b980-acb044df9183`) and the v2 builder session
  (`cefb7209-ffe7-4edf-8c53-930d467bb15b`).
- FAIL `thinking_priced` 0 usage rows — my rows land after my run; fix is the
  parent's muse.db SELECT for the parent + v3 builder ids and a re-bundle with
  `--muse-usage`.
- Passing: competition_open, snapshot (20 files, 442,426 B at 83a097c),
  license_osi (MIT), entrypoint (main.ts, node22), transcripts_present,
  transcripts_recorded, thinking_wellformed, thinking_in_window (all 195
  timestamps in window), thinking_turns (52), thinking_revised,
  transcripts_run_record.
- At-submission (parent's job at submit): repo_public, repo_owner
  (`.makefun/owner.json` IS committed in bot-v3), repo_created_after_open,
  commit_in_repo, duplicate_snapshot.

## What the parent must do (not done here)

1. Re-bundle from the LIVE sessions (v1 builder + v2 builder + v3 builder
   `bf93ea27-ac39-4b3a-916e-8dbc382b76df` + parent `0c2963cf-dc21-468c-8ee0-f215adab48b3`)
   with discovery on, `--system-prompt ~/workspace/system/system_prompt.md`,
   and the usage file from muse.db (parent + all three builders) — re-check to
   0 fail.
2. Create public repo `best-game-01-entry-v3` (README.md already carries the
   v3 badge URLs and the v3 description; `.makefun/owner.json` already in the
   repo) + set About, verify via API tree + `git hash-object`, submit signed,
   save `submission-v3.json` (mode 600), verify status.
3. Submission title is the parent's choice at submit time.

## Incidents / notes for the parent

- During the Patch 4 config edit I briefly deleted the `BOSS_NAME` export
  (a replacement dropped the line instead of inserting before it). Caught by
  grep before any sim or render ran; restored immediately and verified
  (`BOSS_NAME` at config.js:45). No broken artifact was ever committed.
- The boss sits at the screen edge in some captured frames (it spawns at an
  edge and walks in); it is still clearly readable as the boss (size, colour,
  HP bar, name). Not worth another staging cycle this close to the deadline.
- The INCOMING panel is thin on the cover (Dart x2) because the capture is
  late in wave 10 when most of the queue has already spawned; the panel is
  correct and fuller earlier in a wave.
- Accuracy on the victory screen reads 17% — the autopilot fires constantly
  (spread shots, many bolts miss); that is the pilot, not a game defect.
- Tooling: `~/workspace/makefun/best-game-01/sim-test-v3.mjs`,
  `render-shots-v3.mjs` (port 8124; server PID in `/tmp/lumen-v3-server.pid`).

## Commits (bot-v3, fresh git repo)

- `6919d93` Lumen v3 base: copy of v2
- `8a859ca` Lumen v3 patch 2: score x10, BEST in HUD, Sparks currency
- `8435ffb` Lumen v3 patches 1+3+5: THE GLOOM boss, WIN/LOSE bar, denser cover,
  CHAIN x5 banner, NIGHT naming
- `83a097c` Lumen v3 patch 4: INCOMING queue + 6 Gifts

Final HEAD: `83a097c0d777cfba994ebd97e4c46d00a4954c85` (BUILD_NOTES-v3.md itself
is committed on top of it — see `git log`).
