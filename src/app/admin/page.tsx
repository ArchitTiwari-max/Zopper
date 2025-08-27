'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AdminPage: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard by default
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '1.2rem',
      color: '#64748b'
    }}>
      Redirecting to admin dashboard...
    </div>
  );
};

export default AdminPage;
