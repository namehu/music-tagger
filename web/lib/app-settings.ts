const GIB = 1024 ** 3;

export const DEFAULT_TRANSCODE_POLICY = {
  coldCacheDays: 30,
  budgetBytes: 5 * GIB,
  pruneLimit: 200,
} as const;

type JsonObject = Record<string, unknown>;

export type TranscodePolicySettings = {
  coldCacheDays: number;
  budgetBytes: number;
  pruneLimit: number;
};

export type AppSettings = {
  transcodePolicy: TranscodePolicySettings;
};

function safeJsonParse(value: string | null | undefined): unknown {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getAppSettings(dataJson: string | null | undefined): AppSettings {
  const parsed = safeJsonParse(dataJson);
  const root = parsed && typeof parsed === "object" ? (parsed as JsonObject) : null;
  const policy =
    root?.transcodePolicy && typeof root.transcodePolicy === "object"
      ? (root.transcodePolicy as JsonObject)
      : null;

  return {
    transcodePolicy: {
      coldCacheDays: parsePositiveInteger(policy?.coldCacheDays, DEFAULT_TRANSCODE_POLICY.coldCacheDays),
      budgetBytes: parsePositiveInteger(policy?.budgetBytes, DEFAULT_TRANSCODE_POLICY.budgetBytes),
      pruneLimit: parsePositiveInteger(policy?.pruneLimit, DEFAULT_TRANSCODE_POLICY.pruneLimit),
    },
  };
}

export function mergeAppSettingsDataJson(
  dataJson: string | null | undefined,
  next: Partial<AppSettings>,
) {
  const parsed = safeJsonParse(dataJson);
  const root = parsed && typeof parsed === "object" ? ({ ...(parsed as JsonObject) } satisfies JsonObject) : {};
  const current = getAppSettings(dataJson);

  root.transcodePolicy = {
    ...current.transcodePolicy,
    ...(next.transcodePolicy ?? {}),
  };

  return JSON.stringify(root);
}
