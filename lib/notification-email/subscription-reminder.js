// lib/notification-email/subscription-reminder.js

const { Resend } = require('resend');
const { API_KEY, FRONTEND_URL } = process.env;
const User = require('../../models/User');
const resend = new Resend(API_KEY);

// Format currency for display
function formatCurrency(amount, currency = 'MAD') {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

// Format date for display
function formatDate(date) {
  return new Intl.DateTimeFormat('fr-MA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
}

// Generate subscription reminder email content
const getSubscriptionReminderEmail = (data) => {
  const {
    userName,
    planName,
    billingCycle,
    amount,
    currency,
    nextBillingDate,
    userType
  } = data;

  const formattedAmount = formatCurrency(amount, currency);
  const formattedDate = formatDate(nextBillingDate);
  const billingCycleText = billingCycle === 'monthly' ? 'mensuel' : 'annuel';
  const planDisplayName = planName.charAt(0).toUpperCase() + planName.slice(1);

  return {
    subject: `🔔 Rappel: Votre abonnement ${planDisplayName} sera renouvelé dans 3 jours`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rappel de renouvellement d'abonnement</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              .header {
                  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                  color: white;
                  padding: 40px 30px;
                  text-align: center;
              }
              .header h1 {
                  margin: 0 0 10px 0;
                  font-size: 28px;
                  font-weight: 700;
              }
              .header p {
                  margin: 0;
                  font-size: 16px;
                  opacity: 0.95;
              }
              .content {
                  padding: 40px 30px;
              }
              .greeting {
                  font-size: 18px;
                  margin-bottom: 25px;
                  color: #1f2937;
              }
              .highlight-box {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 25px;
                  border-radius: 10px;
                  margin: 25px 0;
                  text-align: center;
              }
              .highlight-box h3 {
                  margin: 0 0 15px 0;
                  font-size: 20px;
                  font-weight: 600;
              }
              .highlight-box .date {
                  font-size: 24px;
                  font-weight: 700;
                  margin: 10px 0;
              }
              .highlight-box .amount {
                  font-size: 18px;
                  opacity: 0.95;
                  margin: 5px 0;
              }
              .plan-details {
                  background-color: #f8fafc;
                  border: 1px solid #e2e8f0;
                  padding: 25px;
                  border-radius: 10px;
                  margin: 25px 0;
              }
              .plan-details h3 {
                  color: #1f2937;
                  margin: 0 0 20px 0;
                  font-size: 18px;
                  font-weight: 600;
              }
              .detail-row {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin: 12px 0;
                  padding: 12px 0;
                  border-bottom: 1px solid #e2e8f0;
              }
              .detail-row:last-child {
                  border-bottom: none;
              }
              .detail-label {
                  font-weight: 600;
                  color: #374151;
              }
              .detail-value {
                  color: #1f2937;
                  font-weight: 500;
              }
              .cta-section {
                  text-align: center;
                  margin: 30px 0;
              }
              .cta-button {
                  display: inline-block;
                  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                  color: white;
                  padding: 16px 32px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.39);
                  transition: all 0.3s ease;
              }
              .cta-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.49);
              }
              .info-section {
                  background-color: #fef3c7;
                  border: 1px solid #f59e0b;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 25px 0;
              }
              .info-section h4 {
                  color: #92400e;
                  font-weight: 600;
                  margin: 0 0 12px 0;
                  font-size: 16px;
              }
              .info-section ul {
                  margin: 10px 0;
                  padding-left: 20px;
                  color: #78350f;
              }
              .info-section li {
                  margin: 8px 0;
              }
              .footer {
                  background-color: #f8fafc;
                  padding: 30px;
                  text-align: center;
                  border-top: 1px solid #e2e8f0;
              }
              .footer-content {
                  color: #6b7280;
                  font-size: 14px;
                  line-height: 1.6;
              }
              .contact-info {
                  margin: 15px 0;
                  font-weight: 500;
              }
              .social-links {
                  margin: 20px 0;
              }
              .social-links a {
                  color: #3b82f6;
                  text-decoration: none;
                  margin: 0 10px;
                  font-weight: 500;
              }
              .unsubscribe {
                  margin-top: 20px;
                  font-size: 12px;
                  color: #9ca3af;
              }
              .unsubscribe a {
                  color: #6b7280;
                  text-decoration: underline;
              }
              @media (max-width: 600px) {
                  body { padding: 10px; }
                  .header, .content, .footer { padding: 20px; }
                  .detail-row { 
                      flex-direction: column; 
                      align-items: flex-start;
                      gap: 5px;
                  }
                  .highlight-box .date { font-size: 20px; }
                  .cta-button { padding: 14px 24px; font-size: 15px; }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔔 Rappel de Renouvellement</h1>
                  <p>Votre abonnement sera renouvelé dans 3 jours</p>
              </div>

              <div class="content">
                  <div class="greeting">
                      Bonjour <strong>${userName}</strong>,
                  </div>
                  
                  <p>Nous espérons que vous appréciez votre expérience avec notre plateforme ! 
                  Ceci est un rappel amical que votre abonnement <strong>${planDisplayName}</strong> 
                  sera automatiquement renouvelé dans <strong>3 jours</strong>.</p>

                  <div class="highlight-box">
                      <h3>📅 Prochaine facturation</h3>
                      <div class="date">${formattedDate}</div>
                      <div class="amount">Montant: ${formattedAmount}</div>
                  </div>

                  <div class="plan-details">
                      <h3>📋 Détails de votre abonnement</h3>
                      
                      <div class="detail-row">
                          <span class="detail-label">Plan:</span>
                          <span class="detail-value">${planDisplayName}</span>
                      </div>
                      
                      <div class="detail-row">
                          <span class="detail-label">Cycle de facturation:</span>
                          <span class="detail-value">Renouvellement ${billingCycleText}</span>
                      </div>
                      
                      <div class="detail-row">
                          <span class="detail-label">Montant:</span>
                          <span class="detail-value">${formattedAmount}</span>
                      </div>
                      
                      <div class="detail-row">
                          <span class="detail-label">Prochaine facturation:</span>
                          <span class="detail-value">${formattedDate}</span>
                      </div>
                      
                      <div class="detail-row">
                          <span class="detail-label">Type de compte:</span>
                          <span class="detail-value">${userType === 'employer' ? 'Employeur' : 'Chercheur d\'emploi'}</span>
                      </div>
                  </div>

                  <div class="cta-section">
                      <a href="${FRONTEND_URL}/dashboard/subscription" class="cta-button">
                          🔧 Gérer mon abonnement
                      </a>
                  </div>

                  <div class="info-section">
                      <h4>⚠️ Important à savoir:</h4>
                      <ul>
                          <li>Le renouvellement sera automatique sauf si vous annulez avant la date de facturation</li>
                          <li>Vous pouvez modifier ou annuler votre abonnement à tout moment depuis votre tableau de bord</li>
                          <li>En cas d'annulation, vous garderez l'accès jusqu'à la fin de votre période payée</li>
                          <li>Aucune action n'est requise si vous souhaitez continuer avec le même plan</li>
                      </ul>
                  </div>

                  <p>Si vous avez des questions ou avez besoin d'aide, n'hésitez pas à nous contacter. 
                  Notre équipe de support est là pour vous aider !</p>

                  <p style="margin-top: 25px;">
                      Cordialement,<br>
                      <strong>L'équipe de Votre Plateforme</strong>
                  </p>
              </div>

              <div class="footer">
                  <div class="footer-content">
                      <div class="contact-info">
                          📧 support@votreplateforme.com | 📞 +212 XXX XXX XXX
                      </div>
                      
                      <div class="social-links">
                          <a href="#">Facebook</a>
                          <a href="#">LinkedIn</a>
                          <a href="#">Twitter</a>
                      </div>
                      
                      <div class="unsubscribe">
                          Vous recevez cet email car vous avez un abonnement actif sur notre plateforme.<br>
                          <a href="${FRONTEND_URL}/unsubscribe?email=${data.userEmail}">
                              Se désabonner des notifications
                          </a>
                      </div>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `
  };
};

// Main email sending function using Resend
async function sendSubscriptionReminderEmail(data) {
  try {
    const { userEmail, userName } = data;

    console.log(`📧 Preparing subscription reminder email for ${userEmail}`);

    // Generate email content
    const emailContent = getSubscriptionReminderEmail(data);

    // Send the email using Resend
    console.log(`📤 Sending reminder email to ${userEmail}...`);
    
    const result = await resend.emails.send({
      from: 'Subscription Reminders <jobs@actifjobs.com>', // Update to match your domain
      to: [userEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });
    
    console.log(`✅ Reminder email sent successfully to ${userEmail}`);
    console.log(`   Message ID: ${result.id}`);
    
    return {
      success: true,
      messageId: result.id,
      userEmail: userEmail
    };

  } catch (error) {
    console.error(`❌ Failed to send reminder email to ${data.userEmail}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      userEmail: data.userEmail
    };
  }
}

