import React, { useState, useEffect, useMemo } from 'react';
import {
  Utensils,
  Sparkles,
  Flame,
  Clock,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Bell,
  Heart,
  QrCode,
  Users,
  Search,
  Wifi,
  Send,
  CreditCard,
  Trash2,
  Edit2,
  Receipt,
  Leaf,
  Plus,
  RefreshCw,
  ChefHat,
  Star,
  History,
  RotateCcw,
  Radio,
  AlertTriangle,
  Award,
  User,
  Mic,
  MicOff,
  X,
  Copy,
  Check,
  ShoppingBag,
} from 'lucide-react';
import {
  MenuItem,
  OrderItem,
  Order,
  RestaurantTable,
  RestaurantTenant,
  SelectedCustomization,
  DietType,
  CustomerProfile,
  OrderReadyWsAlert,
  LowInventoryAlert,
  GuestDiningReceipt,
} from '../../types/dcc';
import { formatINR } from '../../utils/formatters';
import { realtimeWs } from '../../services/websocket';
import {
  DietaryBadge,
  JainBadge,
  SpiceBadge,
  AllergenPill,
  DifficultyBadge,
  resolveMenuItemDifficulty,
} from '../DietaryBadge';
import { DishImage } from '../DishImage';
import { QuantityStepper } from '../QuantityStepper';
import { CustomizationModal } from '../CustomizationModal';
import { BillSplitModal } from '../BillSplitModal';
import { CallWaiterModal } from '../CallWaiterModal';
import { restaurantDb } from '../../services/db';
import { useRealtimeSync } from '../../context/RealtimeSyncContext';

interface CustomerQrViewProps {
  restaurant: RestaurantTenant;
  table: RestaurantTable;
  menuItems: MenuItem[];
  categories: any[];
  activeOrder?: Order;
  onPlaceOrder: (items: OrderItem[], dinerName: string) => Order | void;
  onCallWaiter: (reason: any) => void;
  onCancelWaiter: () => void;
  waiterCallActive: boolean;
  onSettleBill: (paymentMethod: any) => void;
  initialCustomer?: CustomerProfile | null;
  lowInventoryAlerts?: LowInventoryAlert[];
  soldOutItemIds?: string[];
}

