/**
 * EFG@Aish brand palette, taken from their event flyers.
 *
 * Navy grounds, deepest at the edges, with the cyan reserved strictly for
 * actions and accents -- that is how it is used on the printed material, and
 * spending it anywhere else makes the whole thing look washed out.
 */
export const colors = {
  navy900: '#061437',
  navy800: '#0d2461',
  navy700: '#143174',
  blue600: '#1c4fb0',
  cyan: '#2fe0d2',
  cyanDim: '#1fb3a8',

  white: '#ffffff',
  ink: '#061437',
  inkOnNavy: '#ffffff',
  muted: '#b9cbee',
  mutedDark: '#3a4d7a',

  surface: '#ffffff',
  surfaceAlt: '#f4f7fb',
  rule: '#d3deec',
  ruleOnNavy: '#1b3a72',

  // WhatsApp's own green. Used only for their mark, so the button is
  // recognisable as WhatsApp rather than as one more cyan control.
  whatsapp: '#25D366',

  good: '#2fe0d2',
  warn: '#ffd166',
  bad: '#ff9aa8',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/**
 * Poppins, loaded via @expo-google-fonts/poppins so it works on native and web
 * without shipping font files in the repo.
 */
export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.5 },
  title: { fontFamily: font.semibold, fontSize: 20 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  label: {
    fontFamily: font.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  mono: { fontSize: 13 },
} as const;
