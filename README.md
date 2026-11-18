# best-game-01-entry-v3

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/bismilahdestia/best-game-01-entry-v3/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/bismilahdestia/best-game-01-entry-v3/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Lumen — Keeper of the Ember: a complete, original 2D arena game for make.fun's
**best-game-01** bounty. You are the Keeper, a wisp of light guarding the Ember at the
heart of a night arena. Shades drift in from the dark to drink the Ember's light. Shoot
them down before they arrive — and survive all 10 nights, earning a Gift per night
cleared, until THE GLOOM wakes on night 10.

## Run it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

## How to play

- **Move** with WASD or the arrow keys.
- **Aim** with the mouse, **hold click** (or Space) to fire bolts of light.
- **Darts** (from wave 2) are fast and weave as they close in — lead your shots.
- **Spitters** (from wave 3) stop at range and shoot back — their bolts stun you.
- **Brutes** (from wave 5) take nine bolts and drain 20 light each.
- **THE GLOOM** (night 10) is the boss: 30 health, huge, and one touch drains 40 light.
- Every third wave is a **surge**: shades arrive faster.
- **Chain kills** within a few seconds to build a combo (up to x5) that multiplies score.
- **Pickups**: mend the Ember (+25 light), spread shot (12 s), rapid fire (10 s),
  a shield that blocks one drain outright, or a nova that banishes every shade on the
  field.
- Survive all **10 waves** and the light endures. If the Ember's light reaches zero, the
  dark takes it.
- **P** pauses, **M** mutes. Your best score is kept in the browser.

## Shots

`screenshots/` holds four real renders of the game's own code, staged deterministically
from `?shot=start|play|victory|end&seed=1` (see `game/src/shots.js` and `shots.json`):
play (the cover), the title screen, the victory screen, and game over. The play and
victory pilots lead their targets, so the frames show a real, strong game.

## Tech

No build step, no network request: `game/index.html` plus its ES modules, and every
sound is synthesised with WebAudio in `game/src/audio.js`. The rules live in
`game/src/world.js`, the drawing in `game/src/render.js`, the screenshot staging in
`game/src/shots.js`.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ej1cw7nv&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
