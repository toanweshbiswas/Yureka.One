import ScrollVideo from '@shared/ScrollVideo';
import GlassLayer from './GlassLayer';

const REWARDS_VIDEO_URL = '/rewards.mp4';
const GALAXY_VIDEO_URL = '/galaxy.mp4';

export function PhoneBubbleMockup() {
  return (
    <div className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-[#0a0a0a] shadow-2xl shadow-black/40 backdrop-blur-xl">
      <ScrollVideo src={GALAXY_VIDEO_URL} className="absolute inset-0 h-full w-full" />
      <GlassLayer />
    </div>
  );
}

export function PhoneVaultMockup() {
  return (
    <div className="relative flex h-full min-h-[260px] items-center justify-center overflow-hidden">
      <ScrollVideo
        src={REWARDS_VIDEO_URL}
        fit="contain"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
