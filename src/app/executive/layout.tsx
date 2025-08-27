import type { Metadata } from "next";
import Header from "./header";
import Footer from "./footer";
import { NotificationProvider } from "../../contexts/NotificationContext";

export const metadata: Metadata = {
  title: "Executive Dashboard",
  description: "Executive task management dashboard",
};

export default function ExecutiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NotificationProvider>
      <div className="executive-todo-container">
        <Header />
        <main>
          {children}
        </main>
        <Footer />
      </div>
    </NotificationProvider>
  );
}
