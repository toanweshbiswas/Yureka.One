import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Briefcase, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import SEO from '@shared/SEO'
import { api, isApiError } from '@backend/lib/api/client'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema, jobPostingSchema } from '@backend/lib/seo/structuredData'
import { CAREER_ROLES_FALLBACK } from '@landing/careersData'

type CareerRole = {
  id: string
  refId: string
  title: string
  department: string
  dept?: string
  location: string
  type: string
  description?: string
  applyEmail?: string
}

function applyHref(role: CareerRole) {
  const email = role.applyEmail || 'support@yureka.one'
  const subject = encodeURIComponent(`Application: ${role.title} (${role.refId})`)
  return `mailto:${email}?subject=${subject}`
}

function fallbackRoles(): CareerRole[] {
  return CAREER_ROLES_FALLBACK.map((role) => ({
    id: role.refId,
    refId: role.refId,
    title: role.title,
    department: role.dept,
    location: role.location,
    type: role.type,
    description: role.description,
    applyEmail: role.applyEmail,
  }))
}

const CareersPage: React.FC = () => {
  const [roles, setRoles] = useState<CareerRole[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.get<CareerRole[]>('/api/v1/cms/jobs', { skipAuth: true }).then((res) => {
      if (cancelled) return
      if (isApiError(res) || !res.data?.length) {
        setRoles(fallbackRoles())
      } else {
        setRoles(res.data)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const schemaRoles = useMemo(
    () =>
      roles.map((role) =>
        jobPostingSchema({
          title: role.title,
          type: role.type,
          location: role.location,
          dept: role.department || role.dept || 'General',
          refId: role.refId,
          description: role.description,
        }),
      ),
    [roles],
  )

  return (
    <div className="bg-cream min-h-screen">
      <SEO
        {...staticPageMeta['/jobs']}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Careers', path: '/jobs' },
          ]),
          ...schemaRoles,
        ]}
      />

      <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 border-b border-white/10">
        <div className="max-w-3xl mx-auto">
          <span className="font-sans font-bold text-landing-primary text-xs uppercase tracking-[0.3em] block mb-6">
            Careers
          </span>
          <h1
            className="font-sans text-white text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-8"
          >
            Build India&apos;s <span className="font-cooper text-landing-primary">AI Wealth OS</span>
          </h1>
          <p className="text-white text-lg leading-relaxed mb-6">
            Yureka.One turns everyday spending into digital gold, AI ordering, and alternative credit.
            We&apos;re a small team in Bengaluru building for power shoppers who expect more from every transaction.
          </p>
          <p className="text-white leading-relaxed">
            High autonomy, competitive equity, and craft-first product work. If banking rewards feel broken to you,
            you&apos;ll fit right in.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h2 className="font-sans text-white text-2xl font-bold tracking-tight">Open roles</h2>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white">Bengaluru · Hybrid</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-landing-primary" size={28} />
            </div>
          ) : !roles.length ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center">
              <Briefcase className="mx-auto mb-4 text-white" size={28} />
              <p className="text-white">No open roles right now.</p>
              <a href="mailto:support@yureka.one" className="mt-4 inline-block text-landing-primary hover:underline">
                Email us anyway
              </a>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] overflow-hidden divide-y divide-white/[0.06]">
              {roles.map((role) => {
                const open = openId === role.id
                const dept = role.department || role.dept || 'General'
                return (
                  <article key={role.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : role.id)}
                      className="w-full text-left px-5 py-5 md:px-6 md:py-6 hover:bg-white/[0.03] active:scale-[0.995] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white mb-2">
                            {role.refId}
                          </p>
                          <h3 className="font-sans text-white text-xl md:text-2xl font-bold leading-snug tracking-tight">
                            {role.title}
                          </h3>
                          <p className="mt-2 text-[13px] text-white">
                            {dept} · {role.location} · {role.type}
                          </p>
                        </div>
                        <span className="shrink-0 mt-1 text-white text-sm">{open ? '−' : '+'}</span>
                      </div>
                    </button>

                    {open && (
                      <div className="px-5 pb-5 md:px-6 md:pb-6 -mt-2">
                        {role.description ? (
                          <p className="text-white leading-relaxed mb-5 max-w-2xl">{role.description}</p>
                        ) : null}
                        <a
                          href={applyHref(role)}
                          className="inline-flex items-center gap-2 rounded-full bg-landing-primary px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-landing-ink hover:brightness-110 shadow-sm shadow-landing-primary/20 active:scale-[0.98] transition-all"
                        >
                          Apply
                          <ArrowUpRight size={14} />
                        </a>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <div className="mt-12 rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white mb-3">
              Don&apos;t see your role?
            </p>
            <p className="text-white mb-4">Tell us what you&apos;d build at Yureka and attach a CV or portfolio.</p>
            <a href="mailto:support@yureka.one" className="text-landing-primary font-semibold hover:underline">
              support@yureka.one
            </a>
            <p className="mt-6 text-[13px] text-white">
              Read more about the company on the <Link to="/about" className="text-landing-primary hover:underline">About</Link> page.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default CareersPage