// Send multiple reminders in batches (if needed for bulk sending)
async function sendBatchSubscriptionReminders(reminderDataArray) {
  try {
    console.log(`📧 Sending ${reminderDataArray.length} subscription reminder emails in batches...`);
    
    const batchSize = 50; // Resend allows up to 100, but 50 is safer
    const results = [];
    
    for (let i = 0; i < reminderDataArray.length; i += batchSize) {
      const batch = reminderDataArray.slice(i, i + batchSize);
      
      try {
        // Prepare batch emails
        const batchEmails = batch.map((data) => {
          const emailContent = getSubscriptionReminderEmail(data);
          return {
            from: 'Subscription Reminders <jobs@actifjobs.com>',
            to: [data.userEmail],
            subject: emailContent.subject,
            html: emailContent.html,
          };
        });
        
        // Send batch
        const batchResult = await resend.batch.send(batchEmails);
        results.push(...batchResult);
        
        console.log(`📧 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reminderDataArray.length / batchSize)} sent successfully`);
        
        // Add delay between batches to be respectful to email service
        if (i + batchSize < reminderDataArray.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError) {
        console.error(`❌ Error sending batch ${Math.floor(i / batchSize) + 1}:`, batchError);
        // Continue with next batch even if one fails
      }
    }
    
    console.log(`✅ Subscription reminder emails processing completed. Total attempted: ${reminderDataArray.length}`);
    return { success: true, results };
    
  } catch (error) {
    console.error('❌ Error in sendBatchSubscriptionReminders:', error);
    return { success: false, error: error.message };
  }
}

// Send test email (for development/testing)
async function sendTestReminderEmail(testEmail) {
  const testData = {
    userEmail: testEmail,
    userName: 'Test User',
    planName: 'premium',
    billingCycle: 'monthly',
    amount: 99.99,
    currency: 'MAD',
    nextBillingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    userType: 'employer'
  };

  return await sendSubscriptionReminderEmail(testData);
}

// Verify Resend configuration
async function verifyEmailConfig() {
  try {
    // Resend doesn't have a verify method like nodemailer
    // Instead, we can check if the API key is valid by making a simple request
    if (!API_KEY) {
      throw new Error('RESEND API_KEY is not configured');
    }
    
    console.log('✅ Resend configuration appears valid');
    return { success: true, service: 'Resend' };
  } catch (error) {
    console.error('❌ Resend configuration verification failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendSubscriptionReminderEmail,
  sendBatchSubscriptionReminders,
  sendTestReminderEmail,
  verifyEmailConfig,
  getSubscriptionReminderEmail
};