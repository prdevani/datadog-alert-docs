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
// Force redeploy to ensure latest changes are active
function getDataDir() {
  return '/tmp/data';
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  const dataDir = getDataDir();
  const templatesFile = path.join(dataDir, 'templates.json');

  try {
    await ensureDir(dataDir);

    // Helper function to read templates
    async function readTemplates() {
      try {
        const data = await fs.readFile(templatesFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        return [];
      }
    }

    // Helper function to write templates
    async function writeTemplates(templates) {
      await fs.writeFile(templatesFile, JSON.stringify(templates, null, 2));
    }

    if (event.httpMethod === 'GET') {
      // Get all templates
      const templates = await readTemplates();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          templates 
        })
      };
    }

    if (event.httpMethod === 'POST') {
      // Create new template
      const { name, description, category, content } = JSON.parse(event.body);

      if (!name || !content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Name and content are required' 
          })
        };
      }

      const templates = await readTemplates();
      
      const newTemplate = {
        id: Date.now().toString(),
        name,
        description: description || '',
        category: category || 'General',
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0
      };

      templates.push(newTemplate);
      await writeTemplates(templates);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Template created successfully',
          template: newTemplate 
        })
      };
    }

    if (event.httpMethod === 'PUT') {
      // Update template
      const pathSegments = event.path.split('/').filter(Boolean);
      const templateId = pathSegments[pathSegments.length - 1];
      
      const { name, description, category, content } = JSON.parse(event.body);
      const templates = await readTemplates();
      
      const templateIndex = templates.findIndex(t => t.id === templateId);
      if (templateIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Template not found' 
          })
        };
      }

      templates[templateIndex] = {
        ...templates[templateIndex],
        name: name || templates[templateIndex].name,
        description: description !== undefined ? description : templates[templateIndex].description,
        category: category || templates[templateIndex].category,
        content: content || templates[templateIndex].content,
        updated_at: new Date().toISOString()
      };

      await writeTemplates(templates);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Template updated successfully',
          template: templates[templateIndex] 
        })
      };
    }

    if (event.httpMethod === 'DELETE') {
      // Delete template
      const pathSegments = event.path.split('/').filter(Boolean);
      const templateId = pathSegments[pathSegments.length - 1];
      
      const templates = await readTemplates();
      const templateIndex = templates.findIndex(t => t.id === templateId);
      
      if (templateIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Template not found' 
          })
        };
      }

      templates.splice(templateIndex, 1);
      await writeTemplates(templates);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Template deleted successfully' 
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Method not allowed' 
      })
    };

  } catch (error) {
    console.error('Templates function error:', error);
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
