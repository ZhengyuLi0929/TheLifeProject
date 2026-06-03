import type { Language } from './types';

export const tMap = {
  zh: {
    forestName: '回响之森',
    lifeTitle: '4000周',
    lifeSubtitle: '每一枚方格，皆是生命中的一周。',
    annualSubtitle: '岁序轮转，静听光阴回响',
    login: '登录',
    register: '创建',
    name: '昵称',
    email: '邮箱',
    password: '密码',
    birthPlaceholder: 'YYYY-MM-DD',
    enter: '进入森林',
    week: '第',
    weekSuffix: '周',
    intentions: '计划',
    achievements: '实际行动',
    completionRate: '计划完成度',
    inPlanRate: '实际在计划内',
    defaultView: '默认视图',
    language: '语言',
    reminders: '开启提醒',
    life: '人生',
    annual: '本年度',
    settings: '设置',
    milestones: '记录里程碑',
    milestoneTitle: '里程碑名称',
    milestoneDate: '日期 YYYY-MM-DD',
    addMilestone: '添加里程碑',
    showTimeBeforeMilestone: '显示此里程碑之前的时间',
    noPlansForWeek: '本周暂无计划',
    noMilestones: '暂无里程碑，可在下方添加',
    thisWeekTag: ' · 本周',
    planLocked: '仅本周或上周可编辑计划',
    actualLocked: '仅周结束后可填写实际行动',
    add: '添加',
    close: '关闭',
    invalidDate: '请输入有效日期（YYYY-MM-DD）',
    loginFailed: '账号或密码错误',
    noAccount: '暂无账号，请先创建',
    logout: '退出登录',
    replayOnboarding: '重新观看入门引导',
    replayOnboardingHint: '已重置。请按 R 键 Reload，或摇一摇设备选择 Reload。',
    planTab: '计划',
    forestTab: '森林',
  },
  en: {
    forestName: 'Forest of Time',
    lifeTitle: '4000 Weeks',
    lifeSubtitle: 'Each square is one week of life.',
    annualSubtitle: 'Seasons rotate, echoes remain',
    login: 'Login',
    register: 'Register',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    birthPlaceholder: 'YYYY-MM-DD',
    enter: 'Enter Forest',
    week: 'Week ',
    weekSuffix: '',
    intentions: 'Plans',
    achievements: 'Actuals',
    completionRate: 'Plan Completion',
    inPlanRate: 'In-Plan Ratio',
    defaultView: 'Default View',
    language: 'Language',
    reminders: 'Reminders',
    life: 'Life',
    annual: 'This Year',
    settings: 'Settings',
    milestones: 'Milestones',
    milestoneTitle: 'Title',
    milestoneDate: 'Date YYYY-MM-DD',
    addMilestone: 'Add Milestone',
    showTimeBeforeMilestone: 'Show time before this milestone',
    noPlansForWeek: 'No plans this week',
    noMilestones: 'No milestones yet',
    thisWeekTag: ' · This week',
    planLocked: 'Plans editable in current/previous week only',
    actualLocked: 'Actuals unlock after week ends',
    add: 'Add',
    close: 'Close',
    invalidDate: 'Please enter a valid date (YYYY-MM-DD)',
    loginFailed: 'Wrong email or password',
    noAccount: 'No account found, register first',
    logout: 'Log out',
    replayOnboarding: 'Replay intro tutorial',
    replayOnboardingHint: 'Reset done. Press R to Reload, or shake device and choose Reload.',
    planTab: 'Plan',
    forestTab: 'Forest',
  },
} as const;

export type Tr = (typeof tMap)[Language];

export function getDeviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

export function tr(language: Language): Tr {
  return tMap[language];
}
