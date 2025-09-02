'use client';

import Header from "./header";
import Footer from "./footer";
import { NotificationProvider } from "./notifications/components/contexts/NotificationContext";
import AuthGuard from '@/components/AuthGuard';
import './base.css';

export default function ExecutiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
   // <AuthGuard>
      <NotificationProvider>
        <div className="executive-todo-container">
          <Header />
          <main>
            {children}
          </main>
          <Footer />
        </div>
      </NotificationProvider>
 //</AuthGuard>
  );
}
