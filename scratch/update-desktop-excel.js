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

    // 1. Find the highest numeric Store ID currently in the DB
    console.log("Fetching all store IDs from DB to find the maximum...");
    const allStores = await storeCollection.find({ _id: /^store_\d+$/ }).toArray();
    let maxIdNum = 0;
    for (const s of allStores) {
      const match = s._id.match(/^store_(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIdNum) {
          maxIdNum = num;
        }
      }
    }
    console.log(`Highest numeric store ID currently in DB: store_${String(maxIdNum).padStart(6, '0')} (numeric: ${maxIdNum})`);
    let currentNewIdNum = maxIdNum;

    // 2. Read the Excel file from Desktop
    const excelPath = "/Users/vishalshukla/Desktop/Final Updation Sheet.xlsx";
    console.log("Reading Excel file:", excelPath);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // 'Missing ID Analysis'
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Loaded ${rows.length} rows from sheet "${sheetName}".`);

    let updateCount = 0;
    let insertCount = 0;
    let skipCount = 0;

    // To prevent using the same generated ID in this run before the insert is completed
    const assignedIdsInRun = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const storeIdVal = String(row["Store ID"] || "").trim();
      const storeName = String(row["Store Name"] || "").trim();

      if (!storeIdVal) {
        skipCount++;
        continue;
      }

      // Check if store ID exists in DB
      const existingInDb = await storeCollection.findOne({ _id: storeIdVal });

      if (existingInDb) {
        // ID exists! Update storeName in DB
        await storeCollection.updateOne(
          { _id: storeIdVal },
          { $set: { storeName: storeName } }
        );
        updateCount++;
      } else {
        // ID does not exist in DB! Map to the next available ID
        let newId = "";
        while (true) {
          currentNewIdNum++;
          newId = `store_${String(currentNewIdNum).padStart(6, '0')}`;
          
          if (!assignedIdsInRun.has(newId)) {
            const idExistsInDb = await storeCollection.findOne({ _id: newId });
            if (!idExistsInDb) {
              break;
            }
          }
        }

        assignedIdsInRun.add(newId);
        console.log(`[Row ${i + 1}] Excel ID ${storeIdVal} not in DB -> Assigning: ${newId} (${storeName})`);

        // Update Excel row in memory
        row["Store ID"] = newId;

        // Parse other fields for DB insertion
        const city = String(row["City"] || "").trim() || null;
        const state = String(row["State"] || "").trim() || null;
        const storeCategory = String(row["Store Category"] || "").trim() || null;
        const storeChannel = String(row["Channel"] || "").trim() || null;
        const cityTier = String(row["Store City Tier"] || "").trim() || null;

        let latitude = parseFloat(row["Lat"]);
        if (isNaN(latitude)) latitude = null;

        let longitude = parseFloat(row["Long"]);
        if (isNaN(longitude)) longitude = null;

        // Priority validation: enum in DB is p1, p2, p3
        let priority = null;
        const rawPriority = String(row["Priority Store"] || "").trim().toLowerCase();
        if (rawPriority === "p1") priority = "p1";
        else if (rawPriority === "p2") priority = "p2";
        else if (rawPriority === "p3") priority = "p3";

        // Insert new store document in DB
        const newStoreDoc = {
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
        };

        await storeCollection.insertOne(newStoreDoc);
        insertCount++;
      }
    }

    console.log(`\nProcessing Finished:`);
    console.log(`- Existing stores updated: ${updateCount}`);
    console.log(`- Missing stores inserted as new: ${insertCount}`);
    console.log(`- Rows skipped (empty): ${skipCount}`);

    // Save back the updated rows to Excel on Desktop
    console.log("Writing updated data back to Excel...");
    const newWorksheet = XLSX.utils.json_to_sheet(rows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
    XLSX.writeFile(newWorkbook, excelPath);
    console.log("Excel file successfully updated on Desktop!");

  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
