/**
 * SubscriberMilestoneEmail
 * 
 * Template for celebrating subscriber milestones.
 */

const {
  EmailLayout,
  EmailSection,
  EmailBulletList,
  EmailParagraph,
  EmailClosing,
} = require('../components/EmailLayout');

function SubscriberMilestoneEmail({
  fullName,
  milestone,
  impact,
  stories = [],
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  let content = `
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: `We just hit ${milestone}!`, marginTop: 0, marginBottom: 50, fontSize: 18, color: '#fff' })}
  `;
  
  if (impact) {
    content += EmailParagraph({ text: impact, marginTop: 0, marginBottom: 30 });
  }
  
  if (stories.length > 0) {
    content += EmailSection({ title: 'Recent Impact' });
    const storyItems = stories.map(story => ({
      text: `<strong>${story.headline}</strong> — ${story.summary} <a href="${story.url}" style="color:#3b82f6!important;text-decoration:underline">Read more</a>`
    }));
    content += EmailBulletList({ items: storyItems });
  }
  
  content += EmailParagraph({ 
    text: 'Thank you for being part of our community and helping us reach this milestone.', 
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
    headerSubtitle: 'Milestone',
    unsubscribeUrl 
  });
}

module.exports = SubscriberMilestoneEmail;

























