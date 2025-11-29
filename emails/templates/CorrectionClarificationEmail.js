/**
 * CorrectionClarificationEmail
 * 
 * Template for corrections and clarifications.
 * Professional, accountable, neutral tone.
 * 
 * Props:
 * - originalHeadline: string (required)
 * - dateline: string (required)
 * - fullName: string (required)
 * - correctionStatement: string (required) - What was wrong
 * - correctInformation: string (required)
 * - explanation?: string - Brief explanation if needed
 * - correctedArticleUrl: string (required)
 * - unsubscribeUrl?: string
 */

const {
  EmailLayout,
  EmailSection,
  EmailAlertTag,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function CorrectionClarificationEmail({
  originalHeadline,
  dateline,
  fullName,
  correctionStatement,
  correctInformation,
  explanation = null,
  correctedArticleUrl,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: dateline, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailAlertTag({ label: 'CORRECTION', bold: true })}
    ${EmailParagraph({ text: `Correction: ${originalHeadline}`, marginTop: 0, marginBottom: 30, fontSize: 18, color: '#fff' })}
  `;
  
  content += EmailSection({ title: 'What Was Incorrect' });
  content += EmailParagraph({ text: correctionStatement, marginTop: 0, marginBottom: 30 });
  
  content += EmailSection({ title: 'Correct Information' });
  content += EmailParagraph({ text: correctInformation, marginTop: 0, marginBottom: explanation ? 30 : 50 });
  
  if (explanation) {
    content += EmailSection({ title: 'Explanation' });
    content += EmailParagraph({ text: explanation, marginTop: 0, marginBottom: 50 });
  }
  
  content += EmailButton({ 
    label: 'Read Corrected Article', 
    url: correctedArticleUrl, 
    marginTop: 0, 
    marginBottom: 50 
  });
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Correction',
    unsubscribeUrl 
  });
}

module.exports = CorrectionClarificationEmail;


