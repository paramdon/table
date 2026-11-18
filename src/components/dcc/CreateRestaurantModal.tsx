import React, { useState } from 'react';
import { Building2, X, Check, Sparkles, Store, MapPin, ShieldCheck, Wifi } from 'lucide-react';
import { RestaurantTenant } from '../../types/dcc';

interface CreateRestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRestaurant: RestaurantTenant;
  onSaveRestaurant: (restaurant: RestaurantTenant) => void;
}

export const CreateRestaurantModal: React.FC<CreateRestaurantModalProps> = ({
  isOpen,
  onClose,
  currentRestaurant,
  onSaveRestaurant,
}) => {
  const [name, setName] = useState(currentRestaurant.name || 'Royal Spice Dining Room');
  const [tagline, setTagline] = useState(currentRestaurant.tagline || 'Modern Indian Bistro & Tandoor');
  const [address, setAddress] = useState(currentRestaurant.address || 'Sector 29, Gurugram, Haryana');
  const [phone, setPhone] = useState(currentRestaurant.phone || '+91 98112 34567');
  const [gstin, setGstin] = useState(currentRestaurant.gstin || '06AAACR1234F1Z8');
  const [fssaiLic, setFssaiLic] = useState(currentRestaurant.fssaiLic || '10823005000412');
  const [wifiSsid, setWifiSsid] = useState(currentRestaurant.wifiSsid || 'RoyalSpice_Guest');
  const [wifiPassword, setWifiPassword] = useState(currentRestaurant.wifiPassword || 'Spice@2025');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: RestaurantTenant = {
      ...currentRestaurant,
      id: `rest-${Date.now()}`,
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      gstin: gstin.trim(),
      fssaiLic: fssaiLic.trim(),
      wifiSsid: wifiSsid.trim(),
      wifiPassword: wifiPassword.trim(),
    };

    onSaveRestaurant(updated);
    onClose();
  };

  const handleQuickPreset = (presetName: string, presetTagline: string) => {
    setName(presetName);
    setTagline(presetTagline);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#E4E4E7] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#F4F4F5] flex items-center justify-between bg-[#18181B] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F76707] flex items-center justify-center text-white shadow-xs">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold font-heading">
                Create & Setup Restaurant
              </h3>
              <p className="text-[11px] text-[#A1A1AA]">
                Step 1 of MVP: Onboard restaurant profile for QR ordering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Quick Presets */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] block mb-1.5">
              Quick Suggestions:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('The Saffron Verandah', 'Courtyard Awadhi & Tandoor')}
                className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#F4F4F5] text-[11px] font-medium text-[#18181B]"
              >
                The Saffron Verandah
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Haveli Dhaba & Bistro', 'Heritage Punjabi Specialties')}
                className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#F4F4F5] text-[11px] font-medium text-[#18181B]"
              >
                Haveli Dhaba & Bistro
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Dakshin coastal Cafe', 'Chettinad & Malabar Flavors')}
                className="px-2.5 py-1 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#F4F4F5] text-[11px] font-medium text-[#18181B]"
              >
                Dakshin Coastal Cafe
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                Restaurant Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Royal Spice Dining Room"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs font-semibold text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                Cuisine / Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Modern Indian Dining & Tandoor"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                Address & City
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Indiranagar 100ft Road, Bengaluru, Karnataka"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                GSTIN Number (for 5% GST bill)
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 06AAACR1234F1Z8"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white font-mono text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                FSSAI License Number
              </label>
              <input
                type="text"
                value={fssaiLic}
                onChange={(e) => setFssaiLic(e.target.value)}
                placeholder="e.g. 10823005000412"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white font-mono text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                Guest Wi-Fi SSID
              </label>
              <input
                type="text"
                value={wifiSsid}
                onChange={(e) => setWifiSsid(e.target.value)}
                placeholder="e.g. RoyalSpice_Guest"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#18181B] block mb-1">
                Guest Wi-Fi Password
              </label>
              <input
                type="text"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="e.g. Spice@2025"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] bg-white text-xs text-[#18181B] focus:outline-hidden focus:border-[#F76707]"
              />
            </div>
          </div>

          <div className="p-3 bg-[#F0FDF4] border border-[#16A34A]/25 rounded-2xl flex items-center gap-2 text-xs text-[#16A34A]">
            <ShieldCheck size={16} className="shrink-0" />
            <span>Configures instant tabletop QR generator, kitchen KDS tickets, and diner bills.</span>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#E4E4E7] text-xs font-bold text-[#71717A] hover:bg-[#FAFAFA] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[#F76707] hover:bg-[#D85800] text-white text-xs font-bold font-heading shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={14} strokeWidth={3} />
              <span>Create / Save Restaurant</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
