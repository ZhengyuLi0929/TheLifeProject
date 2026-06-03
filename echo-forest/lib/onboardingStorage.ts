import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Account, AppSettings, PersistedState } from './types';
import { getDeviceLanguage } from './i18n';

export const ONBOARDING_KEY = 'echo_forest_onboarding_v1';
export const STORAGE_KEY = 'echo_forest_v5';

const defaultSettings = (): AppSettings => ({
  language: getDeviceLanguage(),
  defaultView: 'life',
  reminders: true,
  milestones: [],
});

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u4e00-\u9fff]/gi, '') || 'user';

/** 仅当用户完成或跳过引导后为 false；不因本地已有 demo 账号而跳过。 */
export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
    return onboardingDone !== '1';
  } catch {
    return true;
  }
}

export async function resetOnboardingForDev(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}

export async function markOnboardingSkipped(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function completeOnboardingRegistration(opts: {
  name: string;
  password: string;
  birthDate: string;
}): Promise<void> {
  const slug = slugify(opts.name);
  const account: Account = {
    name: opts.name.trim(),
    email: `${slug}@echo.local`,
    password: opts.password,
    birthDate: opts.birthDate,
  };
  const state: PersistedState = {
    account,
    weeks: {},
    settings: defaultSettings(),
  };
  const payload = JSON.stringify(state);
  await AsyncStorage.multiSet([
    [STORAGE_KEY, payload],
    [ONBOARDING_KEY, '1'],
  ]);
}
