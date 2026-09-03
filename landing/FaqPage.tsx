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
        <span className="font-sans font-bold text-landing-primary text-xs uppercase tracking-[0.3em] block mb-6">Answers</span>
        <h1 className="font-sans text-white text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
          <span className="font-cooper text-landing-primary">Frequently</span> asked questions
        </h1>
        <p className="text-white mb-14 leading-relaxed">
          Direct answers about Goldback, Yureka AI, and pricing. Still stuck?{' '}
          <Link to="/contact" className="text-landing-primary hover:underline">Email us</Link>.
        </p>

        <div className="space-y-10">
          {faqQuestions.map((item) => (
            <article key={item.q}>
              <h2 className="font-sans text-white text-2xl font-bold mb-3 leading-snug tracking-tight">{item.q}</h2>
              <p className="text-white leading-relaxed">{item.a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  </div>
)

export default FaqPage
