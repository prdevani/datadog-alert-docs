#!/bin/bash

# Datadog Alert Documentation App - Netlify Deployment Script

echo "🚀 Preparing Datadog Alert Documentation App for Netlify deployment..."

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Install function dependencies
echo "📦 Installing function dependencies..."
cd netlify/functions
npm install
cd ../..

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "📝 Creating .gitignore file..."
    cat > .gitignore << EOF
# Dependencies
node_modules/
netlify/functions/node_modules/

# Environment variables
.env
.env.local
.env.production

# Data files (local development)
data/

# Logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# Netlify
.netlify/
EOF
fi

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)"
echo "2. Go to https://app.netlify.com/ and create a new site from Git"
echo "3. Configure build settings:"
echo "   - Build command: (leave empty)"
echo "   - Publish directory: client"
echo "   - Functions directory: netlify/functions"
echo ""
echo "🔗 Your webhook URL will be:"
echo "   https://your-site-name.netlify.app/.netlify/functions/webhook/datadog"
echo ""
echo "📖 For detailed instructions, see README-NETLIFY.md"

# Optional: Deploy directly if user wants
read -p "🤔 Do you want to deploy now using Netlify CLI? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Netlify..."
    netlify deploy --prod
    echo "✅ Deployment complete!"
else
    echo "👍 You can deploy later using: netlify deploy --prod"
fi
