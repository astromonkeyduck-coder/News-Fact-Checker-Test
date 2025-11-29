# Noteworthy News Email Template System

A comprehensive, reusable email template library based on the design system from the **11/26/25 DC Shooting** newsletter email.

## 📁 Folder Structure

```
emails/
├── components/
│   └── EmailLayout.js          # Base layout and reusable components
├── templates/
│   ├── BreakingNewsEmail.js
│   ├── DailyBriefingEmail.js
│   ├── DevelopingStoryEmail.js
│   ├── WeeklyRoundupEmail.js
│   ├── SpecialReportEmail.js
│   ├── YearInReviewEmail.js
│   ├── WeatherAlertEmail.js
│   ├── SecurityAlertEmail.js
│   ├── SiteMaintenanceEmail.js
│   ├── NewFeatureAnnouncementEmail.js
│   ├── SubscriberWelcomeEmail.js
│   ├── SubscriberMilestoneEmail.js
│   ├── CorrectionClarificationEmail.js
│   ├── Holiday_NewYearEmail.js
│   ├── Holiday_ThanksgivingEmail.js
│   ├── Holiday_IndependenceDayEmail.js
│   └── Holiday_GenericFestiveEmail.js
└── README.md                    # This file
```

## 🎨 Design System

All templates are based on the **11/26/25 DC Shooting** email design:

- **Dark Theme**: Background `#0b1020`, card `#141b2b`, header `#050814`
- **Typography**: System fonts, white text `#f9fafb`, muted gray `#9ca3af`
- **Accent Color**: Blue `#3b82f6` for section headers and stars
- **Layout**: Table-based HTML email (email-safe)
- **Spacing**: Generous padding (40px, 50px), consistent margins
- **Components**: Header with logo, footer with unsubscribe, blue star bullets

## 🚀 Quick Start

### Using a Template

```javascript
const BreakingNewsEmail = require('./emails/templates/BreakingNewsEmail');

const html = BreakingNewsEmail({
  headline: "Major Earthquake Hits California",
  dateline: "Monday, January 15, 2025 — Los Angeles, CA",
  shortSummary: "A magnitude 7.2 earthquake struck Southern California early this morning.",
  bodyBlocks: [
    "The quake occurred at 4:17 AM local time.",
    "Emergency services are responding to multiple reports."
  ],
  ctaLabel: "Read Full Story",
  ctaUrl: "https://noteworthynews.co/story/earthquake",
  fullName: "John Doe"
});

// Use in your email sending function
await resend.emails.send({
  from: 'richard@noteworthynews.co',
  to: email,
  subject: 'BREAKING: Major Earthquake Hits California',
  html: html
});
```

## 📋 Available Templates

### 1. BreakingNewsEmail
**Purpose**: Urgent breaking news stories

**Required Props**:
- `headline` (string)
- `dateline` (string)
- `shortSummary` (string)
- `bodyBlocks` (string[])
- `ctaLabel` (string)
- `ctaUrl` (string)
- `fullName` (string)

**Optional Props**:
- `subheadline` (string)
- `location` (string)
- `images` (Array)
- `secondaryLinks` (Array)

---

### 2. DailyBriefingEmail
**Purpose**: Daily news briefings with multiple stories

**Required Props**:
- `date` (string)
- `fullName` (string)
- `topStory` (Object: {headline, summary, url, imageUrl?, imageAlt?})
- `stories` (Array: {headline, summary, url})

**Optional Props**:
- `contextSection` (Object)
- `factCheck` (Object)

---

### 3. DevelopingStoryEmail
**Purpose**: Ongoing/developing stories

**Required Props**:
- `headline` (string)
- `dateline` (string)
- `fullName` (string)
- `summary` (string)
- `ctaUrl` (string)

**Optional Props**:
- `timeline` (Array)
- `unknownItems` (string[])
- `ctaLabel` (string, default: "Follow Live Updates")

---

### 4. WeeklyRoundupEmail
**Purpose**: Weekly news roundups

**Required Props**:
- `weekOf` (string)
- `fullName` (string)
- `topStories` (Array)

**Optional Props**:
- `missedStories` (Array)
- `deepDives` (Array)
- `communitySection` (Object)

---

### 5. SpecialReportEmail
**Purpose**: Long-form investigations and special reports

**Required Props**:
- `headline` (string)
- `dateline` (string)
- `fullName` (string)
- `abstract` (string)
- `sections` (Array: {title, content: string[]})
- `ctaUrl` (string)

---

### 6. YearInReviewEmail
**Purpose**: Year-end reviews

**Required Props**:
- `year` (number)
- `fullName` (string)
- `majorStories` (Array)
- `milestones` (Array)

**Optional Props**:
- `mostRead` (Array)
- `lookingAhead` (string)

---

### 7. WeatherAlertEmail
**Purpose**: Weather alerts and public safety

**Required Props**:
- `location` (string)
- `dateline` (string)
- `fullName` (string)
- `whatHappened` (string)
- `whoAffected` (string)
- `whatToDo` (string[])

**Optional Props**:
- `alertType` (string, default: "WEATHER ALERT")
- `officialSources` (Array)

---

### 8. SecurityAlertEmail
**Purpose**: Security alerts (similar to WeatherAlertEmail)

**Same props as WeatherAlertEmail**, but `alertType` defaults to "SECURITY ALERT"

---

### 9. SiteMaintenanceEmail
**Purpose**: Site maintenance notifications

**Required Props**:
- `fullName` (string)
- `reason` (string)
- `startTime` (string)
- `endTime` (string)

