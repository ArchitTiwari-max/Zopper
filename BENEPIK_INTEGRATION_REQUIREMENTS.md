# Benepik Reward Disbursement Integration - Requirements Document

**Document Version:** 1.0  
**Date:** January 13, 2026  
**Status:** Integration Complete - UAT Ready

---

## 1. Executive Summary

This document outlines the complete requirements for the Benepik Reward Disbursement API integration. The integration enables secure, encrypted reward distribution to employees via SMS, WhatsApp, and Email notifications.

---

## 2. System Architecture

### 2.1 Components
- **Benepik Client Library** (`benepik-client/`)
  - Handles authentication, encryption, and API communication
  - Implements HMAC-SHA256 request signing
  - Manages JWT token generation
  - Encrypts reward payloads using AES-256-CBC

- **Next.js API Proxy** (`src/app/api/benepik/route.ts`)
  - Acts as intermediary between frontend and Benepik
  - Forwards requests from whitelisted IP (AWS server)
  - Handles error responses and logging

---

## 3. Authentication & Security

### 3.1 Credentials Required

| Credential | Type | Purpose | Current Value |
|-----------|------|---------|----------------|
| CLIENT_CODE | String | Client identifier in requests | BENEPIK226423 |
| CLIENT_ID | Number | Client ID for JWT | 2364 |
| ADMIN_ID | Number | Admin ID for JWT | 926 |
| AUTH_KEY | String | JWT signing key | Kjs8df8!fj39sJf92nq#3Jasf82^@2Lncs90dkfLcm03Fjs9 |
| SECRET_KEY | String | AES encryption & HMAC signing key | Yh73@8Jsk#28!dfjWm91zPqL7v6$Bnq02XakNfVp |
| BENEPIK_BASE_URL | URL | API endpoint | https://benepik.org/bpcp-client-reward-micro/ |

### 3.2 Security Mechanisms

**JWT Token (15-minute expiry)**
- Algorithm: HS256
- Claims: iat, exp, iss, aud, jti, clientId, adminId, event

**HMAC Signature (Replay Attack Prevention)**
- Algorithm: HMAC-SHA256
- Canonical String: `METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY`
- Output: Hexadecimal string

**Payload Encryption**
- Algorithm: AES-256-CBC
- Key: SHA-256(SECRET_KEY)
- Format: Base64(IV + EncryptedPayload)

**IP Whitelisting**
- Only requests from whitelisted IP addresses accepted
- Current IP: 13.126.228.114 (AWS)

---

## 4. API Endpoint Details

### 4.1 Endpoint
- **URL:** `https://benepik.org/bpcp-client-reward-micro/api/sendRewards`
- **Method:** POST
- **Protocol:** HTTPS (TLS ≥ 1.2)

### 4.2 Required Headers

| Header | Value | Example |
|--------|-------|---------|
| Authorization | Bearer {JWT_TOKEN} | Bearer eyJhbGc... |
| REQUESTID | Client code | BENEPIK226423 |
| X-TIMESTAMP | UNIX timestamp (seconds) | 1767687427 |
| X-NONCE | Random hex string (32 chars) | 02edee8b559e79b1d776e091d1b1c60c |
| X-SIGNATURE | HMAC-SHA256 hex | PXqWu5ITIBnHOn13wDjJ8zImF5ZrTqZQQnDxN9qcfXE= |
| Content-Type | application/json | application/json |

### 4.3 Request Body

```json
{
  "checksum": "Base64EncodedEncryptedPayload"
}
```

### 4.4 Payload Structure (Before Encryption)

```json
{
  "source": "0",
  "isSms": "1",
  "isWhatsApp": "1",
  "isEmail": "1",
  "data": [
    {
      "sno": "1",
      "userName": "Archit",
      "emailAddress": "user@example.com",
      "countryCode": "+91",
      "mobileNumber": "9569310917",
      "rewardAmount": "20",
      "personalMessage": "Impressive performance!",
      "messageFrom": "Manager",
      "ccEmailAddress": "",
      "bccEmailAddress": "",
      "reference": "",
      "mailer": "1058",
      "certificateId": "",
      "transactionId": "TXN-1767687427",
      "entityId": "1063",
      "column1": "",
      "column2": "",
      "column3": "",
      "column4": "",
      "column5": ""
    }
  ]
}
```

---

## 5. Payload Field Specifications

