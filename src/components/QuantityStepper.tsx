import React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  size?: 'sm' | 'md' | 'lg';
  allowDelete?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  onIncrement,
  onDecrement,
  size = 'md',
  allowDelete = false,
}) => {
  const isSm = size === 'sm';
  const buttonDim = isSm ? 'w-6 h-6' : 'w-8 h-8';
  const textSize = isSm ? 'text-xs min-w-[20px]' : 'text-sm min-w-[26px]';
  const iconSize = isSm ? 12 : 14;

  return (
    <div className="inline-flex items-center bg-[#F4F4F5] rounded-full p-0.5 border border-[#E4E4E7]/70 shadow-inner">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDecrement();
        }}
        className={`${buttonDim} flex items-center justify-center rounded-full bg-white text-[#18181B] shadow-2xs hover:bg-[#FAFAFA] active:scale-90 transition-all focus:outline-hidden`}
        aria-label="Decrease quantity"
      >
        {quantity === 1 && allowDelete ? (
          <Trash2 size={iconSize} className="text-[#DC2626]" />
        ) : (
          <Minus size={iconSize} strokeWidth={2.5} />
        )}
      </button>

      <span
        className={`${textSize} text-center font-bold font-heading text-[#18181B] tnum select-none px-1`}
      >
        {quantity}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onIncrement();
        }}
        className={`${buttonDim} flex items-center justify-center rounded-full bg-[#18181B] text-white shadow-2xs hover:bg-[#27272A] active:scale-90 transition-all focus:outline-hidden`}
        aria-label="Increase quantity"
      >
        <Plus size={iconSize} strokeWidth={2.5} />
      </button>
    </div>
  );
};
