import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { PlanWeekCard } from './components/PlanWeekCard';
import { SettingsSheet } from './components/SettingsSheet';
import { WeekCell } from './components/WeekCell';
import { getDeviceLanguage, tr as getTr } from './lib/i18n';
import { buildDemoState, DEMO_EMAIL, DEMO_PASSWORD, mergeDemoAccount } from './lib/seed';
import type { Account, AppSettings, AuthMode, ForestZoom, PersistedState, TabKey, WeekRecord } from './lib/types';
import {
  getCompletionRate,
  getWeekIndexFromBirth,
  getWeekRecord,
  isWeekBeforeProgressStart,
  LIFE_WEEKS,
  parseDate,
  resolveProgressStartDate,
} from './lib/weekMath';

const STORAGE_KEY = 'echo_forest_v5';
const API_BASE_URL = 'http://localhost:5800';
const DESIGN_W = 390;
const DESIGN_H = 844;

const defaultSettings = (): AppSettings => ({
  language: getDeviceLanguage(),
  defaultView: 'life',
  reminders: true,
  milestones: [],
});

const normalizeMilestones = (milestones: AppSettings['milestones'] | undefined) =>
  (milestones ?? []).map((m) => ({
    ...m,
    showTimeBefore: m.showTimeBefore ?? true,
  }));

const extractBirthDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const normalizeApiAccount = (payload: unknown, fallbackPassword: string): Account | null => {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const source =
    (root.user as Record<string, unknown> | undefined) ??
    (root.account as Record<string, unknown> | undefined) ??
    (root.data as Record<string, unknown> | undefined) ??
    root;
  const birthDate = extractBirthDate(source.birthDate ?? source.birthday ?? source.dateOfBirth);
  if (typeof source.name !== 'string' || typeof source.email !== 'string' || !birthDate) return null;
  return {
    name: source.name,
    email: source.email.toLowerCase(),
    birthDate,
    password: fallbackPassword,
  };
};

const requestApi = async (path: string, body: Record<string, unknown>) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : null;
};

