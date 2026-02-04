# Dump Import Feature

## Overview
The Dump Import feature allows administrators to upload and manage brand-specific dump data from Excel files. Each brand (Godrej, Samsung, Havells) has its own set of columns that are expected in the Excel file.

## Features
- ✅ Brand selection before upload
- ✅ Excel file upload (drag & drop or click)
- ✅ Data validation against expected columns
- ✅ Automatic data storage in MongoDB
- ✅ Display data in tabular format
- ✅ Filter by upload date
- ✅ Support for multiple uploads per brand

## Godrej Dump Columns (22 fields)

The Excel file for Godrej brand should contain the following columns in this exact format:

1. Warranty Activation Code
2. Customer Premium
3. Zopper Plan Duration
4. Warranty Purchase Date
5. Warranty Start Date
6. Technician_UserID
7. Technician_Name
8. Service_Centre_Name
9. Business Name
10. PinCode
11. Customer_City
12. Customer_State
13. Product Purchased Date
14. Appliance Model Name
15. Product_Category_ID
16. Model Code
17. Product_Category
18. Product_Coverage
19. Product_Serial_Number
20. Branch
21. POC Name
22. Channel

## How to Use

### 1. Select Brand
- Navigate to `/admin/datamanagement/dumpimport`
- Click on the brand you want to upload data for (e.g., Godrej)

### 2. Upload Excel File
- Drag and drop an Excel file (.xlsx or .xls) into the upload area
- Or click the upload area to select a file from your computer
- The system will validate that all required columns are present

### 3. View Data
- After successful upload, the data will be displayed in a table
- Each row represents one record from the Excel file
- Empty fields in the Excel will show as "-" in the table

### 4. Filter by Date
- Use the date filter to view dumps uploaded on a specific date
- Click "Clear Filter" to remove the date filter

## Database Schema

The data is stored in the `BrandDump` collection with the following structure:

```typescript
{
  id: ObjectId,
  brandName: String,
  uploadedAt: DateTime,
  
  // Godrej specific fields (all optional)
  warrantyActivationCode: String,
  customerPremium: String,
  zopperPlanDuration: String,
  warrantyPurchaseDate: String,
  warrantyStartDate: String,
  technicianUserId: String,
  technicianName: String,
  serviceCentreName: String,
  businessName: String,
  pinCode: String,
  customerCity: String,
  customerState: String,
  productPurchasedDate: String,
  applianceModelName: String,
  productCategoryId: String,
  modelCode: String,
  productCategory: String,
  productCoverage: String,
  productSerialNumber: String,
  branch: String,
  pocName: String,
  channel: String,
  
  // For other brands
  additionalData: Json
}
```

## API Endpoints

### POST `/api/admin/dump-import`
Upload dump data for a brand

**Request Body:**
```json
{
  "brand": "Godrej",
  "data": [
    {
      "Warranty Activation Code": "WAC123",
      "Customer Premium": "Premium",
      ...
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 100,
  "message": "Successfully imported 100 records for Godrej"
}
```

### GET `/api/admin/dump-import?brand=Godrej&date=2026-01-30`
Fetch dump data with optional date filter

**Response:**
```json
{
  "success": true,
  "dumps": [...],
  "count": 100
}
```

## Adding New Brands

To add support for Samsung or Havells:

1. Update `BRAND_COLUMNS` in `page.tsx` with the expected columns
2. Update `GODREJ_COLUMN_MAPPING` in `route.ts` with column mappings
3. Optionally add brand-specific fields to the Prisma schema

## Notes

- Empty fields in Excel are stored as `null` in the database
- Multiple dumps can be uploaded for the same brand on different dates
- All uploads are timestamped automatically
- Data is persisted in MongoDB for future access by executives
