import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import HeroCinematic from './components/HeroCinematic';
import BrandsSection from './components/BrandsSection';
import MetricsTechnology from './components/MetricsTechnology';
import Architecture from './components/Architecture';
import FAQSection from './components/FAQSection';
import YurekaCallout from './components/YurekaCallout';
import Footer from './components/Footer';
import Loader from './components/Loader';

function App() {
  const [entranceComplete, setEntranceComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The entrance (nav fade, headline scramble) uses "Anton SC" / "Space
    // Mono" -- if it starts before those fonts are actually loaded, the
    // headline scrambles in with fallback-font metrics and then reflows
    // mid-animation once the real font swaps in. Gate on real readiness
    // instead of a blind delay, with a max wait so a slow connection still
    // reveals the site rather than hanging on a black screen.
    const fontsReady =
      typeof document !== 'undefined' && 'fonts' in document
        ? document.fonts.ready
        : Promise.resolve();
    const minDelay = new Promise((resolve) => setTimeout(resolve, 400));
    const maxWait = new Promise((resolve) => setTimeout(resolve, 3000));

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
    <div style={{ fontFamily: '"Space Mono", monospace' }}>
      <Loader show={!entranceComplete} />
      <Navbar entranceComplete={entranceComplete} />
      <HeroCinematic entranceComplete={entranceComplete} />
      <BrandsSection />
      <MetricsTechnology />
      <Architecture />
      <FAQSection />
      <YurekaCallout />
      <Footer />
    </div>
  );
}

export default App;
