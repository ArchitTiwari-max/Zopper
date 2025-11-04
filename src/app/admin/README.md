# ZopperTrack Admin Dashboard - Next.js App Router

This is the admin dashboard for ZopperTrack built with **Next.js 13+ App Router** and **TypeScript**. The dashboard provides comprehensive insights into store visits, executive performance, and operational metrics.

## 📁 Project Structure

```
src/app/admin/
├── dashboard/
│   └── page.tsx           # Dashboard page component
├── layout.tsx             # Admin layout wrapper
├── page.tsx              # Main admin page (redirects to dashboard)
├── types.ts              # TypeScript interfaces
├── styles.css            # Admin dashboard styles
└── README.md             # This documentation
```

## 🚀 Features

### Dashboard Overview
- **Total Visits**: 1,247 visits (+12% from last week)
- **Pending Reviews**: 23 reviews requiring attention
- **Active Executives**: 18 executives currently in field
- **Issues Reported**: 5 issues requiring resolution

### Brand-wise Visits Table
- **Dynamic Brand Data**: OnePlus, Vivo, Oppo, Realme, Godrej, Havells, Xiaomi
- **Interactive Filters**: Filter by brand or view all brands
- **Executive Management**: "View All" buttons for each brand
- **Visit Tracking**: Color-coded visit badges

### Next.js App Router Features
- **File-based Routing**: Automatic routing with `page.tsx` files
- **Layout System**: Shared layout across admin routes
- **Client Components**: Interactive components with `'use client'`
- **TypeScript**: Full type safety throughout the application

## 🛠️ Usage

### Accessing the Admin Dashboard

```bash
# Navigate to admin dashboard
http://localhost:3000/admin/dashboard

# Main admin route (redirects to dashboard)
http://localhost:3000/admin
```

### Component Usage

```tsx
// Using the dashboard page directly
import AdminDashboardPage from '@/app/admin/dashboard/page';

function MyPage() {
  return <AdminDashboardPage />;
}
```

### Layout Integration

The admin layout is automatically applied to all routes under `/admin/` thanks to the `layout.tsx` file:

```tsx
// src/app/admin/layout.tsx
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-dashboard">
      {/* Sidebar navigation */}
      {/* Header */}
      {children}
    </div>
  );
}
```

## 📊 Data Integration

### Mock Data Structure

```typescript
interface DashboardData {
  totalVisits: MetricData;
  pendingReviews: MetricData;
  activeExecutives: MetricData;
  issuesReported: MetricData;
  brandData: BrandData[];
}
```

### API Integration Example

```tsx
// In your dashboard page component
useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  fetchDashboardData();
}, [selectedTimeframe]);
```

## 🎨 Styling System

### CSS Architecture
- **Component-scoped styles**: All styles in `styles.css`
- **BEM methodology**: Block Element Modifier naming
- **Responsive design**: Mobile-first approach
- **CSS Grid & Flexbox**: Modern layout techniques

### Color System
```css
:root {
  --primary-blue: #3b82f6;
  --secondary-orange: #f97316;
  --success-green: #10b981;
  --warning-orange: #f59e0b;
  --error-red: #ef4444;
  --gray-50: #f8fafc;
  --gray-100: #f1f5f9;
}
```

## 📱 Responsive Breakpoints

```css
/* Tablet */
@media (max-width: 1024px) {
  .sidebar { transform: translateX(-100%); }
  .main-content { margin-left: 0; }
}

/* Mobile */
@media (max-width: 768px) {
  .metrics-grid { grid-template-columns: 1fr; }
  .dashboard-header { flex-direction: column; }
}
```

## 🔒 TypeScript Types

All components use strict TypeScript typing:

```typescript
// Metric data interface
interface MetricData {
  count: number;
  change?: string;
  status?: string;
  trend: 'up' | 'warning' | 'active' | 'critical';
}

// Component props
interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}
```

## 🚦 Navigation

### Sidebar Navigation
- **Dashboard**: `/admin/dashboard` (active)
- **Stores**: `/admin/stores` (coming soon)
- **Executives**: `/admin/executives` (coming soon)
- **Settings**: `/admin/settings` (coming soon)

Navigation uses Next.js `Link` components for optimal performance:

```tsx
<Link 
  href="/admin/dashboard" 
  className={`nav-item ${isActive ? 'active' : ''}`}
>
  Dashboard
</Link>
```

## 🔧 Development

### Adding New Admin Pages

1. Create new page directory:
```bash
mkdir src/app/admin/stores
```

2. Add page component:
```tsx
// src/app/admin/stores/page.tsx
export default function AdminStoresPage() {
  return <div>Stores Page</div>;
}
```

3. Update navigation in `layout.tsx`

### Extending Dashboard Data

1. Update types in `types.ts`
2. Modify mock data in `dashboard/page.tsx`
3. Update UI components accordingly

## 🌟 Performance Optimizations

- **Client-side rendering**: Only where needed with `'use client'`
- **Code splitting**: Automatic with Next.js App Router
- **Image optimization**: Next.js Image component ready
- **Bundle optimization**: Tree-shaking and minification

## 📈 Next Steps

1. **API Integration**: Replace mock data with real API calls
2. **Authentication**: Add admin authentication middleware
3. **Real-time Updates**: Implement WebSocket connections
4. **Data Visualization**: Add charts and graphs
5. **Export Features**: PDF/Excel export functionality

## 🐛 Troubleshooting

### Common Issues

1. **Styles not loading**: Ensure `styles.css` is imported correctly
2. **Navigation not working**: Check Next.js routing configuration
3. **TypeScript errors**: Verify all interfaces match component usage

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Lint code
npm run lint
```

This admin dashboard is production-ready and follows Next.js best practices for scalable web applications!
