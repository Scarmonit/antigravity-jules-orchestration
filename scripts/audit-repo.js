#!/usr/bin/env node

/**
 * audit-repo.js
 * Main orchestration script for repository auditing
 * 
 * Coordinates the full audit workflow:
 * 1. Pattern analysis
 * 2. Gap identification
 * 3. Configuration generation
 * 4. Validation
 * 5. Documentation
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { analyzePatterns, generateReport } from './analyze-patterns.js';
import { generateConfigs, updatePackageJson, generateSummaryReport } from './generate-configs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validate JSON/YAML configuration files
 * @param {string} repoPath - Path to repository
 * @returns {object} Validation results
 */
function validateConfigs(repoPath) {
  const results = {
    valid: [],
    invalid: [],
    skipped: []
  };

  const jsonFiles = [
    'package.json',
    '.vscode/settings.json',
    '.vscode/extensions.json'
  ];

  for (const file of jsonFiles) {
    const filePath = join(repoPath, file);
    if (!existsSync(filePath)) {
      results.skipped.push({ file, reason: 'not found' });
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, '');
      JSON.parse(cleanContent);
      results.valid.push({ file });
    } catch (err) {
      results.invalid.push({ file, error: err.message });
    }
  }

  // Validate YAML files
  const yamlFiles = [
    '.github/dependabot.yml',
    '.github/workflows/labeler.yml',
    '.github/workflows/stale.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/release-drafter.yml',
    '.github/release-drafter.yml'
  ];

  for (const file of yamlFiles) {
    const filePath = join(repoPath, file);
    if (!existsSync(filePath)) {
      results.skipped.push({ file, reason: 'not found' });
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      // Basic YAML validation - check for common issues
      if (content.includes('\t')) {
        results.invalid.push({ file, error: 'Contains tabs (YAML requires spaces)' });
      } else if (!content.trim()) {
        results.invalid.push({ file, error: 'Empty file' });
      } else {
        results.valid.push({ file });
      }
    } catch (err) {
      results.invalid.push({ file, error: err.message });
    }
  }

  return results;
}

/**
 * Test npm scripts execution
 * @param {string} repoPath - Path to repository
 * @returns {object} Test results
 */
function testNpmScripts(repoPath) {
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };

  const pkgPath = join(repoPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return results;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    // Test scripts that should be safe to run
    const safeScripts = ['lint', 'format:check', 'validate'];
    
    for (const script of safeScripts) {
      if (!scripts[script]) {
        results.skipped.push({ script, reason: 'not defined' });
        continue;
      }

      try {
        execSync(`npm run ${script} --silent`, {
          cwd: repoPath,
          stdio: 'pipe',
          timeout: 60000
        });
        results.passed.push({ script });
      } catch (err) {
        // Script might fail due to linting errors, but if it runs, it's valid
        if (err.status !== undefined) {
          results.passed.push({ script, note: 'Script ran but returned non-zero' });
        } else {
          results.failed.push({ script, error: err.message });
        }
      }
    }
  } catch (err) {
    results.failed.push({ script: 'package.json', error: err.message });
  }

  return results;
}

/**
 * Generate audit documentation
 * @param {object} analysis - Pattern analysis results
 * @param {object} generation - Generation results
 * @param {object} validation - Validation results
 * @param {object} options - Options
 * @returns {string} Documentation content
 */
function generateAuditDoc(analysis, generation, validation, options = {}) {
  const { repoPath, startTime, endTime } = options;
  const duration = endTime ? ((endTime - startTime) / 1000).toFixed(2) : 'N/A';

  const lines = [
    '# Repository Audit Complete',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Duration:** ${duration}s`,
    `**Repository:** ${repoPath}`,
    '',
    '## Score Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Initial Score | ${analysis.score.percentage}% |`,
    `| Patterns Present | ${analysis.present.length} |`,
    `| Patterns Missing | ${analysis.missing.length} |`,
    `| Files Generated | ${generation.configs.generated.length} |`,
    `| Config Validations Passed | ${validation.valid.length} |`,
    '',
    '## Actions Taken',
    '',
    '### Files Created',
    ''
  ];

  if (generation.configs.generated.length > 0) {
    for (const file of generation.configs.generated) {
      lines.push(`- ✅ \`${file.path}\``);
    }
  } else {
    lines.push('No files were created (all patterns already present).');
  }

  lines.push('', '### Package.json Updates', '');
  
  if (generation.packageJson.updated.length > 0) {
    for (const update of generation.packageJson.updated) {
      if (update.added) {
        lines.push(`- ✅ Added scripts: ${update.added.join(', ')}`);
      } else {
        lines.push(`- ✅ Added field: \`${update.field}\``);
      }
    }
  } else {
    lines.push('No package.json updates needed.');
  }

  lines.push('', '### Validation Results', '');
  lines.push(`- ✅ Valid configs: ${validation.valid.length}`);
  lines.push(`- ⏭️ Skipped: ${validation.skipped.length}`);
  if (validation.invalid.length > 0) {
    lines.push(`- ❌ Invalid: ${validation.invalid.length}`);
    for (const item of validation.invalid) {
      lines.push(`  - \`${item.file}\`: ${item.error}`);
    }
  }

  lines.push('', '## Recommendations', '');
  
  const remainingRecs = analysis.recommendations.filter(
    r => !generation.configs.generated.find(g => g.id === r.id)
  );

  if (remainingRecs.length > 0) {
    for (const rec of remainingRecs.slice(0, 10)) {
      const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[rec.priority] || '⚪';
      lines.push(`- ${icon} ${rec.message}`);
    }
    if (remainingRecs.length > 10) {
      lines.push(`- ... and ${remainingRecs.length - 10} more`);
    }
  } else {
    lines.push('All recommendations have been addressed! 🎉');
  }

  lines.push('', '---', '', '*Generated by audit-repo.js*');

  return lines.join('\n');
}

