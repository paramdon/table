import React from 'react';
import { DietType, DifficultyLevel } from '../types/dining';

interface DietaryBadgeProps {
  dietType: DietType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const DietaryBadge: React.FC<DietaryBadgeProps> = ({
  dietType,
  showLabel = true,
  size = 'md',
}) => {
  const isVeg = dietType === 'veg';
  const boxDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const shapeDim = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  if (isVeg) {
    return (
      <div className="inline-flex items-center gap-1.5">
        {/* FSSAI Vegetarian Green Outline Box with Green Filled Circle */}
        <div
          className={`${boxDim} border-1.5 border-[#16A34A] rounded-xs flex items-center justify-center bg-white shadow-2xs shrink-0`}
          title="Pure Vegetarian (FSSAI Certified)"
        >
          <div className={`${shapeDim} rounded-full bg-[#16A34A]`} />
        </div>
        {showLabel && (
          <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] leading-none border border-[#16A34A]/25">
            VEG
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* FSSAI Non-Vegetarian Red Outline Box with Red Filled Triangle */}
      <div
        className={`${boxDim} border-1.5 border-[#DC2626] rounded-xs flex items-center justify-center bg-white shadow-2xs shrink-0`}
        title="Non-Vegetarian (FSSAI Certified)"
      >
        <div
          className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-[#DC2626]"
        />
      </div>
      {showLabel && (
        <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] leading-none border border-[#DC2626]/25">
          NON-VEG
        </span>
      )}
    </div>
  );
};

export const JainBadge: React.FC = () => {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#FEFCE8] text-[#854D0E] text-[10px] font-bold tracking-tight border border-[#FE0000]/20"
      title="Jain preparation available: No onion, no garlic, no root vegetables"
    >
      JAIN OK
    </span>
  );
};

export const HalalBadge: React.FC = () => {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] text-[10px] font-bold tracking-tight border border-[#16A34A]/20"
      title="100% Halal Certified Meat"
    >
      HALAL
    </span>
  );
};

export const SpiceBadge: React.FC<{ level: number }> = ({ level }) => {
  if (!level || level <= 0) return null;
  return (
    <div
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[10px] font-semibold border border-[#DC2626]/20"
      title={`Spiciness Level: ${level}/3`}
    >
      <span>🌶️</span>
      {level > 1 && (
        <span className="font-bold text-[9px]">
          {level === 2 ? 'Medium' : 'Teekha'}
        </span>
      )}
    </div>
  );
};

export function normalizeDifficultyLevel(value?: string | null): DifficultyLevel | undefined {
  if (!value) return undefined;
  const norm = value.trim().toLowerCase();
  if (norm === 'easy') return 'Easy';
  if (norm === 'medium') return 'Medium';
  if (norm === 'hard') return 'Hard';
  return undefined;
}

export function resolveMenuItemDifficulty(item: {
  difficultyLevel?: DifficultyLevel | string;
  prepTimeMinutes?: number;
}): DifficultyLevel {
  const explicit = normalizeDifficultyLevel(item.difficultyLevel);
  if (explicit) return explicit;
  const prep = Number(item.prepTimeMinutes) || 12;
  if (prep >= 16) return 'Hard';
  if (prep >= 10) return 'Medium';
  return 'Easy';
}

export const DifficultyBadge: React.FC<{
  level?: DifficultyLevel | string;
  prepTimeMinutes?: number;
  size?: 'xs' | 'sm';
}> = ({ level, prepTimeMinutes, size = 'xs' }) => {
  const resolved = resolveMenuItemDifficulty({ difficultyLevel: level, prepTimeMinutes });

  const styles =
    resolved === 'Easy'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : resolved === 'Medium'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

  const dotColor =
    resolved === 'Easy'
      ? 'bg-emerald-500'
      : resolved === 'Medium'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const sizeClass =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tracking-tight border leading-none shrink-0 ${styles} ${sizeClass}`}
      title={`Preparation Complexity: ${resolved}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span>{resolved}</span>
    </span>
  );
};

export const AllergenPill: React.FC<{ label: string }> = ({ label }) => {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B] text-[11px] font-medium tracking-tight">
      {label}
    </span>
  );
};
