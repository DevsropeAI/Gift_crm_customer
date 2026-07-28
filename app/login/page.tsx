"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock, Mail, Sparkles } from "lucide-react";
import { getRoleFromToken, login, setToken } from "@/lib/api";

const FEATURES = [
  "Real-time lead tracking across your sales team",
  "Role-based access for Sales, Production, and Admin",
  "Built for speed — no clutter, just what matters",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await login(email, password);
      setToken(token);
      const role = getRoleFromToken(token);
      if (role === "Customer") {
        router.push("/portal");
      } else if (role === "Production") {
        router.push("/production");
      } else {
        router.push("/leads");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Branded panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-900 to-violet-950 px-8 py-10 text-white sm:px-12 lg:w-1/2 lg:px-16 lg:py-14">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight">SignatureGifts</span>
        </div>

        <div className="relative z-10 my-10 lg:my-0">
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Manage every lead, from first touch to closed deal.
          </h1>
          <ul className="mt-8 hidden space-y-4 sm:block">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-indigo-100">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-indigo-200">
          &copy; {new Date().getFullYear()} SignatureGifts. All rights reserved.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-950 px-6 py-12 sm:px-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-400">Sign in to your account to continue</p>
          </div>

          {error && (
            <div
              className="animate-fade-in-up mt-6 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-300"
              style={{ animationDelay: "60ms" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-transparent bg-white/5 py-3 pl-10 pr-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-transparent bg-white/5 py-3 pl-10 pr-3 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="animate-fade-in-up group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ animationDelay: "220ms" }}
            >
              <span className="flex items-center gap-2 transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-[0.98]">
                {loading ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
