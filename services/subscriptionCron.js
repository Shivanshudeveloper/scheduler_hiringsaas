const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');
require('../models/Subscription');
async function triggerRenewal(email) {
  try {
    await axios.post(
      `${process.env.BACKEND_URL}/api/subscription/renew/${encodeURIComponent(email)}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json',
          'X-Cron-Job': 'true'
        }
      }
    );
    console.log(`Renewal triggered for ${email}`);
    return true;
  } catch (error) {
    console.error(`Renewal failed for ${email}:`, error.response?.data || error.message);
    return false;
  }
}

async function checkAndRenewSubscriptions() {
  try {
    console.log(`Checking subscriptions expiring within ${process.env.RENEWAL_WINDOW_HOURS} hours...`);
    
    const now = new Date();
    const renewalWindow = new Date(now.getTime() + process.env.RENEWAL_WINDOW_HOURS * 60 * 60 * 1000);
    
    const Subscription = mongoose.model('Subscription');
    const expiringSubs = await Subscription.find({
      nextBillingDate: { $lte: renewalWindow },
      isActive: true
    }).select('userEmail').lean();

    console.log(`Found ${expiringSubs.length} subscriptions to renew`);

    const results = await Promise.allSettled(
      expiringSubs.map(sub => triggerRenewal(sub.userEmail))
    );

    const successes = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failures = results.length - successes;
    
    console.log(`Renewal results: ${successes} succeeded, ${failures} failed`);

  } catch (error) {
    console.error('Error in subscription check:', error);
  }
}

function startCronJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', checkAndRenewSubscriptions);
//    cron.schedule('*/1 * * * *', checkAndRenewSubscriptions); // runs every 1 minute

  console.log('Cron job scheduled to run hourly');
}

module.exports = { startCronJob };