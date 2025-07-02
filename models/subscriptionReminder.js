const mongoose = require('mongoose');

const subscriptionReminderSchema = new mongoose.Schema({
  // User and Subscription Information
  userEmail: {
    type: String,
    required: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  
  // Subscription Details (snapshot for the reminder)
  planName: {
    type: String,
    required: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'MAD',
    required: true
  },
  
  // Billing Information
  nextBillingDate: {
    type: Date,
    required: true
  },
  reminderSentDate: {
    type: Date,
    required: true
  },
  
  // Email Status
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  emailSentAt: {
    type: Date
  },
  errorMessage: {
    type: String
  },
  
  // Email Tracking (optional - for future analytics)
  emailOpened: {
    type: Boolean,
    default: false
  },
  emailOpenedAt: {
    type: Date
  },
  linkClicked: {
    type: Boolean,
    default: false
  },
  linkClickedAt: {
    type: Date
  },
  
  // Retry Information
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: {
    type: Date
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better query performance
subscriptionReminderSchema.index({ userEmail: 1, nextBillingDate: 1 });
subscriptionReminderSchema.index({ subscriptionId: 1 });
subscriptionReminderSchema.index({ status: 1 });
subscriptionReminderSchema.index({ reminderSentDate: 1 });
subscriptionReminderSchema.index({ createdAt: 1 });

// Compound index to prevent duplicate reminders for same billing cycle
subscriptionReminderSchema.index({ 
  userEmail: 1, 
  subscriptionId: 1, 
  nextBillingDate: 1 
}, { unique: true });

// Update the updatedAt field before saving
subscriptionReminderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to check if reminder already sent for billing cycle
subscriptionReminderSchema.statics.hasReminderBeenSent = async function(userEmail, subscriptionId, nextBillingDate) {
  const reminder = await this.findOne({
    userEmail,
    subscriptionId,
    nextBillingDate,
    status: { $in: ['sent', 'pending'] }
  });
  return !!reminder;
};

// Static method to get reminder statistics
subscriptionReminderSchema.statics.getStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = await this.countDocuments({
    createdAt: { $gte: startDate }
  });
  
  return {
    total,
    byStatus: stats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    successRate: total > 0 ? ((stats.find(s => s._id === 'sent')?.count || 0) / total * 100).toFixed(2) : 0
  };
};

// Instance method to mark as opened (for email tracking)
subscriptionReminderSchema.methods.markAsOpened = function() {
  if (!this.emailOpened) {
    this.emailOpened = true;
    this.emailOpenedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to mark link as clicked
subscriptionReminderSchema.methods.markLinkClicked = function() {
  if (!this.linkClicked) {
    this.linkClicked = true;
    this.linkClickedAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('SubscriptionReminder', subscriptionReminderSchema);