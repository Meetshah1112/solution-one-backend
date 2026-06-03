/**
 * ───────────────────────────────────────────────────────────────────────────
 * KineticPressable
 * ───────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for TouchableOpacity that adds:
 *   • Animated scale-down on press-in (springs back on release)
 *   • Subtle opacity dimming for visual confirmation
 *   • Android ripple feedback tuned to the warm palette
 *   • Built-in accessibility role + label support
 *
 * Designed to feel tactile and intentional — never sluggish — on both
 * iOS and Android. Uses the spring params defined in `tokens.motion`.
 * ───────────────────────────────────────────────────────────────────────────
 */

import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
  AccessibilityRole,
  GestureResponderEvent,
} from 'react-native';
import { palette, motion } from './tokens';

export interface KineticPressableProps {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  delayLongPress?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Override scale factor (defaults to 0.97). Use 0.95 for prominent FABs. */
  pressScale?: number;
  /** Slightly dim the surface during press (default true). */
  dimOnPress?: boolean;
  /** Disable Android ripple (default false). Useful for cards-inside-cards. */
  disableRipple?: boolean;
  /** Ripple color override. Defaults to a warm scrim that matches the palette. */
  rippleColor?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  testID?: string;
  children?: React.ReactNode;
}

export const KineticPressable: React.FC<KineticPressableProps> = ({
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  style,
  pressScale = motion.pressScale,
  dimOnPress = true,
  disableRipple = false,
  rippleColor = 'rgba(31,29,27,0.06)', // warm scrim, never neutral grey
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityHint,
  accessibilityState,
  testID,
  children,
}) => {
  /* Animated values — using refs prevents re-creating across renders */
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, { ...motion.springIn, toValue: pressScale }),
      dimOnPress
        ? Animated.timing(opacity, {
            toValue: 0.85,
            duration: 80,
            useNativeDriver: true,
          })
        : Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { ...motion.springOut, toValue: 1 }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        opacity,
        // The Animated.View must not steal layout — let the inner Pressable own sizing
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={style}
        android_ripple={
          disableRipple
            ? undefined
            : { color: rippleColor, borderless: false, foreground: true }
        }
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, ...accessibilityState }}
        testID={testID}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

/** Convenience: a Pressable with NO scale animation (for things like list rows
 *  where you only want ripple feedback). Cheaper than KineticPressable. */
export const QuietPressable: React.FC<KineticPressableProps> = (props) => {
  const { rippleColor = palette.canvasAlt, ...rest } = props;
  return (
    <Pressable
      {...rest}
      android_ripple={
        props.disableRipple ? undefined : { color: rippleColor, borderless: false }
      }
      accessibilityState={{ disabled: props.disabled, ...props.accessibilityState }}
    >
      {rest.children}
    </Pressable>
  );
};
