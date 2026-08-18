import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ScrambleText from './ScrambleText';
import { useSupabase } from '@shared/SupabaseProvider';
import { appUrl, goExternal, isSplitHostsEnabled } from '@shared/hosts';

// Site-wide membership CTA — routes by waitlist status so approved users
// land on the dashboard instead of restarting join.
export default function JoinWaitlistButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { currentUserStatus, user } = useSupabase();
  const [hovered, setHovered] = useState(false);

  const label =
    currentUserStatus === 'accepted' || currentUserStatus === 'admin'
      ? 'Open Dashboard'
      : currentUserStatus === 'pending' ||
          currentUserStatus === 'on-hold' ||
          currentUserStatus === 'rejected'
        ? 'Waiting Room'
        : 'Join Waitlist';

  const goApp = (path: string) => {
    if (isSplitHostsEnabled()) {
      goExternal(appUrl(path));
      return;
    }
    navigate(path);
  };

  const go = () => {
    if (currentUserStatus === 'accepted' || currentUserStatus === 'admin') {
      goApp('/dashboard');
      return;
    }
    if (
      currentUserStatus === 'pending' ||
      currentUserStatus === 'on-hold' ||
      currentUserStatus === 'rejected'
    ) {
      goApp(user ? '/waiting' : '/login');
      return;
    }
    goApp('/join-waitlist');
  };

  return (
    <motion.button
      type="button"
      onClick={go}
      onPointerDown={() => setHovered(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.03, backgroundColor: '#e2e2e6' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
      className={`inline-flex h-12 w-fit touch-manipulation items-center rounded-full bg-white px-6 font-overpass-mono text-black active:scale-[0.97] ${className}`}
      onPointerUp={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
    >
      <ScrambleText text={label} isHovered={hovered} className="text-[16px]" />
    </motion.button>
  );
}
