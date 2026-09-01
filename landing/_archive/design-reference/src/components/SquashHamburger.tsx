import { motion } from 'framer-motion';

interface SquashHamburgerProps {
  isOpen: boolean;
  variant?: 'desktop' | 'mobile';
  color?: string;
}

const SIZES = {
  desktop: { width: 18, height: 12, bar: 1.5 },
  mobile: { width: 15, height: 10, bar: 1.2 },
};

const spring = { type: 'spring' as const, stiffness: 300, damping: 20 };

export default function SquashHamburger({
  isOpen,
  variant = 'desktop',
  color = '#fff',
}: SquashHamburgerProps) {
  const { width, height, bar } = SIZES[variant];
  const centerOffset = height / 2 - bar / 2;

  return (
    <div style={{ position: 'relative', width, height }}>
      <motion.span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: bar,
          borderRadius: bar,
          background: color,
        }}
        initial={false}
        animate={{ top: isOpen ? centerOffset : 0, rotate: isOpen ? 45 : 0 }}
        transition={spring}
      />
      <motion.span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: centerOffset,
          height: bar,
          borderRadius: bar,
          background: color,
        }}
        initial={false}
        animate={{ opacity: isOpen ? 0 : 1, scale: isOpen ? 0 : 1 }}
        transition={spring}
      />
      <motion.span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: bar,
          borderRadius: bar,
          background: color,
        }}
        initial={false}
        animate={{ bottom: isOpen ? centerOffset : 0, rotate: isOpen ? -45 : 0 }}
        transition={spring}
      />
    </div>
  );
}
