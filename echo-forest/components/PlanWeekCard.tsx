import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Tr } from '../lib/i18n';
import { getCompletionRate } from '../lib/weekMath';
import type { WeekRecord } from '../lib/types';

interface PlanWeekCardProps {
  weekIndex: number;
  isCurrent: boolean;
  record: WeekRecord;
  tr: Tr;
  rs: (n: number) => number;
  rf: (n: number) => number;
  canEditPlan: boolean;
  canEditActual: boolean;
  planInput: string;
  actualInput: string;
  onPlanInput: (v: string) => void;
  onActualInput: (v: string) => void;
  onAddPlan: () => void;
  onAddActual: () => void;
  onToggleDone: (planIdx: number) => void;
  editingInputs: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

export function PlanWeekCard({
  weekIndex,
  isCurrent,
  record,
  tr,
  rs,
  rf,
  canEditPlan,
  canEditActual,
  planInput,
  actualInput,
  onPlanInput,
  onActualInput,
  onAddPlan,
  onAddActual,
  onToggleDone,
  editingInputs,
  isSelected,
  onSelect,
}: PlanWeekCardProps) {
  const rate = getCompletionRate(record);
  const completionPct = rate !== null ? Math.round(rate * 100) : null;
  const styles = createStyles(rs, rf);

  return (
    <Pressable onPress={onSelect} style={[styles.card, isCurrent && styles.cardCurrent, isSelected && styles.cardSelected]}>
      <View style={styles.header}>
        <Text style={styles.weekTitle}>
          {tr.week}
          {weekIndex + 1}
          {tr.weekSuffix}
          {isCurrent ? tr.thisWeekTag : ''}
        </Text>
        {completionPct !== null && <Text style={styles.rateBadge}>{completionPct}%</Text>}
      </View>

      <Text style={styles.sectionLabel}>{tr.intentions}</Text>
      {record.plans.length === 0 ? (
        <Text style={styles.empty}>{tr.noPlansForWeek}</Text>
      ) : (
        record.plans.map((plan, idx) => (
          <View key={`${plan}-${idx}`} style={styles.planRow}>
            <Pressable
              style={[styles.doneDot, record.completedPlanIndices.includes(idx) && styles.doneDotActive]}
              onPress={() => canEditActual && onToggleDone(idx)}
            >
              <Text style={styles.doneText}>✓</Text>
            </Pressable>
            <Text style={styles.planText}>{plan}</Text>
          </View>
        ))
      )}

      {editingInputs && canEditPlan && (
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.inlineInput}
            value={planInput}
            onChangeText={onPlanInput}
            placeholder={tr.intentions}
            placeholderTextColor="#6C7C74"
          />
          <Pressable style={styles.inlineBtn} onPress={onAddPlan}>
            <Text style={styles.inlineBtnText}>{tr.add}</Text>
          </Pressable>
        </View>
      )}
      {editingInputs && !canEditPlan && isCurrent && <Text style={styles.lockText}>{tr.planLocked}</Text>}

      <Text style={styles.sectionLabel}>{tr.achievements}</Text>
      {record.actuals.map((actual, idx) => (
        <Text key={`${actual}-${idx}`} style={styles.actualLine}>
          • {actual}
        </Text>
      ))}
      {editingInputs && canEditActual && (
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.inlineInput}
            value={actualInput}
            onChangeText={onActualInput}
            placeholder={tr.achievements}
            placeholderTextColor="#6C7C74"
          />
          <Pressable style={styles.inlineBtn} onPress={onAddActual}>
            <Text style={styles.inlineBtnText}>{tr.add}</Text>
          </Pressable>
        </View>
      )}
      {editingInputs && !canEditActual && record.plans.length > 0 && (
        <Text style={styles.lockText}>{tr.actualLocked}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (rs: (n: number) => number, rf: (n: number) => number) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: 'rgba(126,149,138,0.16)',
      borderRadius: rs(12),
      backgroundColor: 'rgba(29,42,35,0.3)',
      padding: rs(14),
      marginBottom: rs(16),
    },
    cardCurrent: { borderColor: 'rgba(184,232,200,0.28)', backgroundColor: 'rgba(29,42,35,0.42)' },
    cardSelected: { borderColor: 'rgba(184,232,200,0.45)' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(10) },
    weekTitle: { color: '#DEE6E2', fontSize: rf(17), fontWeight: '500' },
    rateBadge: { color: '#9FD4B0', fontSize: rf(12), fontWeight: '600' },
    sectionLabel: { color: '#A8B8B0', fontSize: rf(11), marginTop: rs(6), marginBottom: rs(8), letterSpacing: 0.5 },
    empty: { color: '#71817A', fontSize: rf(13), marginBottom: rs(4) },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: rs(9), marginBottom: rs(8) },
    doneDot: { width: rs(18), height: rs(18), borderRadius: rs(9), borderWidth: 1, borderColor: '#5B6C65', alignItems: 'center', justifyContent: 'center' },
    doneDotActive: { backgroundColor: '#B8E4C8', borderColor: '#B8E4C8' },
    doneText: { color: '#1A3126', fontSize: rf(10), fontWeight: '700' },
    planText: { color: '#D3DDD8', flex: 1, fontSize: rf(14), lineHeight: rf(20) },
    actualLine: { color: '#D3DDD8', fontSize: rf(14), lineHeight: rf(22), marginBottom: rs(4) },
    inlineRow: { marginTop: rs(8), flexDirection: 'row', alignItems: 'center', gap: rs(8) },
    inlineInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: 'rgba(117,138,129,0.2)',
      borderRadius: rs(10),
      color: '#D4DFD9',
      paddingHorizontal: rs(10),
      paddingVertical: rs(8),
      fontSize: rf(12),
    },
    inlineBtn: { borderRadius: rs(8), borderWidth: 1, borderColor: 'rgba(140,166,153,0.3)', paddingHorizontal: rs(10), paddingVertical: rs(7) },
    inlineBtnText: { color: '#CFE0D8', fontSize: rf(11) },
    lockText: { marginTop: rs(6), color: '#71817A', fontSize: rf(11) },
  });
