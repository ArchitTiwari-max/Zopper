import "dotenv/config";
import axios from "axios";
import dns from "dns/promises";
import { sendRewards } from "./benepik.js";

const rewardPayload = {
  source: "0",
  isSms: "1",
  isWhatsApp: "1",
  isEmail: "1",
  data: [
    {
      sno: "1",
      userName: "Vishal Shukla",
      emailAddress: "vishalshukla1029@gmail.com",
      countryCode: "+91",
      mobileNumber: "7408108617",
      rewardAmount: "5",
      personalMessage: "",
      messageFrom: "",
      ccEmailAddress: "",
      bccEmailAddress: "",
      reference: "",
      mailer: process.env.MAILER || "",
      certificateId: "",
      transactionId: "TXN-" + Date.now(),
      entityId: "1063",
      column1: "",
      column2: "",
      column3: "",
      column4: "",
      column5: ""
    }
  ]
};

(async () => {
  try {
    console.log("Mailer ID:", process.env.MAILER);
    
    // Log outgoing IP (what external services see) and resolved Benepik host IP(s)
    const benepikUrl = process.env.BENEPIK_BASE_URL;
    async function getOutgoingIP() {
      try {
        const r = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
        return r?.data?.ip || "unknown";
      } catch (e) {
        return "unknown";
      }
    }

    async function resolveHostIPs(url) {
      try {
        const hostname = new URL(url).hostname;
        const addrs = await dns.lookup(hostname, { all: true });
        return addrs.map(a => a.address).join(',');
      } catch (e) {
        return "unknown";
      }
    }

    const [outgoingIP, resolvedIPs] = await Promise.all([
      getOutgoingIP(),
      benepikUrl ? resolveHostIPs(benepikUrl) : Promise.resolve('no-url')
    ]);
    console.log('Outgoing IP:', outgoingIP);

    const res = await sendRewards(rewardPayload);
    // Log response data and the remote/local addresses used for the request
    console.log("✅ Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(
      "❌ Error:",
      err.response?.data || err.message
    );
    // If request was made but failed, the socket may be present on err.request
  }
})();

