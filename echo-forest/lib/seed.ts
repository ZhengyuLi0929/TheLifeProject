import type { Account, AppSettings, PersistedState, WeekRecord } from './types';
import { birthDateForWeekIndex, getWeekIndexFromBirth, LIFE_WEEKS } from './weekMath';

export const DEMO_EMAIL = 'demo@echo.test';
export const DEMO_PASSWORD = 'demo1234';

export const buildDemoWeeks = (currentWeek: number): Record<string, WeekRecord> => {
  const weeks: Record<string, WeekRecord> = {};
  const samples: { plans: string[]; done: number }[] = [
    { plans: ['晨跑三次', '读完一章', '整理房间'], done: 3 },
    { plans: ['写周报', '联系朋友', '冥想'], done: 2 },
    { plans: ['学习 TypeScript', '做饭两次'], done: 2 },
    { plans: ['徒步', '记账', '早睡'], done: 1 },
    { plans: ['准备演讲', '复盘项目'], done: 2 },
    { plans: ['瑜伽', '阅读', '写日记', '散步'], done: 4 },
    { plans: ['整理照片', '打电话给家人'], done: 1 },
    { plans: ['完成原型', '测试应用'], done: 2 },
    { plans: ['买菜', '洗衣服', '拉伸'], done: 3 },
    { plans: ['周计划复盘', '更新目标', '户外散步'], done: 2 },
  ];

  for (let i = 0; i < 10; i++) {
    const w = currentWeek - (9 - i);
    if (w < 0 || w >= LIFE_WEEKS) continue;
    const s = samples[i];
    weeks[String(w)] = {
      plans: s.plans,
      completedPlanIndices: Array.from({ length: s.done }, (_, j) => j),
      actuals: s.plans.slice(0, Math.max(1, s.done - 1)),
    };
  }
  return weeks;
};

const demoMilestones = () => [
  { id: 'ms1', title: '大学毕业', date: '2018-06-20', showTimeBefore: true },
  { id: 'ms2', title: '第一份工作', date: '2019-03-01', showTimeBefore: true },
];

export function buildDemoState(now = new Date()): PersistedState {
  const birthDate = birthDateForWeekIndex(520, now);
  const currentWeek = getWeekIndexFromBirth(birthDate, now);

  const account: Account = {
    name: '林溪',
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    birthDate,
  };

  const settings: AppSettings = {
    language: 'zh',
    defaultView: 'life',
    reminders: true,
    milestones: demoMilestones(),
  };

  return {
    account,
    weeks: buildDemoWeeks(currentWeek),
    settings,
  };
}

export function mergeDemoAccount(parsed: PersistedState | null): PersistedState {
  const demo = buildDemoState();
  if (!parsed?.account) return demo;
  if (parsed.account.email !== DEMO_EMAIL) return parsed;

  const birthDate = demo.account!.birthDate;
  const currentWeek = getWeekIndexFromBirth(birthDate);

  return {
    account: { ...demo.account!, name: parsed.account.name || demo.account!.name },
    weeks: buildDemoWeeks(currentWeek),
    settings: {
      language: parsed.settings?.language ?? demo.settings.language,
      defaultView: parsed.settings?.defaultView ?? demo.settings.defaultView,
      reminders: parsed.settings?.reminders ?? demo.settings.reminders,
      milestones:
        parsed.settings?.milestones && parsed.settings.milestones.length > 0
          ? parsed.settings.milestones.map((m) => ({ ...m, showTimeBefore: m.showTimeBefore ?? true }))
          : demoMilestones(),
    },
  };
}
