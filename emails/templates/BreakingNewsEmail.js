/**
 * BreakingNewsEmail
 * 
 * Template for urgent breaking news stories.
 * Based on the 11/26/25 DC shooting email design.
 * 
 * Props:
 * - headline: string (required) - Main headline
 * - subheadline?: string - Optional subheadline
 * - dateline: string (required) - Date and location (e.g., "Wednesday, November 26, 2025 — Washington, D.C.")
 * - location?: string - Location name
 * - shortSummary: string (required) - 1-3 sentence summary
 * - bodyBlocks: string[] (required) - Array of paragraph text
 * - images?: Array<{src: string, alt: string, graphic?: boolean}> - Optional images
 * - ctaLabel: string (required) - Button label (e.g., "Read Full Story")
 * - ctaUrl: string (required) - Button URL
 * - secondaryLinks?: Array<{label: string, url: string}> - Optional related links
 * - fullName: string (required) - Recipient's full name (for greeting)
 * - unsubscribeUrl?: string - Unsubscribe URL (default: "{{{UNSUBSCRIBE_URL}}}")
 * 
 * Example usage:
 * const html = BreakingNewsEmail({
 *   headline: "Major Earthquake Hits California",
 *   dateline: "Monday, January 15, 2025 — Los Angeles, CA",
 *   shortSummary: "A magnitude 7.2 earthquake struck Southern California early this morning, causing widespread damage and power outages.",
 *   bodyBlocks: [
 *     "The quake occurred at 4:17 AM local time, with its epicenter located 10 miles northeast of Los Angeles.",
 *     "Emergency services are responding to multiple reports of structural damage and injuries."
 *   ],
 *   ctaLabel: "Read Full Story",
 *   ctaUrl: "https://noteworthynews.co/story/earthquake",
 *   fullName: "John Doe"
 * });
 */

const {
  EmailLayout,
  EmailSection,
  EmailAlertTag,
  EmailBulletList,
  EmailImage,
  EmailButton,
  EmailParagraph,
  EmailGraphicWarning,
  EmailClosing,
} = require('../components/EmailLayout');

function BreakingNewsEmail({
  headline,
  subheadline = null,
  dateline,
  location = null,
  shortSummary,
  bodyBlocks = [],
  images = [],
  ctaLabel,
  ctaUrl,
  secondaryLinks = [],
  fullName,
  unsubscribeUrl = '{{{UNSUBSCRIBE_URL}}}',
}) {
  // Format greeting
  const greeting = fullName ? `Hey ${fullName},` : 'Hey,';
  
  // Build content
  let content = `
    ${EmailParagraph({ text: dateline, marginTop: 0, marginBottom: 30, fontSize: 14, color: '#9ca3af' })}
    ${EmailParagraph({ text: greeting, marginTop: 0, marginBottom: 30, fontSize: 16 })}
    ${EmailParagraph({ text: shortSummary, marginTop: 0, marginBottom: 50, fontSize: 16 })}
    ${EmailAlertTag({ label: 'BREAKING', bold: true })}
    ${EmailParagraph({ text: headline, marginTop: 0, marginBottom: 20, fontSize: 18, color: '#fff' })}
  `;
  
  if (subheadline) {
    content += EmailParagraph({ text: subheadline, marginTop: 0, marginBottom: 20 });
  }
  
  // Add body paragraphs
  bodyBlocks.forEach((block, index) => {
    const isLast = index === bodyBlocks.length - 1 && images.length === 0 && secondaryLinks.length === 0;
    content += EmailParagraph({ 
      text: block, 
      marginTop: 0, 
      marginBottom: isLast ? 50 : 20 
    });
  });
  
  // Add images
  images.forEach((img, index) => {
    const isLastImage = index === images.length - 1 && secondaryLinks.length === 0;
    if (img.graphic) {
      content += EmailGraphicWarning({ message: img.warningMessage || 'The image below shows graphic content. Viewer discretion is advised.' });
    }
    content += EmailImage({ 
      src: img.src, 
      alt: img.alt, 
      marginTop: img.graphic ? 10 : 14,
      marginBottom: isLastImage ? 50 : 30 
    });
    if (img.caption) {
      content += EmailParagraph({ 
        text: img.caption, 
        marginTop: 10, 
        marginBottom: isLastImage ? 50 : 30,
        fontSize: 13,
        color: '#9ca3af'
      });
    }
  });
  
  // Add secondary links if provided
  if (secondaryLinks.length > 0) {
    content += EmailSection({ title: 'Related Coverage' });
    const linkItems = secondaryLinks.map(link => ({
      text: `<a href="${link.url}" style="color:#3b82f6!important;text-decoration:underline">${link.label}</a>`
    }));
    content += EmailBulletList({ items: linkItems });
  }
  
  // Add CTA button
  content += EmailButton({ label: ctaLabel, url: ctaUrl, marginTop: 0, marginBottom: 50 });
  
  // Add closing
  content += EmailClosing();
  
  return EmailLayout({ 
    content, 
    headerSubtitle: 'Breaking News',
    unsubscribeUrl 
  });
}

module.exports = BreakingNewsEmail;






















