import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-br from-white via-white to-maroon-50">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Logo size={64} />
          </div>
          <h1 className="text-2xl font-bold text-maroon-700">NBDSP Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            National Birth Defects Surveillance Project
          </p>
        </div>
        <Suspense fallback={<div className="h-72 rounded-2xl border border-slate-200 bg-white shadow-lg" />}>
          <LoginForm />
        </Suspense>
          <p className="mt-6 text-center text-xs text-slate-400">
            Authorized personnel only · Department of Health
          </p>
        </div>
      </div>
    </main>
  );
}
