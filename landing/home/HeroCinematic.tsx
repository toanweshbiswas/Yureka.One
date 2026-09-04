import { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import ScrambleIn from './ScrambleIn';
import { PhoneBubbleMockup, PhoneVaultMockup } from './YurekaMockups';
import GlassLayer from './GlassLayer';
import JoinWaitlistButton from './JoinWaitlistButton';
import { useVideoScrub } from './useVideoScrub';
import { landingBody, landingCaption } from './landingLayout';

// Desktop-only cinematic (vault scrub → hero → panels → crawl).
// Mobile mounts HeroMobile from MainPage instead. this pin scrub is not
// usable on touch and was the main responsive/video failure on phones.

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
const VAULT_ZOOM_VH = 50; // phase 1: zoom into the vault (kept short. long holds read as a dead black screen)
const HERO_ZOOM_OUT_VH = 55; // phase 2: vault overlay fades away, revealing the Hero panel
const SLIDE_VH = 140; // phase 3: Hero exits left, Yureka panels, Cinematic Video enters
const HOLD_VH = 40; // phase 4: hold on the video card before releasing pin
const TOTAL_EXTRA_VH =
  VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH + SLIDE_VH + HOLD_VH;

const VAULT_SCRUB_END = VAULT_SCRUB_VH / TOTAL_EXTRA_VH;
const VAULT_ZOOM_END = (VAULT_SCRUB_VH + VAULT_ZOOM_VH) / TOTAL_EXTRA_VH;
const HERO_ZOOM_OUT_END =
  (VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH) / TOTAL_EXTRA_VH;
const SLIDE_END =
  (VAULT_SCRUB_VH + VAULT_ZOOM_VH + HERO_ZOOM_OUT_VH + SLIDE_VH) / TOTAL_EXTRA_VH;

// Begin dissolving the vault overlay mid-zoom so we never park on a solid
// black frame between zoom-complete and hero-reveal.
const VAULT_FADE_START =
  (VAULT_SCRUB_VH + VAULT_ZOOM_VH * 0.35) / TOTAL_EXTRA_VH;

// Position of the vault's dark screen within its frame at the moment the
// scrub finishes (its last frame), measured by sampling that exact frame
// and correcting for object-cover's horizontal crop against the card's
// 16:10 box. The zoom below only ever runs after the scrub completes, so
// it's always zooming into this same, known composition -- unlike a zoom
// applied across the whole scrub, which would crop whatever frame happened
// to be playing at the time.
const VAULT_ZOOM_ORIGIN = '49% 53%';

// Two full readable panels sit between Hero and Cinematic Video in the
// sliding row, so the slide reads as: Hero exits left, "Meet Yureka" and
// "We Hate Gatekeeping" pass through, then Cinematic Video arrives from
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
  const cinematicPanelRef = useRef<HTMLDivElement>(null);

  const [cinematicVideoEnabled, setCinematicVideoEnabled] = useState(false);

  // The Cinematic Video panel is the last of four in the sliding row --
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
  // Critically damped chrome spring. slower settle so ProMotion doesn't feel frantic.
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 170,
    damping: 32,
    mass: 1,
  });

  // Phase 1: zoom into the vault, only once the scrub is done. Raw
  // (unsmoothed) progress so the zoom tracks the scroll 1:1 -- clamped to
  // 0 for all of phase 0, so the video holds at scale 1 (full frame, no
  // crop) for the entire scrub, then ramps up only here.
  const vaultZoomProgress = useTransform(scrollYProgress, [VAULT_SCRUB_END, VAULT_ZOOM_END], [0, 1]);
  // Cap the zoom so the last frames still carry image detail. scale 20
  // overshoots into pure black and creates a dead patch before the fade.
  const vaultVideoScale = useTransform(vaultZoomProgress, [0, 1], [1, 8]);

  // Phase 2: vault overlay dissolves into Hero. Driven off RAW scroll
  // (not the spring) so spring lag can't leave a solid black hold after
  // the zoom finishes. Fade starts mid-zoom and finishes at HERO_ZOOM_OUT_END.
  const vaultOverlayOpacity = useTransform(
    scrollYProgress,
    [VAULT_FADE_START, HERO_ZOOM_OUT_END],
    [1, 0],
  );

  // Framer's scroll-linked opacity style can desync from its own computed
  // value on fast/flick scrolling (the inline style occasionally never
  // receives the final "0" write and stays stuck opaque), which blacked out
  // the rest of the pinned sequence. Once the fade is done, hard-remove the
  // overlay via React state instead of trusting the style commit to stay at 0.
  const [vaultVisible, setVaultVisible] = useState(true);
  useEffect(() => {
    return scrollYProgress.on('change', (v) => {
      setVaultVisible((prev) => {
        const next = v < HERO_ZOOM_OUT_END;
        return prev === next ? prev : next;
      });
    });
  }, [scrollYProgress]);

  // Watermark can stay sprung. it's decorative and benefits from weight.
  const heroZoomOutProgress = useTransform(smoothProgress, [VAULT_FADE_START, HERO_ZOOM_OUT_END], [0, 1]);
  const watermarkOpacity = useTransform(heroZoomOutProgress, [0, 1], [0, 0.4]);

  // Phase 3: Hero slides left, past the blank black panel, and Cinematic
  // Video slides in from the right.
  const rowX = useTransform(smoothProgress, [HERO_ZOOM_OUT_END, SLIDE_END], [0, ROW_END_X]);
  const rowTransform = useMotionTemplate`translateX(${rowX}vw)`;

  // Vault scrub: 1:1 with raw scroll (direct manipulation). Never spring the
  // media time. spring lag reads as a dropped refresh rate.
  const mapVaultTime = useCallback((progress: number, duration: number) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const scrubProgress = Math.min(1, clamped / VAULT_SCRUB_END);
    return VAULT_START_TIME + scrubProgress * (duration - VAULT_START_TIME);
  }, []);

  useVideoScrub({
    videoRef: vaultVideoRef,
    scrollProgress: scrollYProgress,
    mapTime: mapVaultTime,
    activeRef: isHeroNearRef,
  });

  useEffect(() => {
    const video = vaultVideoRef.current;
    if (!video) return;
    const initVideo = () => {
      if (
        video.duration &&
        Math.abs(video.currentTime - VAULT_START_TIME) > 0.1 &&
        scrollYProgress.get() === 0
      ) {
        try {
          video.currentTime = VAULT_START_TIME;
        } catch {
          /* ignore */
        }
      }
    };
    video.addEventListener('loadedmetadata', initVideo);
    video.addEventListener('canplay', initVideo);
    if (video.readyState >= 1) initVideo();
    return () => {
      video.removeEventListener('loadedmetadata', initVideo);
      video.removeEventListener('canplay', initVideo);
    };
  }, [scrollYProgress]);

  // All devices render the cinematic below.

  return (
    <div
      ref={wrapperRef}
      id="hero-cinematic-wrapper"
      className="relative"
      style={{ height: `${100 + TOTAL_EXTRA_VH}vh` }}
    >
      <section className="sticky top-0 h-screen h-[100dvh] w-full overflow-hidden bg-landing-bg">
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
              each panel below had its own bg-landing-bg removed so this shows
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
                  'repeating-linear-gradient(90deg, #def46e 0px, var(--landing-sub) 300px, #def46e 600px)',
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
                backgroundImage: 'radial-gradient(var(--landing-sub) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.05,
              }}
            />

            <motion.div
              className="relative z-10 mx-auto flex h-full w-full flex-col px-5 pb-8 pt-20 sm:px-6 sm:pt-24 sm:pb-12 md:max-w-[60vw]"
              initial={{ opacity: 0 }}
              animate={{ opacity: entranceComplete ? 1 : 0 }}
              transition={{ duration: 1 }}
            >
              <div className="flex-1" />

              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-4">
                  <h1 className="whitespace-nowrap text-[clamp(40px,10vw,100px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-sub">
                    <ScrambleIn text="Never Buy" delay={200} triggered={entranceComplete} />
                    <br />
                    <ScrambleIn text="BullShit" delay={500} triggered={entranceComplete} />
                  </h1>

                  <motion.p
                    className="max-w-sm text-[13px] leading-relaxed text-landing-primary sm:text-[15px]"
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

                <h1 className="text-left text-[clamp(40px,10vw,100px)] font-light leading-[0.95] tracking-[-0.03em] text-landing-sub md:text-right">
                  <ScrambleIn text="AI" delay={700} triggered={entranceComplete} />
                  <br />
                  <ScrambleIn text="Yureka" delay={1000} triggered={entranceComplete} />
                </h1>
              </div>
            </motion.div>
          </div>

          {/* "Meet Yureka" panel */}
          <div className="relative h-full w-screen overflow-hidden">
            <div className="relative z-10 mx-auto flex h-full w-full flex-col justify-center gap-3 lg:gap-4 px-6 py-16 sm:py-20 md:max-w-[64vw]">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-cooper text-[30px] sm:text-[40px] text-landing-primary pr-1"
                >
                  Meet
                </span>
                <span
                  className="font-sans text-[26px] font-black tracking-tight text-landing-primary sm:text-[36px]"
                >
                  Yureka<span className="text-landing-primary">.</span>
                </span>
              </div>

              <JoinWaitlistButton />

              <p
                className={`max-w-2xl text-[13px] sm:text-[14px] leading-relaxed ${landingBody}`}
              >
                Yureka offers you 360° Rewards and Saving ecosystem where you get more than
                700+ brands to shop from. Every time you get assured digital gold and reward
                points. No Extra Investment, Earn when you Spend. No Asterisk, Available round
                the clock 365 days.
                <br />
                We are bringing MAGIC to REALITY
              </p>

              <div
                className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr_1fr]"
              >
                <PhoneBubbleMockup />

                {/* Hide extra cards on mobile. PhoneBubbleMockup fills
                    the flex-1 space; cards would overflow the 100dvh panel. */}
                <div className="hidden md:flex relative flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-landing-ink/80 p-4 lg:p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <div>
                    <h3 className="text-[14px] lg:text-[16px] font-extrabold uppercase leading-snug text-landing-primary">
                      Shop Across <span className="font-cooper text-[18px] lg:text-[20px] text-landing-primary">700+</span> Brands
                    </h3>
                    <div className="relative my-2.5 h-32 sm:h-36 lg:h-44 w-full shrink-0 overflow-hidden rounded-xl bg-black/40 p-1.5">
                      <img
                        src="/feat-card-gift.png"
                        alt="Shop across 700+ brands"
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                      <GlassLayer />
                    </div>
                  </div>
                  <ul className={`list-inside list-disc space-y-0.5 text-[11px] lg:text-[12px] leading-snug ${landingCaption}`}>
                    <li>Quick Commerce</li>
                    <li>Fashion &amp; Apparel</li>
                    <li>Footwear</li>
                    <li>Flights &amp; Hotels</li>
                    <li>Medicines &amp; Treatments</li>
                    <li>Everything you need in your day to day life</li>
                  </ul>
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

                <div className="hidden md:flex relative flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-landing-ink/80 p-4 lg:p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                  <div>
                    <h3
                      className="font-cooper text-[15px] lg:text-[17px] leading-snug text-landing-primary"
                    >
                      Not Just One Time Saving Or Cashback Or Reward Points
                    </h3>
                    <div className="relative my-2.5 h-32 sm:h-36 lg:h-44 w-full shrink-0 overflow-hidden rounded-xl bg-black/40 p-1.5">
                      <img
                        src="/card-calendar.png"
                        alt="Not just one time savings"
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                      <GlassLayer />
                    </div>
                  </div>
                  <ul className={`list-inside list-disc space-y-0.5 text-[11px] lg:text-[12px] leading-snug ${landingCaption}`}>
                    <li>24 Hours a Day</li>
                    <li>7 Days a Week</li>
                    <li>365 Days a Year</li>
                  </ul>
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
              <div className="flex-1">
                <p className={`text-[12px] font-bold uppercase tracking-[0.2em] text-landing-sub`}>
                  Yureka is your new age Ai backed SavingOs
                </p>
                <h2 className="mt-4 text-[42px] font-extrabold leading-[1.05] text-landing-primary sm:text-[58px]">
                  We Hate
                  <br />
                  <span
                    className="font-cooper text-[46px] sm:text-[64px] text-landing-primary"
                  >
                    Gatekeeping
                  </span>
                </h2>
                <p className={`mt-6 max-w-md text-[14px] font-bold sm:text-[15px] ${landingBody}`}>
                  Encash your reward points / Digital gold for new purchases, Gift Cards, Bill
                  Discounts or directly to your Bank Account. Absolute zero gatekeeping.
                  <br />
                  If you are a #Power Shopper then Yureka is for you
                </p>
                <JoinWaitlistButton className="mt-8" />
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
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onCanPlay={(e) => {
                      // Scroll/intersection gated via cinematicVideoEnabled. no autoplay attr
                      const p = e.currentTarget.play();
                      if (p) p.catch(() => {});
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

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

        {/* Fixed side gutters — desktop only (20vw each side of the 60vw content column). */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-[20vw] bg-landing-bg md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-[20vw] bg-landing-bg md:block" />

        {/* Vault overlay: green field + centered vault video in the 60vw column.
            Hard-removed via vaultVisible once its fade-out finishes -- the
            scroll-linked opacity style can occasionally get stuck instead of
            settling at 0 on fast/flick scrolling, which blacked out every
            phase after it. React unmount is the reliable way to guarantee it
            stays gone (it remounts if the user scrolls back up). */}
        {vaultVisible && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-landing-bg px-4 md:px-0"
            style={{ opacity: vaultOverlayOpacity }}
          >
            <div
              className="relative h-full w-full overflow-hidden md:h-auto md:w-[min(60vw,calc((100dvh-5.5rem-env(safe-area-inset-top,0px))*1.6))] md:max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px))] md:aspect-[16/10] md:rounded-3xl md:border md:border-white/10"
            >
              <motion.video
                ref={vaultVideoRef}
                src={VAULT_VIDEO_URL}
                poster="/vault-poster.jpg"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ scale: vaultVideoScale, transformOrigin: VAULT_ZOOM_ORIGIN, willChange: 'transform' }}
                muted
                playsInline
                preload="auto"
                onLoadedData={(e) => {
                  // Seed first frame so the card never sits black while scrub waits.
                  try {
                    if (Math.abs(e.currentTarget.currentTime - VAULT_START_TIME) > 0.15) {
                      e.currentTarget.currentTime = VAULT_START_TIME;
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                onError={(e) => {
                  e.currentTarget.style.opacity = '0';
                }}
              />
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
