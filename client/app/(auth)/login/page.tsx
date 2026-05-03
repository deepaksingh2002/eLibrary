"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const response = await api.post("/api/auth/login", data);
      const { user, accessToken } = response.data;
      setAuth(user, accessToken);
      router.push("/");
    } catch (error: unknown) {
      setServerError(typeof error === "string" ? error : (error as Error).message || "Login failed");
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-md">
      <div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
          Welcome back
        </h1>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4 rounded-md shadow-sm">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            register={register("email")}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            register={register("password")}
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {serverError && (
          <div className="text-red-500 text-sm mt-2 text-center">
            {serverError}
          </div>
        )}

        <div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Log in
          </Button>
        </div>
      </form>
      
      <div className="text-center mt-4">
        <Link href="/register" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors focus:outline-none focus:underline">
          Don&apos;t have an account? Sign up
        </Link>
      </div>
    </div>
  );
}
