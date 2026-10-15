import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// Кадры в PNG: без JPEG-артефактов на тонких линиях и растре, и H.264 получает
// стандартный yuv420p (TV-диапазон) с метками BT.709 вместо полнодиапазонного yuvj420p.
Config.setVideoImageFormat('png');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);

// В облачной среде уже есть Chromium Headless Shell от Playwright.
// Если пути нет (например, на другой машине), Remotion скачает свой браузер сам.
const preinstalled =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (fs.existsSync(preinstalled)) {
  Config.setBrowserExecutable(preinstalled);
}
