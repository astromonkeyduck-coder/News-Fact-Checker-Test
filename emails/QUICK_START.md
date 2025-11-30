# Quick Start Guide

## 📦 What Was Created

A complete email template system based on your **11/26/25 DC Shooting** newsletter design.

### Structure
```
emails/
├── components/
│   └── EmailLayout.js          # Base layout + all reusable components
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
│   ├── Holiday_GenericFestiveEmail.js
│   └── index.js                 # Export all templates
└── README.md                    # Full documentation
```

## 🚀 3-Minute Example

### Example 1: Breaking News

```javascript
const BreakingNewsEmail = require('./emails/templates/BreakingNewsEmail');

const html = BreakingNewsEmail({
  headline: "Major Policy Announcement",
  dateline: "Monday, January 15, 2025 — Washington, D.C.",
  shortSummary: "The White House announced new climate policy measures today.",
  bodyBlocks: [
    "The announcement came after months of deliberation.",
    "The policy will take effect in Q2 2025."
  ],
  ctaLabel: "Read Full Story",
  ctaUrl: "https://noteworthynews.co/story/policy",
  fullName: "John Doe"
});

// Use in your email service
await resend.emails.send({
  from: 'richard@noteworthynews.co',
  to: 'john@example.com',
  subject: 'BREAKING: Major Policy Announcement',
  html: html.replace('{{FULL_NAME}}', 'John Doe')
});
```

### Example 2: Daily Briefing

```javascript
const DailyBriefingEmail = require('./emails/templates/DailyBriefingEmail');

const html = DailyBriefingEmail({
  date: "Monday, January 15, 2025",
  fullName: "Jane Smith",
  topStory: {
    headline: "Top Story Headline",
    summary: "Summary of the top story",
    imageUrl: "https://noteworthynews.co/image.jpg",
    imageAlt: "Story image",
    url: "https://noteworthynews.co/story"
  },
  stories: [
    {
      headline: "Story 1",
      summary: "Summary 1",
      url: "https://noteworthynews.co/story1"
    },
    {
      headline: "Story 2",
      summary: "Summary 2",
      url: "https://noteworthynews.co/story2"
    }
  ]
});
```

### Example 3: Holiday Email

```javascript
const Holiday_NewYearEmail = require('./emails/templates/Holiday_NewYearEmail');

const html = Holiday_NewYearEmail({
  year: 2025,
  fullName: "John Doe",
  reflection: "2024 was a year of significant global events.",
  keyStories: [
    {
      headline: "Major Story 1",
      summary: "Summary",
      url: "https://noteworthynews.co/story1"
    }
  ],
  milestones: ["Reached 10,000 subscribers"]
});
```

## 🔗 Integration with Existing Code

You can integrate these templates into your existing `netlify/functions/send-newsletter.js`:

```javascript
// At the top of send-newsletter.js
const BreakingNewsEmail = require('../../emails/templates/BreakingNewsEmail');

// In your handler, instead of getNewsletterHTMLWithPosts:
const html = BreakingNewsEmail({
  headline: newsletterData.headline,
  dateline: newsletterData.dateline,
  shortSummary: newsletterData.summary,
  bodyBlocks: newsletterData.bodyBlocks,
  ctaLabel: "Read Full Story",
  ctaUrl: newsletterData.articleUrl,
  fullName: '{{FULL_NAME}}',
  unsubscribeUrl: '{{{UNSUBSCRIBE_URL}}}'
});
```

## ✅ Next Steps

1. **Test a template**: Pick one template, generate HTML, and test in an email client
2. **Customize if needed**: Edit `emails/components/EmailLayout.js` for design changes
3. **Integrate**: Add template usage to your email sending functions
4. **Iterate**: Create new templates by copying existing ones and modifying

## 📚 Full Documentation

See `emails/README.md` for complete documentation of all templates and props.




