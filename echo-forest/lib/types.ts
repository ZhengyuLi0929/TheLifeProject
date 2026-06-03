export type Language = 'zh' | 'en';
export type AuthMode = 'login' | 'register';
export type TabKey = 'forest' | 'plan';
export type ForestZoom = 'life' | 'year';
export type DefaultView = 'life' | 'year';

export interface Account {
  name: string;
  email: string;
  password: string;
  birthDate: string;
}

export interface WeekRecord {
  plans: string[];
  completedPlanIndices: number[];
  actuals: string[];
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  /** true = 显示此里程碑之前的时间（从出生计算）；false = 从该里程碑起算 */
  showTimeBefore: boolean;
}

export interface AppSettings {
  language: Language;
  defaultView: DefaultView;
  reminders: boolean;
  milestones: Milestone[];
}

export interface PersistedState {
  account: Account | null;
  weeks: Record<string, WeekRecord>;
  settings: AppSettings;
}
