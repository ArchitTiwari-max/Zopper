const fs = require('fs');
const path = './prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf-8');

schema = schema.replace(
  /model Stakeholder \{\n  id           String   @id @default\(auto\(\)\) @map\("_id"\) @db\.ObjectId\n  name         String\n  designation  String\n  city         String/,
  'model Stakeholder {\n  id           String   @id @default(auto()) @map("_id") @db.ObjectId\n  name         String\n  designation  String\n  city         String\n  brands       String[] @default([])'
);

schema = schema.replace(
  /model StakeholderVisit \{\n\n  \/\/ Link to Stakeholder master \(optional — backward compatible\)\n  stakeholderId          String\?    @db\.ObjectId/,
  'model StakeholderVisit {\n\n  // Link to Stakeholder master (optional — backward compatible)\n  stakeholderId          String?    @db.ObjectId'
);

fs.writeFileSync(path, schema);
