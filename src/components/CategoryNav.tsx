import React, { useRef } from 'react';
import { Category } from '../types/dining';

interface CategoryNavProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
}

export const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSelect = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    onSelectCategory(id);
    e.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  return (
    <nav className="sticky top-[53px] z-20 bg-white/95 backdrop-blur-md border-b border-[#F4F4F5] py-2.5 px-4 shadow-2xs">
      <div
        ref={scrollContainerRef}
        className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={(e) => handleSelect(cat.id, e)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold font-heading tracking-tight transition-all duration-200 select-none shrink-0 ${
                isActive
                  ? 'bg-[#18181B] text-white shadow-xs scale-[1.02]'
                  : 'bg-white text-[#71717A] border border-[#E4E4E7] hover:text-[#18181B] hover:border-[#D4D4D8]'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
