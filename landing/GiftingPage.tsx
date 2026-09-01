import React from 'react'
import { GiftingSection, LandingShell } from '@landing/home'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

const GiftingPage: React.FC = () => (
  <>
    <SEO
      {...staticPageMeta['/gift']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Gift cards', path: '/gift' },
        ]),
      ]}
    />
    <LandingShell mainClassName="pt-16">
      <GiftingSection />
    </LandingShell>
  </>
)

export default GiftingPage
