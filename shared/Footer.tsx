import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import HomeFooter from '@landing/home-v2/Footer';
import Icon3d from '@shared/Icon3d';
import YurekaBrandMark from '@shared/YurekaBrandMark';

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-cream w-full overflow-hidden">
      {/* ── CTA Hero Band ────────────────────────────────────────────── */}
      <div className="relative min-h-[420px] md:min-h-[520px] flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
        {/* Dotted-grid starfield background */}
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 0.8px, transparent 0.8px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Glowing orb behind content */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[480px] h-[480px] rounded-full bg-white/[0.03] blur-3xl" />
        </div>

        {/* CTA Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="relative z-10 mb-8 flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.25em] text-white/60 uppercase">
            Yureka Network
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative z-10 text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-extrabold text-white text-center leading-tight tracking-tight max-w-3xl mb-6"
        >
          Join the Yureka rewards collective.
        </motion.h2>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 text-white/55 text-sm sm:text-base text-center max-w-md mb-12 leading-relaxed"
        >
          Be part of a growing community of points hackers, credit card optimizers, and premium experience seekers across India.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative z-10"
        >
          <Link
            to="/yureka-ai"
            className="group inline-flex items-center gap-3 px-8 py-4 border border-white/25 rounded-full text-white text-[11px] font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
          >
            JOIN WAITLIST
            <ArrowUpRight
              size={14}
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200"
            />
          </Link>
        </motion.div>
      </div>

      {/* ── Main Footer Card ─────────────────────────────────────────── */}
      <div className="relative z-10 mx-4 md:mx-8 mb-4 md:mb-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white/[0.05] border border-white/10 rounded-2xl md:rounded-[1.75rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          {/* Green shine accents */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-clay/60 to-transparent pointer-events-none" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[200px] bg-clay/10 blur-[100px] rounded-full pointer-events-none" />

          {/* ── Top area: logo + columns ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 px-8 md:px-10 pt-10 pb-8">
            {/* Brand column */}
            <div className="md:col-span-1 pr-0 md:pr-10 mb-10 md:mb-0 border-b md:border-b-0 md:border-r border-white/6 pb-8 md:pb-0">
              {/* Logo row */}
              <div className="flex items-center gap-2.5 mb-5">
                <YurekaBrandMark className="h-8 w-8 rounded-lg object-cover" />
                <span className="font-sans font-extrabold tracking-widest text-white text-sm">
                  YUREKA
                </span>
              </div>

              {/* Tagline */}
              <p className="text-white/40 text-[13px] leading-relaxed font-sans max-w-[220px]">
                Building the rewards copilot for modern India. Earning smarter, redeeming better, and living richer.
              </p>

              {/* System status */}
              <p className="mt-6 text-[9px] font-mono tracking-[0.18em] text-white/20 uppercase">
                SYSTEM STATUS: WAITLIST ACTIVE&nbsp;// LAUNCH PHASE 01
              </p>
            </div>

            {/* Nav columns */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-10 pl-0 md:pl-10">
              {/* PRODUCT */}
              <div>
                <h4 className="text-[9px] font-bold tracking-[0.25em] text-white/25 uppercase mb-6">
                  Product
                </h4>
                <ul className="space-y-3.5">
                  {[
                    { label: 'Blog', to: '/blog' },
                    { label: 'Chrome Extension', to: '/yureka-ai' },
                    { label: 'Yureka AI', to: '/yureka-ai' },
                    { label: 'Yureka One Telegram', to: '#' },
                    { label: 'Zwitch', to: '/zwitch' },
                  ].map(({ label, to }) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-[13px] text-white/55 hover:text-white transition-colors duration-200 font-sans"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* COMPANY */}
              <div>
                <h4 className="text-[9px] font-bold tracking-[0.25em] text-white/25 uppercase mb-6">
                  Company
                </h4>
                <ul className="space-y-3.5">
                  {[
                    { label: 'About', to: '/about' },
                    { label: 'Manifesto', to: '/manifesto' },
                    { label: 'Careers', to: '/jobs' },
                    { label: 'Contact', to: '/contact' },
                  ].map(({ label, to }) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-[13px] text-white/55 hover:text-white transition-colors duration-200 font-sans"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RESOURCES */}
              <div>
                <h4 className="text-[9px] font-bold tracking-[0.25em] text-white/25 uppercase mb-6">
                  Resources
                </h4>
                <ul className="space-y-3.5">
                  {[
                    { label: 'FAQ', to: '/faq' },
                    { label: 'Get Started', to: '/login' },
                    // { label: 'Waitlist', to: '/join-waitlist' },
                    { label: 'Privacy Policy', to: '/privacy-policy' },
                    { label: 'Terms of Service', to: '/terms-of-service' },
                  ].map(({ label, to }) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="text-[13px] text-white/55 hover:text-white transition-colors duration-200 font-sans"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Separator ───────────────────────────────────────── */}
          <div className="mx-8 md:mx-10 border-t border-white/[0.06]" />

          {/* ── Bottom bar: credits + social ────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 px-8 md:px-10 py-5">
            {/* Credits */}
            <p className="text-[10px] font-mono tracking-[0.18em] text-white/20 uppercase text-center sm:text-left">
              Designed and Developed by Yureka Labs&nbsp;//&nbsp;© 2026 Yureka Co
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-2.5">
              {[
                { icon: 'camera', label: 'Instagram', href: 'https://www.instagram.com/yurekaone' },
                { icon: 'megaphone', label: 'Twitter', href: 'https://twitter.com/yurekaone' },
                { icon: 'heart', label: 'LinkedIn', href: 'https://www.linkedin.com/company/yurekaone' },
                { icon: 'computer', label: 'Website', href: 'https://yureka.one' },
              ].map(({ icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center hover:border-white/25 hover:bg-white/8 transition-all duration-200"
                >
                  <Icon3d name={icon} className="h-4 w-4 object-contain" alt="" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Benjamin Franklin Card Footer (same as homepage) ── */}
      <div className="relative z-10 w-full mb-6">
        <HomeFooter />
      </div>
    </footer>
  );
};

export default Footer;
