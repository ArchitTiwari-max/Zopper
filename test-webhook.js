import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Payload to test
const payload = {
  success: 1,
  clientId: '872',
  entityId: '1886',
  eventType: 'REWARD_PROCESSED',
  processedAt: 1765790642,
  totalRewardAmount: 1,
  transactionStatus: 'SUCCESS',
  rewardTransactionDetails: [
    {
      rewardAmount: '1',
      transactionId: 'TXN-salesmitr1765790642',
      disbursedAmount: '1'
    }
  ],
  transactionFailureReason: ''
};

// Encryption function (same as webhook expects)
function encryptPayload(data, secretKey) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return Buffer.concat([iv, Buffer.from(encrypted, 'base64')]).toString('base64');
}

// Generate HMAC signature
function generateHmacSignature(timestamp, rawJson, base64SignatureKey) {
  const dataToSign = `${timestamp}\n${rawJson}`;
  const hmacKey = Buffer.from(base64SignatureKey, 'base64');
  return crypto.createHmac('sha256', hmacKey).update(dataToSign).digest('hex');
}

async function testWebhook() {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET_KEY;
    const signatureKey = process.env.WEBHOOK_SIGNATURE_KEY;
    
    if (!webhookSecret) {
      console.error('❌ Missing WEBHOOK_SECRET_KEY in .env');
      process.exit(1);
    }

    if (!signatureKey) {
      console.error('❌ Missing WEBHOOK_SIGNATURE_KEY in .env');
      process.exit(1);
    }

    // Stringify the original payload
    const rawJson = JSON.stringify(payload);
    console.log('📝 Raw JSON:', rawJson);

    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Generate signature using the stringified payload
    const signature = generateHmacSignature(timestamp, rawJson, signatureKey);
    console.log('✍️  Signature:', signature);

    // Encrypt the payload for the body
    const encryptedPayload = encryptPayload(payload, webhookSecret);
    console.log('🔐 Encrypted payload:', encryptedPayload);

    // Send webhook
    const webhookUrl = 'https://salesdost.zopper.com/api/benepik/webhook';
    console.log(`\n📤 Sending webhook to: ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain",
    "X-Webhook-Signature": signature,
    "X-Timestamp": timestamp,

    // 🔴 IP spoof attempt headers
    "X-Forwarded-For": "3.111.166.133",
    "X-Real-IP": "3.111.166.133",
    "X-Client-IP": "3.111.166.133",
    "X-Remote-IP": "3.111.166.133",
    "X-Remote-Addr": "3.111.166.133",
    "Client-IP": "3.111.166.133",
    "Forwarded": "for=3.111.166.133",
    "CF-Connecting-IP": "3.111.166.133",      // Cloudflare style
    "True-Client-IP": "3.111.166.133",         // Akamai / CDN
    "X-Cluster-Client-IP": "3.111.166.133",
    "X-Originating-IP": "3.111.166.133",
    "Fastly-Client-Ip": "3.111.166.133",
    "X-Vercel-Ip": "3.111.166.133",             // Vercel specific
    "X-ProxyUser-Ip": "3.111.166.133",
  },
  body: encryptedPayload,
});


    const responseData = await response.json();
    
    console.log(`\n✅ Response Status: ${response.status}`);
    console.log('📥 Response Data:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('❌ Webhook failed!');
      process.exit(1);
    }

    console.log('\n✅ Webhook test completed successfully!');
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
    process.exit(1);
  }
}

testWebhook();
