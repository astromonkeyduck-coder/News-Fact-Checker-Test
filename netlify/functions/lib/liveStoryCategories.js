/**
 * Live story category helpers.
 *
 * Category "X" marks rows auto-created when a new X post is ingested so iOS
 * push-to-start Live Activities can register tokens. Those rows must never
 * appear in the public "Developing Now" discovery surfaces — only stories
 * created manually in /admin ▸ Live Stories should.
 */

const AUTO_X_POST_CATEGORY = "X";

/** Apply to a Supabase query builder for live_stories list reads. */
function excludeAutoXPostStories(query) {
  return query.or(`category.is.null,category.neq.${AUTO_X_POST_CATEGORY}`);
}

module.exports = {
  AUTO_X_POST_CATEGORY,
  excludeAutoXPostStories,
};
