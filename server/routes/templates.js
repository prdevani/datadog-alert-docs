const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/templates/uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept text files, handlebars templates, and common document formats
    const allowedTypes = [
      'text/plain',
      'text/html',
      'application/json',
      'text/markdown'
    ];
    
    const allowedExtensions = ['.txt', '.hbs', '.handlebars', '.html', '.md', '.json', '.template'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: .txt, .hbs, .handlebars, .html, .md, .json, .template'));
    }
  }
});

// Get all templates
router.get('/', async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, '../../data/templates');
    await fs.ensureDir(templatesDir);
    
    const templateFiles = await fs.readdir(templatesDir);
    const templates = [];
    
    for (const file of templateFiles) {
      if (file.endsWith('.json') && !file.startsWith('uploads')) {
        try {
          const templatePath = path.join(templatesDir, file);
          const template = await fs.readJson(templatePath);
          templates.push(template);
        } catch (error) {
          console.warn(`Failed to read template ${file}:`, error.message);
        }
      }
    }
    
    // Sort by creation date (newest first)
    templates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      count: templates.length,
      templates
    });
    
  } catch (error) {
    console.error('❌ Error fetching templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
});

// Get specific template
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templatePath = path.join(__dirname, '../../data/templates', `${templateId}.json`);
    
    if (!(await fs.pathExists(templatePath))) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template with ID ${templateId} does not exist`
      });
    }
    
    const template = await fs.readJson(templatePath);
    
    res.json({
      success: true,
      template
    });
    
  } catch (error) {
    console.error('❌ Error fetching template:', error);
    res.status(500).json({
      error: 'Failed to fetch template',
      message: error.message
    });
  }
});

// Upload and create new template
router.post('/upload', upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a template file to upload'
      });
    }
    
    const { name, description, category = 'general' } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: 'Template name is required',
        message: 'Please provide a name for the template'
      });
    }
    
    // Read the uploaded file content
    const templateContent = await fs.readFile(req.file.path, 'utf8');
    
    // Create template metadata
    const templateId = uuidv4();
    const template = {
      id: templateId,
      name: name.trim(),
      description: description?.trim() || '',
      category: category.trim(),
      content: templateContent,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
      usageCount: 0
    };
    
    // Save template metadata
    const templatesDir = path.join(__dirname, '../../data/templates');
    await fs.ensureDir(templatesDir);
    await fs.writeJson(path.join(templatesDir, `${templateId}.json`), template, { spaces: 2 });
    
    // Clean up uploaded file (we've stored the content in the template)
    await fs.remove(req.file.path);
    
    console.log(`✅ Template "${name}" created with ID: ${templateId}`);
    
    res.status(201).json({
      success: true,
      message: 'Template uploaded successfully',
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        createdAt: template.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error uploading template:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      error: 'Failed to upload template',
      message: error.message
    });
  }
});

// Create template from text content
router.post('/', async (req, res) => {
  try {
    const { name, description, category = 'general', content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Template name and content are required'
      });
    }
    
    const templateId = uuidv4();
    const template = {
      id: templateId,
      name: name.trim(),
      description: description?.trim() || '',
      category: category.trim(),
      content: content.trim(),
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
      usageCount: 0
    };
    
    // Save template
    const templatesDir = path.join(__dirname, '../../data/templates');
    await fs.ensureDir(templatesDir);
    await fs.writeJson(path.join(templatesDir, `${templateId}.json`), template, { spaces: 2 });
    
    console.log(`✅ Template "${name}" created with ID: ${templateId}`);
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        createdAt: template.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message
    });
  }
});

// Update template
router.put('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, description, category, content } = req.body;
    
    const templatePath = path.join(__dirname, '../../data/templates', `${templateId}.json`);
    
    if (!(await fs.pathExists(templatePath))) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template with ID ${templateId} does not exist`
      });
    }
    
    // Read existing template
    const existingTemplate = await fs.readJson(templatePath);
    
    // Update fields
    const updatedTemplate = {
      ...existingTemplate,
      name: name?.trim() || existingTemplate.name,
      description: description?.trim() || existingTemplate.description,
      category: category?.trim() || existingTemplate.category,
      content: content?.trim() || existingTemplate.content,
      updatedAt: moment().toISOString()
    };
    
    // Save updated template
    await fs.writeJson(templatePath, updatedTemplate, { spaces: 2 });
    
    console.log(`✅ Template ${templateId} updated successfully`);
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        category: updatedTemplate.category,
        updatedAt: updatedTemplate.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message
    });
  }
});

// Delete template
router.delete('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const templatePath = path.join(__dirname, '../../data/templates', `${templateId}.json`);
    
    if (!(await fs.pathExists(templatePath))) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template with ID ${templateId} does not exist`
      });
    }
    
    // Read template for logging
    const template = await fs.readJson(templatePath);
    
    // Delete template file
    await fs.remove(templatePath);
    
    console.log(`✅ Template "${template.name}" (${templateId}) deleted successfully`);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message
    });
  }
});

module.exports = router;
