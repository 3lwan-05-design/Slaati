import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';
import {
  getCityName,
  getCountryName,
  searchCities,
} from '../services/cityService';

export default function CityPickerModal({
  visible,
  onClose,
  onSelect,
  selectedCityId = null,
}) {
  const { colors } = useTheme();
  const { t, isRTL, language } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const results = useMemo(
    () => searchCities(query, { language }),
    [query, language]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('cityPicker.title')}</Text>
              <Text style={styles.subtitle}>{t('cityPicker.subtitle')}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('cityPicker.close')}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchField}>
            <MaterialCommunityIcons name="magnify" size={19} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('cityPicker.search')}
              placeholderTextColor={colors.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={colors.textFaint}
                />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons
                  name="map-marker-off-outline"
                  size={32}
                  color={colors.textFaint}
                />
                <Text style={styles.emptyTitle}>{t('cityPicker.empty')}</Text>
                <Text style={styles.emptyText}>{t('cityPicker.emptyHint')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = item.id === selectedCityId;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.cityRow,
                    selected && styles.cityRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.cityIcon}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={18}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={styles.cityCopy}>
                    <Text style={[styles.cityName, selected && styles.cityNameSelected]}>
                      {getCityName(item, language)}
                    </Text>
                    <Text style={styles.countryName}>{getCountryName(item, language)}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={selected ? 'check-circle' : isRTL ? 'chevron-left' : 'chevron-right'}
                    size={20}
                    color={selected ? colors.primary : colors.textFaint}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    backdrop: {
      // absoluteFillObject is undefined in native RN — keep literals explicit.
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    sheet: {
      maxHeight: '84%',
      backgroundColor: colors.backgroundAlt,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.borderStrong,
      paddingHorizontal: 18,
      ...SHADOWS.card,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
      marginTop: 10,
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
      textAlign: isRTL ? 'right' : 'left',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: isRTL ? 0 : 12,
      marginRight: isRTL ? 12 : 0,
    },
    searchField: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 46,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      height: '100%',
      marginHorizontal: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    listContent: {
      paddingBottom: 8,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 10,
      borderRadius: RADIUS.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    cityRowSelected: {
      backgroundColor: colors.primarySoft,
      borderBottomColor: 'transparent',
    },
    cityIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSoft,
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
    },
    cityCopy: {
      flex: 1,
    },
    cityName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    cityNameSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    countryName: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 10,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.72,
    },
  });
