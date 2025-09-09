const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const webhookRoutes = require('./routes/webhook');
const templateRoutes = require('./routes/templates');
const documentRoutes = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'unsafe-hashes'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Ensure required directories exist
const ensureDirectories = async () => {
  const dirs = [
    path.join(__dirname, '../data/templates'),
    path.join(__dirname, '../data/documents'),
    path.join(__dirname, '../data/alerts')
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
};

// API Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/documents', documentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: require('../package.json').version
  });
});

// Serve the main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const startServer = async () => {
  try {
    await ensureDirectories();
    app.listen(PORT, () => {
      console.log(`🚀 Datadog Alert Documentation Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/webhook/datadog`);
      console.log(`🌐 Web interface: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
