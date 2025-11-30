/**
 * SiteMaintenanceEmail
 * 
 * Template for site maintenance and downtime notifications.
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function SiteMaintenanceEmail({
  fullName,
  reason,
  startTime,
  endTime,
  alternativeWays = [],
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: 'We wanted to let you know about scheduled maintenance on Noteworthy News.', marginTop: 0, marginBottom: 50, fontSize: 16 })}
  `;
  
  content += EmailSection({ title: 'Why' });
  content += EmailParagraph({ text: reason, marginTop: 0, marginBottom: 30 });
  
  content += EmailSection({ title: 'When' });
  content += EmailParagraph({ 
    text: `Maintenance will begin: ${startTime}<br />Expected completion: ${endTime}`, 
    marginTop: 0, 
    marginBottom: 30 
  });
  
  if (alternativeWays.length > 0) {
    content += EmailSection({ title: 'Alternative Ways to Stay Updated' });
    content += EmailBulletList({ items: alternativeWays });
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Site Maintenance',
    unsubscribeUrl 
  });
}

module.exports = SiteMaintenanceEmail;




