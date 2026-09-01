import { useInView } from '../hooks/useInView';

const REWARDS_VIDEO_URL = '/rewards.mp4';
const GALAXY_VIDEO_URL = '/galaxy.mov';

export function PhoneBubbleMockup() {
  const { ref, inView } = useInView<HTMLDivElement>('600px');

  return (
    <div
      ref={ref}
      className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]"
    >
      {inView && (
        <video
          src={REWARDS_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function PhoneVaultMockup() {
  const { ref, inView } = useInView<HTMLDivElement>('600px');

  return (
    <div
      ref={ref}
      className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden rounded-2xl bg-[#0a0a0a]"
    >
      {inView && (
        <video
          src={GALAXY_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
    </div>
  );
}
