import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="text-center">
        <p className="text-5xl font-bold text-maroon-700">404</p>
        <p className="mt-2 text-sm text-slate-500">This page could not be found.</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
