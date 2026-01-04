import "dotenv/config";
import { sendRewards } from "./benepik.js";

const rewardPayload = {
  source: "0",
  isSms: "1",
  isWhatsApp: "0",
  isEmail: "0",
  data: [
    {
      sno: "1",
      userName: "Rahul",
      countryCode: "+91",
      mobileNumber: "7408108617",
      rewardAmount: "1",
      transactionId: "TXN-" + Date.now(),
      entityId: "1063",
      personalMessage: "Great job!",
      messageFrom: "Team"
    }
  ]
};

(async () => {
  try {
    const res = await sendRewards(rewardPayload);
    console.log("✅ Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(
      "❌ Error:",
      err.response?.data || err.message
    );
  }
})();
