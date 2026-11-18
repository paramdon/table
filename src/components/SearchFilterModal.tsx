import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, Flame, Clock, Leaf } from 'lucide-react';
import { MenuItem, DietType } from '../types/dining';
import { DietaryBadge, SpiceBadge, JainBadge } from './DietaryBadge';
import { formatINR } from '../utils/formatters';

interface SearchFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
}

export const SearchFilterModal: React.FC<SearchFilterModalProps> = ({
  isOpen,
  onClose,
  items,
  onSelectItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | DietType>('all');
  const [onlyJain, setOnlyJain] = useState(false);
  const [onlyChefsChoice, setOnlyChefsChoice] = useState(false);
  const [onlyPopular, setOnlyPopular] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Query filter (name, hindiName, description, allergens)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesHindi = item.hindiName ? item.hindiName.includes(searchQuery.trim()) : false;
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesAllergens = item.allergens?.some((a) => a.toLowerCase().includes(q));
        if (!matchesName && !matchesHindi && !matchesDesc && !matchesAllergens) return false;
      }

      // Diet filter
      if (dietFilter !== 'all' && item.dietType !== dietFilter) return false;

      // Jain filter
      if (onlyJain && !item.isJainAvailable) return false;

      // Chef choice
      if (onlyChefsChoice && !item.isChefsChoice) return false;

      // Popular
      if (onlyPopular && !item.isPopular) return false;

      return true;
    });
  }, [items, searchQuery, dietFilter, onlyJain, onlyChefsChoice, onlyPopular]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white w-full sm:max-w-xl max-h-[95vh] sm:max-h-[88vh] rounded-b-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-top duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Header & Search Input */}
        <div className="p-4 border-b border-[#F4F4F5] space-y-3 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-heading text-[#18181B] flex items-center gap-2">
              <Search size={18} className="text-[#F76707]" />
              Search Menu & Dietary Preferences
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#18181B] flex items-center justify-center transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes (e.g. Dal Makhani, Biryani, Naan, Tikka)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] focus:border-[#F76707] focus:bg-white focus:outline-hidden text-xs sm:text-sm text-[#18181B] transition-all placeholder:text-[#A1A1AA]"
            />
            <Search size={16} className="absolute left-3 top-3 text-[#71717A]" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-[#71717A] hover:text-[#18181B]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Dietary Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => {
                setDietFilter('all');
                setOnlyJain(false);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                dietFilter === 'all' && !onlyJain
                  ? 'bg-[#18181B] text-white shadow-2xs'
                  : 'bg-[#F4F4F5] text-[#52525B]'
              }`}
            >
              All Items
            </button>

            <button
              onClick={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                dietFilter === 'veg'
                  ? 'bg-[#16A34A] text-white shadow-2xs'
                  : 'bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              Pure Veg 🟢
            </button>

            <button
              onClick={() => setOnlyJain(!onlyJain)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                onlyJain
                  ? 'bg-[#854D0E] text-white shadow-2xs'
                  : 'bg-[#FEFCE8] text-[#854D0E] border border-[#CA8A04]/30'
              }`}
            >
              <Leaf size={11} />
              Jain Friendly
            </button>

            <button
              onClick={() => setDietFilter(dietFilter === 'non-veg' ? 'all' : 'non-veg')}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                dietFilter === 'non-veg'
                  ? 'bg-[#DC2626] text-white shadow-2xs'
                  : 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
              Non-Veg 🔴
            </button>

            <button
              onClick={() => setOnlyChefsChoice(!onlyChefsChoice)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-all ${
                onlyChefsChoice
                  ? 'bg-[#F76707] text-white shadow-2xs'
                  : 'bg-[#FFDBCC]/40 text-[#A14000] border border-[#F76707]/30'
              }`}
            >
              <Sparkles size={11} />
              Chef's Special
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          <div className="flex items-center justify-between text-xs text-[#71717A] px-1 pb-1">
            <span>
              Showing {filteredItems.length} {filteredItems.length === 1 ? 'dish' : 'dishes'}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm font-bold text-[#18181B]">No dishes found</p>
              <p className="text-xs text-[#71717A]">
                Try searching for "Butter Chicken", "Dal Bukhara", "Biryani" or clearing your dietary filters.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectItem(item);
                  onClose();
                }}
                className="p-3 rounded-xl border border-[#F4F4F5] hover:border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F4F4F5] shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <DietaryBadge dietType={item.dietType} size="sm" showLabel={false} />
                      {item.isJainAvailable && <JainBadge />}
                      {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                        <SpiceBadge level={item.spiceLevel} />
                      )}
                      <h4 className="text-xs sm:text-sm font-bold font-heading text-[#18181B] truncate">
                        {item.name}
                      </h4>
                    </div>
                    {item.hindiName && (
                      <p className="text-[10px] text-[#71717A] font-medium -mt-0.5">
                        {item.hindiName}
                      </p>
                    )}
                    <p className="text-[11px] text-[#52525B] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-extrabold font-heading text-[#18181B] tnum">
                    {formatINR(item.price)}
                  </span>
                  <div className="text-[10px] text-[#A14000] font-semibold mt-0.5">
                    Customize →
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
