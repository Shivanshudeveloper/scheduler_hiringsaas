const {Resend} = require('resend');
const {RESEND_API_KEY, FRONTEND_URL} = process.env;

const resend = new Resend(RESEND_API_KEY);

const getJobAlertEmail = (jobTitle, jobId, companyName, applicationDeadline, workLocation, salaryInfo) => {
  const deadlineDate = applicationDeadline ? new Date(applicationDeadline).toLocaleDateString() : 'Not specified';
  
  return {
    subject: `A Job Matching Your Preferences Just Went Live!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>A Job Matching Your Preferences Just Went Live!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .job-details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .highlight { color: #3b82f6; font-weight: bold; }
          .salary-info { font-size: 16px; color: #2d3748; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
          .status-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; display: inline-block; margin: 10px 0; }
          .job-info { background: #f0f9ff; border: 1px solid #e0f2fe; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .tip-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>A Job Matching Your Preferences Just Went Live!</h1>
          <p>Apply now to stay ahead of the curve in your job search!</p>
        </div>
        
        <div class="content">
          <h2>Good News!</h2>
          <p>A Job matching your preferences just went live, apply now to stay ahead of the curve.</p>
          
          <div class="job-info">
            <h3>📋 Job Summary</h3>
            <p><strong>Job Title:</strong> <span class="highlight">${jobTitle}</span></p>
            <p><strong>Company:</strong> <span class="highlight">${companyName}</span></p>
            <p><strong>Job ID:</strong> <span class="highlight">${jobId}</span></p>
            <p><strong>Location:</strong> <span class="highlight">${workLocation}</span></p>
            ${salaryInfo ? `<p><strong>Salary:</strong> <span class="salary-info">${salaryInfo}</span></p>` : ''}
          </div>
          
          <div class="job-details">
            <h3>📅 Important Dates</h3>
            <div class="status-badge">🟢 ACTIVE</div>
            <p><strong>Posted Date:</strong> <span class="highlight">${new Date().toLocaleDateString()}</span></p>
            <p><strong>Application Deadline:</strong> <span class="highlight">${deadlineDate}</span></p>
            <p><strong>Status:</strong> <span class="highlight">Live & Accepting Applications</span></p>
          </div>
          
          
          <div style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/job/${jobId}" class="btn">
              View This Job Now!
            </a>
          </div>
          
          <div class="footer">
            <p>If you do not want to receive these notifications go to <a href="${FRONTEND_URL}/help">Notification Settings</a> and disable notifications to stop receiving job alerts.</p>
            <p>Thank you for choosing our platform to find your next job!</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
};

// Function to send job creation confirmation email
const sendJobAlertEmail = async (
  userEmails, 
  jobTitle, 
  jobId, 
  companyName, 
  applicationDeadline, 
  workLocation, 
  salaryInfo, 
  workArrangement = ''
) => {
  try {
    console.log(`📧 Sending job alerts to ${userEmails.length} users...`);
    
    // Create job alert email content (different from employer confirmation)
    const emailContent = getJobAlertEmailContent({
      jobTitle,
      jobId,
      companyName,
      applicationDeadline,
      workLocation,
      salaryInfo,
      workArrangement
    });
    
    // Send emails in batches to avoid rate limits
    const batchSize = 50; // Resend allows up to 100, but 50 is safer
    const results = [];
    
    for (let i = 0; i < userEmails.length; i += batchSize) {
      const batch = userEmails.slice(i, i + batchSize);
      
      try {
        const batchResult = await resend.batch.send(
          batch.map((email) => ({
            from: 'Actif Jobs <jobs@syncsfer.com>', // Different from address for job alerts
            to: [email],
            subject: emailContent.subject,
            html: emailContent.html,
          }))
        );
        
        results.push(...batchResult);
        console.log(`📧 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userEmails.length / batchSize)} sent successfully`);
        
        // Add delay between batches to be respectful to email service
        if (i + batchSize < userEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError) {
        console.error(`❌ Error sending batch ${Math.floor(i / batchSize) + 1}:`, batchError);
        // Continue with next batch even if one fails
      }
    }
    
    console.log(`✅ Job alert emails processing completed. Total attempted: ${userEmails.length}`);
    return { success: true, results };
    
  } catch (error) {
    console.error('❌ Error in sendJobAlertEmail:', error);
    return { success: false, error: error.message };
  }
};

// Add these exports to your email service module
module.exports = {
  getJobAlertEmail,
  sendJobAlertEmail
};
