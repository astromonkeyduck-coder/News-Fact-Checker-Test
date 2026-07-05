/**
 * WeeklyRoundupEmail
 * 
 * Template for weekly news roundups.
 * 
 * Props:
 * - weekOf: string (required) - "Week of January 15, 2025"
 * - fullName: string (required)
 * - topStories: Array<{headline, summary, url}> (required)
 * - missedStories?: Array<{headline, summary, url}>
 * - deepDives?: Array<{headline, summary, url}>
 * - communitySection?: {title: string, items: Array<{text, url}>}
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

function WeeklyRoundupEmail({
  weekOf,
  fullName,
  topStories = [],
  missedStories = [],
  deepDives = [],
  communitySection = null,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: weekOf, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: 'Here\'s what happened this week at Noteworthy News.', marginTop: 0, marginBottom: 50, fontSize: 16 })}
  `;
  
  if (topStories.length > 0) {
    content += EmailSection({ title: 'Top Stories' });
    const storyItems = topStories.map(story => ({
      text: `<strong>${story.headline}</strong> - ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  if (missedStories.length > 0) {
    content += EmailSection({ title: 'Stories You Might Have Missed' });
    const storyItems = missedStories.map(story => ({
      text: `<strong>${story.headline}</strong> - ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  if (deepDives.length > 0) {
    content += EmailSection({ title: 'Deep Dives & Explainers' });
    const storyItems = deepDives.map(story => ({
      text: `<strong>${story.headline}</strong> - ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  if (communitySection) {
    content += EmailSection({ title: communitySection.title || 'From Our Community' });
    const communityItems = communitySection.items.map(item => ({
      text: item.url 
        ? `<a href="${item.url}" style="color:#3b82f6!important;text-decoration:underline">${item.text}</a>`
        : item.text
    }));
    content += EmailBulletList({ items: communityItems });
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Weekly Roundup',
    unsubscribeUrl 
  });
}

module.exports = WeeklyRoundupEmail;


























