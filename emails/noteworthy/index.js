/**
 * Noteworthy News email system — public API.
 *
 * Each template exports:
 *   default        (props) => full HTML document
 *   .subject       (props) => subject line
 *   .preheader     (props) => inbox preview text
 *   .text          (props) => hand-written plain-text twin
 *
 * Used by:
 *   netlify/functions/send-email.js               (welcome on signup)
 *   netlify/functions/noteworthy-email-previews.js (local preview bench)
 */

module.exports = {
  NewsletterVerifyEmail: require('./NewsletterVerifyEmail'),
  NewsletterWelcomeEmail: require('./NewsletterWelcomeEmail'),
  WeeklyBriefEmail: require('./WeeklyBriefEmail'),
  BreakingNewsWelcomeEmail: require('./BreakingNewsWelcomeEmail'),
  sampleData: require('./sampleData'),
  theme: require('./theme'),
};
