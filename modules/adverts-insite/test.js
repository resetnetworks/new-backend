import axios from 'axios';

// Load these from your environment variables (.env)
const AD_ACCOUNT_ID = 'YOUR_AD_ACCOUNT_ID'; // Do not include "act_" here; we add it in the template string
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

async function createCampaign() {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v25.0/act_${AD_ACCOUNT_ID}/campaigns`,
      {
        name: 'My First API Campaign',
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: [] // Required by Meta
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Campaign Created Successfully!');
    console.log('Campaign ID:', response.data.id);
  } catch (error) {
    console.error('Error creating campaign:', error.response ? error.response.data : error.message);
  }
}

createCampaign();