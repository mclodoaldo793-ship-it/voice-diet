export type HudColors = {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  accent: string;
  shadow?: string;
};

export type StyleInfo = {num: string; name: string; decade: string; hud: HudColors};

const all = (ink: string, accent: string, shadow?: string): HudColors => ({
  tl: ink,
  tr: ink,
  bl: ink,
  br: ink,
  accent,
  shadow,
});

// Десятилетия — приблизительный период расцвета стиля
export const STYLES: StyleInfo[] = [
  {num: '01', name: 'Ар-деко', decade: '1920-е', hud: all('#E3CF96', '#F6E7B9')},
  {num: '02', name: 'Баухаус', decade: '1920-е', hud: all('#161616', '#D63A2F')},
  {
    num: '03',
    name: 'Конструктивизм',
    decade: '1920-е',
    hud: {tl: '#141210', tr: '#E7D9BD', bl: '#141210', br: '#E7D9BD', accent: '#E8352E'},
  },
  {num: '04', name: 'Швейцарский стиль', decade: '1950-е', hud: all('#0F0F0F', '#E2231A')},
  {num: '05', name: 'Поп-арт', decade: '1960-е', hud: all('#111111', '#E8202A')},
  {num: '06', name: 'Психоделия', decade: '1960-е', hud: all('#FFF3D6', '#FFD23D', 'rgba(40,6,60,0.85)')},
  {num: '07', name: 'Мемфис', decade: '1980-е', hud: all('#121212', '#2B59FF')},
  {num: '08', name: 'Y2K', decade: '2000-е', hud: all('#26304A', '#2E9BF0')},
  {num: '09', name: 'Ретровейв', decade: '2010-е', hud: all('#F6DCFF', '#FF2E97')},
  {num: '10', name: 'Глитч', decade: '2010-е', hud: all('#EDEDED', '#FF1E3C')},
];

// «Сцена» интро и финала
export const STAGE = {bg: '#0C0C0E', ink: '#F1EDE4', dim: '#8C877D', light: '#FFF3DC'};
