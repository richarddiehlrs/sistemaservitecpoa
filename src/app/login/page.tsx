import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 p-4">
      {/* brilhos decorativos */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-3xl font-bold text-white shadow-xl shadow-brand-900/40 ring-1 ring-white/20">
            S
          </div>
          <h1 className="text-2xl font-bold text-white">ServitecPoa ERP</h1>
          <p className="mt-1 text-sm text-brand-200">Gestão de assistência técnica</p>
        </div>

        <div className="card p-7 shadow-2xl">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Acesse sua conta</h2>
            <p className="text-sm text-slate-500">Entre com seu e-mail e senha</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-brand-200/80">
          © {new Date().getFullYear()} ServitecPoa. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
