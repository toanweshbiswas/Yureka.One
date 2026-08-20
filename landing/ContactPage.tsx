import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

const ContactPage: React.FC = () => (
  <div className="bg-cream min-h-screen">
    <SEO
      {...staticPageMeta['/contact']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact Yureka.One',
          url: 'https://yureka.one/contact',
        },
      ]}
    />

    <section className="px-6 pt-20 pb-24 md:pt-28">
      <div className="max-w-3xl mx-auto">
        <span className="font-overpass-mono text-clay text-xs uppercase tracking-[0.4em] block mb-6">Support</span>
        <h1 className="font-cirka text-white text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-8" style={{ letterSpacing: '-0.03em' }}>
          Contact Yureka.One
        </h1>
        <p className="text-white/70 text-lg leading-relaxed mb-10">
          We serve India. For product support, partnerships, press, and careers, write to support.
        </p>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Email</p>
            <a href="mailto:support@yureka.one" className="text-clay text-xl font-semibold hover:underline">
              support@yureka.one
            </a>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">HQ</p>
            <p className="text-white/70">Bengaluru, India</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Product access</p>
            <p className="text-white/70">
              Membership is invite-gated.{' '}
              <Link to="/join-waitlist" className="text-clay hover:underline">Join the waitlist</Link>
              {' '}or sign in from the header.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
)

export default ContactPage
