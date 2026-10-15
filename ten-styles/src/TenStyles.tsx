import React from 'react';
import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Camera} from './components/Camera';
import {Hud} from './components/Hud';
import {GlitchDefs, incoming, outgoing, TransitionOverlay} from './components/Transitions';
import {Intro, Outro, SCENES} from './scenes';
import {glitchAmount} from './scenes/glitchSchedule';
import {STAGE, STYLES} from './lib/styles';
import {SceneTime, useT} from './lib/time';
import {INTRO_LEN, OUTRO_LEN, OUTRO_START, SCENE_LEN, sceneStart, TRANSITIONS} from './lib/timeline';

type Segment = {
  id: string;
  name: string;
  start: number;
  len: number;
  Component: React.FC;
  hud: number | 'outro' | null;
};

export const SEGMENTS: Segment[] = [
  {id: 'intro', name: 'Интро', start: 0, len: INTRO_LEN, Component: Intro, hud: null},
  ...SCENES.map((Component, i) => ({
    id: `s${i + 1}`,
    name: `${STYLES[i].num} ${STYLES[i].name}`,
    start: sceneStart(i),
    len: SCENE_LEN,
    Component,
    hud: i,
  })),
  {id: 'outro', name: 'Финал', start: OUTRO_START, len: OUTRO_LEN, Component: Outro, hud: 'outro'},
];

/** HUD сцены; в «Глитче» строки портятся по общему расписанию сбоев */
export const SceneHud: React.FC<{hud: number | 'outro'}> = ({hud}) => {
  const t = useT();
  if (hud === 'outro') {
    return <Hud index={null} outro colors={{tl: STAGE.ink, tr: STAGE.ink, bl: STAGE.ink, br: STAGE.ink, accent: STAGE.ink}} />;
  }
  return <Hud index={hud} colors={STYLES[hud].hud} typeOn={hud === 0} glitch={hud === 9 ? glitchAmount(t) : 0} />;
};

const SegmentLayer: React.FC<{seg: Segment; k: number; offset: number}> = ({seg, k, offset}) => {
  const local = useCurrentFrame() - offset;
  const tin = k > 0 ? TRANSITIONS[k - 1] : undefined;
  const tout = k < SEGMENTS.length - 1 ? TRANSITIONS[k] : undefined;
  const fxIn = tin ? incoming(tin, local) : {};
  const fxOut = tout ? outgoing(tout, local - seg.len) : {};
  if (fxIn.hidden || fxOut.hidden) return null;

  const content = (
    <SceneTime offset={offset}>
      <Camera segment={k} len={seg.len}>
        <seg.Component />
      </Camera>
      {seg.hud !== null ? <SceneHud hud={seg.hud} /> : null}
    </SceneTime>
  );
  const inner = fxOut.slices
    ? fxOut.slices.map((sl, i) => (
        <AbsoluteFill
          key={i}
          style={{clipPath: `inset(${sl.y0.toFixed(1)}px 0 ${(1080 - sl.y1).toFixed(1)}px 0)`, translate: `${sl.dx.toFixed(1)}px 0`}}
        >
          {content}
        </AbsoluteFill>
      ))
    : content;

  return (
    <AbsoluteFill style={fxIn.style}>
      <AbsoluteFill style={fxOut.style}>{inner}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const Overlays: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {TRANSITIONS.map((spec, k) => {
        const local = frame - SEGMENTS[k + 1].start;
        if (local < -spec.pre || local >= spec.post) return null;
        return (
          <AbsoluteFill key={k} style={{pointerEvents: 'none'}}>
            <TransitionOverlay spec={spec} local={local} />
          </AbsoluteFill>
        );
      })}
    </>
  );
};

export const TenStyles: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: STAGE.bg}}>
    <GlitchDefs />
    {SEGMENTS.map((seg, k) => {
      const tin = k > 0 ? TRANSITIONS[k - 1] : undefined;
      const tout = k < SEGMENTS.length - 1 ? TRANSITIONS[k] : undefined;
      const from = seg.start - (tin?.pre ?? 0);
      const end = seg.start + seg.len + (tout?.post ?? 0);
      return (
        <Sequence key={seg.id} name={seg.name} from={from} durationInFrames={end - from}>
          <SegmentLayer seg={seg} k={k} offset={seg.start - from} />
        </Sequence>
      );
    })}
    <Overlays />
    {/* Саундтрек синтезирован scripts/make_audio.py */}
    <Audio src={staticFile('audio/soundtrack.wav')} />
  </AbsoluteFill>
);
