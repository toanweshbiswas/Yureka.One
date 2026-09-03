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
        <span className="font-sans font-bold text-landing-primary text-xs uppercase tracking-[0.3em] block mb-6">Support</span>
        <h1 className="font-sans text-white text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-8">
          Contact <span className="font-cooper text-landing-primary">Yureka.One</span>
        </h1>
        <p className="text-white text-lg leading-relaxed mb-10">
          We serve India. For product support, partnerships, press, and careers, write to support.
        </p>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-2">Email</p>
            <a href="mailto:support@yureka.one" className="text-landing-primary text-xl font-semibold hover:underline">
              support@yureka.one
            </a>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-2">HQ</p>
            <p className="text-white">Bengaluru, India</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-2">Product access</p>
            <p className="text-white">
              Create an account and open the dashboard.{' '}
              <Link to="/login" className="text-landing-primary hover:underline font-semibold">Get started</Link>
              {' '}from the header, or sign in if you already have an account.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
)

export default ContactPage
