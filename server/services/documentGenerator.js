const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Handlebars = require('handlebars');

class DocumentGenerator {
  constructor() {
    this.setupHandlebarsHelpers();
  }

  setupHandlebarsHelpers() {
    // Register custom Handlebars helpers
    Handlebars.registerHelper('formatDate', (date, format = 'MMMM Do YYYY, h:mm:ss a') => {
      return moment(date).format(format);
    });

    Handlebars.registerHelper('formatDuration', (seconds) => {
      const duration = moment.duration(seconds, 'seconds');
      if (duration.asHours() >= 1) {
        return `${Math.floor(duration.asHours())}h ${duration.minutes()}m`;
      } else if (duration.asMinutes() >= 1) {
        return `${Math.floor(duration.asMinutes())}m ${duration.seconds()}s`;
      } else {
        return `${duration.seconds()}s`;
      }
    });

    Handlebars.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('upper', (str) => {
      if (!str) return '';
      return str.toUpperCase();
    });

    Handlebars.registerHelper('lower', (str) => {
      if (!str) return '';
      return str.toLowerCase();
    });

    Handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2);
    });

    Handlebars.registerHelper('eq', (a, b) => {
      return a === b;
    });

    Handlebars.registerHelper('ne', (a, b) => {
      return a !== b;
    });

    Handlebars.registerHelper('gt', (a, b) => {
      return a > b;
    });

    Handlebars.registerHelper('lt', (a, b) => {
      return a < b;
    });

    Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }

  async generateDocument(alertData, templateId) {
    try {
      console.log(`🔄 Generating document for alert using template ${templateId}`);

      // Load template
      const template = await this.loadTemplate(templateId);
      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Prepare context data for template
      const context = this.prepareTemplateContext(alertData);

      // Compile and render template
      const compiledTemplate = Handlebars.compile(template.content);
      const renderedContent = compiledTemplate(context);

      // Create document
      const documentId = uuidv4();
      const document = {
        id: documentId,
        title: this.generateDocumentTitle(alertData, context),
        content: renderedContent,
        alertType: alertData.alert_type || 'unknown',
        priority: this.determinePriority(alertData),
        status: 'generated',
        templateId: templateId,
        templateName: template.name,
        originalAlert: alertData,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString()
      };

      // Save document
      await this.saveDocument(document);

      // Update template usage count
      await this.updateTemplateUsage(templateId);

      console.log(`✅ Document generated successfully: ${documentId}`);
      return document;

    } catch (error) {
      console.error('❌ Error generating document:', error);
      throw error;
    }
  }

  async loadTemplate(templateId) {
    try {
      const templatePath = path.join(__dirname, '../../data/templates', `${templateId}.json`);
      
      if (!(await fs.pathExists(templatePath))) {
        return null;
      }

      return await fs.readJson(templatePath);
    } catch (error) {
      console.error(`Error loading template ${templateId}:`, error);
      return null;
    }
  }

  prepareTemplateContext(alertData) {
    const now = moment();
    
    // Extract common Datadog alert fields
    const context = {
      // Alert basic info
      alert: {
        id: alertData.id || 'unknown',
        type: alertData.alert_type || 'unknown',
        title: alertData.title || 'Untitled Alert',
        message: alertData.body || alertData.message || '',
        priority: this.determinePriority(alertData),
        status: alertData.alert_transition || alertData.status || 'unknown',
        url: alertData.link || '',
        tags: alertData.tags || []
      },

      // Timing information
      time: {
        triggered: alertData.date ? moment.unix(alertData.date) : now,
        formatted: alertData.date ? moment.unix(alertData.date).format('MMMM Do YYYY, h:mm:ss a') : now.format('MMMM Do YYYY, h:mm:ss a'),
        iso: alertData.date ? moment.unix(alertData.date).toISOString() : now.toISOString(),
        unix: alertData.date || now.unix(),
        relative: alertData.date ? moment.unix(alertData.date).fromNow() : 'now'
      },

      // Metric information
      metric: {
        name: alertData.metric_name || alertData.metric || '',
        value: alertData.metric_value || alertData.value || '',
        unit: alertData.unit || '',
        threshold: alertData.threshold || '',
        condition: alertData.condition || ''
      },

      // Host/Service information
      host: {
        name: alertData.hostname || alertData.host || '',
        ip: alertData.host_ip || '',
        environment: this.extractTag(alertData.tags, 'env') || this.extractTag(alertData.tags, 'environment') || '',
        service: this.extractTag(alertData.tags, 'service') || '',
        team: this.extractTag(alertData.tags, 'team') || '',
        region: this.extractTag(alertData.tags, 'region') || ''
      },

      // Organization info
      org: {
        name: alertData.org_name || '',
        id: alertData.org_id || ''
      },

      // Raw alert data for advanced templating
      raw: alertData,

      // Generation metadata
      generated: {
        at: now.toISOString(),
        formatted: now.format('MMMM Do YYYY, h:mm:ss a'),
        by: 'Datadog Alert Documentation Generator'
      }
    };

    return context;
  }

  extractTag(tags, key) {
    if (!Array.isArray(tags)) return '';
    
    const tag = tags.find(tag => {
      if (typeof tag === 'string') {
        return tag.startsWith(`${key}:`);
      }
      return false;
    });

    return tag ? tag.split(':')[1] : '';
  }

  determinePriority(alertData) {
    // Determine priority based on various alert fields
    const priority = alertData.priority || alertData.alert_type;
    
    if (typeof priority === 'string') {
      const p = priority.toLowerCase();
      if (p.includes('critical') || p.includes('high') || p.includes('error')) {
        return 'high';
      } else if (p.includes('warning') || p.includes('medium') || p.includes('warn')) {
        return 'medium';
      } else if (p.includes('info') || p.includes('low')) {
        return 'low';
      }
    }

    // Default based on alert type
    const alertType = (alertData.alert_type || '').toLowerCase();
    if (alertType.includes('error') || alertType.includes('critical')) {
      return 'high';
    } else if (alertType.includes('warning') || alertType.includes('anomaly')) {
      return 'medium';
    }

    return 'medium'; // Default priority
  }

  generateDocumentTitle(alertData, context) {
    // Generate a meaningful title for the document
    const alertTitle = alertData.title || alertData.message || 'Alert Documentation';
    const timestamp = moment().format('YYYY-MM-DD HH:mm');
    
    return `${alertTitle} - ${timestamp}`;
  }

  async saveDocument(document) {
    try {
      const documentsDir = path.join(__dirname, '../../data/documents');
      await fs.ensureDir(documentsDir);
      
      const documentPath = path.join(documentsDir, `${document.id}.json`);
      await fs.writeJson(documentPath, document, { spaces: 2 });
      
      console.log(`📄 Document saved: ${documentPath}`);
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  async updateTemplateUsage(templateId) {
    try {
      const templatePath = path.join(__dirname, '../../data/templates', `${templateId}.json`);
      
      if (await fs.pathExists(templatePath)) {
        const template = await fs.readJson(templatePath);
        template.usageCount = (template.usageCount || 0) + 1;
        template.lastUsed = moment().toISOString();
        
        await fs.writeJson(templatePath, template, { spaces: 2 });
        console.log(`📊 Updated usage count for template ${templateId}: ${template.usageCount}`);
      }
    } catch (error) {
      console.warn('Failed to update template usage:', error.message);
    }
  }

  // Method to preview template rendering without saving
  async previewTemplate(templateContent, alertData) {
    try {
      const context = this.prepareTemplateContext(alertData);
      const compiledTemplate = Handlebars.compile(templateContent);
      const renderedContent = compiledTemplate(context);
      
      return {
        success: true,
        content: renderedContent,
        context: context
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }
}

module.exports = DocumentGenerator;
