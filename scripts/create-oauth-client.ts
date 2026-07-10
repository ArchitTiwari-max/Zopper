import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

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

  console.log(`🚀 Registering client application "${name}"...`);
  console.log(`🔗 Allowed Redirect URIs:`, redirectUris);

  // Generate secure random client_id and client_secret
  const clientId = 'sd_' + crypto.randomBytes(12).toString('hex'); // Prefix with sd_ for Salesdost
  const clientSecret = crypto.randomBytes(32).toString('hex');

  try {
    const client = await prisma.client.create({
      data: {
        clientId,
        clientSecret,
        appName: name,
        redirectUris,
      },
    });

    console.log(`\n✅ Client application registered successfully!`);
    console.log(`-----------------------------------------------`);
    console.log(`Application Name : ${client.appName}`);
    console.log(`Client ID        : ${client.clientId}`);
    console.log(`Client Secret    : ${client.clientSecret}`);
    console.log(`Redirect URIs    : ${client.redirectUris.join(', ')}`);
    console.log(`Created At       : ${client.createdAt}`);
    console.log(`-----------------------------------------------`);
    console.log(`⚠️  Save the Client Secret securely. It cannot be recovered.\n`);

  } catch (error) {
    console.error('❌ Failed to register OAuth client:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
