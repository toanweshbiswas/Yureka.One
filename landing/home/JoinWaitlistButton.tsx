import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ScrambleText from './ScrambleText';
import { useSupabase } from '@shared/SupabaseProvider';
import { appUrl, goExternal, isSplitHostsEnabled } from '@shared/hosts';
import { WAITLIST_REQUIRED } from '@shared/waitlistGate';

// Site-wide membership CTA. open onboard by default; waitlist only when gated.
export default function JoinWaitlistButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { currentUserStatus, user } = useSupabase();
  const [hovered, setHovered] = useState(false);

  const open =
    currentUserStatus === 'accepted' ||
    currentUserStatus === 'admin' ||
    (!WAITLIST_REQUIRED && !!user);

  const waiting =
    WAITLIST_REQUIRED &&
    (currentUserStatus === 'pending' ||
      currentUserStatus === 'on-hold' ||
      currentUserStatus === 'rejected');

  const label = open
    ? 'Open Dashboard'
    : waiting
      ? 'Waiting Room'
      : WAITLIST_REQUIRED
        ? 'Join Waitlist'
        : 'Get Started';

  const goApp = (path: string) => {
    if (isSplitHostsEnabled()) {
      goExternal(appUrl(path));
      return;
    }
    navigate(path);
  };

  const go = () => {
    if (open) {
      goApp('/dashboard');
      return;
    }
    if (waiting) {
      goApp(user ? '/waiting' : '/login');
      return;
    }
    goApp(WAITLIST_REQUIRED ? '/join-waitlist' : '/login');
  };

  return (
    <motion.button
      type="button"
      onClick={go}
      onPointerDown={() => setHovered(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.03, backgroundColor: '#c9de55' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      className={`inline-flex h-12 w-fit touch-manipulation items-center rounded-full bg-landing-primary px-6 font-overpass-mono text-landing-ink active:scale-[0.97] ${className}`}
      onPointerUp={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
    >
      <ScrambleText text={label} isHovered={hovered} className="text-[16px]" />
    </motion.button>
  );
}
