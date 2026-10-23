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
let sessionPromise: Promise<void> | null = null;
const sessionListeners = new Set<() => void>();

function emitSession() {
  for (const listener of sessionListeners) {
    listener();
  }
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function getSessionSnapshot() {
  return sessionSnapshot;
}

function getServerSessionSnapshot(): SessionSnapshot {
  return { status: "loading", user: null };
}

function writeSession(next: SessionSnapshot) {
  sessionSnapshot = next;
  emitSession();
}

async function loadSession(): Promise<void> {
  try {
    const data = await apiFetch<{ user: AuthUser }>("/api/auth/me", {
      method: "GET",
      cache: "no-store",
    });
    writeSession({ status: "authenticated", user: data.user });
  } catch (error) {
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
    () => {
      void ensureSessionLoaded();
      return getSessionSnapshot();
    },
    getServerSessionSnapshot,
  );

  const refresh = useCallback(async () => {
    sessionPromise = loadSession();
    await sessionPromise;
  }, []);

  const setUser = useCallback((next: AuthUser | null) => {
    writeSession({
      status: next ? "authenticated" : "anonymous",
      user: next,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } catch {
      // Still clear local session state if the cookie is already gone.
    }
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
