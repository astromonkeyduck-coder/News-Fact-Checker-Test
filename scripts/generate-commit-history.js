/**
 * Generate commit history and store in Blobs
 * Run this script to populate git commit history for developer logs
 * 
 * Usage: node scripts/generate-commit-history.js
 */

const { execSync } = require('child_process');
const { getStore } = require("@netlify/blobs");

async function generateCommitHistory() {
  try {
    // Get git commit history
    console.log('📝 Fetching git commit history...');
    const commitsOutput = execSync(
      'git log --pretty=format:"%h|%ai|%s" --date=iso',
      { encoding: 'utf-8' }
    ).trim();
    
    if (!commitsOutput) {
      console.error('❌ No git commits found');
      process.exit(1);
    }
    
    const commits = commitsOutput.split('\n').reverse().map(line => {
      const [hash, date, ...messageParts] = line.split('|');
      return {
        hash: hash.substring(0, 7),
        date: date,
        message: messageParts.join('|')
      };
    });
    
    console.log(`✅ Found ${commits.length} commits`);
    
    // Store in Blobs
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_BLOB_READ_WRITE_TOKEN;
    
    if (!siteID || !token) {
      console.error('❌ NETLIFY_SITE_ID and NETLIFY_BLOB_READ_WRITE_TOKEN must be set');
      console.log('Set these in your environment or .env file');
      process.exit(1);
    }
    
    const store = getStore({
      name: "config",
      siteID: siteID,
      token: token,
    });
    
    await store.set("git-commit-history", JSON.stringify({
      commits: commits,
      generatedAt: new Date().toISOString(),
      totalCommits: commits.length
    }));
    
    console.log('✅ Commit history stored in Blobs');
    console.log(`   First commit: ${commits[0].date}`);
    console.log(`   Latest commit: ${commits[commits.length - 1].date}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  generateCommitHistory();
}

module.exports = { generateCommitHistory };

