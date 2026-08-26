import React from 'react';
import ScrollVideo from '@shared/ScrollVideo';

interface LazyVideoProps {
  src: string;
  /** Applied to the <video> element itself (e.g. object-cover/object-contain, positioning) */
  className?: string;
  poster?: string;
  /** Start loading immediately (above-fold) */
  eager?: boolean;
}

/**
 * Scroll-driven background video (kept as LazyVideo for existing imports).
 * Defers load until near viewport; plays only while in view. no autoplay attr.
 */
const LazyVideo: React.FC<LazyVideoProps> = ({
  src,
  className = '',
  poster,
  eager = false,
}) => {
  return (
    <ScrollVideo
      src={src}
      poster={poster}
      eager={eager}
      className="absolute inset-0 h-full w-full"
      videoClassName={className}
      rootMargin={eager ? '0px' : '400px 0px'}
    />
  );
};

export default LazyVideo;
