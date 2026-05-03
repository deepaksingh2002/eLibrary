"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../../../lib/api";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { toast } from "../../../components/ui/Toast";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post("/api/auth/forgot-password", { email: data.email });
      setSentEmail(data.email);
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-md text-center">
        <div className="text-5xl">📬</div>
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          If <span className="font-medium text-gray-700">{sentEmail}</span> is registered, a reset
          link has been sent.
          <br />
          The link expires in <span className="font-medium">30 minutes</span>.
        </p>
        <p className="text-gray-400 text-sm">
          Didn&apos;t receive it? Check spam or{" "}
          <button
            onClick={() => setSent(false)}
            className="text-blue-600 hover:underline font-medium"
          >
            try again
          </button>
          .
        </p>
        <Link href="/login" className="block text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-md">
      <div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
          Forgot your password?
        </h1>
        <p className="text-center text-sm text-gray-500 mt-2">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          register={register("email")}
        />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Send reset link
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
