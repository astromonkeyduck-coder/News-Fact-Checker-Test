/**
 * YearInReviewEmail
 * 
 * Template for year-end reviews and retrospectives.
 * 
 * Props:
 * - year: number (required)
 * - fullName: string (required)
 * - majorStories: Array<{headline, summary, url}> (required)
 * - milestones: Array<string> (required)
 * - mostRead?: Array<{headline, url}>
 * - lookingAhead?: string
 * - unsubscribeUrl?: string
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function YearInReviewEmail({
  year,
  fullName,
  majorStories = [],
  milestones = [],
  mostRead = [],
  lookingAhead = null,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: `December 31, ${year}`, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: `Year in Review: ${year}`, marginTop: 0, marginBottom: 50, fontSize: 20, color: '#fff' })}
  `;
  
  if (majorStories.length > 0) {
    content += EmailSection({ title: `Major Stories of ${year}` });
    const storyItems = majorStories.map(story => ({
      text: `<strong>${story.headline}</strong> — ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  if (milestones.length > 0) {
    content += EmailSection({ title: 'Milestones for Noteworthy News' });
    content += EmailBulletList({ items: milestones });
  }
  
  if (mostRead.length > 0) {
    content += EmailSection({ title: 'Most-Read Articles' });
    const readItems = mostRead.map(article => ({
      text: `<a href="${article.url}" style="color:#3b82f6!important;text-decoration:underline">${article.headline}</a>`
    }));
    content += EmailBulletList({ items: readItems });
  }
  
  if (lookingAhead) {
    content += EmailSection({ title: 'Looking Ahead' });
    content += EmailParagraph({ text: lookingAhead, marginTop: 0, marginBottom: 50 });
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Year in Review',
    unsubscribeUrl 
  });
}

module.exports = YearInReviewEmail;






















