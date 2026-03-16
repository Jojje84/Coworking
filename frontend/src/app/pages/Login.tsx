// ─────────────────────────────────────────
// Login
// ─────────────────────────────────────────

import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  DoorOpen,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setIsLoading(true);

    const success = await login(email, password);

    if (success) {
      setNotice({
        type: "success",
        message: "Signed in successfully. Redirecting...",
      });
      navigate("/");
    } else {
      setNotice({
        type: "error",
        message: "Invalid email or password.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-sm">
            <DoorOpen className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            CoWork Space
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to manage your bookings and rooms
          </p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your details to continue
            </p>
          </div>

          {notice && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                notice.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {notice.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{notice.message}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                "Signing in..."
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-900">
              Demo logins
            </p>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <span className="font-semibold">Admin:</span> admin@cowork.se /
                Password123!
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <span className="font-semibold">User:</span> user@cowork.se /
                Password123!
              </div>
              <div className="rounded-xl bg-white/70 px-3 py-2">
                <span className="font-semibold">User:</span> maria@cowork.se /
                Password123!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
