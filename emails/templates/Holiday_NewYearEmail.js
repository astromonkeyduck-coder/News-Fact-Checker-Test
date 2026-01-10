/**
 * Holiday_NewYearEmail
 * 
 * Template for New Year's greetings with a news/reflection angle.
 * Maintains professional tone while being slightly warmer.
 * Based on the 11/26/25 DC shooting email design.
 * 
 * Props:
 * - year: number (required) - The year being celebrated (e.g., 2025)
 * - fullName: string (required) - Recipient's full name
 * - reflection?: string - Optional reflection on the past year
 * - lookingAhead?: string - Optional forward-looking message
 * - keyStories?: Array<Object> - {
 *     headline: string,
 *     summary: string,
 *     url: string
 *   }
 * - milestones?: Array<string> - List of Noteworthy News milestones
 * - ctaLabel?: string - CTA button label (default: "Catch up on the year's biggest stories")
 * - ctaUrl?: string - CTA button URL
 * - unsubscribeUrl?: string
 * 
 * Example usage:
 * const html = Holiday_NewYearEmail({
 *   year: 2025,
 *   fullName: "John Doe",
 *   reflection: "2024 was a year of significant global events and important journalism.",
 *   lookingAhead: "We're committed to bringing you fact-checked news in 2025.",
 *   keyStories: [
 *     { headline: "Top Story 1", summary: "Summary", url: "https://..." }
 *   ],
 *   milestones: ["Reached 10,000 subscribers", "Published 500 fact-checks"]
 * });
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function Holiday_NewYearEmail({
  year,
  fullName,
  reflection = null,
  lookingAhead = null,
  keyStories = [],
  milestones = [],
  ctaLabel = "Catch up on the year's biggest stories",
  ctaUrl = 'https://noteworthynews.co/year-in-review',
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  const previousYear = year - 1;
  
  let content = `
    ${EmailParagraph({ text: `January 1, ${year}`, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: `Happy New Year from Noteworthy News!`, marginTop: 0, marginBottom: 50, fontSize: 18, color: '#fff' })}
  `;
  
  // Reflection
  if (reflection) {
    content += EmailParagraph({ 
      text: reflection, 
      marginTop: 0, 
      marginBottom: 30 
    });
  } else {
    content += EmailParagraph({ 
      text: `${previousYear} was a year of significant global events, and we're grateful you trusted us to bring you fact-checked, reliable news coverage.`, 
      marginTop: 0, 
      marginBottom: 30 
    });
  }
  
  // Key Stories
  if (keyStories.length > 0) {
    content += EmailSection({ title: `Major Stories of ${previousYear}` });
    const storyItems = keyStories.map(story => ({
      text: `<strong>${story.headline}</strong> — ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  // Milestones
  if (milestones.length > 0) {
    content += EmailSection({ title: `Milestones for Noteworthy News` });
    content += EmailBulletList({ items: milestones });
  }
  
  // Looking Ahead
  if (lookingAhead) {
    content += EmailSection({ title: 'Looking Ahead' });
    content += EmailParagraph({ 
      text: lookingAhead, 
      marginTop: 0, 
      marginBottom: 50 
    });
  } else {
    content += EmailSection({ title: 'Looking Ahead' });
    content += EmailParagraph({ 
      text: `As we enter ${year}, we're committed to continuing our mission of providing accurate, fact-checked journalism and helping you stay informed about the stories that matter most.`, 
      marginTop: 0, 
      marginBottom: 50 
    });
  }
  
  // CTA
  content += EmailButton({ 
    label: ctaLabel, 
    url: ctaUrl, 
    marginTop: 0, 
    marginBottom: 50 
  });
  
  // Closing
  content += EmailParagraph({ 
    text: 'Thank you for being part of the Noteworthy News community. We wish you a safe and informed new year.', 
    marginTop: 0, 
    marginBottom: 20 
  });
  content += EmailParagraph({ 
    text: 'Stay informed,', 
    marginTop: 0, 
    marginBottom: 0 
  });
  content += EmailParagraph({ 
    text: 'The Noteworthy News Team', 
    marginTop: 0, 
    marginBottom: 0 
  });
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'New Year Greetings',
    unsubscribeUrl 
  });
}

module.exports = Holiday_NewYearEmail;


























