import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionTemplate, useScroll, useSpring, useTransform } from 'framer-motion';
import ScrambleIn from './ScrambleIn';
import { useInView } from './useInView';
import JoinWaitlistButton from './JoinWaitlistButton';
import { usePrefersCinematic } from './usePrefersCinematic';
import ScrollScrubVideo from './ScrollScrubVideo';
import { useVideoScrub } from './useVideoScrub';
import {
  landingBody,
  landingCaption,
  landingContainer,
  landingEyebrow,
} from './landingLayout';

const METRICS_VIDEO_URL = '/cta_fold.mp4';
const TECH_VIDEO_URL = '/vault4.mp4';
const TECH_POSTER = '/vault-poster.jpg';

const METRICS = [
  { value: 'Upto 5%', label: 'Yureka pays for your Purchase' },
  { value: 'Upto 5%', label: 'Earn Digital Gold for every purchase' },
  { value: 'Upto 5%', label: 'Earn Reward Points for every purchase' },
];

const FEATURES = [
  {
    title: 'History based Shopping Pattern',
    desc: 'Real-time spatial reconstruction of active neural regions.',
  },
  {
    title: 'Signals Monitored across the web',
    desc: 'Separates cognitive intent from biological noise.',
  },
  {
    title: 'AI optimsed Extensions and Tools',
    desc: 'Anticipates cognitive transitions before they occur.',
  },
  {
    title: 'Loop Feedback',
    desc: 'Closed-loop adjustment based on outcome correlation.',
  },
];

const METRICS_SCRUB_VH = 110;
const SLIDE_VH = 90;
const TECH_SCRUB_VH = 110;
const TOTAL_EXTRA_VH = METRICS_SCRUB_VH + SLIDE_VH + TECH_SCRUB_VH;

const METRICS_SCRUB_END = METRICS_SCRUB_VH / TOTAL_EXTRA_VH;
const SLIDE_END = (METRICS_SCRUB_VH + SLIDE_VH) / TOTAL_EXTRA_VH;

function GlassVideoCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl">
      {children}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.12) 82%, rgba(255,255,255,0) 100%)',
          mixBlendMode: 'overlay',
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
    </div>
  );
}

