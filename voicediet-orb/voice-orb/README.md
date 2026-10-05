# VoiceDiet Orb: анимированная сфера для экрана голосового ввода

Интерактивный компонент на Three.js. Модель берётся без изменений из `../export/voicediet_orb.glb`,
шейдер ядра — из `../viewer/core_params.json`. Геометрия, точки, цвета и материалы те же, что в просмотрщике.

| Файл | Назначение |
|---|---|
| `voice-orb.js` | Компонент: `createVoiceOrb(container, options)` |
| `index.html` | Страница предпросмотра с демо-панелью |
| `scripts/record.mjs` | Запись кадров с фиксированным шагом времени (для видео) |
| `scripts/test.mjs` | Функциональная проверка в Chromium |
| `renders/` | Видеодемонстрация и цикл ожидания |
| `planning/` | Бриф, концепция, сценарий видео |
| `qa/review.md` | Что проверено и какие ограничения остались |

## Предпросмотр

```bash
npx http-server voicediet-orb -p 8765 -s      # или: py -m http.server 8765 --directory voicediet-orb
```
Откройте http://127.0.0.1:8765/voice-orb/. На панели: состояния, «Сценарий» (полный цикл),
тестовый сигнал или микрофон, ползунки параметров, фирменный или прозрачный фон, упрощённое движение.
Пока микрофон не подключён, сверху висит плашка «Тестовый аудиосигнал».
Микрофон работает только на `localhost` или по HTTPS.

## Подключение к экрану голосового ввода

1. Скопируйте в проект `voice-orb/voice-orb.js`, `export/voicediet_orb.glb`, `viewer/core_params.json`.
   Three.js r186: `viewer/vendor` или пакет `three@0.186`.
2. Сделайте квадратный контейнер. Фон контейнера — ваш: canvas прозрачный.

```html
<div id="voice-orb" style="width: min(80vw, 420px); aspect-ratio: 1"></div>
<script type="importmap">
  { "imports": { "three": "/vendor/three.module.js", "three/addons/": "/vendor/jsm/" } }
</script>
<script type="module">
  import { createVoiceOrb } from '/voice-orb/voice-orb.js';

  const orb = await createVoiceOrb(document.getElementById('voice-orb'), {
    modelUrl: '/assets/voicediet_orb.glb',
    coreParamsUrl: '/assets/core_params.json',
  });

  // события экрана голосового ввода
  micButton.onpointerdown = async () => { await orb.connectMicrophone(); orb.setState('listening'); };
  recognizer.onspeechend   = () => orb.setState('processing');
  recognizer.onresult      = () => orb.setState('ready');      // сам вернётся в 'idle' через 1.8 с
  // при уходе с экрана:
  // orb.dispose();
</script>
```

Если звук уже обрабатывается в вашем аудио-конвейере, микрофон компоненту не нужен:
передавайте уровень 0..1 каждый кадр — `orb.setAudioLevel(level)`. Сглаживание выполняет компонент.

### React

```jsx
useEffect(() => {
  let orb, alive = true;
  createVoiceOrb(ref.current).then(o => { if (alive) orb = o; else o.dispose(); });
  return () => { alive = false; orb?.dispose(); };
}, []);
useEffect(() => { orbRef.current?.setState(state); }, [state]);
```

## API

| Метод / свойство | Описание |
|---|---|
| `setState('idle' \| 'listening' \| 'processing' \| 'ready')` | Смена состояния. Параметры плавно смешиваются, фазы и поворот ядра не сбрасываются |
| `on('state', fn)` | Событие смены состояния (в том числе автоматического `ready → idle`) |
| `setParams({...})` | `coreSpeed`, `shellAmplitude`, `shellSpeed`, `pulseIntensity`, `audioGain` (множители, по умолчанию 1) |
| `setAudioLevel(0..1)` | Внешний уровень голоса |
| `connectMicrophone()` / `disconnectAudio()` | Микрофон через Web Audio (RMS → дБ, диапазон −58…−18 дБ) |
| `useTestSignal(true)` | Синтетический «речевой» сигнал для демо. Обозначайте его в интерфейсе |
| `setReducedMotion(true \| false \| 'auto')` | По умолчанию берётся из `prefers-reduced-motion` |
| `pause()` / `resume()` | Ручная пауза |
| `dispose()` | Останавливает цикл, микрофон и наблюдатели, освобождает геометрию, материалы и WebGL-контекст, удаляет canvas |
| `advance(dt)` / `render()` | Только при `manual: true`: детерминированный шаг для записи видео |

