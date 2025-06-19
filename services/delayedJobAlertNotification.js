const cron = require('node-cron');
const mongoose = require('mongoose');
const JobAlertNotification = require('../models/jobAlertNotification'); // adjust path
const { sendJobAlertEmail } = require('../lib/notification-email/job-alert-notification.js'); // adjust path

// Connect to MongoDB (only if this is a separate script)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running job alert cron job...');

  try {
    const now = new Date();

    // Get pending notifications scheduled for now or earlier
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

      // Send the job alert
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

      // Update alert status based on result
      if (result.success) {
        alert.status = 'sent';
        alert.sentAt = new Date();
        await alert.save();
        console.log(`Alert for jobId ${jobId} sent successfully.`);
      } else {
        alert.status = 'failed';
        await alert.save();
        console.error(`❌ Failed to send alert for jobId ${jobId}.`);
      }
    }
  } catch (err) {
    console.error('❌ Cron job error:', err);
  }
});
