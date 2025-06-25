const mongoose = require("mongoose");

const jobAdvertLimitSchema = new mongoose.Schema({
    userEmail: {
        type: String,
        required: true,
        unique: true
    },
    userPlan: {
        type: String, 
    },
    noOfJobs: {
        type: Number, 
    },
    updatedAt: {
        type: Date,
        default: Date.now()
    },
    paymentStatus: {
        type: Boolean,
        default: false
    },
    freeBoosts: {
        type: Number,
        default: 0
    }
})

module.exports = mongoose.model('JobAdvertLimitSchema', jobAdvertLimitSchema);