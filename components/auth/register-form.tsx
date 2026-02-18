"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/django-client";
import { useAuth } from "@/lib/auth/auth-context";

export function RegisterForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      // Register with Django backend
      const response = await authApi.register({
        email: formData.email,
        username: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
        first_name: formData.fullName,
        phone: formData.phone,
      });

      // Try to obtain current user info only if auto-login succeeded.
      // `authApi.register` attempts to login and persist the user already,
      // so prefer reading from localStorage to avoid triggering a 401 that
      // would surface as an error to the UI when registration itself succeeded.
      let user = null;
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("clms_user");
          if (stored) user = JSON.parse(stored);
        }
      } catch (e) {
        /* ignore parse errors */
      }

      if (!user) {
        try {
          user = await authApi.getCurrentUser();
          if (user && typeof window !== "undefined")
            localStorage.setItem("clms_user", JSON.stringify(user));
        } catch (e) {
          // Auto-login failed or user not authenticated; registration itself
          // succeeded so continue without treating this as a fatal error.
          console.warn(
            "[v0] Could not fetch user after register (auto-login may have failed):",
            e,
          );
        }
      }

      console.log(
        "[v0] Registration successful:",
        user || "user created (not logged in)",
      );

      try {
        const origin = typeof window !== "undefined" ? window.location.origin : undefined
        await authApi.requestEmailVerification(formData.email, origin)
      } catch (e) {
        console.warn("[v0] Failed to request email verification:", e)
      }

      try {
        await login(formData.email, formData.password);
      } catch (e) {
        console.warn("[v0] Auto-login via context failed after register:", e);
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      let errorMessage = "Registration failed";

      // Handle different error types
      if (err?.error && typeof err.error === "object") {
        // If backend provided a single `detail` message, show it directly
        if (err.error.detail && typeof err.error.detail === "string") {
          errorMessage = String(err.error.detail);
        } else {
          // Extract field errors from backend response
          const fieldErrors = Object.entries(err.error)
            .map(([field, messages]: [string, any]) => {
              if (Array.isArray(messages)) {
                return `${field}: ${messages.join(", ")}`;
              }
              return `${field}: ${messages}`;
            })
            .join("\n");
          errorMessage = fieldErrors || err.message || "Registration failed";
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      // Use warn instead of error to avoid Next.js dev overlay for handled errors
      try {
        const detail =
          err?.message ||
          (typeof err === "object" ? JSON.stringify(err) : String(err));
        console.warn(`[v0] Register error: ${detail}`, err);
      } catch (e) {
        console.warn("[v0] Register error", err);
      }
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="px-4 pt-6 pb-4 md:p-6">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Register for a new CLMS account</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              onBlur={async () => {
                const val = formData.email.trim();
                if (!val) return;
                setEmailChecking(true);
                try {
                  const check = await authApi.checkEmail(val);
                  const parts: string[] = [];
                  if (!check.syntax_valid) parts.push("Invalid email format");
                  if (!check.domain_likely_valid) parts.push("Domain may be invalid");
                  if (check.exists_in_system) parts.push("Email is already registered");
                  setEmailHint(parts.length ? parts.join(" · ") : "Email looks good");
                } catch (e: any) {
                  setEmailHint(null);
                  console.warn("[v0] Email check failed:", e?.message || e);
                } finally {
                  setEmailChecking(false);
                }
              }}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              A verification email will be sent after registration.
            </p>
            {emailChecking ? (
              <p className="text-xs text-muted-foreground">Checking email…</p>
            ) : emailHint ? (
              <p className="text-xs text-muted-foreground">{emailHint}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Account Type</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => updateField("role", value)}
              disabled={isLoading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="professional">
                  Professional (Engineer/Architect)
                </SelectItem>
                <SelectItem value="importer">Importer/Exporter</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={(e) => updateField("password", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary hover:underline font-medium"
          >
            Sign in here
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
