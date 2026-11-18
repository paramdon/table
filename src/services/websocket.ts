import { OrderReadyWsAlert, WaiterCallWsAlert } from '../types/dcc';

export type WsConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WsRegistrationPayload {
  role: 'customer' | 'kitchen' | 'waiter' | 'owner';
  restaurantId: string;
  tableNumber?: string;
  customerToken?: string;
  staffName?: string;
}

export type OrderReadyListener = (alert: OrderReadyWsAlert) => void;
export type WaiterCallListener = (alert: WaiterCallWsAlert) => void;
export type ConnectionStatusListener = (status: WsConnectionStatus) => void;
export type GenericWsMessageListener = (data: any) => void;

class RealtimeWebSocketClient {
  private ws: WebSocket | null = null;
  private status: WsConnectionStatus = 'disconnected';
  private registrationPayload: WsRegistrationPayload | null = null;
  private orderReadyListeners: Set<OrderReadyListener> = new Set();
  private waiterCallListeners: Set<WaiterCallListener> = new Set();
  private statusListeners: Set<ConnectionStatusListener> = new Set();
  private messageListeners: Set<GenericWsMessageListener> = new Set();
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 8000;
  private isIntentionallyClosed = false;

  constructor() {
    // Lazy connect on registration or explicit connect
  }

