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
        // Clear any cached auth state and redirect to login
        window.location.href = '/';
        return response;
      }
    }
    
    return response;
  };
};

// Call this function to set up the interceptor
if (typeof window !== 'undefined') {
  setupAuthInterceptor();
}
