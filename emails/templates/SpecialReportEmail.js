/**
 * SpecialReportEmail
 * 
 * Template for long-form investigations and special reports.
 * 
 * Props:
 * - headline: string (required)
 * - dateline: string (required)
 * - fullName: string (required)
 * - abstract: string (required) - Short intro/abstract
 * - sections: Array<{title: string, content: string[]}> - Body sections
 * - ctaLabel: string (default: "Read Full Report")
 * - ctaUrl: string (required)
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

function SpecialReportEmail({
  headline,
  dateline,
  fullName,
  abstract,
  sections = [],
  ctaLabel = 'Read Full Report',
  ctaUrl,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: dateline, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailAlertTag({ label: 'SPECIAL REPORT', bold: true })}
    ${EmailParagraph({ text: headline, marginTop: 0, marginBottom: 30, fontSize: 20, color: '#fff' })}
    ${EmailParagraph({ text: abstract, marginTop: 0, marginBottom: 50, fontSize: 16 })}
  `;
  
  sections.forEach((section, index) => {
    const isLast = index === sections.length - 1;
    content += EmailSection({ title: section.title });
    section.content.forEach((para, paraIndex) => {
      const isLastPara = paraIndex === section.content.length - 1;
      content += EmailParagraph({ 
        text: para, 
        marginTop: 0, 
        marginBottom: isLastPara && isLast ? 50 : 20 
      });
    });
  });
  
  content += EmailButton({ label: ctaLabel, url: ctaUrl, marginTop: 0, marginBottom: 50 });
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Special Report',
    unsubscribeUrl 
  });
}

module.exports = SpecialReportEmail;

























