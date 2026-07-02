// Global fetch interceptor to handle authentication failures and silent token refresh
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
    
    return response;
  };
};

// Show session expired notification and redirect after delay
function showSessionExpiredNotification(onLogout?: () => Promise<void>) {
  // Prevent multiple notifications
  if (document.getElementById('session-expired-notification')) {
    return;
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'session-expired-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      text-align: center;
      min-width: 320px;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        color: #ef4444;
        font-size: 48px;
        margin-bottom: 16px;
      ">⏰</div>
      <h3 style="
        margin: 0 0 8px 0;
        color: #111827;
        font-size: 18px;
        font-weight: 600;
      ">Session Expired</h3>
      <p style="
        margin: 0 0 16px 0;
        color: #6b7280;
        font-size: 14px;
      ">Your session has expired. Redirecting to login...</p>
      <div style="
        width: 100%;
        height: 4px;
        background: #f3f4f6;
        border-radius: 2px;
        overflow: hidden;
      ">
        <div id="progress-bar" style="
          width: 0%;
          height: 100%;
          background: #3b82f6;
          transition: width 0.1s ease;
        "></div>
      </div>
    </div>
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    "></div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate progress bar and redirect after 3 seconds
  let progress = 0;
  const progressBar = notification.querySelector('#progress-bar') as HTMLElement;
  
  const interval = setInterval(async () => {
    progress += 100 / 30; // 30 steps over 3 seconds
    if (progressBar) {
      progressBar.style.width = Math.min(progress, 100) + '%';
    }
    
    if (progress >= 100) {
      clearInterval(interval);
      if (onLogout) {
        await onLogout();
      } else {
        window.location.href = '/';
      }
    }
  }, 100);
}
