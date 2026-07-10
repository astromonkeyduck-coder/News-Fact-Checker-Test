'use strict';

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'apply-hardening.js');
let source = fs.readFileSync(target, 'utf8');

const oldGuardStart = source.indexOf('function insertGuardBeforeHandlerTry(relativePath, options) {');
const oldGuardEnd = source.indexOf('\nfunction addValidationErrorHandling(relativePath) {', oldGuardStart);
if (oldGuardStart < 0 || oldGuardEnd < 0) throw new Error('Unable to locate guard codemod helper');

const newGuard = `function insertGuardBeforeHandlerTry(relativePath, options) {
  const source = read(relativePath);
  if (source.includes(\`scope: '\${options.scope}'\`)) return;
  const sourceFile = parseSource(relativePath, source);
  const handler = findHandlerFunction(sourceFile);
  const directTry = handler.body.statements.find(ts.isTryStatement);
  let insertionPoint = directTry ? directTry.getFullStart() : -1;

  if (insertionPoint < 0) {
    const postBranch = handler.body.statements.find((statement) => (
      ts.isIfStatement(statement)
      && statement.expression.getText(sourceFile).includes('event.httpMethod')
      && statement.expression.getText(sourceFile).includes("'POST'")
    ));
    if (postBranch) insertionPoint = postBranch.getFullStart();
  }

  if (insertionPoint < 0) {
    throw new Error(\`\${relativePath}: handler guard insertion point not found\`);
  }

  const guard = \`  if (event.httpMethod === 'POST') {\\n\`
    + \`    const guardResponse = await enforcePublicRateLimit(event, {\\n\`
    + \`      scope: '\${options.scope}',\\n\`
    + \`      limit: \${options.limit},\\n\`
    + \`      windowMs: \${options.windowMs},\\n\`
    + \`      maxBodyBytes: \${options.maxBodyBytes},\\n\`
    + \`      headers,\\n\`
    + \`    });\\n\`
    + \`    if (guardResponse) return guardResponse;\\n\`
    + \`  }\\n\\n\`;

  applyRanges(relativePath, [{
    start: insertionPoint,
    end: insertionPoint,
    replacement: \`\\n\${guard}\`,
  }]);
}
`;
source = source.slice(0, oldGuardStart) + newGuard + source.slice(oldGuardEnd);

if (!source.includes('function replaceFirst(')) {
  const insertAt = source.indexOf('\nfunction parseSource(');
  if (insertAt < 0) throw new Error('Unable to add replaceFirst helper');
  const helper = `
function replaceFirst(relativePath, search, replacement, label) {
  const current = read(relativePath);
  if (!current.includes(search)) {
    throw new Error(\`\${relativePath}: missing \${label || 'match'}\`);
  }
  write(relativePath, current.replace(search, replacement));
}
`;
  source = source.slice(0, insertAt) + helper + source.slice(insertAt);
}

const subscribeLabel = source.indexOf("'subscribe key derivation',");
const subscribeCall = source.lastIndexOf('  replaceOnce(', subscribeLabel);
if (subscribeLabel < 0 || subscribeCall < 0) throw new Error('Unable to locate subscribe key replacement');
source = source.slice(0, subscribeCall)
  + source.slice(subscribeCall).replace('  replaceOnce(', '  replaceFirst(');

source = source.replace(
  "/const CACHE_VERSION = '([^']+)'\\s*;/,\n    (match, version) => `const CACHE_VERSION = '${version}-hardening';`,",
  "/const (CACHE_VERSION|CACHE_NAME) = '([^']+)'\\s*;/,\n    (match, name, version) => `const ${name} = '${version}-hardening';`,",
);

source = source.replace(
  "      && containsSensitiveIdentifier(node.expression)) {",
  "      && containsSensitiveIdentifier(node.expression)\n      && node.parent && ts.isBlock(node.parent)) {",
);

source = source.replace(
  "replacement: `${object.properties.length ? ',' : ''} company: newsletterHoneypot ? newsletterHoneypot.value : ''`,",
  "replacement: `${js.slice(object.getStart(sourceFile), object.end - 1).trimEnd().endsWith(',') ? '' : ','} company: newsletterHoneypot ? newsletterHoneypot.value : ''`,",
);

source = source.replace(
  "  if (!headerBlock.test(source)) throw new Error(`${target}: global headers block not found`);\n  source = source.replace(\n    headerBlock,\n    `$1  Strict-Transport-Security = \\\"max-age=86400\\\"\\n  X-Permitted-Cross-Domain-Policies = \\\"none\\\"\\n`,\n  );",
  "  if (headerBlock.test(source)) {\n    source = source.replace(\n      headerBlock,\n      `$1  Strict-Transport-Security = \\\"max-age=86400\\\"\\n  X-Permitted-Cross-Domain-Policies = \\\"none\\\"\\n`,\n    );\n  } else {\n    source += `\\n[[headers]]\\n  for = \\\"/*\\\"\\n  [headers.values]\\n    Strict-Transport-Security = \\\"max-age=86400\\\"\\n    X-Permitted-Cross-Domain-Policies = \\\"none\\\"\\n`;\n  }",
);

fs.writeFileSync(target, source);
require(target);
