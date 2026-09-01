import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import ScrambleIn from './ScrambleIn';
import { PhoneBubbleMockup, PhoneVaultMockup } from './YurekaMockups';

const VAULT_VIDEO_URL = '/vault.mp4';
const VAULT_START_TIME = 2;

const CINEMATIC_VIDEO_URL = '/rewards-desktop-final.mp4';

// One continuous pinned sequence, phase after phase, all inside a single
// sticky section -- deliberately NOT split across separate wrapper/pin
// components. Two separate position:sticky wrappers always leave a
// trailing viewport-height of ordinary (unpinned) scroll after the first
// releases and before the second engages, which reads as the next section
// "sliding up from the bottom." Keeping every phase on one shared
// scrollYProgress is what makes the vault scrub flow straight into Hero's
// reveal with no seam.
// Trimmed to ~2/3 of their original lengths (920vh -> 620vh total pinned
// scroll) so Brands isn't so many screens away, while keeping each phase's
// relative weight so the pacing still reads the same, just tighter.
const VAULT_SCRUB_VH = 130; // phase 0: scrub the vault video to its end
const VAULT_ZOOM_VH = 90; // phase 1: zoom into the vault's black screen
const HERO_ZOOM_OUT_VH = 70; // phase 2: vault overlay fades away, revealing the Hero panel
const SLIDE_VH = 140; // phase 3: Hero exits left, Yureka panels, Cinematic Text enters
const CRAWL_VH = 90; // phase 4: Cinematic Text's tilted 3D crawl
const TOTAL_EXTRA_VH =
  VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH + SLIDE_VH + CRAWL_VH;

const VAULT_SCRUB_END = VAULT_SCRUB_VH / TOTAL_EXTRA_VH;
const VAULT_ZOOM_END = (VAULT_SCRUB_VH + VAULT_ZOOM_VH) / TOTAL_EXTRA_VH;
const HERO_ZOOM_OUT_END =
  (VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH) / TOTAL_EXTRA_VH;
const SLIDE_END =
  (VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH + SLIDE_VH) / TOTAL_EXTRA_VH;
const CRAWL_END = 0.96;

// Position of the vault's dark screen within its frame at the moment the
// scrub finishes (its last frame), measured by sampling that exact frame
// and correcting for object-cover's horizontal crop against the card's
// 16:10 box. The zoom below only ever runs after the scrub completes, so
// it's always zooming into this same, known composition -- unlike a zoom
// applied across the whole scrub, which would crop whatever frame happened
// to be playing at the time.
const VAULT_ZOOM_ORIGIN = '49% 53%';

// Two full readable panels sit between Hero and Cinematic Text in the
// sliding row, so the slide reads as: Hero exits left, "Meet Yureka" and
// "We Hate Gatekeeping" pass through, then Cinematic Text arrives from
// the right.
const GAP_VW = 200;
const ROW_WIDTH_VW = 100 + GAP_VW + 100;
const ROW_END_X = -(100 + GAP_VW);

interface HeroCinematicProps {
  entranceComplete: boolean;
}

