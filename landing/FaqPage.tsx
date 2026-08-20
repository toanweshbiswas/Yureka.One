import React from 'react'
import { Link } from 'react-router-dom'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema, faqPageSchema } from '@backend/lib/seo/structuredData'
import { faqQuestions } from '@backend/lib/faq'

const FaqPage: React.FC = () => (
  <div className="bg-cream min-h-screen">
    <SEO
      {...staticPageMeta['/faq']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'FAQ', path: '/faq' },
        ]),
        faqPageSchema(faqQuestions),
      ]}
    />

    <section className="px-6 pt-20 pb-24 md:pt-28">
      <div className="max-w-3xl mx-auto">
        <span className="font-overpass-mono text-clay text-xs uppercase tracking-[0.4em] block mb-6">Answers</span>
        <h1 className="font-cirka text-white text-4xl sm:text-6xl font-extrabold leading-[1.05] mb-6" style={{ letterSpacing: '-0.03em' }}>
          Frequently asked questions
        </h1>
        <p className="text-white/60 mb-14 leading-relaxed">
          Direct answers about Goldback, Yureka AI, credit without a card, and pricing. Still stuck?{' '}
          <Link to="/contact" className="text-clay hover:underline">Email us</Link>.
        </p>

        <div className="space-y-10">
          {faqQuestions.map((item) => (
            <article key={item.q}>
              <h2 className="font-cirka text-white text-2xl font-bold mb-3 leading-snug">{item.q}</h2>
              <p className="text-white/65 leading-relaxed">{item.a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  </div>
)

export default FaqPage
