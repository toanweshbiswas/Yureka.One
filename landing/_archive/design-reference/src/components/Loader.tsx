import { motion } from 'framer-motion';
import YurekaLogo from './YurekaLogo';

interface LoaderProps {
  show: boolean;
}

export default function Loader({ show }: LoaderProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{ pointerEvents: show ? 'auto' : 'none' }}
      aria-hidden={!show}
    >
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <YurekaLogo className="h-8 w-8 text-white" />
      </motion.div>
    </motion.div>
  );
}
