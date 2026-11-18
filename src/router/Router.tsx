import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppPath =
  | '/customer'
  | '/kitchen'
  | '/waiter'
  | '/owner'
  | '/owner/billing'
  | '/staff-login'
  | '/onboard'
  | '/admin'
  | '/pricing'
  | '/';

interface RouterContextType {
  path: AppPath;
  queryParams: URLSearchParams;
  tableId: string | null;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  path: '/',
  queryParams: new URLSearchParams(),
  tableId: null,
  navigate: () => {},
});

function parseCombinedSearchParams(search: string, hash = ''): URLSearchParams {
  const params = new URLSearchParams(search || '');
  if (hash && hash.includes('?')) {
    const hashQuery = hash.slice(hash.indexOf('?') + 1);
    const hashParams = new URLSearchParams(hashQuery);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }
  return params;
}

function normalizePath(pathname: string, params?: URLSearchParams, hash = ''): AppPath {
  const effectivePath =
    hash && hash.startsWith('#/')
      ? hash.slice(1).split('?')[0]
      : pathname;
  const clean = effectivePath.toLowerCase().replace(/\/+$/, '') || '/';

  // Explicitly route any QR URL carrying a table identifier directly to the CustomerPortal
  const hasTableQuery = Boolean(
    params && (params.get('table') || params.get('tbl') || params.get('tableId'))
  );
  if (clean.startsWith('/customer') || hasTableQuery) {
    return '/customer';
  }

  if (clean.startsWith('/kitchen')) return '/kitchen';
  if (clean.startsWith('/waiter')) return '/waiter';
  if (clean.startsWith('/owner/billing')) return '/owner/billing';
  if (clean.startsWith('/owner')) return '/owner';
  if (clean.startsWith('/staff-login')) return '/staff-login';
  if (clean.startsWith('/onboard')) return '/onboard';
  if (clean.startsWith('/admin')) return '/admin';
  if (clean.startsWith('/pricing')) return '/pricing';
  return '/';
}

function readLocationState(): { path: AppPath; queryParams: URLSearchParams; tableId: string | null } {
  if (typeof window === 'undefined') {
    return { path: '/', queryParams: new URLSearchParams(), tableId: null };
  }
  const params = parseCombinedSearchParams(window.location.search, window.location.hash);
  const path = normalizePath(window.location.pathname, params, window.location.hash);
  const tableId = params.get('tableId') || params.get('table') || params.get('tbl') || null;
  return { path, queryParams: params, tableId };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [routeState, setRouteState] = useState(readLocationState);

  useEffect(() => {
    const handleLocationChange = () => {
      setRouteState(readLocationState());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigate = (to: string) => {
    if (typeof window !== 'undefined') {
      const targetUrl = new URL(to, window.location.origin);
      const params = parseCombinedSearchParams(targetUrl.search, targetUrl.hash);
      const resolvedPath = normalizePath(targetUrl.pathname, params, targetUrl.hash);
      const nextUrl = `${resolvedPath}${targetUrl.search}`;
      window.history.pushState({}, '', nextUrl);
      const tableId = params.get('tableId') || params.get('table') || params.get('tbl') || null;
      setRouteState({
        path: resolvedPath,
        queryParams: params,
        tableId,
      });
    }
  };

  return (
    <RouterContext.Provider
      value={{
        path: routeState.path,
        queryParams: routeState.queryParams,
        tableId: routeState.tableId,
        navigate,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => useContext(RouterContext);
