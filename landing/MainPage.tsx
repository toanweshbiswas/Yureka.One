import React, { useEffect, useRef, useState } from 'react';
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

/**
 * Homepage composition:
 * Loader → Navbar → hero (mobile stacked / desktop cinematic) → sections → footer.
 *
 * Mobile never mounts the 500vh+ pin-scrub cinematic — that path only runs at md+.
 */
function useIsDesktopMd() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

const MainPage: React.FC = () => {
  const homeSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Yureka One',
    alternateName: 'Yureka',
    url: SITE_URL,
  };

  const [entranceComplete, setEntranceComplete] = useState(false);
  const isDesktop = useIsDesktopMd();

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
        {/* Scroll cue is desktop cinematic-only */}
        {isDesktop && <ScrollDownCue />}
        {isDesktop ? (
          <HeroCinematic entranceComplete={entranceComplete} />
        ) : (
          <HeroMobile />
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
