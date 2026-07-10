'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const write = (relativePath, content) => fs.writeFileSync(path.join(root, relativePath), content);

const alreadyApplied = read('admin/js/admin-auth.js').includes('return res.ok;')
  && read('netlify/functions/send-email.js').includes("scope: 'newsletter-signup'")
  && read('netlify/functions/push-subscribe.js').includes('normalizedSubscription')
  && read('sw.js').includes('function sanitizeNotificationUrl(');

if (alreadyApplied) {
  console.log('Hardening is already applied; recovery is a no-op.');
  process.exit(0);
}

let codemod = read('scripts/production-audit/apply-hardening.js');

codemod = codemod.replace(
  "/const\\s*\\{\\s*email\\s*,\\s*fullName\\s*\\}\\s*=\\s*JSON\\.parse\\(event\\.body\\);/",
  "/const\\s*\\{\\s*email\\s*,\\s*fullName\\s*\\}\\s*=\\s*JSON\\.parse\\(event\\.body(?:\\s*\\|\\|\\s*['\\\"]\\{\\}['\\\"])?\\);/",
);

codemod = codemod.replace(
  "replaceOnce(target, 'const body = JSON.parse(event.body);', 'const body = parseJsonObject(event.body);', 'push JSON parser');",
  "replaceOnce(target, /const body = JSON\\.parse\\(event\\.body(?:\\s*\\|\\|\\s*['\\\"]\\{\\}['\\\"])?\\);/, 'const body = parseJsonObject(event.body);', 'push JSON parser');",
);

codemod = codemod.replace(
  "node.expression.getText(sourceFile).includes(\"email.includes('@')\")",
  "node.expression.getText(sourceFile).includes('email.includes') && node.expression.getText(sourceFile).includes('@')",
);

codemod = codemod.replace(
  "replaceOnce(target, 'userEmail: userEmail || null,', 'userEmail: normalizedUserEmail,', 'stored push email');",
  "replaceOnce(target, /userEmail:\\s*userEmail\\s*\\|\\|\\s*(?:null|['\\\"]['\\\"]),/, 'userEmail: normalizedUserEmail,', 'stored push email');",
);

codemod = codemod.replace(
  "const withinNewsletter = node.getStart(sourceFile) > js.indexOf(\"newsletterForm.addEventListener('submit'\");",
  "const withinNewsletter = node.getStart(sourceFile) > js.indexOf('newsletterForm.addEventListener');",
);

write('scripts/production-audit/apply-hardening.js', codemod);

let runner = read('scripts/production-audit/apply-hardening-runner.js');
runner = runner.replace(
  "&& statement.expression.getText(sourceFile).includes(\"'POST'\")",
  "&& /['\\\"]POST['\\\"]/.test(statement.expression.getText(sourceFile))",
);
runner = runner.replace(
  "  if (insertionPoint < 0) {\n    throw new Error(\\`\\${relativePath}: handler guard insertion point not found\\`);\n  }",
  "  if (insertionPoint < 0) {\n    insertionPoint = handler.body.statements.length\n      ? handler.body.statements[0].getFullStart()\n      : handler.body.getStart(sourceFile) + 1;\n  }",
);
write('scripts/production-audit/apply-hardening-runner.js', runner);

require(path.join(__dirname, 'apply-hardening-runner.js'));
