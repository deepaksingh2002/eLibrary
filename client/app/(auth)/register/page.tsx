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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      // Exclude confirmPassword
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...submitData } = data;
      const response = await api.post("/api/auth/register", submitData);
      const { user, accessToken } = response.data;
      setAuth(user, accessToken);
      router.push("/");
    } catch (error: unknown) {
      setServerError(typeof error === "string" ? error : (error as Error).message || "Registration failed");
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-md">
      <div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
          Create your account
        </h1>
      </div>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4 rounded-md shadow-sm">
          <Input
            label="Full Name"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            error={errors.name?.message}
            register={register("name")}
          />
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
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.password?.message}
            register={register("password")}
          />
          <Input
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            register={register("confirmPassword")}
          />
        </div>

        {serverError && (
          <div className="text-red-500 text-sm mt-2 text-center">
            {serverError}
          </div>
        )}

        <div>
          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Sign up
          </Button>
        </div>
      </form>
      
      <div className="text-center mt-4">
        <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors focus:outline-none focus:underline">
          Already have an account? Log in
        </Link>
      </div>
    </div>
  );
}
