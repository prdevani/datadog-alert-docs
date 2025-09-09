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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
  const documentsFile = path.join(dataDir, 'documents.json');

  try {
    await ensureDir(dataDir);

    // Helper function to read documents
    async function readDocuments() {
      try {
        const data = await fs.readFile(documentsFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        return [];
      }
    }

    // Helper function to write documents
    async function writeDocuments(documents) {
      await fs.writeFile(documentsFile, JSON.stringify(documents, null, 2));
    }

    const pathSegments = event.path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (event.httpMethod === 'GET') {
      const documents = await readDocuments();

      // Check if this is a search request
      const queryParams = event.queryStringParameters || {};
      if (queryParams.search) {
        const searchTerm = queryParams.search.toLowerCase();
        const filteredDocuments = documents.filter(doc => 
          doc.title.toLowerCase().includes(searchTerm) ||
          doc.content.toLowerCase().includes(searchTerm) ||
          (doc.alert_data && JSON.stringify(doc.alert_data).toLowerCase().includes(searchTerm))
        );
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            documents: filteredDocuments 
          })
        };
      }

      // Check if requesting a specific document
      if (lastSegment && lastSegment !== 'documents') {
        const document = documents.find(doc => doc.id === lastSegment);
        if (!document) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              success: false, 
              message: 'Document not found' 
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            document 
          })
        };
      }

      // Return all documents
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          documents 
        })
      };
    }

    if (event.httpMethod === 'POST') {
      // Create new document
      const { title, content, template_id, alert_data } = JSON.parse(event.body);

      if (!title || !content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Title and content are required' 
          })
        };
      }

      const documents = await readDocuments();
      
      const newDocument = {
        id: Date.now().toString(),
        title,
        content,
        template_id: template_id || null,
        alert_data: alert_data || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      documents.push(newDocument);
      await writeDocuments(documents);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Document created successfully',
          document: newDocument 
        })
      };
    }

    if (event.httpMethod === 'DELETE') {
      // Delete document
      const documentId = lastSegment;
      
      const documents = await readDocuments();
      const documentIndex = documents.findIndex(doc => doc.id === documentId);
      
      if (documentIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false, 
            message: 'Document not found' 
          })
        };
      }

      documents.splice(documentIndex, 1);
      await writeDocuments(documents);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Document deleted successfully' 
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
    console.error('Documents function error:', error);
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