export const CustomerQrView: React.FC<CustomerQrViewProps> = ({
  restaurant,
  table,
  menuItems,
  categories,
  activeOrder,
  onPlaceOrder,
  onCallWaiter,
  onCancelWaiter,
  waiterCallActive,
  onSettleBill,
  initialCustomer,
  lowInventoryAlerts: propInventoryAlerts,
  soldOutItemIds: propSoldOutIds,
}) => {
  const [activePortalTab, setActivePortalTab] = useState<'menu' | 'past_orders' | 'profile'>('menu');
  const [profileSubTab, setProfileSubTab] = useState<'loyalty' | 'dining_history'>('loyalty');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'paid'>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<GuestDiningReceipt | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState('cat-featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | DietType>('all');
  const [onlyJain, setOnlyJain] = useState(false);

  // Voice-to-text search state
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscriptPreview, setVoiceTranscriptPreview] = useState('');
  const speechRecognitionRef = React.useRef<any>(null);
  const isSpeechRecognitionSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch (err) {}
      }
    };
  }, []);

  const handleToggleVoiceSearch = () => {
    if (isVoiceListening && speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (err) {}
      setIsVoiceListening(false);
      setVoiceTranscriptPreview('');
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecCtor) {
      setVoiceError(
        'Voice search is not supported in this browser. Try Chrome, Edge, or Safari, or type a dish name.'
      );
      return;
    }

    setVoiceError(null);
    setVoiceTranscriptPreview('');

    try {
      const recognition = new SpeechRecCtor();
      speechRecognitionRef.current = recognition;
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }
        const rawCombined = (finalTranscript || interimTranscript)
          .replace(/[.,!?]+$/g, '')
          .trim();
        setVoiceTranscriptPreview(rawCombined);
        if (rawCombined) {
          setSearchQuery(rawCombined);
          if (activeCategoryId !== 'cat-featured') {
            setActiveCategoryId('cat-featured');
          }
        }
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setVoiceError('Microphone access was blocked. Allow mic permission in browser settings to use voice search.');
        } else if (errCode === 'no-speech') {
          setVoiceError('No speech detected. Tap the microphone icon and say a dish name clearly.');
        } else if (errCode === 'audio-capture') {
          setVoiceError('No microphone detected on this device.');
        } else if (errCode !== 'aborted') {
          setVoiceError('Voice recognition could not complete. Please try again or type your search.');
        }
        setIsVoiceListening(false);
        setVoiceTranscriptPreview('');
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
        setVoiceTranscriptPreview('');
      };

      recognition.start();
    } catch (err) {
      setIsVoiceListening(false);
      setVoiceError('Could not start microphone listening. Please try again.');
    }
  };

  const {
    syncCartAction,
    getTableCart,
    getOrdersForTable,
    getLowInventoryAlerts,
    getSoldOutItemIds,
    getCustomerLoyalty,
    awardLoyaltyPointsForOrder,
    recordGuestDiningReceipt,
    getGuestDiningHistory,
    emitOrderEvent,
    connectionStatus,
  } = useRealtimeSync();
  const pastTableOrders = getOrdersForTable(restaurant.id, table.number);

  const contextInventoryAlerts = getLowInventoryAlerts(restaurant.id);
  const effectiveInventoryAlerts =
    propInventoryAlerts && propInventoryAlerts.length > 0
      ? propInventoryAlerts
      : contextInventoryAlerts;
  const soldOutIdSet = useMemo(() => {
    const ids = new Set<string>(propSoldOutIds || getSoldOutItemIds(restaurant.id));
    menuItems.forEach((m) => {
      if (!m.isAvailable || m.stockStatus === 'sold_out') {
        ids.add(m.id);
      }
    });
    return ids;
  }, [propSoldOutIds, getSoldOutItemIds, restaurant.id, menuItems]);

  const lowStockIdSet = useMemo(() => {
    const ids = new Set<string>();
    effectiveInventoryAlerts.forEach((a) => {
      if (a.stockStatus === 'low_stock' && a.isAvailable) ids.add(a.itemId);
    });
    menuItems.forEach((m) => {
      if (m.isAvailable && m.stockStatus === 'low_stock') ids.add(m.id);
    });
    return ids;
  }, [effectiveInventoryAlerts, menuItems]);

  const isDishSoldOut = (item: MenuItem) =>
    !item.isAvailable || item.stockStatus === 'sold_out' || soldOutIdSet.has(item.id);

  const isDishLowStock = (item: MenuItem) =>
    !isDishSoldOut(item) && (item.stockStatus === 'low_stock' || lowStockIdSet.has(item.id));

  // Cart draft hydrated from RealtimeSyncContext localStorage
  const [cart, setCart] = useState<OrderItem[]>(() => getTableCart(restaurant.id, table.number));
  const soldOutInCartItems = useMemo(
    () => cart.filter((c) => soldOutIdSet.has(c.menuItemId)),
    [cart, soldOutIdSet]
  );
  const cartSessionKey = `${restaurant.id}:${table.number}`;
  const hydratedCartKeyRef = React.useRef<string>(cartSessionKey);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [billingOrder, setBillingOrder] = useState<Order | null>(null);
  const [isWaiterOpen, setIsWaiterOpen] = useState(false);

  // Customer CRM & Recognition State
  const [customer, setCustomer] = useState<CustomerProfile | null>(() => initialCustomer || null);
  const [custName, setCustName] = useState(() => initialCustomer?.name || '');
  const [custPhone, setCustPhone] = useState(() => initialCustomer?.phoneNumber || '');
  const [isPhoneVerified, setIsPhoneVerified] = useState(() => Boolean(initialCustomer?.phoneVerified));
  const [marketingConsent, setMarketingConsent] = useState(() => Boolean(initialCustomer?.marketingConsent));
  const dinerName = custName || 'Guest';
  const setDinerName = (name: string) => setCustName(name);

  const storedCustToken =
    customer?.customerToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('urdearmenu_customer_token') || undefined
      : undefined);

  const loyaltyProfile = getCustomerLoyalty({
    restaurantId: restaurant.id,
    phoneNumber: custPhone || customer?.phoneNumber,
    customerToken: storedCustToken,
    customerName: custName || customer?.name,
    tableNumber: table.number,
  });

  const diningHistoryReceipts = useMemo(
    () =>
      getGuestDiningHistory({
        restaurantId: restaurant.id,
        phoneNumber: custPhone || customer?.phoneNumber,
        customerToken: storedCustToken,
        customerName: custName || customer?.name,
        tableNumber: table.number,
      }),
    [
      getGuestDiningHistory,
      restaurant.id,
      custPhone,
      customer?.phoneNumber,
      storedCustToken,
      custName,
      customer?.name,
      table.number,
    ]
  );

  const filteredDiningReceipts = useMemo(() => {
    if (historyFilter === 'paid') {
      return diningHistoryReceipts.filter(
        (r) => r.paymentStatus === 'paid' || r.paymentStatus === 'verified_by_staff'
      );
    }
    return diningHistoryReceipts;
  }, [diningHistoryReceipts, historyFilter]);

  const favoriteHistoryItems = useMemo(() => {
    const map = new Map<
      string,
      {
        menuItemId: string;
        name: string;
        dietType: DietType;
        orderCount: number;
        sessionsCount: number;
        lastOrderedAt: number;
        lastOrderItem: OrderItem;
        menuItem?: MenuItem;
      }
    >();

    diningHistoryReceipts.forEach((receipt) => {
      if (receipt.status === 'cancelled') return;
      const seenInReceipt = new Set<string>();
      (receipt.items || []).forEach((oi) => {
        const key = oi.menuItemId || oi.name.toLowerCase();
        const existing = map.get(key);
        const liveMenuItem =
          menuItems.find((m) => m.id === oi.menuItemId) ||
          menuItems.find((m) => m.name.toLowerCase() === oi.name.toLowerCase());
        const qty = Math.max(1, Number(oi.quantity) || 1);

        if (!existing) {
          seenInReceipt.add(key);
          map.set(key, {
            menuItemId: liveMenuItem?.id || oi.menuItemId,
            name: liveMenuItem?.name || oi.name,
            dietType: liveMenuItem?.dietType || oi.dietType,
            orderCount: qty,
            sessionsCount: 1,
            lastOrderedAt: receipt.placedAt || 0,
            lastOrderItem: oi,
            menuItem: liveMenuItem,
          });
        } else {
          existing.orderCount += qty;
          if (!seenInReceipt.has(key)) {
            existing.sessionsCount += 1;
            seenInReceipt.add(key);
          }
          if ((receipt.placedAt || 0) >= existing.lastOrderedAt) {
            existing.lastOrderedAt = receipt.placedAt || existing.lastOrderedAt;
            existing.lastOrderItem = oi;
          }
          if (!existing.menuItem && liveMenuItem) {
            existing.menuItem = liveMenuItem;
          }
        }
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.orderCount - a.orderCount || b.lastOrderedAt - a.lastOrderedAt
    );
  }, [diningHistoryReceipts, menuItems]);

  // OTP Verification State
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Cross-device profile lookup state
  const [showLookup, setShowLookup] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupOtpSent, setLookupOtpSent] = useState(false);
  const [lookupOtpInput, setLookupOtpInput] = useState('');
  const [lookupTestOtp, setLookupTestOtp] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Order submission state
  const [isFiringOrder, setIsFiringOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);

  // Anti-Spam Waiter Paging Cooldown Timer (60s)
  const COOLDOWN_KEY = `urdearmenu_cooldown_${restaurant.id}_${table.number}`;
  const [waiterCooldown, setWaiterCooldown] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = sessionStorage.getItem(`urdearmenu_cooldown_${restaurant.id}_${table.number}`);
      if (stored) {
        const remaining = Math.max(0, Math.ceil((Number(stored) - Date.now()) / 1000));
        return remaining;
      }
    } catch (e) {}
    return 0;
  });

  useEffect(() => {
    if (waiterCooldown <= 0) return;
    const timer = setInterval(() => {
      setWaiterCooldown((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem(COOLDOWN_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [waiterCooldown, COOLDOWN_KEY]);

  const handleTriggerWaiterAlert = async (reason: string = 'Floor Assistance Needed') => {
    if (waiterCooldown > 0) return;

    // Set 60-second cooldown
    const cooldownDuration = 60;
    const expiresAt = Date.now() + cooldownDuration * 1000;
    sessionStorage.setItem(COOLDOWN_KEY, String(expiresAt));
    setWaiterCooldown(cooldownDuration);

    onCallWaiter(reason);
    setIsWaiterOpen(false);

    // Dispatch over WebSocket
    await realtimeWs.sendWaiterCallAlert({
      restaurantId: restaurant.id,
      tableNumber: table.number,
      reason,
    });

    setOrderSuccessToast(`Floor Captain alerted for Table ${table.number}. Assistance on the way!`);
    setTimeout(() => setOrderSuccessToast(null), 5000);
  };

  // Daily Specials State (fetched from backend)
  const [backendSpecials, setBackendSpecials] = useState<MenuItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchSpecials = async () => {
      try {
        const res = await fetch(`/api/menu/specials?restaurant=${restaurant.id}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.specials)) {
          setBackendSpecials(data.specials);
        }
      } catch (err) {
        // graceful fallback to props
      }
    };
    fetchSpecials();
    return () => {
      isMounted = false;
    };
  }, [restaurant.id, menuItems]);

  // Combined daily specials
  const dailySpecials = useMemo(() => {
    const fromProps = menuItems.filter((i) => i.isDailySpecial || (i as any).isSpecial);
    const combined = [...fromProps];
    backendSpecials.forEach((bs) => {
      if (!combined.some((c) => c.id === bs.id)) {
        combined.push(bs);
      }
    });
    return combined;
  }, [menuItems, backendSpecials]);

  const handleQuickAddSpecialToCart = (item: MenuItem) => {
    if (isDishSoldOut(item)) {
      setOrderError(`${item.name} was just marked Sold Out by the kitchen.`);
      setTimeout(() => setOrderError(null), 4000);
      return;
    }
    if (item.portions && item.portions.length > 0) {
      setCustomizingItem(item);
      return;
    }
    const orderItem: OrderItem = {
      id: `cart-${Date.now()}-${item.id}`,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      dietType: item.dietType,
      customization: {
        addons: [],
        orderedBy: dinerName,
      },
      itemTotal: item.price,
    };
    setCart((prev) => [...prev, orderItem]);
    setOrderSuccessToast(`Added ${item.name} to order tray!`);
    setTimeout(() => setOrderSuccessToast(null), 3000);
  };

  // Real-time WebSocket Order Ready Notification State
  const [activeOrderReadyAlert, setActiveOrderReadyAlert] = useState<OrderReadyWsAlert | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // Subscribe to real-time 'Order Ready' WebSocket alerts targeted directly to this table
  useEffect(() => {
    const unsub = realtimeWs.onOrderReadyAlert((alert) => {
      const currentTableNorm = String(table.number).replace(/^Table\s*/i, '').trim();
      const alertTableNorm = String(alert.tableNumber).replace(/^Table\s*/i, '').trim();

      if (currentTableNorm === alertTableNorm) {
        setActiveOrderReadyAlert(alert);
        setIsAlertModalOpen(true);
      }
    });

    return () => unsub();
  }, [table.number]);

  // Sync initialCustomer if received asynchronously from recognition
  useEffect(() => {
    if (initialCustomer) {
      setCustomer(initialCustomer);
      if (initialCustomer.name) setCustName(initialCustomer.name);
      if (initialCustomer.phoneNumber) setCustPhone(initialCustomer.phoneNumber);
      if (initialCustomer.phoneVerified !== undefined) {
        setIsPhoneVerified(initialCustomer.phoneVerified);
      }
      if (initialCustomer.marketingConsent !== undefined) {
        setMarketingConsent(initialCustomer.marketingConsent);
      }
    }
  }, [initialCustomer]);

  // Restore persisted cart if table or restaurant changes, and sync changes without wiping on mount
  useEffect(() => {
    if (hydratedCartKeyRef.current !== cartSessionKey) {
      hydratedCartKeyRef.current = cartSessionKey;
      const restored = getTableCart(restaurant.id, table.number);
      setCart(restored);
      return;
    }
    syncCartAction(restaurant.id, table.number, cart, custName || 'Guest');
  }, [cart, custName, restaurant.id, table.number, cartSessionKey, getTableCart, syncCartAction]);

  // Filter items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (activeCategoryId !== 'cat-featured' && item.categoryId !== activeCategoryId) {
        return false;
      }
      if (dietFilter !== 'all' && item.dietType !== dietFilter) return false;
      if (onlyJain && !item.isJainAvailable) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const diff = resolveMenuItemDifficulty(item).toLowerCase();
        const matchesText =
          item.name.toLowerCase().includes(q) ||
          (item.hindiName && item.hindiName.toLowerCase().includes(q)) ||
          item.description.toLowerCase().includes(q) ||
          diff.includes(q);
        if (!matchesText) {
          return false;
        }
      }
      return true;
    });
  }, [menuItems, activeCategoryId, dietFilter, onlyJain, searchQuery]);

  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleQuickAdd = (item: MenuItem) => {
    if (isDishSoldOut(item)) return;
    if (item.portions && item.portions.length > 0) {
      setCustomizingItem(item);
      return;
    }
    const newItem: OrderItem = {
      id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      dietType: item.dietType,
      customization: { addons: [], isJain: false },
      itemTotal: item.price,
    };
    setCart((prev) => [...prev, newItem]);
  };

  const handleAddCustomized = (item: MenuItem, customization: SelectedCustomization, quantity: number) => {
    if (isDishSoldOut(item)) {
      setCustomizingItem(null);
      return;
    }
    const portionDelta = customization.portion?.priceDelta || 0;
    const addonsTotal = customization.addons.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = item.price + portionDelta + addonsTotal;
    const newItem: OrderItem = {
      id: `oi-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
      menuItemId: item.id,
      name: item.name,
      price: unitPrice,
      quantity,
      dietType: item.dietType,
      customization,
      itemTotal: unitPrice * quantity,
    };
    setCart((prev) => [...prev, newItem]);
    setCustomizingItem(null);
  };

  const handleReorderPastOrder = (order: { orderNumber: string; items: OrderItem[] }) => {
    const availableOrderItems = order.items.filter((oi) => !soldOutIdSet.has(oi.menuItemId));
    if (availableOrderItems.length === 0) {
      setOrderError(`All items from ${order.orderNumber} are currently marked Sold Out by the kitchen.`);
      setTimeout(() => setOrderError(null), 4000);
      return;
    }
    const skippedCount = order.items.length - availableOrderItems.length;
    const clonedItems: OrderItem[] = availableOrderItems.map((item, idx) => ({
      ...item,
      id: `reord-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
    }));
    setCart((prev) => [...prev, ...clonedItems]);
    setOrderSuccessToast(
      skippedCount > 0
        ? `Added ${clonedItems.length} available item(s) to cart (${skippedCount} sold-out item skipped).`
        : `Added ${clonedItems.length} item(s) from ${order.orderNumber} to your cart!`
    );
    setTimeout(() => setOrderSuccessToast(null), 4000);
    setSelectedReceipt(null);
    setActivePortalTab('menu');
  };

  const handleReorderSingleFavorite = (sampleItem: OrderItem, liveItem?: MenuItem) => {
    const checkId = liveItem?.id || sampleItem.menuItemId;
    if (soldOutIdSet.has(checkId) || (liveItem && isDishSoldOut(liveItem))) {
      setOrderError(`${sampleItem.name} is currently marked Sold Out by the kitchen.`);
      setTimeout(() => setOrderError(null), 4000);
      return;
    }
    const unitTotal =
      sampleItem.quantity > 0
        ? sampleItem.itemTotal / sampleItem.quantity
        : liveItem?.price || sampleItem.price;
    const cloned: OrderItem = {
      ...sampleItem,
      id: `fav-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: checkId,
      name: liveItem?.name || sampleItem.name,
      quantity: 1,
      itemTotal: Math.round(unitTotal),
      customization: {
        ...(sampleItem.customization || { addons: [] }),
        orderedBy: dinerName,
      },
    };
    setCart((prev) => [...prev, cloned]);
    setOrderSuccessToast(`Re-ordered ${cloned.name} — added to your table tray!`);
    setTimeout(() => setOrderSuccessToast(null), 3500);
  };

  const handleCopyReceiptText = (rec: GuestDiningReceipt) => {
    const lines = [
      `${rec.restaurantName || restaurant.name} — Dining Receipt`,
      `Receipt: ${rec.orderNumber} • Table ${rec.tableNumber}`,
      `Date: ${new Date(rec.placedAt).toLocaleString()}`,
      `Guest: ${rec.dinerName}`,
      '--------------------------------',
      ...rec.items.map(
        (i) => `${i.quantity}x ${i.name} — ${formatINR(i.itemTotal)}`
      ),
      '--------------------------------',
      `Subtotal: ${formatINR(rec.subtotal)}`,
      `CGST (2.5%): ${formatINR(rec.cgst, true)}`,
      `SGST (2.5%): ${formatINR(rec.sgst, true)}`,
      ...(rec.serviceCharge > 0 ? [`Service Charge: ${formatINR(rec.serviceCharge, true)}`] : []),
      ...(rec.tip > 0 ? [`Tip: ${formatINR(rec.tip)}`] : []),
      `Grand Total: ${formatINR(rec.grandTotal)}`,
      `Status: ${
        rec.paymentStatus === 'paid' || rec.paymentStatus === 'verified_by_staff'
          ? `Paid (${rec.paymentMethod === 'cash' ? 'Cash' : 'UPI / Online'})`
          : 'Open'
      }`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(lines).catch(() => {});
    }
    setCopiedReceiptId(rec.orderId);
    setTimeout(() => setCopiedReceiptId(null), 2000);
  };

  const handleIncrementItem = (id: string) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const newQty = i.quantity + 1;
          const unit = i.itemTotal / i.quantity;
          return { ...i, quantity: newQty, itemTotal: unit * newQty };
        }
        return i;
      })
    );
  };

  const handleDecrementItem = (id: string) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            if (i.quantity <= 1) return null;
            const newQty = i.quantity - 1;
            const unit = i.itemTotal / i.quantity;
            return { ...i, quantity: newQty, itemTotal: unit * newQty };
          }
          return i;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  // OTP Verification Handlers
  const handleSendOtp = async () => {
    if (!custPhone.trim() || custPhone.trim().replace(/\D/g, '').length < 10) {
      setOtpError('Please enter a valid 10-digit mobile number first.');
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/customer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: custPhone.trim(), restaurantId: restaurant.id }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setTestOtp(data.testOtp || '1234');
      } else {
        setOtpError(data.error || 'Failed to send OTP.');
      }
    } catch (e: any) {
      setOtpError(e.message || 'Error sending OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) {
      setOtpError('Please enter the 4-digit verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: custPhone.trim(),
          otp: otpInput.trim(),
          restaurantId: restaurant.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.verified) {
        setIsPhoneVerified(true);
        setOtpSent(false);
        setOtpInput('');
        if (data.customerToken) {
          localStorage.setItem('urdearmenu_customer_token', data.customerToken);
        }
        if (data.customer) {
          setCustomer(data.customer);
          if (data.customer.name && !custName) setCustName(data.customer.name);
          if (data.customer.marketingConsent !== undefined) setMarketingConsent(data.customer.marketingConsent);
        }
      } else {
        setOtpError(data.error || 'Invalid OTP code.');
      }
    } catch (e: any) {
      setOtpError(e.message || 'Error verifying OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // Cross-device Lookup Handlers
  const handleStartLookup = async () => {
    if (!lookupPhone.trim() || lookupPhone.trim().replace(/\D/g, '').length < 10) {
      setLookupError('Enter your 10-digit registered mobile number.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/customer/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: lookupPhone.trim(), restaurantId: restaurant.id }),
      });
      const data = await res.json();
      if (data.success) {
        setLookupOtpSent(true);
        setLookupTestOtp(data.testOtp || '1234');
      } else {
        setLookupError(data.error || 'Failed to send lookup OTP.');
      }
    } catch (e: any) {
      setLookupError(e.message || 'Error looking up phone number');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleVerifyLookup = async () => {
    if (!lookupOtpInput.trim()) {
      setLookupError('Please enter the 4-digit code.');
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch('/api/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: lookupPhone.trim(),
          otp: lookupOtpInput.trim(),
          restaurantId: restaurant.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        setCustName(data.customer.name || '');
        setCustPhone(data.customer.phoneNumber || lookupPhone.trim());
        setIsPhoneVerified(true);
        if (data.customer.marketingConsent !== undefined) {
          setMarketingConsent(data.customer.marketingConsent);
        }
        if (data.customerToken) {
          localStorage.setItem('urdearmenu_customer_token', data.customerToken);
        }
        setShowLookup(false);
        setLookupOtpSent(false);
        setLookupOtpInput('');
      } else {
        setLookupError(data.error || 'Could not verify code or locate profile.');
      }
    } catch (e: any) {
      setLookupError(e.message || 'Error verifying phone');
    } finally {
      setLookupLoading(false);
    }
  };

  // Submit Order with Customer CRM Sync
  const handleSendOrder = async () => {
    if (cart.length === 0) return;

    // Minimum friction validation: Customer Name and Phone Number are required
    if (!custName.trim() || custName.trim().length < 2) {
      setOrderError('Please enter your full name before placing your order.');
      return;
    }
    if (!custPhone.trim() || custPhone.trim().replace(/\D/g, '').length < 10) {
      setOrderError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsFiringOrder(true);
    setOrderError(null);

    try {
      // 1. Register or update customer profile in CRM
      const regRes = await fetch('/api/customer/register-or-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          name: custName.trim(),
          phoneNumber: custPhone.trim(),
          phoneVerified: isPhoneVerified,
          marketingConsent,
          marketingConsentSource: `QR Table ${table.number} Checkout`,
          preferredTable: table.number,
          customerToken: customer?.customerToken || localStorage.getItem('urdearmenu_customer_token') || undefined,
        }),
      });

      const regData = await regRes.json();
      let activeCustomerToken = customer?.customerToken;

      if (regData.success) {
        activeCustomerToken = regData.customerToken;
        localStorage.setItem('urdearmenu_customer_token', regData.customerToken);
        setCustomer(regData.customer);
      }

      // 2. Record Customer Order & Update Customer Analytics
      const generatedOrderId = `ord-${Date.now()}`;
      const generatedOrderNumber = String(Math.floor(100 + Math.random() * 900));

      await fetch('/api/customer/record-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          customerId: regData.customer?.id,
          customerToken: activeCustomerToken,
          phoneNumber: custPhone.trim(),
          name: custName.trim(),
          orderId: generatedOrderId,
          orderNumber: generatedOrderNumber,
          tableNumber: table.number,
          items: cart,
          totalAmount: Math.round(cartTotal * 1.05),
          marketingConsent,
        }),
      });

      // 3. Fire to unified Restaurant Database & Kitchen Display System
      const placedOrder = onPlaceOrder(cart, custName.trim());
      const loyaltyRes = awardLoyaltyPointsForOrder({
        restaurantId: restaurant.id,
        order: placedOrder || {
          id: generatedOrderId,
          orderNumber: `#UDM-${generatedOrderNumber}`,
          grandTotal: Math.round(cartTotal * 1.05),
          tableNumber: table.number,
          dinerName: custName.trim(),
          placedAt: Date.now(),
        },
        customerName: custName.trim(),
        phoneNumber: custPhone.trim(),
        customerToken: activeCustomerToken,
      });

      recordGuestDiningReceipt({
        orderId: placedOrder?.id || generatedOrderId,
        orderNumber: placedOrder?.orderNumber || `#UDM-${generatedOrderNumber}`,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        tableNumber: table.number,
        dinerName: custName.trim(),
        phoneNumber: custPhone.trim(),
        customerToken: activeCustomerToken,
        items: placedOrder?.items || cart,
        subtotal: placedOrder?.subtotal ?? cartTotal,
        cgst: placedOrder?.cgst ?? Math.round(cartTotal * 0.025 * 100) / 100,
        sgst: placedOrder?.sgst ?? Math.round(cartTotal * 0.025 * 100) / 100,
        serviceCharge: placedOrder?.serviceCharge ?? 0,
        tip: placedOrder?.tip ?? 0,
        grandTotal: placedOrder?.grandTotal ?? Math.round(cartTotal * 1.05),
        paymentStatus: placedOrder?.paymentStatus || 'pending',
        placedAt: placedOrder?.placedAt || Date.now(),
        status: placedOrder?.status || 'received',
      });

      setCart([]);
      setIsCartOpen(false);
      setOrderSuccessToast(
        loyaltyRes.pointsAwarded > 0
          ? `Order #${generatedOrderNumber} fired to kitchen! +${loyaltyRes.pointsAwarded} Loyalty Points earned.`
          : `Order #${generatedOrderNumber} fired to kitchen! Live timers active.`
      );
      setTimeout(() => setOrderSuccessToast(null), 6000);
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsFiringOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col max-w-md mx-auto w-full relative shadow-2xl rounded-none sm:rounded-3xl overflow-x-hidden border-x sm:border border-[#E4E4E7]">
      {/* Table Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F4F4F5] p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#18181B] text-white flex items-center justify-center font-bold text-xs font-heading shrink-0">
            {table.number}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-heading text-[#18181B] truncate">
                {table.name}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-[#FFDBCC] text-[#A14000] shrink-0">
                {table.zone}
              </span>
            </div>
            <span className="text-[10px] text-[#71717A] block -mt-0.5 truncate">
              {restaurant.name}
            </span>
          </div>
        </div>

        {/* Alert Waiter Button with Cooldown Timer */}
        <button
          onClick={() => {
            if (waiterCooldown > 0) return;
            setIsWaiterOpen(true);
          }}
          disabled={waiterCooldown > 0}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold font-heading transition-all shrink-0 ${
            waiterCooldown > 0
              ? 'bg-[#E4E4E7] text-[#71717A] cursor-not-allowed border border-[#D4D4D8]'
              : waiterCallActive
              ? 'bg-[#FFDBCC] text-[#7B2F00] border border-[#F76707]/30 animate-pulse'
              : 'bg-[#F76707]/10 text-[#F76707] border border-[#F76707]/25 hover:bg-[#F76707] hover:text-white'
          }`}
        >
          <Bell
            size={13}
            className={
              waiterCooldown > 0
                ? 'text-[#71717A]'
                : waiterCallActive
                ? 'text-[#F76707] animate-bounce'
                : 'text-[#F76707]'
            }
          />
          <span>
            {waiterCooldown > 0
              ? `Alerted (${waiterCooldown}s)`
              : waiterCallActive
              ? 'Staff Attending'
              : 'Alert Waiter'}
          </span>
        </button>
      </div>

      {/* Free Wi-Fi Callout Bar */}
      <div className="bg-[#18181B] text-white px-4 py-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-[11px]">
          <Wifi size={12} className="text-[#2563EB]" />
          <span>Wi-Fi: <strong>{restaurant.wifiSsid}</strong></span>
        </span>
        <span className="font-mono text-[10px] text-[#A1A1AA]">
          Pass: {restaurant.wifiPassword}
        </span>
      </div>

      {/* Menu vs Past Orders vs Profile & Loyalty Switcher */}
      <div className="bg-white border-b border-[#E4E4E7] px-3 py-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setActivePortalTab('menu')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading flex items-center justify-center gap-1 transition-all ${
            activePortalTab === 'menu'
              ? 'bg-[#18181B] text-white shadow-xs'
              : 'bg-[#FAFAFA] text-[#52525B] border border-[#E4E4E7] hover:text-[#18181B]'
          }`}
        >
          <Utensils size={13} />
          <span>Menu</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePortalTab('past_orders')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading flex items-center justify-center gap-1 transition-all ${
            activePortalTab === 'past_orders'
              ? 'bg-[#18181B] text-white shadow-xs'
              : 'bg-[#FAFAFA] text-[#52525B] border border-[#E4E4E7] hover:text-[#18181B]'
          }`}
        >
          <History size={13} />
          <span>Orders</span>
          {pastTableOrders.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tnum ${
                activePortalTab === 'past_orders'
                  ? 'bg-[#F76707] text-white'
                  : 'bg-[#FFDBCC] text-[#A14000]'
              }`}
            >
              {pastTableOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActivePortalTab('profile')}
          className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold font-heading flex items-center justify-center gap-1 transition-all ${
            activePortalTab === 'profile'
              ? 'bg-[#18181B] text-white shadow-xs'
              : 'bg-[#FAFAFA] text-[#52525B] border border-[#E4E4E7] hover:text-[#18181B]'
          }`}
        >
          <Award size={13} className={activePortalTab === 'profile' ? 'text-[#F76707]' : 'text-[#F76707]'} />
          <span>Profile</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tnum ${
              activePortalTab === 'profile'
                ? 'bg-[#F76707] text-white'
                : 'bg-[#FFDBCC] text-[#A14000]'
            }`}
          >
            {loyaltyProfile.pointsBalance}
          </span>
        </button>
      </div>

      {/* RECOGNIZED GUEST GREETING BANNER */}
      {customer && customer.name && (
        <div
          onClick={() => setActivePortalTab('profile')}
          className="bg-emerald-50 border-b border-emerald-200/80 px-3.5 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-emerald-100/70 transition-all"
        >
          <div className="flex items-center gap-1.5 text-emerald-800 min-w-0">
            <Sparkles size={13} className="text-emerald-600 shrink-0" />
            <span className="truncate">
              Welcome back, <strong>{customer.name}</strong>! ({loyaltyProfile.pointsBalance} pts)
            </span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
            {loyaltyProfile.tier}
          </span>
        </div>
      )}

      {/* ORDER SUCCESS NOTIFICATION TOAST */}
      {orderSuccessToast && (
        <div className="bg-[#18181B] text-white px-3.5 py-2.5 flex items-center justify-between text-xs font-bold border-b border-white/10 animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{orderSuccessToast}</span>
          </div>
          <button
            onClick={() => setOrderSuccessToast(null)}
            className="text-white/70 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* REAL-TIME WEBSOCKET 'ORDER READY' ALERT BANNER */}
      {activeOrderReadyAlert && (
        <div
          onClick={() => setIsAlertModalOpen(true)}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-3.5 py-2.5 flex items-center justify-between text-xs font-bold border-b border-emerald-500 shadow-md cursor-pointer animate-in slide-in-from-top"
        >
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-white/20 animate-bounce shrink-0">
              <Bell size={13} className="text-white" />
            </span>
            <div className="truncate">
              <span className="font-extrabold font-heading">
                Hot & Plated! Order #{activeOrderReadyAlert.orderNumber} is Ready!
              </span>
              <span className="block text-[10px] text-emerald-100 font-normal truncate">
                Click to view kitchen message
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAlertModalOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 text-[10px] font-extrabold shadow-xs shrink-0"
          >
            View Alert
          </button>
        </div>
      )}

      {/* LIVE ORDER PROGRESS BANNER (IF ORDER ACTIVE) */}
      {activeOrder && (
        <div
          onClick={() => setIsCartOpen(true)}
          className={`border-b p-3 cursor-pointer transition-all ${
            activeOrder.status === 'ready'
              ? 'bg-[#F0FDF4] border-[#16A34A]/40'
              : activeOrder.status === 'preparing'
              ? 'bg-[#FFFBEB] border-[#F59E0B]/40'
              : 'bg-[#FEF2F2] border-[#DC2626]/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-full text-white flex items-center justify-center ${
                  activeOrder.status === 'ready'
                    ? 'bg-[#16A34A]'
                    : activeOrder.status === 'preparing'
                    ? 'bg-[#F59E0B] animate-pulse'
                    : 'bg-[#DC2626] animate-pulse'
                }`}
              >
                {activeOrder.status === 'ready' ? (
                  <CheckCircle2 size={18} />
                ) : activeOrder.status === 'preparing' ? (
                  <Flame size={18} />
                ) : (
                  <Clock size={18} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-[#18181B] font-heading">
                    {activeOrder.status === 'ready'
                      ? 'Dishes Ready! Waiter is Serving 🍽️'
                      : activeOrder.status === 'preparing'
                      ? 'Preparing in Kitchen & Tandoor 🔥'
                      : 'Order Received in Kitchen 👨‍🍳'}
                  </span>
                </div>
                <span className="text-[11px] text-[#52525B]">
                  {activeOrder.items.length} items ({activeOrder.orderNumber}) • Tap to view slip
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-[#71717A]" />
          </div>

          {/* 4-Step Visual Progress Bar */}
          <div className="mt-2.5 grid grid-cols-4 gap-1">
            <div
              className={`h-1.5 rounded-full ${
                ['received', 'preparing', 'ready', 'served'].includes(activeOrder.status)
                  ? 'bg-[#16A34A]'
                  : 'bg-[#E4E4E7]'
              }`}
            />
            <div
              className={`h-1.5 rounded-full ${
                ['preparing', 'ready', 'served'].includes(activeOrder.status)
                  ? 'bg-[#F59E0B]'
                  : 'bg-[#E4E4E7]'
              }`}
            />
            <div
              className={`h-1.5 rounded-full ${
                ['ready', 'served'].includes(activeOrder.status)
                  ? 'bg-[#16A34A]'
                  : 'bg-[#E4E4E7]'
              }`}
            />
            <div
              className={`h-1.5 rounded-full ${
                activeOrder.status === 'served' ? 'bg-[#16A34A]' : 'bg-[#E4E4E7]'
              }`}
            />
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-bold text-[#71717A]">
            <span className={activeOrder.status === 'received' ? 'text-[#DC2626]' : ''}>Received</span>
            <span className={activeOrder.status === 'preparing' ? 'text-[#D97706]' : ''}>Preparing</span>
            <span className={activeOrder.status === 'ready' ? 'text-[#16A34A]' : ''}>Ready</span>
            <span className={activeOrder.status === 'served' ? 'text-[#16A34A]' : ''}>Served</span>
          </div>
        </div>
      )}

      {/* LIVE LOW-INVENTORY & SOLD OUT NOTICE BANNER */}
      {(soldOutIdSet.size > 0 || lowStockIdSet.size > 0) && (
        <div
          className={`px-3.5 py-2 border-b text-[11px] flex items-center justify-between gap-2 ${
            soldOutInCartItems.length > 0
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle
              size={13}
              className={soldOutInCartItems.length > 0 ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'}
            />
            <span className="truncate font-semibold">
              {soldOutInCartItems.length > 0
                ? `${soldOutInCartItems.length} item(s) in your cart were just marked Sold Out by Kitchen.`
                : soldOutIdSet.size > 0
                ? `Live Kitchen Update: ${soldOutIdSet.size} dish(es) currently Sold Out${lowStockIdSet.size > 0 ? ` • ${lowStockIdSet.size} Low Stock` : ''}.`
                : `Low Inventory Alert: ${lowStockIdSet.size} dish(es) running low today.`}
            </span>
          </div>
          {soldOutInCartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-bold shrink-0"
            >
              Review Cart
            </button>
          )}
        </div>
      )}

      {activePortalTab === 'menu' ? (
        <>
          {/* Categories Horizontal Rail */}
          <div className="bg-white border-b border-[#F4F4F5] py-2.5 px-3 flex gap-2 overflow-x-auto no-scrollbar sticky top-[53px] z-20">
            <button
              type="button"
              onClick={() => setActiveCategoryId('cat-featured')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategoryId === 'cat-featured'
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'bg-white border border-[#E4E4E7] text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              All Dishes ({menuItems.length})
            </button>
            {categories.map((c) => {
              const isActive = activeCategoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'bg-white border border-[#E4E4E7] text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Search & Dietary Filters */}
          <div className="p-3 bg-[#FAFAFA] border-b border-[#F4F4F5] space-y-2">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-[#71717A] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (voiceError) setVoiceError(null);
                }}
                placeholder={
                  isVoiceListening
                    ? 'Listening... speak dish name'
                    : 'Search dishes, ingredients, or tap mic...'
                }
                className={`w-full pl-8 pr-20 py-2 rounded-xl bg-white border text-xs placeholder:text-[#A1A1AA] focus:outline-hidden transition-all ${
                  isVoiceListening
                    ? 'border-[#F76707] ring-2 ring-[#F76707]/20'
                    : 'border-[#E4E4E7] focus:border-[#18181B]'
                }`}
              />

              <div className="absolute right-1.5 flex items-center gap-1">
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="p-1.5 rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] transition-all"
                  >
                    <X size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleVoiceSearch}
                  aria-label={isVoiceListening ? 'Stop voice search' : 'Search dishes by voice'}
                  title={
                    isVoiceListening
                      ? 'Tap to stop listening'
                      : isSpeechRecognitionSupported
                      ? 'Tap microphone & dictate dish name'
                      : 'Voice search (requires supported browser)'
                  }
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                    isVoiceListening
                      ? 'bg-[#F76707] text-white shadow-sm animate-pulse'
                      : 'bg-[#F4F4F5] hover:bg-[#FFDBCC] text-[#18181B] hover:text-[#A14000]'
                  }`}
                >
                  {isVoiceListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </div>

            {isVoiceListening && (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#FFDBCC]/60 border border-[#F76707]/30 flex items-center justify-between gap-2 text-[11px] text-[#7B2F00]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#F76707] animate-ping shrink-0" />
                  <span className="font-bold truncate">
                    {voiceTranscriptPreview
                      ? `Heard: "${voiceTranscriptPreview}"`
                      : 'Listening... say a dish name (e.g. "Butter Chicken" or "Paneer")'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleVoiceSearch}
                  className="text-[10px] font-extrabold text-[#A14000] underline shrink-0"
                >
                  Stop
                </button>
              </div>
            )}

            {voiceError && !isVoiceListening && (
              <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 text-[10px] text-rose-700 font-medium">
                <span>{voiceError}</span>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="font-bold text-rose-800 shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  setDietFilter('all');
                  setOnlyJain(false);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  dietFilter === 'all' && !onlyJain
                    ? 'bg-[#18181B] text-white'
                    : 'bg-white border border-[#E4E4E7] text-[#52525B]'
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => setDietFilter(dietFilter === 'veg' ? 'all' : 'veg')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                  dietFilter === 'veg'
                    ? 'bg-[#16A34A] text-white'
                    : 'bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                Pure Veg 🟢
              </button>
              <button
                onClick={() => setOnlyJain(!onlyJain)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                  onlyJain
                    ? 'bg-[#854D0E] text-white'
                    : 'bg-[#FEFCE8] text-[#854D0E] border border-[#CA8A04]/30'
                }`}
              >
                <Leaf size={11} />
                Jain Friendly
              </button>
              <button
                onClick={() => setDietFilter(dietFilter === 'non-veg' ? 'all' : 'non-veg')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                  dietFilter === 'non-veg'
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                Non-Veg 🔴
              </button>
            </div>
          </div>

          {/* CHEF'S DAILY SPECIALS SECTION */}
          {dailySpecials.length > 0 && (
            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border-b border-amber-200/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 rounded-lg bg-[#F76707] text-white">
                    <Sparkles size={12} className="animate-spin" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black font-heading text-[#18181B] uppercase tracking-wider">
                      Chef's Daily Specials
                    </h3>
                    <span className="text-[10px] text-[#71717A] block -mt-0.5">
                      Curated recipes for today • 1-tap add to order
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#FFDBCC] text-[#A14000] border border-[#F76707]/30">
                  Today's Pick
                </span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {dailySpecials.map((special) => {
                  const inCartQty = cart
                    .filter((c) => c.menuItemId === special.id)
                    .reduce((sum, c) => sum + c.quantity, 0);
                  const specialSoldOut = isDishSoldOut(special);
                  const specialLowStock = isDishLowStock(special);

                  return (
                    <div
                      key={special.id}
                      className={`min-w-[190px] max-w-[190px] bg-white rounded-2xl p-2.5 border shadow-xs flex flex-col justify-between shrink-0 transition-all ${
                        specialSoldOut
                          ? 'opacity-65 border-rose-200 bg-[#FAFAFA]'
                          : 'border-amber-200/80 hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="relative w-full h-24 rounded-xl overflow-hidden bg-[#F4F4F5] mb-2 border border-[#E4E4E7]">
                          <DishImage
                            src={special.imageUrl ?? special.image}
                            alt={special.name}
                            dietType={special.dietType}
                            grayscale={specialSoldOut}
                            iconSize={24}
                          />
                          <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded-md shadow-2xs">
                            <DietaryBadge dietType={special.dietType} size="sm" showLabel={false} />
                          </div>
                          <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#18181B]/80 text-white backdrop-blur-xs">
                            Special ★
                          </span>
                          {specialSoldOut ? (
                            <span className="absolute bottom-1.5 inset-x-1.5 text-center text-[9px] font-extrabold py-0.5 rounded-md bg-rose-600/95 text-white uppercase">
                              Sold Out
                            </span>
                          ) : (
                            specialLowStock && (
                              <span className="absolute bottom-1.5 inset-x-1.5 text-center text-[9px] font-extrabold py-0.5 rounded-md bg-amber-500/95 text-white">
                                Low Stock
                              </span>
                            )
                          )}
                        </div>

                        <h4 className="text-xs font-bold font-heading text-[#18181B] truncate">
                          {special.name}
                        </h4>
                        <p className="text-[10px] text-[#71717A] line-clamp-1 mt-0.5">
                          {special.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <DifficultyBadge
                            level={special.difficultyLevel}
                            prepTimeMinutes={special.prepTimeMinutes}
                          />
                          <span className="text-[9px] text-[#71717A] flex items-center gap-0.5">
                            <Clock size={9} /> {special.prepTimeMinutes}m
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#F4F4F5] flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold font-heading text-[#F76707] tnum">
                          {formatINR(special.price)}
                        </span>

                        {specialSoldOut ? (
                          <span className="px-2 py-1 rounded-lg bg-rose-100 border border-rose-200 text-[9px] font-extrabold text-rose-700">
                            Sold Out
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickAddSpecialToCart(special)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold font-heading flex items-center gap-1 transition-all shadow-2xs ${
                              inCartQty > 0
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#F76707] hover:bg-[#D85800] text-white'
                            }`}
                          >
                            {inCartQty > 0 ? (
                              <>
                                <CheckCircle2 size={11} />
                                <span>Added ({inCartQty})</span>
                              </>
                            ) : (
                              <>
                                <Plus size={11} />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Menu Grid */}
          <div className="p-3 pb-32 flex-1 overflow-y-auto">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredItems.map((item) => {
                  const inCartQty = cart
                    .filter((c) => c.menuItemId === item.id)
                    .reduce((sum, c) => sum + c.quantity, 0);
                  const itemSoldOut = isDishSoldOut(item);
                  const itemLowStock = isDishLowStock(item);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (itemSoldOut) return;
                        setCustomizingItem(item);
                      }}
                      className={`bg-white rounded-2xl p-2.5 border shadow-xs flex flex-col justify-between gap-2 transition-all min-w-0 ${
                        itemSoldOut
                          ? 'opacity-65 cursor-not-allowed bg-[#FAFAFA] border-rose-200'
                          : 'border-[#E4E4E7] cursor-pointer hover:shadow-md hover:border-[#F76707]/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-[#E4E4E7] bg-[#F4F4F5] mb-2">
                          <DishImage
                            src={item.imageUrl ?? item.image}
                            alt={item.name}
                            dietType={item.dietType}
                            grayscale={itemSoldOut}
                            iconSize={26}
                          />
                          <div className="absolute top-1.5 left-1.5 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-md shadow-2xs flex items-center gap-1">
                            <DietaryBadge dietType={item.dietType} size="sm" showLabel={false} />
                            {item.isJainAvailable && <JainBadge />}
                          </div>
                          {item.isBestseller && !itemSoldOut && (
                            <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100/95 text-amber-800 border border-amber-300">
                              ★ Top
                            </span>
                          )}
                          {itemSoldOut ? (
                            <span className="absolute bottom-1.5 inset-x-1.5 text-center text-[9px] font-extrabold py-0.5 rounded-md bg-rose-600/95 text-white uppercase tracking-wide">
                              Sold Out
                            </span>
                          ) : (
                            itemLowStock && (
                              <span className="absolute bottom-1.5 inset-x-1.5 text-center text-[9px] font-extrabold py-0.5 rounded-md bg-amber-500/95 text-white">
                                Low Stock
                              </span>
                            )
                          )}
                        </div>

                        <h4 className="text-xs font-bold font-heading text-[#18181B] truncate">
                          {item.name}
                        </h4>
                        {item.hindiName && (
                          <span className="text-[10px] text-[#71717A] block truncate -mt-0.5">
                            {item.hindiName}
                          </span>
                        )}
                        <p className="text-[10px] text-[#52525B] line-clamp-2 mt-0.5 leading-snug min-h-[26px]">
                          {item.description || 'Prepared fresh to order.'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <DifficultyBadge
                            level={item.difficultyLevel}
                            prepTimeMinutes={item.prepTimeMinutes}
                          />
                          {item.spiceLevel !== undefined && item.spiceLevel > 0 && (
                            <SpiceBadge level={item.spiceLevel} />
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#F4F4F5] flex items-center justify-between gap-1">
                        <div>
                          <div className="text-xs font-extrabold font-heading text-[#18181B] tnum">
                            {formatINR(item.price)}
                          </div>
                          <div className="text-[9px] text-[#71717A] flex items-center gap-0.5">
                            <Clock size={9} /> {item.prepTimeMinutes}m
                          </div>
                        </div>

                        {!itemSoldOut ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(item);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold font-heading flex items-center gap-1 transition-all shadow-2xs shrink-0 ${
                              inCartQty > 0
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-[#E4E4E7] text-[#F76707] hover:bg-[#F76707] hover:text-white'
                            }`}
                          >
                            {inCartQty > 0 ? (
                              <>
                                <CheckCircle2 size={11} />
                                <span>{inCartQty}</span>
                              </>
                            ) : (
                              <>
                                <Plus size={11} strokeWidth={2.5} />
                                <span>ADD</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-rose-100 border border-rose-200 text-[9px] font-extrabold text-rose-700 shrink-0">
                            Sold Out
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-[#E4E4E7] text-center space-y-2">
                <Utensils size={24} className="text-[#A1A1AA] mx-auto" />
                <div className="text-xs font-bold text-[#18181B]">
                  {menuItems.length === 0
                    ? `${restaurant.name} menu is being prepared`
                    : 'No matching dishes found'}
                </div>
                <p className="text-[11px] text-[#71717A]">
                  {menuItems.length === 0
                    ? 'Please tap Alert Waiter above for our printed menu or chef recommendations.'
                    : 'Try clearing search or switching category filters.'}
                </p>
              </div>
            )}
          </div>
        </>
      ) : activePortalTab === 'past_orders' ? (
        /* PAST ORDERS VIEW (POWERED BY REALTIMESYNCCONTEXT) */
        <div className="p-3 pb-32 space-y-3 flex-1 overflow-y-auto">
          <div className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold font-heading text-[#18181B]">
                Table {table.number} • Order Summaries
              </h3>
              <p className="text-[10px] text-[#71717A] mt-0.5">
                Live kitchen status & previous orders synced in real time
              </p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7]'
              }`}
            >
              <Radio size={10} className={connectionStatus === 'connected' ? 'text-emerald-600' : 'text-[#71717A]'} />
              <span>{connectionStatus === 'connected' ? 'Live Sync' : 'Synced'}</span>
            </span>
          </div>

          {pastTableOrders.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-2.5 border border-[#E4E4E7] text-center">
                <div className="text-[10px] text-[#71717A] font-medium">Orders</div>
                <div className="text-sm font-extrabold font-heading text-[#18181B] tnum">
                  {pastTableOrders.length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-[#E4E4E7] text-center">
                <div className="text-[10px] text-[#71717A] font-medium">Completed</div>
                <div className="text-sm font-extrabold font-heading text-emerald-700 tnum">
                  {pastTableOrders.filter((o) => o.status === 'served').length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-[#E4E4E7] text-center">
                <div className="text-[10px] text-[#71717A] font-medium">Total Value</div>
                <div className="text-sm font-extrabold font-heading text-[#F76707] tnum">
                  {formatINR(pastTableOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0))}
                </div>
              </div>
            </div>
          )}

          {pastTableOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-[#E4E4E7] text-center space-y-3">
              <Receipt size={26} className="text-[#A1A1AA] mx-auto" />
              <div className="text-xs font-bold text-[#18181B]">
                No Past Orders for Table {table.number} Yet
              </div>
              <p className="text-[11px] text-[#71717A]">
                Orders placed from this table will appear here immediately with live kitchen progress and itemized receipts.
              </p>
              <button
                type="button"
                onClick={() => setActivePortalTab('menu')}
                className="px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-xs"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            pastTableOrders.map((ord) => {
              const statusStyle =
                ord.status === 'served'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : ord.status === 'ready'
                  ? 'bg-green-50 text-green-700 border-green-300'
                  : ord.status === 'preparing'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : ord.status === 'cancelled'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-orange-50 text-[#A14000] border-orange-200';

              const placedLabel = new Date(ord.placedAt || Date.now()).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold font-heading text-[#18181B]">
                          {ord.orderNumber || `#${ord.id.slice(-4)}`}
                        </span>
                        <span className="text-[10px] text-[#71717A]">• {placedLabel}</span>
                      </div>
                      <div className="text-[10px] text-[#71717A] mt-0.5">
                        Guest: <strong className="text-[#52525B]">{ord.dinerName || 'Table Guest'}</strong>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${statusStyle}`}
                      >
                        {ord.status}
                      </span>
                      <span className="text-[9px] font-semibold text-[#71717A]">
                        {ord.paymentStatus === 'paid' || ord.paymentStatus === 'verified_by_staff'
                          ? 'Paid ✓'
                          : ord.paymentStatus === 'pending_payment'
                          ? 'Pay at Counter'
                          : 'Payment Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#FAFAFA] rounded-xl p-2.5 border border-[#F4F4F5] space-y-1.5">
                    {ord.items.map((oi) => (
                      <div key={oi.id} className="flex items-center justify-between text-[11px] gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <DietaryBadge dietType={oi.dietType} size="sm" showLabel={false} />
                          <span className="font-bold text-[#18181B] shrink-0">{oi.quantity}×</span>
                          <span className="text-[#18181B] truncate">{oi.name}</span>
                          {oi.customization?.isJain && (
                            <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                              Jain
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-[#18181B] tnum shrink-0">
                          {formatINR(oi.itemTotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs border-t border-[#F4F4F5]">
                    <div>
                      <span className="text-[10px] text-[#71717A] block">
                        Grand Total (incl. taxes{ord.tip > 0 ? ` + ${formatINR(ord.tip)} tip` : ''})
                      </span>
                      <span className="text-sm font-extrabold font-heading text-[#18181B] tnum">
                        {formatINR(ord.grandTotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ord.paymentStatus !== 'paid' && ord.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            setBillingOrder(ord);
                            setIsBillOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[10px] font-bold text-[#18181B] flex items-center gap-1"
                        >
                          <CreditCard size={11} className="text-[#F76707]" />
                          <span>Pay Bill</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReorderPastOrder(ord)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-[10px] font-bold font-heading flex items-center gap-1 shadow-2xs"
                      >
                        <RotateCcw size={11} />
                        <span>Reorder</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* CUSTOMER PROFILE, LOYALTY & MY DINING HISTORY SECTION */
        <div className="p-3 pb-32 space-y-3 flex-1 overflow-y-auto">
          {/* Profile Section Sub-View Switcher */}
          <div className="bg-white p-1.5 rounded-2xl border border-[#E4E4E7] grid grid-cols-2 gap-1.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setProfileSubTab('loyalty')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-bold font-heading flex items-center justify-center gap-1.5 transition-all ${
                profileSubTab === 'loyalty'
                  ? 'bg-[#18181B] text-white shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B]'
              }`}
            >
              <Award size={13} className="text-[#F76707]" />
              <span>Loyalty &amp; Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setProfileSubTab('dining_history')}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-bold font-heading flex items-center justify-center gap-1.5 transition-all ${
                profileSubTab === 'dining_history'
                  ? 'bg-[#F76707] text-white shadow-xs'
                  : 'text-[#52525B] hover:text-[#18181B]'
              }`}
            >
              <Receipt size={13} />
              <span>My Dining History</span>
              {diningHistoryReceipts.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tnum ${
                    profileSubTab === 'dining_history'
                      ? 'bg-white text-[#18181B]'
                      : 'bg-[#FFDBCC] text-[#A14000]'
                  }`}
                >
                  {diningHistoryReceipts.length}
                </span>
              )}
            </button>
          </div>

          {profileSubTab === 'dining_history' ? (
            /* ================= MY DINING HISTORY VIEW (LOCALSTORAGE PERSISTED) ================= */
            <div className="space-y-3">
              {/* Dining History Summary Banner */}
              <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                      <History size={15} className="text-[#F76707]" />
                      <span>My Dining History</span>
                    </h3>
                    <p className="text-[11px] text-[#71717A] mt-0.5">
                      Saved receipts &amp; favorite dishes stored locally on this device across sessions
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    localStorage Saved
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-center">
                    <div className="text-[10px] text-[#71717A] font-medium">Receipts</div>
                    <div className="text-base font-extrabold font-heading text-[#18181B] tnum">
                      {diningHistoryReceipts.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-center">
                    <div className="text-[10px] text-[#71717A] font-medium">Favorites</div>
                    <div className="text-base font-extrabold font-heading text-[#F76707] tnum">
                      {favoriteHistoryItems.length}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] text-center">
                    <div className="text-[10px] text-[#71717A] font-medium">Total Spent</div>
                    <div className="text-base font-extrabold font-heading text-emerald-700 tnum">
                      {formatINR(
                        diningHistoryReceipts
                          .filter((r) => r.status !== 'cancelled')
                          .reduce((s, r) => s + (Number(r.grandTotal) || 0), 0)
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Favorite Items from Previous Sessions (Quick Re-Order) */}
              <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                    <Heart size={14} className="text-[#F76707] fill-[#F76707]" />
                    <span>Favorite Dishes from Past Sessions</span>
                  </h4>
                  <span className="text-[10px] font-semibold text-[#71717A]">
                    1-tap Re-Order
                  </span>
                </div>

                {favoriteHistoryItems.length === 0 ? (
                  <div className="p-5 rounded-xl bg-[#FAFAFA] border border-dashed border-[#E4E4E7] text-center space-y-1.5">
                    <Heart size={20} className="text-[#A1A1AA] mx-auto" />
                    <div className="text-xs font-bold text-[#18181B]">
                      No favorite items yet
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Dishes you order across sessions are automatically ranked here for quick re-ordering.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {favoriteHistoryItems.slice(0, 6).map((fav) => {
                      const liveSoldOut =
                        soldOutIdSet.has(fav.menuItemId) ||
                        (fav.menuItem ? isDishSoldOut(fav.menuItem) : false);
                      const unitDisplayPrice =
                        fav.lastOrderItem.quantity > 0
                          ? Math.round(fav.lastOrderItem.itemTotal / fav.lastOrderItem.quantity)
                          : fav.menuItem?.price || fav.lastOrderItem.price;

                      return (
                        <div
                          key={fav.menuItemId || fav.name}
                          className="p-2.5 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center gap-2.5 min-w-0"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#E4E4E7] bg-white shrink-0">
                            <DishImage
                              src={fav.menuItem?.imageUrl ?? fav.menuItem?.image}
                              alt={fav.name}
                              dietType={fav.dietType}
                              grayscale={liveSoldOut}
                              iconSize={18}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <DietaryBadge dietType={fav.dietType} size="sm" showLabel={false} />
                              <span className="text-xs font-bold text-[#18181B] truncate">
                                {fav.name}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px] text-[#71717A]">
                              <span className="font-bold text-[#A14000] bg-[#FFDBCC]/60 px-1.5 py-0.2 rounded">
                                Ordered {fav.orderCount}×
                              </span>
                              <span className="font-bold text-[#18181B] tnum">
                                {formatINR(unitDisplayPrice)}
                              </span>
                              {fav.lastOrderItem.customization?.isJain && (
                                <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold">
                                  Jain
                                </span>
                              )}
                            </div>
                          </div>

                          {liveSoldOut ? (
                            <span className="px-2 py-1 rounded-lg bg-rose-100 border border-rose-200 text-[9px] font-extrabold text-rose-700 shrink-0">
                              Sold Out
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleReorderSingleFavorite(fav.lastOrderItem, fav.menuItem)
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-[10px] font-extrabold font-heading flex items-center gap-1 shrink-0 shadow-2xs"
                            >
                              <Plus size={11} strokeWidth={2.5} />
                              <span>Order</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Previous Receipts List */}
              <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                    <Receipt size={14} className="text-[#F76707]" />
                    <span>Previous Receipts ({filteredDiningReceipts.length})</span>
                  </h4>
                  <div className="flex bg-[#F4F4F5] p-0.5 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        historyFilter === 'all' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                      }`}
                    >
                      All ({diningHistoryReceipts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter('paid')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        historyFilter === 'paid' ? 'bg-white text-[#18181B] shadow-2xs' : 'text-[#71717A]'
                      }`}
                    >
                      Paid Receipts
                    </button>
                  </div>
                </div>

                {filteredDiningReceipts.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#FAFAFA] border border-dashed border-[#E4E4E7] text-center space-y-2">
                    <ShoppingBag size={24} className="text-[#A1A1AA] mx-auto" />
                    <div className="text-xs font-bold text-[#18181B]">
                      {historyFilter === 'paid'
                        ? 'No Paid Receipts Saved Yet'
                        : 'No Previous Dining Receipts Found'}
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Every order and settled receipt is saved automatically in your browser so you can view bills and re-order favorites on return visits.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActivePortalTab('menu')}
                      className="px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-[11px] font-bold font-heading"
                    >
                      Explore Menu
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredDiningReceipts.map((rec) => {
                      const isPaid =
                        rec.paymentStatus === 'paid' || rec.paymentStatus === 'verified_by_staff';
                      const dateLabel = new Date(rec.placedAt || Date.now()).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={rec.id}
                          className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-extrabold font-heading text-[#18181B]">
                                  {rec.orderNumber}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white border border-[#E4E4E7] text-[#52525B]">
                                  Table {rec.tableNumber}
                                </span>
                                <span className="text-[10px] text-[#71717A]">{dateLabel}</span>
                              </div>
                              <div className="text-[10px] text-[#71717A] mt-0.5 truncate">
                                {rec.restaurantName || restaurant.name} • Diner:{' '}
                                <strong className="text-[#18181B]">{rec.dinerName}</strong>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm font-extrabold font-heading text-[#18181B] tnum">
                                {formatINR(rec.grandTotal)}
                              </div>
                              <span
                                className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {isPaid
                                  ? `Paid${
                                      rec.paymentMethod === 'cash'
                                        ? ' • Cash'
                                        : rec.paymentMethod
                                        ? ' • UPI'
                                        : ''
                                    }`
                                  : rec.status}
                              </span>
                            </div>
                          </div>

                          {/* Preview items */}
                          <div className="text-[11px] text-[#52525B] bg-white rounded-xl p-2 border border-[#E4E4E7] space-y-1">
                            {rec.items.slice(0, 3).map((oi) => (
                              <div
                                key={oi.id}
                                className="flex items-center justify-between gap-2 text-[11px]"
                              >
                                <span className="truncate">
                                  <strong className="text-[#18181B]">{oi.quantity}×</strong> {oi.name}
                                </span>
                                <span className="font-bold text-[#18181B] tnum shrink-0">
                                  {formatINR(oi.itemTotal)}
                                </span>
                              </div>
                            ))}
                            {rec.items.length > 3 && (
                              <div className="text-[10px] text-[#71717A] font-medium">
                                +{rec.items.length - 3} more item(s)
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(rec)}
                              className="flex-1 py-2 px-2.5 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[11px] font-bold text-[#18181B] flex items-center justify-center gap-1"
                            >
                              <Receipt size={12} className="text-[#2563EB]" />
                              <span>View Receipt</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderPastOrder(rec)}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-[11px] font-bold font-heading flex items-center justify-center gap-1 shadow-2xs"
                            >
                              <RotateCcw size={12} />
                              <span>Re-Order</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= LOYALTY & PROFILE OVERVIEW ================= */
            <>
          {/* Quick My Dining History Shortcut Card */}
          <div
            onClick={() => setProfileSubTab('dining_history')}
            className="bg-white rounded-2xl p-3.5 border border-[#E4E4E7] shadow-xs flex items-center justify-between gap-3 cursor-pointer hover:border-[#F76707]/60 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#F76707] flex items-center justify-center shrink-0">
                <Receipt size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold font-heading text-[#18181B]">
                  My Dining History &amp; Receipts
                </div>
                <div className="text-[10px] text-[#71717A] truncate">
                  {diningHistoryReceipts.length > 0
                    ? `${diningHistoryReceipts.length} saved receipt(s) • ${favoriteHistoryItems.length} favorite item(s) to re-order`
                    : 'View previous receipts & re-order favorite dishes across sessions'}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-[#18181B] text-white text-[10px] font-bold shrink-0 flex items-center gap-1">
              <span>Open</span>
              <ChevronRight size={12} />
            </span>
          </div>

          {/* Loyalty Wallet Hero Card */}
          <div className="rounded-3xl bg-gradient-to-br from-[#18181B] via-[#27272A] to-[#18181B] text-white p-4 sm:p-5 shadow-lg border border-white/10 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#F76707] flex items-center justify-center text-white shadow-sm shrink-0">
                  <Award size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                    {restaurant.name} Rewards
                  </div>
                  <h3 className="text-sm font-extrabold font-heading truncate">
                    {custName || customer?.name || loyaltyProfile.name || `Table ${table.number} Guest`}
                  </h3>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                {loyaltyProfile.tier} Member
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/10 border border-white/10">
                <div className="text-[10px] text-[#A1A1AA] font-medium">Available Points</div>
                <div className="text-2xl font-extrabold font-heading text-[#F76707] tnum mt-0.5">
                  {loyaltyProfile.pointsBalance} <span className="text-xs font-bold text-white/80">pts</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 border border-white/10">
                <div className="text-[10px] text-[#A1A1AA] font-medium">Credited Orders</div>
                <div className="text-2xl font-extrabold font-heading text-white tnum mt-0.5">
                  {loyaltyProfile.totalOrdersCount}
                </div>
              </div>
            </div>

            {/* Progress to next loyalty tier */}
            {(() => {
              const lifetime = loyaltyProfile.lifetimeEarnedPoints;
              const nextGoal = lifetime >= 1500 ? 1500 : lifetime >= 750 ? 1500 : lifetime >= 250 ? 750 : 250;
              const nextLabel = lifetime >= 1500 ? 'Platinum Max Tier Unlocked' : lifetime >= 750 ? 'Platinum (1500 pts)' : lifetime >= 250 ? 'Gold (750 pts)' : 'Silver (250 pts)';
              const pct = Math.min(100, Math.round((lifetime / nextGoal) * 100));
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-[#D4D4D8]">
                    <span>Lifetime Earned: <strong className="tnum text-white">{lifetime} pts</strong></span>
                    <span>{lifetime >= 1500 ? nextLabel : `Next: ${nextLabel}`}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, pct)}%` }}
                      className="h-full rounded-full bg-[#F76707] transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-[#A1A1AA]">
                    Earn <strong>1 Loyalty Point per ₹10</strong> ordered (minimum <strong>10 pts</strong> per order). Synced across sessions via RealtimeSyncContext.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Diner Identity & Contact Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={15} className="text-[#F76707]" />
                <h4 className="text-xs font-extrabold font-heading text-[#18181B]">
                  Diner Profile Details
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B]">
                Table {table.number}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-[#71717A] uppercase block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-[#71717A] uppercase">
                    Mobile Number
                  </label>
                  {isPhoneVerified && (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                      <CheckCircle2 size={11} /> Verified
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] text-xs font-mono font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
                />
              </div>
            </div>
          </div>

          {/* Loyalty Points History Ledger */}
          <div className="bg-white rounded-2xl p-4 border border-[#E4E4E7] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold font-heading text-[#18181B] flex items-center gap-1.5">
                <Star size={14} className="text-[#F76707]" />
                <span>Points Activity ({loyaltyProfile.transactions.length})</span>
              </h4>
              <span className="text-[10px] font-semibold text-[#71717A]">Auto-credited per order</span>
            </div>

            {loyaltyProfile.transactions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#FAFAFA] border border-dashed border-[#E4E4E7] text-center space-y-2">
                <Award size={24} className="text-[#A1A1AA] mx-auto" />
                <div className="text-xs font-bold text-[#18181B]">
                  No Loyalty Points Earned Yet
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Place your first order from the menu to automatically earn loyalty points!
                </p>
                <button
                  type="button"
                  onClick={() => setActivePortalTab('menu')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F76707] text-white text-[11px] font-bold font-heading"
                >
                  Order &amp; Earn Points
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {loyaltyProfile.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#18181B] truncate">
                        {tx.description || `Order ${tx.orderNumber}`}
                      </div>
                      <div className="text-[10px] text-[#71717A] mt-0.5">
                        {new Date(tx.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-extrabold font-heading tnum shrink-0 ${
                        tx.type === 'earn'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {tx.type === 'earn' ? '+' : '-'}
                      {tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

      {/* Footer Standards Notice */}
      <div className="px-4 py-6 text-center text-[10px] text-[#A1A1AA] space-y-1 mb-14">
        <div className="flex items-center justify-center gap-1.5 font-medium text-[#71717A]">
          <ShieldCheck size={12} className="text-[#16A34A]" />
          <span>{restaurant.name} • Instant Table Ordering</span>
        </div>
        {(restaurant.gstin || restaurant.fssaiLic) && (
          <p>GSTIN: {restaurant.gstin || 'Pending'} • FSSAI: {restaurant.fssaiLic || 'Pending'}</p>
        )}
      </div>

      {/* FLOATING CART BAR */}
      {(cart.length > 0 || activeOrder) && (
        <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 z-40 pointer-events-none">
          <div className="bg-[#18181B] text-white p-3 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between pointer-events-auto">
            <div
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer pl-1"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm text-[#F76707]">
                {cartItemCount > 0 ? cartItemCount : '✓'}
              </div>
              <div>
                <div className="text-sm font-extrabold font-heading text-white tnum">
                  {formatINR(cartTotal > 0 ? cartTotal : activeOrder ? activeOrder.grandTotal : 0)}
                </div>
                <div className="text-[10px] text-[#A1A1AA]">
                  {cart.length > 0
                    ? `${cart.length} new items to fire`
                    : 'Active order in kitchen'}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (cart.length > 0) {
                  setIsCartOpen(true);
                } else if (activeOrder) {
                  setBillingOrder(activeOrder);
                  setIsBillOpen(true);
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-xs flex items-center gap-1"
            >
              <span>{cart.length > 0 ? 'Review & Fire' : 'Pay Bill'}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMIZATION SHEET */}
      {customizingItem && (
        <CustomizationModal
          isOpen={true}
          item={customizingItem as any}
          diners={[{ id: 'd-1', name: dinerName, avatarColor: '#F76707', initials: 'YU' }]}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={(item, custom, qty) => handleAddCustomized(item as any, custom as any, qty)}
        />
      )}

      {/* CART & SLIP MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md mx-auto max-h-[85vh] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-[#F4F4F5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-heading text-[#18181B]">
                  Table {table.number} Order Slip
                </h3>
                <p className="text-[11px] text-[#71717A]">
                  Direct fire to kitchen display system
                </p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-[#71717A]">
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {soldOutInCartItems.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                    <span>Unavailable Item in Order Slip</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    The kitchen marked {soldOutInCartItems.map((i) => i.name).join(', ')} as{' '}
                    <strong>Sold Out</strong>. Remove sold-out items below to fire your order.
                  </p>
                </div>
              )}

              {cart.map((item) => {
                const isCartItemSoldOut = soldOutIdSet.has(item.menuItemId);
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      isCartItemSoldOut
                        ? 'border-rose-300 bg-rose-50/50'
                        : 'border-[#E4E4E7]'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[#18181B] truncate">{item.name}</span>
                        {isCartItemSoldOut && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase">
                            Sold Out
                          </span>
                        )}
                      </div>
                      {item.customization.isJain && (
                        <span className="text-[10px] text-[#854D0E] bg-[#FEFCE8] px-1 rounded-sm">Jain</span>
                      )}
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {formatINR(item.itemTotal)}
                      </div>
                    </div>

                    {isCartItemSoldOut ? (
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((c) => c.id !== item.id))}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
                      >
                        <Trash2 size={11} />
                        <span>Remove</span>
                      </button>
                    ) : (
                      <QuantityStepper
                        size="sm"
                        quantity={item.quantity}
                        onIncrement={() => handleIncrementItem(item.id)}
                        onDecrement={() => handleDecrementItem(item.id)}
                        allowDelete
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#F4F4F5] space-y-3">
              {/* Items Subtotal & Taxes */}
              <div className="space-y-1.5 pb-2 border-b border-[#F4F4F5]">
                <div className="flex justify-between text-xs text-[#52525B]">
                  <span>Items Subtotal</span>
                  <span className="font-bold tnum">{formatINR(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#52525B]">
                  <span>Taxes & GST (5%)</span>
                  <span className="font-bold tnum">{formatINR(cartTotal * 0.05)}</span>
                </div>
              </div>

              {/* Minimal Friction Customer Registration / Recognition Section */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold font-heading text-[#18181B]">
                    <Users size={13} className="text-[#F76707]" />
                    <span>Diner Contact & Verification</span>
                  </div>
                  {customer ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Recognized ({customer.visitCount} visits)
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#71717A]">Quick 1st-time entry</span>
                  )}
                </div>

                {/* Cross-device retrieval toggle */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowLookup(!showLookup)}
                    className="text-[10px] font-bold text-[#F76707] hover:underline"
                  >
                    {showLookup ? 'Cancel Lookup' : 'Dined here before? Enter phone to load profile'}
                  </button>
                </div>

                {/* Cross-device phone lookup panel */}
                {showLookup && (
                  <div className="p-3 bg-white rounded-xl border border-orange-200 space-y-2">
                    <div className="text-[11px] font-bold text-[#18181B]">
                      Restore Profile Across Devices:
                    </div>
                    <div className="flex flex-col xs:flex-row sm:flex-row gap-2">
                      <input
                        type="tel"
                        value={lookupPhone}
                        onChange={(e) => setLookupPhone(e.target.value)}
                        placeholder="Enter mobile (e.g. 9876543210)"
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleStartLookup}
                        disabled={lookupLoading}
                        className="px-3 py-1.5 rounded-lg bg-[#18181B] text-white text-xs font-bold whitespace-nowrap"
                      >
                        {lookupLoading ? 'Sending...' : 'Send OTP'}
                      </button>
                    </div>

                    {lookupOtpSent && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            maxLength={4}
                            value={lookupOtpInput}
                            onChange={(e) => setLookupOtpInput(e.target.value)}
                            placeholder="4-digit OTP"
                            className="w-24 px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-xs font-bold text-center tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyLookup}
                            disabled={lookupLoading}
                            className="px-3 py-1.5 rounded-lg bg-[#F76707] text-white text-xs font-bold"
                          >
                            Verify & Load
                          </button>
                          {lookupTestOtp && (
                            <button
                              type="button"
                              onClick={() => setLookupOtpInput(lookupTestOtp)}
                              className="text-[10px] px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-bold"
                            >
                              Auto OTP ({lookupTestOtp})
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {lookupError && (
                      <div className="text-[11px] text-red-600 font-medium">{lookupError}</div>
                    )}
                  </div>
                )}

                {/* Name & Phone Inputs */}
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-[#71717A] uppercase block mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={custName}
                      onChange={(e) => {
                        setCustName(e.target.value);
                        setDinerName(e.target.value || 'Guest');
                      }}
                      placeholder="e.g. Aarav Sharma"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-[#71717A] uppercase">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      {isPhoneVerified ? (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 size={11} /> OTP Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#A1A1AA]">Required for kitchen slip</span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="tel"
                        value={custPhone}
                        onChange={(e) => {
                          setCustPhone(e.target.value);
                          if (isPhoneVerified) setIsPhoneVerified(false);
                        }}
                        placeholder="e.g. 9876543210"
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-mono font-bold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
                      />
                      {!isPhoneVerified && !otpSent && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpLoading}
                          className="px-2.5 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[10px] font-bold text-[#18181B] whitespace-nowrap shadow-xs shrink-0"
                        >
                          {otpLoading ? 'Sending...' : 'Verify OTP'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline OTP Verification Box */}
                  {!isPhoneVerified && otpSent && (
                    <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#18181B]">
                        <span>Enter 4-digit code:</span>
                        {testOtp && (
                          <button
                            type="button"
                            onClick={() => setOtpInput(testOtp)}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-orange-300 font-bold text-[#F76707]"
                          >
                            Quick Test OTP: {testOtp}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="1234"
                          className="w-24 px-3 py-1.5 rounded-lg border border-[#E4E4E7] bg-white text-xs font-bold text-center tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpLoading}
                          className="px-3 py-1.5 rounded-lg bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold"
                        >
                          {otpLoading ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                      {otpError && <div className="text-[11px] text-red-600 font-medium">{otpError}</div>}
                    </div>
                  )}

                  {/* Optional Marketing Consent Checkbox (UNCHECKED BY DEFAULT) */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#52525B]">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5 rounded text-[#F76707] focus:ring-[#F76707] border-[#D4D4D8] w-4 h-4 shrink-0"
                      />
                      <span className="text-[11px] leading-snug text-[#52525B]">
                        I agree to receive offers, promotions and updates from this restaurant. (Optional)
                      </span>
                    </label>
                  </div>

                  {orderError && (
                    <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      {orderError}
                    </div>
                  )}
                </div>
              </div>

              {/* Fire Order Button */}
              <button
                onClick={handleSendOrder}
                disabled={isFiringOrder || soldOutInCartItems.length > 0}
                className="w-full py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white font-bold font-heading text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
              >
                {soldOutInCartItems.length > 0 ? (
                  <span>Remove Sold Out Items to Fire Order</span>
                ) : isFiringOrder ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Firing to Kitchen...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Fire Order to Kitchen ({formatINR(Math.round(cartTotal * 1.05))})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BILL SPLIT & DUAL PAYMENT MODAL */}
      {isBillOpen && (() => {
        const targetBillOrder = billingOrder || activeOrder;
        return (
          <BillSplitModal
            isOpen={true}
            onClose={() => {
              setIsBillOpen(false);
              setBillingOrder(null);
            }}
            restaurantId={restaurant.id}
            orderId={targetBillOrder?.id}
            customerPhone={custPhone}
            customerName={custName}
            cartItems={
              targetBillOrder
                ? targetBillOrder.items.map((i) => ({
                    cartItemId: i.id,
                    item: menuItems.find((m) => m.id === i.menuItemId) || menuItems[0] || ({
                      id: i.menuItemId,
                      restaurantId: restaurant.id,
                      categoryId: '',
                      name: i.name,
                      description: '',
                      price: i.price,
                      dietType: i.dietType,
                      image: '',
                      isAvailable: true,
                    } as MenuItem),
                    quantity: i.quantity,
                    customization: i.customization as any,
                    itemTotal: i.itemTotal,
                    round: 1,
                    status: 'preparing',
                  }))
                : []
            }
            session={{
              tableNumber: table.number,
              tableName: table.name,
              zone: table.zone,
              captainName: 'Floor Captain',
              openedAt: 'Live',
              gstin: restaurant.gstin,
              fssaiLic: restaurant.fssaiLic,
              activeDiners: [{ id: 'd-1', name: dinerName, avatarColor: '#F76707', initials: 'YU' }],
            }}
            onSelectPayAtRestaurant={(method, billingExtras) => {
              if (targetBillOrder) {
                const updatedOrders = restaurantDb.updateOrderPayment(
                  targetBillOrder.id,
                  'pending_payment',
                  method as any,
                  {
                    restaurantId: restaurant.id,
                    tip: billingExtras?.tip,
                    grandTotal: billingExtras?.grandTotal,
                  }
                );
                const updatedTarget = updatedOrders.find((o) => o.id === targetBillOrder.id);
                recordGuestDiningReceipt({
                  orderId: targetBillOrder.id,
                  orderNumber: targetBillOrder.orderNumber,
                  restaurantId: restaurant.id,
                  restaurantName: restaurant.name,
                  tableNumber: targetBillOrder.tableNumber,
                  dinerName: targetBillOrder.dinerName,
                  phoneNumber: custPhone || undefined,
                  customerToken: storedCustToken,
                  items: targetBillOrder.items,
                  subtotal: targetBillOrder.subtotal,
                  cgst: targetBillOrder.cgst,
                  sgst: targetBillOrder.sgst,
                  serviceCharge: billingExtras?.serviceCharge ?? targetBillOrder.serviceCharge,
                  tip: billingExtras?.tip ?? targetBillOrder.tip,
                  grandTotal: billingExtras?.grandTotal ?? targetBillOrder.grandTotal,
                  paymentStatus: 'pending_payment',
                  paymentMethod: method,
                  placedAt: targetBillOrder.placedAt,
                  status: updatedTarget?.status || targetBillOrder.status,
                });
                restaurantDb.createWaiterRequest(table.number, 'bill_upi', restaurant.id);
                emitOrderEvent({
                  eventType: 'ORDER_STATUS_UPDATED',
                  restaurantId: restaurant.id,
                  orderId: targetBillOrder.id,
                  status: targetBillOrder.status,
                  order: updatedTarget,
                  orders: updatedOrders,
                  tables: restaurantDb.getTables(restaurant.id),
                });
              }
            }}
            onPaymentComplete={(method, billingExtras) => {
              if (targetBillOrder) {
                const updatedOrders = restaurantDb.updateOrderPayment(
                  targetBillOrder.id,
                  'paid',
                  (method as any) || 'online_gateway',
                  {
                    restaurantId: restaurant.id,
                    tip: billingExtras?.tip,
                    grandTotal: billingExtras?.grandTotal,
                  }
                );
                const updatedTarget = updatedOrders.find((o) => o.id === targetBillOrder.id);
                recordGuestDiningReceipt({
                  orderId: targetBillOrder.id,
                  orderNumber: targetBillOrder.orderNumber,
                  restaurantId: restaurant.id,
                  restaurantName: restaurant.name,
                  tableNumber: targetBillOrder.tableNumber,
                  dinerName: targetBillOrder.dinerName,
                  phoneNumber: custPhone || undefined,
                  customerToken: storedCustToken,
                  items: targetBillOrder.items,
                  subtotal: targetBillOrder.subtotal,
                  cgst: targetBillOrder.cgst,
                  sgst: targetBillOrder.sgst,
                  serviceCharge: billingExtras?.serviceCharge ?? targetBillOrder.serviceCharge,
                  tip: billingExtras?.tip ?? targetBillOrder.tip,
                  grandTotal: billingExtras?.grandTotal ?? targetBillOrder.grandTotal,
                  paymentStatus: 'paid',
                  paymentMethod: method || 'upi',
                  placedAt: targetBillOrder.placedAt,
                  paidAt: Date.now(),
                  status: updatedTarget?.status || targetBillOrder.status,
                });
                emitOrderEvent({
                  eventType: 'ORDER_STATUS_UPDATED',
                  restaurantId: restaurant.id,
                  orderId: targetBillOrder.id,
                  status: targetBillOrder.status,
                  order: updatedTarget,
                  orders: updatedOrders,
                  tables: restaurantDb.getTables(restaurant.id),
                });
              }
              onSettleBill(method || 'upi');
              setIsBillOpen(false);
              setBillingOrder(null);
            }}
          />
        );
      })()}

      {/* WAITER PAGING MODAL */}
      {isWaiterOpen && (
        <CallWaiterModal
          isOpen={true}
          onClose={() => setIsWaiterOpen(false)}
          session={{
            tableNumber: table.number,
            tableName: table.name,
            zone: table.zone,
            captainName: 'Floor Staff',
            openedAt: 'Live',
            gstin: restaurant.gstin,
            fssaiLic: restaurant.fssaiLic,
            activeDiners: [],
          }}
          waiterCall={{ active: waiterCallActive }}
          onRequestWaiter={(reason) => {
            handleTriggerWaiterAlert(reason);
          }}
          onCancelRequest={onCancelWaiter}
        />
      )}

      {/* REAL-TIME WEBSOCKET 'ORDER READY' POPUP MODAL */}
      {isAlertModalOpen && activeOrderReadyAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border-2 border-emerald-500 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-center">
            {/* Header with decorative emerald glow */}
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-[#18181B] text-white p-6 relative">
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="absolute top-3 right-3 text-white/70 hover:text-white p-1.5 rounded-full bg-black/20"
              >
                ✕
              </button>

              <div className="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/30 text-white mx-auto flex items-center justify-center shadow-lg mb-3 animate-bounce">
                <ChefHat size={32} />
              </div>

              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white inline-block mb-1">
                Kitchen Alert • Table {table.number}
              </span>

              <h2 className="text-xl font-extrabold font-heading text-white">
                Your Order is Ready!
              </h2>
              <p className="text-xs text-emerald-100 mt-1">
                Order #{activeOrderReadyAlert.orderNumber}
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 leading-relaxed text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-800">
                  <Sparkles size={14} className="text-emerald-600 shrink-0" />
                  <span>Fresh from the Kitchen</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  {activeOrderReadyAlert.message}
                </p>
              </div>

              {/* Items summary if provided */}
              {activeOrderReadyAlert.items && activeOrderReadyAlert.items.length > 0 && (
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase block">
                    Plated Dishes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeOrderReadyAlert.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] text-[11px] font-bold text-[#18181B]"
                      >
                        {it.quantity}x {it.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-[#FAFAFA] rounded-xl text-[11px] text-[#52525B] flex items-center gap-2 text-left">
                <Bell size={14} className="text-[#F76707] shrink-0" />
                <span>
                  Our floor waiter is bringing your food to Table <strong>{table.number}</strong>!
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsAlertModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-heading text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Thank You Chef! (Enjoy Meal)</span>
                </button>

                <button
                  onClick={() => {
                    onCallWaiter('ready_pickup');
                    setIsAlertModalOpen(false);
                  }}
                  className="w-full py-2 rounded-xl border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] text-[11px] font-bold text-[#18181B] transition-all"
                >
                  Page Waiter to Bring to Table
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED DINING RECEIPT VIEWER MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md mx-auto max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E4E4E7]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#F4F4F5] flex items-center justify-between gap-2 bg-[#FAFAFA]">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Receipt size={16} className="text-[#F76707] shrink-0" />
                  <h3 className="text-sm font-extrabold font-heading text-[#18181B] truncate">
                    Tax Invoice Receipt • {selectedReceipt.orderNumber}
                  </h3>
                </div>
                <p className="text-[10px] text-[#71717A] mt-0.5 truncate">
                  {selectedReceipt.restaurantName || restaurant.name} • Table {selectedReceipt.tableNumber} •{' '}
                  {new Date(selectedReceipt.placedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-full bg-white border border-[#E4E4E7] text-[#52525B] hover:text-[#18181B]"
              >
                <X size={15} />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              <div className="p-3 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-[#71717A] block">Guest Name</span>
                  <span className="font-bold text-[#18181B]">{selectedReceipt.dinerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#71717A] block">Payment Status</span>
                  <span
                    className={`font-extrabold ${
                      selectedReceipt.paymentStatus === 'paid' ||
                      selectedReceipt.paymentStatus === 'verified_by_staff'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {selectedReceipt.paymentStatus === 'paid' ||
                    selectedReceipt.paymentStatus === 'verified_by_staff'
                      ? `Paid (${selectedReceipt.paymentMethod === 'cash' ? 'Cash' : 'UPI'})`
                      : selectedReceipt.status}
                  </span>
                </div>
              </div>

              {/* Line Items with individual Re-Order buttons */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">
                  Ordered Dishes ({selectedReceipt.items.length})
                </div>
                <div className="divide-y divide-[#F4F4F5] border border-[#E4E4E7] rounded-2xl overflow-hidden bg-white">
                  {selectedReceipt.items.map((item) => {
                    const liveItem = menuItems.find((m) => m.id === item.menuItemId);
                    const isSoldOut =
                      soldOutIdSet.has(item.menuItemId) ||
                      (liveItem ? isDishSoldOut(liveItem) : false);
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <DietaryBadge dietType={item.dietType} size="sm" showLabel={false} />
                          <div className="min-w-0">
                            <div className="font-bold text-[#18181B] truncate">
                              {item.quantity}× {item.name}
                            </div>
                            <div className="text-[10px] text-[#71717A]">
                              {formatINR(item.itemTotal)}
                              {item.customization?.isJain && ' • Jain'}
                              {item.customization?.portion?.name &&
                                ` • ${item.customization.portion.name}`}
                            </div>
                          </div>
                        </div>
                        {isSoldOut ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            Sold Out
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReorderSingleFavorite(item, liveItem)}
                            className="px-2 py-1 rounded-lg bg-[#FFF4ED] hover:bg-[#F76707] hover:text-white text-[#F76707] border border-[#F76707]/30 text-[10px] font-bold shrink-0 transition-all"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tax & Charges Breakdown */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-[#E4E4E7] space-y-1.5 text-xs">
                <div className="flex justify-between text-[#52525B]">
                  <span>Food &amp; Beverage Subtotal</span>
                  <span className="font-bold text-[#18181B] tnum">
                    {formatINR(selectedReceipt.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#52525B]">
                  <span>CGST (2.5%)</span>
                  <span className="font-semibold text-[#18181B] tnum">
                    {formatINR(selectedReceipt.cgst, true)}
                  </span>
                </div>
                <div className="flex justify-between text-[#52525B]">
                  <span>SGST (2.5%)</span>
                  <span className="font-semibold text-[#18181B] tnum">
                    {formatINR(selectedReceipt.sgst, true)}
                  </span>
                </div>
                {selectedReceipt.serviceCharge > 0 && (
                  <div className="flex justify-between text-[#52525B]">
                    <span>Service Charge</span>
                    <span className="font-semibold text-[#18181B] tnum">
                      {formatINR(selectedReceipt.serviceCharge, true)}
                    </span>
                  </div>
                )}
                {selectedReceipt.tip > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Captain &amp; Kitchen Tip</span>
                    <span className="tnum">+{formatINR(selectedReceipt.tip)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#E4E4E7] flex justify-between items-center text-sm font-extrabold font-heading text-[#18181B]">
                  <span>Grand Total</span>
                  <span className="text-base text-[#F76707] tnum">
                    {formatINR(selectedReceipt.grandTotal)}
                  </span>
                </div>
                {(restaurant.gstin || restaurant.fssaiLic) && (
                  <div className="pt-1 text-[10px] text-[#71717A] text-center font-mono">
                    GSTIN: {restaurant.gstin || 'Registered'} • FSSAI: {restaurant.fssaiLic || 'Registered'}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[#F4F4F5] bg-white flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyReceiptText(selectedReceipt)}
                className="px-3.5 py-2.5 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#F4F4F5] text-xs font-bold text-[#18181B] flex items-center justify-center gap-1.5"
              >
                {copiedReceiptId === selectedReceipt.orderId ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Receipt</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleReorderPastOrder(selectedReceipt)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading flex items-center justify-center gap-1.5 shadow-md"
              >
                <RotateCcw size={14} />
                <span>Re-Order Entire Meal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
