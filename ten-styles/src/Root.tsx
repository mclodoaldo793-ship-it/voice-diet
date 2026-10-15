import React from 'react';
import {Composition, Folder} from 'remotion';
import './lib/fonts';
import {Camera} from './components/Camera';
import {SceneHud, SEGMENTS, TenStyles} from './TenStyles';
import {SceneTime} from './lib/time';
import {FPS, HEIGHT, RATE, TOTAL_FRAMES, WIDTH} from './lib/timeline';

// Отдельная сцена с HUD — для styleframes и правки сцены в Studio
const SceneSolo: React.FC<{index: number}> = ({index}) => {
  const seg = SEGMENTS[index];
  return (
    <SceneTime offset={0} rate={RATE}>
      <Camera segment={index} len={seg.len * RATE}>
        <seg.Component />
      </Camera>
      {seg.hud !== null ? <SceneHud hud={seg.hud} /> : null}
    </SceneTime>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="TenStyles"
      component={TenStyles}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Folder name="Scenes">
      {SEGMENTS.map((seg, i) => (
        <Composition
          key={seg.id}
          id={`Scene-${String(i).padStart(2, '0')}-${seg.id}`}
          component={SceneSolo}
          defaultProps={{index: i}}
          durationInFrames={seg.len}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      ))}
    </Folder>
  </>
);
