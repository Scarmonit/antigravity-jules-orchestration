/**
 * Template generator for repository configuration files
 * Generates content for various configuration files based on templates
 */

const templates = {
  'mit-license': (context) => `MIT License

Copyright (c) ${new Date().getFullYear()} ${context.author || context.owner}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,

  'security-policy': (context) => `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| ${context.version || '1.x.x'}   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email the security team at: ${context.securityEmail || `security@${context.owner || 'example'}.com`}
3. Include a detailed description of the vulnerability
4. Provide steps to reproduce if possible

### What to Expect

- **Response Time**: We aim to respond within 48 hours
- **Resolution**: Critical vulnerabilities are prioritized and typically resolved within 7 days
- **Disclosure**: We follow responsible disclosure practices

### Scope

This security policy applies to:
- The main repository code
- Official releases and packages
- Documentation that could lead to security issues

## Security Best Practices

When contributing to this project:
- Never commit secrets, tokens, or credentials
- Use environment variables for sensitive configuration
- Follow secure coding guidelines
- Keep dependencies up to date

Thank you for helping keep this project secure!
`,

  'changelog': () => `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository audit workflow

### Changed
- None

### Deprecated
- None

### Removed
- None

### Fixed
- None

### Security
- None
`,

  'contributing': (context) => `# Contributing to ${context.name || context.repo}

Thank you for your interest in contributing! This document provides guidelines and steps for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include reproduction steps
4. Specify your environment

### Suggesting Features

1. Check existing feature requests
2. Use the feature request template
3. Explain the use case

### Pull Requests

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/your-feature\`
3. Make your changes
4. Write/update tests as needed
5. Ensure all tests pass: \`npm test\`
6. Commit with conventional commits: \`git commit -m "feat: add feature"\`
7. Push and create a Pull Request

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- \`feat:\` New features
- \`fix:\` Bug fixes
- \`docs:\` Documentation changes
- \`style:\` Code style changes
- \`refactor:\` Code refactoring
- \`test:\` Test changes
- \`chore:\` Build/tooling changes

### Development Setup

\`\`\`bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/${context.repo || 'repo'}.git

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
\`\`\`

## Questions?

Open an issue with the question label or reach out to the maintainers.

Thank you for contributing! 🎉
`,

  'code-of-conduct': () => `# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity and orientation.

## Our Standards

Examples of behavior that contributes to a positive environment:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior:

* The use of sexualized language or imagery
* Trolling, insulting or derogatory comments, and personal attacks
* Public or private harassment
* Publishing others' private information without permission
* Other conduct which could reasonably be considered inappropriate

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the project maintainers. All complaints will be reviewed and
investigated promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org),
version 2.0.
`,

  'editorconfig': () => `# EditorConfig helps maintain consistent coding styles
# https://editorconfig.org

root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
`,

  'nvmrc': () => `20
`,

  'npmrc': () => `engine-strict=true
save-exact=true
`,

  'dockerignore': () => `# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist
build
coverage
.nyc_output

# IDE
.vscode
.idea
*.swp
*.swo

# Git
.git
.gitignore

# Testing
*.test.js
*.spec.js
tests
__tests__

# Documentation
*.md
docs
!README.md

# Environment
.env
.env.*
!.env.example

# Misc
.DS_Store
Thumbs.db
*.log
`,

  'issue-bug': () => `---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Description
A clear and concise description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- OS: [e.g., Ubuntu 22.04]
- Node.js: [e.g., 20.0.0]
- Version: [e.g., 1.0.0]

## Screenshots
If applicable, add screenshots.

## Additional Context
Any other relevant information.
`,

  'issue-feature': () => `---
name: Feature Request
about: Suggest a feature for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## Problem Statement
A clear description of the problem this feature would solve.

## Proposed Solution
Your idea for solving the problem.

## Alternatives Considered
Other solutions you've thought about.

## Additional Context
Any other relevant information or screenshots.
`,

  'pr-template': () => `## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review
- [ ] I have added/updated tests as needed
- [ ] I have updated documentation as needed
- [ ] My changes generate no new warnings

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
`,

  'codeowners': (context) => `# CODEOWNERS - Auto-assign reviewers
# https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

# Default owners for everything
* @${context.owner || 'owner'}

# Specific paths
/.github/ @${context.owner || 'owner'}
/scripts/ @${context.owner || 'owner'}
/docs/ @${context.owner || 'owner'}
`,

  'funding': (context) => `# Funding links
github: [${context.owner || 'owner'}]
# ko_fi: username
# patreon: username
# open_collective: project
`,

  'dependabot': () => `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "automated"
    commit-message:
      prefix: "chore(deps)"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    labels:
      - "dependencies"
      - "github-actions"
    commit-message:
      prefix: "chore(actions)"
`,

  'vscode-settings': () => `{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "files.eol": "\\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "javascript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative",
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.wordWrap": "on"
  }
}
`,

  'vscode-extensions': () => `{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig",
    "streetsidesoftware.code-spell-checker",
    "github.copilot",
    "eamodio.gitlens"
  ]
}
`,

  'workflow-labeler': () => `name: PR Labeler

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: "\${{ secrets.GITHUB_TOKEN }}"
`,

  'workflow-stale': () => `name: Stale Issues

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  stale:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v9
        with:
          days-before-issue-stale: 60
          days-before-issue-close: 14
          days-before-pr-stale: 30
          days-before-pr-close: 14
          stale-issue-label: stale
          stale-pr-label: stale
          stale-issue-message: >
            This issue has been automatically marked as stale due to inactivity.
            It will be closed in 14 days if no further activity occurs.
          stale-pr-message: >
            This PR has been automatically marked as stale due to inactivity.
            It will be closed in 14 days if no further activity occurs.
          exempt-issue-labels: pinned,security
          exempt-pr-labels: pinned,security
`,

  'workflow-release-drafter': () => `name: Release Drafter

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  update_release_draft:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: release-drafter/release-drafter@v6
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,

  'release-drafter-config': () => `name-template: 'v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'
categories:
  - title: '🚀 Features'
    labels:
      - 'feature'
      - 'enhancement'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
      - 'bug'
  - title: '📚 Documentation'
    labels:
      - 'documentation'
      - 'docs'
  - title: '🧰 Maintenance'
    labels:
      - 'chore'
      - 'dependencies'
change-template: '- $TITLE @$AUTHOR (#$NUMBER)'
change-title-escapes: '\\<*_&'
version-resolver:
  major:
    labels:
      - 'major'
      - 'breaking'
  minor:
    labels:
      - 'minor'
      - 'feature'
  patch:
    labels:
      - 'patch'
      - 'fix'
      - 'bug'
  default: patch
template: |
  ## Changes

  $CHANGES

  ## Contributors

  $CONTRIBUTORS
`,

  'workflow-codeql': () => `name: CodeQL Security Analysis

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: ['javascript']

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: \${{ matrix.language }}

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:\${{ matrix.language }}"
`
};

/**
 * Generate content for a template
 * @param {string} templateName - Name of the template
 * @param {object} context - Context variables for the template
 * @returns {string|null} Generated content or null if template not found
 */
export function generateTemplate(templateName, context = {}) {
  const template = templates[templateName];
  if (!template) {
    return null;
  }
  return template(context);
}

/**
 * Get list of available templates
 * @returns {string[]} Array of template names
 */
export function getAvailableTemplates() {
  return Object.keys(templates);
}

export default { generateTemplate, getAvailableTemplates };
