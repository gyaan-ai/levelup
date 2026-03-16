'use client';

import { useState } from 'react';
import Image from 'next/image';

/**
 * Renders the brand logo. If the image fails to load (e.g. file missing in public/logos/),
 * shows text fallback so the layout doesn't show a broken image.
 */
export function BrandLogo({
  src,
  alt,
  width = 40,
  height = 40,
  className,
  textFallback = 'The Guild',
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  textFallback?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`font-serif font-bold text-accent flex items-center justify-center ${className ?? ''}`}
        style={{ width, height, minWidth: width, minHeight: height }}
      >
        {textFallback}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
