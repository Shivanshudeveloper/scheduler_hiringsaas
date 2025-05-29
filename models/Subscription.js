const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  userEmail: { 
    type: String, 
    required: true, 
    unique: true 
  },
  planName: { 
    type: String, 
    required: true 
  },  
  billingCycle: { 
    type: String, 
    enum: ['monthly', 'yearly'], 
    required: true 
  },
  userType: { 
    type: String, 
    enum: ['jobseeker', 'employer'], 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'MAD' 
  },
  paymentProfileId:{
    type: String,
  },
  orderId: { 
    type: String, 
    required: true, 
    unique: true 
  }, 
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  paymentMethod: { // From webhook: 'Visa', 'Mastercard', etc.
    type: String
  },
  nextBillingDate: {
    type: Date,
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastChargedDate:{
    type: Date
  }
});

// Indexes for faster lookups and duplicate prevention
subscriptionSchema.index({ userEmail: 1 });
subscriptionSchema.index({ orderId: 1 });
subscriptionSchema.index({ userEmail: 1, orderId: 1 }, { unique: true });

// Update the updatedAt field before saving
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);