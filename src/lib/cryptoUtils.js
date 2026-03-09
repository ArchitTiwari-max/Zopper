import crypto from "crypto";
import jwt from "jsonwebtoken";

/* ---------- JWT ---------- */
export function generateJWT({ authKey, clientId, adminId }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 900,
    iss: "benepik-tech",
    aud: "maytech-corp",
    jti: crypto.randomBytes(16).toString("base64"),
    clientId,
    adminId,
    event: "reward"
  };
  return jwt.sign(payload, authKey, { algorithm: "HS256" });
}

/* ---------- AES Checksum ---------- */
export function generateChecksum(payload, secretKey) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "base64");
  encrypted += cipher.final("base64");
  return Buffer.concat([iv, Buffer.from(encrypted, "base64")]).toString("base64");
}

/* ---------- HMAC Signature ---------- */
export function generateSignature({
  method,
  path,
  timestamp,
  nonce,
  body,
  secretKey
}) {
  const canonicalString = [
    method.toUpperCase(),
    path,
    timestamp,
    nonce,
    body
  ].join("\n");
  
  return crypto
    .createHmac("sha256", secretKey)
    .update(canonicalString)
    .digest("hex");
}

/* ---------- Helpers ---------- */
export function generateNonce() {
  return crypto.randomBytes(16).toString("hex");
}