/** Mobile: stacked scroll-driven sections. no horizontal pin scrub. */
function MetricsTechnologyMobile() {
  const { ref: statsRef, inView: statsInView } = useInView<HTMLDivElement>('0px');

  return (
    <div className="relative w-full bg-landing-bg pb-20 pt-12">
      <section className={`${landingContainer} flex max-w-lg flex-col`}>
        <p className={`mb-6 text-center ${landingEyebrow}`}>
          What do you get from Yureka?
        </p>
      </section>

      <div className="px-5 sm:px-6">
        <ScrollScrubVideo src={METRICS_VIDEO_URL} trackVh={130} />
      </div>

      <section className={`${landingContainer} mt-6 flex max-w-lg flex-col`}>
        <div ref={statsRef} className="grid grid-cols-1 gap-8">
          {METRICS.map((metric, i) => (
            <div key={metric.label} className="text-center">
              <div className="text-[clamp(32px,10vw,48px)] font-light leading-none tracking-[-0.04em] text-landing-primary">
                <ScrambleIn text={metric.value} delay={i * 200} triggered={statsInView} />
              </div>
              <div className="mt-3 text-[13px] font-bold tracking-wide text-landing-sub">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`${landingContainer} mt-10 flex max-w-lg flex-col`}>
        <div className="flex flex-col gap-6">
          <h2 className="text-[clamp(32px,10vw,48px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-primary">
            Yureka
            <br />
            Ai
          </h2>
          <JoinWaitlistButton />
          <p className={`max-w-xs ${landingBody}`}>
            Our proprietary Ai model learns your daily shopping patterns within 72 hours. From
            there, recognises every search, need and desire, ever cognitive state is mapped,
            predicted across the web and optimized in real time. Our Ai gets you the best deal,
            savings and rewards personally curated for you everytime
          </p>
        </div>
      </section>

      <div className="px-5 sm:px-6">
        <ScrollScrubVideo src={TECH_VIDEO_URL} poster={TECH_POSTER} trackVh={130} />
      </div>

      <section className={`${landingContainer} mt-8 flex max-w-lg flex-col`}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <div className="mb-2 text-[14px] font-normal text-landing-primary">{feature.title}</div>
              <div className={`${landingCaption}`}>{feature.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricsTechnologyDesktop() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const metricsVideoRef = useRef<HTMLVideoElement>(null);
  const techVideoRef = useRef<HTMLVideoElement>(null);
  const sectionActiveRef = useRef(true);

  const { ref: statsRef, inView: statsInView } = useInView<HTMLDivElement>('0px');

  const [videosEnabled, setVideosEnabled] = useState(false);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        sectionActiveRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setVideosEnabled(true);
      },
      { rootMargin: '280px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });
  // Critically damped slide chrome only. media time stays raw (useVideoScrub).
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 170,
    damping: 32,
    mass: 1,
  });

  const rowX = useTransform(smoothProgress, [METRICS_SCRUB_END, SLIDE_END], [0, -100]);
  const rowTransform = useMotionTemplate`translateX(${rowX}vw)`;

  const mapMetricsTime = useCallback((progress: number, duration: number) => {
    const scrub = Math.max(0, Math.min(1, progress / METRICS_SCRUB_END));
    return scrub * Math.max(0.05, duration - 0.05);
  }, []);

  const mapTechTime = useCallback((progress: number, duration: number) => {
    if (progress < SLIDE_END) return 0;
    const scrub = Math.max(0, Math.min(1, (progress - SLIDE_END) / (1 - SLIDE_END)));
    return scrub * Math.max(0.05, duration - 0.05);
  }, []);

  useVideoScrub({
    videoRef: metricsVideoRef,
    scrollProgress: scrollYProgress,
    mapTime: mapMetricsTime,
    activeRef: sectionActiveRef,
    enabled: videosEnabled,
  });

  useVideoScrub({
    videoRef: techVideoRef,
    scrollProgress: scrollYProgress,
    mapTime: mapTechTime,
    activeRef: sectionActiveRef,
    enabled: videosEnabled,
  });

  return (
    <div
      ref={wrapperRef}
      id="metrics-technology-wrapper"
      className="relative"
      style={{ height: `${100 + TOTAL_EXTRA_VH}vh` }}
    >
      <section className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-landing-bg">
        <motion.div className="flex h-full" style={{ width: '200vw', transform: rowTransform }}>
          <div className="relative h-full w-screen overflow-hidden bg-landing-bg">
            <div className={`relative z-10 mx-auto flex h-full flex-col pb-10 pt-20 sm:pb-12 sm:pt-24 ${landingContainer}`}>
              <div className="relative min-h-[40vh] flex-1">
                <GlassVideoCard>
                  {videosEnabled && (
                    <video
                      ref={metricsVideoRef}
                      src={METRICS_VIDEO_URL}
                      muted
                      playsInline
                      preload="auto"
                      disablePictureInPicture
                      className="h-full w-full object-cover opacity-100"
                    />
                  )}
                </GlassVideoCard>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <motion.p
                  className={`mb-6 text-center ${landingEyebrow} sm:text-[14px]`}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
                >
                  What do you get from Yureka?
                </motion.p>

                <div ref={statsRef} className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
                  {METRICS.map((metric, i) => (
                    <motion.div
                      key={metric.label}
                      className="text-center"
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.45, delay: i * 0.1 }}
                    >
                      <div className="text-[clamp(32px,6.4vw,58px)] font-light leading-none tracking-[-0.04em] text-landing-primary">
                        <ScrambleIn text={metric.value} delay={i * 180} triggered={statsInView} />
                      </div>
                      <div className="mt-3 text-[13px] font-bold tracking-wide text-landing-sub sm:text-[15px]">
                        {metric.label}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative h-full w-screen overflow-hidden bg-landing-bg">
            <div className={`relative z-10 mx-auto flex h-full w-full flex-col pb-10 pt-20 sm:pb-12 sm:pt-24 ${landingContainer}`}>
              <div className="relative min-h-[40vh] flex-1">
                <GlassVideoCard>
                  {videosEnabled && (
                    <video
                      ref={techVideoRef}
                      src={TECH_VIDEO_URL}
                      poster={TECH_POSTER}
                      muted
                      playsInline
                      preload="auto"
                      disablePictureInPicture
                      className="h-full w-full object-cover opacity-100"
                    />
                  )}
                </GlassVideoCard>
              </div>

              <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col items-start gap-6">
                  <motion.h2
                    className="text-[clamp(32px,7vw,64px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-primary"
                    initial={{ y: 28, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                  >
                    Yureka
                    <br />
                    Ai
                  </motion.h2>
                  <JoinWaitlistButton />
                </div>

                <motion.p
                  className={`max-w-xs ${landingBody} md:pt-2 md:text-right`}
                  initial={{ y: 16, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.08 }}
                >
                  Our proprietary Ai model learns your daily shopping patterns within 72 hours.
                  From there, recognises every search, need and desire, ever cognitive state is
                  mapped, predicted across the web and optimized in real time. Our Ai gets you
                  the best deal, savings and rewards personally curated for you everytime
                </motion.p>
              </div>

              <motion.div
                className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.12 }}
              >
                {FEATURES.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ y: 16, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35, delay: i * 0.06 }}
                  >
                    <div className="mb-2 text-[14px] font-normal text-landing-primary sm:text-[16px]">
                      {feature.title}
                    </div>
                    <div className={landingCaption}>{feature.desc}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-[20vw] bg-landing-bg md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-[20vw] bg-landing-bg md:block" />
      </section>
    </div>
  );
}

export default function MetricsTechnology() {
  const prefersCinematic = usePrefersCinematic();
  return prefersCinematic ? <MetricsTechnologyDesktop /> : <MetricsTechnologyMobile />;
}
