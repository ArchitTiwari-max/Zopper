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
    // Log response data and the remote/local addresses used for the request
    console.log("✅ Success:", JSON.stringify(res.data, null, 2));
    const socket = res?.request?.socket || res?.request;
    console.log("Request socket:", {
      remoteAddress: socket?.remoteAddress,
      remotePort: socket?.remotePort,
      localAddress: socket?.localAddress,
      localPort: socket?.localPort
    });
  } catch (err) {
    console.error(
      "❌ Error:",
      err.response?.data || err.message
    );
    // If request was made but failed, the socket may be present on err.request
    const errSocket = err?.request?.socket || err?.request;
    if (errSocket) {
      console.log("Error request socket:", {
        remoteAddress: errSocket?.remoteAddress,
        remotePort: errSocket?.remotePort,
        localAddress: errSocket?.localAddress,
        localPort: errSocket?.localPort
      });
    }
  }
})();
