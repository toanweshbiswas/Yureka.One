import React from 'react'
import Navbar from '@landing/home-v2/Navbar'
import Footer from '@landing/home-v2/Footer'
import GiftingSection from '@landing/home-v2/GiftingSection'
import SEO from '@shared/SEO'
import { staticPageMeta } from '@backend/lib/seo/pageMeta'
import { breadcrumbSchema } from '@backend/lib/seo/structuredData'

const GiftingPage: React.FC = () => (
  <div className="min-h-dvh bg-black text-white">
    <SEO
      {...staticPageMeta['/gift']}
      schema={[
        breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Gift cards', path: '/gift' },
        ]),
      ]}
    />
    <Navbar />
    <main className="pt-16">
      <GiftingSection />
    </main>
    <Footer />
  </div>
)

export default GiftingPage
