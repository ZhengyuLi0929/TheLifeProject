/** Green–brown ladder by plan completion (past weeks). Current week uses a dedicated glow fill. */
export function colorForWeekCell(opts: {
  isCurrent: boolean;
  isFuture: boolean;
  beforeProgress: boolean;
  completionRate: number | null;
}): string {
  const { isCurrent, isFuture, beforeProgress, completionRate } = opts;

  if (beforeProgress) return '#141210';
  if (isFuture) return '#1A2420';
  if (isCurrent) return '#C9F8DA';

  if (completionRate !== null) {
    if (completionRate >= 0.85) return '#7AE8A0';
    if (completionRate >= 0.7) return '#52C97A';
    if (completionRate >= 0.55) return '#3A9E5C';
    if (completionRate >= 0.4) return '#2E6840';
    if (completionRate >= 0.25) return '#4A3828';
    if (completionRate > 0) return '#3D2E22';
    return '#2A1C14';
  }

  return '#252E2A';
}
