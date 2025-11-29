/**
 * SubscriberWelcomeEmail
 * 
 * Template for welcoming new subscribers.
 * 
 * Props:
 * - fullName: string (required)
 * - whatToExpect: string[] - Array of what they'll receive
 * - bestLinks?: Array<{label: string, url: string}>
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

function SubscriberWelcomeEmail({
  fullName,
  whatToExpect = [
    'Weekly fact-checked news stories',
    'Media literacy tips and insights',
    'Updates about our interactive fact-checking games',
    'Critical thinking resources',
  ],
  bestLinks = [],
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: 'Thank you for subscribing to Noteworthy News! We\'re thrilled to have you join our community of fact-checkers and critical thinkers.', marginTop: 0, marginBottom: 50, fontSize: 16 })}
  `;
  
  content += EmailSection({ title: 'What You\'ll Receive' });
  content += EmailBulletList({ items: whatToExpect });
  
  if (bestLinks.length > 0) {
    content += EmailSection({ title: 'Best Links to Start With' });
    const linkItems = bestLinks.map(link => ({
      text: `<a href="${link.url}" style="color:#3b82f6!important;text-decoration:underline">${link.label}</a>`
    }));
    content += EmailBulletList({ items: linkItems });
  } else {
    content += EmailParagraph({ 
      text: 'Stay informed and stay curious!', 
      marginTop: 30, 
      marginBottom: 50,
      fontSize: 16
    });
  }
  
  content += EmailParagraph({ 
    text: 'Thank you for being part of the Noteworthy News community.', 
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
    headerSubtitle: 'Welcome',
    unsubscribeUrl 
  });
}

module.exports = SubscriberWelcomeEmail;


