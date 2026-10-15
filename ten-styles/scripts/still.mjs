// Один кадр полной композиции: npm run still -- 130  →  renders/still-0130.png
import {spawnSync} from 'node:child_process';

const frame = Number.parseInt(process.argv[2] ?? '', 10);
if (!Number.isFinite(frame) || frame < 0) {
  console.error('Укажите номер кадра: npm run still -- 130');
  process.exit(1);
}
const out = `renders/still-${String(frame).padStart(4, '0')}.png`;
const res = spawnSync('npx', ['remotion', 'still', 'TenStyles', out, `--frame=${frame}`], {stdio: 'inherit'});
process.exit(res.status ?? 1);
