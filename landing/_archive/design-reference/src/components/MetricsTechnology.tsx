import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionTemplate, useScroll, useSpring, useTransform } from 'framer-motion';
import ScrambleIn from './ScrambleIn';
import { useInView } from '../hooks/useInView';

const METRICS_VIDEO_URL = '/cta_fold.mp4';

const TECH_VIDEO_URL = '/vault%204.mp4';

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

// Extra scroll distance (beyond the pinned viewport) dedicated to each
// phase: scrubbing the Metrics video to its end, sliding Metrics ->
// Technology, then scrubbing the Technology video to its end. Because each
// scrub phase is pinned, scroll can't advance into the next phase until its
// video has actually played through to the last frame -- same technique as
// the vault video's intro sequence.
const METRICS_SCRUB_VH = 100;
const SLIDE_VH = 100;
const TECH_SCRUB_VH = 100;
const TOTAL_EXTRA_VH = METRICS_SCRUB_VH + SLIDE_VH + TECH_SCRUB_VH;

const METRICS_SCRUB_END = METRICS_SCRUB_VH / TOTAL_EXTRA_VH;
const SLIDE_END = (METRICS_SCRUB_VH + SLIDE_VH) / TOTAL_EXTRA_VH;

// Shared rounded, glass-morphed frame for both panels' video cards: a
// bright border, backdrop blur, a diagonal light-catching sheen, and an
// inset ring highlight -- same treatment used on the FAQ and Footer cards.
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

