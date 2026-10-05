// Функциональная проверка компонента в Chromium (Playwright).
// Нужен сервер из корня voicediet-orb (порт 8765). Запуск: node voice-orb/scripts/test.mjs
import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const PORT = process.env.PORT || 8765;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });   // телефон
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/voice-orb/index.html`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const wait = ms => page.waitForTimeout(ms);
const results = {};
const ok = (name, cond, info = '') => { results[name] = cond ? 'OK' : 'FAIL'; console.log(cond ? 'OK  ' : 'FAIL', name, info); };

ok('решётка 12 узлов / 30 рёбер', await page.evaluate(() => window.__orb.lattice.ok));
const t0 = await page.evaluate(() => window.__orb.time); await wait(700);
const t1 = await page.evaluate(() => window.__orb.time);
ok('цикл работает (время по rAF)', t1 - t0 > 0.3, (t1 - t0).toFixed(2) + ' с');

for (const s of ['listening', 'processing', 'ready']) {
  await page.click(`#states button[data-s="${s}"]`); await wait(500);
  ok('переключение: ' + s, await page.evaluate(s => window.__orb.state === s || (s === 'ready' && window.__orb.state === 'idle'), s));
}
const backToIdle = await page.waitForFunction(() => window.__orb.state === 'idle', null, { timeout: 8000 }).then(() => true, () => false);
ok('«готово» → ожидание автоматически', backToIdle);
ok('тестовый сигнал обозначен', await page.evaluate(() => document.getElementById('badge').classList.contains('on')));

// скрытая страница: рендер стоит
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const h0 = await page.evaluate(() => window.__orb.time); await wait(600);
const h1 = await page.evaluate(() => window.__orb.time);
ok('пауза при скрытой странице', h1 === h0);
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await wait(400);
const h2 = await page.evaluate(() => window.__orb.time);
ok('возобновление без скачка времени', h2 > h1 && h2 - h1 < 0.6, (h2 - h1).toFixed(2) + ' с');

await page.click('#rm');
ok('упрощённое движение', await page.evaluate(() => window.__orb.reducedMotion));
await page.emulateMedia({ reducedMotion: 'reduce' });

// производительность на «телефоне» (swiftshader — программный рендер, оценка сверху)
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); (function f() { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(n / 2); })(); }));
console.log('     rAF в headless/swiftshader:', fps, 'кадр/с');

const disposed = await page.evaluate(() => {
  const o = window.__orb; const c = o.canvas; const gl = c.getContext('webgl2');
  o.dispose();
  return { removed: !c.isConnected, lost: gl ? gl.isContextLost() : 'n/a', t: o.time };
});
await wait(300);
const tAfter = await page.evaluate(() => window.__orb.time);
ok('dispose: canvas удалён, контекст освобождён, цикл остановлен', disposed.removed && disposed.lost === true && tAfter === disposed.t, JSON.stringify(disposed));
ok('нет ошибок в консоли', errors.length === 0, errors.join(' | '));
await b.close();
process.exit(Object.values(results).every(v => v === 'OK') ? 0 : 1);
