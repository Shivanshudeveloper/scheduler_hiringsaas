const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');
require('../models/Subscription');
require('../models/User');
require('../models/TransactionHistory');
require('../models/Jobs');

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
    console.log(`✅ Renewal triggered for ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Renewal failed for ${email}:`, error.response?.data || error.message);
    return false;
  }
}

// Process subscription cancellation
async function processCancellation(subscription) {
  try {
    const Subscription = mongoose.model('Subscription');
    const User = mongoose.model('User');
    
    const now = new Date();
    const freePlan = subscription.userType === 'jobseeker' ? 'marhaban' : 'intro';
    
    console.log(`🔄 Processing cancellation for ${subscription.userEmail}, downgrading to ${freePlan}`);
    
    // Update subscription to inactive
    await Subscription.findByIdAndUpdate(subscription._id, {
      isActive: false,
      cancelAtPeriodEnd: false,
      updatedAt: now
    });
    
    // Update user plan to free tier
    const userUpdateResult = await User.findOneAndUpdate(
      { email: subscription.userEmail },
      { 
        plan: freePlan,
        updatedAt: now
      },
      { new: true }
    );
    
    if (!userUpdateResult) {
      console.error(`⚠️  User not found for email: ${subscription.userEmail}`);
    } else {
      console.log(`✅ User plan updated: ${subscription.userEmail} -> ${freePlan}`);
    }
    
    console.log(`✅ Successfully cancelled subscription for ${subscription.userEmail}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error processing cancellation for ${subscription.userEmail}:`, error);
    return false;
  }
}

// ENHANCED: Process expired job boosts
async function processExpiredBoosts() {
  try {
    const Job = mongoose.model('Job');
    const now = new Date();
    
    console.log('\n🚀 Step: Processing expired job boosts...');
    
    // Find jobs with expired boosts
    const expiredBoosts = await Job.find({
      isBoosted: true,
      boostExpiry: { $lt: now }
    }).lean();
    
    console.log(`Found ${expiredBoosts.length} expired job boosts`);
    
    if (expiredBoosts.length === 0) {
      console.log('   No expired boosts to process');
      return { processed: 0, failed: 0 };
    }
    
    let processedCount = 0;
    let failedCount = 0;
    
    // Process each expired boost
    for (const job of expiredBoosts) {
      try {
        console.log(`  - Removing boost from job ${job.jobId} (expired: ${job.boostExpiry})`);
        
        await Job.findByIdAndUpdate(job._id, {
          isBoosted: false,
          updatedAt: now
        });
        
        processedCount++;
        console.log(`    ✅ Boost removed from job ${job.jobId}`);
        
      } catch (error) {
        failedCount++;
        console.error(`    ❌ Failed to remove boost from job ${job.jobId}:`, error);
      }
    }
    
    console.log(`📊 Boost expiry results: ${processedCount} processed, ${failedCount} failed`);
    return { processed: processedCount, failed: failedCount };
    
  } catch (error) {
    console.error('❌ Error in processExpiredBoosts:', error);
    return { processed: 0, failed: 0 };
  }
}

