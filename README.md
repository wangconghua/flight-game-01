[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wangconghua/flight-game-01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wangconghua/flight-game-01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Golden Hour Courier

A 2D canvas flight game that runs in a desktop browser from static files, no network needed. You fly a mail plane through a dusk valley at golden hour, carrying the evening post.

Three mission types: fly through the rings, drop the mail on the target, and land on the runway. The game uses a hand-written perspective projection for the terrain, with a cockpit-style HUD showing altitude, speed and heading, and the aircraft in frame with its instruments lit.

Play with keyboard and mouse. All the art is hand-drawn on canvas, and the sound is synthesised in code.

## How to run it

Serve `game/` from any static server and open it in a desktop browser:

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080 in Chrome.

## How to hand it in

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licence, see LICENSE.

<sub>Entered on [make.fun](https://make.fun/?ref=8max8wdd&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
