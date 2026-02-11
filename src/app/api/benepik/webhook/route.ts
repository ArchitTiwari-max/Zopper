import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function decryptPayload(encryptedData: string, secretKey: string): any {
  try {
    const buffer = Buffer.from(encryptedData, 'base64');
    const iv = buffer.subarray(0, 16);
    const encrypted = buffer.subarray(16);
    
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('❌ Failed to decrypt payload:', error);
    throw new Error('Decryption failed');
  }
}

function extractProjectNameFromTransactionId(transactionId: string): string {
  // Format: TXN-{projectName}{timestamp}
  // Example: TXN-godrej1707123456789
  const match = transactionId.match(/^TXN-([a-zA-Z]+)/);
  if (!match || !match[1]) {
    throw new Error(`Invalid transaction ID format: ${transactionId}`);
  }
  return match[1].toLowerCase();
}

function getProjectWebhookUrl(projectName: string): string {
  // Check if running on localhost
  const isLocalhost = process.env.NODE_ENV === 'development';
  
  const projectWebhookMap: Record<string, { localhost: string; production: string }> = {
    salesmitr: {
      localhost: 'http://localhost:3000/api/webhooks/benepik',
      production: 'https://salesmitr.com/api/webhooks/benepik',
    },
    salesdost: {
      localhost: 'http://localhost:3001/api/webhooks/benepik',
      production: 'https://salesdost.com/api/webhooks/benepik',
    },
  };

  const config = projectWebhookMap[projectName];
  if (!config) {
    throw new Error(`No webhook URL configured for project: ${projectName}`);
  }

  // Use localhost if in development, otherwise use production domain
  const webhookUrl = isLocalhost ? config.localhost : config.production;
  console.log(`🌐 Environment: ${isLocalhost ? 'localhost' : 'production'}`);
  
  return webhookUrl;
}

async function forwardToProjectWebhook(
  projectName: string,
  rawBody: string,
  timestamp: string,
  signature: string
): Promise<{ response: Response; data: any }> {
  const webhookUrl = getProjectWebhookUrl(projectName);
  console.log(`🔄 Forwarding webhook to ${projectName} project: ${webhookUrl}`);

  // Forward the exact same request to the project-specific webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'X-Webhook-Signature': signature,
      'X-Timestamp': timestamp,
    },
    body: rawBody, // Send encrypted payload as-is
  });

  const responseData = await response.json();
  
  if (!response.ok) {
    console.error(`❌ Project webhook failed: ${response.status} ${response.statusText}`);
    console.error('Response:', responseData);
    throw new Error(`Project webhook returned ${response.status}`);
  }

  console.log(`✅ Project webhook processed successfully:`, responseData);
  return { response, data: responseData };
}

export async function POST(req: NextRequest) {
  try {
    // Validate Content-Type header
    const contentType = req.headers.get('Content-Type');
    if (contentType !== 'text/plain') {
      console.error('❌ Invalid Content-Type. Expected: text/plain, Got:', contentType);
      return NextResponse.json(
        { error: 'Invalid Content-Type. Expected: text/plain' },
        { status: 400 }
      );
    }

    // Get the raw body (encrypted)
    const rawBody = await req.text();
    
    // Get webhook secret for decryption only
    const webhookSecret = process.env.WEBHOOK_SECRET_KEY;
    
    if (!webhookSecret) {
      console.error('❌ WEBHOOK_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Decrypt the payload to extract transaction ID
    const rawJson = decryptPayload(rawBody, webhookSecret);
    const payload = JSON.parse(rawJson);
    console.log('🔓 Decrypted payload:', rawJson);

    // Get required headers
    const signature = req.headers.get('X-Webhook-Signature');
    const timestamp = req.headers.get('X-Timestamp');
    
    if (!signature) {
      console.error('❌ Missing X-Webhook-Signature header');
      return NextResponse.json(
        { error: 'Missing X-Webhook-Signature header' },
        { status: 401 }
      );
    }

    if (!timestamp) {
      console.error('❌ Missing X-Timestamp header');
      return NextResponse.json(
        { error: 'Missing X-Timestamp header' },
        { status: 401 }
      );
    }

    // Extract transaction ID and project name
    const { rewardTransactionDetails } = payload;
    if (!rewardTransactionDetails || rewardTransactionDetails.length === 0) {
      console.error('❌ No transaction details in payload');
      return NextResponse.json(
        { error: 'No transaction details' },
        { status: 400 }
      );
    }

    const transactionId = rewardTransactionDetails[0].transactionId;
    console.log(`🔍 Transaction ID: ${transactionId}`);

    // Extract project name from transaction ID
    const projectName = extractProjectNameFromTransactionId(transactionId);
    console.log(`📦 Project: ${projectName}`);

    // Forward to project-specific webhook (with same body and headers)
    // Individual webhook will handle signature verification and processing
    const { response: projectResponse, data: projectResponseData } = await forwardToProjectWebhook(projectName, rawBody, timestamp, signature);

    // Return the project webhook's response
    return NextResponse.json(projectResponseData, { status: projectResponse.status });

  } catch (error: any) {
    console.error('❌ Error processing central webhook:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
