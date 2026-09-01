import React, { useEffect, useState } from 'react';
import {
  Architecture,
  BrandsSection,
  FAQSection,
  Footer,
  HeroCinematic,
  HeroMobile,
  JournalSection,
  Loader,
  MetricsTechnology,
  Navbar,
  ScrollDownCue,
  YurekaCallout,
  usePrefersCinematic,
} from '@landing/home';
import SEO from '@shared/SEO';
import { SITE_URL, staticPageMeta } from '@backend/lib/seo/pageMeta';
import { faqPageSchema } from '@backend/lib/seo/structuredData';
import { faqQuestions } from '@backend/lib/faq';

/**
 * Homepage composition:
 * Loader → Navbar → hero (touch stacked / desktop cinematic) → sections → footer.
 *
 * Touch never mounts the 500vh+ pin-scrub cinematic. that path is pointer-only.
 */

const MainPage: React.FC = () => {
  const homeSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Yureka One',
    alternateName: 'Yureka',
    url: SITE_URL,
  };

  const [entranceComplete, setEntranceComplete] = useState(false);
  const prefersCinematic = usePrefersCinematic();

  useEffect(() => {
    let cancelled = false;

    const fontsReady =
      typeof document !== 'undefined' && 'fonts' in document
        ? document.fonts.ready
        : Promise.resolve();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 120));
    const maxWait = new Promise((resolve) => setTimeout(resolve, 1200));

    Promise.race([fontsReady, maxWait]).then(() =>
      minDelay.then(() => {
        if (!cancelled) setEntranceComplete(true);
      }),
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SEO {...staticPageMeta['/']} schema={[homeSchema, faqPageSchema(faqQuestions)]} />

      <div className="yureka-one-home min-h-screen text-landing-sub">
        <Loader show={!entranceComplete} />
        <Navbar entranceComplete={entranceComplete} theme="landing" />
        {prefersCinematic && <ScrollDownCue />}
        {prefersCinematic ? (
          <HeroCinematic entranceComplete={entranceComplete} />
        ) : (
          <HeroMobile entranceComplete={entranceComplete} />
        )}
        <BrandsSection />
        <MetricsTechnology />
        <Architecture />
        <JournalSection />
        <FAQSection />
        <YurekaCallout />
        <Footer />
      </div>
    </>
  );
};

export default MainPage;
