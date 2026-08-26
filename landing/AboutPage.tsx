import React from 'react'
import { Link } from 'react-router-dom'
import { Linkedin } from 'lucide-react'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

const FOUNDERS = [
  {
    name: 'Anwesh Biswas',
    role: 'Founder',
    href: 'https://www.linkedin.com/in/anweshbiswas/',
  },
  {
    name: 'Mainak Saha',
    role: 'Co-founder',
    href: 'https://www.linkedin.com/in/mainaksaha08/',
  },
] as const

const AboutPage: React.FC = () => (
  <div className="bg-cream min-h-screen">
    <SEO
      {...staticPageMeta['/about']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About Yureka.One',
          url: 'https://yureka.one/about',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Yureka.One',
          url: 'https://yureka.one',
          founder: FOUNDERS.map((f) => ({
            '@type': 'Person',
            name: f.name,
            jobTitle: f.role,
            sameAs: f.href,
            worksFor: { '@type': 'Organization', name: 'Yureka.One', url: 'https://yureka.one' },
          })),
        },
      ]}
    />

    <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 border-b border-white/10">
      <div className="max-w-3xl mx-auto">
        <span className="font-overpass-mono text-clay text-xs uppercase tracking-[0.4em] block mb-6">Company</span>
        <h1
          className="font-cirka text-white text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-8"
          style={{ letterSpacing: '-0.03em' }}
        >
          About Yureka.One
        </h1>
        <p className="text-white/70 text-lg leading-relaxed mb-6">
          Yureka.One is India&apos;s first AI-native Wealth Operating System. It turns everyday spending into 24K digital gold (Yureka Goldback), places orders through an AI concierge, and builds alternative credit profiles from consented transaction data.
        </p>
        <p className="text-white/60 leading-relaxed mb-6">
          The company was founded in 2026 by{' '}
          <strong className="text-white">Anwesh Biswas</strong> and{' '}
          <strong className="text-white">Mainak Saha</strong> and is based in Bengaluru. The product is built for affluent India&apos;s power shoppers. people who already spend across UPI, quick commerce, and everyday brands, but collect fragmented, low-value points.
        </p>
        <p className="text-white/60 leading-relaxed">
          Capture, Score, Optimise: we parse consented receipts and UPI signals, generate a Power Shopper Score (0 to 100), then route payments so rewards land as liquid digital gold instead of expiring coins.
        </p>
      </div>
    </section>

    <section className="px-6 py-16 md:py-20 border-b border-white/10">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-cirka text-white text-2xl font-bold mb-3">Founding team</h2>
        <p className="text-white/55 text-[15px] leading-relaxed mb-8">
          Connect with the people building Yureka.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FOUNDERS.map((person) => (
            <li key={person.href}>
              <a
                href={person.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-5 py-4 transition-[background,border-color,transform] duration-100 ease-out hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-white">
                    {person.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-white/45">{person.role}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/10 text-[#0A66C2] ring-1 ring-[#0A66C2]/25 transition-colors group-hover:bg-[#0A66C2]/20">
                  <Linkedin size={18} aria-hidden />
                  <span className="sr-only">LinkedIn profile for {person.name}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <section className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto grid gap-8">
        <div>
          <h2 className="font-cirka text-white text-2xl font-bold mb-3">What we ship</h2>
          <ul className="text-white/60 leading-relaxed space-y-2 list-disc pl-5">
            <li>Consumer Wealth OS with Goldback on eligible spend</li>
            <li>Yureka AI concierge for food, grocery, and shopping orders</li>
            <li>Chrome extension and in-app brand explorer</li>
            <li>RBI-aligned alternative credit profiling with explicit consent</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/manifesto" className="text-clay hover:underline">
            Manifesto
          </Link>
          <Link to="/security-protocol" className="text-clay hover:underline">
            Security protocol
          </Link>
          <Link to="/jobs" className="text-clay hover:underline">
            Careers
          </Link>
          <Link to="/contact" className="text-clay hover:underline">
            Contact
          </Link>
        </div>
      </div>
    </section>
  </div>
)

export default AboutPage
