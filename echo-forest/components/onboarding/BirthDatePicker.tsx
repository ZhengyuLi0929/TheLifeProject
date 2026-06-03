import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { parseDate } from '../../lib/weekMath';

interface BirthDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  rs: (n: number) => number;
  rf: (n: number) => number;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const pad = (n: number) => String(n).padStart(2, '0');

export function BirthDatePicker({ value, onChange, rs, rf }: BirthDatePickerProps) {
  const parsed = parseDate(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(parsed?.getFullYear() ?? 1995);
  const [month, setMonth] = useState((parsed?.getMonth() ?? 0) + 1);
  const [day, setDay] = useState(parsed?.getDate() ?? 1);

  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1), [year, month]);

  const display = value || '请选择日期';
  const styles = createStyles(rs, rf);

  const confirm = () => {
    const d = Math.min(day, daysInMonth(year, month));
    onChange(`${year}-${pad(month)}-${pad(d)}`);
    setOpen(false);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{display}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>选择出生日期</Text>
            <View style={styles.columns}>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {YEARS.map((y) => (
                  <Pressable key={y} style={[styles.item, y === year && styles.itemActive]} onPress={() => setYear(y)}>
                    <Text style={[styles.itemText, y === year && styles.itemTextActive]}>{y}年</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m) => (
                  <Pressable key={m} style={[styles.item, m === month && styles.itemActive]} onPress={() => setMonth(m)}>
                    <Text style={[styles.itemText, m === month && styles.itemTextActive]}>{m}月</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
                {days.map((d) => (
                  <Pressable key={d} style={[styles.item, d === day && styles.itemActive]} onPress={() => setDay(d)}>
                    <Text style={[styles.itemText, d === day && styles.itemTextActive]}>{d}日</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={styles.confirmBtn} onPress={confirm}>
              <Text style={styles.confirmText}>确定</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (rs: (n: number) => number, rf: (n: number) => number) =>
  StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: 'rgba(121,143,134,0.35)',
      borderRadius: rs(12),
      paddingHorizontal: rs(16),
      paddingVertical: rs(14),
      backgroundColor: 'rgba(18,30,24,0.6)',
      minWidth: rs(260),
    },
    triggerText: { color: '#D8E4DE', fontSize: rf(16) },
    placeholder: { color: '#6C7C74' },
    chevron: { color: '#8FA89A', fontSize: rf(14) },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: '#101E18',
      borderTopLeftRadius: rs(20),
      borderTopRightRadius: rs(20),
      paddingTop: rs(18),
      paddingBottom: rs(28),
      paddingHorizontal: rs(16),
      borderWidth: 1,
      borderColor: 'rgba(111,136,124,0.2)',
    },
    sheetTitle: { color: '#DEE6E2', fontSize: rf(17), fontWeight: '500', textAlign: 'center', marginBottom: rs(14) },
    columns: { flexDirection: 'row', height: rs(180), gap: rs(8) },
    col: { flex: 1 },
    item: { paddingVertical: rs(10), alignItems: 'center', borderRadius: rs(8) },
    itemActive: { backgroundColor: 'rgba(136,166,143,0.22)' },
    itemText: { color: '#9AABA3', fontSize: rf(15) },
    itemTextActive: { color: '#DEE6E2', fontWeight: '600' },
    confirmBtn: {
      marginTop: rs(16),
      borderRadius: rs(12),
      borderWidth: 1,
      borderColor: 'rgba(139,161,150,0.25)',
      paddingVertical: rs(13),
      alignItems: 'center',
    },
    confirmText: { color: '#D5DED9', fontSize: rf(16), fontWeight: '600' },
  });
