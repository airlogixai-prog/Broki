"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeSlash, Lock, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

function safeRedirectPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/broki";
  if (path === "/login") return "/broki";
  return path;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg shadow-brand-500/25 mb-4 overflow-hidden">
            <Image
              src="/assets/icon.jpg"
              alt="BROKI"
              width={56}
              height={56}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-fg">
            BROKI Dashboard
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Inicia sesión para acceder al panel de operaciones
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-muted p-3 text-sm text-danger-strong"
              >
                <WarningCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-fg"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="min-h-11 w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-4 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-fg"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-11 w-full rounded-lg border border-border bg-muted py-2.5 pl-10 pr-11 text-sm text-fg placeholder:text-fg-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="min-h-11 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Iniciando sesión…" : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-fg-muted">
            Acceso restringido. Contacta con un administrador si necesitas una
            cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
