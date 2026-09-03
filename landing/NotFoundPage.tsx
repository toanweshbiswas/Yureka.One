import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SEO from '@shared/SEO';

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-landing-bg flex flex-col items-center justify-center text-center px-6 selection:bg-landing-primary selection:text-landing-ink">
    <SEO
      title="Page Not Found | Yureka One"
      description="The page you are looking for does not exist or may have moved."
      robots="noindex, follow"
    />
    <span className="font-sans font-bold text-landing-primary text-xs uppercase tracking-[0.3em] mb-6">404</span>
    <h1 className="font-sans text-white text-4xl sm:text-6xl font-black mb-6 tracking-tight">
      This page doesn&apos;t exist.
    </h1>
    <p className="font-sans text-white/70 text-base md:text-lg max-w-md mb-10 leading-relaxed">
      It may have been moved or never existed. Let&apos;s get you back to earning Goldback.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-3 bg-landing-primary text-landing-ink text-base font-bold pl-7 pr-3 py-3 rounded-full hover:brightness-110 shadow-lg shadow-landing-primary/20 transition-all duration-200"
    >
      <span>Back to Home</span>
      <span className="bg-black text-white rounded-full p-2">
        <ArrowRight className="w-4 h-4 text-landing-primary" />
      </span>
    </Link>
  </div>
);

export default NotFoundPage;
