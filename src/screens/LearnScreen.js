import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { HADITHS } from '../data/hadith';
import { SIRAH } from '../data/sirah';
import { LESSONS } from '../data/lessons';
import { FR_HADITH, FR_SIRAH, FR_LESSONS } from '../data/learn-fr';
import { AR_SIRAH, AR_LESSONS } from '../data/learn-ar';
import { askAI } from '../ai';
import { IS_LITE } from '../config/lite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import { RADIUS, SHADOWS } from '../theme';

const KEYS = [
  { id: 'hadith', labelKey: 'learn.tab.hadith', icon: 'book-open-page-variant-outline' },
  { id: 'sirah', labelKey: 'learn.tab.sirah', icon: 'book-open-outline' },
  { id: 'lessons', labelKey: 'learn.tab.lessons', icon: 'school-outline' },
];

function HadithCard({ item, meaning, styles, colors, t }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons name={item.icon} size={20} color={colors.gold} />
        </View>
        <View style={styles.cardHeadCopy}>
          <Text style={styles.cardTopic}>{item.topic}</Text>
          <View style={styles.authenticRow}>
            <MaterialCommunityIcons
              name={item.authentic === 'hasan' ? 'check-decagram-outline' : 'check-decagram'}
              size={13}
              color={item.authentic === 'hasan' ? colors.primary : colors.gold}
            />
            <Text
              style={[
                styles.authenticText,
                { color: item.authentic === 'hasan' ? colors.primary : colors.gold },
              ]}
            >
              {item.authentic === 'hasan'
                ? t('learn.hasan')
                : t('learn.authentic')}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.hadithArabic}>{item.arabic}</Text>

      {meaning ? (
        <>
          <View style={styles.hadithDivider} />
          <Text style={styles.hadithEn}>{meaning}</Text>
        </>
      ) : null}

      <View style={styles.cardFoot}>
        <Text style={styles.cardFootText}>{t('learn.hadithNarrator', { narrator: item.narrator })}</Text>
        <Text style={styles.cardFootText}>{t('learn.source', { source: item.source })}</Text>
      </View>
    </View>
  );
}

