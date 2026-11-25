import "server-only";
import { transaction } from "@/lib/newsletterDb";
import type { PoolClient } from "pg";
import { mergeSettings, sameSetting, settingConflicts, type SettingsObject } from "@/lib/settingsSync";

export class SettingsConflict extends Error {}
export async function persistSettingsPatch(input: {
  changes: SettingsObject;
  expected: SettingsObject;
  read: (client: PoolClient) => Promise<SettingsObject>;
  validate: (settings: SettingsObject) => SettingsObject;
  write: (client: PoolClient, settings: SettingsObject) => Promise<void>;
}) {
  return transaction(async client => {
    // Serialize even the first INSERT, when there is no settings row to lock.
    await client.query("SELECT pg_advisory_xact_lock(726504)");
    const current = await input.read(client);
    if (settingConflicts(current, input.changes, input.expected).length)
      throw new SettingsConflict("Des champs ont été modifiés depuis un autre appareil. Vos modifications sont conservées ; rechargez les valeurs serveur avant de réessayer.");
    const merged = input.validate(mergeSettings(current, input.changes));
    await input.write(client, merged);
    const persisted = await input.read(client);
    if (!sameSetting(merged, persisted)) throw new Error("SETTINGS_WRITE_NOT_CONFIRMED");
    return persisted;
  });
}
