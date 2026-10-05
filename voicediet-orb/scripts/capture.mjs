// Снимает кадры просмотрщика с ракурса референса через Chrome Headless Shell (из Remotion).
// Нужен запущенный статический сервер: py -m http.server 8765 --directory voicediet-orb
// Запуск: node scripts/capture.mjs [port]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = resolve(ROOT, '../node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const port = process.argv[2] || '8765';
if (!existsSync(CHROME)) throw new Error('Не найден Chrome Headless Shell: ' + CHROME);
mkdirSync(resolve(ROOT, 'renders'), { recursive: true });

const shots = [
  ['threejs_ref_view.png', 'capture=1&bg=ref'],            // полный кадр на фоне слайда
  ['threejs_shell_only.png', 'capture=1&layer=shell'],     // только точки (белое на чёрном) = альфа
  ['threejs_core_only.png', 'capture=1&layer=core&bg=ref'],
];
for (const [file, q] of shots) {
  const out = resolve(ROOT, 'renders', file);
  execFileSync(CHROME, [
    '--headless', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1024,1024', '--force-device-scale-factor=1', '--virtual-time-budget=15000',
    `--screenshot=${out}`, `http://127.0.0.1:${port}/viewer/index.html?${q}`,
  ], { stdio: 'pipe' });
  console.log(file, statSync(out).size, 'bytes');
}