export default function HeroCinematic({ entranceComplete }: HeroCinematicProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const vaultVideoRef = useRef<HTMLVideoElement>(null);
  const vaultTargetTimeRef = useRef(VAULT_START_TIME);
  const vaultIsSeekingRef = useRef(false);
  const cinematicPanelRef = useRef<HTMLDivElement>(null);

  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );
  const [cinematicVideoEnabled, setCinematicVideoEnabled] = useState(false);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The Cinematic Text panel is the last of four in the sliding row --
  // there's no reason to fetch its video until the user has scrolled far
  // enough into the pin that it's about to come into frame. Lookahead
  // bumped to 1600px (from 800px) and preload="auto" added on the video
  // itself below -- at 800px, this ~6MB file often hadn't finished
  // buffering by the time the panel actually slid into view, so it sat on
  // a black frame instead of playing.
  useEffect(() => {
    const el = cinematicPanelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCinematicVideoEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 1600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The vault scroll-scrub below does real work (video seeks) on every
  // scroll event, site-wide, for as long as this component stays mounted --
  // which is the entire session, since it never unmounts once scrolled
  // past. Without this gate it'd keep seeking an off-screen video every
  // time the user scrolls while reading Metrics, Architecture, or the FAQ
  // far below.
  const isHeroNearRef = useRef(true);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isHeroNearRef.current = entry.isIntersecting;
      },
      { rootMargin: '300px' },
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

  // Phase 1: zoom into the vault's black screen, only once the scrub is
  // done. Raw (unsmoothed) progress so the zoom tracks the scroll 1:1 --
  // clamped to 0 for all of phase 0, so the video holds at scale 1 (full
  // frame, no crop) for the entire scrub, then ramps up only here.
  const vaultZoomProgress = useTransform(scrollYProgress, [VAULT_SCRUB_END, VAULT_ZOOM_END], [0, 1]);
  const vaultVideoScale = useTransform(vaultZoomProgress, [0, 1], [1, 20]);

  // Phase 2: drives the vault overlay's fade-out below, right after the
  // zoom finishes. Sprung for a weightier, more cinematic feel.
  const heroZoomOutProgress = useTransform(smoothProgress, [VAULT_ZOOM_END, HERO_ZOOM_OUT_END], [0, 1]);

  // The vault overlay is a solid black mask + inset video card sitting on
  // top of Hero's row. It holds fully opaque through the scrub+zoom, then
  // fades away as the zoomed-in black screen gives way to Hero underneath
  // -- this fade IS the "zoom out from black" reveal, no separate crossfade
  // needed on Hero's side. Driven off heroZoomOutProgress (not raw scroll)
  // so the fade and the zoom share one spring: if they were sprung
  // separately, the overlay's transparency and the video's actual zoom
  // level would drift out of sync while scrolling, and the mismatch reads
  // as the frame's brightness pulsing instead of a clean, monotonic
  // zoom-out from black.
  const vaultOverlayOpacity = useTransform(heroZoomOutProgress, [0, 1], [1, 0]);

  // The "TRANSCENDENCE" watermark ramps brighter in sync with that same
  // reveal, rather than just sitting at a static opacity -- it grows in
  // as the vault overlay fades away, giving the reveal a bit more impact.
  const watermarkOpacity = useTransform(heroZoomOutProgress, [0, 1], [0, 0.4]);

  // Phase 3: Hero slides left, past the blank black panel, and Cinematic
  // Text slides in from the right.
  const rowX = useTransform(smoothProgress, [HERO_ZOOM_OUT_END, SLIDE_END], [0, ROW_END_X]);
  const rowTransform = useMotionTemplate`translateX(${rowX}vw)`;

  // Phase 4: the tilted 3D text crawl, re-keyed off the tail of the scroll.
  const crawlProgress = useTransform(smoothProgress, [SLIDE_END, CRAWL_END], [0, 1]);
  const crawlAmplitude = viewportHeight * 0.6;
  const crawlY = useTransform(crawlProgress, [0, 1], [crawlAmplitude, -crawlAmplitude]);
  const crawlOpacity = useTransform(crawlProgress, [0.15, 0.35], [0, 1]);
  const crawlTransform = useMotionTemplate`rotateX(24deg) translateY(${crawlY}px) translateZ(15px)`;

  // Vault video scroll-scrub (currentTime), independent of the visual
  // transforms above.
  useEffect(() => {
    const video = vaultVideoRef.current;
    if (!video) return;

    let seekTimeout: ReturnType<typeof setTimeout> | undefined;

    const trySeek = () => {
      if (vaultIsSeekingRef.current || !video.duration) return;
      vaultIsSeekingRef.current = true;
      video.currentTime = vaultTargetTimeRef.current;
      clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        vaultIsSeekingRef.current = false;
      }, 200);
    };

    const onSeeked = () => {
      clearTimeout(seekTimeout);
      vaultIsSeekingRef.current = false;
      trySeek();
    };

    const onLoadedMetadata = () => {
      video.pause();
      video.currentTime = VAULT_START_TIME;
      vaultTargetTimeRef.current = VAULT_START_TIME;
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    const unsubscribe = scrollYProgress.on('change', (progress) => {
      if (!video.duration || !isHeroNearRef.current) return;
      const clamped = Math.max(0, Math.min(1, progress));
      const scrubProgress = Math.min(1, clamped / VAULT_SCRUB_END);
      vaultTargetTimeRef.current = VAULT_START_TIME + scrubProgress * (video.duration - VAULT_START_TIME);
      trySeek();
    });

    return () => {
      clearTimeout(seekTimeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      unsubscribe();
    };
  }, [scrollYProgress]);

  return (
    <div
      ref={wrapperRef}
      id="hero-cinematic-wrapper"
      className="relative"
      style={{ height: `${100 + TOTAL_EXTRA_VH}vh` }}
    >
      <section className="sticky top-0 h-screen h-[100dvh] w-full overflow-hidden bg-black">
        <motion.div
          className="relative flex h-full"
          style={{ width: `${ROW_WIDTH_VW}vw`, transform: rowTransform }}
        >
          {/* Shared background watermark: spans the full sliding row (not
              just one panel) and slides along with it, so the same
              continuous stretch of text reads as running behind Hero,
              "Meet Yureka," "We Hate Gatekeeping," and Cinematic Text
              alike. Painted first (lowest in DOM order among these
              positioned siblings, so it stacks behind them by default) --
              each panel below had its own bg-black removed so this shows
              through wherever a panel doesn't have its own opaque content.
              The left padding mirrors the Hero headline's own left edge
              (Hero's content wrapper is mx-auto/md:max-w-[60vw], inset 20vw
              by the black column masks, plus its own md:px-8) so the "Y"
              lines up right behind "Brain." Font size trimmed down from the
              original watermark's so the full 38-character word finishes
              within this container's own width instead of being clipped by
              its overflow-hidden partway through. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-full items-center overflow-hidden">
            <motion.span
              className="whitespace-nowrap pl-4 uppercase sm:pl-6 md:pl-[calc(20vw+32px)]"
              style={{
                fontFamily: '"Anton SC", sans-serif',
                fontSize: 'clamp(80px, 18vw, 320px)',
                letterSpacing: '-4px',
                lineHeight: 1,
                transform: 'translateY(50px)',
                opacity: watermarkOpacity,
                // A repeating (px-based, not %) gradient so the green/white
                // tone cycles evenly across the whole 38-character span
                // instead of fading to solid white by the end, the way a
                // single edge-to-edge gradient would on text this long.
                backgroundImage:
                  'repeating-linear-gradient(90deg, #5fae52 0px, #ffffff 300px, #5fae52 600px)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              YUUUUUUURRRRRRRREEEEEEEKKKKKKKKKAAAAAA
            </motion.span>
          </div>

          {/* Hero panel */}
          <div className="relative h-full w-screen overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.05,
              }}
            />

            <motion.div
              className="relative z-10 mx-auto flex h-full w-full flex-col px-4 pt-20 pb-8 sm:px-6 sm:pt-24 sm:pb-12 md:max-w-[60vw] md:px-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: entranceComplete ? 1 : 0 }}
              transition={{ duration: 1 }}
            >
              <div className="flex-1" />

              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-4">
                  <h1 className="whitespace-nowrap text-[clamp(40px,10vw,100px)] font-light leading-[0.95] tracking-[-0.03em] text-white">
                    <ScrambleIn text="Never Buy" delay={200} triggered={entranceComplete} />
                    <br />
                    <ScrambleIn text="BullShit" delay={500} triggered={entranceComplete} />
                  </h1>

                  <motion.p
                    className="max-w-sm text-[13px] leading-relaxed text-white/60 sm:text-[15px]"
                    initial={{ y: 25, opacity: 0 }}
                    animate={{ y: entranceComplete ? 0 : 25, opacity: entranceComplete ? 1 : 0 }}
                    transition={{ duration: 0.9, ease: [0.215, 0.61, 0.355, 1.0], delay: 0.2 }}
                  >
                    Yureka helps you find the best product at the best price, all with the
                    magic of AI that pops-up on top of your favourite shopping app. Yureka
                    gives assured Digital Gold Back and Rewards for all your purchases.
                    <br />
                    Khachinnnggggg💰
                  </motion.p>
                </div>

                <h1 className="text-left text-[clamp(40px,10vw,100px)] font-light leading-[0.95] tracking-[-0.03em] text-white md:text-right">
                  <ScrambleIn text="AI" delay={700} triggered={entranceComplete} />
                  <br />
                  <ScrambleIn text="Yureka" delay={1000} triggered={entranceComplete} />
                </h1>
              </div>
            </motion.div>
          </div>

          {/* "Meet Yureka" panel */}
          <div className="relative h-full w-screen overflow-hidden">
            <div className="relative z-10 mx-auto flex h-full w-full flex-col gap-5 px-6 pb-10 pt-28 sm:pt-32 md:max-w-[60vw]">
              <div className="flex items-baseline gap-2">
                <span
                  style={{ fontFamily: '"Playfair Display", serif' }}
                  className="text-[28px] italic font-semibold text-[#5fae52] sm:text-[36px]"
                >
                  Meet
                </span>
                <span
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  className="text-[28px] font-extrabold text-white sm:text-[36px]"
                >
                  Yureka<span className="text-[#5fae52]">.</span>
                </span>
              </div>

              <button
                type="button"
                style={{ fontFamily: 'Inter, sans-serif' }}
                className="flex w-fit items-center gap-3 rounded-full bg-white py-2.5 pl-5 pr-2.5 text-[14px] font-medium text-black"
              >
                Join Waitlist Now
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                  <i className="bi bi-arrow-right text-[14px]" />
                </span>
              </button>

              <p
                style={{ fontFamily: 'Inter, sans-serif' }}
                className="max-w-2xl text-[14px] leading-relaxed text-white/90 sm:text-[17px]"
              >
                Yureka offers you 360° Rewards and Saving ecosystem where you get more than
                700+ brands to shop from. Every time you get assured digital gold and reward
                points. No Extra Investment, Earn when you Spend. No Aesterisk, Available round
                the clock 365 days.
                <br />
                We are bringing MAGIC to REALITY
              </p>

              <div
                style={{ fontFamily: 'Inter, sans-serif' }}
                className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr_1fr]"
              >
                <PhoneBubbleMockup />

                <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a]/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <h3 className="h-12 shrink-0 overflow-hidden text-[16px] font-extrabold uppercase leading-tight text-white sm:h-14 sm:text-[18px]">
                    Shop Across <span className="text-[#5fae52]">700+</span> Brands
                  </h3>
                  <div className="mt-4 min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-[#141414]">
                    <img
                      src="/feat-card-gift.png"
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <ul className="h-[135px] shrink-0 list-inside list-disc space-y-1 overflow-hidden text-[12px] leading-relaxed text-white/60 sm:h-[150px] sm:text-[13px]">
                    <li>Quick Commerce</li>
                    <li>Fashion &amp; Apparel</li>
                    <li>Footwear</li>
                    <li>Flights &amp; Hotels</li>
                    <li>Medicines &amp; Treatments</li>
                    <li>Everything that you need in your day to day life</li>
                  </ul>

                  {/* Glass sheen: a soft diagonal highlight band, like light
                      catching a curved glass surface. */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.06) 82%, rgba(255,255,255,0) 100%)',
                      mixBlendMode: 'overlay',
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
                </div>

                <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a]/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <h3
                    style={{ fontFamily: '"Playfair Display", serif' }}
                    className="h-12 shrink-0 overflow-hidden text-[16px] italic font-semibold leading-tight text-[#5fae52] sm:h-14 sm:text-[18px]"
                  >
                    Not Just One Time Saving Or Cashback Or Reward Points
                  </h3>
                  <div className="mt-4 min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-[#141414]">
                    <img
                      src="/card-calendar.png"
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <ul className="h-[135px] shrink-0 list-inside list-disc space-y-1 overflow-hidden text-[12px] leading-relaxed text-white/60 sm:h-[150px] sm:text-[13px]">
                    <li>24 Hours a Day</li>
                    <li>7 Days a Week</li>
                    <li>365 Days a Year</li>
                  </ul>

                  {/* Glass sheen: a soft diagonal highlight band, like light
                      catching a curved glass surface. */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 18%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.06) 82%, rgba(255,255,255,0) 100%)',
                      mixBlendMode: 'overlay',
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/25" />
                </div>
              </div>
            </div>
          </div>

          {/* "We Hate Gatekeeping" panel */}
          <div className="relative h-full w-screen overflow-hidden">
            <div className="relative z-10 mx-auto flex h-full w-full items-center gap-12 px-6 md:max-w-[60vw]">
              <div className="flex-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white">
                  Yureka is your new age Ai backed SavingOs
                </p>
                <h2 className="mt-4 text-[40px] font-extrabold leading-[1.05] text-white sm:text-[56px]">
                  We Hate
                  <br />
                  <span
                    style={{ fontFamily: '"Playfair Display", serif' }}
                    className="italic font-semibold text-[#5fae52]"
                  >
                    Gatekeeping
                  </span>
                </h2>
                <p className="mt-6 max-w-md text-[14px] font-bold leading-relaxed text-white sm:text-[15px]">
                  Encash your reward points / Digital gold for new purchases, Gift Cards, Bill
                  Discounts or directly to your Bank Account. Absolute zero gatekeeping.
                  <br />
                  If you are a #Power Shopper then Yureka is for you
                </p>
              </div>

              <div className="hidden h-[60%] flex-1 md:block">
                <PhoneVaultMockup />
              </div>
            </div>
          </div>

          {/* Cinematic Text panel */}
          <div ref={cinematicPanelRef} className="relative h-full w-screen overflow-hidden">
            <div className="relative z-10 mx-auto flex h-full w-full flex-col px-6 pb-8 pt-20 sm:px-8 sm:pb-10 sm:pt-24 md:max-w-[60vw]">
              {/* Rounded, glass-morphed video card -- bounded below the
                  navbar rather than bleeding full-screen under it. */}
              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl">
                {cinematicVideoEnabled && (
                  <video
                    src={CINEMATIC_VIDEO_URL}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 z-10"
                  style={{ height: 180, background: 'linear-gradient(to bottom, #010103, transparent)' }}
                />

                <div
                  className="relative z-10 flex h-full w-full items-center justify-center"
                  style={{ perspective: 400 }}
                >
                  <motion.p
                    className="max-w-5xl select-none px-6 text-center font-sans text-[22px] font-normal leading-[1.35] tracking-[-0.02em] text-white sm:px-12 sm:text-[30px] md:text-[36px] lg:text-[42px]"
                    style={{ transform: crawlTransform, opacity: crawlOpacity }}
                  >
                    Experience the future of financial intelligence with Yureka, the premier
                    AI-native Wealth Operating System built for India's digital economy. Yureka
                    functions as a neural-AI interface that bridges the gap between daily
                    consumer behavior and automated wealth accumulation. Whether you are seeking
                    to maximize returns through gold-backed investments or build a high-fidelity
                    alternative credit profile, Yureka filters out digital noise to deliver
                    precision financial insights. Join the next evolution of fintech, where every
                    signal becomes measurable, visible, and optimized for your long-term growth.
                  </motion.p>
                </div>

                {/* Glass sheen: a soft diagonal highlight band, like light
                    catching a curved glass surface. */}
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
            </div>
          </div>
        </motion.div>

        {/* Fixed blank-column mask, matching the rest of the site's 5-column
            layout (columns 1 & 5 blank), decoupled from the sliding row so
            the seam between videos stays flush underneath. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-[20vw] bg-black md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-[20vw] bg-black md:block" />

        {/* Vault overlay: solid black mask + inset video card, sitting on
            top of everything above. Opaque through the vault's scrub+zoom,
            then fades away over the Hero zoom-out phase to reveal Hero
            underneath -- this fade IS the zoom-out-from-black transition.
            The video plays at 1:1 (no crop) through the whole scrub, then
            only zooms in afterward, into its own known last frame. */}
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black px-4"
          style={{ opacity: vaultOverlayOpacity }}
        >
          <div className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-3xl md:max-w-[60vw]">
            <motion.video
              ref={vaultVideoRef}
              src={VAULT_VIDEO_URL}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ scale: vaultVideoScale, transformOrigin: VAULT_ZOOM_ORIGIN, willChange: 'transform' }}
              muted
              playsInline
              preload="auto"
            />
          </div>
        </motion.div>
      </section>
    </div>
  );
}
