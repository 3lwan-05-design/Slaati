import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

export default function DeveloperSignature() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <MaterialCommunityIcons name="code-tags" size={14} color={colors.gold} />
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {'Designed & Developed by '}
        <Text style={[styles.name, { color: colors.gold }]}>EL.ASSAL ALAE.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  text: {
    fontSize: 10,
    marginLeft: 6,
  },
  name: {
    fontSize: 10,
    fontWeight: '700',
  },
});
