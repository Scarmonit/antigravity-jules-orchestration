// scripts/create-repo.js
import { Octokit } from '@octokit/rest';
// eslint-disable-next-line no-unused-vars
import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_NAME = 'jules-orchestrator';
const ORG_OR_USER = 'scarmonit'; // Change if using org

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function createRepo() {
  try {
    // Create repository
    console.log('Creating repository...');
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: REPO_NAME,
      description: 'Autonomous AI orchestration system for Jules API',
      private: false,
      auto_init: true,
      gitignore_template: 'Node'
    });

    console.log(`✅ Repository created: ${repo.html_url}`);

    // Add repository secrets
    console.log('\nAdding secrets...');
    const secrets = ['JULES_API_KEY', 'GITHUB_TOKEN', 'SLACK_WEBHOOK_URL'];
    console.log('❗ Add these secrets manually via:');
    console.log(`   ${repo.html_url}/settings/secrets/actions`);
    secrets.forEach((s) => console.log(`   - ${s}`));

    // Create initial files
    console.log('\nCreating initial files...');

    const files = {
      'package.json': JSON.stringify({
        name: 'jules-orchestrator',
        version: '1.0.0',
        type: 'module',
        main: 'src/index.js',
        scripts: {
          start: 'node src/index.js',
          dev: 'node --watch src/index.js'
        },
        dependencies: {
          express: '^4.18.2',
          pg: '^8.11.3',
          redis: '^4.6.10',
          axios: '^1.6.2',
          dotenv: '^16.3.1'
        }
      }, null, 2),

      'README.md': `# Jules Orchestrator

Autonomous AI coding agent orchestration system powered by Google Jules API.

## Features
- Automated dependency updates
- Issue-triggered bug fixes  
- Feature implementation workflows
- Security vulnerability patching
- Documentation synchronization

## Architecture
- API Gateway (Express)
- Workflow Engine
- PostgreSQL state management
- Redis event bus
- Jules API integration

## Setup
1. Set environment variables in Render
2. Deploy using render.yaml
3. Configure GitHub webhooks
4. Add workflow templates to DB

## Endpoints
- POST /api/v1/workflows/execute
- GET /api/v1/workflows/:id
- POST /api/v1/webhooks/github
- GET /api/v1/health

## Deployment
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
`,

      '.env.example': `# Jules API
JULES_API_KEY=your_jules_api_key_here

# GitHub
GITHUB_TOKEN=your_github_token_here

# Database
DATABASE_URL=postgresql://user:pass @host:5432/db

# Redis
REDIS_URL=redis://host:6379

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX

# Server
PORT=3000
NODE_ENV=production
`
    };

    for (const [path, content] of Object.entries(files)) {
      await octokit.repos.createOrUpdateFileContents({
        owner: ORG_OR_USER,
        repo: REPO_NAME,
        path,
        message: `Add ${path}`,
        content: Buffer.from(content).toString('base64')
      });
      console.log(`  ✅ Created ${path}`);
    }

    // Configure webhook
    console.log('\nConfiguring GitHub webhook...');
    await octokit.repos.createWebhook({
      owner: ORG_OR_USER,
      repo: REPO_NAME,
      config: {
        url: 'https://agent.scarmonit.com/api/v1/webhooks/github',
        content_type: 'json',
        secret: process.env.WEBHOOK_SECRET || 'change-me'
      },
      events: ['issues', 'issue_comment', 'push', 'pull_request']
    });
    console.log('  ✅ Webhook configured');

    console.log('\n🎉 Setup complete! Next steps:');
    console.log('1. Clone repo: git clone ' + repo.clone_url);
    console.log('2. Add implementation files from /tmp/jules_orchestrator_*');
    console.log('3. Push to GitHub');
    console.log('4. Deploy to Render');

  } catch (error) {
    if (error.status === 422) {
      console.log('⚠️  Repository already exists');
      console.log(`   https://github.com/${ORG_OR_USER}/${REPO_NAME}`);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

createRepo();
