/**
 * Verify earthquake pipeline code is correct
 * This checks the code logic without running Netlify dev
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying earthquake pipeline code...\n');

let errors = [];
let warnings = [];

// 1. Check template file exists
const templatePaths = [
  path.join(process.cwd(), '1stUSGSTemp.png'),
  path.join(process.cwd(), 'netlify/functions/1stUSGSTemp.png'),
];

let templateFound = false;
for (const templatePath of templatePaths) {
  if (fs.existsSync(templatePath)) {
    const stats = fs.statSync(templatePath);
    console.log(`✅ Template found: ${templatePath} (${stats.size} bytes)`);
    templateFound = true;
    break;
  }
}

if (!templateFound) {
  errors.push('Template file not found in expected locations');
}

// 2. Check function files exist
const functionFiles = [
  'netlify/functions/earthquake-poller.js',
  'netlify/functions/generate-earthquake-image.js',
  'netlify/functions/send-earthquake-alert.js',
];

for (const file of functionFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ Function exists: ${file}`);
  } else {
    errors.push(`Function missing: ${file}`);
  }
}

// 3. Check generate-earthquake-image.js has HTTP fallback
const genImagePath = path.join(process.cwd(), 'netlify/functions/generate-earthquake-image.js');
if (fs.existsSync(genImagePath)) {
  const content = fs.readFileSync(genImagePath, 'utf8');
  
  if (content.includes('Trying HTTP')) {
    console.log('✅ HTTP fallback code present');
  } else {
    errors.push('HTTP fallback code missing in generate-earthquake-image.js');
  }
  
  if (content.includes('localhost:8888')) {
    console.log('✅ Local dev HTTP path configured');
  } else {
    warnings.push('Local dev HTTP path might not be configured');
  }
  
  if (content.includes('noteworthynews.co')) {
    console.log('✅ Production HTTP path configured');
  }
}

// 4. Check send-earthquake-alert.js uses AI_NOTIFICATION_EMAILS
const alertPath = path.join(process.cwd(), 'netlify/functions/send-earthquake-alert.js');
if (fs.existsSync(alertPath)) {
  const content = fs.readFileSync(alertPath, 'utf8');
  
  if (content.includes('AI_NOTIFICATION_EMAILS')) {
    console.log('✅ Uses AI_NOTIFICATION_EMAILS for alerts');
  } else {
    errors.push('send-earthquake-alert.js should use AI_NOTIFICATION_EMAILS');
  }
  
  if (content.includes('attachments')) {
    console.log('✅ Email attachment code present');
  } else {
    errors.push('Email attachment code missing');
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ ALL CHECKS PASSED - Code is ready!\n');
  console.log('Next steps:');
  console.log('1. Restart Netlify dev: npm run dev');
  console.log('2. Run test: npm run test:earthquake-full');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('❌ ERRORS FOUND:');
    errors.forEach(e => console.log(`   - ${e}`));
  }
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }
  process.exit(1);
}

