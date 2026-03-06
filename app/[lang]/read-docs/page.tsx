import Link from "next/link";

export default function ReadDocsPage({ params }: { params: { lang: string } }) {
  return (
    <main className="min-h-screen bg-[#050913] px-4 pb-16 pt-28 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-6 backdrop-blur md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Read Docs</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">TynysAi in Simple Words</h1>
          <p className="mt-3 text-sm text-slate-300">
            This page summarizes the public transport air-quality study used as reference for this project.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">What was studied</h2>
            <p className="mt-2 text-sm text-slate-300">
              Air quality in Almaty buses, metro, and trolleybuses with real-time sensing.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">How it works</h2>
            <p className="mt-2 text-sm text-slate-300">
              Sensors measure CO2, PM2.5, PM10, temperature, and humidity, then send updates every minute.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">Main result</h2>
            <p className="mt-2 text-sm text-slate-300">
              The XGBoost model reached about 91.25% classification accuracy and strong PM2.5 fit (R2 near 0.95).
            </p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold">Why this matters</h2>
            <p className="mt-2 text-sm text-slate-300">
              Transit teams can detect unhealthy peaks faster and improve ventilation and route decisions.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-5 text-sm text-slate-200">
          <p className="font-semibold text-zinc-100">Source paper</p>
          <p className="mt-2 text-slate-300">
            Mohammed S., et al. (2025). Sensors, 25(14), 4521.
          </p>
          <a
            className="mt-3 inline-flex text-cyan-300 hover:text-cyan-200"
            href="https://www.mdpi.com/1424-8220/25/14/4521"
            target="_blank"
            rel="noreferrer"
          >
            Open the MDPI article
          </a>
        </section>

        <div className="text-sm">
          <Link href={`/${params.lang}/privacy`} className="text-cyan-300 hover:text-cyan-200">
            Back to Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
