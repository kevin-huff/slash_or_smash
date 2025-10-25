import { getRunState, setRunState } from './runStateStore.js';

export interface AppSettings {
  defaultTimerSeconds: number;
  graceWindowSeconds: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultTimerSeconds: 120,
  graceWindowSeconds: 3,
};

export function getSettings(): AppSettings {
  const stored = getRunState('settings');
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  
  try {
    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    return {
      defaultTimerSeconds: parsed.defaultTimerSeconds ?? DEFAULT_SETTINGS.defaultTimerSeconds,
      graceWindowSeconds: parsed.graceWindowSeconds ?? DEFAULT_SETTINGS.graceWindowSeconds,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated: AppSettings = {
    defaultTimerSeconds: updates.defaultTimerSeconds ?? current.defaultTimerSeconds,
    graceWindowSeconds: updates.graceWindowSeconds ?? current.graceWindowSeconds,
  };
  
  setRunState('settings', JSON.stringify(updated));
  return updated;
}
