/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RouterProvider, useRouter } from './router/Router';
import { CustomerPortal } from './portals/CustomerPortal';
import { KitchenPortal } from './portals/KitchenPortal';
import { WaiterPortal } from './portals/WaiterPortal';
import { OwnerPortal } from './portals/OwnerPortal';
import { LandingPortal } from './portals/LandingPortal';
import { SuperAdminPortal } from './portals/SuperAdminPortal';
import { StaffLoginPortal } from './portals/StaffLoginPortal';
import { StaffOnboardingPortal } from './portals/StaffOnboardingPortal';
import { RealtimeSyncProvider } from './context/RealtimeSyncContext';
import { ThemeProvider } from './context/ThemeContext';

function PortalRouter() {
  const { path, tableId } = useRouter();

  if (path === '/customer' || tableId) {
    return <CustomerPortal />;
  }

  switch (path) {
    case '/kitchen':
      return <KitchenPortal />;
    case '/waiter':
      return <WaiterPortal />;
    case '/owner':
    case '/owner/billing':
      return <OwnerPortal />;
    case '/staff-login':
      return <StaffLoginPortal />;
    case '/onboard':
      return <StaffOnboardingPortal />;
    case '/admin':
      return <SuperAdminPortal />;
    case '/pricing':
      return <LandingPortal initialFocus="pricing" />;
    case '/':
    default:
      return <LandingPortal />;
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <RealtimeSyncProvider>
          <PortalRouter />
        </RealtimeSyncProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
