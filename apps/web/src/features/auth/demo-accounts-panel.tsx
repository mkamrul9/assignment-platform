"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

import { setPendingDemoFill } from "./demo-fill";

export type DemoAccountOption = {
  role: "STUDENT" | "MENTOR";
  label: string;
  name: string;
  email: string;
  password: string;
};

type DemoAccountsResponse = {
  notice: string;
  accounts: DemoAccountOption[];
};

type DemoAccountsPanelProps = {
  mode: "login" | "signup";
  onSelectAccount?: (account: DemoAccountOption) => void;
};

export function DemoAccountsPanel({ mode, onSelectAccount }: DemoAccountsPanelProps) {
  const router = useRouter();
  const headingId = useId();
  const [accounts, setAccounts] = useState<DemoAccountOption[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<DemoAccountsResponse>("/api/demo/accounts", {
          method: "GET",
          cache: "no-store",
        });
        if (cancelled) return;
        setAccounts(data.accounts);
        setNotice(data.notice);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setAccounts(null);
          setNotice(null);
          setLoadError(null);
          return;
        }
        setLoadError(null);
        setAccounts(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!accounts || accounts.length === 0) {
    return null;
  }

  function choose(account: DemoAccountOption) {
    if (mode === "signup") {
      setPendingDemoFill({ email: account.email, password: account.password });
      router.push("/login");
      return;
    }
    onSelectAccount?.(account);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-border bg-muted/40 px-4 py-4"
    >
      <h2 id={headingId} className="text-sm font-semibold tracking-tight text-foreground">
        Try a shared demo account
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {notice ?? "These are shared synthetic accounts. Other visitors see the same sandbox data."}
      </p>
      {loadError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {accounts.map((account) => (
          <li
            key={account.email}
            className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {account.label}
                <span className="ml-2 text-xs font-normal tracking-wide text-muted-foreground uppercase">
                  {account.role === "MENTOR" ? "Mentor" : "Student"}
                </span>
              </p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                {account.email}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{account.password}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => choose(account)}
            >
              {mode === "signup" ? "Use on sign-in" : `Use ${account.label}`}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