function SirahCard({ item, expanded, onToggle, styles, colors, t }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.card, styles.clickCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardIconPrimary}>
          <MaterialCommunityIcons name={item.icon} size={20} color={colors.background} />
        </View>
        <View style={styles.cardHeadCopy}>
          <Text style={styles.cardPeriod}>{item.period.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </View>

      <Text style={styles.cardExcerpt}>{item.excerpt}</Text>

      {expanded ? (
        <View style={styles.storyBody}>
          {item.en.map((paragraph, index) => (
            <Text key={index} style={styles.storyParagraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>{t('learn.expand')}</Text>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.textFaint} />
        </View>
      )}
    </Pressable>
  );
}

function LessonCard({ item, expanded, onToggle, styles, colors, t }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.card, styles.clickCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHead}>
        <View style={styles.cardIconPrimary}>
          <MaterialCommunityIcons name={item.icon} size={20} color={colors.background} />
        </View>
        <View style={styles.cardHeadCopy}>
          <Text style={styles.cardPeriod}>{item.category.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </View>

      {expanded ? (
        <View style={styles.storyBody}>
          {item.en.map((line, index) => (
            <View key={index} style={styles.lessonLine}>
              <View style={styles.lessonBullet} />
              <Text style={styles.lessonText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>{t('learn.expand')}</Text>
          <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.textFaint} />
        </View>
      )}
    </Pressable>
  );
}

function renderMarkdownLite(text, styles) {
  // Minimal markdown → React Native Text for AI answers:
  // **bold** and *italic* become styled spans; everything else stays plain.
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t${key++}`}>{text.slice(lastIndex, match.index)}</Text>
      );
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <Text key={`b${key++}`} style={styles.aiMdBold}>
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <Text key={`i${key++}`} style={styles.aiMdItalic}>
          {token.slice(1, -1)}
        </Text>
      );
    } else {
      parts.push(
        <Text key={`c${key++}`} style={styles.aiMdCode}>
          {token.slice(1, -1)}
        </Text>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(<Text key={`t${key++}`}>{text.slice(lastIndex)}</Text>);
  }
  return parts;
}

export function AIPanel({ t, language, styles, colors }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('slati.aiChat.v1')
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const safe = parsed.filter(
                (m) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string'
              );
              setMessages(safe);
            }
          } catch (e) {
            AsyncStorage.removeItem('slati.aiChat.v1').catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('slati.aiChat.v1', JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      try {
        scrollRef.current.scrollToEnd({ animated: true });
      } catch (e) {}
    }
  }, [messages, loading]);

  const send = async (raw) => {
    const question = String(raw ?? input).trim();
    if (!question || loading) return;
    const EXIT = ['exit', 'quit', 'خروج', 'sortir', 'quitter', 'stop'];
    if (EXIT.includes(question.toLowerCase())) {
      setMessages([]);
      setError(false);
      setInput('');
      return;
    }
    setInput('');
    setError(false);
    const history = messages;
    setMessages((current) => [...current, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const res = await askAI(question, { language, history });
      setMessages((current) => [
        ...current,
        { role: 'ai', text: res.text, sources: res.sources },
      ]);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = ['learn.ai.suggest1', 'learn.ai.suggest2', 'learn.ai.suggest3'];

  return (
    <View style={styles.aiPanel}>
      <View style={styles.aiMetaRow}>
        <MaterialCommunityIcons name="robot-happy-outline" size={15} color={colors.primary} />
        <Text style={styles.aiMeta}>{t('learn.ai.meta')}</Text>
        {messages.length > 0 ? (
          <Pressable
            onPress={() => {
              setMessages([]);
              setError(false);
              AsyncStorage.removeItem('slati.aiChat.v1').catch(() => {});
            }}
            style={({ pressed }) => [styles.aiClearBtn, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="broom" size={13} color={colors.textMuted} />
            <Text style={styles.aiClearText}>{t('learn.ai.clear')}</Text>
          </Pressable>
        ) : null}
      </View>

      {messages.length === 0 && !loading ? (
        <View style={styles.aiWelcome}>
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="robot-happy-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.aiWelcomeText}>{t('learn.ai.welcome')}</Text>
          <View style={styles.aiSuggestCol}>
            {SUGGESTIONS.map((key) => (
              <Pressable
                key={key}
                onPress={() => send(t(key))}
                style={({ pressed }) => [styles.aiSuggest, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name="comment-question-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.aiSuggestText}>{t(key)}</Text>
                <MaterialCommunityIcons name="arrow-right" size={14} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.aiMsgScroll} contentContainerStyle={styles.aiMsgScrollContent} showsVerticalScrollIndicator={false} onContentSizeChange={() => { try { scrollRef.current?.scrollToEnd({ animated: true }); } catch (e) {} }}>
        {messages.map((message, index) => (
        <View
          key={`${index}-${message.role}`}
          style={[styles.aiMsg, message.role === 'user' ? styles.aiMsgUser : styles.aiMsgAi]}
        >
          {message.role === 'ai' ? (
            <View style={styles.aiMsgAvatar}>
              <MaterialCommunityIcons
                name="robot-happy-outline"
                size={15}
                color={colors.primary}
              />
            </View>
          ) : null}
          <View
            style={[
              styles.aiMsgCopy,
              message.role === 'user' ? styles.aiMsgCopyUser : styles.aiMsgCopyAi,
            ]}
          >
            <Text style={styles.aiMsgText}>
              {renderMarkdownLite(message.text, styles)}
            </Text>
            {message.sources && message.sources.length ? (
              <View style={styles.aiSources}>
                <Text style={styles.aiSourcesLabel}>{t('learn.ai.sources')}</Text>
                {message.sources.map((source, sIndex) => {
                  let host = '';
                  try {
                    host = source.url ? new URL(source.url).hostname.replace(/^www\./, '') : '';
                  } catch (e) {
                    host = '';
                  }
                  return (
                    <Text key={sIndex} style={styles.aiSourceText} numberOfLines={2}>
                      {source.title}
                      {host ? ` — ${host}` : ''}
                    </Text>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      ))}
      </ScrollView>

      {loading ? (
        <View style={styles.aiThinking}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.aiThinkingText}>{t('learn.ai.thinking')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.aiError}>
          <MaterialCommunityIcons name="wifi-off" size={15} color={colors.gold} />
          <Text style={styles.aiErrorText}>{t('learn.ai.error')}</Text>
        </View>
      ) : null}

      <View style={styles.aiInputRow}>
        <TextInput
          style={styles.aiInput}
          value={input}
          onChangeText={setInput}
          placeholder={t('learn.ai.placeholder')}
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          editable={!loading}
          multiline
        />
        <Pressable
          onPress={() => send()}
          disabled={loading || !input.trim()}
          style={({ pressed }) => [
            styles.aiSendBtn,
            (loading || !input.trim()) && styles.aiSendBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <MaterialCommunityIcons name="send" size={18} color={colors.background} />
        </Pressable>
      </View>
      <Text style={styles.aiDisclaimer}>{t('learn.ai.disclaimer')}</Text>
    </View>
  );
}

export default function LearnScreen() {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [activeKey, setActiveKey] = useState('hadith');
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) =>
    setExpandedId((current) => (current === id ? null : id));

  const localizeHadith = (hadith) => {
    const loc = language === 'fr' ? FR_HADITH[hadith.id] : null;
    return loc ? { ...hadith, topic: loc.topic || hadith.topic } : hadith;
  };
  const hadithMeaning = (hadith) => {
    if (language === 'ar') return null; // Arabic readers get the original text only
    const loc = language === 'fr' ? FR_HADITH[hadith.id] : null;
    return loc?.meaning || hadith.en;
  };
  const localizeSirah = (story) => {
    const loc =
      language === 'fr' ? FR_SIRAH[story.id] : language === 'ar' ? AR_SIRAH[story.id] : null;
    if (!loc) return story;
    return {
      ...story,
      period: loc.period || story.period,
      title: loc.title || story.title,
      excerpt: loc.excerpt || story.excerpt,
      en: loc.body && loc.body.length ? loc.body : story.en,
    };
  };
  const localizeLesson = (lesson) => {
    const loc =
      language === 'fr' ? FR_LESSONS[lesson.id] : language === 'ar' ? AR_LESSONS[lesson.id] : null;
    if (!loc) return lesson;
    return {
      ...lesson,
      category: loc.category || lesson.category,
      title: loc.title || lesson.title,
      en: loc.body && loc.body.length ? loc.body : lesson.en,
    };
  };

  useEffect(() => {
    if (activeKey === 'ai') {
      try {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      } catch (e) {}
    }
  }, [activeKey]);

  return (
    <ScreenBackground>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 18) + 6 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('learn.eyebrow')}</Text>
            <Text style={styles.title}>{t('learn.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="bookshelf" size={22} color={colors.gold} />
            </View>
          </View>
        </View>

        <Text style={styles.subtitle}>{t('learn.subtitle')}</Text>

        <View style={styles.segmentRow}>
          {KEYS.map((segment) => {
            const active = activeKey === segment.id;
            return (
              <Pressable
                key={segment.id}
                onPress={() => {
                  setActiveKey(segment.id);
                  setExpandedId(null);
                }}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <MaterialCommunityIcons
                  name={segment.icon}
                  size={15}
                  color={active ? colors.background : colors.textMuted}
                />
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                >
                  {t(segment.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeKey === 'hadith' ? (
          <>
            <View style={styles.sectionMetaRow}>
              <Text style={styles.sectionMeta}>{t('learn.hadithMeta', { count: HADITHS.length })}</Text>
            </View>
            {HADITHS.map((hadith) => (
              <HadithCard
                key={hadith.id}
                item={localizeHadith(hadith)}
                meaning={hadithMeaning(hadith)}
                styles={styles}
                colors={colors}
                t={t}
              />
            ))}
          </>
        ) : null}

        {activeKey === 'sirah' ? (
          <>
            <View style={styles.sectionMetaRow}>
              <Text style={styles.sectionMeta}>{t('learn.sirahMeta', { count: SIRAH.length })}</Text>
            </View>
            {SIRAH.map((story) => (
              <SirahCard
                key={story.id}
                item={localizeSirah(story)}
                expanded={expandedId === story.id}
                onToggle={() => toggleExpand(story.id)}
                styles={styles}
                colors={colors}
                t={t}
              />
            ))}
          </>
        ) : null}

        {activeKey === 'lessons' ? (
          <>
            <View style={styles.sectionMetaRow}>
              <Text style={styles.sectionMeta}>
                {t('learn.lessonsMeta', { count: LESSONS.length })}
              </Text>
            </View>
            {LESSONS.map((lesson) => (
              <LessonCard
                key={lesson.id}
                item={localizeLesson(lesson)}
                expanded={expandedId === lesson.id}
                onToggle={() => toggleExpand(lesson.id)}
                styles={styles}
                colors={colors}
                t={t}
              />
            ))}
          </>
        ) : null}

        {!IS_LITE && activeKey === 'ai' ? (
          <AIPanel t={t} language={language} styles={styles} colors={colors} />
        ) : null}

        <Text style={styles.footer}>{t('learn.footer')}</Text>
      </ScrollView>
    </ScreenBackground>
  );
}

export const createStyles = (colors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 30,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 4,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 16,
      maxWidth: 320,
    },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.pill,
      padding: 4,
      marginBottom: 14,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    segmentActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: colors.background,
    },
    sectionMetaRow: {
      paddingHorizontal: 2,
      marginBottom: 10,
    },
    sectionMeta: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '600',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 12,
      ...SHADOWS.card,
    },
    clickCard: {
      overflow: 'hidden',
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
      overflow: 'hidden',
    },
    cardIconPrimary: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
      overflow: 'hidden',
    },
    cardHeadCopy: {
      flex: 1,
    },
    cardTopic: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    cardPeriod: {
      color: colors.textFaint,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    authenticRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    authenticText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    hadithArabic: {
      color: colors.text,
      fontFamily: 'AmiriQuran',
      fontSize: 19,
      lineHeight: 47,
      textAlign: 'right',
      marginTop: 12,
      writingDirection: 'rtl',
      includeFontPadding: true,
    },
    hadithDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    hadithEn: {
      color: colors.textMuted,
      fontSize: 12.5,
      lineHeight: 20,
    },
    cardFoot: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 12,
      paddingTop: 9,
    },
    cardFootText: {
      color: colors.textFaint,
      fontSize: 9.5,
      fontWeight: '600',
    },
    cardExcerpt: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
    },
    storyBody: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 12,
      paddingTop: 11,
    },
    storyParagraph: {
      color: colors.textMuted,
      fontSize: 12.5,
      lineHeight: 20,
      marginBottom: 9,
    },
    lessonLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    lessonBullet: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.gold,
      marginTop: 7,
      marginRight: 9,
    },
    lessonText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12.5,
      lineHeight: 20,
    },
    expandHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    expandHintText: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: '600',
    },
    footer: {
      color: colors.textFaint,
      fontSize: 10,
      textAlign: 'center',
      marginTop: 10,
    },
    aiPanel: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
      ...SHADOWS.card,
    },
     aiMsgScroll: {
       maxHeight: 360,
       marginTop: 8,
     },
     aiMsgScrollContent: {
       flexGrow: 1,
       justifyContent: 'flex-end',
     },
    aiMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    aiMeta: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    aiClearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiClearText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    aiWelcome: {
      alignItems: 'center',
      paddingTop: 4,
      paddingBottom: 6,
    },
    aiAvatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 9,
    },
    aiWelcomeText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 12,
      maxWidth: 290,
    },
    aiSuggestCol: {
      alignSelf: 'stretch',
      gap: 8,
    },
    aiSuggest: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiSuggestText: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    aiMsg: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    aiMsgUser: {
      flexDirection: 'row-reverse',
    },
    aiMsgAi: {},
    aiMsgAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    aiMsgCopy: {
      flex: 1,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      padding: 10,
      overflow: 'hidden',
    },
    aiMsgCopyAi: {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.border,
    },
    aiMsgCopyUser: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    aiMsgText: {
      color: colors.text,
      fontSize: 12.5,
      lineHeight: 20,
    },
    aiMdBold: {
      fontWeight: '800',
      color: colors.text,
    },
    aiMdItalic: {
      fontStyle: 'italic',
      color: colors.text,
    },
    aiMdCode: {
      backgroundColor: colors.surfaceSoft,
      color: colors.gold,
      fontSize: 11.5,
      paddingHorizontal: 3,
    },
    aiSources: {
      marginTop: 8,
      paddingTop: 7,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    aiSourcesLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 3,
    },
    aiSourceText: {
      color: colors.textMuted,
      fontSize: 9.5,
      lineHeight: 14,
      marginBottom: 2,
    },
    aiThinking: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    aiThinkingText: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: '600',
    },
    aiError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: RADIUS.md,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    aiErrorText: {
      flex: 1,
      color: colors.text,
      fontSize: 11,
      lineHeight: 16,
    },
    aiInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 4,
    },
    aiImagePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    aiImageThumb: {
      width: 60,
      height: 60,
      borderRadius: 10,
    },
    aiImageRemove: {
      marginLeft: 6,
    },
    aiImgBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSoft,
    },
    aiMsgImage: {
      width: '100%',
      height: 160,
      borderRadius: 10,
      marginBottom: 6,
    },
    aiInput: {
      flex: 1,
      minHeight: 42,
      maxHeight: 110,
      color: colors.text,
      fontSize: 12.5,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    aiSendBtn: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    aiSendBtnDisabled: {
      opacity: 0.4,
    },
    aiDisclaimer: {
      color: colors.textFaint,
      fontSize: 9.5,
      lineHeight: 14,
      textAlign: 'center',
      marginTop: 9,
    },
    pressed: {
      opacity: 0.72,
    },
  });
