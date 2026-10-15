import React, {createContext, useContext} from 'react';
import {useCurrentFrame} from 'remotion';

// Смещение локального времени сцены: t = 0 в момент склейки, до неё t < 0 (окно перехода).
const OffsetContext = createContext(0);

export const SceneTime: React.FC<{offset: number; children: React.ReactNode}> = ({offset, children}) => (
  <OffsetContext.Provider value={offset}>{children}</OffsetContext.Provider>
);

export const useT = () => useCurrentFrame() - useContext(OffsetContext);
