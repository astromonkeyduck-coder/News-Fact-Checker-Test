/**
 * DailyBriefingEmail
 * 
 * Template for daily news briefings with multiple stories.
 * Based on the 11/26/25 DC shooting email design.
 * 
 * Props:
 * - date: string (required) - Date string (e.g., "Monday, January 15, 2025")
 * - fullName: string (required) - Recipient's full name
 * - topStory: Object (required) - {
 *     headline: string,
 *     summary: string,
 *     imageUrl?: string,
 *     imageAlt?: string,
 *     url: string
 *   }
 * - stories: Array<Object> (required, 3-6 items) - {
 *     headline: string,
 *     summary: string,
 *     url: string
 *   }
 * - contextSection?: Object - {
 *     title: string,
 *     items: string[]
 *   }
 * - factCheck?: Object - {
 *     title: string,
 *     claim: string,
 *     verdict: string,
 *     explanation: string,
 *     url?: string
 *   }
 * - unsubscribeUrl?: string
 * 
 * Example usage:
 * const html = DailyBriefingEmail({
 *   date: "Monday, January 15, 2025",
 *   fullName: "John Doe",
 *   topStory: {
 *     headline: "Major Policy Announcement Expected Today",
 *     summary: "The White House is expected to announce new climate policy measures this afternoon.",
 *     imageUrl: "https://noteworthynews.co/image.jpg",
 *     imageAlt: "White House",
 *     url: "https://noteworthynews.co/story"
 *   },
 *   stories: [
 *     { headline: "Story 1", summary: "Summary 1", url: "https://..." },
 *     { headline: "Story 2", summary: "Summary 2", url: "https://..." }
 *   ]
 * });
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailImage,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function DailyBriefingEmail({
  date,
  fullName,
  topStory,
  stories = [],
  contextSection = null,
  factCheck = null,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: date, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: 'Here\'s what you need to know today.', marginTop: 0, marginBottom: 50, fontSize: 16 })}
  `;
  
  // Top Story
  content += EmailSection({ title: 'Top Story' });
  content += EmailParagraph({ 
    text: topStory.headline, 
    marginTop: 0, 
    marginBottom: 20, 
    fontSize: 18,
    color: '#fff'
  });
  content += EmailParagraph({ 
    text: topStory.summary, 
    marginTop: 0, 
    marginBottom: topStory.imageUrl ? 20 : 30
  });
  
  if (topStory.imageUrl) {
    content += EmailImage({ 
      src: topStory.imageUrl, 
      alt: topStory.imageAlt || topStory.headline,
      marginTop: 0,
      marginBottom: 30
    });
  }
  
  content += EmailButton({ 
    label: 'Read Full Story', 
    url: topStory.url, 
    marginTop: 0, 
    marginBottom: 50 
  });
  
  // Other Stories
  if (stories.length > 0) {
    content += EmailSection({ title: 'Today\'s Headlines' });
    const storyItems = stories.map(story => ({
      text: `<strong>${story.headline}</strong> — ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  // Context Section
  if (contextSection) {
    content += EmailSection({ 
      title: contextSection.title || 'Context & Explainers',
      subtitle: null
    });
    content += EmailBulletList({ items: contextSection.items });
  }
  
  // Fact Check Section
  if (factCheck) {
    content += EmailSection({ title: 'Today\'s Fact-Check' });
    content += EmailParagraph({ 
      text: `<strong>Claim:</strong> ${factCheck.claim}`, 
      marginTop: 0, 
      marginBottom: 15 
    });
    content += EmailParagraph({ 
      text: `<strong>Verdict:</strong> ${factCheck.verdict}`, 
      marginTop: 0, 
      marginBottom: 15,
      color: '#3b82f6'
    });
    content += EmailParagraph({ 
      text: factCheck.explanation, 
      marginTop: 0, 
      marginBottom: factCheck.url ? 20 : 50
    });
    if (factCheck.url) {
      content += EmailButton({ 
        label: 'Read Full Fact-Check', 
        url: factCheck.url, 
        marginTop: 0, 
        marginBottom: 50 
      });
    }
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Daily Briefing',
    unsubscribeUrl 
  });
}

module.exports = DailyBriefingEmail;


