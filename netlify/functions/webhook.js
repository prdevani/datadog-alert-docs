const fs = require('fs').promises;
const path = require('path');

// Utility function to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Get data directory path (use /tmp for Netlify functions)
function getDataDir() {
  return process.env.NODE_ENV === 'production' ? '/tmp/data' : path.join(__dirname, '../../data');
}

// In-memory storage for pending alerts (will reset on function cold starts)
let pendingAlerts = [];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const pathSegments = event.path.split('/').filter(Boolean);
  const endpoint = pathSegments[pathSegments.length - 1];

  try {
    if (event.httpMethod === 'POST' && endpoint === 'datadog') {
      // Handle Datadog webhook
      const alertData = JSON.parse(event.body);
      
      const alert = {
        id: Date.now().toString(),
        ...alertData,
        received_at: new Date().toISOString(),
        status: 'pending'
      };

      pendingAlerts.push(alert);

      // Also save to file system
      const dataDir = getDataDir();
      await ensureDir(dataDir);
      const alertsFile = path.join(dataDir, 'alerts.json');
      
      let existingAlerts = [];
      try {
        const data = await fs.readFile(alertsFile, 'utf8');
        existingAlerts = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start with empty array
      }

      existingAlerts.push(alert);
      await fs.writeFile(alertsFile, JSON.stringify(existingAlerts, null, 2));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Alert received successfully',
          alertId: alert.id 
        })
      };
    }

    if (event.httpMethod === 'GET' && endpoint === 'pending') {
      // Get pending alerts
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          alerts: pendingAlerts 
        })
      };
    }

    if (event.httpMethod === 'POST' && endpoint === 'process') {
      // Process alert with template
      const { alertId, templateId } = JSON.parse(event.body);
      
      const alertIndex = pendingAlerts.findIndex(alert => alert.id === alertId);
      if (alertIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Alert not found' 
          })
        };
      }

      // Mark alert as processed
      pendingAlerts[alertIndex].status = 'processed';
      pendingAlerts[alertIndex].templateId = templateId;
      pendingAlerts[alertIndex].processed_at = new Date().toISOString();

      // Remove from pending list
      const processedAlert = pendingAlerts.splice(alertIndex, 1)[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Alert processed successfully',
          alert: processedAlert 
        })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Endpoint not found' 
      })
    };

  } catch (error) {
    console.error('Webhook function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message 
      })
    };
  }
};
