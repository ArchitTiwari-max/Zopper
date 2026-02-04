# Benepik UAT API Documentation

This document provides details for testing and integrating with the SalesDost Benepik UAT proxy API.

## API Endpoint
`POST https://[your-domain]/api/uat/benepik`

---

## Authentication

All requests to the UAT API must be authenticated using a **JWT Bearer Token**. 

### Verification Logic
The API performs the following checks:
1. **Signature & Expiration**: Verifies that the token is signed with the correct secret and is not expired.
2. **Payload Validation**: The token **MUST** contain the following fields:
   - `clientId`: A unique identifier for your company or test client.
   - `role`: Must be either `admin` or `tester`.

If these fields are missing or the role is incorrect, the API will return `401 Unauthorized` or `403 Forbidden`.

### UAT Secret Key
The following secret key is used to sign the JWT tokens for the UAT environment:
`Kf7A9mQ2ZrB6xD5P`

### Token Generation Function (Node.js)
Partners should use the following function to generate a valid authentication token.

```javascript
const jwt = require('jsonwebtoken');

/**
 * Generates a UAT Bearer Token with required fields
 * @param {string} clientId - Your unique client identifier
 * @param {string} role - 'admin' or 'tester'
 * @returns {string} - The generated Bearer token
 */
function generateUatToken(clientId = 'partner-001', role = 'admin') {
    const UAT_JWT_SECRET = 'Kf7A9mQ2ZrB6xD5P';
    
    const payload = {
        clientId: clientId,
        role: role
    };
    
    // Token valid for 30 days
    const token = jwt.sign(payload, UAT_JWT_SECRET, { expiresIn: '30d' });
    
    return 'Bearer ' + token;
}

// Usage Example:
const authHeader = generateUatToken('my-company-id', 'admin');
console.log(authHeader); 
```

---

## User Flow Details
1. **Token Generation:** The client generates a JWT token including `clientId` and `role` using the `UAT_JWT_SECRET`.
2. **Request Submission:** The client sends a POST request to `/api/uat/benepik` with the `Bearer <token>` in the `Authorization` header.
3. **Internal Verification:** SalesDost verifies the token's integrity, expiration, and ensures `clientId` and `role` are present and valid.
4. **Proxy to Benepik:** Upon successful verification, SalesDost handles the secondary signing/encryption and forwards the request to Benepik.
5. **Response:** The raw response from Benepik is returned to the client.

---

## Test Cases

### 1. Successful Reward Request
- **Objective:** Verify that a valid token with `clientId` and `role` allows the request.
- **Payload:** Standard Benepik reward JSON.
- **Expected Result:** `200 OK` with the Benepik response data.

### 2. Missing Payload Fields (TC-002)
- **Objective:** Ensure the API rejects tokens missing `clientId` or `role`.
- **Action:** Call the API with a token that only contains `userId` but no `clientId`.
- **Expected Result:** `401 Unauthorized` with error "Invalid token payload. clientId and role are required."

### 3. Invalid Role (TC-003)
- **Objective:** Ensure only authorized roles can access the proxy.
- **Action:** Call the API with `role: "guest"`.
- **Expected Result:** `403 Forbidden` with error "Insufficient permissions."

---

## Sample Test Script (Node.js)

```javascript
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function runTest() {
    const url = 'http://localhost:3000/api/uat/benepik';
    const secret = 'Kf7A9mQ2ZrB6xD5P';
    
    // 1. Generate Token with required fields
    const token = jwt.sign(
        { clientId: 'test-client-123', role: 'admin' }, 
        secret, 
        { expiresIn: '1h' }
    );
    
    // 2. Prepare Payload
    const payload = {
        source: "0",
        isSms: "1",
        data: [{
            userName: "QA Tester",
            mobileNumber: "1234567890",
            rewardAmount: "5",
            transactionId: "TXN-" + Date.now(),
            entityId: "1063",
            mailer: "1058"
        }]
    };

    // 3. Invoke API
    try {
        const response = await axios.post(url, payload, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Response:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

runTest();
```
