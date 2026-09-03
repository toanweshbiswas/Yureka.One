import React from 'react'
import { GiftingSection } from '@landing/home'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

const GiftingPage: React.FC = () => (
  <div className="yureka-one-home min-h-screen bg-landing-bg text-landing-sub selection:bg-landing-primary selection:text-landing-ink">
    <SEO
      {...staticPageMeta['/gift']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Gift cards', path: '/gift' },
        ]),
      ]}
    />
    <GiftingSection />
  </div>
)

export default GiftingPage