export default function MetricsTechnology() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const metricsVideoRef = useRef<HTMLVideoElement>(null);
  const techVideoRef = useRef<HTMLVideoElement>(null);
  const metricsTargetTimeRef = useRef(0);
  const metricsIsSeekingRef = useRef(false);
  const techTargetTimeRef = useRef(0);
  const techIsSeekingRef = useRef(false);

  // Same scramble-in-then-loop effect used on the Hero headline, applied
  // to the three stat values once they scroll into view.
  const { ref: statsRef, inView: statsInView } = useInView<HTMLDivElement>('0px');

  // This section sits well below the fold -- its two videos shouldn't
  // compete with the hero's for bandwidth on initial load. Enabled once,
  // with enough lookahead to be buffered by the time the user scrolls in.
  const [videosEnabled, setVideosEnabled] = useState(false);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideosEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Same pin technique used throughout: "start start" -> "end end" spans
  // exactly the pinned window (progress 0 at pin-begin, 1 at release).
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 1 });

  // Metrics slides left, Technology slides in from the right to center,
  // between the two scrub phases.
  const rowX = useTransform(smoothProgress, [METRICS_SCRUB_END, SLIDE_END], [0, -100]);
  const rowTransform = useMotionTemplate`translateX(${rowX}vw)`;

  // Metrics video scroll-scrub (currentTime), phase 0. Raw (unsmoothed)
  // progress for frame-precise scrubbing.
  useEffect(() => {
    const video = metricsVideoRef.current;
    if (!video) return;

    let seekTimeout: ReturnType<typeof setTimeout> | undefined;

    const trySeek = () => {
      if (metricsIsSeekingRef.current || !video.duration) return;
      metricsIsSeekingRef.current = true;
      video.currentTime = metricsTargetTimeRef.current;
      clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        metricsIsSeekingRef.current = false;
      }, 200);
    };

    const onSeeked = () => {
      clearTimeout(seekTimeout);
      metricsIsSeekingRef.current = false;
      trySeek();
    };

    const onLoadedMetadata = () => {
      video.pause();
      video.currentTime = 0;
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    const unsubscribe = scrollYProgress.on('change', (progress) => {
      if (!video.duration) return;
      const clamped = Math.max(0, Math.min(1, progress));
      const scrubProgress = Math.min(1, clamped / METRICS_SCRUB_END);
      metricsTargetTimeRef.current = scrubProgress * video.duration;
      trySeek();
    });

    return () => {
      clearTimeout(seekTimeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      unsubscribe();
    };
  }, [scrollYProgress, videosEnabled]);

  // Technology video scroll-scrub (currentTime), phase 2 -- re-keyed off
  // the tail of the scroll, after the slide completes.
  useEffect(() => {
    const video = techVideoRef.current;
    if (!video) return;

    let seekTimeout: ReturnType<typeof setTimeout> | undefined;

    const trySeek = () => {
      if (techIsSeekingRef.current || !video.duration) return;
      techIsSeekingRef.current = true;
      video.currentTime = techTargetTimeRef.current;
      clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        techIsSeekingRef.current = false;
      }, 200);
    };

    const onSeeked = () => {
      clearTimeout(seekTimeout);
      techIsSeekingRef.current = false;
      trySeek();
    };

    const onLoadedMetadata = () => {
      video.pause();
      video.currentTime = 0;
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    const unsubscribe = scrollYProgress.on('change', (progress) => {
      if (!video.duration) return;
      const clamped = Math.max(0, Math.min(1, progress));
      const scrubProgress = Math.max(0, Math.min(1, (clamped - SLIDE_END) / (1 - SLIDE_END)));
      techTargetTimeRef.current = scrubProgress * video.duration;
      trySeek();
    });

    return () => {
      clearTimeout(seekTimeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      unsubscribe();
    };
  }, [scrollYProgress, videosEnabled]);

  return (
    <div
      ref={wrapperRef}
      id="metrics-technology-wrapper"
      className="relative"
      style={{ height: `${100 + TOTAL_EXTRA_VH}vh` }}
    >
      <section className="sticky top-0 h-screen h-[100dvh] w-full overflow-hidden bg-black">
        <motion.div className="flex h-full" style={{ width: '200vw', transform: rowTransform }}>
          {/* Metrics panel */}
          <div className="relative h-full w-screen overflow-hidden bg-black">
            <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:max-w-[60vw]">
              {/* Video card: bounded between the navbar and the stats
                  below it, rather than bleeding full-screen behind them. */}
              <div className="relative min-h-0 flex-1">
                <GlassVideoCard>
                  {videosEnabled && (
                    <video
                      ref={metricsVideoRef}
                      src={METRICS_VIDEO_URL}
                      muted
                      playsInline
                      preload="auto"
                      className="h-full w-full object-cover"
                    />
                  )}
                </GlassVideoCard>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <motion.p
                  className="mb-6 text-center text-[13px] uppercase tracking-[0.2em] text-[#5fae52] sm:text-[14px]"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1.2 }}
                >
                  What do you get from Yureka?
                </motion.p>

                <div ref={statsRef} className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
                  {METRICS.map((metric, i) => (
                    <motion.div
                      key={metric.label}
                      className="text-center"
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                    >
                      <div className="text-[clamp(32px,6.4vw,58px)] font-light leading-none tracking-[-0.04em] text-white">
                        <ScrambleIn text={metric.value} delay={i * 200} triggered={statsInView} />
                      </div>
                      <div className="mt-3 text-[13px] font-bold tracking-wide text-[#5fae52] sm:text-[15px]">
                        {metric.label}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Technology panel */}
          <div className="relative h-full w-screen overflow-hidden bg-black">
            <div className="relative z-10 mx-auto flex h-full w-full flex-col px-8 pb-10 pt-20 sm:px-12 sm:pb-12 sm:pt-24 md:max-w-[60vw] md:px-0">
              {/* Video card: bounded between the navbar and the copy
                  below it, rather than bleeding full-screen behind it. */}
              <div className="relative min-h-0 flex-1">
                <GlassVideoCard>
                  {videosEnabled && (
                    <video
                      ref={techVideoRef}
                      src={TECH_VIDEO_URL}
                      muted
                      playsInline
                      preload="auto"
                      className="h-full w-full object-cover"
                    />
                  )}
                </GlassVideoCard>
              </div>

              <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <motion.h2
                  className="text-[clamp(32px,7vw,64px)] font-light leading-[0.95] tracking-[-0.03em] text-white"
                  initial={{ y: 40, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1.0 }}
                >
                  Yureka
                  <br />
                  Ai
                </motion.h2>

                <motion.p
                  className="max-w-xs text-[13px] leading-relaxed text-white/50 sm:text-[15px] md:pt-2 md:text-right"
                  initial={{ y: 20, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1.0, delay: 0.2 }}
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
                transition={{ duration: 1.0, delay: 0.3 }}
              >
                {FEATURES.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.7, delay: i * 0.1 }}
                  >
                    <div className="mb-2 text-[14px] font-normal text-white sm:text-[16px]">
                      {feature.title}
                    </div>
                    <div className="text-[12px] leading-relaxed text-white/40 sm:text-[14px]">
                      {feature.desc}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Fixed blank-column mask, matching the rest of the site's 5-column
            layout (columns 1 & 5 blank). This sits on top of the sliding
            row rather than inside it, so it stays put at the viewport edges
            regardless of what's sliding underneath -- keeping the seam
            between the two videos flush instead of doubling the margin. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-[20vw] bg-black md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-[20vw] bg-black md:block" />
      </section>
    </div>
  );
}
