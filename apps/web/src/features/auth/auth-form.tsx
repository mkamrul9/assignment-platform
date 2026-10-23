"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { safeReturnPath, workspacePathForRole } from "@/lib/safe-return-path";

import { useAuth } from "./auth-context";
import type { AuthUser } from "./types";

type Mode = "login" | "signup";

type FieldErrors = Partial<Record<"name" | "email" | "password" | "form", string>>;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => safeReturnPath(searchParams.get("next")), [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const path = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const body =
        mode === "signup"
          ? JSON.stringify({ name, email, password })
          : JSON.stringify({ email, password });

      const data = await apiFetch<{ user: AuthUser }>(path, {
        method: "POST",
        body,
      });

      setUser(data.user);

      const destination =
        nextPath &&
        ((data.user.role === "MENTOR" && nextPath.startsWith("/mentor")) ||
          (data.user.role === "STUDENT" && nextPath.startsWith("/student")))
          ? nextPath
          : workspacePathForRole(data.user.role);

      router.replace(destination);
    } catch (error) {
      if (error instanceof ApiError) {
        const nextErrors: FieldErrors = {};
        for (const detail of error.details ?? []) {
          const key = detail.path as keyof FieldErrors;
          if (key === "name" || key === "email" || key === "password") {
            nextErrors[key] = detail.message ?? error.message;
          }
        }
        nextErrors.form = error.message;
        setErrors(nextErrors);
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {mode === "signup" ? (
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            disabled={submitting}
            required
          />
          {errors.name ? (
            <p id="name-error" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          disabled={submitting}
          required
        />
        {errors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
          disabled={submitting}
          required
        />
        {mode === "signup" ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters, and at most 72 bytes (bcrypt limit). Passwords are not trimmed.
          </p>
        ) : null}
        {errors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p
          className="rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? "Working…" : mode === "signup" ? "Create student account" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create a student account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
