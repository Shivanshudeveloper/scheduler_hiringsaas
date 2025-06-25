const cron = require('node-cron');
const JobAdvertLimit = require('../models/jobAdvertLimits')

let lastResetCount = 0;
let lastRunTime = null;

async function resetExpiredJobLimits() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 45);
    
    const result = await JobAdvertLimit.updateMany(
      { 
        updatedAt: { $lt: cutoffDate },
        noOfJobs: { $ne: 0 }
      },
      { 
        $set: { noOfJobs: 0 },
        $currentDate: { updatedAt: true } 
      }
    );

    if (result.modifiedCount > 0 || lastResetCount !== result.modifiedCount) {
      console.log(`[${new Date().toISOString()}] Reset ${result.modifiedCount} job limits (45+ days old)`);
      lastResetCount = result.modifiedCount;
    }
    
    lastRunTime = new Date();
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('❌ Job limit reset error:', error.message);
    return { success: false, error: error.message };
  }
}

function startJobLimitCron() {
  cron.schedule('*/10 * * * *', async () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 Checking job limits...');
    }
    
    await resetExpiredJobLimits();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Job limits check complete');
    }
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });
  
  console.log('⏰ Job limit reset cron scheduled (every 10 minutes)');
}

module.exports = {
  startJobLimitCron,
  resetExpiredJobLimits
};