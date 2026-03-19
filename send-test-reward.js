require('dotenv').config();
const { sendRewards } = require('./src/lib/benepik');

async function sendTestReward() {
  try {
    console.log('=== Sending Test Reward ===');
    
    const mobileNumber = '9999891414';
    const rewardAmount = '1350';
    const transactionId = `TXN-salesdost-Transfer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Prepare the reward data
    const rewardData = [{
      sno: '1',
      userName: 'Naved',
      emailAddress: '',
      countryCode: '+91',
      mobileNumber: mobileNumber,
      rewardAmount: rewardAmount,
      personalMessage: '',
      messageFrom: '',
      ccEmailAddress: '',
      bccEmailAddress: '',
      reference: '6936c9c9e004c3f179f7788f',
      mailer: process.env.BENEPIK_MAILER || 'N',
      certificateId: '',
      transactionId: transactionId,
      entityId: process.env.BENEPIK_ENTITY_ID,
      column1: '',
      column2: '',
      column3: '',
      column4: '',
      column5: '',
    }];

    console.log('Reward data prepared:', JSON.stringify(rewardData, null, 2));
    
    // Send the reward (sendRewards will handle encryption via generateChecksum)
    const response = await sendRewards(rewardData);
    
    console.log('=== Reward Sent Successfully ===');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    console.log('Transaction ID:', transactionId);
    
  } catch (error) {
    console.error('=== Error Sending Reward ===');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

sendTestReward();
