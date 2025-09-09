# Datadog Alert Documentation App - Netlify Deployment

This application has been adapted for deployment on Netlify using serverless functions.

## 🚀 Quick Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-username/datadog-alert-docs)

## 📁 Project Structure for Netlify

```
datadog-alert-docs/
├── client/                 # Static frontend files (published to Netlify)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── netlify/
│   └── functions/          # Serverless functions
│       ├── webhook.js      # Handles Datadog webhooks
│       ├── templates.js    # Template management
│       ├── documents.js    # Document management
│       ├── generate-document.js # Document generation
│       └── package.json    # Function dependencies
├── netlify.toml           # Netlify configuration
└── README-NETLIFY.md      # This file
```

## 🛠 Manual Deployment Steps

### 1. Prepare Your Repository

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Ensure all files are committed, especially the `netlify/` directory

### 2. Deploy to Netlify

#### Option A: Netlify Dashboard
1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "New site from Git"
3. Connect your Git provider and select your repository
4. Configure build settings:
   - **Build command**: Leave empty (static site)
   - **Publish directory**: `client`
   - **Functions directory**: `netlify/functions`

#### Option B: Netlify CLI
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy from project root
netlify deploy --prod
```

### 3. Configure Environment Variables (Optional)

In Netlify Dashboard → Site Settings → Environment Variables:
- `NODE_ENV`: `production`

## 🔧 API Endpoints

After deployment, your API endpoints will be:

- **Webhook**: `https://your-site.netlify.app/.netlify/functions/webhook/datadog`
- **Templates**: `https://your-site.netlify.app/.netlify/functions/templates`
- **Documents**: `https://your-site.netlify.app/.netlify/functions/documents`
- **Generate Document**: `https://your-site.netlify.app/.netlify/functions/generate-document`

## 📝 Datadog Webhook Configuration

Configure your Datadog webhook to point to:
```
https://your-site.netlify.app/.netlify/functions/webhook/datadog
```

## ⚠️ Important Limitations

### Data Persistence
- **Development**: Data stored in local `data/` directory
- **Production**: Data stored in `/tmp/` (temporary, resets on function cold starts)
- **Recommendation**: For production use, integrate with a database service like:
  - [Fauna DB](https://fauna.com/) (serverless)
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
  - [Supabase](https://supabase.com/)
  - [PlanetScale](https://planetscale.com/)

### Function Limitations
- **Cold starts**: Functions may take longer to respond after inactivity
- **Memory**: Limited to 1GB RAM per function
- **Execution time**: 10-second timeout for functions
- **Concurrent executions**: Limited based on your Netlify plan

## 🔄 Local Development with Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install function dependencies
cd netlify/functions
npm install
cd ../..

# Start local development server
netlify dev
```

This will start:
- Frontend at `http://localhost:8888`
- Functions at `http://localhost:8888/.netlify/functions/`

## 🚀 Production Considerations

### 1. Database Integration
For production use, replace file-based storage with a proper database:

```javascript
// Example: Replace file operations with database calls
// Instead of:
const data = await fs.readFile(templatesFile, 'utf8');

// Use:
const data = await db.collection('templates').find().toArray();
```

### 2. Authentication
Add authentication for template management:
- [Netlify Identity](https://docs.netlify.com/visitor-access/identity/)
- [Auth0](https://auth0.com/)
- [Firebase Auth](https://firebase.google.com/products/auth)

### 3. Rate Limiting
Implement rate limiting for webhook endpoints to prevent abuse.

### 4. Monitoring
Set up monitoring and alerting:
- [Netlify Analytics](https://www.netlify.com/products/analytics/)
- [Sentry](https://sentry.io/) for error tracking
- [LogRocket](https://logrocket.com/) for session replay

## 🔧 Troubleshooting

### Function Errors
Check function logs in Netlify Dashboard → Functions tab

### CORS Issues
Functions include CORS headers, but if you encounter issues:
1. Check the `Access-Control-Allow-Origin` headers in function responses
2. Ensure your frontend domain is allowed

### Cold Start Performance
- Functions may be slow on first request after inactivity
- Consider using [Netlify Background Functions](https://docs.netlify.com/functions/background-functions/) for long-running tasks

## 📚 Additional Resources

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Netlify CLI Documentation](https://cli.netlify.com/)
- [Serverless Functions Best Practices](https://docs.netlify.com/functions/best-practices/)
