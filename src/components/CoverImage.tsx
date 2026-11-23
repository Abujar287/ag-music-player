import React, { useEffect, useState } from 'react';

interface CoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}

export const CoverImage: React.FC<CoverImageProps> = ({ src, alt, className, fallback }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
