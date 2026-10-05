// Снимает облёт модели (кадры + MP4) и контактный лист ракурсов через Chrome Headless Shell.
// Нужен сервер на 8765. Запуск: node scripts/turntable.mjs [кадров=96]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = resolve(ROOT, '../node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const N = +(process.argv[2] || 96);
const dir = resolve(ROOT, 'renders/turntable');
mkdirSync(dir, { recursive: true });
const shot = (q, out) => execFileSync(CHROME, ['--headless', '--hide-scrollbars', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--window-size=1024,1024', '--force-device-scale-factor=1', '--virtual-time-budget=15000',
  `--screenshot=${out}`, `http://127.0.0.1:8765/viewer/index.html?capture=1&bg=ref&${q}`], { stdio: 'pipe' });
for (const [az, el] of [[0, 0], [90, 0], [180, 0], [270, 0], [0, 75], [0, -75]]) {
  shot(`az=${az}&el=${el}`, resolve(dir, `view_az${az}_el${el}.png`));
}
for (let i = 0; i < N; i++) {
  shot(`az=${(i * 360 / N).toFixed(3)}&el=8`, resolve(dir, `f${String(i).padStart(3, '0')}.png`));
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '24', '-i', resolve(dir, 'f%03d.png'),
  '-vf', 'scale=1024:1024', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709',
  '-color_trc', 'bt709', '-colorspace', 'bt709', resolve(ROOT, 'renders/voicediet_orb_turntable.mp4')]);
console.log('done', N, 'frames');
