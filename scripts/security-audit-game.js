#!/usr/bin/env node

/**
 * Security audit script for games before adding to gallery
 * Checks for common security issues and malicious code patterns
 */

const fs = require('fs');
const path = require('path');

const SUSPICIOUS_PATTERNS = [
  // XSS patterns
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\([^,]*["']/gi,
  /setInterval\s*\([^,]*["']/gi,
  /document\.write\s*\(/gi,
  /document\.writeln\s*\(/gi,
  /innerHTML\s*=\s*[^=]/gi,
  /outerHTML\s*=\s*[^=]/gi,
  
  // External script injection
  /<script[^>]*src\s*=\s*["']https?:\/\/(?!cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)/gi,
  
  // Data exfiltration
  /XMLHttpRequest/gi,
  /fetch\s*\([^)]*["']https?:\/\//gi,
  /\.send\s*\(/gi,
  
  // Crypto mining
  /coin-hive/gi,
  /cryptonight/gi,
  /webassembly/gi,
  /webgl/gi,
  
  // Iframe manipulation
  /parent\./gi,
  /top\./gi,
  /window\.parent/gi,
  /window\.top/gi,
  
  // Local storage abuse
  /localStorage\.setItem\s*\([^,]*["']token/gi,
  /localStorage\.setItem\s*\([^,]*["']password/gi,
  /localStorage\.setItem\s*\([^,]*["']key/gi,
  
  // Cookie manipulation
  /document\.cookie\s*=/gi,
  
  // Form submission to external domains
  /form.*action\s*=\s*["']https?:\/\//gi,
];

const ALLOWED_EXTERNAL_DOMAINS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

function auditFile(filePath) {
  const issues = [];
  const warnings = [];
  
  if (!fs.existsSync(filePath)) {
    return { issues: [`File not found: ${filePath}`], warnings: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  
  // Only audit HTML, JS, and CSS files
  if (!['.html', '.js', '.css', '.htm'].includes(ext)) {
    return { issues: [], warnings: [] };
  }
  
  // Check for suspicious patterns
  SUSPICIOUS_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        const lineNum = content.substring(0, content.indexOf(match)).split('\n').length;
        const line = lines[lineNum - 1]?.trim() || '';
        
        if (pattern.source.includes('eval') || pattern.source.includes('Function')) {
          issues.push(`Line ${lineNum}: Potentially dangerous code execution: ${line.substring(0, 100)}`);
        } else if (pattern.source.includes('innerHTML') || pattern.source.includes('outerHTML')) {
          warnings.push(`Line ${lineNum}: InnerHTML/OuterHTML usage (potential XSS): ${line.substring(0, 100)}`);
        } else if (pattern.source.includes('XMLHttpRequest') || pattern.source.includes('fetch')) {
          warnings.push(`Line ${lineNum}: External network request: ${line.substring(0, 100)}`);
        } else {
          warnings.push(`Line ${lineNum}: Suspicious pattern detected: ${line.substring(0, 100)}`);
        }
      });
    }
  });
  
  // Check for external script sources
  const scriptSrcMatches = content.matchAll(/<script[^>]*src\s*=\s*["']([^"']+)["']/gi);
  for (const match of scriptSrcMatches) {
    const src = match[1];
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const domain = new URL(src).hostname;
      if (!ALLOWED_EXTERNAL_DOMAINS.some(allowed => domain.includes(allowed))) {
        issues.push(`External script from untrusted domain: ${src}`);
      }
    }
  }
  
  // Check file size (very large files might be obfuscated)
  const sizeKB = fs.statSync(filePath).size / 1024;
  if (sizeKB > 500) {
    warnings.push(`Large file size (${sizeKB.toFixed(1)}KB) - may contain obfuscated code`);
  }
  
  // Check for base64 encoded content (potential obfuscation)
  const base64Pattern = /data:[^;]*;base64,[A-Za-z0-9+\/=]{100,}/g;
  if (base64Pattern.test(content)) {
    warnings.push('Large base64 encoded content detected (potential obfuscation)');
  }
  
  return { issues, warnings };
}

function auditGameDirectory(gameDir) {
  const results = {
    gameDir,
    files: [],
    totalIssues: 0,
    totalWarnings: 0,
    safe: true,
  };
  
  if (!fs.existsSync(gameDir)) {
    results.safe = false;
    results.files.push({ path: gameDir, error: 'Directory not found' });
    return results;
  }
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        const audit = auditFile(fullPath);
        const relativePath = path.relative(gameDir, fullPath);
        
        results.files.push({
          path: relativePath,
          issues: audit.issues,
          warnings: audit.warnings,
        });
        
        results.totalIssues += audit.issues.length;
        results.totalWarnings += audit.warnings.length;
      }
    });
  }
  
  scanDirectory(gameDir);
  
  results.safe = results.totalIssues === 0;
  
  return results;
}

// Main execution
const gamePath = process.argv[2];

if (!gamePath) {
  console.error('Usage: node security-audit-game.js <game-directory>');
  console.error('');
  console.error('Example:');
  console.error('  node security-audit-game.js public/games/my-game');
  process.exit(1);
}

const gameDir = path.resolve(gamePath);
console.log(`🔍 Security Audit: ${gameDir}\n`);

const results = auditGameDirectory(gameDir);

console.log(`📊 Results: ${results.files.length} files scanned\n`);

if (results.totalIssues === 0 && results.totalWarnings === 0) {
  console.log('✅ No security issues found! Game appears safe.\n');
  process.exit(0);
}

if (results.totalIssues > 0) {
  console.log(`❌ SECURITY ISSUES FOUND (${results.totalIssues}):\n`);
  results.files.forEach(file => {
    if (file.issues && file.issues.length > 0) {
      console.log(`  File: ${file.path}`);
      file.issues.forEach(issue => {
        console.log(`    ❌ ${issue}`);
      });
      console.log('');
    }
  });
}

if (results.totalWarnings > 0) {
  console.log(`⚠️  WARNINGS (${results.totalWarnings}):\n`);
  results.files.forEach(file => {
    if (file.warnings && file.warnings.length > 0) {
      console.log(`  File: ${file.path}`);
      file.warnings.forEach(warning => {
        console.log(`    ⚠️  ${warning}`);
      });
      console.log('');
    }
  });
}

console.log('\n📋 Summary:');
console.log(`   Issues: ${results.totalIssues}`);
console.log(`   Warnings: ${results.totalWarnings}`);
console.log(`   Status: ${results.safe ? '✅ SAFE' : '❌ UNSAFE - DO NOT USE'}\n`);

if (!results.safe) {
  console.log('🚫 This game contains security issues and should NOT be added to the gallery.');
  console.log('   Review the issues above and fix them before proceeding.\n');
  process.exit(1);
} else if (results.totalWarnings > 0) {
  console.log('⚠️  This game has warnings. Review them before approving.\n');
  process.exit(0);
} else {
  console.log('✅ Game passed security audit!\n');
  process.exit(0);
}

