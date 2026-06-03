import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colorForWeekCell } from '../../lib/completionColors';
import { completeOnboardingRegistration, markOnboardingSkipped } from '../../lib/onboardingStorage';
import { LIFE_WEEKS, parseDate } from '../../lib/weekMath';
import { BirthDatePicker } from './BirthDatePicker';
import { OnboardingFooter } from './OnboardingFooter';

type Slide = 0 | 1 | 2 | 3 | 4;

interface OnboardingFlowProps {
  onSkip: () => void;
  onComplete: () => void;
}

const DESIGN_W = 390;
const LIFE_COLS = 52;

/** 各环节文案淡入：更慢、渐变 */
const TEXT_FADE_MS = 1400;
const TEXT_FADE_DELAY_MS = 500;

/** 人生视角三阶段时长 */
const LIFE_CLUSTER_SIDE_MS = 1400;
const LIFE_CLUSTER_HOLD_MS = 900;
const LIFE_ZOOM_MS = 2800;
const LIFE_GRID_REVEAL_MS = 500;
const LIFE_GRID_HOLD_MS = 800;

const fadeInText = (opacity: Animated.Value, delay = TEXT_FADE_DELAY_MS) =>
  Animated.sequence([
    Animated.delay(delay),
    Animated.timing(opacity, {
      toValue: 1,
      duration: TEXT_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ]);

/** 与 AppMain 人生视图一致的网格尺寸 */
function computeLifeGridMetrics(width: number, rs: (n: number) => number) {
  const lifeGap = rs(0.5);
  const avail = Math.max(width - rs(36), rs(200));
  const lifeBlockSize = Math.max(rs(2.8), Math.min(rs(5.2), (avail - lifeGap * 2 * LIFE_COLS) / LIFE_COLS));
  const lifeStride = lifeBlockSize + lifeGap * 2;
  return { lifeGap, lifeBlockSize, lifeStride, lifeGridWidth: LIFE_COLS * lifeStride };
}

/** 保证 7 个方格能完整落在屏幕宽度内 */
function computeWeekSquareSize(width: number, rs: (n: number) => number, lifeBlockSize: number) {
  const weekGap = rs(6);
  const availW = width - rs(48);
  const fitSeven = (availW - weekGap * 6) / 7;
  return Math.max(rs(18), Math.min(fitSeven, rs(30), lifeBlockSize * 8));
}

function usePulse(active: boolean) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.72, duration: 1700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return pulse;
}

function PulsingSquare({
  size,
  pulse,
  style,
}: {
  size: number;
  pulse: Animated.Value;
  style?: object;
}) {
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.12,
          backgroundColor: '#C9F8DA',
          opacity: pulse,
          borderWidth: 1,
          borderColor: 'rgba(200, 245, 215, 0.55)',
          shadowColor: '#C9F8DA',
          shadowOpacity: 0.85,
          shadowRadius: 6,
        },
        style,
      ]}
    />
  );
}

function StaticSquare({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.12,
        backgroundColor: color,
      }}
    />
  );
}

