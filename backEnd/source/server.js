const fs = require('fs');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');
const { startDatabaseBootstrap } = require('./config/databaseBootstrap');
const { startAccountLifecycleJob } = require('./services/accountLifecycleService');
const { ensureTimelineSalesSeeded } = require('./services/timelineSalesService');
const PORT = process.env.PORT || 5000;

const buildPath = path.join(__dirname, '..', '..', 'frontEnd', 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const startServer = async () => {
  try {
    startDatabaseBootstrap();
    startAccountLifecycleJob();
    ensureTimelineSalesSeeded().catch(error => console.error('Timeline CSV seed failed:', error.message));

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
};

startServer();
