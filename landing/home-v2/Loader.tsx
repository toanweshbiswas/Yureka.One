import { motion, useReducedMotion } from 'framer-motion';
import YurekaBrandMark from '@shared/YurekaBrandMark';

interface LoaderProps {
  show: boolean;
}

/** Full-bleed black gate until fonts are ready — critically damped exit (Apple default). */
export default function Loader({ show }: LoaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : { type: 'spring', bounce: 0, duration: 0.45 }
      }
      style={{ pointerEvents: show ? 'auto' : 'none' }}
      aria-hidden={!show}
      aria-busy={show}
    >
      <motion.div
        animate={reduceMotion ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <YurekaBrandMark className="h-10 w-10 rounded-xl object-cover" />
      </motion.div>
    </motion.div>
  );
}
