export type SettingsObject = Record<string, unknown>;

export function sameSetting(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameSetting(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as SettingsObject, right = b as SettingsObject;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(k => sameSetting(left[k], right[k]));
  }
  return false;
}

export function changedSettings(current: SettingsObject, baseline: SettingsObject) {
  const changes: SettingsObject = {}, expected: SettingsObject = {};
  for (const key of Object.keys(current)) {
    if (sameSetting(current[key], baseline[key])) continue;
    if (key === "sender") {
      const nested = changedSettings(current[key] as SettingsObject, baseline[key] as SettingsObject);
      changes[key] = nested.changes;
      expected[key] = nested.expected;
    } else {
      changes[key] = current[key];
      expected[key] = baseline[key];
    }
  }
  return { changes, expected };
}

export function mergeSettings(current: SettingsObject, changes: SettingsObject): SettingsObject {
  return { ...current, ...changes, ...(changes.sender ? { sender: { ...current.sender as SettingsObject, ...changes.sender as SettingsObject } } : {}) };
}

export function settingConflicts(current: SettingsObject, changes: SettingsObject, expected: SettingsObject): string[] {
  return Object.keys(changes).flatMap(key => {
    if (key === "sender") return settingConflicts(current.sender as SettingsObject, changes.sender as SettingsObject, expected.sender as SettingsObject).map(k => "sender." + k);
    return sameSetting(current[key], changes[key]) || sameSetting(current[key], expected[key]) ? [] : [key];
  });
}
