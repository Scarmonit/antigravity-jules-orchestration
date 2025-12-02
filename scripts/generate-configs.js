#!/usr/bin/env node

/**
 * generate-configs.js
 * Auto-generate missing configuration files based on analysis
 * 
 * Uses templates to create configuration files that are missing
 * from the repository based on pattern analysis.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyzePatterns } from './analyze-patterns.js';
import { generateTemplate } from './lib/templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get repository context from package.json and git
 * @param {string} repoPath - Path to repository
 * @returns {object} Context object
 */
function getRepoContext(repoPath) {
  const context = {
    owner: 'owner',
    repo: 'repo',
    name: 'project',
    version: '1.0.0',
    author: 'Author'
  };

  // Try to get info from package.json
  const pkgPath = join(repoPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      context.name = pkg.name || context.name;
      context.version = pkg.version || context.version;
      context.author = pkg.author || context.author;
      
      // Try to parse repository URL for owner/repo
      if (pkg.repository) {
        const repoUrl = typeof pkg.repository === 'string' 
          ? pkg.repository 
          : pkg.repository.url;
        if (repoUrl) {
          const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
          if (match) {
            context.owner = match[1];
            context.repo = match[2];
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Try to get from git remote
  try {
    const gitConfigPath = join(repoPath, '.git', 'config');
    if (existsSync(gitConfigPath)) {
      const gitConfig = readFileSync(gitConfigPath, 'utf-8');
      const match = gitConfig.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
      if (match) {
        context.owner = match[1];
        context.repo = match[2].replace(/\.git$/, '');
      }
    }
  } catch {
    // Ignore git errors
  }

  return context;
}

/**
 * Generate missing configuration files
 * @param {string} repoPath - Path to repository
 * @param {object} options - Generation options
 * @returns {object} Generation results
 */
export function generateConfigs(repoPath, options = {}) {
  const { dryRun = false, force = false, priorities = ['critical', 'high', 'medium', 'low'] } = options;
  
  const analysis = analyzePatterns(repoPath);
  const context = getRepoContext(repoPath);
  
  const results = {
    timestamp: new Date().toISOString(),
    repoPath,
    context,
    generated: [],
    skipped: [],
    errors: []
  };

  // Filter missing patterns by requested priorities
  const patternsToGenerate = analysis.missing.filter(
    p => priorities.includes(p.priority) && p.template
  );

  for (const pattern of patternsToGenerate) {
    const targetPath = join(repoPath, pattern.path);
    
    // Skip if file exists and not forcing
    if (existsSync(targetPath) && !force) {
      results.skipped.push({
        ...pattern,
        reason: 'File already exists'
      });
      continue;
    }

    // Generate content from template
    const content = generateTemplate(pattern.template, context);
    if (!content) {
      results.errors.push({
        ...pattern,
        error: `Template "${pattern.template}" not found`
      });
      continue;
    }

    if (dryRun) {
      results.generated.push({
        ...pattern,
        action: 'would create',
        targetPath,
        contentLength: content.length
      });
    } else {
      try {
        // Ensure directory exists
        const targetDir = dirname(targetPath);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }

        // Write file
        writeFileSync(targetPath, content, 'utf-8');
        
        results.generated.push({
          ...pattern,
          action: 'created',
          targetPath,
          contentLength: content.length
        });
      } catch (err) {
        results.errors.push({
          ...pattern,
          error: err.message
        });
      }
    }
  }

  return results;
}

/**
 * Update package.json with missing fields
 * @param {string} repoPath - Path to repository
 * @param {object} options - Update options
 * @returns {object} Update results
 */
export function updatePackageJson(repoPath, options = {}) {
  const { dryRun = false } = options;
  const pkgPath = join(repoPath, 'package.json');
  
  const results = {
    timestamp: new Date().toISOString(),
    updated: [],
    skipped: [],
    errors: []
  };

  if (!existsSync(pkgPath)) {
    results.errors.push({ error: 'package.json not found' });
    return results;
  }

  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    const context = getRepoContext(repoPath);
    let modified = false;

    // Add engines if missing
    if (!pkg.engines) {
      pkg.engines = { node: '>=20.0.0', npm: '>=10.0.0' };
      results.updated.push({ field: 'engines', value: pkg.engines });
      modified = true;
    }

    // Add repository if missing
    if (!pkg.repository && context.owner !== 'owner') {
      pkg.repository = {
        type: 'git',
        url: `git+https://github.com/${context.owner}/${context.repo}.git`
      };
      results.updated.push({ field: 'repository', value: pkg.repository });
      modified = true;
    }

    // Add bugs if missing
    if (!pkg.bugs && context.owner !== 'owner') {
      pkg.bugs = {
        url: `https://github.com/${context.owner}/${context.repo}/issues`
      };
      results.updated.push({ field: 'bugs', value: pkg.bugs });
      modified = true;
    }

    // Add homepage if missing
    if (!pkg.homepage && context.owner !== 'owner') {
      pkg.homepage = `https://github.com/${context.owner}/${context.repo}#readme`;
      results.updated.push({ field: 'homepage', value: pkg.homepage });
      modified = true;
    }

    // Add publishConfig if missing (for npm publishing)
    if (!pkg.publishConfig) {
      pkg.publishConfig = { access: 'public' };
      results.updated.push({ field: 'publishConfig', value: pkg.publishConfig });
      modified = true;
    }

    // Add recommended scripts if missing
    const scriptUpdates = [];
    if (!pkg.scripts) pkg.scripts = {};
    
    if (!pkg.scripts.lint && !pkg.scripts['lint:fix']) {
      pkg.scripts.lint = 'echo "No linter configured"';
      scriptUpdates.push('lint');
    }
    
    if (!pkg.scripts.format && !pkg.scripts['format:check']) {
      pkg.scripts.format = 'echo "No formatter configured"';
      scriptUpdates.push('format');
    }
    
    if (!pkg.scripts.clean) {
      pkg.scripts.clean = 'rm -rf dist build coverage .nyc_output node_modules/.cache';
      scriptUpdates.push('clean');
    }
    
    if (!pkg.scripts.validate) {
      pkg.scripts.validate = 'npm run lint && npm test';
      scriptUpdates.push('validate');
    }

    if (scriptUpdates.length > 0) {
      results.updated.push({ field: 'scripts', added: scriptUpdates });
      modified = true;
    }

    // Write updated package.json
    if (modified && !dryRun) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    }

  } catch (err) {
    results.errors.push({ error: err.message });
  }

  return results;
}

/**
 * Generate summary report of generation results
 * @param {object} configResults - Config generation results
 * @param {object} pkgResults - Package.json update results
 * @returns {string} Markdown formatted report
 */
export function generateSummaryReport(configResults, pkgResults) {
  const lines = [
    '# Configuration Generation Report',
    '',
    `**Generated:** ${configResults.timestamp}`,
    '',
    '## Files Generated',
    ''
  ];

  if (configResults.generated.length > 0) {
    for (const file of configResults.generated) {
      lines.push(`- ✅ ${file.action}: \`${file.path}\` (${file.contentLength} bytes)`);
    }
  } else {
    lines.push('No files generated.');
  }
  
  lines.push('');

  if (configResults.skipped.length > 0) {
    lines.push('## Files Skipped', '');
    for (const file of configResults.skipped) {
      lines.push(`- ⏭️ \`${file.path}\`: ${file.reason}`);
    }
    lines.push('');
  }

  if (configResults.errors.length > 0) {
    lines.push('## Errors', '');
    for (const error of configResults.errors) {
      lines.push(`- ❌ \`${error.path || 'unknown'}\`: ${error.error}`);
    }
    lines.push('');
  }

  if (pkgResults) {
    lines.push('## Package.json Updates', '');
    if (pkgResults.updated.length > 0) {
      for (const update of pkgResults.updated) {
        if (update.added) {
          lines.push(`- ✅ Added scripts: ${update.added.join(', ')}`);
        } else {
          lines.push(`- ✅ Added field: \`${update.field}\``);
        }
      }
    } else {
      lines.push('No package.json updates needed.');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoPath = process.argv[2] || process.cwd();
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  
  console.log(`🔧 Generating configurations for: ${repoPath}`);
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Force: ${force}`);
  console.log('');
  
  const configResults = generateConfigs(repoPath, { dryRun, force });
  const pkgResults = updatePackageJson(repoPath, { dryRun });
  
  const report = generateSummaryReport(configResults, pkgResults);
  console.log(report);
  
  // Output JSON for programmatic use if requested
  if (process.argv.includes('--json')) {
    console.log('\n--- JSON Output ---\n');
    console.log(JSON.stringify({ configs: configResults, packageJson: pkgResults }, null, 2));
  }

  // Exit with error if there were failures
  if (configResults.errors.length > 0 || pkgResults.errors.length > 0) {
    process.exit(1);
  }
}

export default { generateConfigs, updatePackageJson, generateSummaryReport };