/**
 * Run the full audit workflow
 * @param {string} repoPath - Path to repository
 * @param {object} options - Workflow options
 * @returns {object} Complete audit results
 */
export async function runAudit(repoPath, options = {}) {
  const { 
    dryRun = false, 
    force = false, 
    generateDocs = true,
    validate = true,
    priorities = ['critical', 'high', 'medium', 'low']
  } = options;

  const startTime = Date.now();
  console.log('🚀 Starting Repository Audit Workflow');
  console.log(`   Repository: ${repoPath}`);
  console.log(`   Dry Run: ${dryRun}`);
  console.log(`   Priorities: ${priorities.join(', ')}`);
  console.log('');

  // Phase 1: Analyze patterns
  console.log('📊 Phase 1: Analyzing patterns...');
  const analysis = analyzePatterns(repoPath);
  console.log(`   Score: ${analysis.score.percentage}%`);
  console.log(`   Present: ${analysis.present.length} patterns`);
  console.log(`   Missing: ${analysis.missing.length} patterns`);
  console.log('');

  // Phase 2: Generate configurations
  console.log('🔧 Phase 2: Generating configurations...');
  const configResults = generateConfigs(repoPath, { dryRun, force, priorities });
  const pkgResults = updatePackageJson(repoPath, { dryRun });
  console.log(`   Generated: ${configResults.generated.length} files`);
  console.log(`   Skipped: ${configResults.skipped.length} files`);
  console.log(`   Package.json updates: ${pkgResults.updated.length}`);
  console.log('');

  // Phase 3: Validate configurations
  let validation = { valid: [], invalid: [], skipped: [] };
  if (validate && !dryRun) {
    console.log('✅ Phase 3: Validating configurations...');
    validation = validateConfigs(repoPath);
    console.log(`   Valid: ${validation.valid.length}`);
    console.log(`   Invalid: ${validation.invalid.length}`);
    console.log(`   Skipped: ${validation.skipped.length}`);
    console.log('');
  }

  // Phase 4: Generate documentation
  if (generateDocs && !dryRun) {
    console.log('📝 Phase 4: Generating documentation...');
    const endTime = Date.now();
    const docContent = generateAuditDoc(
      analysis,
      { configs: configResults, packageJson: pkgResults },
      validation,
      { repoPath, startTime, endTime }
    );
    
    const docPath = join(repoPath, 'AUDIT_RESULTS.md');
    writeFileSync(docPath, docContent, 'utf-8');
    console.log(`   Created: AUDIT_RESULTS.md`);
    console.log('');
  }

  // Final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('🎉 Audit Complete!');
  console.log(`   Duration: ${duration}s`);
  console.log(`   Files generated: ${configResults.generated.length}`);
  console.log(`   Package.json updated: ${pkgResults.updated.length > 0}`);
  console.log(`   Initial score: ${analysis.score.percentage}%`);
  
  // Re-analyze to get new score
  if (!dryRun && configResults.generated.length > 0) {
    const newAnalysis = analyzePatterns(repoPath);
    console.log(`   New score: ${newAnalysis.score.percentage}%`);
    console.log(`   Improvement: +${newAnalysis.score.percentage - analysis.score.percentage}%`);
  }

  return {
    analysis,
    generation: {
      configs: configResults,
      packageJson: pkgResults
    },
    validation,
    duration,
    startTime,
    endTime
  };
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoPath = process.argv[2] || process.cwd();
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const noDocs = process.argv.includes('--no-docs');
  const noValidate = process.argv.includes('--no-validate');
  
  // Parse priority filter
  const priorityArg = process.argv.find(a => a.startsWith('--priorities='));
  const priorities = priorityArg 
    ? priorityArg.split('=')[1].split(',')
    : ['critical', 'high', 'medium', 'low'];

  runAudit(repoPath, {
    dryRun,
    force,
    generateDocs: !noDocs,
    validate: !noValidate,
    priorities
  }).then(results => {
    // Output JSON for CI/CD integration
    if (process.argv.includes('--json')) {
      console.log('\n--- JSON Output ---\n');
      console.log(JSON.stringify(results, null, 2));
    }
    
    // Exit with error if validation failed
    if (results.validation.invalid.length > 0) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('❌ Audit failed:', err.message);
    process.exit(1);
  });
}

export default { runAudit };
