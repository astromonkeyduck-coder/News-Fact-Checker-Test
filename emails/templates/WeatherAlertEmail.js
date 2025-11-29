/**
 * WeatherAlertEmail
 * 
 * Template for weather alerts and urgent public safety information.
 * 
 * Props:
 * - alertType: string (required) - "WEATHER ALERT", "SEVERE WEATHER", etc.
 * - location: string (required)
 * - dateline: string (required)
 * - fullName: string (required)
 * - whatHappened: string (required)
 * - whoAffected: string (required)
 * - whatToDo: string[] (required) - Array of action items
 * - officialSources: Array<{name: string, url: string}>
 * - unsubscribeUrl?: string
 */

const {
  EmailLayout,
  EmailSection,
  EmailAlertTag,
  EmailBulletList,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function WeatherAlertEmail({
  alertType = 'WEATHER ALERT',
  location,
  dateline,
  fullName,
  whatHappened,
  whoAffected,
  whatToDo = [],
  officialSources = [],
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: dateline, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailAlertTag({ label: alertType, bold: true })}
    ${EmailParagraph({ text: location, marginTop: 0, marginBottom: 30, fontSize: 18, color: '#fff' })}
  `;
  
  content += EmailSection({ title: 'What Happened' });
  content += EmailParagraph({ text: whatHappened, marginTop: 0, marginBottom: 30 });
  
  content += EmailSection({ title: 'Who Is Affected' });
  content += EmailParagraph({ text: whoAffected, marginTop: 0, marginBottom: 30 });
  
  if (whatToDo.length > 0) {
    content += EmailSection({ title: 'What To Do Now' });
    content += EmailBulletList({ items: whatToDo });
  }
  
  if (officialSources.length > 0) {
    content += EmailSection({ title: 'Key Official Sources' });
    const sourceItems = officialSources.map(source => ({
      text: `<a href="${source.url}" style="color:#3b82f6!important;text-decoration:underline">${source.name}</a>`
    }));
    content += EmailBulletList({ items: sourceItems });
  }
  
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Public Safety Alert',
    unsubscribeUrl 
  });
}

module.exports = WeatherAlertEmail;


