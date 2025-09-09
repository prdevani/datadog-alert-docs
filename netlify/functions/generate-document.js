const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

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

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', function(date) {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleString();
  } catch (error) {
    return date;
  }
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('ne', function(a, b) {
  return a !== b;
});

Handlebars.registerHelper('gt', function(a, b) {
  return a > b;
});

Handlebars.registerHelper('lt', function(a, b) {
  return a < b;
});

Handlebars.registerHelper('and', function(a, b) {
  return a && b;
});

Handlebars.registerHelper('or', function(a, b) {
  return a || b;
});

Handlebars.registerHelper('not', function(a) {
  return !a;
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Method not allowed' 
      })
    };
  }

  const dataDir = getDataDir();

  try {
    await ensureDir(dataDir);

    const { templateId, alertData } = JSON.parse(event.body);

    if (!templateId || !alertData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Template ID and alert data are required' 
        })
      };
    }

    // Read templates
    const templatesFile = path.join(dataDir, 'templates.json');
    let templates = [];
    try {
      const data = await fs.readFile(templatesFile, 'utf8');
      templates = JSON.parse(data);
    } catch (error) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Templates not found' 
        })
      };
    }

    // Find the template
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: 'Template not found' 
        })
      };
    }

    // Prepare context for template rendering
    const context = {
      ...alertData,
      now: new Date().toISOString(),
      resolved: alertData.alert_type === 'recovery' || alertData.event_type === 'recovery'
    };

    // Compile and render template
    const compiledTemplate = Handlebars.compile(template.content);
    const renderedContent = compiledTemplate(context);

    // Create document
    const document = {
      id: Date.now().toString(),
      title: `${alertData.title || 'Alert'} - ${new Date().toLocaleDateString()}`,
      content: renderedContent,
      template_id: templateId,
      alert_data: alertData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save document
    const documentsFile = path.join(dataDir, 'documents.json');
    let documents = [];
    try {
      const data = await fs.readFile(documentsFile, 'utf8');
      documents = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start with empty array
    }

    documents.push(document);
    await fs.writeFile(documentsFile, JSON.stringify(documents, null, 2));

    // Update template usage count
    const templateIndex = templates.findIndex(t => t.id === templateId);
    if (templateIndex !== -1) {
      templates[templateIndex].usage_count = (templates[templateIndex].usage_count || 0) + 1;
      templates[templateIndex].last_used = new Date().toISOString();
      await fs.writeFile(templatesFile, JSON.stringify(templates, null, 2));
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Document generated successfully',
        document 
      })
    };

  } catch (error) {
    console.error('Generate document function error:', error);
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
