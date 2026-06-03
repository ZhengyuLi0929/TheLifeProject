import { memo } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { colorForWeekCell } from '../lib/completionColors';

export interface WeekCellProps {
  week: number;
  currentWeek: number;
  size: number;
  gap: number;
  radius: number;
  pulse: Animated.Value;
  completionRate: number | null;
  beforeProgress: boolean;
  onPress?: (week: number) => void;
}

export const WeekCell = memo(function WeekCell({
  week,
  currentWeek,
  size,
  gap,
  radius,
  pulse,
  completionRate,
  beforeProgress,
  onPress,
}: WeekCellProps) {
  const isCurrent = week === currentWeek;
  const isFuture = week > currentWeek;
  const color = colorForWeekCell({
    isCurrent,
    isFuture,
    beforeProgress,
    completionRate,
  });

  const cell = (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: color,
        opacity: isCurrent ? pulse : 1,
        borderWidth: isCurrent ? 1 : 0,
        borderColor: 'rgba(200, 245, 215, 0.55)',
        shadowColor: isCurrent ? '#C9F8DA' : 'transparent',
        shadowOpacity: isCurrent ? 0.85 : 0,
        shadowRadius: isCurrent ? 6 : 0,
      }}
    />
  );

  const wrap = { width: size + gap * 2, height: size + gap * 2, padding: gap };

  if (!onPress) {
    return <View style={wrap}>{cell}</View>;
  }

  return (
    <Pressable onPress={() => onPress(week)} style={wrap}>
      {cell}
    </Pressable>
  );
});
