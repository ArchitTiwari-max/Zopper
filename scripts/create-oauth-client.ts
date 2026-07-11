import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

function printUsage() {
  console.log(`
Usage:
  npx tsx scripts/create-oauth-client.ts --name "<AppName>" --redirects "<URL1>,<URL2>,..."

Options:
  --name, -n        The user-friendly name of the client application (required).
  --redirects, -r   Comma-separated list of allowed redirect URIs (required).

Example:
  npx tsx scripts/create-oauth-client.ts --name "Customer Portal" --redirects "http://localhost:3001/api/auth/callback,https://customer.mycompany.com/api/auth/callback"
`);
}

async function main() {
  const args = process.argv.slice(2);
  let name = '';
  let redirectsStr = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
      name = args[i + 1] || '';
      i++;
    } else if (args[i] === '--redirects' || args[i] === '-r') {
      redirectsStr = args[i + 1] || '';
      i++;
    }
  }

  if (!name || !redirectsStr) {
    console.error('❌ Error: Missing required arguments.');
    printUsage();
    process.exit(1);
  }

  const redirectUris = redirectsStr
    .split(',')
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0);

  if (redirectUris.length === 0) {
    console.error('❌ Error: No valid redirect URIs provided.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  console.log(`🚀 Connecting directly to database to register "${name}"...`);
  console.log(`🔗 Allowed Redirect URIs:`, redirectUris);

  // Generate secure random client_id and client_secret
  const clientId = 'sd_' + crypto.randomBytes(12).toString('hex'); // Prefix with sd_ for Salesdost
  const clientSecret = crypto.randomBytes(32).toString('hex');

  const client = new MongoClient(dbUrl);

  try {
    await client.connect();
    const db = client.db();
    
    // In MongoDB collection name is "Client" matching Prisma @@map("Client")
    const collection = db.collection('Client');

    const result = await collection.insertOne({
      clientId,
      clientSecret,
      appName: name,
      redirectUris,
      createdAt: new Date()
    });

    console.log(`\n✅ Client application registered successfully via Native MongoDB Driver!`);
    console.log(`-----------------------------------------------`);
    console.log(`Application Name : ${name}`);
    console.log(`Client ID        : ${clientId}`);
    console.log(`Client Secret    : ${clientSecret}`);
    console.log(`Redirect URIs    : ${redirectUris.join(', ')}`);
    console.log(`Doc ID           : ${result.insertedId}`);
    console.log(`-----------------------------------------------`);
    console.log(`⚠️  Save the Client Secret securely. It cannot be recovered.\n`);

  } catch (error) {
    console.error('❌ Failed to register OAuth client:', error);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
