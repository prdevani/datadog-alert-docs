const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

const router = express.Router();

// Get all documents
router.get('/', async (req, res) => {
  try {
    const documentsDir = path.join(__dirname, '../../data/documents');
    await fs.ensureDir(documentsDir);
    
    const documentFiles = await fs.readdir(documentsDir);
    const documents = [];
    
    for (const file of documentFiles) {
      if (file.endsWith('.json')) {
        try {
          const documentPath = path.join(documentsDir, file);
          const document = await fs.readJson(documentPath);
          
          // Only include metadata for list view
          documents.push({
            id: document.id,
            title: document.title,
            alertType: document.alertType,
            templateName: document.templateName,
            createdAt: document.createdAt,
            priority: document.priority,
            status: document.status
          });
        } catch (error) {
          console.warn(`Failed to read document ${file}:`, error.message);
        }
      }
    }
    
    // Sort by creation date (newest first)
    documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: documents.length,
      documents
    });
    
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message
    });
  }
});

// Get specific document
router.get('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentPath = path.join(__dirname, '../../data/documents', `${documentId}.json`);
    
    if (!(await fs.pathExists(documentPath))) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${documentId} does not exist`
      });
    }
    
    const document = await fs.readJson(documentPath);
    
    res.json({
      success: true,
      document
    });
    
  } catch (error) {
    console.error('❌ Error fetching document:', error);
    res.status(500).json({
      error: 'Failed to fetch document',
      message: error.message
    });
  }
});

// Get document content as plain text
router.get('/:documentId/content', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentPath = path.join(__dirname, '../../data/documents', `${documentId}.json`);
    
    if (!(await fs.pathExists(documentPath))) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${documentId} does not exist`
      });
    }
    
    const document = await fs.readJson(documentPath);
    
    res.set({
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt"`
    });
    
    res.send(document.content);
    
  } catch (error) {
    console.error('❌ Error fetching document content:', error);
    res.status(500).json({
      error: 'Failed to fetch document content',
      message: error.message
    });
  }
});

// Get document content as HTML
router.get('/:documentId/html', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentPath = path.join(__dirname, '../../data/documents', `${documentId}.json`);
    
    if (!(await fs.pathExists(documentPath))) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${documentId} does not exist`
      });
    }
    
    const document = await fs.readJson(documentPath);
    
    // Convert plain text to HTML with basic formatting
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .header {
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 2em;
            margin: 0 0 10px 0;
            color: #1a1a1a;
        }
        .meta {
            color: #666;
            font-size: 0.9em;
        }
        .content {
            white-space: pre-wrap;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #0366d6;
        }
        .priority-high { border-left-color: #d73a49; }
        .priority-medium { border-left-color: #f66a0a; }
        .priority-low { border-left-color: #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${document.title}</h1>
        <div class="meta">
            <strong>Alert Type:</strong> ${document.alertType} | 
            <strong>Priority:</strong> ${document.priority} | 
            <strong>Generated:</strong> ${moment(document.createdAt).format('MMMM Do YYYY, h:mm:ss a')} |
            <strong>Template:</strong> ${document.templateName}
        </div>
    </div>
    <div class="content priority-${document.priority}">${document.content}</div>
</body>
</html>`;
    
    res.set('Content-Type', 'text/html');
    res.send(htmlContent);
    
  } catch (error) {
    console.error('❌ Error fetching document HTML:', error);
    res.status(500).json({
      error: 'Failed to fetch document HTML',
      message: error.message
    });
  }
});

// Update document
router.put('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { title, content, status } = req.body;
    
    const documentPath = path.join(__dirname, '../../data/documents', `${documentId}.json`);
    
    if (!(await fs.pathExists(documentPath))) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${documentId} does not exist`
      });
    }
    
    // Read existing document
    const existingDocument = await fs.readJson(documentPath);
    
    // Update fields
    const updatedDocument = {
      ...existingDocument,
      title: title?.trim() || existingDocument.title,
      content: content?.trim() || existingDocument.content,
      status: status || existingDocument.status,
      updatedAt: moment().toISOString()
    };
    
    // Save updated document
    await fs.writeJson(documentPath, updatedDocument, { spaces: 2 });
    
    console.log(`✅ Document ${documentId} updated successfully`);
    
    res.json({
      success: true,
      message: 'Document updated successfully',
      document: {
        id: updatedDocument.id,
        title: updatedDocument.title,
        alertType: updatedDocument.alertType,
        updatedAt: updatedDocument.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating document:', error);
    res.status(500).json({
      error: 'Failed to update document',
      message: error.message
    });
  }
});

// Delete document
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const documentPath = path.join(__dirname, '../../data/documents', `${documentId}.json`);
    
    if (!(await fs.pathExists(documentPath))) {
      return res.status(404).json({
        error: 'Document not found',
        message: `Document with ID ${documentId} does not exist`
      });
    }
    
    // Read document for logging
    const document = await fs.readJson(documentPath);
    
    // Delete document file
    await fs.remove(documentPath);
    
    console.log(`✅ Document "${document.title}" (${documentId}) deleted successfully`);
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message
    });
  }
});

// Search documents
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();
    
    const documentsDir = path.join(__dirname, '../../data/documents');
    await fs.ensureDir(documentsDir);
    
    const documentFiles = await fs.readdir(documentsDir);
    const matchingDocuments = [];
    
    for (const file of documentFiles) {
      if (file.endsWith('.json')) {
        try {
          const documentPath = path.join(documentsDir, file);
          const document = await fs.readJson(documentPath);
          
          // Search in title, content, and alert type
          const searchableText = `${document.title} ${document.content} ${document.alertType}`.toLowerCase();
          
          if (searchableText.includes(searchTerm)) {
            matchingDocuments.push({
              id: document.id,
              title: document.title,
              alertType: document.alertType,
              templateName: document.templateName,
              createdAt: document.createdAt,
              priority: document.priority,
              status: document.status,
              // Include a snippet of matching content
              snippet: document.content.substring(0, 200) + '...'
            });
          }
        } catch (error) {
          console.warn(`Failed to search document ${file}:`, error.message);
        }
      }
    }
    
    // Sort by creation date (newest first)
    matchingDocuments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      query: query,
      count: matchingDocuments.length,
      documents: matchingDocuments
    });
    
  } catch (error) {
    console.error('❌ Error searching documents:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      message: error.message
    });
  }
});

module.exports = router;
