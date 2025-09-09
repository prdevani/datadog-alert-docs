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
  return '/tmp/data';
}

// In-memory storage for pending alerts (will reset on function cold starts)
let pendingAlerts = [];

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
      let alert;
      const timestamp = new Date().toISOString();
      
      try {
        // Try to parse as JSON first
        const alertData = JSON.parse(event.body);
        
        // Validate JSON webhook payload
        if (!alertData || !alertData.alert_type) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid webhook payload',
              message: 'Missing required alert_type field'
            })
          };
        }
        
        alert = {
          ...alertData,
          timestamp: timestamp,
          source: 'datadog_json'
        };
        
      } catch (jsonError) {
        // If JSON parsing fails, treat as text payload (real Datadog format)
        if (typeof event.body === 'string') {
          // Text payload - parse the Datadog message format
          const textPayload = event.body;
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
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid webhook payload',
              message: 'Unable to parse payload as JSON or text'
            })
          };
        }
      }
      
      // Generate hash for deduplication
      const alertHash = generateAlertHash(alert);
      
      // Check if we already have this alert (deduplication)
      const existingAlert = pendingAlerts.find(a => a.alertHash === alertHash);
      if (existingAlert) {
        console.log(`🔄 Duplicate alert detected (hash: ${alertHash}), returning existing alert ID: ${existingAlert.id}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            alertId: existingAlert.id,
            message: 'Alert already received (duplicate detected)',
            duplicate: true
          })
        };
      }
      
      const finalAlert = {
        id: Date.now().toString(),
        alertHash,
        ...alert,
        received_at: new Date().toISOString(),
        status: 'pending'
      };

      pendingAlerts.push(finalAlert);

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

      existingAlerts.push(finalAlert);
      await fs.writeFile(alertsFile, JSON.stringify(existingAlerts, null, 2));

      console.log(`✅ Alert ${finalAlert.id} stored and awaiting template selection (hash: ${alertHash})`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Alert received successfully',
          alertId: finalAlert.id 
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
