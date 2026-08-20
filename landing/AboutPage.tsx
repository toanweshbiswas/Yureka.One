import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

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
          '@type': 'Person',
          name: 'Anwesh Biswas',
          jobTitle: 'Founder',
          worksFor: { '@type': 'Organization', name: 'Yureka.One', url: 'https://yureka.one' },
        },
      ]}
    />

    <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 border-b border-white/10">
      <div className="max-w-3xl mx-auto">
        <span className="font-overpass-mono text-clay text-xs uppercase tracking-[0.4em] block mb-6">Company</span>
        <h1 className="font-cirka text-white text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-8" style={{ letterSpacing: '-0.03em' }}>
          About Yureka.One
        </h1>
        <p className="text-white/70 text-lg leading-relaxed mb-6">
          Yureka.One is India&apos;s first AI-native Wealth Operating System. It turns everyday spending into 24K digital gold (Yureka Goldback), places orders through an AI concierge, and builds alternative credit profiles from consented transaction data.
        </p>
        <p className="text-white/60 leading-relaxed mb-6">
          The company was founded in 2026 by <strong className="text-white">Anwesh Biswas</strong> and is based in Bengaluru. The product is built for affluent India&apos;s power shoppers — people who already spend across cards, UPI, and quick commerce, but collect fragmented, low-value points.
        </p>
        <p className="text-white/60 leading-relaxed">
          Capture, Score, Optimise: we parse consented receipts and UPI signals, generate a Power Shopper Score (0–100), then route payments so rewards land as liquid digital gold instead of expiring coins.
        </p>
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
          <Link to="/manifesto" className="text-clay hover:underline">Manifesto</Link>
          <Link to="/security-protocol" className="text-clay hover:underline">Security protocol</Link>
          <Link to="/jobs" className="text-clay hover:underline">Careers</Link>
          <Link to="/contact" className="text-clay hover:underline">Contact</Link>
        </div>
      </div>
    </section>
  </div>
)

export default AboutPage
