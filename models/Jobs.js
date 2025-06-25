const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      default: function() {
        return 'JOB' + Math.floor(100000 + Math.random() * 900000);
      },
      unique: true,
    },
    companyId: {
      type: String,
      required: true,
      ref: "CompanyProfile",
    },
    userId: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    basicInformation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobBasicInformation",
    },
    locationAndWork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobLocationAndWork",
    },
    requirements: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobRequirements",
    },
    compensation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCompensation",
    },
    applicationProcess: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobApplicationProcess",
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired', 'deleted'],
      default: 'active',
    },
    applicantCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    isBoosted: {
      type: Boolean,
      default: false,
    },
    boostExpiry: {
      type: Date,
    },
    jobPostExpiry: {
      type: Date
    },
    applications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobApplication"
    },
  ],
  },
  
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);