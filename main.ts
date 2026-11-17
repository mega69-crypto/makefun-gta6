// Solara Bay for make.fun gta6-01 (Node 22, standard library only): a 2D top-down
// open-world crime game in game/ — plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network
// request). This program hands the game in: it copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library. Before it writes anything
// it checks the entry the way the scorer will: 3 or 4 screenshots, each a whole
// PNG or JPEG under 256 KiB, and a game/index.html to open.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is not submittable without its screenshots or its page: fail here,
// with a plain reason, instead of handing the grader a broken /output.
const screenshotsDir = join(here, 'screenshots');
const shots = existsSync(screenshotsDir)
  ? readdirSync(screenshotsDir).filter((name) => !name.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}
for (const shot of shots) {
  const size = statSync(join(screenshotsDir, shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes, over the 256 KiB cap`);
  if (!/\.(png|jpg|jpeg)$/i.test(shot)) throw new Error(`screenshot ${shot} is not a PNG or JPEG`);
}
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(screenshotsDir)) cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
