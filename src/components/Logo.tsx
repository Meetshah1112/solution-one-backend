import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { spacing } from '../theme';

/* ────────────────────────────────────────────────────────────────────────────
 * Logo
 * ────────────────────────────────────────────────────────────────────────────
 * Simple presentational wrapper around the brand mark.
 * Centered both axes; sizing is consumer-controlled via props so it can
 * adapt to login screens, headers, splash, etc.
 * ──────────────────────────────────────────────────────────────────────────── */

// Asset converted from logo.svg → logo.png; lives in src/assets/.
export const Logo: React.FC<{ width?: number; height?: number }> = ({
  width = 200,
  height = 120,
}) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.logo, { width, height }]}
        resizeMode="contain"
        // Accessibility: announce as a logo, not as decorative
        accessible
        accessibilityRole="image"
        accessibilityLabel="Solution One ESS logo"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // 8px grid breathing room around the mark so logos never feel cramped
    paddingVertical: spacing.sm,
  },
  logo: {
    // Width and height are driven by props — the only style we set here
    // would be a tint/opacity if the brand mark needed runtime theming.
  },
});
