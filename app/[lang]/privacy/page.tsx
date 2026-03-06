import Link from "next/link";

export default function PrivacyPage({ params }: { params: { lang: string } }) {
  return (
    <main className="min-h-screen bg-[#050913] px-4 pb-16 pt-28 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-6 backdrop-blur md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Privacy</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Simple Privacy Policy</h1>
          <p className="mt-3 text-sm text-slate-300">
            We collect only what we need to run TynysAi safely.
          </p>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-zinc-100">What we collect</p>
              <p className="mt-1 text-slate-300">Account info, sensor readings, and support messages.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-zinc-100">Why we collect it</p>
              <p className="mt-1 text-slate-300">To show air quality, improve alerts, and keep accounts secure.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="font-semibold text-zinc-100">Your control</p>
              <p className="mt-1 text-slate-300">You can request data access or deletion by email.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <a href="mailto:privacy@tynysai.com" className="text-cyan-300 hover:text-cyan-200">
              privacy@tynysai.com
            </a>
            <Link href={`/${params.lang}/read-docs`} className="text-cyan-300 hover:text-cyan-200">
              Read Docs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