**Optional Props**:
- `alternativeWays` (string[])

---

### 10. NewFeatureAnnouncementEmail
**Purpose**: Product/feature announcements

**Required Props**:
- `fullName` (string)
- `featureName` (string)
- `whatIsNew` (string)
- `whyItMatters` (string)
- `ctaUrl` (string)

**Optional Props**:
- `howToUse` (string[])
- `ctaLabel` (string, default: "Try It Now")

---

### 11. SubscriberWelcomeEmail
**Purpose**: Welcome new subscribers

**Required Props**:
- `fullName` (string)

**Optional Props**:
- `whatToExpect` (string[], has defaults)
- `bestLinks` (Array)

---

### 12. SubscriberMilestoneEmail
**Purpose**: Celebrate subscriber milestones

**Required Props**:
- `fullName` (string)
- `milestone` (string)
- `impact` (string)

**Optional Props**:
- `stories` (Array)

---

### 13. CorrectionClarificationEmail
**Purpose**: Corrections and clarifications

**Required Props**:
- `originalHeadline` (string)
- `dateline` (string)
- `fullName` (string)
- `correctionStatement` (string)
- `correctInformation` (string)
- `correctedArticleUrl` (string)

**Optional Props**:
- `explanation` (string)

---

### 14. Holiday_NewYearEmail
**Purpose**: New Year's greetings

**Required Props**:
- `year` (number)
- `fullName` (string)

**Optional Props**:
- `reflection` (string)
- `lookingAhead` (string)
- `keyStories` (Array)
- `milestones` (Array)
- `ctaLabel` (string)
- `ctaUrl` (string)

---

### 15. Holiday_ThanksgivingEmail
**Purpose**: Thanksgiving greetings

**Required Props**:
- `year` (number)
- `fullName` (string)

**Optional Props**:
- `reflection` (string)
- `keyStories` (Array)

---

### 16. Holiday_IndependenceDayEmail
**Purpose**: Independence Day greetings

**Required Props**:
- `year` (number)
- `fullName` (string)

**Optional Props**:
- `reflection` (string)
- `keyStories` (Array)

---

### 17. Holiday_GenericFestiveEmail
**Purpose**: Flexible holiday celebrations

**Required Props**:
- `holidayName` (string)
- `date` (string)
- `fullName` (string)

**Optional Props**:
- `greeting` (string)
- `reflection` (string)
- `keyStories` (Array)

## 🧩 Reusable Components

All templates use shared components from `EmailLayout.js`:

- `EmailLayout` - Base layout wrapper
- `EmailHeader` - Header with logo and subtitle
- `EmailFooter` - Footer with logo and unsubscribe
- `EmailSection` - Section header
- `EmailAlertTag` - Alert badges (BREAKING, UPDATE, etc.)
- `EmailBulletList` - Bullet lists with blue stars
- `EmailImage` - Images with consistent styling
- `EmailButton` - CTA buttons
- `EmailParagraph` - Standard paragraphs
- `EmailGraphicWarning` - Warning boxes for graphic content
- `EmailClosing` - Standard closing signature

## 📝 Example: Complete Usage

```javascript
// In your Netlify function or email service
const BreakingNewsEmail = require('./emails/templates/BreakingNewsEmail');

exports.handler = async (event) => {
  const emailData = JSON.parse(event.body);
  
  const html = BreakingNewsEmail({
    headline: emailData.headline,
    dateline: emailData.dateline,
    shortSummary: emailData.summary,
    bodyBlocks: emailData.bodyBlocks,
    images: emailData.images || [],
    ctaLabel: "Read Full Story",
    ctaUrl: emailData.articleUrl,
    fullName: emailData.recipientName,
    unsubscribeUrl: emailData.unsubscribeUrl
  });
  
  // Replace placeholders
  const personalizedHtml = html
    .replace(/\{\{FULL_NAME\}\}/g, emailData.recipientName)
    .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, emailData.unsubscribeUrl);
  
  await resend.emails.send({
    from: 'richard@noteworthynews.co',
    to: emailData.email,
    subject: `BREAKING: ${emailData.headline}`,
    html: personalizedHtml
  });
};
```

## 🎯 Design Principles

1. **Consistency**: All templates share the same base design system
2. **Mobile-First**: Responsive, readable on all devices
3. **Email-Safe**: Table-based HTML, inline styles, no external CSS
4. **Accessible**: Proper alt text, semantic HTML
5. **Professional**: Clean, scannable, not cluttered

## 🔧 Customization

To customize the design system, edit `emails/components/EmailLayout.js`:

- Colors: Update CSS variables in the `<style>` tag
- Fonts: Change `font-family` in body style
- Spacing: Adjust padding/margin values in components
- Logo: Update image URLs in `EmailHeader` and `EmailFooter`

## 📚 Integration with Existing System

These templates are designed to work with your existing `send-newsletter.js` function. You can:

1. Import a template
2. Generate HTML with your data
3. Pass it to the existing send function

Example:
```javascript
const DailyBriefingEmail = require('./emails/templates/DailyBriefingEmail');

// In getNewsletterHTMLWithPosts or similar
const html = DailyBriefingEmail({
  date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  fullName: '{{FULL_NAME}}',
  topStory: { /* ... */ },
  stories: [ /* ... */ ]
});
```

## ✅ Testing

Test each template by:

1. Calling the template function with sample data
2. Saving the HTML output to a file
3. Opening in an email client or Litmus/Email on Acid
4. Testing on mobile devices

## 📄 License

Part of the Noteworthy News project.


