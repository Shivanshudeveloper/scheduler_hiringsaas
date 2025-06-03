const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: true,
  },
  organizationId: {
    type: String,
    required: true,
  },
  publicId: {
    type: Number,
    required: true,
  },
  userType: {
    type: String,
    required: true,
  },
  plan: {
    type: String,
    required: true,
    default: 'marhaban', 
  },
  apiKey: {
    type: String,
    required: false,
  },
  accountStatus: {
    type: Number,
    required: false,
    default: 1, 
  },
  customerId: {
    type: String,
    required: false
  },
  subscriptionId: {
    type: String,
    required: false
  },
  trialEnd: {
    type: String,
    required: false
  },
  subscriptionStatus: {
    type: String,
    required: false
  },
  alertSeen: {
    type: Boolean,
    required: false,
    default: false
  },
  avatar: {
    type: String,
    required: false,
  },
  termsAndCondition: {
    type: Boolean,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('users', userSchema);
module.exports = User;
