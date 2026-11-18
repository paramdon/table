import { CartItem, TableSession, WaiterCall } from '../types/dining';

const CHANNEL_NAME = 'tabletop_dining_realtime_channel';
const STORAGE_KEY_PREFIX = 'tabletop_dining_session_';

export interface RealtimeMessage {
  type: 'ORDER_PLACED' | 'STATUS_UPDATED' | 'WAITER_CALLED' | 'WAITER_CLEARED' | 'SESSION_RESET' | 'DINER_JOINED';
  tableNumber: string;
  payload: any;
  timestamp: number;
}

class RealtimeTableManager {
  private channel: BroadcastChannel | null = null;
  private listeners: ((msg: RealtimeMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or failed to initialize', e);
      }

      // Also listen to storage events across tabs
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(STORAGE_KEY_PREFIX) && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            this.notifyListeners({
              type: 'STATUS_UPDATED',
              tableNumber: data.tableNumber,
              payload: data,
              timestamp: Date.now(),
            });
          } catch (err) {
            // ignore
          }
        }
      });
    }
  }

  public subscribe(callback: (msg: RealtimeMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(msg: RealtimeMessage) {
    this.listeners.forEach((cb) => {
      try {
        cb(msg);
      } catch (err) {
        console.error('Error in listener', err);
      }
    });
  }

  public broadcast(tableNumber: string, type: RealtimeMessage['type'], payload: any) {
    const message: RealtimeMessage = {
      type,
      tableNumber,
      payload,
      timestamp: Date.now(),
    };

    if (this.channel) {
      this.channel.postMessage(message);
    }
    this.notifyListeners(message);
  }

  public saveTableState(tableNumber: string, data: { cartItems: CartItem[]; waiterCall: WaiterCall; session: TableSession }) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${tableNumber}`, JSON.stringify(data));
      } catch (e) {
        // storage quota
      }
    }
  }

  public loadTableState(tableNumber: string): { cartItems: CartItem[]; waiterCall: WaiterCall; session?: TableSession } | null {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableNumber}`);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (e) {
        // ignore
      }
    }
    return null;
  }
}

export const realtimeManager = new RealtimeTableManager();
