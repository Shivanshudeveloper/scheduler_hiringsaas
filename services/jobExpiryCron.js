const cron = require('node-cron');
const Job = require('../models/Jobs'); // Update with your actual Job model path

let lastExpiredCount = 0;
let lastRunTime = null;

async function expireOldJobs() {
  try {
    const currentDate = new Date();
    
    const result = await Job.updateMany(
      {
        status: { $in: ['active', 'paused'] },
        jobPostExpiry: { $lt: currentDate }
      },
      {
        $set: { status: 'expired' }
      }
    );

    if (result.modifiedCount > 0 || lastExpiredCount !== result.modifiedCount) {
      console.log(`[${new Date().toISOString()}] Expired ${result.modifiedCount} jobs`);
      lastExpiredCount = result.modifiedCount;
    }
    
    lastRunTime = currentDate;
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('❌ Job expiry cron error:', error.message);
    return { success: false, error: error.message };
  }
}

function startJobExpiryCron() {
  // Run daily at midnight (adjust frequency as needed)
  cron.schedule('0 0 * * *', async () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Checking for expired jobs...');
    }
    
    await expireOldJobs();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Expired jobs check complete');
    }
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca" // Match your existing timezone
  });
  
  console.log('⏰ Job expiry cron scheduled (daily at midnight)');
}

module.exports = {
  startJobExpiryCron,
  expireOldJobs
};