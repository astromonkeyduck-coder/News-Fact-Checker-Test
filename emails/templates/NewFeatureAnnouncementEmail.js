/**
 * NewFeatureAnnouncementEmail
 * 
 * Template for announcing new features or product updates.
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailButton,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function NewFeatureAnnouncementEmail({
  fullName,
  featureName,
  whatIsNew,
  whyItMatters,
  howToUse = [],
  ctaLabel = 'Try It Now',
  ctaUrl,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: `We're excited to share a new feature: ${featureName}`, marginTop: 0, marginBottom: 50, fontSize: 18, color: '#fff' })}
  `;
  
  content += EmailSection({ title: 'What\'s New' });
  content += EmailParagraph({ text: whatIsNew, marginTop: 0, marginBottom: 30 });
  
  content += EmailSection({ title: 'Why It Matters' });
  content += EmailParagraph({ text: whyItMatters, marginTop: 0, marginBottom: 30 });
  
  if (howToUse.length > 0) {
    content += EmailSection({ title: 'How To Use It' });
    content += EmailBulletList({ items: howToUse });
  }
  
  if (ctaUrl) {
    content += EmailButton({ label: ctaLabel, url: ctaUrl, marginTop: 0, marginBottom: 50 });
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'New Feature',
    unsubscribeUrl 
  });
}

module.exports = NewFeatureAnnouncementEmail;




















