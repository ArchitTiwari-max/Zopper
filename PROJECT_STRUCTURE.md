# ZopperTrack - Project Structure

This Next.js project is organized into separate sections with their own layouts and routing patterns.

## 📁 **Project Structure**

```
src/app/
├── layout.tsx                 # Minimal root layout (fonts, global styles only)
├── page.tsx                   # Landing page showing "Hi"
├── globals.css                # Global styles
├── favicon.ico                # App favicon
├── 
├── admin/                     # 🔒 ADMIN SECTION
│   ├── layout.tsx             # Admin-specific layout (sidebar, admin header)
│   ├── page.tsx               # Admin root (redirects to dashboard)
│   ├── types.ts               # TypeScript interfaces for admin
│   ├── styles.css             # Admin dashboard styles
│   ├── README.md              # Admin documentation
│   └── dashboard/
│       └── page.tsx           # Admin dashboard page
│
└── executive/                 # 👤 EXECUTIVE SECTION
    ├── layout.tsx             # Executive-specific layout (header, footer)
    ├── page.tsx               # Executive root (shows dashboard)
    ├── header.tsx             # Executive header component
    ├── footer.tsx             # Executive footer component
    ├── dashboard/             # Executive dashboard
    ├── executive-form/        # Executive form pages
    ├── executive-todo-list/   # Todo list functionality
    ├── notifications/         # Executive notifications
    ├── routes/                # Route components (Dashboard, etc.)
    ├── settings/              # Executive settings
    ├── store/                 # Store management
    └── visit-history/         # Visit history tracking
```

## 🌐 **Routing Structure**

### **Landing Page**
- **URL**: `/` 
- **Layout**: Minimal root layout (no header/footer)
- **Content**: Simple "Hi" message

### **Executive Section**
- **URL**: `/executive/*`
- **Layout**: Executive layout with header and footer
- **Features**: Full executive dashboard, forms, todos, notifications

**Executive Routes:**
- `/executive` → Executive dashboard (default)
- `/executive/dashboard` → Executive dashboard
- `/executive/executive-form` → Executive forms
- `/executive/executive-todo-list` → Todo list
- `/executive/notifications` → Notifications
- `/executive/settings` → Settings
- `/executive/store` → Store management
- `/executive/visit-history` → Visit history

### **Admin Section**  
- **URL**: `/admin/*`
- **Layout**: Admin layout with sidebar navigation
- **Features**: Admin dashboard, store management, executive oversight

**Admin Routes:**
- `/admin` → Redirects to admin dashboard
- `/admin/dashboard` → Admin dashboard
- `/admin/stores` → Store management (coming soon)
- `/admin/executives` → Executive management (coming soon)
- `/admin/settings` → Admin settings (coming soon)

## 🎯 **Layout Inheritance**

### **Root Layout** (`src/app/layout.tsx`)
```tsx
// Minimal layout - only fonts and global styles
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}  {/* No global header/footer */}
      </body>
    </html>
  );
}
```

### **Executive Layout** (`src/app/executive/layout.tsx`)
```tsx
// Executive-specific layout with header, footer, notifications
export default function ExecutiveLayout({ children }) {
  return (
    <NotificationProvider>
      <div className="executive-todo-container">
        <Header />
        <main>{children}</main>
        <Footer />
      </div>
    </NotificationProvider>
  );
}
```

### **Admin Layout** (`src/app/admin/layout.tsx`)
```tsx
// Admin-specific layout with sidebar and admin header
export default function AdminLayout({ children }) {
  return (
    <div className="admin-dashboard">
      {/* Sidebar navigation */}
      {/* Admin header */}
      {children}
    </div>
  );
}
```

## 🚀 **Benefits of This Structure**

### **Separation of Concerns**
- **Independent layouts**: Each section has its own UI/UX
- **Isolated styling**: No style conflicts between admin and executive
- **Modular architecture**: Easy to maintain and extend

### **Clean Routing**
- **Section-based URLs**: Clear distinction between user types
- **Nested layouts**: Automatic layout inheritance
- **Scalable structure**: Easy to add new sections

### **Development Benefits**
- **Team separation**: Different teams can work on admin vs executive
- **Independent deployments**: Sections can be deployed separately
- **Clear boundaries**: No accidental cross-section dependencies

## 🔧 **Development Workflow**

### **Working on Executive Features**
```bash
# All executive code is in src/app/executive/
cd src/app/executive/
# Edit components, add new pages, modify layout
```

### **Working on Admin Features**  
```bash
# All admin code is in src/app/admin/
cd src/app/admin/
# Edit dashboard, add new admin pages
```

### **Adding New Sections**
```bash
# Create new section (e.g., manager)
mkdir src/app/manager/
# Add layout.tsx, page.tsx, etc.
```

## 🧪 **Testing Routes**

You can test each section independently:

```bash
# Start development server
npm run dev

# Test routes:
http://localhost:3000/           # Landing page ("Hi")
http://localhost:3000/executive  # Executive dashboard with header/footer
http://localhost:3000/admin      # Admin dashboard with sidebar
```

## 📱 **URL Examples**

### **Landing**
- `/` → Simple "Hi" page

### **Executive URLs**
- `/executive` → Executive dashboard
- `/executive/executive-todo-list` → Todo list
- `/executive/store` → Store management
- `/executive/settings` → Executive settings

### **Admin URLs**
- `/admin` → Admin dashboard (redirect)
- `/admin/dashboard` → Admin dashboard
- `/admin/stores` → Store management (future)
- `/admin/executives` → Executive oversight (future)

This structure ensures complete separation between admin and executive experiences while maintaining a clean, scalable codebase! 🎉
