import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import {
  generateJWT,
  generateChecksum,
  generateSignature,
  generateNonce
} from "./cryptoUtils.js";

export async function sendRewards(payload) {
  const {
    BENEPIK_BASE_URL,
    AUTH_KEY,
    SECRET_KEY,
    CLIENT_ID,
    ADMIN_ID,
    CLIENT_CODE
  } = process.env;

  console.log("benepik base url:", BENEPIK_BASE_URL);
  console.log("client id:", CLIENT_ID);
  console.log("admin id:", ADMIN_ID);
  console.log("auth key:", AUTH_KEY);
  console.log("secret key:", SECRET_KEY);
  
  const requestId=CLIENT_CODE;
  console.log("requestId:", requestId);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();

  const jwtToken = generateJWT({
    authKey: AUTH_KEY,
    clientId: Number(CLIENT_ID),
    adminId: Number(ADMIN_ID)
  });

  const checksum = generateChecksum(payload, SECRET_KEY);
  
  // Sign the original payload, not the checksum
  const requestBodyForSignature = JSON.stringify(payload);

  // Use new HMAC signature format per API Security Handbook
  const signature = generateSignature({
    method: "POST",
    path: "/api/sendRewards",
    timestamp,
    nonce,
    body: requestBodyForSignature,
    secretKey: SECRET_KEY
  });
  
  console.log("=== Signature Debug ===");
  console.log("requestId (for header):", requestId);
  console.log("timestamp:", timestamp);
  console.log("nonce:", nonce);
  console.log("body (for signature):", requestBodyForSignature);
  console.log("checksum (for request):", checksum);
  console.log("signature:", signature);
  console.log("======================");

  const headers = {
    Authorization: `Bearer ${jwtToken}`,
    REQUESTID: requestId,
    "X-TIMESTAMP": timestamp.toString(),
    "X-NONCE": nonce,
    "X-SIGNATURE": signature,
    "Content-Type": "application/json"
  };

  return axios.post(
    `${BENEPIK_BASE_URL}api/sendRewards`,
    { checksum },
    { headers }
  );
}
