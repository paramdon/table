import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  Check,
  X,
  Search,
  Filter,
  Flame,
  Leaf,
  Clock,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Star,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { MenuItem, MenuCategory, DietType, DifficultyLevel } from '../../types/dcc';
import { formatINR } from '../../utils/formatters';
import { DietaryBadge, JainBadge, DifficultyBadge, resolveMenuItemDifficulty } from '../DietaryBadge';
import { DishImage } from '../DishImage';
import { restaurantDb } from '../../services/db';

export interface MenuManagementViewProps {
  restaurantId?: string;
  categories: MenuCategory[];
  items: MenuItem[];
  onToggleItemAvailability: (itemId: string) => void;
  onUpdateItemPrice: (itemId: string, newPrice: number) => void;
  onAddItem: (item: Partial<MenuItem>) => void;
  onEditItem?: (itemId: string, updates: Partial<MenuItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onAddCategory?: (category: { name: string; hindiName?: string; icon?: string; sortOrder?: number }) => void;
  onEditCategory?: (categoryId: string, updates: Partial<MenuCategory>) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onReorderCategories?: (orderedIds: string[]) => void;
}

export const MenuManagementView: React.FC<MenuManagementViewProps> = ({
  restaurantId,
  categories,
  items,
  onToggleItemAvailability,
  onUpdateItemPrice,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onReorderCategories,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  // Modal States
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  // Item Form Fields
  const [itemName, setItemName] = useState('');
  const [itemHindiName, setItemHindiName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemPrice, setItemPrice] = useState('250');
  const [itemDietType, setItemDietType] = useState<DietType>('veg');
  const [itemDifficultyLevel, setItemDifficultyLevel] = useState<DifficultyLevel>('Medium');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemPrepTime, setItemPrepTime] = useState('12');
  const [itemIsJain, setItemIsJain] = useState(false);
  const [itemIsBestseller, setItemIsBestseller] = useState(false);
  const [itemIsDailySpecial, setItemIsDailySpecial] = useState(false);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);

  // Category Form Fields
  const [catName, setCatName] = useState('');
  const [catHindiName, setCatHindiName] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('1');

