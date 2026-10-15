import React from 'react';
import {AbsoluteFill, random, staticFile} from 'remotion';
import {useT} from '../lib/time';

/** Живое зерно бумаги/плёнки: текстура прыгает каждые 2 кадра (детерминированно) */
export const Grain: React.FC<{opacity?: number; blend?: React.CSSProperties['mixBlendMode']; step?: number}> = ({
  opacity = 0.2,
  blend = 'multiply',
  step = 2,
}) => {
  const t = useT();
  const k = Math.floor(t / step);
  const x = Math.floor(random(`gx${k}`) * 512);
  const y = Math.floor(random(`gy${k}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile('textures/grain.png')})`,
        backgroundRepeat: 'repeat',
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: blend,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
