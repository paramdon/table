import React, { useState, useEffect } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { DietType } from '../types/dcc';

interface DishImageProps {
  src?: string;
  alt: string;
  dietType?: DietType;
  className?: string;
  iconSize?: number;
  grayscale?: boolean;
}

/**
 * Standard dish image + placeholder component.
 * Renders the dish photo from `imageUrl` / `image` when valid, shows a subtle loading
 * skeleton while fetching, and cleanly falls back to a culinary placeholder when empty or broken.
 */
export const DishImage: React.FC<DishImageProps> = ({
  src,
  alt,
  dietType = 'veg',
  className = 'w-full h-full',
  iconSize = 24,
  grayscale = false,
}) => {
  const cleanSrc = (src || '').trim();
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [cleanSrc]);

  const showPlaceholder = !cleanSrc || hasError;

  const placeholderBg =
    dietType === 'non-veg'
      ? 'bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 text-rose-400'
      : 'bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50 text-amber-500';

  if (showPlaceholder) {
    return (
      <div
        role="img"
        aria-label={`${alt} placeholder`}
        className={`${className} ${placeholderBg} flex flex-col items-center justify-center select-none ${
          grayscale ? 'grayscale opacity-70' : ''
        }`}
      >
        <UtensilsCrossed size={iconSize} strokeWidth={1.75} />
        <span className="text-[9px] font-bold uppercase tracking-wider mt-1 opacity-75 px-1 text-center truncate max-w-full">
          Dish
        </span>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden bg-[#F4F4F5]`}>
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#F4F4F5] via-[#E4E4E7] to-[#F4F4F5] animate-pulse flex items-center justify-center text-[#A1A1AA]"
        >
          <UtensilsCrossed size={Math.max(16, iconSize - 4)} strokeWidth={1.5} />
        </div>
      )}
      <img
        src={cleanSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${grayscale ? 'grayscale' : ''}`}
      />
    </div>
  );
};
