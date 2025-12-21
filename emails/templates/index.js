/**
 * Email Templates Index
 * 
 * Central export point for all email templates.
 * Import like: const { BreakingNewsEmail } = require('./emails/templates');
 */

module.exports = {
  BreakingNewsEmail: require('./BreakingNewsEmail'),
  DailyBriefingEmail: require('./DailyBriefingEmail'),
  DevelopingStoryEmail: require('./DevelopingStoryEmail'),
  WeeklyRoundupEmail: require('./WeeklyRoundupEmail'),
  SpecialReportEmail: require('./SpecialReportEmail'),
  YearInReviewEmail: require('./YearInReviewEmail'),
  WeatherAlertEmail: require('./WeatherAlertEmail'),
  SecurityAlertEmail: require('./SecurityAlertEmail'),
  SiteMaintenanceEmail: require('./SiteMaintenanceEmail'),
  NewFeatureAnnouncementEmail: require('./NewFeatureAnnouncementEmail'),
  SubscriberWelcomeEmail: require('./SubscriberWelcomeEmail'),
  SubscriberMilestoneEmail: require('./SubscriberMilestoneEmail'),
  CorrectionClarificationEmail: require('./CorrectionClarificationEmail'),
  Holiday_NewYearEmail: require('./Holiday_NewYearEmail'),
  Holiday_ThanksgivingEmail: require('./Holiday_ThanksgivingEmail'),
  Holiday_IndependenceDayEmail: require('./Holiday_IndependenceDayEmail'),
  Holiday_GenericFestiveEmail: require('./Holiday_GenericFestiveEmail'),
};






