### 5.1 Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source | String | Yes | 0 = Mobile, 1 = Email |
| isSms | String | Yes | 1 = Send SMS, 0 = Don't send |
| isWhatsApp | String | Yes | 1 = Send WhatsApp, 0 = Don't send |
| isEmail | String | Yes | 1 = Send Email, 0 = Don't send |
| data | Array | Yes | Array of reward recipients (max 500) |

### 5.2 Data Array Fields

| Field | Type | Required | Condition | Description |
|-------|------|----------|-----------|-------------|
| sno | String | Yes | Always | Serial number |
| userName | String | Yes | Always | Recipient name |
| emailAddress | String | Yes | source=1 | Email address |
| countryCode | String | Yes | source=0 | Country code (+91) |
| mobileNumber | String | Yes | source=0 | Mobile number |
| rewardAmount | String | Yes | Always | Amount in currency |
| personalMessage | String | No | Always | Custom message |
| messageFrom | String | No | Always | Sender name |
| ccEmailAddress | String | No | Always | CC email |
| bccEmailAddress | String | No | Always | BCC email |
| reference | String | No | Always | Reference ID |
| mailer | String | Yes | source=1 | Mailer ID (1058) |
| certificateId | String | No | Always | Certificate ID |
| transactionId | String | Yes | Always | **Must be unique per request** |
| entityId | String | Yes | Always | Entity ID (1063) |
| column1-5 | String | No | Always | Custom columns |

---

## 6. Response Codes & Handling

### 6.1 Success Response (Code 1000)

```json
{
  "code": 1000,
  "success": 1,
  "message": "Batches processed successfully",
  "batchResponse": [
    {
      "code": 1000,
      "success": 1,
      "message": "Reward processed successfully",
      "txns": [
        {
          "transactionId": "TXN-1767687427",
          "rewardAmount": "20"
        }
      ]
    }
  ]
}
```

### 6.2 Pending Response (Code 1050)

```json
{
  "success": 1,
  "error": "Rewards are in pending state. #RUS1",
  "code": 1050
}
```

**Meaning:** Request accepted, processing in progress. Do not resend.

### 6.3 Error Codes

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| 1000 | 200 | Success | Process complete |
| 1001 | 401 | Unauthorized IP | Whitelist IP with Benepik |
| 1002 | 401 | Invalid Client Code | Verify CLIENT_CODE |
| 1003 | 401 | Missing REQUESTID | Add REQUESTID header |
| 1004 | 401 | Missing/Invalid Bearer Token | Regenerate JWT |
| 1005 | 401 | Authentication Failed | Check AUTH_KEY |
| 1006 | 401 | Token Expired | Regenerate JWT |
| 1007 | 401 | Checksum Required | Include encrypted checksum |
| 1008 | 401 | Invalid Checksum | Verify encryption |
| 1009 | 200 | Required Parameter Missing | Check payload fields |
| 1010 | 200 | Input Error | Validate field formats |
| 1012 | 200 | Insufficient Balance | Top up account |
| 1020 | 401 | HMAC Header Missing | Add X-SIGNATURE header |
| 1023 | 401 | Invalid Signature | Verify HMAC calculation |
| 1050 | 200 | Pending/Replay Request | Don't resend |

---

## 7. Test Cases for UAT

### 7.1 Positive Test Cases

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| TC-001: Valid Single Reward | Valid payload with unique TXN ID | Code 1000 or 1050 | ✅ Pass |
| TC-002: Bulk Rewards (10 users) | 10 recipients in data array | Code 1000 | Pending |
| TC-003: SMS Only | isSms=1, isEmail=0, isWhatsApp=0 | SMS sent only | Pending |
| TC-004: Email Only | isSms=0, isEmail=1, isWhatsApp=0 | Email sent only | Pending |
| TC-005: All Channels | All notification flags = 1 | All notifications sent | Pending |
| TC-006: Custom Message | personalMessage populated | Message included in notification | Pending |
| TC-007: Different Entity IDs | entityId variations | Processed correctly | Pending |

### 7.2 Negative Test Cases

