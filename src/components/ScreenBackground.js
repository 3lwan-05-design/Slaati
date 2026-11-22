import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

// Decorative layer behind every screen.
// A faint crescent moon above, and a quiet mosque skyline along the bottom.
// Built from simple views and glyphs — no images, no hard edges, pointerEvents off.
export default function ScreenBackground({ children, style }) {
  const { colors, gradients } = useTheme();

  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.root, { backgroundColor: colors.background }, style]}
    >
      <View pointerEvents="none" style={styles.sky}>
        <MaterialCommunityIcons
          name="moon-waning-crescent"
          size={170}
          color={colors.goldSoft}
          style={styles.moon}
        />
      </View>

      <View pointerEvents="none" style={styles.horizon}>
        <View style={[styles.minaret, { left: '12%' }, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.minaretCap, styles.minaretCapLeft, { backgroundColor: colors.primarySoft }]} />
        </View>
        <View style={[styles.domeSmall, { left: '26%' }, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.domeMain, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.finial, { backgroundColor: colors.goldSoft }]} />
        </View>
        <View style={[styles.domeSmall, { right: '26%' }, { backgroundColor: colors.primarySoft }]} />
        <View style={[styles.minaret, { right: '12%' }, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.minaretCap, styles.minaretCapRight, { backgroundColor: colors.primarySoft }]} />
        </View>
        <View style={[styles.groundLine, { backgroundColor: colors.primarySoft }]} />
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  moon: {
    position: 'absolute',
    top: -34,
    right: -30,
    opacity: 0.9,
  },
  horizon: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    opacity: 0.55,
  },
  groundLine: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  domeMain: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    width: 132,
    height: 66,
    borderTopLeftRadius: 132,
    borderTopRightRadius: 132,
  },
  finial: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  domeSmall: {
    position: 'absolute',
    bottom: 96,
    width: 54,
    height: 27,
    borderTopLeftRadius: 54,
    borderTopRightRadius: 54,
  },
  minaret: {
    position: 'absolute',
    bottom: 98,
    width: 10,
    height: 96,
    borderRadius: 5,
  },
  minaretCap: {
    position: 'absolute',
    top: -14,
    width: 26,
    height: 13,
  },
  minaretCapLeft: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    left: -8,
  },
  minaretCapRight: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    left: -8,
  },
});
