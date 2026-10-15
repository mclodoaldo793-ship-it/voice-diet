import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {EASE, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {STYLES, type HudColors} from '../lib/styles';
import {useT} from '../lib/time';

const SERIES = 'ОДИН КРУГ — ДЕСЯТЬ СТИЛЕЙ';
const GLYPHS = '#%&@$*+=?/\\|<>_01░▒▓';

// Детерминированная порча строки для глитча
const scramble = (s: string, amount: number, seed: number) =>
  amount <= 0
    ? s
    : s
        .split('')
        .map((ch, i) =>
          ch !== ' ' && random(`hud-${seed}-${i}`) < amount
            ? GLYPHS[Math.floor(random(`hudg-${seed}-${i}`) * GLYPHS.length)]
            : ch,
        )
        .join('');

const label: React.CSSProperties = {
  position: 'absolute',
  fontFamily: FONT.mono,
  fontSize: 19,
  fontWeight: 500,
  letterSpacing: '0.14em',
  lineHeight: '24px',
  whiteSpace: 'pre',
};

export const Hud: React.FC<{
  index: number | null;
  colors: HudColors;
  /** Первое появление HUD: строки набираются */
  typeOn?: boolean;
  /** 0..1 — порча символов (сцена «Глитч») */
  glitch?: number;
  /** Финал: без номера и названия */
  outro?: boolean;
}> = ({index, colors, typeOn = false, glitch = 0, outro = false}) => {
  const t = useT();
  const seed = Math.floor(t);
  const shadow = colors.shadow ? `0 1px 10px ${colors.shadow}` : undefined;

  const typed = (s: string, start: number) => {
    if (!typeOn) return s;
    const n = Math.floor(tw(t, start, start + 14, 0, s.length, EASE.linear));
    return s.slice(0, n);
  };

  const info = index !== null ? STYLES[index] : null;
  const prevNum = index !== null && index > 0 ? STYLES[index - 1].num : '00';
  const roll = tw(t, 0, 9, 0, 1, EASE.outExpo);
  const barFill = tw(t, 2, 14, 0, 1, EASE.outQuart);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...label, left: 64, top: 46, color: colors.tl, textShadow: shadow}}>
        {scramble(typed(SERIES, 8), glitch, seed)}
      </div>
      {info && !outro ? (
        <>
          <div
            style={{
              ...label,
              right: 64,
              top: 46,
              color: colors.tr,
              fontWeight: 700,
              textShadow: shadow,
              display: 'flex',
              gap: '0.5em',
            }}
          >
            <span style={{display: 'inline-block', height: 24, overflow: 'hidden'}}>
              <span style={{display: 'block', translate: `0 ${-24 * roll}px`}}>
                <span style={{display: 'block'}}>{prevNum}</span>
                <span style={{display: 'block'}}>{scramble(info.num, glitch, seed + 7)}</span>
              </span>
            </span>
            <span style={{opacity: 0.55}}>/ 10</span>
          </div>
          <div style={{...label, left: 64, bottom: 44, color: colors.bl, textShadow: shadow}}>
            {scramble(typed(`${info.name.toUpperCase()} · ${info.decade}`, 12), glitch, seed + 3)}
          </div>
        </>
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: 64,
          bottom: 54,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {STYLES.map((s, i) => {
          const isCur = !outro && i === index;
          const past = outro || (index !== null && i < index);
          return (
            <div
              key={s.num}
              style={{
                width: 26,
                height: 3,
                backgroundColor: past ? colors.br : 'transparent',
                opacity: past ? 0.6 : isCur ? 1 : 0.45,
                position: 'relative',
                boxShadow: past || isCur ? undefined : `inset 0 0 0 1px ${colors.br}`,
              }}
            >
              {isCur ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: colors.accent,
                    transformOrigin: 'left center',
                    scale: `${barFill} 1`,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
