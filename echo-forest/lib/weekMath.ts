import type { Milestone, WeekRecord } from './types';

export const LIFE_WEEKS = 84 * 52;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export const parseDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getWeekIndexFromBirth = (birthDate: string, now = new Date()) => {
  const birth = parseDate(birthDate);
  if (!birth) return 0;
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / WEEK_MS));
};

export const weekIndexFromDate = (birthDate: string, dateStr: string): number | null => {
  const d = parseDate(dateStr);
  const birth = parseDate(birthDate);
  if (!d || !birth) return null;
  return Math.max(0, Math.floor((d.getTime() - birth.getTime()) / WEEK_MS));
};

/** Latest milestone date among those hiding prior weeks; null = count from birth. */
export const resolveProgressStartDate = (milestones: Milestone[]): string | null => {
  const hidden = milestones.filter((m) => !m.showTimeBefore);
  if (hidden.length === 0) return null;
  return hidden.map((m) => m.date).sort((a, b) => b.localeCompare(a))[0];
};

export const isWeekBeforeProgressStart = (
  weekIndex: number,
  birthDate: string,
  progressStartDate: string | null
): boolean => {
  if (!progressStartDate) return false;
  const startWeek = weekIndexFromDate(birthDate, progressStartDate);
  if (startWeek === null) return false;
  return weekIndex < startWeek;
};

export const getWeekRecord = (weeks: Record<string, WeekRecord>, index: number): WeekRecord =>
  weeks[String(index)] ?? { plans: [], completedPlanIndices: [], actuals: [] };

export const getCompletionRate = (record: WeekRecord): number | null => {
  if (record.plans.length === 0) return null;
  return record.completedPlanIndices.length / record.plans.length;
};

export const birthDateForWeekIndex = (targetWeek: number, now = new Date()): string => {
  const birth = new Date(now.getTime() - targetWeek * WEEK_MS);
  const y = birth.getFullYear();
  const m = String(birth.getMonth() + 1).padStart(2, '0');
  const d = String(birth.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
