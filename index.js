require('dotenv').config();
const express = require('express');
const connectDB = require('./services/database');
const { startCronJob } = require('./services/subscriptionCron');

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'subscription-renewal-cron'
  });
});

// Initialize and start the server
async function startServer() {
  await connectDB();
  startCronJob();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Cron job service started`);
  });
}

startServer();

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully');
  process.exit(0);
});