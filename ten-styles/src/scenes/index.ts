import type React from 'react';
import {Intro} from './Intro';
import {ArtDeco} from './S01ArtDeco';
import {Bauhaus} from './S02Bauhaus';
import {Constructivism} from './S03Constructivism';
import {Swiss} from './S04Swiss';
import {PopArt} from './S05PopArt';
import {Psychedelia} from './S06Psychedelia';
import {Memphis} from './S07Memphis';
import {Y2K} from './S08Y2K';
import {Retrowave} from './S09Retrowave';
import {Glitch} from './S10Glitch';
import {Outro} from './Outro';

export const SCENES: React.FC[] = [
  ArtDeco,
  Bauhaus,
  Constructivism,
  Swiss,
  PopArt,
  Psychedelia,
  Memphis,
  Y2K,
  Retrowave,
  Glitch,
];
export {Intro, Outro};
