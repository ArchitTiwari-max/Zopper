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
    ADMIN_ID
  } = process.env;

  console.log("benepik base url:", BENEPIK_BASE_URL);
  console.log("client id:", CLIENT_ID);
  console.log("admin id:", ADMIN_ID);
  console.log("auth key:", AUTH_KEY);
  console.log("secret key:", SECRET_KEY);
  
  const requestId = CLIENT_ID;
  console.log("requestId:", requestId);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();

  const jwtToken = generateJWT({
    authKey: AUTH_KEY,
    clientId: Number(CLIENT_ID),
    adminId: Number(ADMIN_ID)
  });

  const checksum = generateChecksum(payload, SECRET_KEY);

  const signature = generateSignature({
    requestId,
    timestamp,
    nonce,
    checksum,
    secretKey: SECRET_KEY
  });

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