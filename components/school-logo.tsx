'use client';

import { useState } from 'react';
import Image from 'next/image';
import { getSchoolLogoUrl } from '@/lib/school-logos';

interface SchoolLogoProps {
  school: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 40,
};

export function SchoolLogo({ school, size = 'md', className = '' }: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoUrl = getSchoolLogoUrl(school);

  if (!logoUrl || failed) return null;

  const px = sizeMap[size];

  return (
    <Image
      src={logoUrl}
      alt={`${school} logo`}
      width={px}
      height={px}
      className={`object-contain flex-shrink-0 ${className}`}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
