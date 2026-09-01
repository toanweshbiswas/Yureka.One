import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

type LandingShellProps = {
  children: ReactNode;
  /** Extra classes on `<main>` (e.g. `pt-16` for fixed navbar offset). */
  mainClassName?: string;
};

/** Shared green landing chrome: Navbar (landing theme) + main + Footer. */
export default function LandingShell({ children, mainClassName = '' }: LandingShellProps) {
  return (
    <div className="yureka-one-home min-h-dvh text-landing-sub">
      <Navbar theme="landing" />
      <main className={mainClassName}>{children}</main>
      <Footer />
    </div>
  );
}
