/**
 * DevelopingStoryEmail
 * 
 * Template for developing/ongoing stories that need updates.
 * Slightly softer than BREAKING but still urgent.
 * 
 * Props:
 * - headline: string (required)
 * - dateline: string (required)
 * - fullName: string (required)
 * - summary: string (required) - Brief summary
 * - timeline: Array<{time: string, event: string}> - What we know so far
 * - unknownItems?: string[] - What we don't know yet
 * - ctaLabel: string (default: "Follow Live Updates")
 * - ctaUrl: string (required)
 * - unsubscribeUrl?: string
 */

const {
  EmailLayout,
  EmailSection,
  EmailAlertTag,
  EmailBulletList,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function DevelopingStoryEmail({
  headline,
  dateline,
  fullName,
  summary,
  timeline = [],
  unknownItems = [],
  ctaLabel = 'Follow Live Updates',
  ctaUrl,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: dateline, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: summary, marginTop: 0, marginBottom: 50, fontSize: 16 })}
    ${EmailAlertTag({ label: 'DEVELOPING STORY', bold: true })}
    ${EmailParagraph({ text: headline, marginTop: 0, marginBottom: 30, fontSize: 18, color: '#fff' })}
  `;
  
  if (timeline.length > 0) {
    content += EmailSection({ title: 'What We Know So Far' });
    const timelineItems = timeline.map(item => ({
      text: `<strong>${item.time}:</strong> ${item.event}`
    }));
    content += EmailBulletList({ items: timelineItems });
  }
  
  if (unknownItems.length > 0) {
    content += EmailSection({ title: 'What We Don\'t Know Yet' });
    content += EmailBulletList({ items: unknownItems });
  }
  
  content += EmailButton({ label: ctaLabel, url: ctaUrl, marginTop: 0, marginBottom: 50 });
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Developing Story',
    unsubscribeUrl 
  });
}

module.exports = DevelopingStoryEmail;












