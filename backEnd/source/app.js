const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { databaseReady, getDatabaseBootstrapStatus } = require('./config/databaseBootstrap');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', (req, res, next) => next());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  const bootstrap = getDatabaseBootstrapStatus();
  res.json({
    success: true,
    message: 'Backend running',
    data: {
      databaseReady: databaseReady(),
      databaseBootstrap: bootstrap,
    },
  });
});

app.get('/', (req, res) => {
  res.send('Backend Running');
});

module.exports = app;
