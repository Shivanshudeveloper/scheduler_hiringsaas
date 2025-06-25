const cron = require('node-cron');
const JobAlertNotification = require('../models/jobAlertNotification');
const { sendJobAlertEmail } = require('../lib/notification-email/job-alert-notification.js');

async function processJobAlerts() {
  console.log('⏰ Processing job alerts...');

  try {
    const now = new Date();
    const pendingAlerts = await JobAlertNotification.find({
      scheduledFor: { $lte: now },
      status: 'pending',
    });

    console.log(`📥 Found ${pendingAlerts.length} job alerts to process.`);

    for (const alert of pendingAlerts) {
      const {
        userEmails,
        jobData: {
          jobTitle,
          jobId,
          companyName,
          applicationDeadline,
          workLocation,
          salaryInfo,
          workArrangement,
        },
      } = alert;

      const result = await sendJobAlertEmail(
        userEmails,
        jobTitle,
        jobId,
        companyName,
        applicationDeadline,
        workLocation,
        salaryInfo,
        workArrangement
      );

      if (result.success) {
        alert.status = 'sent';
        alert.sentAt = new Date();
        await alert.save();
        console.log(`✅ Alert for jobId ${jobId} sent successfully.`);
      } else {
        alert.status = 'failed';
        await alert.save();
        console.error(`❌ Failed to send alert for jobId ${jobId}.`);
      }
    }

    return { success: true, processed: pendingAlerts.length };
  } catch (err) {
    console.error('❌ Job alert processing error:', err);
    return { success: false, error: err.message };
  }
}

function startJobAlertCron() {
  cron.schedule('*/5 * * * *', async () => {
    await processJobAlerts();
  });

  console.log('📧 Job alert cron scheduled (every 5 minutes)');
}

module.exports = {
  startJobAlertCron,
  processJobAlerts
};