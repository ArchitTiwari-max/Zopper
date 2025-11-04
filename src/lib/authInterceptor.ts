// Global fetch interceptor to handle authentication failures
export const setupAuthInterceptor = () => {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch globally
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    // If we get a 401 and it's not the login or auth verification endpoints
    if (response.status === 401) {
      const url = args[0] as string;
      
      // Don't redirect if this is already an auth-related API call
      if (!url.includes('/api/auth/')) {
        // Show session expired notification
        showSessionExpiredNotification();
        return response;
      }
    }
    
    return response;
  };
};

// Show session expired notification and redirect after delay
function showSessionExpiredNotification() {
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
  
  const interval = setInterval(() => {
    progress += 100 / 30; // 30 steps over 3 seconds
    if (progressBar) {
      progressBar.style.width = Math.min(progress, 100) + '%';
    }
    
    if (progress >= 100) {
      clearInterval(interval);
      window.location.href = '/';
    }
  }, 100);
}

// Call this function to set up the interceptor
if (typeof window !== 'undefined') {
  setupAuthInterceptor();
}
