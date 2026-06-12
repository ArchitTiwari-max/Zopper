const { MongoClient } = require("mongodb");
const XLSX = require("xlsx");
const path = require("path");
require("dotenv").config();

async function main() {
  const uri = process.env.DATABASE_URL || "";
  console.log("Connecting to database:", uri);
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const storeCollection = db.collection("Store");

    // Start checking for new IDs after 3204 (store_003205, store_003206, ...)
    let currentNewIdNum = 3204;

    // Read the Excel file
    const excelPath = path.join(process.cwd(), "testing", "Final Sheet-Sales Store Existing_And_New.xlsx");
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Loaded ${rows.length} rows from Excel.`);

    let insertedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const storeIdVal = String(row["Store ID"] || "").trim();
      const storeName = String(row["Store Name"] || "").trim();

      // Skip empty or "new" values (which should already be processed)
      if (!storeIdVal || storeIdVal.toLowerCase() === "new") {
        continue;
      }

      // Check if store ID exists in DB
      const existingInDb = await storeCollection.findOne({ _id: storeIdVal });

      if (!existingInDb) {
        // If not found in DB, find the next available ID after 3204
        let newId = "";
        while (true) {
          currentNewIdNum++;
          newId = `store_${String(currentNewIdNum).padStart(6, '0')}`;
          
          // Verify that this new ID is not already used in DB
          const idExists = await storeCollection.findOne({ _id: newId });
          if (!idExists) {
            break;
          }
        }

        console.log(`Missing Store ID ${storeIdVal} (${storeName}) -> Assigned: ${newId}`);
        
        // Update the Excel row
        row["Store ID"] = newId;

        // Parse fields for DB insertion
        const city = String(row["City"] || "").trim() || null;
        const state = String(row["State"] || "").trim() || null;
        const storeCategory = String(row["Store Category"] || "").trim() || null;
        const storeChannel = String(row["Channel"] || "").trim() || null;
        const cityTier = String(row["Store City Tier"] || "").trim() || null;

        let latitude = parseFloat(row["Lat"]);
        if (isNaN(latitude)) latitude = null;

        let longitude = parseFloat(row["Long"]);
        if (isNaN(longitude)) longitude = null;

        let priority = null;
        const rawPriority = String(row["Priority Store"] || "").trim().toLowerCase();
        if (rawPriority === "p1") priority = "p1";
        else if (rawPriority === "p2") priority = "p2";
        else if (rawPriority === "p3") priority = "p3";

        // Insert new store into DB
        await storeCollection.insertOne({
          _id: newId,
          storeName: storeName,
          city: city,
          fullAddress: "",
          latitude: latitude,
          longitude: longitude,
          partnerBrandIds: [],
          partnerBrandTypes: [],
          storeCategory: storeCategory,
          storeChannel: storeChannel,
          cityTier: cityTier,
          state: state,
          priority: priority
        });

        insertedCount++;
      }
    }

    console.log(`Total missing stores inserted: ${insertedCount}`);

    if (insertedCount > 0) {
      console.log("Writing updated data back to Excel...");
      const newWorksheet = XLSX.utils.json_to_sheet(rows);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
      XLSX.writeFile(newWorkbook, excelPath);
      console.log("Excel file successfully updated!");
    } else {
      console.log("No missing store IDs found.");
    }

  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