  // Open Item Modal for Create
  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemHindiName('');
    setItemCategoryId(categories[0]?.id || '');
    setItemPrice('280');
    setItemDietType('veg');
    setItemDifficultyLevel('Medium');
    setItemDescription('Prepared fresh with aromatic spices and herbs.');
    setItemImage('');
    setItemPrepTime('12');
    setItemIsJain(false);
    setItemIsBestseller(false);
    setItemIsDailySpecial(false);
    setItemIsAvailable(true);
    setIsItemModalOpen(true);
  };

  // Open Item Modal for Edit
  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemHindiName(item.hindiName || '');
    setItemCategoryId(item.categoryId);
    setItemPrice(String(item.price));
    setItemDietType(item.dietType);
    setItemDifficultyLevel(resolveMenuItemDifficulty(item));
    setItemDescription(item.description);
    setItemImage(item.imageUrl ?? item.image ?? '');
    setItemPrepTime(String(item.prepTimeMinutes || 12));
    setItemIsJain(Boolean(item.isJainAvailable));
    setItemIsBestseller(Boolean(item.isBestseller || item.isPopular));
    setItemIsDailySpecial(Boolean(item.isDailySpecial));
    setItemIsAvailable(item.isAvailable);
    setIsItemModalOpen(true);
  };

  // Save Item (Create or Edit)
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const cleanImageUrl = itemImage.trim();

    const payload: Partial<MenuItem> = {
      restaurantId,
      name: itemName.trim(),
      hindiName: itemHindiName.trim() || undefined,
      categoryId: itemCategoryId || categories[0]?.id || '',
      price: Number(itemPrice) || 200,
      dietType: itemDietType,
      difficultyLevel: itemDifficultyLevel,
      description: itemDescription.trim(),
      image: cleanImageUrl,
      imageUrl: cleanImageUrl,
      prepTimeMinutes: Number(itemPrepTime) || 12,
      isJainAvailable: itemIsJain,
      isBestseller: itemIsBestseller,
      isPopular: itemIsBestseller,
      isDailySpecial: itemIsDailySpecial,
      isAvailable: itemIsAvailable,
    };

    if (editingItem) {
      if (onEditItem) {
        onEditItem(editingItem.id, payload);
      } else {
        restaurantDb.updateMenuItem(editingItem.id, payload);
      }
    } else {
      onAddItem(payload);
    }

    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  // Image File Upload Handler (Base64)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setItemImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Open Category Modal for Create
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatHindiName('');
    setCatSortOrder(String(categories.length + 1));
    setIsCategoryModalOpen(true);
  };

  // Open Category Modal for Edit
  const handleOpenEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatHindiName(cat.hindiName || '');
    setCatSortOrder(String(cat.sortOrder || 1));
    setIsCategoryModalOpen(true);
  };

  // Save Category
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCategory) {
      if (onEditCategory) {
        onEditCategory(editingCategory.id, {
          name: catName.trim(),
          hindiName: catHindiName.trim() || undefined,
          sortOrder: Number(catSortOrder) || 1,
        });
      } else {
        restaurantDb.updateCategory(editingCategory.id, {
          name: catName.trim(),
          hindiName: catHindiName.trim() || undefined,
          sortOrder: Number(catSortOrder) || 1,
        });
      }
    } else {
      if (onAddCategory) {
        onAddCategory({
          name: catName.trim(),
          hindiName: catHindiName.trim() || undefined,
          sortOrder: Number(catSortOrder) || categories.length + 1,
        });
      } else {
        restaurantDb.createCategory({
          restaurantId,
          name: catName.trim(),
          hindiName: catHindiName.trim() || undefined,
          sortOrder: Number(catSortOrder) || categories.length + 1,
        });
      }
    }

    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  // Category Reorder Handler (Move Up / Down)
  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= categories.length) return;

    const newOrder = [...categories];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIdx, 0, moved);

    const orderedIds = newOrder.map((c) => c.id);
    if (onReorderCategories) {
      onReorderCategories(orderedIds);
    } else {
      restaurantDb.reorderCategories(orderedIds, restaurantId);
    }
  };

  // Filter Items
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Header & Prominent Action Buttons */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold font-heading text-[#18181B]">
              Menu & Category Management
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAFAFA] border border-[#E4E4E7] text-[#52525B]">
              {items.length} Dishes • {categories.length} Categories
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Real-time dish editing, pricing updates, image uploads, and category order control.
          </p>
        </div>

        {/* Clearly Visible Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleOpenAddCategory}
            className="flex-1 md:flex-initial px-4 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-xs font-bold text-[#18181B] flex items-center justify-center gap-1.5 shadow-2xs transition-all"
          >
            <Plus size={15} className="text-[#F76707]" />
            <span>+ Add Category</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddItem}
            className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>+ Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Dishes View vs Category Order View */}
      <div className="flex items-center gap-2 border-b border-[#E4E4E7] pb-2">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold font-heading transition-all ${
            activeTab === 'items'
              ? 'bg-[#18181B] text-white shadow-xs'
              : 'text-[#71717A] hover:text-[#18181B] bg-white border border-[#E4E4E7]'
          }`}
        >
          Menu Items ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold font-heading transition-all ${
            activeTab === 'categories'
              ? 'bg-[#18181B] text-white shadow-xs'
              : 'text-[#71717A] hover:text-[#18181B] bg-white border border-[#E4E4E7]'
          }`}
        >
          Categories & Order ({categories.length})
        </button>
      </div>

      {/* ================= SECTION 1: MENU ITEMS ================= */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Category Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-[#18181B] text-white shadow-2xs'
                    : 'bg-white border border-[#E4E4E7] text-[#52525B]'
                }`}
              >
                All Categories ({items.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === c.id
                      ? 'bg-[#18181B] text-white shadow-2xs'
                      : 'bg-white border border-[#E4E4E7] text-[#52525B]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-white text-xs font-medium focus:outline-hidden"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-[#71717A]" />
            </div>
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                  item.isAvailable ? 'border-[#E4E4E7] shadow-xs' : 'border-[#E4E4E7] opacity-60 bg-[#FAFAFA]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F4F4F5] shrink-0 border border-[#E4E4E7]">
                    <DishImage
                      src={item.imageUrl ?? item.image}
                      alt={item.name}
                      dietType={item.dietType}
                      grayscale={!item.isAvailable}
                      iconSize={22}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DietaryBadge dietType={item.dietType} size="sm" showLabel={false} />
                      {item.isJainAvailable && <JainBadge />}
                      <DifficultyBadge level={item.difficultyLevel} prepTimeMinutes={item.prepTimeMinutes} size="sm" />
                      {(item.isBestseller || item.isPopular) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-0.5">
                          <Star size={10} className="fill-amber-500 text-amber-500" />
                          <span>Bestseller</span>
                        </span>
                      )}
                      {item.isDailySpecial && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-orange-50 text-[#F76707] border border-orange-200 flex items-center gap-0.5">
                          <Sparkles size={10} />
                          <span>Daily Special</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold font-heading text-[#18181B] truncate mt-1">
                      {item.name}
                    </h4>
                    {item.hindiName && (
                      <div className="text-[11px] text-[#71717A] truncate">{item.hindiName}</div>
                    )}
                    <p className="text-xs text-[#71717A] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>

                    <div className="text-sm font-extrabold font-heading text-[#F76707] mt-1 tnum">
                      {formatINR(item.price)}
                    </div>
                  </div>
                </div>

                {/* Visible Edit, Delete, Daily Special & Availability Buttons */}
                <div className="pt-2 border-t border-[#F4F4F5] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleItemAvailability(item.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        item.isAvailable
                          ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/30'
                          : 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626]/30'
                      }`}
                    >
                      {item.isAvailable ? 'In Stock' : '86’d (Out of Stock)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextSpecial = !item.isDailySpecial;
                        if (onEditItem) {
                          onEditItem(item.id, { isDailySpecial: nextSpecial });
                        } else {
                          restaurantDb.updateMenuItem(item.id, { isDailySpecial: nextSpecial });
                        }
                      }}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all border ${
                        item.isDailySpecial
                          ? 'bg-[#FFDBCC] text-[#A14000] border-[#F76707]/40 shadow-2xs'
                          : 'bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#F76707]'
                      }`}
                      title="Toggle Daily Special flag"
                    >
                      <Sparkles size={11} className={item.isDailySpecial ? 'text-[#F76707]' : 'text-[#A1A1AA]'} />
                      <span>{item.isDailySpecial ? 'Special ★' : '+ Make Special'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditItem(item)}
                      className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center gap-1 transition-all"
                    >
                      <Edit2 size={13} className="text-[#2563EB]" />
                      <span>Edit</span>
                    </button>

                    {confirmDeleteItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteItem(item.id);
                            setConfirmDeleteItemId(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItemId(null)}
                          className="px-2 py-1.5 rounded-lg border border-[#E4E4E7] text-xs font-bold text-[#71717A]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItemId(item.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION 2: CATEGORIES & ORDER ================= */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E4E4E7] shadow-xs flex items-center justify-between">
            <h3 className="text-sm font-bold font-heading text-[#18181B]">
              Category Order on Customer Menu
            </h3>
            <button
              onClick={handleOpenAddCategory}
              className="px-3 py-1.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center gap-1"
            >
              <Plus size={14} />
              <span>+ Add Category</span>
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((cat, idx) => {
              const itemCount = items.filter((i) => i.categoryId === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="bg-white p-3.5 rounded-2xl border border-[#E4E4E7] shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#18181B] text-white text-xs font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-extrabold text-sm text-[#18181B] font-heading">
                        {cat.name}
                      </div>
                      <div className="text-xs text-[#71717A]">
                        {cat.hindiName ? `${cat.hindiName} • ` : ''}
                        {itemCount} dishes assigned
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reorder Buttons */}
                    <div className="flex items-center border border-[#E4E4E7] rounded-xl overflow-hidden bg-white">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, 'up')}
                        className="p-1.5 hover:bg-[#F4F4F5] disabled:opacity-30 text-[#18181B] border-r border-[#E4E4E7]"
                        title="Move Up in Menu"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMoveCategory(idx, 'down')}
                        className="p-1.5 hover:bg-[#F4F4F5] disabled:opacity-30 text-[#18181B]"
                        title="Move Down in Menu"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="px-3 py-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center gap-1"
                    >
                      <Edit2 size={12} className="text-[#2563EB]" />
                      <span>Edit</span>
                    </button>

                    {confirmDeleteCatId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onDeleteCategory) {
                              onDeleteCategory(cat.id);
                            } else {
                              restaurantDb.deleteCategory(cat.id);
                            }
                            setConfirmDeleteCatId(null);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-red-600 text-white text-xs font-bold"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCatId(null)}
                          className="px-2 py-1 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#71717A]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCatId(cat.id)}
                        className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 border border-red-200"
                        title="Delete Category"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT MENU ITEM ================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-[#F4F4F5] flex items-center justify-between bg-[#18181B] text-white">
              <h3 className="text-base font-extrabold font-heading">
                {editingItem ? `Edit Menu Item: ${editingItem.name}` : '+ Add New Menu Item'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-[#18181B] block mb-1">
                    Dish Name (English) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Murgh Makhani Handi"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#18181B] block mb-1">Hindi Title (Optional)</label>
                  <input
                    type="text"
                    value={itemHindiName}
                    onChange={(e) => setItemHindiName(e.target.value)}
                    placeholder="मुर्ग़ मक्खनी हांडी"
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#18181B] block mb-1">
                    Price in INR (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#F76707]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#18181B] block mb-1">Category</label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs bg-white font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#18181B] block mb-1">Dietary Classification</label>
                  <select
                    value={itemDietType}
                    onChange={(e) => setItemDietType(e.target.value as DietType)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs bg-white font-bold"
                  >
                    <option value="veg">Pure Vegetarian 🟢</option>
                    <option value="non-veg">Non-Vegetarian 🔴</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-[#18181B] block mb-1">
                    Difficulty Level (Prep Complexity Badge)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Easy', 'Medium', 'Hard'] as DifficultyLevel[]).map((lvl) => {
                      const active = itemDifficultyLevel === lvl;
                      const activeStyle =
                        lvl === 'Easy'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : lvl === 'Medium'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-rose-600 text-white border-rose-600';
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setItemDifficultyLevel(lvl)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                            active
                              ? `${activeStyle} shadow-xs`
                              : 'bg-white border-[#E4E4E7] text-[#52525B] hover:border-[#18181B]'
                          }`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-[#18181B] block mb-1">Dish Description</label>
                  <textarea
                    rows={2}
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Rich and creamy tomato gravy cooked with charred tandoori chicken..."
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                  />
                </div>

                {/* Image URL & Upload */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="font-bold text-[#18181B] block">Dish Image URL (Optional — uses standard placeholder if empty)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={itemImage}
                      onChange={(e) => setItemImage(e.target.value)}
                      placeholder="https://images.unsplash.com/... (leave blank for placeholder)"
                      className="flex-1 px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                    />
                    <label className="px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] cursor-pointer flex items-center gap-1 shrink-0">
                      <Upload size={14} />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#E4E4E7] shrink-0">
                      <DishImage
                        src={itemImage}
                        alt={itemName || 'Dish preview'}
                        dietType={itemDietType}
                        iconSize={20}
                      />
                    </div>
                    <div className="text-[11px] text-[#71717A] leading-snug">
                      {itemImage.trim()
                        ? 'Live dish photo preview. Broken URLs automatically fall back to the dish placeholder.'
                        : 'No URL entered — customers will see the standard dish placeholder card.'}
                    </div>
                  </div>
                </div>

                {/* Flags: Bestseller, Jain, Availability */}
                <div className="sm:col-span-2 space-y-2 pt-2 border-t border-[#F4F4F5]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsBestseller}
                      onChange={(e) => setItemIsBestseller(e.target.checked)}
                      className="rounded text-[#F76707]"
                    />
                    <span className="font-bold text-[#18181B]">★ Mark as Bestseller / Chef's Recommendation</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsDailySpecial}
                      onChange={(e) => setItemIsDailySpecial(e.target.checked)}
                      className="rounded text-[#F76707]"
                    />
                    <span className="font-bold text-[#F76707] flex items-center gap-1">
                      <Sparkles size={13} />
                      <span>Featured Daily Special (Showcases on Customer Portal top reel today)</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsJain}
                      onChange={(e) => setItemIsJain(e.target.checked)}
                      className="rounded text-[#F76707]"
                    />
                    <span className="font-bold text-[#18181B]">Jain Option Available (No Onion / No Garlic)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsAvailable}
                      onChange={(e) => setItemIsAvailable(e.target.checked)}
                      className="rounded text-[#16A34A]"
                    />
                    <span className="font-bold text-[#18181B]">Dish is Available for Ordering (In Stock)</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons with Save Changes clearly visible */}
              <div className="pt-3 border-t border-[#F4F4F5] flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD / EDIT CATEGORY ================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#F4F4F5] flex items-center justify-between bg-[#18181B] text-white">
              <h3 className="text-base font-extrabold font-heading">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : '+ Add Category'}
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#18181B] block mb-1">
                  Category Name (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Clay Oven Starters"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] font-semibold text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-[#18181B] block mb-1">Hindi Title (Optional)</label>
                <input
                  type="text"
                  value={catHindiName}
                  onChange={(e) => setCatHindiName(e.target.value)}
                  placeholder="तंदूरी स्टार्टर्स"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-[#18181B] block mb-1">Sort Order on Menu</label>
                <input
                  type="number"
                  min="1"
                  value={catSortOrder}
                  onChange={(e) => setCatSortOrder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#71717A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
