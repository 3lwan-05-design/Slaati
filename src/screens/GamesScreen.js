import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';
import quran from '../data/quran.json';

const CORRECT_ANSWERS = [2, 2, 1, 2, 0, 2, 2, 1, 2, 1, 1, 2, 1, 1, 0, 1];

const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// True/False answers for statements games.tf1..tf12 (1 = true, 0 = false).
const TF_ANSWERS = [1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

const GAME_TABS = [
  { key: 'quiz', icon: 'head-question-outline' },
  { key: 'order', icon: 'sort-variant' },
  { key: 'tf', icon: 'check-bold' },
  { key: 'hl', icon: 'scale-balance' },
  { key: 'mem', icon: 'grid' },
  { key: 'tasbih', icon: 'circle-multiple-outline' },
];

// Memory pairs: a larger pool of surahs with distinct ayah counts.
// buildMemDeck() picks 6 distinct (by ayah count) at random each round.
const MEM_PAIR_POOL = [
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  36, 55, 67, 78, 93, 94, 97, 103, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
];

const chapterOf = (number) => quran.chapters.find((c) => c.number === number);

// Pools for the daily rotation: every new day the app shows a fresh
// selection/order, so the games never feel the same twice.
const QUIZ_POOL = CORRECT_ANSWERS.map((correct, i) => ({ number: i + 1, correct }));
const TF_POOL = TF_ANSWERS.map((answer, i) => ({ key: `games.tf${i + 1}`, answer }));
const QUIZ_PER_DAY = 10;
const TF_PER_DAY = 8;

function dayNumber() {
  return Math.floor(Date.now() / 86400000);
}

// Deterministic shuffle (mulberry32) — same seed = same order.
function seededShuffle(list, seed) {
  let a = (seed >>> 0) || 1;
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dailyDeck(pool, size, salt) {
  return seededShuffle(pool, dayNumber() + salt).slice(0, size);
}

function replayDeck(pool, size) {
  return seededShuffle(pool, dayNumber() + Math.floor(Math.random() * 1e9)).slice(0, size);
}

function shuffleList(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Two random surahs with different ayah counts (no ties).
function pickHlPair() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const a = 1 + Math.floor(Math.random() * 114);
    let b = 1 + Math.floor(Math.random() * 114);
    if (a === b) continue;
    const ca = chapterOf(a);
    const cb = chapterOf(b);
    if (ca && cb && ca.versesCount !== cb.versesCount) {
      return [a, b];
    }
  }
  return [1, 2]; // fallback: 7 vs 286 ayahs
}

// Memory deck: each pair appears twice (card id = `${number}:${side}`).
// Picks 6 surahs with distinct ayah counts at random each round.
function buildMemDeck() {
  const shuffled = shuffleList([...MEM_PAIR_POOL]);
  const chosen = [];
  const usedCounts = new Set();
  for (const number of shuffled) {
    if (chosen.length >= 6) break;
    const chapter = chapterOf(number);
    if (!chapter || usedCounts.has(chapter.versesCount)) continue;
    usedCounts.add(chapter.versesCount);
    chosen.push(number);
  }
  const cards = [];
  chosen.forEach((number) => {
    cards.push({ id: `${number}:a`, pair: number, side: 'surah' });
    cards.push({ id: `${number}:b`, pair: number, side: 'ayah' });
  });
  return cards;
}

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL, language } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(33);

  // "Order of prayers" mini-game
  const [orderDeck, setOrderDeck] = useState(() => shuffleList(PRAYER_ORDER));
  const [orderPlaced, setOrderPlaced] = useState([]);
  const [orderMistakes, setOrderMistakes] = useState(0);
  const [orderWrongKey, setOrderWrongKey] = useState(null);
  const orderDone = orderPlaced.length === PRAYER_ORDER.length;

  // Game selector (only the chosen card is shown)
  const [game, setGame] = useState('quiz');

  // Daily decks: fresh selection every date, reshuffled on replay.
  const [quizDeck, setQuizDeck] = useState(() => dailyDeck(QUIZ_POOL, QUIZ_PER_DAY, 0));
  const [tfDeck, setTfDeck] = useState(() => dailyDeck(TF_POOL, TF_PER_DAY, 4242));

  // "True / False" mini-game
  const [tfIndex, setTfIndex] = useState(0);
  const [tfChoice, setTfChoice] = useState(null);
  const [tfScore, setTfScore] = useState(0);
  const tfDone = tfIndex >= tfDeck.length;

  // Surah name follows the app language (Arabic in AR, Latin in EN/FR).
  const surahName = (chapter) => (language === 'ar' ? chapter.nameArabic : chapter.nameSimple);
  const surahSecondName = (chapter) =>
    language === 'ar' ? chapter.nameSimple : chapter.nameArabic;

  // "Ayah challenge" mini-game (pick the surah with more ayahs)
  const [hlRound, setHlRound] = useState(0);
  const [hlPair, setHlPair] = useState(() => pickHlPair());
  const [hlChoice, setHlChoice] = useState(null);
  const [hlScore, setHlScore] = useState(0);
  const hlDone = hlRound >= 8;

  // "Memory" mini-game (match surah <-> ayah count)
  const [memDeck, setMemDeck] = useState(() => shuffleList(buildMemDeck()));
  const [memOpen, setMemOpen] = useState([]);
  const [memMatched, setMemMatched] = useState([]);
  const [memMoves, setMemMoves] = useState(0);
  const memDone = memMatched.length === 6;

  const questions = useMemo(
    () =>
      quizDeck.map((item) => {
        const baseOptions = t(`games.q${item.number}.options`).split('|');
        // Shuffle the answer positions for every question so the correct
        // choice is never in the same spot twice.
        const order = shuffleList(baseOptions.map((_, i) => i));
        return {
          question: t(`games.q${item.number}.question`),
          options: order.map((i) => baseOptions[i]),
          correct: order.indexOf(item.correct),
          note: t(`games.q${item.number}.note`),
        };
      }),
    [quizDeck, t]
  );

  const question = questions[index];
  const isCorrect = selected === question.correct;
  const progress = useMemo(
    () => Math.round(((index + (selected === null ? 0 : 1)) / questions.length) * 100),
    [index, selected, questions.length]
  );

  const choose = (optionIndex) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correct) {
      setScore((value) => value + 1);
      Vibration.vibrate(30);
    }
  };

  const next = () => {
    if (index === questions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setQuizDeck(replayDeck(QUIZ_POOL, QUIZ_PER_DAY));
  };

  const addTasbih = () => {
    setCount((value) => {
      const nextValue = value + 1;
      if (nextValue === target) Vibration.vibrate([0, 60, 50, 60]);
      return nextValue >= target ? target : nextValue;
    });
  };

  const tapPrayerForOrder = (key) => {
    if (orderDone) return;
    const expected = PRAYER_ORDER[orderPlaced.length];
    if (key === expected) {
      setOrderPlaced((current) => [...current, key]);
      setOrderWrongKey(null);
      Vibration.vibrate(20);
      return;
    }
    setOrderMistakes((value) => value + 1);
    setOrderWrongKey(key);
    Vibration.vibrate([0, 40, 40, 40]);
    setTimeout(() => setOrderWrongKey(null), 500);
  };

  const restartOrder = () => {
    setOrderDeck(shuffleList(PRAYER_ORDER));
    setOrderPlaced([]);
    setOrderMistakes(0);
    setOrderWrongKey(null);
  };

  // --- True / False ---
  const tfChoose = (choice) => {
    if (tfChoice !== null || tfDone) return;
    setTfChoice(choice);
    const answer = tfDeck[tfIndex].answer;
    if (choice === answer) setTfScore((value) => value + 1);
    Vibration.vibrate(choice === answer ? 30 : [0, 40, 40, 40]);
  };

  const tfNext = () => {
    setTfIndex((value) => value + 1);
    setTfChoice(null);
  };

  const restartTf = () => {
    setTfIndex(0);
    setTfChoice(null);
    setTfScore(0);
    setTfDeck(replayDeck(TF_POOL, TF_PER_DAY));
  };

  // --- Ayah challenge ---
  const hlPick = (choice) => {
    if (hlChoice !== null || hlDone) return;
    setHlChoice(choice);
    const chosen = chapterOf(choice);
    const other = chapterOf(hlPair[0] === choice ? hlPair[1] : hlPair[0]);
    if (chosen && other && chosen.versesCount > other.versesCount) {
      setHlScore((value) => value + 1);
      Vibration.vibrate(30);
    } else {
      Vibration.vibrate([0, 40, 40, 40]);
    }
  };

  const hlNext = () => {
    setHlRound((value) => value + 1);
    setHlChoice(null);
    setHlPair(pickHlPair());
  };

  const restartHl = () => {
    setHlRound(0);
    setHlChoice(null);
    setHlScore(0);
    setHlPair(pickHlPair());
  };

  // --- Memory ---
  const memTap = (card) => {
    if (memDone) return;
    if (memMatched.includes(card.pair)) return;
    if (memOpen.length >= 2) return;
    if (memOpen.includes(card.id)) return;
    const open = [...memOpen, card.id];
    setMemOpen(open);
    if (open.length < 2) return;

    setMemMoves((value) => value + 1);
    const [first, second] = open.map((id) => memDeck.find((c) => c.id === id));
    const isMatch = first.pair === second.pair && first.side !== second.side;
    if (isMatch) {
      setMemMatched((current) => [...current, first.pair]);
      setMemOpen([]);
      Vibration.vibrate(30);
    } else {
      Vibration.vibrate([0, 40, 40, 40]);
      setTimeout(() => setMemOpen([]), 650);
    }
  };

  const restartMem = () => {
    setMemDeck(shuffleList(buildMemDeck()));
    setMemOpen([]);
    setMemMatched([]);
    setMemMoves(0);
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 18) + 6 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('games.eyebrow')}</Text>
            <Text style={styles.title}>{t('games.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="gamepad-variant" size={22} color={colors.gold} />
            </View>
          </View>
        </View>

        <Text style={styles.subtitle}>{t('games.subtitle')}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroll}
        >
          {GAME_TABS.map((tab) => {
            const active = game === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setGame(tab.key)}
                style={({ pressed }) => [
                  styles.tabChip,
                  active && styles.tabChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={15}
                  color={active ? colors.background : colors.primary}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t(`games.tab.${tab.key}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {game === 'quiz' ? (
        <View style={styles.quizCard}>
          <View style={styles.quizTop}>
            <View style={styles.quizBadge}>
              <MaterialCommunityIcons name="head-question-outline" size={15} color={colors.primary} />
              <Text style={styles.quizBadgeText}>{t('games.quiz')}</Text>
            </View>
            <Text style={styles.quizScore}>
              {t('games.score', { score, total: questions.length })}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${finished ? 100 : progress}%` }]} />
          </View>

          {finished ? (
            <View style={styles.finishedWrap}>
              <View style={styles.finishedIcon}>
                <MaterialCommunityIcons name="star-circle" size={42} color={colors.gold} />
              </View>
              <Text style={styles.finishedTitle}>
                {score === questions.length ? t('games.perfect') : t('games.complete')}
              </Text>
              <Text style={styles.finishedText}>
                {t('games.answered', { score, total: questions.length })}
              </Text>
              <Pressable
                onPress={restart}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{t('games.playAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.questionNumber}>
                {t('games.questionOf', { current: index + 1, total: questions.length })}
              </Text>
              <Text style={styles.questionText}>{question.question}</Text>

              <View style={styles.optionsWrap}>
                {question.options.map((option, optionIndex) => {
                  const chosen = selected === optionIndex;
                  const correct = selected !== null && optionIndex === question.correct;
                  const wrong = chosen && optionIndex !== question.correct;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => choose(optionIndex)}
                      style={({ pressed }) => [
                        styles.option,
                        correct && styles.optionCorrect,
                        wrong && styles.optionWrong,
                        pressed && selected === null && styles.pressed,
                      ]}
                    >
                      <View style={[styles.optionLetter, correct && styles.optionLetterCorrect]}>
                        <Text
                          style={[
                            styles.optionLetterText,
                            correct && styles.optionLetterTextCorrect,
                          ]}
                        >
                          {String.fromCharCode(65 + optionIndex)}
                        </Text>
                      </View>
                      <Text style={styles.optionText}>{option}</Text>
                      {correct ? (
                        <MaterialCommunityIcons name="check-circle" size={19} color={colors.primary} />
                      ) : null}
                      {wrong ? (
                        <MaterialCommunityIcons name="close-circle" size={19} color={colors.danger} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {selected !== null ? (
                <View style={[styles.noteCard, isCorrect ? styles.noteCardGood : styles.noteCardBad]}>
                  <Text style={styles.noteTitle}>
                    {isCorrect ? t('games.correct') : t('games.wrong')}
                  </Text>
                  <Text style={styles.noteText}>{question.note}</Text>
                </View>
              ) : null}

              {selected !== null ? (
                <Pressable
                  onPress={next}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>
                    {index === questions.length - 1
                      ? t('games.seeResult')
                      : t('games.nextQuestion')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        ) : null}

        {game === 'order' ? (
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={styles.orderBadge}>
              <MaterialCommunityIcons name="sort-variant" size={15} color={colors.gold} />
              <Text style={styles.orderBadgeText}>{t('games.orderBadge')}</Text>
            </View>
            <Text style={styles.orderMistakes}>
              {t('games.orderMistakes', { count: orderMistakes })}
            </Text>
          </View>

          <Text style={styles.orderSubtitle}>{t('games.orderSubtitle')}</Text>

          {orderWrongKey ? (
            <Text style={styles.orderWrong}>{t('games.orderWrong')}</Text>
          ) : null}

          {orderDone ? (
            <View style={styles.orderDoneWrap}>
              <View style={styles.orderDoneIcon}>
                <MaterialCommunityIcons name="star-circle" size={40} color={colors.gold} />
              </View>
              <Text style={styles.orderDoneTitle}>{t('games.orderDone')}</Text>
              <Text style={styles.orderDoneText}>
                {t('games.orderDoneText', { count: orderMistakes })}
              </Text>
              <Pressable
                onPress={restartOrder}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{t('games.playAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.orderPlacedRow}>
                {orderPlaced.map((key, placedIndex) => (
                  <View key={key} style={styles.orderPlacedChip}>
                    <Text style={styles.orderPlacedNum}>{placedIndex + 1}</Text>
                    <Text style={styles.orderPlacedText}>{t(`prayer.name.${key}`)}</Text>
                  </View>
                ))}
                {orderPlaced.length === 0 ? (
                  <Text style={styles.orderPlacedEmpty}>1 → 2 → 3 → 4 → 5</Text>
                ) : null}
              </View>

              <View style={styles.orderPool}>
                {orderDeck
                  .filter((key) => !orderPlaced.includes(key))
                  .map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => tapPrayerForOrder(key)}
                      style={({ pressed }) => [
                        styles.orderChip,
                        orderWrongKey === key && styles.orderChipWrong,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="bell-outline"
                        size={15}
                        color={
                          orderWrongKey === key ? colors.danger : colors.primary
                        }
                      />
                      <Text
                        style={[
                          styles.orderChipText,
                          orderWrongKey === key && styles.orderChipTextWrong,
                        ]}
                      >
                        {t(`prayer.name.${key}`)}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}
        </View>
        ) : null}

        {game === 'tf' ? (
        <View style={styles.tfCard}>
          <View style={styles.tfTop}>
            <View style={styles.tfBadge}>
              <MaterialCommunityIcons name="check-bold" size={15} color={colors.primary} />
              <Text style={styles.tfBadgeText}>{t('games.tfBadge')}</Text>
            </View>
            <Text style={styles.tfScore}>
              {t('games.score', { score: tfScore, total: tfDeck.length })}
            </Text>
          </View>

          <Text style={styles.tfSubtitle}>{t('games.tfSubtitle')}</Text>

          {tfDone ? (
            <View style={styles.finishedWrap}>
              <View style={styles.finishedIcon}>
                <MaterialCommunityIcons name="star-circle" size={42} color={colors.gold} />
              </View>
              <Text style={styles.finishedTitle}>
                {tfScore === tfDeck.length ? t('games.perfect') : t('games.complete')}
              </Text>
              <Text style={styles.finishedText}>
                {t('games.answered', { score: tfScore, total: tfDeck.length })}
              </Text>
              <Pressable
                onPress={restartTf}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{t('games.playAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.questionNumber}>
                {t('games.questionOf', { current: tfIndex + 1, total: tfDeck.length })}
              </Text>
              <Text style={styles.tfStatement}>{t(tfDeck[tfIndex].key)}</Text>

              <View style={styles.tfButtons}>
                {[
                  { value: 1, label: t('games.tfTrue'), good: true },
                  { value: 0, label: t('games.tfFalse'), good: false },
                ].map((btn) => {
                  const chosen = tfChoice === btn.value;
                  const correct = tfChoice !== null && btn.good === (tfDeck[tfIndex].answer === 1);
                  const isRight = chosen && correct;
                  const isWrong = chosen && !correct;
                  return (
                    <Pressable
                      key={btn.label}
                      onPress={() => tfChoose(btn.value)}
                      style={({ pressed }) => [
                        styles.tfBtn,
                        btn.good ? styles.tfBtnTrue : styles.tfBtnFalse,
                        isRight && styles.tfBtnRight,
                        isWrong && styles.tfBtnWrong,
                        pressed && tfChoice === null && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={btn.good ? 'check-circle-outline' : 'close-circle-outline'}
                        size={18}
                        color={
                          isRight
                            ? colors.primary
                            : isWrong
                              ? colors.danger
                              : btn.good
                                ? colors.primary
                                : colors.danger
                        }
                      />
                      <Text
                        style={[
                          styles.tfBtnText,
                          isRight && styles.tfBtnTextRight,
                          isWrong && styles.tfBtnTextWrong,
                        ]}
                      >
                        {btn.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {tfChoice !== null ? (
                <Pressable
                  onPress={tfNext}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>
                    {tfIndex === tfDeck.length - 1
                      ? t('games.seeResult')
                      : t('games.nextQuestion')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        ) : null}

        {game === 'hl' ? (
        <View style={styles.hlCard}>
          <View style={styles.hlTop}>
            <View style={styles.hlBadge}>
              <MaterialCommunityIcons name="scale-balance" size={15} color={colors.gold} />
              <Text style={styles.hlBadgeText}>{t('games.hlBadge')}</Text>
            </View>
            <Text style={styles.hlScore}>
              {t('games.score', { score: hlScore, total: 8 })}
            </Text>
          </View>

          <Text style={styles.hlSubtitle}>{t('games.hlSubtitle')}</Text>

          {hlDone ? (
            <View style={styles.finishedWrap}>
              <View style={styles.finishedIcon}>
                <MaterialCommunityIcons name="star-circle" size={42} color={colors.gold} />
              </View>
              <Text style={styles.finishedTitle}>
                {hlScore === 8 ? t('games.perfect') : t('games.complete')}
              </Text>
              <Text style={styles.finishedText}>
                {t('games.answered', { score: hlScore, total: 8 })}
              </Text>
              <Pressable
                onPress={restartHl}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{t('games.playAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.questionNumber}>
                {t('games.questionOf', { current: hlRound + 1, total: 8 })}
              </Text>
              <Text style={styles.hlQuestion}>{t('games.hlQuestion')}</Text>

              <View style={styles.hlPair}>
                {hlPair.map((number) => {
                  const chapter = chapterOf(number);
                  const chosen = hlChoice === number;
                  const otherNumber = hlPair[0] === number ? hlPair[1] : hlPair[0];
                  const other = chapterOf(otherNumber);
                  const showRight = hlChoice !== null && chapter.versesCount > other.versesCount;
                  const showWrong = chosen && !showRight;
                  return (
                    <Pressable
                      key={number}
                      onPress={() => hlPick(number)}
                      style={({ pressed }) => [
                        styles.hlSide,
                        showRight && styles.hlSideRight,
                        showWrong && styles.hlSideWrong,
                        pressed && hlChoice === null && styles.pressed,
                      ]}
                    >
                      <Text style={styles.hlNum}>{chapter.number}</Text>
                      <Text style={styles.hlName}>{surahName(chapter)}</Text>
                      <Text style={styles.hlArabic}>{surahSecondName(chapter)}</Text>
                      <Text style={styles.hlAyahs}>
                        {t('quran.ayahs', { count: chapter.versesCount })}
                      </Text>
                      {showRight ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={colors.primary}
                        />
                      ) : null}
                      {showWrong ? (
                        <MaterialCommunityIcons
                          name="close-circle"
                          size={18}
                          color={colors.danger}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {hlChoice !== null ? (
                <Pressable
                  onPress={hlNext}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryButtonText}>
                    {hlRound === 7 ? t('games.seeResult') : t('games.nextQuestion')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
        ) : null}

        {game === 'mem' ? (
        <View style={styles.memCard}>
          <View style={styles.memTop}>
            <View style={styles.memBadge}>
              <MaterialCommunityIcons name="grid" size={15} color={colors.primary} />
              <Text style={styles.memBadgeText}>{t('games.memBadge')}</Text>
            </View>
            <Text style={styles.memMoves}>{t('games.memMoves', { count: memMoves })}</Text>
          </View>

          <Text style={styles.memSubtitle}>{t('games.memSubtitle')}</Text>

          {memDone ? (
            <View style={styles.finishedWrap}>
              <View style={styles.finishedIcon}>
                <MaterialCommunityIcons name="star-circle" size={42} color={colors.gold} />
              </View>
              <Text style={styles.finishedTitle}>{t('games.memDone')}</Text>
              <Text style={styles.finishedText}>
                {t('games.memDoneText', { count: memMoves })}
              </Text>
              <Pressable
                onPress={restartMem}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>{t('games.playAgain')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.memGrid}>
              {memDeck.map((card) => {
                const isOpen =
                  memOpen.includes(card.id) || memMatched.includes(card.pair);
                const matched = memMatched.includes(card.pair);
                const chapter = chapterOf(card.pair);
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => memTap(card)}
                    style={({ pressed }) => [
                      styles.memTile,
                      isOpen && styles.memTileOpen,
                      matched && styles.memTileMatched,
                      pressed && styles.pressed,
                    ]}
                  >
                    {isOpen ? (
                      <View style={styles.memFace}>
                        <Text style={[styles.memTileText, matched && styles.memTileTextMatched]}>
                          {card.side === 'surah'
                            ? surahName(chapter)
                            : t('quran.ayahs', { count: chapter.versesCount })}
                        </Text>
                      </View>
                    ) : (
                      <MaterialCommunityIcons
                        name="star-four-points-outline"
                        size={18}
                        color={colors.textFaint}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
        ) : null}

        {game === 'tasbih' ? (
        <View style={styles.tasbihCard}>
          <View style={styles.tasbihTop}>
            <View style={styles.tasbihIcon}>
              <MaterialCommunityIcons
                name="circle-multiple-outline"
                size={22}
                color={colors.background}
              />
            </View>
            <View style={styles.tasbihCopy}>
              <Text style={styles.tasbihTitle}>{t('games.tasbihTitle')}</Text>
              <Text style={styles.tasbihSubtitle}>{t('games.tasbihSubtitle')}</Text>
            </View>
            <View style={styles.targetRow}>
              {[33, 99].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    setTarget(value);
                    setCount(0);
                  }}
                  style={[styles.targetChip, target === value && styles.targetChipActive]}
                >
                  <Text style={[styles.targetText, target === value && styles.targetTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <LinearGradient
            colors={[colors.primarySoft, 'rgba(0,0,0,0)']}
            style={styles.tasbihDisplay}
          >
            <Text style={styles.tasbihArabic}>سبحان الله</Text>
            <Text style={styles.tasbihCount}>
              {count}
              <Text style={styles.tasbihTarget}> / {target}</Text>
            </Text>
            {count >= target ? (
              <Text style={styles.tasbihDone}>{t('games.targetComplete')}</Text>
            ) : (
              <Text style={styles.tasbihHint}>{t('games.dhikr')}</Text>
            )}
          </LinearGradient>

          <View style={styles.tasbihActions}>
            <Pressable
              onPress={() => setCount(0)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="restart" size={18} color={colors.text} />
              <Text style={styles.secondaryButtonText}>{t('common.reset')}</Text>
            </Pressable>
            <Pressable
              onPress={addTasbih}
              style={({ pressed }) => [styles.countButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="plus" size={24} color={colors.background} />
              <Text style={styles.countButtonText}>{t('games.countAction')}</Text>
            </Pressable>
          </View>
        </View>
        ) : null}

        <Text style={styles.footer}>{t('games.footer')}</Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
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
      letterSpacing: isRTL ? 0 : 2,
      marginBottom: 4,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      textAlign: isRTL ? 'right' : 'left',
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: isRTL ? 'right' : 'left',
    },
    tabsScroll: {
      marginBottom: 14,
    },
    tabsRow: {
      gap: 8,
      paddingRight: 4,
    },
    tabChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 13,
      paddingVertical: 9,
      ...SHADOWS.card,
    },
    tabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    tabTextActive: {
      color: colors.background,
    },
    quizCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 18,
      ...SHADOWS.card,
    },
    quizTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    quizBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    quizBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.1,
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    quizScore: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: '700',
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceSoft,
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    questionNumber: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: isRTL ? 0 : 0.7,
      marginBottom: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    questionText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
      marginBottom: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    optionsWrap: {
      marginBottom: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 11,
      paddingVertical: 11,
      marginBottom: 8,
    },
    optionCorrect: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    optionWrong: {
      backgroundColor: 'rgba(226,112,112,0.1)',
      borderColor: 'rgba(226,112,112,0.4)',
    },
    optionLetter: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
    },
    optionLetterCorrect: {
      backgroundColor: colors.primary,
    },
    optionLetterText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    optionLetterTextCorrect: {
      color: colors.background,
    },
    optionText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    noteCard: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      padding: 12,
      marginTop: 8,
      marginBottom: 12,
    },
    noteCardGood: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    noteCardBad: {
      backgroundColor: 'rgba(226,112,112,0.08)',
      borderColor: 'rgba(226,112,112,0.25)',
    },
    noteTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 3,
      textAlign: isRTL ? 'right' : 'left',
    },
    noteText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 17,
      textAlign: isRTL ? 'right' : 'left',
    },
    primaryButton: {
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 14,
      fontWeight: '800',
    },
    finishedWrap: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    finishedIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    finishedTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
    },
    finishedText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 5,
      marginBottom: 14,
    },
    orderCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 18,
      ...SHADOWS.card,
    },
    orderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    orderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.goldSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    orderBadgeText: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.1,
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    orderMistakes: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    orderSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    orderWrong: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    orderPlacedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
      minHeight: 30,
    },
    orderPlacedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    orderPlacedNum: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
      marginRight: isRTL ? 0 : 5,
      marginLeft: isRTL ? 5 : 0,
    },
    orderPlacedText: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: '700',
    },
    orderPlacedEmpty: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    orderPool: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    orderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    orderChipWrong: {
      backgroundColor: 'rgba(226,112,112,0.1)',
      borderColor: 'rgba(226,112,112,0.45)',
    },
    orderChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginLeft: isRTL ? 0 : 6,
      marginRight: isRTL ? 6 : 0,
    },
    orderChipTextWrong: {
      color: colors.danger,
    },
    orderDoneWrap: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    orderDoneIcon: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    orderDoneTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    orderDoneText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 12,
    },
    tfCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 18,
      ...SHADOWS.card,
    },
    tfTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    tfBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    tfBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.1,
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    tfScore: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: '700',
    },
    tfSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    tfStatement: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 25,
      marginBottom: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    tfButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    tfBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 46,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    tfBtnTrue: {
      borderColor: 'rgba(94,183,150,0.4)',
      backgroundColor: 'rgba(94,183,150,0.08)',
    },
    tfBtnFalse: {
      borderColor: 'rgba(226,112,112,0.4)',
      backgroundColor: 'rgba(226,112,112,0.07)',
    },
    tfBtnRight: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    tfBtnWrong: {
      backgroundColor: 'rgba(226,112,112,0.14)',
      borderColor: colors.danger,
    },
    tfBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    tfBtnTextRight: {
      color: colors.primary,
    },
    tfBtnTextWrong: {
      color: colors.danger,
    },
    hlCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 18,
      ...SHADOWS.card,
    },
    hlTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    hlBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.goldSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    hlBadgeText: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.1,
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    hlScore: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: '700',
    },
    hlSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    hlQuestion: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
      textAlign: 'center',
    },
    hlPair: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    hlSide: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    hlSideRight: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    hlSideWrong: {
      backgroundColor: 'rgba(226,112,112,0.12)',
      borderColor: colors.danger,
    },
    hlNum: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    hlName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 2,
      textAlign: 'center',
    },
    hlArabic: {
      color: colors.gold,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 2,
    },
    hlAyahs: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 4,
      textAlign: 'center',
    },
    memCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 12,
      marginBottom: 18,
      ...SHADOWS.card,
    },
    memTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    memBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    memBadgeText: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.1,
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    memMoves: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    memSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    memGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
    },
    memTile: {
      width: '31.5%',
      aspectRatio: 1,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memTileOpen: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    memTileMatched: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      opacity: 0.85,
    },
    memFace: {
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    memTileText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    memTileTextMatched: {
      color: colors.primary,
    },
    tasbihCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 16,
      ...SHADOWS.card,
    },
    tasbihTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    tasbihIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tasbihCopy: {
      flex: 1,
      marginLeft: isRTL ? 0 : 10,
      marginRight: isRTL ? 10 : 0,
    },
    tasbihTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    tasbihSubtitle: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    targetChip: {
      width: 36,
      height: 30,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: isRTL ? 0 : 6,
      marginRight: isRTL ? 6 : 0,
    },
    targetChipActive: {
      backgroundColor: colors.goldSoft,
      borderColor: colors.gold,
    },
    targetText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    targetTextActive: {
      color: colors.gold,
    },
    tasbihDisplay: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      paddingVertical: 18,
      marginBottom: 12,
    },
    tasbihArabic: {
      color: colors.gold,
      fontFamily: 'AmiriQuran',
      fontSize: 30,
    },
    tasbihCount: {
      color: colors.text,
      fontSize: 34,
      fontWeight: '700',
      marginTop: 4,
    },
    tasbihTarget: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
    tasbihHint: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    tasbihDone: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
      textAlign: 'center',
    },
    tasbihActions: {
      flexDirection: 'row',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    countButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
    },
    countButtonText: {
      color: colors.background,
      fontSize: 14,
      fontWeight: '800',
      marginLeft: isRTL ? 0 : 4,
      marginRight: isRTL ? 4 : 0,
    },
    footer: {
      color: colors.textMuted,
      fontSize: 10,
      textAlign: 'center',
      letterSpacing: isRTL ? 0 : 1.2,
      marginTop: 20,
    },
    pressed: {
      opacity: 0.72,
    },
  });