  public register(payload: WsRegistrationPayload) {
    this.registrationPayload = payload;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'register',
        ...payload,
      });
      return;
    }
    this.connect();
  }

  public updateTableNumber(tableNumber: string) {
    if (this.registrationPayload) {
      this.registrationPayload.tableNumber = tableNumber;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'register',
          ...this.registrationPayload,
        });
      }
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.setStatus('connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;

        // Register session immediately on connection
        if (this.registrationPayload) {
          this.send({
            type: 'register',
            ...this.registrationPayload,
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Broadcast to generic real-time message listeners (cart_sync, order_sync, etc.)
          this.messageListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('[WS] Message listener error:', err);
            }
          });

          if (data.type === 'order_ready_alert') {
            const alertData: OrderReadyWsAlert = {
              type: 'order_ready_alert',
              orderId: data.orderId,
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              message: data.message || 'Your order is hot and ready!',
              items: data.items || [],
              timestamp: data.timestamp || Date.now(),
            };

            // Play auditory chime for alert
            this.playOrderReadyChime();

            // Notify all customer listeners
            this.orderReadyListeners.forEach((listener) => {
              try {
                listener(alertData);
              } catch (err) {
                console.error('[WS] Listener error:', err);
              }
            });
          } else if (data.type === 'waiter_call_alert') {
            const waiterAlert: WaiterCallWsAlert = {
              type: 'waiter_call_alert',
              requestId: data.requestId || `wreq_${Date.now()}`,
              restaurantId: data.restaurantId || '',
              tableNumber: data.tableNumber || '',
              reason: data.reason || 'Assistance Needed',
              details: data.details,
              status: data.status || 'pending',
              timestamp: data.timestamp || Date.now(),
            };

            // Play alert sound for waitstaff
            this.playWaiterCallChime();

            // Notify all waiter listeners
            this.waiterCallListeners.forEach((listener) => {
              try {
                listener(waiterAlert);
              } catch (err) {
                console.error('[WS] Waiter listener error:', err);
              }
            });
          }
        } catch (err) {
          console.warn('[WS] Parse message error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Connection error:', err);
        this.setStatus('error');
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.ws = null;

        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[WS] Connection setup failed:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  public onMessage(listener: GenericWsMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public sendCartSync(payload: {
    restaurantId: string;
    tableNumber: string;
    dinerName?: string;
    items: any[];
    itemCount: number;
    cartTotal: number;
    updatedAt?: number;
  }) {
    return this.send({
      type: 'cart_sync',
      ...payload,
      updatedAt: payload.updatedAt || Date.now(),
    });
  }

  public sendOrderSync(payload: any) {
    return this.send({
      type: 'order_sync',
      ...payload,
      timestamp: Date.now(),
    });
  }

  public sendInventoryUpdate(payload: {
    restaurantId: string;
    itemId: string;
    itemName?: string;
    isAvailable: boolean;
    stockStatus: 'in_stock' | 'low_stock' | 'sold_out';
    remainingCount?: number;
    updatedBy?: string;
  }) {
    return this.send({
      type: 'inventory_updated',
      ...payload,
      timestamp: Date.now(),
    });
  }

  /**
   * Kitchen staff sends 'Order Ready' alert directly to customer session at corresponding table
   */
  public async sendOrderReadyAlert({
    restaurantId,
    tableNumber,
    orderId,
    orderNumber,
    message,
    items,
  }: {
    restaurantId: string;
    tableNumber: string;
    orderId: string;
    orderNumber: string;
    message?: string;
    items?: Array<{ name: string; quantity: number }>;
  }): Promise<{ success: boolean; deliveredToCustomerCount?: number }> {
    // Clean table number (e.g. "Table 01" -> "01")
    const cleanTable = String(tableNumber).replace(/^Table\s*/i, '').trim();

    // 1. Send via active WebSocket connection if open
    const sentViaWs = this.send({
      type: 'send_order_ready_alert',
      restaurantId,
      tableNumber: cleanTable,
      orderId,
      orderNumber,
      message,
      items,
    });

    // 2. Also call backend REST endpoint to ensure delivery and persist status
    try {
      const res = await fetch('/api/kitchen/alert-order-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          tableNumber: cleanTable,
          orderId,
          orderNumber,
          message,
          items,
        }),
      });
      const data = await res.json();
      return {
        success: data.success || sentViaWs,
        deliveredToCustomerCount: data.deliveredToCustomerCount || 0,
      };
    } catch (err) {
      console.warn('[WS] REST fallback failed, sentViaWs:', sentViaWs, err);
      return { success: sentViaWs };
    }
  }

  /**
   * Customer triggers an 'Alert Waiter' event to floor waitstaff
   */
  public async sendWaiterCallAlert({
    restaurantId,
    tableNumber,
    reason,
    details,
  }: {
    restaurantId: string;
    tableNumber: string;
    reason: string;
    details?: string;
  }): Promise<{ success: boolean; cooldownSeconds?: number; requestId?: string }> {
    const cleanTable = String(tableNumber).replace(/^Table\s*/i, '').trim();

    // 1. Send via WebSocket if connected
    const sentViaWs = this.send({
      type: 'send_waiter_call',
      restaurantId,
      tableNumber: cleanTable,
      reason,
      details,
    });

    // 2. Also call backend REST endpoint
    try {
      const res = await fetch('/api/customer/alert-waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          tableNumber: cleanTable,
          reason,
          details,
        }),
      });
      const data = await res.json();
      return {
        success: data.success || sentViaWs,
        cooldownSeconds: data.cooldownSeconds || 60,
        requestId: data.requestId,
      };
    } catch (err) {
      console.warn('[WS] Alert waiter REST fallback error, sentViaWs:', sentViaWs, err);
      return { success: sentViaWs, cooldownSeconds: 60 };
    }
  }

  public onOrderReadyAlert(listener: OrderReadyListener): () => void {
    this.orderReadyListeners.add(listener);
    return () => {
      this.orderReadyListeners.delete(listener);
    };
  }

  public onWaiterCallAlert(listener: WaiterCallListener): () => void {
    this.waiterCallListeners.add(listener);
    return () => {
      this.waiterCallListeners.delete(listener);
    };
  }

  public onConnectionStatus(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getStatus(): WsConnectionStatus {
    return this.status;
  }

  private setStatus(status: WsConnectionStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[WS] Status listener error:', err);
      }
    });
  }

  /**
   * Delightful two-tone chime synthesis using Web Audio API
   */
  public playOrderReadyChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // First bell note: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.6);

      // Second bell note: G5 (783.99 Hz) for high-energy dining alert
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.9);
    } catch (e) {
      // Audio playback restrictions fallback
    }
  }

  /**
   * Paging chime for waitstaff floor terminal (3-tone ascending alert: E5, G5, B5)
   */
  public playWaiterCallChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
      });
    } catch (e) {
      // Audio playback restrictions fallback
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export const realtimeWs = new RealtimeWebSocketClient();
