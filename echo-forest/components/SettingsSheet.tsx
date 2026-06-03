import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { resetOnboardingForDev } from '../lib/onboardingStorage';
import type { Tr } from '../lib/i18n';
import { parseDate } from '../lib/weekMath';
import type { Account, AppSettings, Language, Milestone } from '../lib/types';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  account: Account | null;
  settings: AppSettings;
  tr: Tr;
  rs: (n: number) => number;
  rf: (n: number) => number;
  onChangeSettings: (patch: Partial<AppSettings>) => void;
  onLogout: () => void;
}

export function SettingsSheet({
  visible,
  onClose,
  account,
  settings,
  tr,
  rs,
  rf,
  onChangeSettings,
  onLogout,
}: SettingsSheetProps) {
  const { width: screenW } = useWindowDimensions();
  const sheetW = Math.min(screenW * 0.86, rs(340));
  const slide = useRef(new Animated.Value(sheetW)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(sheetW);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(slide, { toValue: sheetW, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [fade, mounted, sheetW, slide, visible]);

  const updateMilestone = (id: string, patch: Partial<Milestone>) => {
    onChangeSettings({
      milestones: settings.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  const addMilestone = () => {
    if (!milestoneTitle.trim() || !parseDate(milestoneDate)) return;
    onChangeSettings({
      milestones: [
        ...settings.milestones,
        { id: `ms_${Date.now()}`, title: milestoneTitle.trim(), date: milestoneDate, showTimeBefore: true },
      ],
    });
    setMilestoneTitle('');
    setMilestoneDate('');
  };

  const styles = createStyles(rs, rf, sheetW);

  if (!mounted && !visible) return null;

  return (
    <Modal visible={mounted || visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.mask, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { transform: [{ translateX: slide }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sheetTitle}>{tr.settings}</Text>

            <View style={styles.profileRow}>
              <View style={styles.treeAvatar}>
                <Text style={styles.treeEmoji}>🌲</Text>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{account?.name ?? '—'}</Text>
                <Text style={styles.profileEmail}>{account?.email ?? ''}</Text>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{tr.defaultView}</Text>
              <View style={styles.segment}>
                <Pressable
                  style={[styles.segmentOption, settings.defaultView === 'life' && styles.segmentOptionActive]}
                  onPress={() => onChangeSettings({ defaultView: 'life' })}
                >
                  <Text style={styles.segmentText}>{tr.life}</Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentOption, settings.defaultView === 'year' && styles.segmentOptionActive]}
                  onPress={() => onChangeSettings({ defaultView: 'year' })}
                >
                  <Text style={styles.segmentText}>{tr.annual}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{tr.language}</Text>
              <Pressable onPress={() => onChangeSettings({ language: (settings.language === 'zh' ? 'en' : 'zh') as Language })}>
                <Text style={styles.settingValue}>{settings.language === 'zh' ? '中文' : 'English'}</Text>
              </Pressable>
            </View>
            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>{tr.reminders}</Text>
              <Pressable
                style={[styles.toggleTrack, settings.reminders && styles.toggleTrackOn]}
                onPress={() => onChangeSettings({ reminders: !settings.reminders })}
              >
                <View style={[styles.toggleDot, settings.reminders && styles.toggleDotOn]} />
              </Pressable>
            </View>
            <View style={styles.divider} />

            <Text style={styles.groupTitle}>{tr.milestones}</Text>
            {settings.milestones.length === 0 ? (
              <Text style={styles.hint}>{tr.noMilestones}</Text>
            ) : (
              settings.milestones.map((m) => (
                <View key={m.id} style={styles.milestoneBlock}>
                  <View style={styles.milestoneHeader}>
                    <View style={styles.milestoneInfo}>
                      <Text style={styles.milestoneTitle}>{m.title}</Text>
                      <Text style={styles.milestoneDate}>{m.date}</Text>
                    </View>
                    <Pressable
                      style={styles.milestoneDelete}
                      onPress={() => onChangeSettings({ milestones: settings.milestones.filter((x) => x.id !== m.id) })}
                    >
                      <Text style={styles.milestoneDeleteText}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.milestoneSwitchRow}>
                    <Text style={styles.milestoneSwitchLabel}>{tr.showTimeBeforeMilestone}</Text>
                    <Pressable
                      style={[styles.toggleTrack, m.showTimeBefore && styles.toggleTrackOn]}
                      onPress={() => updateMilestone(m.id, { showTimeBefore: !m.showTimeBefore })}
                    >
                      <View style={[styles.toggleDot, m.showTimeBefore && styles.toggleDotOn]} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            <TextInput
              style={styles.input}
              placeholder={tr.milestoneTitle}
              placeholderTextColor="#6C7C74"
              value={milestoneTitle}
              onChangeText={setMilestoneTitle}
            />
            <TextInput
              style={styles.input}
              placeholder={tr.milestoneDate}
              placeholderTextColor="#6C7C74"
              value={milestoneDate}
              onChangeText={setMilestoneDate}
              autoCapitalize="none"
            />
            <Pressable style={styles.addBtn} onPress={addMilestone}>
              <Text style={styles.addBtnText}>{tr.addMilestone}</Text>
            </Pressable>

            <Pressable
              style={styles.replayBtn}
              onPress={() => {
                void resetOnboardingForDev().then(() => Alert.alert(tr.replayOnboarding, tr.replayOnboardingHint));
              }}
            >
              <Text style={styles.replayText}>{tr.replayOnboarding}</Text>
            </Pressable>

            <Pressable style={styles.logoutBtn} onPress={onLogout}>
              <Text style={styles.logoutText}>{tr.logout}</Text>
            </Pressable>
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{tr.close}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (rs: (n: number) => number, rf: (n: number) => number, sheetW: number) =>
  StyleSheet.create({
    root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
    mask: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
    sheet: {
      width: sheetW,
      height: '100%',
      backgroundColor: '#0f1d17',
      borderLeftWidth: 1,
      borderLeftColor: 'rgba(126,149,138,0.22)',
      paddingHorizontal: rs(22),
      paddingTop: rs(52),
      paddingBottom: rs(24),
    },
    scrollContent: { paddingBottom: rs(12) },
    sheetTitle: { color: '#D5DFDA', fontSize: rf(18), fontWeight: '600', marginBottom: rs(16) },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: rs(14), marginBottom: rs(20) },
    treeAvatar: {
      width: rs(52),
      height: rs(52),
      borderRadius: rs(26),
      backgroundColor: '#1A2620',
      alignItems: 'center',
      justifyContent: 'center',
    },
    treeEmoji: { fontSize: rf(26) },
    profileMeta: { flex: 1 },
    profileName: { color: '#D7E2DC', fontSize: rf(18), fontWeight: '500' },
    profileEmail: { color: '#8C9A94', fontSize: rf(12), marginTop: rs(4) },
    settingRow: { minHeight: rs(46), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingLabel: { color: '#CFD8D3', fontSize: rf(14), flex: 1, marginRight: rs(8) },
    settingValue: { color: '#D0DED7', fontSize: rf(13) },
    divider: { height: 1, backgroundColor: 'rgba(107,123,116,0.16)', marginVertical: rs(4) },
    segment: { width: rs(128), height: rs(32), borderRadius: rs(16), backgroundColor: '#27342E', flexDirection: 'row', padding: rs(3) },
    segmentOption: { flex: 1, borderRadius: rs(13), justifyContent: 'center', alignItems: 'center' },
    segmentOptionActive: { backgroundColor: '#6D846E' },
    segmentText: { color: '#D9E4DD', fontSize: rf(11) },
    toggleTrack: { width: rs(36), height: rs(20), borderRadius: rs(10), backgroundColor: '#425149', justifyContent: 'center', paddingHorizontal: rs(2) },
    toggleTrackOn: { backgroundColor: '#657D6F' },
    toggleDot: { width: rs(16), height: rs(16), borderRadius: rs(8), backgroundColor: '#9BAAA3' },
    toggleDotOn: { alignSelf: 'flex-end', backgroundColor: '#D0DED6' },
    groupTitle: { color: '#A8B8B0', fontSize: rf(13), marginTop: rs(12), marginBottom: rs(10) },
    hint: { color: '#6F7C76', fontSize: rf(11), marginBottom: rs(10) },
    milestoneBlock: {
      marginBottom: rs(12),
      padding: rs(12),
      borderRadius: rs(10),
      borderWidth: 1,
      borderColor: 'rgba(126,149,138,0.18)',
      backgroundColor: 'rgba(22,32,27,0.5)',
    },
    milestoneHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: rs(10) },
    milestoneInfo: { flex: 1 },
    milestoneTitle: { color: '#D3DDD8', fontSize: rf(14), fontWeight: '500' },
    milestoneDate: { color: '#7D8C86', fontSize: rf(11), marginTop: rs(4) },
    milestoneSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: rs(8) },
    milestoneSwitchLabel: { color: '#9AABA2', fontSize: rf(11), flex: 1, lineHeight: rf(16) },
    milestoneDelete: { padding: rs(4) },
    milestoneDeleteText: { color: '#8A9A92', fontSize: rf(18) },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(117,138,129,0.25)',
      borderRadius: rs(10),
      color: '#D4DFD9',
      paddingHorizontal: rs(12),
      paddingVertical: rs(10),
      fontSize: rf(13),
      marginBottom: rs(8),
    },
    addBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: rs(14),
      paddingVertical: rs(8),
      borderRadius: rs(10),
      borderWidth: 1,
      borderColor: 'rgba(140,166,153,0.3)',
      marginBottom: rs(12),
    },
    addBtnText: { color: '#CFE0D8', fontSize: rf(12) },
    replayBtn: { marginTop: rs(16), height: rs(40), borderRadius: rs(12), borderWidth: 1, borderColor: 'rgba(140,166,153,0.28)', alignItems: 'center', justifyContent: 'center' },
    replayText: { color: '#B8C8C0', fontSize: rf(13) },
    logoutBtn: { marginTop: rs(10), height: rs(40), borderRadius: rs(12), borderWidth: 1, borderColor: 'rgba(114,130,123,0.22)', alignItems: 'center', justifyContent: 'center' },
    logoutText: { color: '#8A9A92', fontSize: rf(13) },
    closeBtn: { marginTop: rs(8), alignItems: 'center', paddingVertical: rs(10) },
    closeBtnText: { color: '#9AABA2', fontSize: rf(14) },
  });
