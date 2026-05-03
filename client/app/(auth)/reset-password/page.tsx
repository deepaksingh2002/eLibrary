"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../../../lib/api";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

const getStrength = (pw: string): 0 | 1 | 2 | 3 => {
  if (pw.length < 8) return 0;
  if (pw.length < 12) return 1;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  return (hasUpper && hasNumber) || hasSymbol ? 3 : 2;
};

const strengthLabel = ["Too short", "Fair", "Good", "Strong"] as const;
const strengthColors = [
  ["bg-gray-200", "bg-gray-200", "bg-gray-200"],
  ["bg-red-500", "bg-gray-200", "bg-gray-200"],
  ["bg-yellow-400", "bg-yellow-400", "bg-gray-200"],
  ["bg-green-500", "bg-green-500", "bg-green-500"],
];
const strengthTextColors = ["text-gray-400", "text-red-500", "text-yellow-500", "text-green-600"];

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "success" | "expired">("idle");
  const [countdown, setCountdown] = useState(3);
  const [watchedPw, setWatchedPw] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const pw = watch("newPassword", "");
  useEffect(() => setWatchedPw(pw || ""), [pw]);

  // Countdown redirect after success
  useEffect(() => {
    if (status !== "success") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push("/login");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, router]);

  const strength = getStrength(watchedPw);

  if (!token) {
    return (
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <h1 className="text-xl font-bold text-gray-900">Invalid reset link</h1>
        <p className="text-gray-500 text-sm">
          This link is missing a token. Please request a new one.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Request new link</Button>
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Password reset!</h1>
        <p className="text-gray-500 text-sm">Your password has been changed successfully.</p>
        <p className="text-gray-400 text-sm">You have been logged out of all devices.</p>
        <p className="text-blue-600 text-sm font-medium">
          Redirecting to login in {countdown}s…
        </p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center space-y-4">
        <div className="text-4xl">⏰</div>
        <h1 className="text-xl font-bold text-gray-900">Reset link expired or invalid</h1>
        <p className="text-gray-500 text-sm">Please request a new password reset link.</p>
        <Link href="/forgot-password">
          <Button className="w-full">Request new link</Button>
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post("/api/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      if (typeof msg === "string" && (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired"))) {
        setStatus("expired");
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-md">
      <div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
          Reset your password
        </h1>
        <p className="text-center text-sm text-gray-500 mt-2">
          Choose a new password for your account
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.newPassword?.message}
            register={register("newPassword")}
          />

          {watchedPw.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded transition-colors duration-300 ${strengthColors[strength][i]}`}
                  />
                ))}
              </div>
              <p className={`text-xs mt-1 ${strengthTextColors[strength]}`}>
                {strengthLabel[strength]}
              </p>
            </div>
          )}
        </div>

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          register={register("confirmPassword")}
        />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Reset password
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-md text-center text-gray-400">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
