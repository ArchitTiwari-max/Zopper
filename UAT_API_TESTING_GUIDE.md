# UAT API Testing Guide - Benepik Reward Integration

**Version:** 1.0 | **Date:** January 15, 2026

---

## 1. API Endpoint

**URL:** `POST https://salesdost.zopper.com/api/uat/benepik`

**Authentication:** JWT Bearer Token

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

---

## 2. Generate Authentication Token

Use this function to generate a valid JWT token:

```typescript
import jwt from 'jsonwebtoken';

function generateUatToken(clientId: string, secret: string) {
  return jwt.sign(
    { clientId },
    secret,
    { expiresIn: '1h' }
  );
}

// Usage
const token = generateUatToken('YOUR_CLIENT_ID', 'YOUR_SECRET_KEY');
```

**Token Requirements:**
- Must include `clientId` claim
- Valid for 1 hour
- Signed with your provided secret key

---

## 3. Request Payload

```json
{
  "source": "0",
  "isSms": "1",
  "isWhatsApp": "1",
  "isEmail": "1",
  "data": [{
    "sno": "1",
    "userName": "John Doe",
    "emailAddress": "john@example.com",
    "countryCode": "+91",
    "mobileNumber": "9999999999",
    "rewardAmount": "100",
    "transactionId": "TXN-unique",
    "entityId": "1063",
    "mailer": "1058",
    "personalMessage": "",
    "messageFrom": "",
    "ccEmailAddress": "",
    "bccEmailAddress": "",
    "reference": "",
    "certificateId": "",
    "column1": "",
    "column2": "",
    "column3": "",
    "column4": "",
    "column5": ""
  }]
}
```

**Field Specifications:**
- `source`: "0" = Mobile, "1" = Email
- `transactionId`: Must be unique for each request
- `entityId`: Fixed value "1063"
- `mailer`: Fixed value "1058" (required when source=1)
- Notification flags: "1" = enabled, "0" = disabled

---

## 4. User Flow

```
1. Generate JWT token with your clientId
   ↓
2. Prepare reward payload with unique transactionId
   ↓
3. Send POST request with Authorization header
   ↓
4. API validates token and clientId
   ↓
5. Request forwarded to Benepik for processing
   ↓
6. Receive response (Success/Error)
```

---

## 5. Test Cases

### Authentication Tests

| Test Case | Expected Response |
|-----------|-------------------|
| Missing Authorization header | 401: Authorization header missing |
| Invalid token format | 401: Authorization header invalid |
| Expired token | 401: Invalid or expired token |
| Wrong clientId | 403: Unauthorized client |
| Valid token | Request proceeds |

### Payload Tests

| Test Case | Expected Response |
|-----------|-------------------|
| Invalid JSON | 400: Request body must be valid JSON |
| Empty payload | 400: Payload is missing or empty |
| Missing required field | Error 1009 |
| Invalid email/mobile format | Error 1010 |
| Duplicate transactionId | Error 1022 |
| Valid payload | Success (1000 or 1050) |

### Reward Tests

| Test Case | Expected Response |
|-----------|-------------------|
| SMS only notification | SMS sent |
| Email only notification | Email sent |
| All channels enabled | All notifications sent |
| Minimum amount (1) | Success |
| Large amount (10000) | Success or balance error |

---

## 6. Response Codes

### UAT API Validation Errors (Before Benepik)
- **401:** Missing or invalid Authorization header
- **401:** Invalid or expired JWT token
- **401:** Token missing clientId claim
- **403:** Unauthorized client - clientId mismatch
- **400:** Invalid JSON in request body
- **400:** Empty or missing payload

### Benepik Processing Responses (After Validation)
- **1000:** Reward processed successfully
- **1050:** Request accepted, processing (don't resend)
- **1009:** Required parameter missing
- **1010:** Input validation error (invalid email/mobile format)
- **1022:** Duplicate transaction ID

---

## 7. Sample Responses

**UAT API Validation Error (401):**
```json
{
  "success": false,
  "error": "Authorization header missing or invalid. Use Bearer <token>"
}
```

**UAT API Validation Error (403):**
```json
{
  "success": false,
  "error": "Unauthorized client. Invalid clientId."
}
```

**UAT API Validation Error (400):**
```json
{
  "success": false,
  "error": "Request body must be valid JSON"
}
```


---

## 8. Important Notes

- Generate unique `transactionId` for each request
- Token expires after 1 hour - generate new token if expired
- Use HTTPS for all requests
- Keep your secret key confidential

---

## 9. Contact

For credentials (clientId and secret key) 
UAT_JWT_SECRET=Kf7A9mQ2ZrB6xD5P
UAT_CLIENT_ID=ZOPPER4321

**Status:** Ready for UAT Testing
