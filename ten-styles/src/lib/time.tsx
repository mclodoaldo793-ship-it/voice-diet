import React, {createContext, useContext} from 'react';
import {useCurrentFrame} from 'remotion';

// Локальное время сцены в «авторских» кадрах: t = 0 в момент склейки,
// до неё t < 0 (окно перехода). rate ускоряет авторскую анимацию под темп.
const TimeContext = createContext({offset: 0, rate: 1});

export const SceneTime: React.FC<{offset: number; rate?: number; children: React.ReactNode}> = ({
  offset,
  rate = 1,
  children,
}) => <TimeContext.Provider value={{offset, rate}}>{children}</TimeContext.Provider>;

export const useT = () => {
  const {offset, rate} = useContext(TimeContext);
  return (useCurrentFrame() - offset) * rate;
};
