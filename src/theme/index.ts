/**
 * Theme barrel — re-exports the token system + interactive primitives.
 * Screens import from this file rather than reaching into individual modules:
 *
 *   import { palette, spacing, radii, elevation, typography, KineticPressable } from '../theme';
 */

export {
  palette,
  spacing,
  radii,
  typography,
  elevation,
  motion,
  innerRadius,
  theme,
} from './tokens';

export type { Theme } from './tokens';

export { KineticPressable, QuietPressable } from './KineticPressable';
export type { KineticPressableProps } from './KineticPressable';
