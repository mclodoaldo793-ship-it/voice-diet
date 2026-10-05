// Запись кадров страницы предпросмотра с фиксированным шагом времени (1/fps).
// Нужен статический сервер из корня voicediet-orb:  npx http-server voicediet-orb -p 8765 -s
// Запуск: node voice-orb/scripts/record.mjs <scenario> <outDir> [size] [fps]
//   scenario: idle (16 с цикл), demo (35 с, все состояния), alpha (цикл без фона), still:<сек>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// playwright: локальный пакет или глобальный (NODE_PATH)
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }

const [scenario = 'idle', out = 'frames', size = '1080', fpsArg = '30'] = process.argv.slice(2);
const S = +size, FPS = +fpsArg, PORT = process.env.PORT || 8765;
mkdirSync(out, { recursive: true });

// таймлайн demo: [кадр, действие]
const DEMO = [[0, 'idle'], [240, 'listening'], [600, 'processing'], [840, 'ready']];
const total = scenario === 'demo' ? 1050 : scenario.startsWith('still') ? 1 : 16 * FPS + 1;   // +1 кадр: проверка стыка (кадр 16 с = кадр 0)
const alpha = scenario === 'alpha';

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
const q = `capture=1${alpha ? '&bg=none&caption=0' : ''}${scenario === 'idle' ? '&caption=0' : ''}`;
await page.goto(`http://127.0.0.1:${PORT}/voice-orb/index.html?${q}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
console.log(await page.evaluate(() => JSON.stringify(window.__orb.lattice)));

if (scenario.startsWith('still')) {
  const t = +(scenario.split(':')[1] || 0);
  await page.evaluate(t => { for (let x = 0; x < t; x += 1 / 30) window.__orb.advance(1 / 30); window.__orb.render(); }, t);
}
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  const act = DEMO.find(([k]) => k === f);
  const info = await page.evaluate(([dt, a, first]) => {
    const o = window.__orb;
    if (a) o.setState(a);
    const r = first ? o.advance(0) : o.advance(dt);
    o.render();
    return { ...r, state: o.state };
  }, [1 / FPS, scenario === 'demo' ? act?.[1] : null, f === 0]);
  await page.screenshot({ path: join(out, `f${String(f).padStart(4, '0')}.png`), omitBackground: alpha });
  if (f % 60 === 0) console.log(f, info.state, info.level.toFixed(2), ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
