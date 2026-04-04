import { SIGNAL } from './theme';

/** Tab tint fallback before theme provider (unused when tabs use useSignalTheme). */
const tintFallback = SIGNAL.green;

export default {
  light: {
    text: SIGNAL.text,
    background: SIGNAL.bg,
    tint: tintFallback,
    tabIconDefault: '#666',
    tabIconSelected: tintFallback,
  },
  dark: {
    text: SIGNAL.text,
    background: SIGNAL.bg,
    tint: tintFallback,
    tabIconDefault: '#666',
    tabIconSelected: tintFallback,
  },
};
