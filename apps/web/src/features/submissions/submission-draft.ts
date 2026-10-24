/**
 * Versioned, student-scoped submission drafts in browser storage.
 * Never stores session tokens or passwords. Server validation remains authoritative.
 *
 * Retention: drafts stay on this device until the student discards them, submits
 * successfully, clears site data, or signs in as a different account (in-memory
 * form state and pending writes are cleared on account change). Shared devices
 * may retain another student's draft in storage until that key is overwritten
 * or discarded — drafts are keyed by student id and never displayed for another account.
 */

export const DRAFT_STORAGE_VERSION = 1 as const;
export const DRAFT_DEBOUNCE_MS = 600;

export type SubmissionDraftFields = {
  projectName: string;
  repositoryUrl: string;
  liveUrl: string;
  description: string;
};

type StoredDraft = {
  version: typeof DRAFT_STORAGE_VERSION;
  studentId: string;
  savedAt: string;
  fields: SubmissionDraftFields;
};

function storageKey(studentId: string): string {
  return `reviewdock:submission-draft:v${DRAFT_STORAGE_VERSION}:${studentId}`;
}

function emptyFields(): SubmissionDraftFields {
  return {
    projectName: "",
    repositoryUrl: "",
    liveUrl: "",
    description: "",
  };
}

function isNonEmpty(fields: SubmissionDraftFields): boolean {
  return Boolean(
    fields.projectName.trim() ||
    fields.repositoryUrl.trim() ||
    fields.liveUrl.trim() ||
    fields.description.trim(),
  );
}

function readRaw(studentId: string): StoredDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(studentId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (
      parsed.version !== DRAFT_STORAGE_VERSION ||
      parsed.studentId !== studentId ||
      typeof parsed.savedAt !== "string" ||
      !parsed.fields ||
      typeof parsed.fields !== "object"
    ) {
      return null;
    }
    const fields: SubmissionDraftFields = {
      projectName: String(parsed.fields.projectName ?? ""),
      repositoryUrl: String(parsed.fields.repositoryUrl ?? ""),
      liveUrl: String(parsed.fields.liveUrl ?? ""),
      description: String(parsed.fields.description ?? ""),
    };
    return { version: DRAFT_STORAGE_VERSION, studentId, savedAt: parsed.savedAt, fields };
  } catch {
    return null;
  }
}

export function loadSubmissionDraft(studentId: string): {
  fields: SubmissionDraftFields;
  savedAt: string | null;
} {
  const stored = readRaw(studentId);
  if (!stored) {
    return { fields: emptyFields(), savedAt: null };
  }
  return { fields: stored.fields, savedAt: stored.savedAt };
}

export function saveSubmissionDraft(
  studentId: string,
  fields: SubmissionDraftFields,
): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!isNonEmpty(fields)) {
    clearSubmissionDraft(studentId);
    return null;
  }
  const savedAt = new Date().toISOString();
  const payload: StoredDraft = {
    version: DRAFT_STORAGE_VERSION,
    studentId,
    savedAt,
    fields: {
      projectName: fields.projectName,
      repositoryUrl: fields.repositoryUrl,
      liveUrl: fields.liveUrl,
      description: fields.description,
    },
  };
  try {
    window.localStorage.setItem(storageKey(studentId), JSON.stringify(payload));
    return savedAt;
  } catch {
    // QuotaExceeded or unavailable storage must not break the form.
    return null;
  }
}

export function clearSubmissionDraft(studentId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(studentId));
  } catch {
    // ignore
  }
}

type DraftController = {
  studentId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
};

const controller: DraftController = {
  studentId: null,
  timer: null,
  generation: 0,
};

/** Cancel pending debounced writes so a clear cannot be overwritten by a stale timer. */
export function cancelPendingDraftWrite(): void {
  if (controller.timer) {
    clearTimeout(controller.timer);
    controller.timer = null;
  }
  controller.generation += 1;
}

export function scheduleDraftSave(
  studentId: string,
  fields: SubmissionDraftFields,
  onSaved: (savedAt: string | null) => void,
): void {
  cancelPendingDraftWrite();
  controller.studentId = studentId;
  const generation = controller.generation;
  controller.timer = setTimeout(() => {
    if (generation !== controller.generation || controller.studentId !== studentId) {
      return;
    }
    const savedAt = saveSubmissionDraft(studentId, fields);
    onSaved(savedAt);
    controller.timer = null;
  }, DRAFT_DEBOUNCE_MS);
}

/** Clear in-memory draft control when the signed-in account changes or logs out. */
export function resetDraftControllerForAccountChange(): void {
  cancelPendingDraftWrite();
  controller.studentId = null;
}
