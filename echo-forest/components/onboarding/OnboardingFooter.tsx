import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OnboardingFooterProps {
  nextLabel: string;
  bottomInset: number;
  onSkip: () => void;
  onNext: () => void;
  rs: (n: number) => number;
  rf: (n: number) => number;
}

/**
 * 底部按钮栏 — 点击逻辑由父组件传入的 onSkip / onNext 执行。
 * 勿在此 View 上使用 onStartShouldSetResponder，否则会拦截 Pressable 的点击。
 */
export function OnboardingFooter({ nextLabel, bottomInset, onSkip, onNext, rs, rf }: OnboardingFooterProps) {
  const styles = createStyles(rs, rf);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, rs(16)) }]}>
      <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.6} accessibilityRole="button">
        <Text style={styles.skipText}>跳过</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.75} accessibilityRole="button">
        <Text style={styles.nextText}>{nextLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (rs: (v: number) => number, rf: (v: number) => number) =>
  StyleSheet.create({
    bar: {
      flexShrink: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: rs(24),
      paddingTop: rs(12),
      backgroundColor: '#000000',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(120,140,130,0.35)',
      minHeight: rs(72),
    },
    skipBtn: { minHeight: rs(48), minWidth: rs(80), justifyContent: 'center', alignItems: 'center' },
    skipText: { color: '#D0E0D8', fontSize: rf(17) },
    nextBtn: {
      minHeight: rs(48),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: rs(14),
      borderWidth: 1,
      borderColor: 'rgba(184,228,200,0.6)',
      paddingHorizontal: rs(28),
      paddingVertical: rs(12),
      backgroundColor: '#2D503C',
    },
    nextText: { color: '#F0FAF4', fontSize: rf(17), fontWeight: '600' },
  });
