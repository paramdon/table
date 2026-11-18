export type PortalRole = 'customer' | 'kitchen' | 'waiter' | 'owner' | 'manager';

export interface StaffAuthSession {
  sessionToken: string;
  staffId: string;
  staffName: string;
  username: string;
  role: PortalRole;
  roleTitle: string;
  permissions: string[];
  restaurantId: string;
  deviceId: string;
  deviceName: string;
  authenticatedAt: number;
}

const STORAGE_SESSION_KEY = 'urdearmenu_trusted_staff_session';
const DEFAULT_RESTAURANT_ID = 'demo-restaurant';

class PortalAuthService {
  private currentSession: StaffAuthSession | null = null;
  private subscribers: Array<(session: StaffAuthSession | null, isRevoked?: boolean) => void> = [];
  private heartbeatTimer: any = null;

  constructor() {
    this.currentSession = this.loadStoredSession();
    if (typeof window !== 'undefined') {
      this.startHeartbeat();
    }
  }

  private loadStoredSession(): StaffAuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  private saveSession(session: StaffAuthSession | null) {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      if (session) {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    }
    this.notifySubscribers(session);
  }

  public setSession(session: StaffAuthSession | null): void {
    this.saveSession(session);
  }

  private notifySubscribers(session: StaffAuthSession | null, isRevoked = false) {
    this.subscribers.forEach((cb) => {
      try {
        cb(session, isRevoked);
      } catch (e) {
        console.error('Subscriber callback error', e);
      }
    });
  }

  public subscribe(callback: (session: StaffAuthSession | null, isRevoked?: boolean) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  // Heartbeat to check with server if device session is active or revoked
  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      if (this.currentSession?.sessionToken) {
        await this.verifyServerSession();
      }
    }, 6000);
  }

  public async verifyServerSession(): Promise<{ valid: boolean; error?: string; isRevoked?: boolean }> {
    if (!this.currentSession?.sessionToken) {
      return { valid: false };
    }

    try {
      const res = await fetch('/api/auth/verify-session', {
        headers: {
          Authorization: `Bearer ${this.currentSession.sessionToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.isRevoked || data.isDisabled || res.status === 401) {
          console.warn('[d.cc Auth] Session revoked or rejected by server:', data.error);
          this.saveSession(null);
          this.notifySubscribers(null, true);
          return { valid: false, error: data.error || 'Device session revoked', isRevoked: true };
        }
      }

      return { valid: true };
    } catch (e) {
      // Network error; preserve cached session
      return { valid: true };
    }
  }

  public getSession(roleFilter?: PortalRole): StaffAuthSession | null {
    if (!this.currentSession) {
      this.currentSession = this.loadStoredSession();
    }
    if (!this.currentSession) return null;
    if (roleFilter && roleFilter !== this.currentSession.role) {
      // Role mismatch
      return null;
    }
    return this.currentSession;
  }

  public async loginWithCredentials(
    username: string,
    password: string,
    restaurantId = DEFAULT_RESTAURANT_ID,
    customDeviceName?: string
  ): Promise<{
    success: boolean;
    error?: string;
    session?: StaffAuthSession;
    requiresPasswordChange?: boolean;
    tempToken?: string;
    staffId?: string;
  }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          restaurantId,
          customDeviceName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Authentication failed. Please check your credentials.',
        };
      }

      if (data.requiresPasswordChange) {
        return {
          success: true,
          requiresPasswordChange: true,
          staffId: data.staffId,
          tempToken: data.tempToken,
        };
      }

      const session: StaffAuthSession = {
        sessionToken: data.session.sessionToken,
        staffId: data.session.staffId,
        staffName: data.session.staffName,
        username: data.session.username,
        role: data.session.role,
        roleTitle: data.session.roleTitle,
        permissions: data.session.permissions,
        restaurantId: data.session.restaurantId,
        deviceId: data.session.deviceId,
        deviceName: data.session.deviceName,
        authenticatedAt: Date.now(),
      };

      this.saveSession(session);
      return { success: true, session };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Network connection failed during authentication.',
      };
    }
  }

  public async onboardWithInvitation(
    token: string,
    newPassword: string,
    customDeviceName?: string
  ): Promise<{ success: boolean; error?: string; session?: StaffAuthSession }> {
    try {
      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, customDeviceName }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Onboarding failed.' };
      }

      const session: StaffAuthSession = {
        sessionToken: data.session.sessionToken,
        staffId: data.session.staffId,
        staffName: data.session.staffName,
        username: data.session.username,
        role: data.session.role,
        roleTitle: data.session.roleTitle,
        permissions: data.session.permissions,
        restaurantId: data.session.restaurantId,
        deviceId: data.session.deviceId,
        deviceName: data.session.deviceName,
        authenticatedAt: Date.now(),
      };

      this.saveSession(session);
      return { success: true, session };
    } catch (e: any) {
      return { success: false, error: e.message || 'Could not complete onboarding.' };
    }
  }

  public async changeFirstTimePassword(
    staffId: string,
    tempToken: string,
    newPassword: string,
    customDeviceName?: string
  ): Promise<{ success: boolean; error?: string; session?: StaffAuthSession }> {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, tempToken, newPassword, customDeviceName }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Password update failed.' };
      }

      const session: StaffAuthSession = {
        sessionToken: data.session.sessionToken,
        staffId: data.session.staffId,
        staffName: data.session.staffName,
        username: data.session.username,
        role: data.session.role,
        roleTitle: data.session.roleTitle,
        permissions: data.session.permissions,
        restaurantId: data.session.restaurantId,
        deviceId: data.session.deviceId,
        deviceName: data.session.deviceName,
        authenticatedAt: Date.now(),
      };

      this.saveSession(session);
      return { success: true, session };
    } catch (e: any) {
      return { success: false, error: e.message || 'Password update request failed.' };
    }
  }

  public async logout(role?: PortalRole): Promise<void> {
    if (this.currentSession?.sessionToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.currentSession.sessionToken}`,
          },
        });
      } catch (e) {
        // Continue with local clear
      }
    }
    this.saveSession(null);
  }

  // Compatibility helper for quick testing
  public getDefaultPin(role: PortalRole): string {
    const pins: Record<string, string> = {
      kitchen: '1234',
      waiter: '2345',
      owner: '9999',
    };
    return pins[role] || '';
  }

  public getQuickCredentials(role: PortalRole): { username: string; defaultPassword: string } {
    switch (role) {
      case 'kitchen':
        return { username: 'chef_gurpreet', defaultPassword: 'chef123' };
      case 'waiter':
        return { username: 'waiter_rajesh', defaultPassword: 'waiter123' };
      case 'owner':
        return { username: 'owner', defaultPassword: 'owner9999' };
      default:
        return { username: '', defaultPassword: '' };
    }
  }
}

export const portalAuth = new PortalAuthService();
