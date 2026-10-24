"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { ApiError, apiFetch } from "@/lib/api";
import { invalidateProjectListCache } from "@/features/submissions/project-list";
import { resetDraftControllerForAccountChange } from "@/features/submissions/submission-draft";

import { resetMentorQueueCache } from "@/features/reviews/mentor-queue-store";

import type { AuthUser } from "./types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
};

type SessionSnapshot = {
  status: AuthStatus;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let sessionSnapshot: SessionSnapshot = { status: "loading", user: null };
const SERVER_SNAPSHOT = sessionSnapshot;
let sessionRequestSequence = 0;
let sessionPromise: Promise<void> | null = null;
const sessionListeners = new Set<() => void>();

function handleSessionExpired() {
  sessionRequestSequence += 1;
  writeSession({ status: "anonymous", user: null });
  invalidateProjectListCache();
  resetMentorQueueCache();
  resetDraftControllerForAccountChange();
}

function emitSession() {
  for (const listener of sessionListeners) {
    listener();
  }
}

function subscribeSession(listener: () => void) {
  if (sessionListeners.size === 0) {
    window.addEventListener("reviewdock:session-expired", handleSessionExpired);
  }
  sessionListeners.add(listener);
  void ensureSessionLoaded();
  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) {
      window.removeEventListener("reviewdock:session-expired", handleSessionExpired);
    }
  };
}

function getSessionSnapshot() {
  return sessionSnapshot;
}

function getServerSessionSnapshot(): SessionSnapshot {
  return SERVER_SNAPSHOT;
}

function writeSession(next: SessionSnapshot) {
  sessionSnapshot = next;
  emitSession();
}

async function loadSession(): Promise<void> {
  const sequence = ++sessionRequestSequence;
  try {
    const data = await apiFetch<{ user: AuthUser }>("/api/auth/me", {
      method: "GET",
      cache: "no-store",
    });
    if (sequence !== sessionRequestSequence) return;
    writeSession({ status: "authenticated", user: data.user });
  } catch (error) {
    if (sequence !== sessionRequestSequence) return;
    writeSession({ status: "anonymous", user: null });
    if (!(error instanceof ApiError && error.status === 401)) {
      console.error(error);
    }
  }
}

function ensureSessionLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!sessionPromise) {
    sessionPromise = loadSession();
  }
  return sessionPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );

  const refresh = useCallback(async () => {
    sessionPromise = loadSession();
    await sessionPromise;
  }, []);

  const setUser = useCallback((next: AuthUser | null) => {
    sessionRequestSequence += 1;
    invalidateProjectListCache();
    resetMentorQueueCache();
    resetDraftControllerForAccountChange();
    writeSession({
      status: next ? "authenticated" : "anonymous",
      user: next,
    });
  }, []);

  const logout = useCallback(async () => {
    // Only claim logout after Express has cleared the HttpOnly browser cookie.
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
    sessionRequestSequence += 1;
    invalidateProjectListCache();
    resetMentorQueueCache();
    resetDraftControllerForAccountChange();
    writeSession({ status: "anonymous", user: null });
  }, []);

  const value = useMemo(
    () => ({
      status: snapshot.status,
      user: snapshot.user,
      refresh,
      setUser,
      logout,
    }),
    [snapshot.status, snapshot.user, refresh, setUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
