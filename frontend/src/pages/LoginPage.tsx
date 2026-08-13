import { useMemo, useState } from "react";
import { AlertCircle, Loader2, Lock, Mail } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getGoogleLoginUrl } from "../services/api";
import { loginWithPassword } from "../services/auth.service";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginUrl = useMemo(() => getGoogleLoginUrl(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleError = searchParams.get("error");

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email ID is required.");
      return;
    }

    if (!emailPattern.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not complete login. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClasses =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 pl-10 text-sm text-white placeholder-slate-400 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-cyan-300">ReachInbox</p>
          <h1 className="text-3xl font-semibold tracking-normal">Login</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Sign in to schedule and track email jobs from your dashboard.
          </p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        {googleError ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Google login failed. Check your OAuth configuration and try again.</p>
          </div>
        ) : null}

        <a
          href={loginUrl}
          className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-bold">
            G
          </span>
          Continue with Google
        </a>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-700" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            or login with email
          </span>
          <span className="h-px flex-1 bg-slate-700" aria-hidden="true" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
              Email ID
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClasses}
                maxLength={254}
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={inputClasses}
                maxLength={128}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-600"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Please wait..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
