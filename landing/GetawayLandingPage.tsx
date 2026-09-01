import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plane, ArrowRight } from 'lucide-react'
import SEO from '@shared/SEO'
import { wwApi, type WwTripPublic } from '@backend/lib/wanderworld/client'
import { formatInr } from '@app/Dashboard/Getaway/getawayUtils'
import { appUrl } from '@shared/hosts'

const GetawayLandingPage: React.FC = () => {
  const [trips, setTrips] = useState<WwTripPublic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const res = await wwApi.trips()
      setTrips(res.data?.trips || [])
      setLoading(false)
    })()
  }, [])

  return (
    <>
      <SEO
        title="WanderWorld Getaways | Yureka.One"
        description="Curated group trips and getaways. Browse trips on Yureka and book with secure checkout."
      />
      <div className="min-h-screen bg-cream px-4 py-16 text-ink md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <Plane className="h-8 w-8 text-clay" />
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">WanderWorld</p>
          </div>
          <h1 className="mt-4 font-cirka text-4xl font-bold tracking-tight text-white md:text-5xl">
            Curated getaways
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/55">
            Book trips on Yureka with full or installment plans. All confirmations and payment reminders land in your
            Yureka inbox.
          </p>
          <Link
            to={appUrl('/login?next=%2Fdashboard%2Fgetaway')}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-clay px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-black transition hover:opacity-90"
          >
            Open in app <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {loading && <p className="text-sm text-white/40">Loading trips…</p>}
            {!loading && trips.length === 0 && (
              <p className="text-sm text-white/40">No published trips yet. Check back soon.</p>
            )}
            {trips.map((t) => (
              <Link
                key={t.id}
                to={appUrl(`/login?next=${encodeURIComponent(`/dashboard/getaway/${t.slug}`)}`)}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:border-clay/30"
              >
                {t.coverImageUrl ? (
                  <img src={t.coverImageUrl} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[16/10] bg-white/5" />
                )}
                <div className="p-5">
                  <h2 className="text-lg font-bold text-white group-hover:text-clay">{t.title}</h2>
                  <p className="mt-1 text-sm text-white/45">
                    {t.startDate?.slice(0, 10)} · {t.seatsLeft} seats left
                  </p>
                  <p className="mt-3 text-sm font-semibold text-clay">From {formatInr(t.priceInr)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default GetawayLandingPage
