const mongoose = require('mongoose');

const jobAlertNotification = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    required: true,
  },
  userEmails: {
    type: [String],
    required: true,
  },
  jobData: {
    jobTitle: String,
    jobId: String,
    companyName: String,
    applicationDeadline: Date,
    workLocation: String,
    salaryInfo: String,
    workArrangement: String
  },
  scheduledFor: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  sentAt: {
    type: Date,
  }
}, { timestamps: true });

module.exports = mongoose.model("JobAlertNotification", jobAlertNotification);