export type DietType = 'veg' | 'non-veg';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface PortionOption {
  id: string;
  name: string;
  priceDelta: number; // in INR
  description?: string;
}

export interface AddonOption {
  id: string;
  name: string;
  price: number; // in INR
}

export interface MenuItem {
  id: string;
  name: string;
  hindiName?: string;
  categoryId: string;
  description: string;
  price: number; // in INR
  dietType: DietType;
  difficultyLevel?: DifficultyLevel;
  image: string;
  isHero?: boolean;
  isChefsChoice?: boolean;
  isPopular?: boolean;
  isJainAvailable?: boolean;
  isHalal?: boolean;
  spiceLevel?: number; // 0: Mild, 1: Medium, 2: Spicy, 3: Fiery
  prepTimeMinutes: number;
  calories?: number;
  allergens?: string[];
  portions?: PortionOption[];
  addons?: AddonOption[];
  spiceChoices?: string[];
}

export interface Category {
  id: string;
  name: string;
  hindiName?: string;
  icon: string;
}

export interface SelectedCustomization {
  portion?: PortionOption;
  selectedSpice?: string;
  addons: AddonOption[];
  isJain?: boolean;
  specialNotes?: string;
  orderedBy?: string; // Diner name
}

export interface CartItem {
  cartItemId: string;
  item: MenuItem;
  quantity: number;
  customization: SelectedCustomization;
  itemTotal: number; // in INR
  round: number; // 1: Round 1 (Ordered), 2: Round 2 (Current Draft)
  status?: 'draft' | 'sent' | 'preparing' | 'ready' | 'served';
  placedAt?: number; // timestamp
}

export interface Diner {
  id: string;
  name: string;
  avatarColor: string;
  initials: string;
  isCurrentUser?: boolean;
}

export interface TableSession {
  tableNumber: string;
  tableName: string;
  zone: string;
  activeDiners: Diner[];
  captainName: string;
  openedAt: string;
  gstin: string;
  fssaiLic: string;
}

export type WaiterCallReason =
  | 'water'
  | 'chutney_onions'
  | 'cutlery'
  | 'plates'
  | 'finger_bowl'
  | 'bill_upi'
  | 'captain';

export interface WaiterCall {
  active: boolean;
  reason?: WaiterCallReason;
  timestamp?: number;
  etaMinutes?: number;
}
