/**
 * Holiday_GenericFestiveEmail
 * 
 * Template for culturally flexible holiday celebrations.
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function Holiday_GenericFestiveEmail({
  holidayName,
  date,
  fullName,
  greeting = null,
  reflection = null,
  keyStories = [],
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const nameGreeting = fullName ? `Hey ${fullName},` : 'Hey,';
  const holidayGreeting = greeting || `Happy ${holidayName} from Noteworthy News!`;
  
  let content = `
    ${EmailParagraph({ text: date, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: nameGreeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: holidayGreeting, marginTop: 0, marginBottom: 50, fontSize: 18, color: '#fff' })}
  `;
  
  if (reflection) {
    content += EmailParagraph({ text: reflection, marginTop: 0, marginBottom: 30 });
  }
  
  if (keyStories.length > 0) {
    content += EmailSection({ title: 'Recent Stories' });
    const storyItems = keyStories.map(story => ({
      text: `<strong>${story.headline}</strong> — ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  content += EmailParagraph({ 
    text: 'Thank you for being part of our community. We wish you a safe and informed celebration.', 
    marginTop: 30, 
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
    headerSubtitle: holidayName,
    unsubscribeUrl 
  });
}

module.exports = Holiday_GenericFestiveEmail;












