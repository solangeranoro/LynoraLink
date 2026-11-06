export type LynoAICodingProgressStage =
  | "analyzing"
  | "reading"
  | "analyzing_context"
  | "editing"
  | "preparing_changes"
  | "completed"
  | "failed"
  | "cancelled";

export type LynoAICodingProgress = {
  stage: LynoAICodingProgressStage;
  updatedAt: number;
};

type ProgressEntry = LynoAICodingProgress & { userId: string };
type ProgressRegistry = Map<string, ProgressEntry>;

const registryGlobal = globalThis as typeof globalThis & {
  __lynoraLynoAICodingProgress?: ProgressRegistry;
};
const registry = registryGlobal.__lynoraLynoAICodingProgress ??= new Map();
const PROGRESS_TTL_MS = 5 * 60 * 1_000;

function cleanExpiredEntries(now: number) {
  for (const [id, progress] of registry) {
    if (now - progress.updatedAt > PROGRESS_TTL_MS) registry.delete(id);
  }
}

export function setLynoAICodingProgress(
  requestId: string,
  userId: string,
  stage: LynoAICodingProgressStage,
) {
  const now = Date.now();
  cleanExpiredEntries(now);
  registry.set(requestId, { userId, stage, updatedAt: now });
}

export function getLynoAICodingProgress(requestId: string, userId: string) {
  const progress = registry.get(requestId);
  if (!progress || progress.userId !== userId) return null;
  return { stage: progress.stage, updatedAt: progress.updatedAt };
}
