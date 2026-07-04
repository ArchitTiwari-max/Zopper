// Global fetch interceptor to handle authentication failures, forbidden operations, and silent token refresh
import { showSessionExpiredNotification, showAccessDeniedNotification } from './authNotifications';

let isInterceptorSetup = false;

export const setupAuthInterceptor = (
  onRefreshAuth?: () => Promise<any>,
  onLogout?: () => Promise<void>
) => {
  if (typeof window === 'undefined') return;
  if (isInterceptorSetup) return;
  isInterceptorSetup = true;

  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch globally
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    let urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Automatically attach credentials for internal API calls
    const isInternal = urlString.startsWith('/') || urlString.startsWith(window.location.origin);
    if (isInternal) {
      init.credentials = init.credentials || 'include';
    }

    let response = await originalFetch(input, init);
    
    // If we get a 401 and it's not the login or auth verification endpoints
    if (response.status === 401 && !urlString.includes('/api/auth/')) {
      // Try to silently refresh token if callback is provided
      if (onRefreshAuth) {
        try {
          const refreshedUser = await onRefreshAuth();
          if (refreshedUser) {
            // Retry the original request with refreshed cookies
            return await originalFetch(input, init);
          }
        } catch (error) {
          console.error('Silent token refresh failed:', error);
        }
      }

      // Show session expired notification and trigger logout
      showSessionExpiredNotification(onLogout);
      return response;
    }

    // Handle 403 Forbidden (Access Denied) responses globally
    if (response.status === 403) {
      try {
        // Try to read custom error message from API response JSON if available
        const clone = response.clone();
        const data = await clone.json();
        showAccessDeniedNotification(data?.error || data?.message);
      } catch {
        showAccessDeniedNotification();
      }
    }
    
    return response;
  };
};

