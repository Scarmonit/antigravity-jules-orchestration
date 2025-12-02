#!/usr/bin/env node

/**
 * analyze-patterns.js
 * Pattern discovery and analysis from repository configurations
 * 
 * Analyzes the current repository against known patterns from popular
 * open-source projects to identify missing best practices.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load patterns configuration
 * @returns {object} Patterns configuration
 */
function loadPatterns() {
  const patternsPath = join(__dirname, 'lib', 'repo-patterns.json');
  const content = readFileSync(patternsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Check if a file or directory exists at the given path
 * @param {string} basePath - Base repository path
 * @param {string} relativePath - Relative path to check
 * @returns {boolean} True if exists
 */
function pathExists(basePath, relativePath) {
  const fullPath = join(basePath, relativePath);
  return existsSync(fullPath);
}

/**
 * Load and parse package.json
 * @param {string} basePath - Base repository path
 * @returns {object|null} Parsed package.json or null
 */
function loadPackageJson(basePath) {
  const pkgPath = join(basePath, 'package.json');
  if (!existsSync(pkgPath)) {
    return null;
  }
  try {
    const content = readFileSync(pkgPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Analyze patterns in a repository
 * @param {string} repoPath - Path to repository
 * @returns {object} Analysis results
 */
export function analyzePatterns(repoPath) {
  const patterns = loadPatterns();
  const pkg = loadPackageJson(repoPath);
  
  const results = {
    timestamp: new Date().toISOString(),
    repoPath,
    present: [],
    missing: [],
    packageJson: {
      present: [],
      missing: [],
      scripts: {
        present: [],
        missing: []
      }
    },
    score: {
      current: 0,
      maximum: 0,
      percentage: 0
    },
    recommendations: []
  };

  // Analyze file/directory patterns
  for (const priority of ['critical', 'high', 'medium', 'low']) {
    const priorityPatterns = patterns.patterns[priority];
    if (!priorityPatterns || !priorityPatterns.items) continue;

    for (const pattern of priorityPatterns.items) {
      const scoreValue = patterns.scoring[priority] || 1;
      results.score.maximum += scoreValue;

      if (pathExists(repoPath, pattern.path)) {
        results.present.push({
          ...pattern,
          priority,
          score: scoreValue
        });
        results.score.current += scoreValue;
      } else {
        results.missing.push({
          ...pattern,
          priority,
          score: scoreValue
        });
        results.recommendations.push({
          priority,
          type: 'file',
          id: pattern.id,
          name: pattern.name,
          path: pattern.path,
          template: pattern.template,
          message: `Add ${pattern.name} (${pattern.path})`
        });
      }
    }
  }

  // Analyze package.json fields
  if (pkg) {
    const pkgFields = patterns.packageJsonFields;
    
    // Check required fields
    for (const field of pkgFields.required) {
      results.score.maximum += patterns.scoring.packageJsonField;
      if (pkg[field]) {
        results.packageJson.present.push(field);
        results.score.current += patterns.scoring.packageJsonField;
      } else {
        results.packageJson.missing.push(field);
        results.recommendations.push({
          priority: 'critical',
          type: 'packageJsonField',
          field,
          message: `Add required field "${field}" to package.json`
        });
      }
    }

    // Check recommended fields
    for (const fieldConfig of pkgFields.recommended) {
      results.score.maximum += patterns.scoring.packageJsonField;
      if (pkg[fieldConfig.field]) {
        results.packageJson.present.push(fieldConfig.field);
        results.score.current += patterns.scoring.packageJsonField;
      } else {
        results.packageJson.missing.push(fieldConfig.field);
        results.recommendations.push({
          priority: 'medium',
          type: 'packageJsonField',
          field: fieldConfig.field,
          template: fieldConfig.template,
          message: `Add recommended field "${fieldConfig.field}" to package.json`
        });
      }
    }

    // Check recommended scripts
    const existingScripts = pkg.scripts || {};
    for (const scriptConfig of pkgFields.recommendedScripts) {
      results.score.maximum += patterns.scoring.packageJsonScript;
      if (existingScripts[scriptConfig.name]) {
        results.packageJson.scripts.present.push(scriptConfig.name);
        results.score.current += patterns.scoring.packageJsonScript;
      } else {
        results.packageJson.scripts.missing.push(scriptConfig.name);
        results.recommendations.push({
          priority: 'low',
          type: 'packageJsonScript',
          script: scriptConfig.name,
          description: scriptConfig.description,
          message: `Add npm script "${scriptConfig.name}": ${scriptConfig.description}`
        });
      }
    }
  } else {
    results.recommendations.push({
      priority: 'critical',
      type: 'file',
      id: 'package-json',
      message: 'Create package.json file'
    });
  }

  // Calculate percentage
  results.score.percentage = results.score.maximum > 0 
    ? Math.round((results.score.current / results.score.maximum) * 100)
    : 0;

  // Sort recommendations by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  results.recommendations.sort((a, b) => 
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return results;
}

/**
 * Generate a summary report from analysis results
 * @param {object} results - Analysis results
 * @returns {string} Markdown formatted report
 */
export function generateReport(results) {
  const lines = [
    '# Repository Audit Report',
    '',
    `**Generated:** ${results.timestamp}`,
    `**Repository:** ${results.repoPath}`,
    '',
    '## Score',
    '',
    `**${results.score.current}/${results.score.maximum} (${results.score.percentage}%)**`,
    '',
    '## Summary',
    '',
    `- ✅ Present patterns: ${results.present.length}`,
    `- ❌ Missing patterns: ${results.missing.length}`,
    `- 📦 Package.json fields present: ${results.packageJson.present.length}`,
    `- 📦 Package.json fields missing: ${results.packageJson.missing.length}`,
    `- 📜 Scripts present: ${results.packageJson.scripts.present.length}`,
    `- 📜 Scripts missing: ${results.packageJson.scripts.missing.length}`,
    ''
  ];

  // Present patterns
  if (results.present.length > 0) {
    lines.push('## ✅ Present Patterns', '');
    for (const pattern of results.present) {
      lines.push(`- [${pattern.priority.toUpperCase()}] ${pattern.name} (\`${pattern.path}\`)`);
    }
    lines.push('');
  }

  // Missing patterns
  if (results.missing.length > 0) {
    lines.push('## ❌ Missing Patterns', '');
    for (const pattern of results.missing) {
      lines.push(`- [${pattern.priority.toUpperCase()}] ${pattern.name} (\`${pattern.path}\`)`);
    }
    lines.push('');
  }

  // Recommendations
  if (results.recommendations.length > 0) {
    lines.push('## 📋 Recommendations', '');
    for (const rec of results.recommendations) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[rec.priority] || '⚪';
      lines.push(`- ${icon} ${rec.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoPath = process.argv[2] || process.cwd();
  
  console.log('🔍 Analyzing repository patterns...\n');
  
  const results = analyzePatterns(repoPath);
  const report = generateReport(results);
  
  console.log(report);
  
  // Output JSON for programmatic use if requested
  if (process.argv.includes('--json')) {
    console.log('\n--- JSON Output ---\n');
    console.log(JSON.stringify(results, null, 2));
  }
  
  // Exit with non-zero code if score is below threshold
  const threshold = parseInt(process.env.AUDIT_THRESHOLD || '80', 10);
  if (results.score.percentage < threshold) {
    console.log(`\n⚠️  Score ${results.score.percentage}% is below threshold ${threshold}%`);
    process.exit(1);
  }
}

export default { analyzePatterns, generateReport };
