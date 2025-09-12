'use client';

import Header from "./header";
import Footer from "./footer";
import { NotificationProvider } from "./notifications/components/contexts/NotificationContext";
import { DateFilterProvider } from "./contexts/DateFilterContext";
import AuthGuard from '@/components/AuthGuard';
import './base.css';

export default function ExecutiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <NotificationProvider>
        <DateFilterProvider defaultPeriod="Last 30 Days">
          <div className="executive-todo-container">
            <Header />
            <main>
              {children}
            </main>
            <Footer />
          </div>
        </DateFilterProvider>
      </NotificationProvider>
    </AuthGuard>
  );
}
