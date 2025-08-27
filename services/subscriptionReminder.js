const cron = require('node-cron');
const mongoose = require('mongoose');
require('../models/Subscription');
require('../models/User');
require('../models/subscriptionReminder'); // New model we'll need to create

// Email service using Resend (same service used for job alerts)
const { sendSubscriptionReminderEmail, verifyEmailConfig } = require('../lib/notification-email/subscription-reminder.js');

// Process subscription renewal reminders
async function processSubscriptionReminders() {
  try {
    console.log('\n📧 Processing subscription renewal reminders...');
    
    const now = new Date();
    // Calculate 3 days from now
    const reminderDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    // Add buffer for the reminder window (same day)
    const reminderDateEnd = new Date(reminderDate.getTime() + 24 * 60 * 60 * 1000);
    
    const Subscription = mongoose.model('Subscription');
    const User = mongoose.model('User');
    const SubscriptionReminder = mongoose.model('SubscriptionReminder');
    
    console.log(`🔍 Looking for subscriptions expiring on: ${reminderDate.toDateString()}`);
    
    // Find subscriptions that are due for renewal in 3 days
    const upcomingRenewals = await Subscription.find({
      isActive: true,
      nextBillingDate: {
        $gte: reminderDate,
        $lt: reminderDateEnd
      },
      // Only active subscriptions that aren't marked for cancellation
      $or: [
        { cancelAtPeriodEnd: { $exists: false } },
        { cancelAtPeriodEnd: false },
        { cancelAtPeriodEnd: null }
      ],
      // Ensure they have a valid payment method
      paymentProfileId: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`📋 Found ${upcomingRenewals.length} subscriptions expiring in 3 days`);
    
    if (upcomingRenewals.length === 0) {
      console.log('   No reminder emails to send');
      return { success: true, processed: 0, sent: 0, skipped: 0, failed: 0 };
    }
    
    let processedCount = 0;
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    // Process each subscription
    for (const subscription of upcomingRenewals) {
      try {
        processedCount++;
        console.log(`\n  📧 Processing reminder for: ${subscription.userEmail}`);
        console.log(`     Plan: ${subscription.planName} (${subscription.billingCycle})`);
        console.log(`     Next billing: ${subscription.nextBillingDate}`);
        console.log(`     Amount: ${subscription.price} ${subscription.currency}`);
        
        // Check if we've already sent a reminder for this billing cycle
        const existingReminder = await SubscriptionReminder.findOne({
          userEmail: subscription.userEmail,
          subscriptionId: subscription._id,
          nextBillingDate: subscription.nextBillingDate,
          status: { $in: ['sent', 'pending'] }
        });
        
        if (existingReminder) {
          console.log(`     ⏭️  Reminder already sent/pending for this billing cycle`);
          skippedCount++;
          continue;
        }
        
        // Get user details for personalization
        const user = await User.findOne({ email: subscription.userEmail }).lean();
        if (!user) {
          console.log(`     ⚠️  User not found for email: ${subscription.userEmail}`);
          failedCount++;
          continue;
        }
        
        // Create reminder record before sending
        const reminderRecord = new SubscriptionReminder({
          userEmail: subscription.userEmail,
          subscriptionId: subscription._id,
          planName: subscription.planName,
          billingCycle: subscription.billingCycle,
          amount: subscription.price,
          currency: subscription.currency,
          nextBillingDate: subscription.nextBillingDate,
          reminderSentDate: now,
          status: 'pending'
        });
        
        // Send the reminder email
        const emailResult = await sendSubscriptionReminderEmail({
          userEmail: subscription.userEmail,
          userName: user.fullName,
          planName: subscription.planName,
          billingCycle: subscription.billingCycle,
          amount: subscription.price,
          currency: subscription.currency,
          nextBillingDate: subscription.nextBillingDate,
          userType: subscription.userType
        });
        
        if (emailResult.success) {
          // Update reminder record as sent
          reminderRecord.status = 'sent';
          reminderRecord.emailSentAt = now;
          await reminderRecord.save();
          
          sentCount++;
          console.log(`     ✅ Reminder email sent successfully`);
        } else {
          // Update reminder record as failed
          reminderRecord.status = 'failed';
          reminderRecord.errorMessage = emailResult.error || 'Unknown error';
          await reminderRecord.save();
          
          failedCount++;
          console.log(`     ❌ Failed to send reminder: ${emailResult.error}`);
        }
        
      } catch (error) {
        failedCount++;
        console.error(`     ❌ Error processing reminder for ${subscription.userEmail}:`, error.message);
        
        // Try to create a failed reminder record
        try {
          await SubscriptionReminder.create({
            userEmail: subscription.userEmail,
            subscriptionId: subscription._id,
            planName: subscription.planName,
            billingCycle: subscription.billingCycle,
            amount: subscription.price,
            currency: subscription.currency,
            nextBillingDate: subscription.nextBillingDate,
            reminderSentDate: now,
            status: 'failed',
            errorMessage: error.message
          });
        } catch (recordError) {
          console.error(`     ❌ Failed to create reminder record:`, recordError.message);
        }
      }
    }
    
    // Summary
    console.log(`\n📊 Subscription Reminder Summary:
      📧 Total processed: ${processedCount}
      ✅ Successfully sent: ${sentCount}
      ⏭️  Skipped (already sent): ${skippedCount}
      ❌ Failed: ${failedCount}
    `);
    
    return {
      success: true,
      processed: processedCount,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount
    };
    
  } catch (error) {
    console.error('❌ Error in subscription reminder processing:', error);
    return {
      success: false,
      error: error.message,
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    };
  }
}

// Clean up old reminder records (optional maintenance)
async function cleanupOldReminders() {
  try {
    const SubscriptionReminder = mongoose.model('SubscriptionReminder');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60); // Keep records for 60 days
    
    const result = await SubscriptionReminder.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old reminder records`);
    }
    
    return { success: true, deleted: result.deletedCount };
  } catch (error) {
    console.error('❌ Error cleaning up old reminders:', error);
    return { success: false, error: error.message };
  }
}

// Health check for reminder system
async function checkReminderHealth() {
  try {
    console.log('\n🏥 Running subscription reminder health check...');
    
    const SubscriptionReminder = mongoose.model('SubscriptionReminder');
    const Subscription = mongoose.model('Subscription');
    const now = new Date();
    
    // Check for failed reminders in the last 7 days
    const recentFailures = await SubscriptionReminder.countDocuments({
      status: 'failed',
      createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Check for pending reminders older than 1 hour (stuck)
    const stuckReminders = await SubscriptionReminder.countDocuments({
      status: 'pending',
      createdAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) }
    });
    
    // Check success rate in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const totalReminders = await SubscriptionReminder.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    const successfulReminders = await SubscriptionReminder.countDocuments({
      status: 'sent',
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const successRate = totalReminders > 0 ? (successfulReminders / totalReminders * 100).toFixed(1) : 0;
    
    // Check for upcoming subscriptions without reminders
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    
    const upcomingSubscriptions = await Subscription.countDocuments({
      isActive: true,
      nextBillingDate: { $gte: threeDaysFromNow, $lt: fourDaysFromNow },
      $or: [
        { cancelAtPeriodEnd: { $exists: false } },
        { cancelAtPeriodEnd: false }
      ]
    });
    
    console.log(`📊 Reminder System Health:
      ❌ Recent failures (7 days): ${recentFailures}
      ⏸️  Stuck reminders (>1 hour): ${stuckReminders}
      📈 Success rate (30 days): ${successRate}% (${successfulReminders}/${totalReminders})
      📅 Upcoming subscriptions to remind: ${upcomingSubscriptions}
    `);
    
    // Log warnings
    if (recentFailures > 5) {
      console.warn(`⚠️  High failure rate: ${recentFailures} failures in last 7 days`);
    }
    if (stuckReminders > 0) {
      console.warn(`⚠️  Found ${stuckReminders} stuck reminders`);
    }
    if (parseFloat(successRate) < 90 && totalReminders > 10) {
      console.warn(`⚠️  Low success rate: ${successRate}%`);
    }
    
    return {
      success: true,
      stats: {
        recentFailures,
        stuckReminders,
        successRate: parseFloat(successRate),
        totalReminders,
        successfulReminders,
        upcomingSubscriptions
      }
    };
    
  } catch (error) {
    console.error('❌ Error in reminder health check:', error);
    return { success: false, error: error.message };
  }
}

function startSubscriptionReminderCron() {
  // Main reminder job - Run daily at 10 AM to send 3-day reminders
  cron.schedule('0 10 * * *', async () => {
    console.log('\n' + '='.repeat(70));
    console.log('📧 Starting Subscription Renewal Reminders');
    console.log('='.repeat(70));
    
    const result = await processSubscriptionReminders();
    
    console.log('='.repeat(70));
    console.log(`${result.success ? '✅' : '❌'} Subscription Reminders Complete`);
    console.log('='.repeat(70) + '\n');
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  // Cleanup job - Run weekly on Sundays at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('\n🧹 Starting reminder cleanup...');
    await cleanupOldReminders();
    console.log('🧹 Reminder cleanup complete\n');
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  // Health check - Run daily at 11 PM
  cron.schedule('0 23 * * *', async () => {
    await checkReminderHealth();
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  console.log('\n📧 Subscription reminder cron jobs scheduled:');
  console.log('   📧 Daily reminders: 10 AM (0 10 * * *)');
  console.log('   🧹 Weekly cleanup: Sunday 3 AM (0 3 * * 0)');
  console.log('   🏥 Daily health check: 11 PM (0 23 * * *)');
}

// Export functions for testing and manual triggers
module.exports = {
  startSubscriptionReminderCron,
  processSubscriptionReminders,
  cleanupOldReminders,
  checkReminderHealth
};