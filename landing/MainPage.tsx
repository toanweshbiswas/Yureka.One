import React, { useEffect, useState } from 'react';
import HeroCinematic from '@landing/home-v2/HeroCinematic';
import HeroMobile from '@landing/home-v2/HeroMobile';
import SEO from '@shared/SEO';
import { SITE_URL, staticPageMeta } from '@backend/lib/seo/pageMeta';
import { faqPageSchema } from '@backend/lib/seo/structuredData';
import { faqQuestions } from '@backend/lib/faq';

import Loader from '@landing/home-v2/Loader';
import Navbar from '@landing/home-v2/Navbar';
import ScrollDownCue from '@landing/home-v2/ScrollDownCue';
import BrandsSection from '@landing/home-v2/BrandsSection';
import MetricsTechnology from '@landing/home-v2/MetricsTechnology';
import Architecture from '@landing/home-v2/Architecture';
import FAQSection from '@landing/home-v2/FAQSection';
import YurekaCallout from '@landing/home-v2/YurekaCallout';
import Footer from '@landing/home-v2/Footer';
import { usePrefersCinematic } from '@landing/home-v2/usePrefersCinematic';

/**
 * Homepage composition:
 * Loader → Navbar → hero (touch stacked / desktop cinematic) → sections → footer.
 *
 * Touch never mounts the 500vh+ pin-scrub cinematic — that path is pointer-only.
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

    // Gate entrance on font readiness — short min delay so first paint feels
    // instant (Apple: kill latency). Cap wait so a hung font CDN can't stall.
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

      <div className="yureka-one-home bg-black min-h-screen text-white">
        <Loader show={!entranceComplete} />
        <Navbar entranceComplete={entranceComplete} />
        {prefersCinematic && <ScrollDownCue />}
        {prefersCinematic ? (
          <HeroCinematic entranceComplete={entranceComplete} />
        ) : (
          <HeroMobile entranceComplete={entranceComplete} />
        )}
        <BrandsSection />
        <MetricsTechnology />
        <Architecture />
        <FAQSection />
        <YurekaCallout />
        <Footer />
      </div>
    </>
  );
};

export default MainPage;
