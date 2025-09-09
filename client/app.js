// Datadog Alert Documentation Generator - Frontend Application
class DatadogAlertDocsApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.templates = [];
        this.documents = [];
        this.pendingAlerts = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateWebhookUrl();
        await this.loadDashboardData();
        this.startPeriodicRefresh();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Forms
        this.setupFormHandlers();

        // Search and filters
        this.setupSearchAndFilters();

        // Modal handlers
        this.setupModalHandlers();
    }

    setupFormHandlers() {
        // Create template form
        const createTemplateForm = document.getElementById('create-template-form');
        if (createTemplateForm) {
            createTemplateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateTemplate(e);
            });
        }

        // Upload template form
        const uploadTemplateForm = document.getElementById('upload-template-form');
        if (uploadTemplateForm) {
            uploadTemplateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleUploadTemplate(e);
            });
        }
    }

    setupSearchAndFilters() {
        // Template search
        const templateSearch = document.getElementById('template-search');
        if (templateSearch) {
            templateSearch.addEventListener('input', (e) => {
                this.filterTemplates(e.target.value);
            });
        }

        // Document search
        const documentSearch = document.getElementById('document-search');
        if (documentSearch) {
            documentSearch.addEventListener('input', (e) => {
                this.filterDocuments(e.target.value);
            });
        }

        // Document filter
        const documentFilter = document.getElementById('document-filter');
        if (documentFilter) {
            documentFilter.addEventListener('change', (e) => {
                this.filterDocumentsByPriority(e.target.value);
            });
        }
    }

    setupModalHandlers() {
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        // File upload drag and drop
        const fileUpload = document.getElementById('template-file');
        if (fileUpload) {
            const fileUploadArea = fileUpload.parentElement;
            
            fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileUploadArea.style.borderColor = '#667eea';
            });

            fileUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fileUploadArea.style.borderColor = '#e9ecef';
            });

            fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileUploadArea.style.borderColor = '#e9ecef';
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileUpload.files = files;
                    this.updateFileUploadText(files[0].name);
                }
            });

            fileUpload.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.updateFileUploadText(e.target.files[0].name);
                }
            });
        }
    }

    updateFileUploadText(filename) {
        const fileUploadText = document.querySelector('.file-upload-text span');
        if (fileUploadText) {
            fileUploadText.textContent = `Selected: ${filename}`;
        }
    }

    async switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        switch (tabName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'templates':
                await this.loadTemplates();
                break;
            case 'documents':
                await this.loadDocuments();
                break;
            case 'alerts':
                await this.loadPendingAlerts();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load counts
            const [templatesRes, documentsRes, alertsRes] = await Promise.all([
                fetch('/api/templates'),
                fetch('/api/documents'),
                fetch('/api/webhook/pending')
            ]);

            const templatesData = await templatesRes.json();
            const documentsData = await documentsRes.json();
            const alertsData = await alertsRes.json();

            // Update counts
            document.getElementById('templates-count').textContent = templatesData.count || 0;
            document.getElementById('documents-count').textContent = documentsData.count || 0;
            document.getElementById('pending-alerts-count').textContent = alertsData.count || 0;

            // Load recent documents
            await this.loadRecentDocuments();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showToast('Error loading dashboard data', 'error');
        }
    }

    async loadRecentDocuments() {
        try {
            const response = await fetch('/api/documents');
            const data = await response.json();

            if (data.success) {
                const recentDocuments = data.documents.slice(0, 5);
                this.renderRecentDocuments(recentDocuments);
            }
        } catch (error) {
            console.error('Error loading recent documents:', error);
        }
    }

    renderRecentDocuments(documents) {
        const container = document.getElementById('recent-documents');
        
        if (documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No documents yet</h3>
                    <p>Documents will appear here once alerts are processed</p>
                </div>
            `;
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="document-item">
                <div>
                    <div class="document-item-title">${this.escapeHtml(doc.title)}</div>
                    <div class="document-item-meta">
                        ${doc.alertType} • ${this.formatDate(doc.createdAt)}
                    </div>
                </div>
                <span class="priority-badge priority-${doc.priority}">${doc.priority}</span>
            </div>
        `).join('');
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            const data = await response.json();

            if (data.success) {
                this.templates = data.templates;
                this.renderTemplates(this.templates);
            } else {
                throw new Error(data.message || 'Failed to load templates');
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.showToast('Error loading templates', 'error');
        }
    }

    renderTemplates(templates) {
        const container = document.getElementById('templates-list');
        
        if (templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-code"></i>
                    <h3>No templates yet</h3>
                    <p>Create or upload your first template to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map(template => `
            <div class="template-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${this.escapeHtml(template.name)}</div>
                        <div class="card-meta">
                            ${template.category} • Created ${this.formatDate(template.createdAt)}
                            ${template.usageCount ? ` • Used ${template.usageCount} times` : ''}
                        </div>
                    </div>
                </div>
                ${template.description ? `<div class="card-description">${this.escapeHtml(template.description)}</div>` : ''}
                <div class="card-actions">
                    <button class="btn btn-secondary" onclick="app.viewTemplate('${template.id}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-primary" onclick="app.editTemplate('${template.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteTemplate('${template.id}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const data = await response.json();

            if (data.success) {
                this.documents = data.documents;
                this.renderDocuments(this.documents);
            } else {
                throw new Error(data.message || 'Failed to load documents');
            }
        } catch (error) {
            console.error('Error loading documents:', error);
            this.showToast('Error loading documents', 'error');
        }
    }

    renderDocuments(documents) {
        const container = document.getElementById('documents-list');
        
        if (documents.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>No documents yet</h3>
                    <p>Documents will be generated when alerts are processed</p>
                </div>
            `;
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="document-card">
                <div class="card-header">
                    <div>
                        <div class="card-title">${this.escapeHtml(doc.title)}</div>
                        <div class="card-meta">
                            ${doc.alertType} • ${this.formatDate(doc.createdAt)} • Template: ${this.escapeHtml(doc.templateName)}
                        </div>
                    </div>
                    <span class="priority-badge priority-${doc.priority}">${doc.priority}</span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary" onclick="app.viewDocument('${doc.id}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-primary" onclick="app.downloadDocument('${doc.id}', 'txt')">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <button class="btn btn-success" onclick="app.viewDocumentHtml('${doc.id}')">
                        <i class="fas fa-globe"></i>
                        HTML
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteDocument('${doc.id}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadPendingAlerts() {
        try {
            const response = await fetch('/api/webhook/pending');
            const data = await response.json();

            if (data.success) {
                this.pendingAlerts = data.alerts;
                this.renderPendingAlerts(this.pendingAlerts);
            } else {
                throw new Error(data.message || 'Failed to load pending alerts');
            }
        } catch (error) {
            console.error('Error loading pending alerts:', error);
            this.showToast('Error loading pending alerts', 'error');
        }
    }

    renderPendingAlerts(alerts) {
        const container = document.getElementById('pending-alerts-list');
        
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell"></i>
                    <h3>No pending alerts</h3>
                    <p>Alerts will appear here when received via webhook</p>
                </div>
            `;
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert-card">
                <div class="alert-header">
                    <div>
                        <div class="alert-title">${this.escapeHtml(alert.title)}</div>
                        <div class="alert-meta">
                            ${alert.alertType} • ${this.formatDate(alert.timestamp)} • Priority: ${alert.priority}
                        </div>
                    </div>
                    <div class="alert-actions">
                        <button class="btn btn-primary" onclick="app.processAlert('${alert.id}')">
                            <i class="fas fa-cog"></i>
                            Process
                        </button>
                        <button class="btn btn-secondary" onclick="app.viewAlertDetails('${alert.id}')">
                            <i class="fas fa-eye"></i>
                            Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Template Management
    async handleCreateTemplate(event) {
        try {
            const formData = new FormData(event.target);
            const templateData = {
                name: formData.get('name'),
                description: formData.get('description'),
                category: formData.get('category'),
                content: formData.get('content')
            };

            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateData)
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Template created successfully', 'success');
                this.closeModal('create-template-modal');
                event.target.reset();
                
                if (this.currentTab === 'templates') {
                    await this.loadTemplates();
                }
                await this.loadDashboardData();
            } else {
                throw new Error(data.message || 'Failed to create template');
            }
        } catch (error) {
            console.error('Error creating template:', error);
            this.showToast(error.message || 'Error creating template', 'error');
        }
    }

    async handleUploadTemplate(event) {
        try {
            const formData = new FormData(event.target);

            const response = await fetch('/api/templates/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Template uploaded successfully', 'success');
                this.closeModal('upload-template-modal');
                event.target.reset();
                
                // Reset file upload text
                const fileUploadText = document.querySelector('.file-upload-text span');
                if (fileUploadText) {
                    fileUploadText.textContent = 'Choose file or drag and drop';
                }
                
                if (this.currentTab === 'templates') {
                    await this.loadTemplates();
                }
                await this.loadDashboardData();
            } else {
                throw new Error(data.message || 'Failed to upload template');
            }
        } catch (error) {
            console.error('Error uploading template:', error);
            this.showToast(error.message || 'Error uploading template', 'error');
        }
    }

    async viewTemplate(templateId) {
        try {
            const response = await fetch(`/api/templates/${templateId}`);
            const data = await response.json();

            if (data.success) {
                const template = data.template;
                
                // Create modal content
                const modalContent = `
                    <div class="modal-header">
                        <h2>Template: ${this.escapeHtml(template.name)}</h2>
                        <button class="close-btn" onclick="app.closeModal('view-template-modal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="template-details">
                            <div class="detail-row">
                                <strong>Category:</strong> ${this.escapeHtml(template.category)}
                            </div>
                            <div class="detail-row">
                                <strong>Created:</strong> ${this.formatDate(template.createdAt)}
                            </div>
                            ${template.description ? `
                                <div class="detail-row">
                                    <strong>Description:</strong> ${this.escapeHtml(template.description)}
                                </div>
                            ` : ''}
                            <div class="detail-row">
                                <strong>Usage Count:</strong> ${template.usageCount || 0}
                            </div>
                        </div>
                        <div class="template-content">
                            <h3>Template Content:</h3>
                            <pre><code>${this.escapeHtml(template.content)}</code></pre>
                        </div>
                    </div>
                `;

                this.showModal('view-template-modal', modalContent);
            } else {
                throw new Error(data.message || 'Failed to load template');
            }
        } catch (error) {
            console.error('Error viewing template:', error);
            this.showToast('Error loading template', 'error');
        }
    }

    async editTemplate(templateId) {
        try {
            const response = await fetch(`/api/templates/${templateId}`);
            const data = await response.json();

            if (data.success) {
                const template = data.template;
                
                // Create edit modal content
                const modalContent = `
                    <div class="modal-header">
                        <h2>Edit Template</h2>
                        <button class="close-btn" onclick="app.closeModal('edit-template-modal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-template-form">
                            <input type="hidden" name="id" value="${template.id}">
                            <div class="form-group">
                                <label for="edit-name">Template Name</label>
                                <input type="text" id="edit-name" name="name" value="${this.escapeHtml(template.name)}" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-description">Description</label>
                                <textarea id="edit-description" name="description" rows="3">${this.escapeHtml(template.description || '')}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="edit-category">Category</label>
                                <select id="edit-category" name="category" required>
                                    <option value="incident" ${template.category === 'incident' ? 'selected' : ''}>Incident</option>
                                    <option value="performance" ${template.category === 'performance' ? 'selected' : ''}>Performance</option>
                                    <option value="security" ${template.category === 'security' ? 'selected' : ''}>Security</option>
                                    <option value="infrastructure" ${template.category === 'infrastructure' ? 'selected' : ''}>Infrastructure</option>
                                    <option value="custom" ${template.category === 'custom' ? 'selected' : ''}>Custom</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="edit-content">Template Content</label>
                                <textarea id="edit-content" name="content" rows="15" required>${this.escapeHtml(template.content)}</textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="app.closeModal('edit-template-modal')">Cancel</button>
                                <button type="submit" class="btn btn-primary">Update Template</button>
                            </div>
                        </form>
                    </div>
                `;

                this.showModal('edit-template-modal', modalContent);

                // Add form handler
                document.getElementById('edit-template-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.handleEditTemplate(e);
                });
            } else {
                throw new Error(data.message || 'Failed to load template');
            }
        } catch (error) {
            console.error('Error loading template for edit:', error);
            this.showToast('Error loading template', 'error');
        }
    }

    async handleEditTemplate(event) {
        try {
            const formData = new FormData(event.target);
            const templateData = {
                name: formData.get('name'),
                description: formData.get('description'),
                category: formData.get('category'),
                content: formData.get('content')
            };

            const templateId = formData.get('id');
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateData)
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Template updated successfully', 'success');
                this.closeModal('edit-template-modal');
                
                if (this.currentTab === 'templates') {
                    await this.loadTemplates();
                }
            } else {
                throw new Error(data.message || 'Failed to update template');
            }
        } catch (error) {
            console.error('Error updating template:', error);
            this.showToast(error.message || 'Error updating template', 'error');
        }
    }

    async deleteTemplate(templateId) {
        if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Template deleted successfully', 'success');
                
                if (this.currentTab === 'templates') {
                    await this.loadTemplates();
                }
                await this.loadDashboardData();
            } else {
                throw new Error(data.message || 'Failed to delete template');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            this.showToast(error.message || 'Error deleting template', 'error');
        }
    }

    // Document Management
    async viewDocument(documentId) {
        try {
            const response = await fetch(`/api/documents/${documentId}`);
            const data = await response.json();

            if (data.success) {
                const doc = data.document;
                
                const modalContent = `
                    <div class="modal-header">
                        <h2>Document: ${this.escapeHtml(doc.title)}</h2>
                        <button class="close-btn" onclick="app.closeModal('view-document-modal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="document-details">
                            <div class="detail-row">
                                <strong>Alert Type:</strong> ${this.escapeHtml(doc.alertType)}
                            </div>
                            <div class="detail-row">
                                <strong>Priority:</strong> <span class="priority-badge priority-${doc.priority}">${doc.priority}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Template:</strong> ${this.escapeHtml(doc.templateName)}
                            </div>
                            <div class="detail-row">
                                <strong>Created:</strong> ${this.formatDate(doc.createdAt)}
                            </div>
                        </div>
                        <div class="document-content">
                            <h3>Document Content:</h3>
                            <div class="document-text">${doc.content.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;

                this.showModal('view-document-modal', modalContent);
            } else {
                throw new Error(data.message || 'Failed to load document');
            }
        } catch (error) {
            console.error('Error viewing document:', error);
            this.showToast('Error loading document', 'error');
        }
    }

    async downloadDocument(documentId, format = 'txt') {
        try {
            const response = await fetch(`/api/documents/${documentId}/export?format=${format}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `document-${documentId}.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showToast('Document downloaded successfully', 'success');
            } else {
                throw new Error('Failed to download document');
            }
        } catch (error) {
            console.error('Error downloading document:', error);
            this.showToast('Error downloading document', 'error');
        }
    }

    async viewDocumentHtml(documentId) {
        try {
            const response = await fetch(`/api/documents/${documentId}/export?format=html`);
            
            if (response.ok) {
                const htmlContent = await response.text();
                const newWindow = window.open('', '_blank');
                newWindow.document.write(htmlContent);
                newWindow.document.close();
            } else {
                throw new Error('Failed to load HTML document');
            }
        } catch (error) {
            console.error('Error viewing HTML document:', error);
            this.showToast('Error loading HTML document', 'error');
        }
    }

    async deleteDocument(documentId) {
        if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/documents/${documentId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Document deleted successfully', 'success');
                
                if (this.currentTab === 'documents') {
                    await this.loadDocuments();
                }
                await this.loadDashboardData();
            } else {
                throw new Error(data.message || 'Failed to delete document');
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            this.showToast(error.message || 'Error deleting document', 'error');
        }
    }

    // Alert Management
    async processAlert(alertId) {
        try {
            // Load templates for selection
            const templatesResponse = await fetch('/api/templates');
            const templatesData = await templatesResponse.json();

            if (!templatesData.success || templatesData.templates.length === 0) {
                this.showToast('No templates available. Please create a template first.', 'error');
                return;
            }

            // Show template selection modal
            const modalContent = `
                <div class="modal-header">
                    <h2>Select Template for Alert Processing</h2>
                    <button class="close-btn" onclick="app.closeModal('process-alert-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="process-alert-form">
                        <input type="hidden" name="alertId" value="${alertId}">
                        <div class="form-group">
                            <label for="template-select">Choose Template:</label>
                            <select id="template-select" name="templateId" required>
                                <option value="">Select a template...</option>
                                ${templatesData.templates.map(template => 
                                    `<option value="${template.id}">${this.escapeHtml(template.name)} (${template.category})</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="app.closeModal('process-alert-modal')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Process Alert</button>
                        </div>
                    </form>
                </div>
            `;

            this.showModal('process-alert-modal', modalContent);

            // Add form handler
            document.getElementById('process-alert-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleProcessAlert(e);
            });

        } catch (error) {
            console.error('Error preparing alert processing:', error);
            this.showToast('Error loading templates', 'error');
        }
    }

    async handleProcessAlert(event) {
        try {
            const formData = new FormData(event.target);
            const alertId = formData.get('alertId');
            const templateId = formData.get('templateId');

            const response = await fetch('/api/webhook/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alertId, templateId })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Alert processed successfully', 'success');
                this.closeModal('process-alert-modal');
                
                // Refresh alerts and documents
                if (this.currentTab === 'alerts') {
                    await this.loadPendingAlerts();
                }
                await this.loadDashboardData();
            } else {
                throw new Error(data.message || 'Failed to process alert');
            }
        } catch (error) {
            console.error('Error processing alert:', error);
            this.showToast(error.message || 'Error processing alert', 'error');
        }
    }

    async viewAlertDetails(alertId) {
        try {
            const alert = this.pendingAlerts.find(a => a.id === alertId);
            if (!alert) {
                throw new Error('Alert not found');
            }

            const modalContent = `
                <div class="modal-header">
                    <h2>Alert Details</h2>
                    <button class="close-btn" onclick="app.closeModal('alert-details-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="alert-details">
                        <div class="detail-row">
                            <strong>Title:</strong> ${this.escapeHtml(alert.title)}
                        </div>
                        <div class="detail-row">
                            <strong>Type:</strong> ${this.escapeHtml(alert.alertType)}
                        </div>
                        <div class="detail-row">
                            <strong>Priority:</strong> <span class="priority-badge priority-${alert.priority}">${alert.priority}</span>
                        </div>
                        <div class="detail-row">
                            <strong>Timestamp:</strong> ${this.formatDate(alert.timestamp)}
                        </div>
                        ${alert.message ? `
                            <div class="detail-row">
                                <strong>Message:</strong> ${this.escapeHtml(alert.message)}
                            </div>
                        ` : ''}
                        ${alert.tags && alert.tags.length > 0 ? `
                            <div class="detail-row">
                                <strong>Tags:</strong> ${alert.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="alert-raw-data">
                        <h3>Raw Alert Data:</h3>
                        <pre><code>${JSON.stringify(alert, null, 2)}</code></pre>
                    </div>
                </div>
            `;

            this.showModal('alert-details-modal', modalContent);
        } catch (error) {
            console.error('Error viewing alert details:', error);
            this.showToast('Error loading alert details', 'error');
        }
    }

    // Search and Filter Functions
    filterTemplates(searchTerm) {
        const filteredTemplates = this.templates.filter(template => 
            template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        this.renderTemplates(filteredTemplates);
    }

    filterDocuments(searchTerm) {
        const filteredDocuments = this.documents.filter(doc => 
            doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.alertType.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderDocuments(filteredDocuments);
    }

    filterDocumentsByPriority(priority) {
        if (!priority) {
            this.renderDocuments(this.documents);
            return;
        }

        const filteredDocuments = this.documents.filter(doc => doc.priority === priority);
        this.renderDocuments(filteredDocuments);
    }

    // Modal Management
    showModal(modalId, content) {
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            // Create modal if it doesn't exist
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                ${content}
            </div>
        `;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Close modal on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modalId);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    // Utility Functions
    updateWebhookUrl() {
        const webhookUrl = `${window.location.origin}/api/webhook/datadog`;
        const webhookUrlElement = document.getElementById('webhook-url');
        if (webhookUrlElement) {
            webhookUrlElement.textContent = webhookUrl;
        }

        // Add copy functionality
        const copyBtn = document.getElementById('copy-webhook-url');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(webhookUrl).then(() => {
                    this.showToast('Webhook URL copied to clipboard', 'success');
                }).catch(() => {
                    this.showToast('Failed to copy URL', 'error');
                });
            });
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    startPeriodicRefresh() {
        // Refresh data every 30 seconds
        setInterval(async () => {
            if (this.currentTab === 'dashboard') {
                await this.loadDashboardData();
            } else if (this.currentTab === 'alerts') {
                await this.loadPendingAlerts();
            }
        }, 30000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DatadogAlertDocsApp();
});

// Global functions for HTML onclick handlers
function showCreateTemplateModal() {
    const modal = document.getElementById('create-template-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function showUploadTemplateModal() {
    const modal = document.getElementById('upload-template-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhook-url').textContent;
    navigator.clipboard.writeText(webhookUrl).then(() => {
        if (window.app) {
            window.app.showToast('Webhook URL copied to clipboard', 'success');
        }
    }).catch(() => {
        if (window.app) {
            window.app.showToast('Failed to copy URL', 'error');
        }
    });
}

function refreshPendingAlerts() {
    if (window.app) {
        window.app.loadPendingAlerts();
    }
}
