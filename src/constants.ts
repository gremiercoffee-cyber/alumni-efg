import { FolderNode } from './types';

export const COLORS = {
  bg: '#f6f1e3',
  bgAlt: '#f1ead4',
  border: '#ddd2b3',
  borderLight: '#e6dcc0',
  brown: '#3a2e1f',
  brownMid: '#5c5142',
  brownLight: '#8a7d63',
  brownFaint: '#a89a7e',
  cream: '#e8dfc8',
  creamLight: '#efe8d6',
  red: '#b5482f',
  white50: 'rgba(255,255,255,0.5)',
  white60: 'rgba(255,255,255,0.6)',
};

export const FONTS = {
  regular: undefined, // uses system default — swap for custom font later
  size: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 15,
    lg: 17,
    xl: 20,
  },
};

export const SEED_TREE: FolderNode = {
  id: 'root',
  name: 'Everything',
  children: [],
};
