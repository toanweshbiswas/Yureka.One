import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SEO from '@shared/SEO';

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-cream flex flex-col items-center justify-center text-center px-6">
    <SEO
      title="Page Not Found | Yureka One"
      description="The page you are looking for does not exist or may have moved."
      robots="noindex, follow"
    />
    <span className="font-overpass-mono text-clay text-xs uppercase tracking-[0.4em] mb-6">404</span>
    <h1 className="font-cirka text-white text-4xl sm:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
      This page doesn't exist.
    </h1>
    <p className="font-overpass-mono text-white/60 text-base md:text-lg max-w-md mb-10">
      It may have been moved or never existed. Let&apos;s get you back to earning Goldback.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-3 bg-white text-black text-base font-medium pl-7 pr-2 py-2 rounded-full hover:bg-zinc-100 transition-colors duration-200"
    >
      <span>Back to Home</span>
      <span className="bg-black rounded-full p-2">
        <ArrowRight className="w-4 h-4 text-white" />
      </span>
    </Link>
  </div>
);

export default NotFoundPage;
