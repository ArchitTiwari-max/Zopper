# Partner Sales Dashboard

## Overview
The Partner Sales Dashboard provides comprehensive analytics and insights for partner sales data across different brands.

## Features

### 1. Brand Selection
- Dropdown to select brand (Godrej, Samsung, Havells)
- Must select a brand to view dashboard data

### 2. Date Range Filtering
- **From Date**: Select start date of the range
- **To Date**: Select end date of the range
- Filters based on `warrantyPurchaseDate` field (DD/MMM/YY format)
- Both fields are optional - can filter by start date only, end date only, or both
- Shows all data when no dates are selected

### 3. Dashboard Tiles

#### Tile 1: Total Sales
- Displays the total sum of all `customerPremium` values
- Single large number showing overall sales revenue

#### Tile 2: Channels
- Shows sales breakdown by channel:
  - D2D (Door to Door)
  - POD (Point of Delivery)
  - POS (Point of Sale)
  - Telecaller
- For each channel displays:
  - Sum of `customerPremium`
  - Unit count (number of sales)
- Format: `₹[amount] ([count] units)`

#### Tile 3: Product Category
- Shows sales breakdown by product category:
  - AC
  - Washing machine
  - REF (Refrigerator)
  - Microwave
  - QUbe
  - Chest freezer
- For each category displays:
  - Unit count (number of sales)
  - Sum of `customerPremium`
- Format: `[count] units | ₹[amount]`

### 4. Data Table
- Displays all BrandDump records for the selected brand
- Shows ALL columns from the BrandDump model
- Filtered by selected brand and date range
- Scrollable table with sticky header

## Design
- Dark theme with gradient background
- Colorful tiles with hover effects
- Responsive layout
- Live indicator showing real-time data

## API Endpoint
- **Route**: `/api/admin/partner-dashboard`
- **Method**: GET
- **Query Parameters**:
  - `brand` (required): Brand name
  - `startDate` (optional): Start date filter (YYYY-MM-DD format)
  - `endDate` (optional): End date filter (YYYY-MM-DD format)
  - `channel` (optional): Filter by sales channel
  - `category` (optional): Filter by product category
  - `pocName` (optional): Filter by executive/POC name

## Database Schema
Uses the `BrandDump` model from Prisma schema with fields:
- `customerPremium`: Sales amount
- `channel`: Sales channel (D2D, POD, POS, Telecaller)
- `productCategory`: Product category
- `warrantyPurchaseDate`: Date for filtering

## Files Created
1. `/src/app/admin/datamanagement/partnerdashboard/page.tsx` - Main dashboard component
2. `/src/app/admin/datamanagement/partnerdashboard/partner-dashboard.css` - Styling
3. `/src/app/api/admin/partner-dashboard/route.ts` - API endpoint for data fetching

## Usage
1. Navigate to `/admin/datamanagement/partnerdashboard`
2. Select a brand from the dropdown
3. Optionally set date filters
4. View analytics in the three tiles
5. Scroll down to see detailed data table
