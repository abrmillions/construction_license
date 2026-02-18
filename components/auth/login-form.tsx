"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"

export function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Trim email to avoid accidental leading/trailing whitespace
      await login(email.trim(), password)

      console.log("[v0] Login successful")
      
      // Redirect to dashboard
      router.push("/dashboard")
    } catch (err: any) {
      let errorMessage = "Login failed"

      // Show a friendly, non-revealing message for authentication failures
      const detail = err?.error?.detail || err?.message || ""
      if (err?.status === 401 || /no active account found|credentials/i.test(detail)) {
        errorMessage = "Invalid email or password. Try again."
      } else if (detail) {
        errorMessage = detail
      }

      setError(errorMessage)
      // Log a concise message (avoid printing full Error object/stacks in console)
      try {
        console.debug(`[v0] Login error: ${err?.message || JSON.stringify(err)}`)
      } catch {
        // fallback to safe log
        console.debug('[v0] Login error')
      }
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="px-4 pt-6 pb-4 md:p-6">
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-muted-foreground text-center">
          {"Don't have an account? "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Register here
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