const getPinchDistance = (touches: readonly { pageX: number; pageY: number }[]) => {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

export default function AppMain() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [weeks, setWeeks] = useState<Record<string, WeekRecord>>({});
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tab, setTab] = useState<TabKey>('forest');
  const [forestZoom, setForestZoom] = useState<ForestZoom>('life');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [editWeek, setEditWeek] = useState<number | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [planInput, setPlanInput] = useState('');
  const [actualInput, setActualInput] = useState('');

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const navAnim = useRef(new Animated.Value(1)).current;
  const didInitialScrollRef = useRef(false);
  const lifeListRef = useRef<FlatList<number>>(null);
  const yearListRef = useRef<FlatList<number>>(null);
  const planListRef = useRef<FlatList<number>>(null);
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const pinchStartRef = useRef(0);
  const pinchRatioRef = useRef(1);

  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
  const rs = useCallback((v: number) => v * scale, [scale]);
  const rf = useCallback((v: number) => v * Math.min(scale, 1.05), [scale]);
  const styles = useMemo(() => createStyles(rs, rf), [rs, rf]);
  const tr = getTr(settings.language);

  const currentWeek = useMemo(
    () => (account ? Math.min(getWeekIndexFromBirth(account.birthDate, now), LIFE_WEEKS - 1) : 0),
    [account, now]
  );
  const currentYear = now.getFullYear();
  const activeEditWeek = editWeek ?? currentWeek;

  const progressStartDate = useMemo(
    () => resolveProgressStartDate(settings.milestones),
    [settings.milestones]
  );

  const planWeeks = useMemo(
    () => Array.from({ length: Math.min(52, currentWeek + 1) }, (_, i) => currentWeek - i),
    [currentWeek]
  );

  const lifeWeeks = useMemo(() => Array.from({ length: LIFE_WEEKS }, (_, i) => i), []);

  const cycleWeeks = useMemo(() => {
    if (!account) return [];
    const birth = parseDate(account.birthDate);
    if (!birth) return [];
    const yearStart = new Date(currentYear, 0, 1);
    const startWeek = Math.max(0, Math.floor((yearStart.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    return Array.from({ length: 52 }, (_, i) => startWeek + i).filter((v) => v < LIFE_WEEKS);
  }, [account, currentYear]);

  const lifeGap = rs(0.5);
  const yearGap = rs(3);

  const annualBlockSize = useMemo(() => {
    const avail = Math.max(width - rs(56), rs(200));
    return Math.max(rs(14), Math.min(rs(34), (avail - yearGap * 2 * 7) / 7));
  }, [width, rs, yearGap]);

  const lifeBlockSize = useMemo(() => {
    const avail = Math.max(width - rs(36), rs(200));
    return Math.max(rs(2.8), Math.min(rs(5.2), (avail - lifeGap * 2 * 52) / 52));
  }, [width, rs, lifeGap]);

  const lifeStride = lifeBlockSize + lifeGap * 2;
  const yearStride = annualBlockSize + yearGap * 2;
  const lifeGridWidth = 52 * lifeStride;
  const yearGridWidth = 7 * yearStride;
  const activeGridWidth = forestZoom === 'life' ? lifeGridWidth : yearGridWidth;

  const gridExtraData = useMemo(
    () => ({ weeks, currentWeek, progressStartDate }),
    [weeks, currentWeek, progressStartDate]
  );

  const weekLabel = `${tr.week}${currentWeek + 1}${tr.weekSuffix}`;

  const scrollGridsToCurrent = useCallback(
    (animated: boolean) => {
      const lifeRow = Math.floor(currentWeek / 52);
      const lifeRowH = lifeStride;
      const lifeOffset = Math.max(0, lifeRow * lifeRowH - height * 0.18);
      lifeListRef.current?.scrollToOffset({ offset: lifeOffset, animated });

      const yearIdx = cycleWeeks.indexOf(currentWeek);
      if (yearIdx >= 0) {
        const yearRow = Math.floor(yearIdx / 7);
        const yearRowH = yearStride;
        const yearOffset = Math.max(0, yearRow * yearRowH - height * 0.12);
        yearListRef.current?.scrollToOffset({ offset: yearOffset, animated });
      }
    },
    [annualBlockSize, currentWeek, cycleWeeks, height, lifeBlockSize, lifeStride, rs, yearStride]
  );

  const setForestZoomInstant = useCallback((next: ForestZoom) => {
    setForestZoom((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    if (tab !== 'forest') return;
    pulseLoopRef.current?.stop();
    pulse.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.72, duration: 1700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1700, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [pulse, tab]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        let parsed: PersistedState | null = raw ? JSON.parse(raw) : null;
        if (!parsed?.account) {
          parsed = buildDemoState();
        } else if (parsed.account.email === DEMO_EMAIL) {
          parsed = mergeDemoAccount(parsed);
        }
        if (parsed.account) {
          setAccount(parsed.account);
          setAuthenticated(true);
          setForestZoom(parsed.settings?.defaultView ?? 'life');
        }
        if (parsed.weeks) setWeeks(parsed.weeks);
        setSettings({
          ...defaultSettings(),
          ...parsed.settings,
          milestones: normalizeMilestones(parsed.settings?.milestones),
          language: parsed.settings?.language ?? getDeviceLanguage(),
        });
      } finally {
        setBooting(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (booting) return;
    const state: PersistedState = { account, weeks, settings };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [booting, account, weeks, settings]);

  useEffect(() => {
    if (!authenticated || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    const t = setTimeout(() => scrollGridsToCurrent(false), 80);
    return () => clearTimeout(t);
  }, [authenticated, scrollGridsToCurrent]);

  useEffect(() => {
    if (tab !== 'plan') return;
    const idx = planWeeks.indexOf(activeEditWeek);
    if (idx < 0) return;
    const t = setTimeout(() => {
      planListRef.current?.scrollToIndex({ index: idx, animated: false, viewOffset: rs(8) });
    }, 60);
    return () => clearTimeout(t);
  }, [tab, activeEditWeek, planWeeks, rs]);

  const resetNavTimer = useCallback(() => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => setNavVisible(false), 5000);
  }, []);

  const markInteraction = useCallback(() => {
    setNavVisible(true);
    resetNavTimer();
  }, [resetNavTimer]);

  useEffect(() => {
    if (!authenticated) return;
    resetNavTimer();
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, [authenticated, resetNavTimer]);

  useEffect(() => {
    Animated.timing(navAnim, { toValue: navVisible ? 1 : 0, duration: 280, useNativeDriver: true }).start();
  }, [navVisible, navAnim]);

  const switchTab = useCallback(
    (next: TabKey) => {
      if (next === tab) return;
      markInteraction();
      setTab(next);
    },
    [markInteraction, tab]
  );

  const onPinchEnd = useCallback(
    (ratio: number) => {
      if (tab !== 'forest') return;
      if (ratio > 1.12) setForestZoomInstant('year');
      else if (ratio < 0.88) setForestZoomInstant('life');
    },
    [setForestZoomInstant, tab]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (evt) => tab === 'forest' && evt.nativeEvent.touches.length === 2,
        onPanResponderGrant: (evt) => {
          pinchStartRef.current = getPinchDistance(evt.nativeEvent.touches as readonly { pageX: number; pageY: number }[]);
          pinchRatioRef.current = 1;
          markInteraction();
        },
        onPanResponderMove: (evt) => {
          const dist = getPinchDistance(evt.nativeEvent.touches as readonly { pageX: number; pageY: number }[]);
          if (!pinchStartRef.current || !dist) return;
          const ratio = Math.max(0.7, Math.min(1.35, dist / pinchStartRef.current));
          pinchRatioRef.current = ratio;
          pinchScale.setValue(ratio);
        },
        onPanResponderRelease: () => {
          onPinchEnd(pinchRatioRef.current);
          Animated.spring(pinchScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(pinchScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
        },
      }),
    [markInteraction, onPinchEnd, pinchScale, tab]
  );

  const patchSettings = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const register = async () => {
    const birth = parseDate(birthDateInput);
    if (!birth || birth.getTime() > Date.now()) return Alert.alert(tr.invalidDate);
    if (!nameInput || !emailInput || !passwordInput) return;
    try {
      const payload = await requestApi('/auth/register', {
        name: nameInput.trim(),
        email: emailInput.trim().toLowerCase(),
        password: passwordInput,
        birthDate: birthDateInput,
      });
      const acc = normalizeApiAccount(payload, passwordInput);
      if (acc) {
        setAccount(acc);
        setForestZoom(settings.defaultView);
        setAuthenticated(true);
        return;
      }
    } catch {
      /* local */
    }
    setAccount({
      name: nameInput.trim(),
      email: emailInput.trim().toLowerCase(),
      password: passwordInput,
      birthDate: birthDateInput,
    });
    setForestZoom(settings.defaultView);
    setAuthenticated(true);
  };

  const login = async () => {
    if (!emailInput || !passwordInput) return;
    const email = emailInput.trim().toLowerCase();
    try {
      const payload = await requestApi('/auth/login', { email, password: passwordInput });
      const acc = normalizeApiAccount(payload, passwordInput);
      if (acc) {
        setAccount(acc);
        setForestZoom(settings.defaultView);
        setAuthenticated(true);
        return;
      }
    } catch {
      /* local */
    }
    const stored = account ?? (email === DEMO_EMAIL ? mergeDemoAccount(null).account : null);
    if (!stored || stored.email !== email || stored.password !== passwordInput) {
      if (email === DEMO_EMAIL && passwordInput === DEMO_PASSWORD) {
        const demo = mergeDemoAccount(null);
        setAccount(demo.account);
        setWeeks(demo.weeks);
        setSettings({ ...demo.settings, milestones: normalizeMilestones(demo.settings.milestones) });
        setForestZoom(demo.settings.defaultView);
        setAuthenticated(true);
        return;
      }
      return Alert.alert(tr.loginFailed);
    }
    if (stored.email === DEMO_EMAIL) {
      const demo = mergeDemoAccount({ account: stored, weeks, settings });
      setAccount(demo.account);
      setWeeks(demo.weeks);
      setSettings({ ...demo.settings, milestones: normalizeMilestones(demo.settings.milestones) });
    } else {
      setAccount(stored);
    }
    setForestZoom(settings.defaultView);
    setAuthenticated(true);
  };

  const updateWeek = (index: number, updater: (r: WeekRecord) => WeekRecord) => {
    setWeeks((prev) => ({ ...prev, [String(index)]: updater(getWeekRecord(prev, index)) }));
  };

  const openPlanForWeek = useCallback(
    (week: number) => {
      setEditWeek(week);
      switchTab('plan');
    },
    [switchTab]
  );

  const cellMeta = useCallback(
    (week: number) => {
      const record = getWeekRecord(weeks, week);
      const beforeProgress = account
        ? isWeekBeforeProgressStart(week, account.birthDate, progressStartDate)
        : false;
      return {
        completionRate: beforeProgress ? null : getCompletionRate(record),
        beforeProgress,
      };
    },
    [account, progressStartDate, weeks]
  );

  const renderLifeItem = useCallback(
    ({ item }: { item: number }) => {
      const meta = cellMeta(item);
      return (
        <WeekCell
          week={item}
          currentWeek={currentWeek}
          size={lifeBlockSize}
          gap={lifeGap}
          radius={rs(0.5)}
          pulse={pulse}
          completionRate={meta.completionRate}
          beforeProgress={meta.beforeProgress}
        />
      );
    },
    [cellMeta, currentWeek, lifeBlockSize, lifeGap, pulse, rs]
  );

  const renderYearItem = useCallback(
    ({ item }: { item: number }) => {
      const meta = cellMeta(item);
      return (
        <WeekCell
          week={item}
          currentWeek={currentWeek}
          size={annualBlockSize}
          gap={yearGap}
          radius={rs(2)}
          pulse={pulse}
          completionRate={meta.completionRate}
          beforeProgress={meta.beforeProgress}
          onPress={openPlanForWeek}
        />
      );
    },
    [annualBlockSize, cellMeta, currentWeek, openPlanForWeek, pulse, rs, yearGap]
  );

  const getLifeItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => {
      const row = Math.floor(index / 52);
      return { length: lifeStride, offset: row * lifeStride, index };
    },
    [lifeStride]
  );

  const getYearItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => {
      const row = Math.floor(index / 7);
      return { length: yearStride, offset: row * yearStride, index };
    },
    [yearStride]
  );

  const renderPlanWeek = useCallback(
    ({ item: weekIndex }: { item: number }) => {
      const record = getWeekRecord(weeks, weekIndex);
      const isEditing = weekIndex === activeEditWeek;
      return (
        <PlanWeekCard
          weekIndex={weekIndex}
          isCurrent={weekIndex === currentWeek}
          record={record}
          tr={tr}
          rs={rs}
          rf={rf}
          canEditPlan={weekIndex === currentWeek || weekIndex === currentWeek - 1}
          canEditActual={weekIndex <= currentWeek - 1}
          planInput={isEditing ? planInput : ''}
          actualInput={isEditing ? actualInput : ''}
          onPlanInput={setPlanInput}
          onActualInput={setActualInput}
          onAddPlan={() => {
            if (!planInput.trim()) return;
            updateWeek(weekIndex, (r) => ({ ...r, plans: [...r.plans, planInput.trim()] }));
            setPlanInput('');
          }}
          onAddActual={() => {
            if (!actualInput.trim()) return;
            updateWeek(weekIndex, (r) => ({ ...r, actuals: [...r.actuals, actualInput.trim()] }));
            setActualInput('');
          }}
          onToggleDone={(idx) =>
            updateWeek(weekIndex, (r) => {
              const s = new Set(r.completedPlanIndices);
              if (s.has(idx)) s.delete(idx);
              else s.add(idx);
              return { ...r, completedPlanIndices: [...s].sort((a, b) => a - b) };
            })
          }
          editingInputs={isEditing}
          isSelected={weekIndex === activeEditWeek}
          onSelect={() => setEditWeek(weekIndex)}
        />
      );
    },
    [activeEditWeek, actualInput, currentWeek, planInput, rf, rs, tr, weeks]
  );

  const getPlanItemLayout = useCallback(
    (_: ArrayLike<number> | null | undefined, index: number) => ({
      length: rs(220),
      offset: rs(220) * index,
      index,
    }),
    [rs]
  );

  const navStyle = {
    opacity: navAnim,
    transform: [{ translateY: navAnim.interpolate({ inputRange: [0, 1], outputRange: [rs(90), 0] }) }],
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <Text style={styles.bootText}>回响之森</Text>
      </SafeAreaView>
    );
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <LinearGradient colors={['#050B09', '#101E18', '#050B09']} style={styles.bgGradient} />
        <View style={styles.authCard}>
          <View style={styles.authModeRow}>
            <Pressable style={[styles.authModeBtn, authMode === 'login' && styles.authModeBtnActive]} onPress={() => setAuthMode('login')}>
              <Text style={styles.authModeText}>{tr.login}</Text>
            </Pressable>
            <Pressable style={[styles.authModeBtn, authMode === 'register' && styles.authModeBtnActive]} onPress={() => setAuthMode('register')}>
              <Text style={styles.authModeText}>{tr.register}</Text>
            </Pressable>
          </View>
          {authMode === 'register' && (
            <TextInput style={styles.authInput} placeholder={tr.name} placeholderTextColor="#7D8A84" value={nameInput} onChangeText={setNameInput} />
          )}
          <TextInput style={styles.authInput} placeholder={tr.email} placeholderTextColor="#7D8A84" value={emailInput} onChangeText={setEmailInput} autoCapitalize="none" />
          <TextInput style={styles.authInput} placeholder={tr.password} placeholderTextColor="#7D8A84" value={passwordInput} onChangeText={setPasswordInput} secureTextEntry />
          {authMode === 'register' && (
            <TextInput style={styles.authInput} placeholder={tr.birthPlaceholder} placeholderTextColor="#A9B8B0" value={birthDateInput} onChangeText={setBirthDateInput} autoCapitalize="none" />
          )}
          <Pressable style={styles.enterBtn} onPress={authMode === 'register' ? register : login}>
            <Text style={styles.enterText}>{tr.enter}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <LinearGradient colors={['#050B09', '#0B1914', '#050B09']} style={styles.bgGradient} />

      <View style={styles.canvas}>
        <View style={styles.topRow}>
          <Text style={styles.topTitle}>{tr.forestName}</Text>
          <Pressable style={styles.settingsBtn} onPress={() => setSettingsOpen(true)} hitSlop={14}>
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>
        </View>

        <View style={styles.tabHost}>
          <View
            style={[styles.forestBody, tab !== 'forest' && styles.tabHidden]}
            pointerEvents={tab === 'forest' ? 'auto' : 'none'}
            {...(tab === 'forest' ? panResponder.panHandlers : {})}
            onTouchStart={tab === 'forest' ? markInteraction : undefined}
          >
            <View style={styles.titleBlock}>
              {forestZoom === 'life' ? (
                <>
                  <Text style={styles.lifeTitle}>{tr.lifeTitle}</Text>
                  <Text style={styles.lifeSub}>{tr.lifeSubtitle}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.yearText}>{currentYear}</Text>
                  <Text style={styles.lifeSub}>{tr.annualSubtitle}</Text>
                </>
              )}
            </View>

            <View style={styles.gridSectionWrap}>
              <View style={[styles.gridSection, { width: activeGridWidth }]}>
                <Text style={styles.weekCorner}>{weekLabel}</Text>
                <Animated.View style={[styles.gridZone, { width: activeGridWidth, transform: [{ scale: pinchScale }] }]}>
                  <View
                    style={[
                      styles.gridLayer,
                      styles.gridLayerStack,
                      forestZoom === 'life' ? styles.gridLayerActive : styles.gridLayerInactive,
                    ]}
                    pointerEvents={forestZoom === 'life' ? 'auto' : 'none'}
                  >
                    <FlatList
                      ref={lifeListRef}
                      data={lifeWeeks}
                      key="life-grid"
                      keyExtractor={(item) => `l-${item}`}
                      numColumns={52}
                      extraData={gridExtraData}
                      style={{ width: lifeGridWidth }}
                      contentContainerStyle={[styles.forestGrid, { width: lifeGridWidth }]}
                      renderItem={renderLifeItem}
                      getItemLayout={getLifeItemLayout}
                      scrollEnabled={forestZoom === 'life'}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews={forestZoom !== 'life'}
                      initialNumToRender={52 * 4}
                      maxToRenderPerBatch={52 * 2}
                      windowSize={3}
                    />
                  </View>
                  <View
                    style={[
                      styles.gridLayer,
                      styles.gridLayerStack,
                      forestZoom === 'year' ? styles.gridLayerActive : styles.gridLayerInactive,
                    ]}
                    pointerEvents={forestZoom === 'year' ? 'auto' : 'none'}
                  >
                    <FlatList
                      ref={yearListRef}
                      data={cycleWeeks}
                      key="year-grid"
                      keyExtractor={(item) => `y-${item}`}
                      numColumns={7}
                      extraData={gridExtraData}
                      style={{ width: yearGridWidth }}
                      contentContainerStyle={[styles.cycleGrid, { width: yearGridWidth }]}
                      renderItem={renderYearItem}
                      getItemLayout={getYearItemLayout}
                      scrollEnabled={forestZoom === 'year'}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews={forestZoom !== 'year'}
                      initialNumToRender={7 * 8}
                      maxToRenderPerBatch={7 * 4}
                      windowSize={3}
                    />
                  </View>
                </Animated.View>
              </View>
            </View>
          </View>

          <FlatList
            ref={planListRef}
            style={[styles.planScroll, tab !== 'plan' && styles.tabHidden]}
            contentContainerStyle={styles.planScrollContent}
            data={planWeeks}
            keyExtractor={(item) => `plan-${item}`}
            renderItem={renderPlanWeek}
            getItemLayout={getPlanItemLayout}
            showsVerticalScrollIndicator={false}
            pointerEvents={tab === 'plan' ? 'auto' : 'none'}
            onScrollBeginDrag={markInteraction}
            onScrollToIndexFailed={() => undefined}
            initialNumToRender={6}
            windowSize={5}
          />
        </View>
      </View>

      <Animated.View style={[styles.bottomWrap, navStyle]}>
        <View style={styles.bottomDock}>
          <Pressable style={styles.navItem} onPress={() => switchTab('forest')}>
            <Text style={[styles.navIcon, tab === 'forest' && styles.navActive]}>▦</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => { setEditWeek(null); switchTab('plan'); }}>
            <Text style={[styles.navIcon, tab === 'plan' && styles.navActive]}>☰</Text>
          </Pressable>
        </View>
      </Animated.View>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        account={account}
        settings={settings}
        tr={tr}
        rs={rs}
        rf={rf}
        onChangeSettings={patchSettings}
        onLogout={() => {
          setSettingsOpen(false);
          setAuthenticated(false);
          setTab('forest');
          setEmailInput('');
          setPasswordInput('');
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (rs: (v: number) => number, rf: (v: number) => number) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: '#050B09' },
    bgGradient: { ...StyleSheet.absoluteFillObject },
    boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050B09' },
    bootText: { color: '#DDE6E0', fontSize: rf(24), fontWeight: '700' },
    canvas: { flex: 1, paddingHorizontal: rs(18), paddingTop: rs(8), paddingBottom: rs(88) },
    tabHost: { flex: 1, position: 'relative' },
    tabHidden: { opacity: 0 },
    authCard: { marginTop: rs(120), marginHorizontal: rs(6), borderRadius: rs(24), borderWidth: 1, borderColor: 'rgba(111,136,124,0.18)', padding: rs(22), backgroundColor: 'rgba(18,30,24,0.46)' },
    authModeRow: { flexDirection: 'row', gap: rs(8), marginBottom: rs(10) },
    authModeBtn: { flex: 1, borderRadius: rs(10), borderWidth: 1, borderColor: 'rgba(124,146,136,0.14)', paddingVertical: rs(7), alignItems: 'center' },
    authModeBtnActive: { backgroundColor: 'rgba(136,166,143,0.18)', borderColor: 'rgba(171,208,180,0.3)' },
    authModeText: { color: '#B8C8C0', fontSize: rf(12) },
    authInput: { borderBottomWidth: 1, borderBottomColor: 'rgba(121,143,134,0.2)', color: '#D8E4DE', paddingVertical: rs(10), marginBottom: rs(8), fontSize: rf(16) },
    enterBtn: { marginTop: rs(10), borderRadius: rs(14), borderWidth: 1, borderColor: 'rgba(139,161,150,0.2)', alignItems: 'center', justifyContent: 'center', paddingVertical: rs(13) },
    enterText: { color: '#D5DED9', fontSize: rf(16), fontWeight: '600' },
    topRow: { height: rs(36), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topTitle: { color: '#8F9F97', fontSize: rf(13), letterSpacing: rs(3) },
    settingsBtn: { width: rs(20), height: rs(14), justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: rs(1) },
    menuLine: { width: rs(16), height: 1, borderRadius: 1, backgroundColor: 'rgba(143,159,151,0.72)' },
    forestBody: { ...StyleSheet.absoluteFillObject, paddingTop: rs(2) },
    titleBlock: { alignItems: 'center', marginBottom: rs(22) },
    lifeTitle: { color: '#DEE6E2', fontSize: rf(32), fontWeight: '500', marginBottom: rs(24) },
    lifeSub: { color: '#8D9C96', fontSize: rf(13), textAlign: 'center', lineHeight: rf(20), marginBottom: rs(28) },
    yearText: { color: '#C8D2CD', fontSize: rf(44), fontWeight: '300', marginBottom: rs(24) },
    gridSectionWrap: { flex: 1, width: '100%', alignItems: 'center' },
    gridSection: { flex: 1, marginTop: rs(6) },
    weekCorner: { color: '#A0B0A8', fontSize: rf(13), marginBottom: rs(14), alignSelf: 'flex-start' },
    gridZone: { flex: 1, minHeight: rs(180), position: 'relative', overflow: 'hidden' },
    gridLayer: { flex: 1 },
    gridLayerStack: { ...StyleSheet.absoluteFillObject },
    gridLayerActive: { opacity: 1, zIndex: 2 },
    gridLayerInactive: { opacity: 0, zIndex: 0, overflow: 'hidden' },
    forestGrid: { alignSelf: 'flex-start', paddingBottom: rs(16) },
    cycleGrid: { alignSelf: 'flex-start', paddingBottom: rs(16) },
    planScroll: { ...StyleSheet.absoluteFillObject },
    planScrollContent: { paddingTop: rs(12), paddingBottom: rs(24) },
    planWeekTitle: { color: '#DEE6E2', fontSize: rf(22), fontWeight: '500', marginBottom: rs(16) },
    sectionTitle: { color: '#D5DFDA', fontSize: rf(13), marginTop: rs(18), marginBottom: rs(12) },
    card: { borderWidth: 1, borderColor: 'rgba(126,149,138,0.16)', borderRadius: rs(12), backgroundColor: 'rgba(29,42,35,0.3)', padding: rs(12) },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: rs(9), marginBottom: rs(10) },
    doneDot: { width: rs(18), height: rs(18), borderRadius: rs(9), borderWidth: 1, borderColor: '#5B6C65', alignItems: 'center', justifyContent: 'center' },
    doneDotActive: { backgroundColor: '#B8E4C8', borderColor: '#B8E4C8' },
    doneText: { color: '#1A3126', fontSize: rf(10), fontWeight: '700' },
    planText: { color: '#D3DDD8', flex: 1, fontSize: rf(14), lineHeight: rf(20) },
    inlineRow: { marginTop: rs(8), flexDirection: 'row', alignItems: 'center', gap: rs(8) },
    inlineInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(117,138,129,0.2)', borderRadius: rs(10), color: '#D4DFD9', paddingHorizontal: rs(10), paddingVertical: rs(8), fontSize: rf(12) },
    inlineBtn: { borderRadius: rs(8), borderWidth: 1, borderColor: 'rgba(140,166,153,0.3)', paddingHorizontal: rs(10), paddingVertical: rs(7) },
    inlineBtnText: { color: '#CFE0D8', fontSize: rf(11) },
    actualLine: { color: '#D3DDD8', fontSize: rf(14), lineHeight: rf(22), marginBottom: rs(4) },
    lockText: { marginTop: rs(6), color: '#71817A', fontSize: rf(11) },
    metrics: { marginTop: rs(12), gap: rs(4) },
    metricText: { color: '#AFC1B8', fontSize: rf(12) },
    bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: rs(12), alignItems: 'center' },
    bottomDock: {
      width: rs(120),
      height: rs(52),
      borderRadius: rs(26),
      borderWidth: 1,
      borderColor: 'rgba(108,128,118,0.25)',
      backgroundColor: 'rgba(18,30,24,0.85)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
    },
    navItem: { padding: rs(12), alignItems: 'center', justifyContent: 'center' },
    navIcon: { color: '#72827B', fontSize: rf(20) },
    navActive: { color: '#DBE8E1' },
  });
