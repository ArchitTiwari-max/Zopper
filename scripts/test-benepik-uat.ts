import dotenv from 'dotenv';
dotenv.config();
import { generateUatToken } from '../src/lib/jwt';
import axios from 'axios';

/**
 * TEST SCRIPT FOR BENEPIK UAT API
 */
async function runTest() {
    const token = generateUatToken({
        clientId: process.env.UAT_CLIENT_ID || 'BENEPIK226423'
    });
    console.log("token",token);
    console.log("clientId", process.env.UAT_CLIENT_ID);

//clientId: process.env.UAT_CLIENT_ID || 'BENEPIK226423'
    const payload = {
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

    try {
        await axios.post('http://localhost:3000/api/uat/benepik', payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    } catch (error: any) {
        if (error.response) {
            console.log(`❌ API Error: ${error.response.status}`);
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('❌ Script Error:', error.message || error);
        }
    }
}

runTest();


//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6IlpPUFBFUjQzMjEiLCJpYXQiOjE3Njg0NzU2NzgsImV4cCI6MTc3MTA2NzY3OH0.Kc8IalUarD2Aa4DU-9wgm_vewP2ecZehGXX0Yzrgi74