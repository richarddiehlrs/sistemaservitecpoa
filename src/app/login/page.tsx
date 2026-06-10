import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl font-bold text-white ring-1 ring-white/20">
            S
          </div>
          <h1 className="text-2xl font-bold text-white">ServitecPoa ERP</h1>
          <p className="mt-1 text-sm text-brand-200">
            Gestão de assistência técnica
          </p>
        </div>

        <div className="card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-brand-200">
          © {new Date().getFullYear()} ServitecPoa. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
