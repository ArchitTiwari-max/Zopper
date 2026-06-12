const XLSX = require("xlsx");
const path = require("path");

function generateTemplate() {
  const templatePath = path.join(__dirname, "..", "public", "templates", "store-import-template.xlsx");
  console.log("Generating template at:", templatePath);

  const sampleData = [
    {
      Store_ID: "store_000001",
      "Store Name": "VS-VIJAY SALES (GREATER NOIDA)",
      City: "Greater Noida",
      "Full Address": "Plot No. 1, Commercial Belt, Alpha 1, Greater Noida, UP",
      Latitude: 28.4682,
      Longitude: 77.5115,
      partneraBrandIds: "brand_002",
      partnerBrandTypes: "A+",
      "Store Category": "LFR",
      "Store Channel": "Offline",
      "City Tier": "Tier 1",
      State: "Uttar Pradesh",
      Priority: "p1",
      Executive_IDs: "executive_00002, executive_00003",
      "POC's Name": "Kanishk Bhardwaj, Vikash Dubey"
    },
    {
      Store_ID: "store_000002",
      "Store Name": "CROMA (NOIDA SECTOR 18)",
      City: "Noida",
      "Full Address": "G-54, Sector 18, Noida, UP",
      Latitude: 28.5708,
      Longitude: 77.3261,
      partneraBrandIds: "brand_001, brand_003",
      partnerBrandTypes: "A, B",
      "Store Category": "LFR",
      "Store Channel": "Offline",
      "City Tier": "Tier 1",
      State: "Uttar Pradesh",
      Priority: "p2",
      Executive_IDs: "executive_00008",
      "POC's Name": "Gautam"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  
  // Set column widths
  const columnWidths = [
    { wch: 15 }, // Store_ID
    { wch: 35 }, // Store Name
    { wch: 20 }, // City
    { wch: 40 }, // Full Address
    { wch: 15 }, // Latitude
    { wch: 15 }, // Longitude
    { wch: 20 }, // partneraBrandIds
    { wch: 20 }, // partnerBrandTypes
    { wch: 15 }, // Store Category
    { wch: 15 }, // Store Channel
    { wch: 15 }, // City Tier
    { wch: 15 }, // State
    { wch: 15 }, // Priority
    { wch: 40 }, // Executive_IDs
    { wch: 40 }  // POC's Name
  ];
  ws["!cols"] = columnWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stores");

  XLSX.writeFile(wb, templatePath);
  console.log("Template generated successfully!");
}

generateTemplate();