export function OnboardingFlow({ onSkip, onComplete }: OnboardingFlowProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layoutReady = width > 50 && height > 50;
  const scale = layoutReady ? Math.min(width / DESIGN_W, height / 844) : 1;
  const rs = useCallback((v: number) => v * Math.max(scale, 0.85), [scale]);
  const rf = useCallback((v: number) => v * Math.max(Math.min(scale, 1.05), 0.85), [scale]);
  const styles = useMemo(() => createStyles(rs, rf), [rs, rf]);

  const [slide, setSlide] = useState<Slide>(0);
  const [weekMerged, setWeekMerged] = useState(false);
  const [lifeReady, setLifeReady] = useState(false);
  const [lifePhase, setLifePhase] = useState<'cluster' | 'zoom' | 'text'>('cluster');
  const [gridClipH, setGridClipH] = useState(0);
  const [birthVisible, setBirthVisible] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const lifeGrid = useMemo(() => computeLifeGridMetrics(width, rs), [width, rs]);
  const { lifeGap, lifeBlockSize, lifeStride, lifeGridWidth } = lifeGrid;
  const weekGap = rs(6);
  const weekSquareSize = useMemo(
    () => computeWeekSquareSize(width, rs, lifeBlockSize),
    [width, rs, lifeBlockSize]
  );
  const weekStride = weekSquareSize + weekGap * 2;
  const weekRowWidth = 7 * weekStride;
  const zoomScaleStart = weekSquareSize / lifeBlockSize;

  const dayDrop = useRef(new Animated.Value(-160)).current;
  const dayTextOpacity = useRef(new Animated.Value(0)).current;
  const weekSideOpacity = useRef(new Animated.Value(0)).current;
  const weekTextOpacity = useRef(new Animated.Value(0)).current;
  const mergeAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const mergeOpacity = useRef(new Animated.Value(1)).current;
  const lifeClusterSideOpacity = useRef(new Animated.Value(0)).current;
  const lifeFieldOpacity = useRef(new Animated.Value(0)).current;
  const zoomProgress = useRef(new Animated.Value(0)).current;
  const lifeTextOpacity = useRef(new Animated.Value(0)).current;
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const birthOpacity = useRef(new Animated.Value(0)).current;
  const registerOpacity = useRef(new Animated.Value(0)).current;
  const lifeListRef = useRef<FlatList<number>>(null);

  const pulse = usePulse(slide <= 2);
  const demoCurrentWeek = Math.min(Math.floor(LIFE_WEEKS * 0.46), LIFE_WEEKS - 1);
  const lifeWeeks = useMemo(() => Array.from({ length: LIFE_WEEKS }, (_, i) => i), []);
  const lifeRows = Math.ceil(LIFE_WEEKS / LIFE_COLS);
  const lifeContentH = lifeRows * lifeStride;
  const focalCol = demoCurrentWeek % LIFE_COLS;
  const focalRow = Math.floor(demoCurrentWeek / LIFE_COLS);
  const focalX = focalCol * lifeStride + lifeStride / 2;
  const focalY = focalRow * lifeStride + lifeStride / 2;
  const gridClipCenterY = gridClipH > 0 ? gridClipH / 2 : height * 0.36;

  // progress 0→1：以当前周方格为原点缩放，再平移到屏幕中心（避免默认以视图中心缩放导致偏右）
  const gridScale = useMemo(
    () => zoomProgress.interpolate({ inputRange: [0, 1], outputRange: [zoomScaleStart, 1] }),
    [zoomProgress, zoomScaleStart]
  );

  const lifeAnimStartedRef = useRef(false);

  const handleSkip = useCallback(async () => {
    await markOnboardingSkipped();
    onSkip();
  }, [onSkip]);

  const submitRegistration = useCallback(async () => {
    Keyboard.dismiss();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('名字至少需要 2 个字符');
      return;
    }
    if (password.length < 4) {
      Alert.alert('密码至少需要 4 个字符');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('两次输入的密码不一致');
      return;
    }
    if (!parseDate(birthDate)) {
      Alert.alert('出生日期无效，请返回上一步重新选择');
      return;
    }
    try {
      await completeOnboardingRegistration({ name: trimmed, password, birthDate });
    } catch {
      Alert.alert('保存失败', '请稍后重试');
      return;
    }
    onComplete();
  }, [birthDate, confirmPassword, name, onComplete, password]);

  const handleNext = useCallback(() => {
    if (slide === 3) {
      const birth = parseDate(birthDate);
      if (!birth || birth.getTime() > Date.now()) {
        Alert.alert('请填写有效的出生日期');
        return;
      }
      setSlide(4);
      return;
    }
    if (slide === 4) {
      void submitRegistration();
      return;
    }
    if (slide < 4) setSlide((s) => (s + 1) as Slide);
  }, [birthDate, slide, submitRegistration]);

  // Slide 0: drop + text
  useEffect(() => {
    if (!layoutReady || slide !== 0) return;
    dayDrop.setValue(-rs(120));
    dayTextOpacity.setValue(0);
    Animated.sequence([
      Animated.spring(dayDrop, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 5 }),
      fadeInText(dayTextOpacity, 350),
    ]).start();
  }, [layoutReady, slide, dayDrop, dayTextOpacity, rs]);

  // Slide 1: side squares + merge
  useEffect(() => {
    if (slide !== 1) return;
    setWeekMerged(false);
    weekSideOpacity.setValue(0);
    weekTextOpacity.setValue(0);
    mergeAnims.forEach((a) => a.setValue(0));
    mergeOpacity.setValue(1);

    Animated.sequence([
      Animated.timing(weekSideOpacity, {
        toValue: 1,
        duration: LIFE_CLUSTER_SIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      fadeInText(weekTextOpacity, 300),
    ]).start();

    const mergeTimer = setTimeout(() => {
      Animated.parallel([
        ...mergeAnims.map((anim) =>
          Animated.timing(anim, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
        ),
        Animated.timing(mergeOpacity, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]).start(() => setWeekMerged(true));
    }, 2200);

    return () => clearTimeout(mergeTimer);
  }, [slide, mergeAnims, mergeOpacity, weekSideOpacity, weekTextOpacity]);

  // Slide 2: ① 中心发光 + 暗淡邻格 ② 锚定中心 zoom out ③ 文案淡入
  useEffect(() => {
    if (slide !== 2) {
      lifeAnimStartedRef.current = false;
      return;
    }
    if (gridClipH < 80 || lifeAnimStartedRef.current) return;
    lifeAnimStartedRef.current = true;
    setLifeReady(false);
    setLifePhase('cluster');
    lifeClusterSideOpacity.setValue(0);
    lifeFieldOpacity.setValue(0);
    lifeTextOpacity.setValue(0);
    zoomProgress.setValue(0);

    const clusterSideAnim = Animated.timing(lifeClusterSideOpacity, {
      toValue: 1,
      duration: LIFE_CLUSTER_SIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const timers: ReturnType<typeof setTimeout>[] = [];

    clusterSideAnim.start();

    timers.push(
      setTimeout(() => {
        setLifePhase('zoom');
        lifeClusterSideOpacity.setValue(0);
        zoomProgress.setValue(0);
        lifeFieldOpacity.setValue(0);

        const scrollY = Math.max(0, focalY - gridClipCenterY);
        lifeListRef.current?.scrollToOffset({ offset: scrollY, animated: false });

        // ① 先显现全部方格（大尺寸）
        Animated.timing(lifeFieldOpacity, {
          toValue: 1,
          duration: LIFE_GRID_REVEAL_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();

        // ② 停顿后整体 zoom out，当前周保持在屏幕中心
        timers.push(
          setTimeout(() => {
            Animated.timing(zoomProgress, {
              toValue: 1,
              duration: LIFE_ZOOM_MS,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (!finished) return;
              setLifePhase('text');
              setLifeReady(true);
              fadeInText(lifeTextOpacity, 200).start();
            });
          }, LIFE_GRID_REVEAL_MS + LIFE_GRID_HOLD_MS)
        );
      }, LIFE_CLUSTER_SIDE_MS + LIFE_CLUSTER_HOLD_MS)
    );

    return () => {
      clusterSideAnim.stop();
      timers.forEach(clearTimeout);
    };
  }, [
    focalY,
    gridClipCenterY,
    lifeClusterSideOpacity,
    lifeFieldOpacity,
    lifeTextOpacity,
    slide,
    zoomProgress,
    zoomScaleStart,
    gridClipH,
  ]);

  // Slide 3: quote then birth
  useEffect(() => {
    if (slide !== 3) return;
    setBirthVisible(false);
    quoteOpacity.setValue(0);
    birthOpacity.setValue(0);

    fadeInText(quoteOpacity, 200).start();
    const birthTimer = setTimeout(() => {
      setBirthVisible(true);
      fadeInText(birthOpacity, 0).start();
    }, TEXT_FADE_DELAY_MS + TEXT_FADE_MS + 800);

    return () => clearTimeout(birthTimer);
  }, [birthOpacity, quoteOpacity, slide]);

  // Slide 4: register fade in
  useEffect(() => {
    if (slide !== 4) return;
    registerOpacity.setValue(0);
    fadeInText(registerOpacity, 200).start();
  }, [registerOpacity, slide]);

  const renderLifeCell = useCallback(
    ({ item: week }: { item: number }) => {
      const isCurrent = week === demoCurrentWeek;
      const isFuture = week > demoCurrentWeek;
      const color = colorForWeekCell({
        isCurrent,
        isFuture,
        beforeProgress: false,
        completionRate: null,
      });
      return (
        <View style={{ width: lifeStride, height: lifeStride, padding: lifeGap }}>
          <Animated.View
            style={{
              width: lifeBlockSize,
              height: lifeBlockSize,
              borderRadius: rs(0.5),
              backgroundColor: color,
              opacity: isCurrent ? pulse : 1,
              borderWidth: isCurrent ? 1 : 0,
              borderColor: 'rgba(200, 245, 215, 0.55)',
              shadowColor: isCurrent ? '#C9F8DA' : 'transparent',
              shadowOpacity: isCurrent ? 0.85 : 0,
              shadowRadius: isCurrent ? 6 : 0,
            }}
          />
        </View>
      );
    },
    [demoCurrentWeek, lifeBlockSize, lifeGap, lifeStride, pulse, rs]
  );

  const getLifeItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => {
      const row = Math.floor(index / LIFE_COLS);
      return { length: lifeStride, offset: row * lifeStride, index };
    },
    [lifeStride]
  );

  const weekOffsets = [-3, -2, -1, 1, 2, 3].map((i) => i * weekStride);

  if (!layoutReady) {
    return <View style={styles.root} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>回响之森</Text>
        <Text style={styles.headerStep}>{slide + 1} / 5</Text>
      </View>

      <View style={styles.stage} pointerEvents="box-none">
        <View style={styles.slideContent} pointerEvents="box-none">
        {/* Slide 0 — one day */}
        {slide === 0 && (
          <View style={styles.centerStage}>
            <Animated.View style={{ transform: [{ translateY: dayDrop }] }}>
              <PulsingSquare size={weekSquareSize} pulse={pulse} />
            </Animated.View>
            <Animated.Text style={[styles.caption, { opacity: dayTextOpacity }]}>
              这是你的一天。
            </Animated.Text>
          </View>
        )}

        {/* Slide 1 — one week */}
        {slide === 1 && (
          <View style={styles.centerStage}>
            <View style={[styles.weekRow, { width: weekRowWidth, height: weekSquareSize }]}>
              {weekOffsets.map((offset, idx) => {
                const merge = mergeAnims[idx];
                const translateX = merge.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });
                return (
                  <Animated.View
                    key={idx}
                    style={{
                      position: 'absolute',
                      opacity: weekMerged ? 0 : weekSideOpacity,
                      transform: [{ translateX }],
                    }}
                  >
                    <StaticSquare size={weekSquareSize} color="#252E2A" />
                  </Animated.View>
                );
              })}
              <PulsingSquare size={weekSquareSize} pulse={pulse} />
            </View>
            <Animated.Text style={[styles.caption, { opacity: weekTextOpacity }]}>
              七个这样的一天，就组成了一个星期。
            </Animated.Text>
          </View>
        )}

        {/* Slide 2 — 中心锚定 · 三阶段人生 zoom */}
        {slide === 2 && (
          <View style={styles.lifeStage}>
            <View
              style={styles.lifeGridClip}
              onLayout={(e) => setGridClipH(e.nativeEvent.layout.height)}
            >
              {lifePhase === 'cluster' && (
                <View style={styles.lifeClusterStage}>
                  <View style={[styles.weekRow, { width: weekRowWidth, height: weekSquareSize }]}>
                    {weekOffsets.map((offset, idx) => (
                      <Animated.View
                        key={`lc-${idx}`}
                        style={{
                          position: 'absolute',
                          opacity: lifeClusterSideOpacity,
                          transform: [{ translateX: offset }],
                        }}
                      >
                        <StaticSquare size={weekSquareSize} color="#252E2A" />
                      </Animated.View>
                    ))}
                    <PulsingSquare size={weekSquareSize} pulse={pulse} />
                  </View>
                </View>
              )}

              {lifePhase !== 'cluster' && (
                <View style={styles.lifeGridCenter} pointerEvents="box-none">
                  <Animated.View
                    style={{
                      width: lifeGridWidth,
                      height: lifeContentH,
                      opacity: lifeFieldOpacity,
                      transform: [
                        { translateX: width / 2 },
                        { translateY: gridClipCenterY },
                        { scale: gridScale },
                        { translateX: -focalX },
                        { translateY: -focalY },
                      ],
                    }}
                  >
                    <FlatList
                      ref={lifeListRef}
                      data={lifeWeeks}
                      keyExtractor={(w) => `ob-${w}`}
                      numColumns={LIFE_COLS}
                      renderItem={renderLifeCell}
                      getItemLayout={getLifeItemLayout}
                      scrollEnabled={lifeReady}
                      showsVerticalScrollIndicator={false}
                      style={{ width: lifeGridWidth, height: lifeContentH }}
                      initialNumToRender={LIFE_COLS * 14}
                      maxToRenderPerBatch={LIFE_COLS * 8}
                      windowSize={9}
                      removeClippedSubviews={false}
                    />
                  </Animated.View>
                </View>
              )}
            </View>
            {lifePhase === 'text' && (
              <Animated.View style={[styles.lifeTextBlock, { opacity: lifeTextOpacity }]}>
                <Text style={styles.lifeCaption}>4000 个这样的星期，就组成了人的一生。</Text>
                <Text style={styles.lifeFootnote}>
                  注：中国人 2026 年的预期寿命为 79.25 岁，即约 4135 个星期。
                </Text>
              </Animated.View>
            )}
          </View>
        )}

        {/* Slide 3 — quote + birth */}
        {slide === 3 && (
          <Animated.View style={[styles.quoteStage, { opacity: quoteOpacity }]}>
            <Text style={styles.quoteLine}>太多的人活在他人计划的时间表里</Text>
            <Text style={styles.quoteLineSub}>而你在自己的人生中，又是什么进度？</Text>
            {birthVisible && (
              <Animated.View style={[styles.birthBlock, { opacity: birthOpacity }]}>
                <Text style={styles.birthLabel}>请填写您的出生日期</Text>
                <BirthDatePicker value={birthDate} onChange={setBirthDate} rs={rs} rf={rf} />
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Slide 4 — register */}
        {slide === 4 && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.registerWrap}
            keyboardVerticalOffset={insets.top + rs(48)}
          >
            <ScrollView
              style={styles.registerScroll}
              contentContainerStyle={styles.registerScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={{ opacity: registerOpacity, width: '100%', alignItems: 'center' }}>
                <Text style={styles.registerTitle}>给自己取一个好听的名字，一个好记的密码。</Text>
                <TextInput
                  style={styles.input}
                  placeholder="你的名字"
                  placeholderTextColor="#6C7C74"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  placeholder="密码"
                  placeholderTextColor="#6C7C74"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  placeholder="确认密码"
                  placeholderTextColor="#6C7C74"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={() => void submitRegistration()}
                />
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        </View>
      </View>

      <OnboardingFooter
        nextLabel={slide === 4 ? '进入森林' : '下一步'}
        bottomInset={insets.bottom}
        onSkip={() => void handleSkip()}
        onNext={handleNext}
        rs={rs}
        rf={rf}
      />
    </View>
  );
}

const createStyles = (rs: (v: number) => number, rf: (v: number) => number) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },
    header: {
      paddingHorizontal: rs(24),
      paddingTop: rs(8),
      paddingBottom: rs(4),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: { color: '#8F9F97', fontSize: rf(13), letterSpacing: rs(2) },
    headerStep: { color: '#6E7E76', fontSize: rf(12) },
    stage: { flex: 1, overflow: 'hidden' },
    slideContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: rs(20),
    },
    centerStage: { alignItems: 'center', justifyContent: 'center', gap: rs(28), maxWidth: '100%' },
    weekRow: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    caption: {
      color: '#DEE6E2',
      fontSize: rf(18),
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: rf(28),
      letterSpacing: 0.3,
    },
    lifeStage: { flex: 1, width: '100%', alignItems: 'center' },
    lifeGridClip: {
      flex: 1,
      width: '100%',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lifeClusterStage: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lifeGridCenter: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    lifeTextBlock: { paddingVertical: rs(14), paddingHorizontal: rs(8), alignItems: 'center', gap: rs(8) },
    lifeCaption: {
      color: '#DEE6E2',
      fontSize: rf(15),
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: rf(22),
    },
    lifeFootnote: { color: '#7A8A82', fontSize: rf(11), textAlign: 'center', lineHeight: rf(16) },
    quoteStage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: rs(12), gap: rs(18) },
    quoteLine: {
      color: '#DEE6E2',
      fontSize: rf(20),
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: rf(32),
    },
    quoteLineSub: {
      color: '#A8B8B0',
      fontSize: rf(16),
      textAlign: 'center',
      lineHeight: rf(26),
      marginBottom: rs(24),
    },
    birthBlock: { alignItems: 'center', gap: rs(14), marginTop: rs(8) },
    birthLabel: { color: '#9AABA3', fontSize: rf(14) },
    registerWrap: { width: '100%', maxHeight: '100%' },
    registerScroll: { width: '100%' },
    registerScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: rs(8),
      paddingBottom: rs(24),
    },
    registerTitle: {
      color: '#DEE6E2',
      fontSize: rf(18),
      textAlign: 'center',
      lineHeight: rf(28),
      marginBottom: rs(28),
      paddingHorizontal: rs(12),
    },
    input: {
      width: '100%',
      maxWidth: rs(320),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(121,143,134,0.35)',
      color: '#D8E4DE',
      paddingVertical: rs(12),
      marginBottom: rs(16),
      fontSize: rf(16),
    },
  });