| Test Case | Input | Expected Output | Status |
|-----------|-------|-----------------|--------|
| TC-008: Duplicate Transaction ID | Same TXN ID twice | Code 1022 (Replay) | Pending |
| TC-009: Missing Required Field | userName empty | Code 1009 | Pending |
| TC-010: Invalid Email | Invalid email format | Code 1010 | Pending |
| TC-011: Invalid Mobile | Invalid phone format | Code 1010 | Pending |
| TC-012: Insufficient Balance | Amount > available balance | Code 1012 | Pending |
| TC-013: Invalid Entity ID | Non-existent entityId | Code 1010 | Pending |
| TC-014: Invalid Mailer ID | Non-existent mailer | Code 1010 | Pending |
| TC-015: Tampered Checksum | Modified encrypted payload | Code 1008 | Pending |
| TC-016: Invalid Signature | Wrong HMAC signature | Code 1023 | Pending |
| TC-017: Expired JWT | Token older than 15 min | Code 1006 | Pending |

---

## 8. User Flow

### 8.1 Reward Disbursement Flow

```
1. User Action
   └─ Employee earns reward in SalesDost system

2. Trigger Reward API
   └─ Backend calls /api/benepik endpoint
   └─ Payload prepared with recipient details

3. Encryption & Signing
   └─ Payload encrypted with AES-256-CBC → checksum
   └─ JWT generated with AUTH_KEY
   └─ HMAC signature calculated from payload
   └─ Headers prepared with REQUESTID, X-TIMESTAMP, X-NONCE, X-SIGNATURE

4. Send to Benepik
   └─ POST request to https://benepik.org/bpcp-client-reward-micro/api/sendRewards
   └─ Include encrypted checksum in body
   └─ Include all security headers

5. Benepik Validation
   └─ IP whitelist check
   └─ JWT verification
   └─ HMAC signature validation
   └─ Checksum decryption
   └─ Business rule validation
   └─ Balance availability check

6. Processing
   └─ If valid: Reward marked as pending
   └─ Benepik processes reward disbursement
   └─ Recipient receives notification (SMS/Email/WhatsApp)

7. Response to SalesDost
   └─ Code 1000: Success
   └─ Code 1050: Pending (processing)
   └─ Code 1012: Insufficient balance
   └─ Other codes: Error handling

8. Webhook Callback (Optional)
   └─ Benepik sends final status via webhook
   └─ SalesDost updates reward status in database
```

---

## 9. Environment Configuration

### 9.1 Production Environment

```env
BENEPIK_BASE_URL=https://benepik.org/bpcp-client-reward-micro/
CLIENT_CODE=BENEPIK226423
CLIENT_ID=2364
ADMIN_ID=926
AUTH_KEY=Kjs8df8!fj39sJf92nq#3Jasf82^@2Lncs90dkfLcm03Fjs9
SECRET_KEY=Yh73@8Jsk#28!dfjWm91zPqL7v6$Bnq02XakNfVp
BENEPIK_API_URL=https://benepik.org/bpcp-client-reward-micro/
```

### 9.2 UAT Environment

**Awaiting credentials from Benepik**

---

## 10. Known Limitations & Constraints

1. **Maximum 500 users per request** - Bulk operations limited to 500 recipients
2. **Unique Transaction IDs** - Each request must have unique transactionId
3. **IP Whitelisting** - Only whitelisted IPs can make requests
4. **15-minute JWT expiry** - Tokens must be regenerated frequently
5. **Timestamp validation** - Requests outside permitted window rejected
6. **Rate Limiting** - 300 requests per minute limit

---

## 11. Deployment Checklist

- [ ] UAT credentials received from Benepik
- [ ] UAT environment configured in `.env`
- [ ] All test cases executed and passed
- [ ] IP whitelisting verified
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Webhook endpoint ready (if applicable)
- [ ] Production credentials secured
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated
- [ ] Team training completed

---

## 12. Support & Escalation

**Benepik Support Contact:** [To be provided]  
**Integration Status:** ✅ Complete - Awaiting UAT credentials

---

## Appendix A: Code Examples

### A.1 Sending a Reward

```javascript
import { sendRewards } from './benepik-client/src/benepik.js';

const payload = {
  source: "0",
  isSms: "1",
  isWhatsApp: "1",
  isEmail: "1",
  data: [{
    sno: "1",
    userName: "John Doe",
    emailAddress: "john@example.com",
    countryCode: "+91",
    mobileNumber: "9999999999",
    rewardAmount: "100",
    transactionId: "TXN-" + Date.now(),
    entityId: "1063",
    mailer: "1058"
  }]
};

try {
  const response = await sendRewards(payload);
  console.log("Success:", response.data);
} catch (error) {
  console.error("Error:", error.response?.data);
}
```

---

**Document Prepared By:** Development Team  
**Last Updated:** January 13, 2026  
**Next Review:** After UAT completion