async function checkAndProcessSubscriptions() {
  try {
    console.log(`\n🔍 Checking subscriptions and boosts at ${new Date().toISOString()}...`);
    
    const now = new Date();
    const renewalWindow = new Date(now.getTime() + parseInt(process.env.RENEWAL_WINDOW_HOURS || 24) * 60 * 60 * 1000);
    
    const Subscription = mongoose.model('Subscription');
    
    // STEP 1: Process expired job boosts FIRST
    const boostResults = await processExpiredBoosts();
    
    // STEP 2: Process scheduled subscription cancellations
    console.log('\n📋 Step 2: Processing scheduled cancellations...');
    
    const subscriptionsToCancel = await Subscription.find({
      isActive: true,
      cancelAtPeriodEnd: true,
      periodEndDate: { $lte: now }
    }).lean();
    
    console.log(`Found ${subscriptionsToCancel.length} subscriptions to cancel`);
    
    let successfulCancellations = 0;
    if (subscriptionsToCancel.length > 0) {
      // Log details of subscriptions being cancelled
      subscriptionsToCancel.forEach(sub => {
        console.log(`  - ${sub.userEmail}: ${sub.planName} (period ended: ${sub.periodEndDate})`);
      });
      
      const cancellationResults = await Promise.allSettled(
        subscriptionsToCancel.map(sub => processCancellation(sub))
      );
      
      successfulCancellations = cancellationResults.filter(r => r.status === 'fulfilled' && r.value).length;
      const failedCancellations = cancellationResults.length - successfulCancellations;
      
      console.log(`📊 Cancellation results: ${successfulCancellations} succeeded, ${failedCancellations} failed`);
    } else {
      console.log('   No cancellations to process');
    }
    
    // STEP 3: Process subscription renewals
    console.log('\n🔄 Step 3: Processing subscription renewals...');
    
    const expiringSubs = await Subscription.find({
      nextBillingDate: { $lte: renewalWindow },
      isActive: true,
      $or: [
        { cancelAtPeriodEnd: { $exists: false } },
        { cancelAtPeriodEnd: false },
        { cancelAtPeriodEnd: null }
      ],
      paymentProfileId: { $exists: true, $ne: null }
    }).select('userEmail planName billingCycle nextBillingDate').lean();

    console.log(`Found ${expiringSubs.length} subscriptions to renew`);
    
    let successfulRenewals = 0;
    if (expiringSubs.length > 0) {
      // Log details of subscriptions being renewed
      expiringSubs.forEach(sub => {
        console.log(`  - ${sub.userEmail}: ${sub.planName} (${sub.billingCycle}) - Due: ${sub.nextBillingDate}`);
      });
      
      const renewalResults = await Promise.allSettled(
        expiringSubs.map(sub => triggerRenewal(sub.userEmail))
      );

      successfulRenewals = renewalResults.filter(r => r.status === 'fulfilled' && r.value).length;
      const failedRenewals = renewalResults.length - successfulRenewals;
      
      console.log(`📊 Renewal results: ${successfulRenewals} succeeded, ${failedRenewals} failed`);
    } else {
      console.log('   No renewals to process');
    }
    
    // STEP 4: Enhanced summary statistics including boost data
    const totalActiveSubscriptions = await Subscription.countDocuments({ isActive: true });
    const totalScheduledCancellations = await Subscription.countDocuments({ 
      isActive: true, 
      cancelAtPeriodEnd: true 
    });
    
    // Count active boosts
    const Job = mongoose.model('Job');
    const activeBoosts = await Job.countDocuments({ 
      isBoosted: true,
      boostExpiry: { $gt: now }
    });
    
    // Get boost revenue (if TransactionHistory model exists)
    let boostRevenue = { revenue: 0, transactions: 0 };
    try {
      const TransactionHistory = mongoose.model('TransactionHistory');
      const boostStats = await TransactionHistory.aggregate([
        { $match: { transactionType: 'job_boost' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);
      
      if (boostStats.length > 0) {
        boostRevenue = {
          revenue: boostStats[0].totalRevenue,
          transactions: boostStats[0].totalTransactions
        };
      }
    } catch (error) {
      console.log('   TransactionHistory model not available for boost revenue calculation');
    }
    
    const failedOperations = (subscriptionsToCancel.length - successfulCancellations) + 
                           (expiringSubs.length - successfulRenewals) +
                           boostResults.failed;
    
    console.log(`\n📈 Summary Report:
      🔵 Total active subscriptions: ${totalActiveSubscriptions}
      ⏰ Scheduled for cancellation: ${totalScheduledCancellations}
      ✅ Processed cancellations: ${successfulCancellations}
      ✅ Processed renewals: ${successfulRenewals}
      🚀 Active job boosts: ${activeBoosts}
      ✅ Processed boost expiries: ${boostResults.processed}
      💰 Total boost revenue: ${boostRevenue.revenue} MAD (${boostRevenue.transactions} transactions)
      ❌ Failed operations: ${failedOperations}
    `);

    return {
      success: true,
      summary: {
        totalActive: totalActiveSubscriptions,
        scheduledCancellations: totalScheduledCancellations,
        processedCancellations: successfulCancellations,
        processedRenewals: successfulRenewals,
        activeBoosts,
        processedBoostExpiries: boostResults.processed,
        boostRevenue: boostRevenue.revenue,
        totalBoostTransactions: boostRevenue.transactions,
        failedOperations
      }
    };

  } catch (error) {
    console.error('❌ Error in subscription processing:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced health check including boost monitoring
async function checkSubscriptionHealth() {
  try {
    console.log('\n🏥 Running subscription and boost health check...');
    
    const Subscription = mongoose.model('Subscription');
    const Job = mongoose.model('Job');
    const now = new Date();
    
    // Check for overdue subscriptions (7+ days past due)
    const overdueCount = await Subscription.countDocuments({
      isActive: true,
      nextBillingDate: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Check for orphaned cancellations (should have been processed)
    const orphanedCount = await Subscription.countDocuments({
      isActive: true,
      cancelAtPeriodEnd: true,
      periodEndDate: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    });
    
    // Check for subscriptions without payment profiles that aren't free
    const missingPaymentProfilesCount = await Subscription.countDocuments({
      isActive: true,
      price: { $gt: 0 },
      $or: [
        { paymentProfileId: { $exists: false } },
        { paymentProfileId: null },
        { paymentProfileId: '' }
      ]
    });
    
    // ENHANCED: Check for job boost issues
    const expiredBoostsNotProcessed = await Job.countDocuments({
      isBoosted: true,
      boostExpiry: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // 1 day overdue
    });
    
    const activeBoosts = await Job.countDocuments({
      isBoosted: true,
      boostExpiry: { $gt: now }
    });
    
    // Check boost transactions today (if TransactionHistory exists)
    let boostTransactionsToday = 0;
    try {
      const TransactionHistory = mongoose.model('TransactionHistory');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      boostTransactionsToday = await TransactionHistory.countDocuments({
        transactionType: 'job_boost',
        createdAt: { $gte: today }
      });
    } catch (error) {
      console.log('   TransactionHistory model not available for today\'s boost transactions');
    }
    
    // Log findings
    if (overdueCount > 0) {
      console.warn(`⚠️  Found ${overdueCount} overdue subscriptions`);
    } else {
      console.log('✅ No overdue subscriptions');
    }
    
    if (orphanedCount > 0) {
      console.warn(`⚠️  Found ${orphanedCount} orphaned cancellations that should be processed`);
    } else {
      console.log('✅ No orphaned cancellations');
    }
    
    if (missingPaymentProfilesCount > 0) {
      console.warn(`⚠️  Found ${missingPaymentProfilesCount} paid subscriptions without payment profiles`);
    } else {
      console.log('✅ All paid subscriptions have payment profiles');
    }
    
    if (expiredBoostsNotProcessed > 0) {
      console.warn(`⚠️  Found ${expiredBoostsNotProcessed} expired boosts that weren't processed`);
    } else {
      console.log('✅ No unprocessed expired boosts');
    }
    
    console.log(`📊 Current active boosts: ${activeBoosts}`);
    console.log(`💰 Boost transactions today: ${boostTransactionsToday}`);
    
    return {
      success: true,
      issues: {
        overdueSubscriptions: overdueCount,
        orphanedCancellations: orphanedCount,
        missingPaymentProfiles: missingPaymentProfilesCount,
        expiredBoostsNotProcessed: expiredBoostsNotProcessed
      },
      stats: {
        activeBoosts,
        boostTransactionsToday
      }
    };
    
  } catch (error) {
    console.error('❌ Error in health check:', error);
    return { success: false, error: error.message };
  }
}

function startCronJob() {
  // ENHANCED: Main job now includes boost processing - Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Starting Subscription & Boost Processing Job');
    console.log('='.repeat(80));
    
    const result = await checkAndProcessSubscriptions();
    
    console.log('='.repeat(80));
    console.log(`${result.success ? '✅' : '❌'} Subscription & Boost Processing Complete`);
    console.log('='.repeat(80) + '\n');
  });

  // ENHANCED: Health check now includes boost monitoring - Run once daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('\n' + '='.repeat(70));
    console.log('🏥 Starting Daily Health Check (Subscriptions & Boosts)');
    console.log('='.repeat(70));
    
    const healthResult = await checkSubscriptionHealth();
    
    console.log('='.repeat(70));
    console.log(`${healthResult.success ? '✅' : '❌'} Health Check Complete`);
    console.log('='.repeat(70) + '\n');
  });

  // NEW: Additional boost-focused job for more frequent monitoring - Every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Starting Quick Boost Expiry Check');
    console.log('='.repeat(60));
    
    const boostResult = await processExpiredBoosts();
    
    console.log('='.repeat(60));
    console.log(`✅ Quick Boost Check Complete - Processed: ${boostResult.processed}, Failed: ${boostResult.failed}`);
    console.log('='.repeat(60) + '\n');
  });

  console.log('\n📅 Enhanced Cron jobs scheduled successfully:');
  console.log('   ⏰ Subscription & boost processing: Every hour (0 * * * *)');
  console.log('   🚀 Quick boost expiry check: Every 30 minutes (*/30 * * * *)');
  console.log('   🏥 Health check (subs + boosts): Daily at 2 AM (0 2 * * *)');
  console.log('   📧 All notifications will appear in console\n');
}

// Export functions for testing and manual triggers
module.exports = { 
  startCronJob,
  checkAndProcessSubscriptions,
  processCancellation,
  triggerRenewal,
  checkSubscriptionHealth,
  processExpiredBoosts // Export the new boost function
};