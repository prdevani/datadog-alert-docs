const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const DocumentGenerator = require('../services/documentGenerator');

const router = express.Router();

// Store for pending alerts awaiting template selection
const pendingAlerts = new Map();

// Function to generate a consistent hash for deduplication
function generateAlertHash(alert) {
  const crypto = require('crypto');
  // Create hash based on key alert properties, but be more flexible
  const hashData = {
    alert_type: alert.alert_type,
    title: alert.title || alert.event_title || 'untitled',
    // Use timestamp with minute precision to allow new alerts but prevent rapid duplicates
    timeWindow: Math.floor(Date.now() / (1000 * 60 * 5)) // 5-minute windows
  };
  
  // Only include org and id if they exist
  if (alert.org) hashData.org = alert.org;
  if (alert.id) hashData.id = alert.id;
  
  const hashString = JSON.stringify(hashData, Object.keys(hashData).sort());
  return crypto.createHash('md5').update(hashString).digest('hex');
}

// Datadog webhook endpoint
router.post('/datadog', async (req, res) => {
  try {
    console.log('📨 Received Datadog webhook:', JSON.stringify(req.body, null, 2));
    console.log('📨 Content-Type:', req.get('Content-Type'));
    console.log('📨 Raw body:', req.body);
    
    let alert;
    const timestamp = moment().toISOString();
    
    // Handle both JSON and text payloads from Datadog
    if (typeof req.body === 'string') {
      // Text payload - parse the Datadog message format
      const textPayload = req.body;
      const isAlert = textPayload.includes('[Triggered]') || textPayload.includes('Anomaly Detected');
      const isRecovery = textPayload.includes('Normalized') || textPayload.includes('Recovery');
      
      // Extract title from the first line
      const lines = textPayload.split('\n');
      const titleLine = lines[0] || 'Datadog Alert';
      
      alert = {
        alert_type: isAlert ? 'error' : (isRecovery ? 'recovery' : 'info'),
        title: titleLine.replace('[Triggered]', '').replace('[Recovery]', '').trim(),
        message: textPayload,
        priority: textPayload.toLowerCase().includes('anomaly') ? 'high' : 'medium',
        timestamp: timestamp,
        source: 'datadog_text'
      };
    } else if (req.body && typeof req.body === 'object') {
      // JSON payload - handle real Datadog webhook format
      const payload = req.body;
      
      alert = {
        alert_type: payload.event_type || payload.alert_type || 'info',
        title: payload.title || payload.event_title || 'Datadog Alert',
        message: payload.body || payload.message || JSON.stringify(payload),
        id: payload.id,
        date: payload.date,
        last_updated: payload.last_updated,
        org: payload.org,
        priority: 'medium',
        timestamp: timestamp,
        source: 'datadog_json',
        originalPayload: payload
      };
    } else {
      return res.status(400).json({ 
        error: 'Invalid webhook payload',
        message: 'Payload must be JSON object or text string'
      });
    }
    
    // Ensure we have at least a basic alert structure
    if (!alert.title && !alert.message) {
      alert.title = 'Datadog Alert';
    }
    
    // Generate hash for deduplication
    const alertHash = generateAlertHash(alert);
    
    // Check if we already have this alert (deduplication)
    const existingAlert = Array.from(pendingAlerts.values()).find(a => a.alertHash === alertHash);
    if (existingAlert) {
      console.log(`🔄 Duplicate alert detected (hash: ${alertHash}), returning existing alert ID: ${existingAlert.id}`);
      return res.status(200).json({
        success: true,
        alertId: existingAlert.id,
        message: 'Alert already received (duplicate detected)',
        nextStep: 'Select a template to generate documentation',
        duplicate: true
      });
    }
    
    const alertId = uuidv4();
    
    // Store the alert data
    const alertData = {
      id: alertId,
      timestamp,
      alertHash,
      originalPayload: alert,
      status: 'pending_template_selection',
      processedAt: null,
      documentId: null
    };
    
    // Save alert to file system
    const alertsDir = path.join(__dirname, '../../data/alerts');
    await fs.ensureDir(alertsDir);
    await fs.writeJson(path.join(alertsDir, `${alertId}.json`), alertData, { spaces: 2 });
    
    // Store in memory for quick access
    pendingAlerts.set(alertId, alertData);
    
    console.log(`✅ Alert ${alertId} stored and awaiting template selection (hash: ${alertHash})`);
    
    // Return success response to Datadog
    res.status(200).json({
      success: true,
      alertId,
      message: 'Alert received and queued for processing',
      nextStep: 'Select a template to generate documentation'
    });
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

// Get pending alerts
router.get('/pending', async (req, res) => {
  try {
    const alerts = Array.from(pendingAlerts.values())
      .filter(alert => alert.status === 'pending_template_selection')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      count: alerts.length,
      alerts: alerts.map(alert => ({
        id: alert.id,
        timestamp: alert.timestamp,
        alertType: alert.originalPayload.alert_type,
        title: alert.originalPayload.title || 'Untitled Alert',
        priority: alert.originalPayload.priority || 'normal',
        status: alert.status
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching pending alerts:', error);
    res.status(500).json({
      error: 'Failed to fetch pending alerts',
      message: error.message
    });
  }
});

// Process alert with selected template
router.post('/process/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { templateId } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        error: 'Template ID is required',
        message: 'Please provide a templateId in the request body'
      });
    }
    
    // Get alert data
    const alertData = pendingAlerts.get(alertId);
    if (!alertData) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID ${alertId} not found or already processed`
      });
    }
    
    console.log(`🔄 Processing alert ${alertId} with template ${templateId}`);
    
    // Generate documentation
    const documentGenerator = new DocumentGenerator();
    const document = await documentGenerator.generateDocument(alertData.originalPayload, templateId);
    
    // Update alert status
    alertData.status = 'processed';
    alertData.processedAt = moment().toISOString();
    alertData.documentId = document.id;
    alertData.templateId = templateId;
    
    // Update stored alert
    const alertsDir = path.join(__dirname, '../../data/alerts');
    await fs.writeJson(path.join(alertsDir, `${alertId}.json`), alertData, { spaces: 2 });
    
    // Remove from pending alerts
    pendingAlerts.delete(alertId);
    
    console.log(`✅ Alert ${alertId} processed successfully. Document ID: ${document.id}`);
    
    res.json({
      success: true,
      message: 'Alert processed successfully',
      alertId,
      documentId: document.id,
      document
    });
    
  } catch (error) {
    console.error('❌ Error processing alert:', error);
    res.status(500).json({
      error: 'Failed to process alert',
      message: error.message
    });
  }
});

// Get alert details
router.get('/alert/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    // Try memory first
    let alertData = pendingAlerts.get(alertId);
    
    // If not in memory, try file system
    if (!alertData) {
      const alertPath = path.join(__dirname, '../../data/alerts', `${alertId}.json`);
      if (await fs.pathExists(alertPath)) {
        alertData = await fs.readJson(alertPath);
      }
    }
    
    if (!alertData) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID ${alertId} not found`
      });
    }
    
    res.json({
      success: true,
      alert: alertData
    });
    
  } catch (error) {
    console.error('❌ Error fetching alert:', error);
    res.status(500).json({
      error: 'Failed to fetch alert',
      message: error.message
    });
  }
});

module.exports = router;
