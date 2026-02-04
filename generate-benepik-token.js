#!/usr/bin/env node

/**
 * BENEPIK UAT API - Authorization Token Generator
 * 
 * Usage:
 *   node generate-benepik-token.js
 * 
 * This generates a JWT token for authenticating with the Benepik UAT API
 */

const jwt = require('jsonwebtoken');

// Configuration from .env
const UAT_JWT_SECRET = process.env.UAT_JWT_SECRET || 'Kf7A9mQ2ZrB6xD5P';
const UAT_CLIENT_ID = process.env.UAT_CLIENT_ID || 'ZOPPER4321';

function generateBenepikToken() {
  const payload = {
    clientId: UAT_CLIENT_ID
  };

  const token = jwt.sign(payload, UAT_JWT_SECRET, { expiresIn: '1h' });
  
  console.log('\n✅ BENEPIK UAT API - Authorization Token Generated\n');
  console.log('Token (valid for 1 hour):');
  console.log('─'.repeat(80));
  console.log(token);
  console.log('─'.repeat(80));
  console.log('\nUsage in API Request:');
  console.log('─'.repeat(80));
  console.log('Authorization: Bearer ' + token);
  console.log('─'.repeat(80));
  console.log('\nPayload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n');
}

generateBenepikToken();
