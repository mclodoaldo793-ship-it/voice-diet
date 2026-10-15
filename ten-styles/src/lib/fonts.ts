import {cancelRender, continueRender, delayRender} from 'remotion';

// Локальные шрифты Google Fonts (OFL) из Fontsource: латиница + кириллица.
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/manrope/cyrillic-800.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/cyrillic-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/cyrillic-700.css';
import '@fontsource/poiret-one/latin-400.css';
import '@fontsource/poiret-one/cyrillic-400.css';
import '@fontsource/jost/latin-700.css';
import '@fontsource/jost/cyrillic-700.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/oswald/cyrillic-700.css';
import '@fontsource/inter-tight/latin-500.css';
import '@fontsource/inter-tight/cyrillic-500.css';
import '@fontsource/inter-tight/latin-800.css';
import '@fontsource/inter-tight/cyrillic-800.css';
import '@fontsource/rubik/latin-900-italic.css';
import '@fontsource/rubik/cyrillic-900-italic.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/nunito/cyrillic-900.css';
import '@fontsource/rubik-mono-one/latin-400.css';
import '@fontsource/rubik-mono-one/cyrillic-400.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/unbounded/cyrillic-900.css';
import '@fontsource/exo-2/latin-900-italic.css';
import '@fontsource/exo-2/cyrillic-900-italic.css';
import '@fontsource/russo-one/latin-400.css';
import '@fontsource/russo-one/cyrillic-400.css';

export const FONT = {
  meta: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
  deco: "'Poiret One', serif",
  bauhaus: "'Jost', sans-serif",
  constructivism: "'Oswald', sans-serif",
  swiss: "'Inter Tight', sans-serif",
  pop: "'Rubik', sans-serif",
  psy: "'Nunito', sans-serif",
  memphis: "'Rubik Mono One', sans-serif",
  y2k: "'Unbounded', sans-serif",
  retro: "'Exo 2', sans-serif",
  glitch: "'Russo One', sans-serif",
} as const;

const FACES: [string, string, string][] = [
  ['normal', '600', 'Manrope'],
  ['normal', '800', 'Manrope'],
  ['normal', '500', 'JetBrains Mono'],
  ['normal', '700', 'JetBrains Mono'],
  ['normal', '400', 'Poiret One'],
  ['normal', '700', 'Jost'],
  ['normal', '700', 'Oswald'],
  ['normal', '500', 'Inter Tight'],
  ['normal', '800', 'Inter Tight'],
  ['italic', '900', 'Rubik'],
  ['normal', '900', 'Nunito'],
  ['normal', '400', 'Rubik Mono One'],
  ['normal', '900', 'Unbounded'],
  ['italic', '900', 'Exo 2'],
  ['normal', '400', 'Russo One'],
];

// Рендер ждёт, пока загрузятся обе подгруппы (латиница и кириллица) каждого начертания.
const handle = delayRender('Загрузка шрифтов');
Promise.all(
  FACES.map(([style, weight, family]) =>
    document.fonts.load(`${style} ${weight} 64px '${family}'`, 'AaЯя0123'),
  ),
)
  .then((loaded) => {
    const missing = FACES.filter((_, i) => loaded[i].length === 0).map((f) => f.join(' '));
    if (missing.length > 0) {
      cancelRender(new Error(`Шрифты не загрузились: ${missing.join(', ')}`));
      return;
    }
    continueRender(handle);
  })
  .catch((err) => cancelRender(err));
