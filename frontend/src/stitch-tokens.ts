/**
 * Stitch Design Tokens
 * Extracted from: .context/stitch-reference/05-editor-*.html
 * Last updated: 2026-08-26
 *
 * These tokens drive the visual system. Import them and use in Tailwind config.
 * To update: modify this file or re-export from Claude Design MCP.
 */

export const stitchTokens = {
  // Color Palette (Material Design 3 - Chilean Landscape Theme)
  colors: {
    // Primary: Forest Green
    primary: '#163422',
    onPrimary: '#ffffff',
    primaryContainer: '#2d4b37',
    onPrimaryContainer: '#99baa1',
    primaryFixed: '#c8ebd0',
    primaryFixedDim: '#adcfb4',
    onPrimaryFixed: '#022110',
    onPrimaryFixedVariant: '#2f4d39',

    // Secondary: Sage Green
    secondary: '#4a654f',
    onSecondary: '#ffffff',
    secondaryContainer: '#c9e7cc',
    onSecondaryContainer: '#4e6953',
    secondaryFixed: '#cceacf',
    secondaryFixedDim: '#b0ceb4',
    onSecondaryFixed: '#062010',
    onSecondaryFixedVariant: '#334d38',

    // Tertiary: Warm Brown
    tertiary: '#422820',
    onTertiary: '#ffffff',
    tertiaryContainer: '#5a3e35',
    onTertiaryContainer: '#d1a99e',
    tertiaryFixed: '#ffdbd0',
    tertiaryFixedDim: '#e7bdb1',
    onTertiaryFixed: '#2c160e',
    onTertiaryFixedVariant: '#5d4037',

    // Surface & Backgrounds
    surface: '#f8faf8',
    onSurface: '#191c1b',
    surfaceVariant: '#e1e3e1',
    onSurfaceVariant: '#424843',
    surfaceBright: '#f8faf8',
    surfaceDim: '#d8dad9',
    surfaceContainer: '#eceeec',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f2f4f2',
    surfaceContainerHigh: '#e6e9e7',
    surfaceContainerHighest: '#e1e3e1',
    background: '#f8faf8',
    onBackground: '#191c1b',

    // Errors & Alerts
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',

    // Outline & Borders
    outline: '#727972',
    outlineVariant: '#c2c8c0',

    // Neutral Grays
    inverseSurface: '#2e3130',
    inverseOnSurface: '#eff1ef',
    inversePrimary: '#adcfb4',
  },

  // Typography
  fontFamily: {
    headline: 'Montserrat, sans-serif',
    body: 'Inter, sans-serif',
  },

  fontSize: {
    displayLg: { size: '48px', lineHeight: '56px', fontWeight: 700 },
    headlineLg: { size: '32px', lineHeight: '40px', fontWeight: 600 },
    headlineMd: { size: '24px', lineHeight: '32px', fontWeight: 600 },
    headlineLgMobile: { size: '24px', lineHeight: '32px', fontWeight: 600 },
    bodyLg: { size: '18px', lineHeight: '28px', fontWeight: 400 },
    bodyMd: { size: '16px', lineHeight: '24px', fontWeight: 400 },
    labelMd: { size: '14px', lineHeight: '20px', fontWeight: 600 },
    caption: { size: '12px', lineHeight: '16px', fontWeight: 400 },
  },

  // Spacing (in pixels)
  spacing: {
    xs: '4px',
    sm: '12px',
    md: '24px',
    lg: '40px',
    xl: '64px',
    gutter: '24px',
    containerMax: '1280px',
  },

  // Border Radius
  borderRadius: {
    default: '4px',    // 0.25rem
    lg: '8px',         // 0.5rem
    xl: '12px',        // 0.75rem
    full: '9999px',
  },

  // Shadows (organic, soft)
  shadow: {
    sm: '0 2px 8px rgba(22, 52, 34, 0.06)',
    md: '0 8px 24px rgba(22, 52, 34, 0.1)',
    lg: '0 12px 32px rgba(22, 52, 34, 0.12)',
    organic: '0 8px 32px rgba(45, 75, 55, 0.08)',
  },

  // Opacity
  opacity: {
    hover: 0.8,
    disabled: 0.38,
    focus: 1,
  },

  // Transitions
  duration: {
    short: '160ms',
    medium: '300ms',
    long: '500ms',
  },
  easing: 'cubic-bezier(0.2, 0, 0, 1)', // Material easing
};

export default stitchTokens;
