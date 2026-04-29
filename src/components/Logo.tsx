import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// Make sure you have converted logo.svg to logo.png and placed it in src/assets/

export const Logo: React.FC<{ width?: number; height?: number }> = ({ 
  width = 200, 
  height = 120 
}) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.logo, { width, height }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    // Width and height set by props
  },
});