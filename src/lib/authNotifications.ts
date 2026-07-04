/**
 * Auth Notifications System
 * Contains premium UI alerts for Session Expired (401) and Access Denied (403) states.
 */

// Show session expired notification and redirect after delay
export function showSessionExpiredNotification(onLogout?: () => Promise<void>) {
  if (typeof window === 'undefined') return;
  
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
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(229, 231, 235, 0.5);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      text-align: center;
      min-width: 360px;
      max-width: 90%;
      font-family: system-ui, -apple-system, sans-serif;
      animation: authModalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    ">
      <style>
        @keyframes authModalScaleIn {
          from { transform: translate(-50%, -45%) scale(0.95); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      </style>
      <div style="
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin: 0 auto 20px auto;
      ">⏰</div>
      <h3 style="
        margin: 0 0 8px 0;
        color: #111827;
        font-size: 20px;
        font-weight: 700;
      ">Session Expired</h3>
      <p style="
        margin: 0 0 24px 0;
        color: #4b5563;
        font-size: 14px;
        line-height: 1.5;
      ">Your session has expired. Redirecting to the login screen...</p>
      <div style="
        width: 100%;
        height: 5px;
        background: #f3f4f6;
        border-radius: 99px;
        overflow: hidden;
      ">
        <div id="progress-bar" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #f59e0b);
          border-radius: 99px;
          transition: width 0.1s linear;
        "></div>
      </div>
    </div>
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 9998;
      animation: authOverlayFadeIn 0.2s ease-out forwards;
    ">
      <style>
        @keyframes authOverlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      </style>
    </div>
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

// Show access denied (403) Toast Alert
export function showAccessDeniedNotification(message?: string) {
  if (typeof window === 'undefined') return;

  const notificationId = 'access-denied-toast';
  
  // If one exists, replace it to reset animation
  const existing = document.getElementById(notificationId);
  if (existing) {
    existing.remove();
  }

  const toastMessage = message || 'Access Denied: You do not have permission to perform this action.';
  
  const toast = document.createElement('div');
  toast.id = notificationId;
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 24px;
      right: 24px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      border-left: 5px solid #ef4444;
      border-top: 1px solid rgba(229, 231, 235, 0.5);
      border-right: 1px solid rgba(229, 231, 235, 0.5);
      border-bottom: 1px solid rgba(229, 231, 235, 0.5);
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 320px;
      max-width: 450px;
      font-family: system-ui, -apple-system, sans-serif;
      animation: authToastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    ">
      <style>
        @keyframes authToastSlideIn {
          from { transform: translateX(120%) translateY(0); opacity: 0; }
          to { transform: translateX(0) translateY(0); opacity: 1; }
        }
        @keyframes authToastSlideOut {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to { transform: translateX(120%) scale(0.9); opacity: 0; }
        }
      </style>
      <div style="
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      ">🛡️</div>
      <div style="flex-grow: 1;">
        <h4 style="margin: 0 0 2px 0; color: #111827; font-weight: 600; font-size: 14px;">Permission Restriction</h4>
        <p style="margin: 0; color: #4b5563; font-size: 13px; line-height: 1.4;">${toastMessage}</p>
      </div>
      <button 
        onclick="this.parentElement.parentElement.remove()" 
        style="
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
        "
        onmouseover="this.style.color='#4b5563'"
        onmouseout="this.style.color='#9ca3af'"
      >✕</button>
    </div>
  `;

  document.body.appendChild(toast);

  // Auto remove after 5 seconds with slide-out animation
  setTimeout(() => {
    const el = document.getElementById(notificationId);
    if (el) {
      const container = el.firstElementChild as HTMLElement;
      if (container) {
        container.style.animation = 'authToastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      }
      setTimeout(() => el.remove(), 300);
    }
  }, 5000);
}