Опции `createVoiceOrb`: `modelUrl` (или `modelData` — ArrayBuffer с GLB), `coreParamsUrl`, `fit` (доля контейнера под кадр референса, 0.9),
`maxPixelRatio` (2), `reducedMotion` ('auto'), `manual` (false), `seed` (7), `autoIdleAfterReady` (true), `params`.

## Как устроено движение

- **Ядро.** Вращается внутренняя окраска: маджента- и фиолет-зоны. Это прецессия: окраска наклонена
  на 14°, ось наклона делает полный оборот за 16 с. Белое пятно, ореол, нижний блик и голубой край
  привязаны к камере, как в макете. Поэтому вращение видно по движению цветной массы под неподвижными
  бликами. Новых узоров нет. При полном обороте (без наклона) маджента уходила за горизонт
  и ядро почти белело: этот вариант проверен и отклонён.
- **Сетка.** Каждая точка двигается только вдоль своего луча: `r' = r·(1 + f(rest_dir))`.
  `f` — 6 бегущих сферических волн низкой частоты (±1.2 % радиуса в ожидании). Одинаковый масштаб вдоль луча
  и гладкое `f` исключают пересечения и изломы, соседние точки двигаются согласованно.
- **Связь ядро → сетка.** Скорость волн наполовину следует за скоростью ядра через пружину (задержка ≈0.5 с).
  Вторая гармоника деформации ориентирована по полюсу маджента-зоны и догоняет его с задержкой.
- **Импульсы.** Компонент находит в решётке 12 пятиугольных узлов и 30 рёбер икосаэдра (942 точки
  на рёбрах). Импульс — яркая головка с хвостом, бегущая по ребру. На узле — мягкое свечение 4–5 точек.
  Маршруты проходят только по видимым узлам: перед ядром и на кромке силуэта.
- **Состояния.**
  - Ожидание: 2 тихих импульса за 16-секундный цикл.
  - Прослушивание: амплитуда и мелкие волны растут с громкостью, ядро ускоряется ×1.7.
  - Обработка: волны тише, две «эстафеты» прыгают по рёбрам с easing и паузой на узле (такт 0.9 с), от узла расходится рябь.
  - Готово: одна мягкая волна от центра к краю (≤1.8 %), без изменения масштаба.
- **Переходы.** Все параметры сходятся к цели через критически демпфированные пружины: непрерывны
  и значение, и скорость. Аудио проходит огибающую (атака 50 мс, спад 300 мс) и пружину.
- **Время.** Анимация зависит от `dt` (не от числа кадров). Шаг ограничен 0.1 с. Цикл ожидания
  бесшовный: периоды волн и оборот ядра кратны 16 с.
- **Производительность.** Одна сфера и 10 242 точки, один draw call на слой. pixelRatio ≤ 2.
  Рендер останавливается при скрытой вкладке и при уходе контейнера за экран (IntersectionObserver).
- **Упрощённое движение.**
  - Скорость ядра ×0.35, наклон окраски ×0.6.
  - Амплитуда сетки ×0.4, скорость волн ×0.5.
  - Бегущих импульсов, ряби и волны «готово» нет.
  - Обработка показана поочерёдным мягким свечением узлов.

## Видео

```bash
# сервер (см. выше), затем из корня voicediet-orb:
node voice-orb/scripts/record.mjs demo  frames/demo 1080    # 35 с, все состояния
node voice-orb/scripts/record.mjs idle  frames/idle 1080    # цикл 16 с (+1 кадр для проверки стыка)
node voice-orb/scripts/record.mjs alpha frames/alpha 720    # цикл без фона, PNG с альфой
ffmpeg -framerate 30 -i frames/demo/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 17 voice-orb/renders/voice_orb_demo.mp4
ffmpeg -framerate 30 -i frames/idle/f%04d.png -frames:v 480 -c:v libx264 -pix_fmt yuv420p -crf 17 voice-orb/renders/voice_orb_idle_loop.mp4
ffmpeg -framerate 30 -i frames/alpha/f%04d.png -frames:v 480 -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 voice-orb/renders/voice_orb_idle_loop_alpha.webm
```
Playwright нужен глобально или локально. Глобальный пакет подхватывается через `NODE_PATH`.
