const mongoose = require("mongoose");

const transactionHistorySchema = new mongoose.Schema({
  // Transaction Identifiers
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
    type: String,
    required: true
  },
  
  // User Information
  userEmail: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['jobseeker', 'employer'],
    required: true
  },
  
  // For subscription transactions
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  planName: {
    type: String
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly']
  },
  
  // For job boost transactions
  jobId: {
    type: String // Store the jobId for boost transactions
  },
  boostDuration: {
    type: Number // Duration in days (20 for job boost)
  },
  
  // Transaction types including boost
  transactionType: {
    type: String,
    enum: [
      'initial_payment',    // First subscription payment
      'recurring_payment',  // Monthly/yearly renewal
      'job_boost',         // Job boost payment
      'refund'             // Refund (if implemented later)
    ],
    required: true
  },
  
  // Financial Information - All amounts are for successful payments
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'MAD',
    required: true
  },
  
  // Payment Information
  paymentMethod: {
    type: String // 'CREDIT_CARD', 'Visa', 'Mastercard', etc.
  },
  paymentProfileId: {
    type: String
  },
  
  // All transactions are successful, so status is always 'completed'
  status: {
    type: String,
    default: 'completed',
    enum: ['completed']
  },
  
  // Gateway Information
  gatewayTransactionId: {
    type: String // Transaction ID from Payzone
  },
  
  // Billing Period Information (for subscriptions)
  billingPeriodStart: {
    type: Date
  },
  billingPeriodEnd: {
    type: Date
  },
  
  // Boost Information (for job boosts)
  boostStartDate: {
    type: Date
  },
  boostEndDate: {
    type: Date
  },
  
  // Description
  description: {
    type: String,
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date,
    required: true
  }
});

// Indexes for better query performance
transactionHistorySchema.index({ userEmail: 1, createdAt: -1 });
transactionHistorySchema.index({ subscriptionId: 1 });
transactionHistorySchema.index({ transactionId: 1 });
transactionHistorySchema.index({ orderId: 1 });
transactionHistorySchema.index({ transactionType: 1 });
transactionHistorySchema.index({ gatewayTransactionId: 1 });
transactionHistorySchema.index({ jobId: 1 }); // Index for job boost transactions
transactionHistorySchema.index({ boostStartDate: 1, boostEndDate: 1 }); // Index for boost periods

// Helper method to create transaction record
transactionHistorySchema.statics.createTransaction = async function(transactionData) {
  const transaction = new this(transactionData);
  return await transaction.save();
};

// Helper method to get user payment history (including boosts)
transactionHistorySchema.statics.getUserPayments = async function(userEmail, options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    transactionType, 
    startDate, 
    endDate 
  } = options;
  
  const filter = { userEmail };
  
  if (transactionType) filter.transactionType = transactionType;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  
  const transactions = await this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('subscriptionId', 'planName billingCycle');
    
  const total = await this.countDocuments(filter);
  
  return {
    transactions,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  };
};

module.exports = mongoose.model('TransactionHistory', transactionHistorySchema);