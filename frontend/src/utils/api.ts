// frontend/src/utils/api.ts
/* ------------------------------------------------------------------ */
/* Build backend base URL (honours HTTPS vs HTTP)                     */
/* ------------------------------------------------------------------ */
export const BACKEND_BASE = (() => {
  const proto = location.protocol === 'https:' ? 'https' : 'http';
  return `${proto}://${location.hostname}:3000`;
})();

/* ------------------------------------------------------------------ */
/* Auto-refresh token management                                      */
/* ------------------------------------------------------------------ */
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/refresh`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update user data in localStorage if available
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        return true;
      } else {
        // Refresh failed - redirect to login
        localStorage.removeItem('user');
        window.location.hash = '/login';
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('user');
      window.location.hash = '/login';
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ------------------------------------------------------------------ */
/* Enhanced fetch with auto-retry on 401 (token expired)             */
/* ------------------------------------------------------------------ */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BACKEND_BASE}${path}`;
  const finalOpts: RequestInit = {
    credentials: 'include',
    ...opts
  };

  let response = await fetch(url, finalOpts);

  // If 401 and not already a refresh request, try refreshing token
  if (response.status === 401 && !path.includes('/refresh') && !path.includes('/login') && !path.includes('/signup')) {
    const refreshSuccess = await refreshToken();
    
    if (refreshSuccess) {
      // Retry the original request with new token
      response = await fetch(url, finalOpts);
    }
  }

  return response;
}

/* ------------------------------------------------------------------ */
/* WebSocket scheme helper                                            */
/* ------------------------------------------------------------------ */
export function wsBase(): string {
  return location.protocol === 'https:' ? 'wss' : 'ws';
}
