/**
 * Deterministic consumer-facing filter for historical openFDA backfills only.
 *
 * The live FDA RSS/canonical pipeline uses scopeFilter alone. This module
 * adds a second gate so bulk industrial ingredients, B2B components, and
 * dietary/herbal supplements are not enqueued during historical imports.
 *
 * Returns { include: boolean, reason: string, category: 'consumer'|'supplement'|'industrial'|null }
 */

'use strict';

// Fortified foods / ingredient lists — vitamin/mineral mentions alone are not supplements.
const FORTIFIED_FOOD_RE = /\b(fortified|enriched|contains vitamins?|added vitamins?|vitamin [a-dk]\b.*\b(milk|cereal|bread|flour|rice|juice|water|oat|grain))\b/i;

const SUPPLEMENT_PATTERNS = [
  { reason: 'herbal_supplement', re: /\bherbal supplement(s)?\b/i },
  { reason: 'supplement_capsules', re: /\b(dietary )?supplement (capsules?|tablets?|softgels?|gummies|powder)\b/i },
  { reason: 'supplement_capsules', re: /\b(capsules?|softgels?|gummies|tablets?)\b.*\b(supplement|nutraceutical)\b/i },
  { reason: 'moringa_capsules', re: /\bmoringa (leaf )?(capsules?|tablets?|softgels?|supplement)\b/i },
  { reason: 'vitamin_supplement', re: /\b(multivitamin|vitamin supplement|vitamin (capsules?|softgels?|gummies|tablets?)|gummy vitamins?)\b/i },
  { reason: 'superfood_supplement', re: /\b(green[- ]superfood|superfood supplement|greens? supplement)\b/i },
  { reason: 'nutraceutical', re: /\bnutraceutical(s)?\b/i },
  { reason: 'supplement_marketing', re: /\b(weight[- ]loss|pre-?workout|male enhancement|detox cleanse)\b.*\b(supplement|capsules?|softgels?|gummies)\b/i },
  { reason: 'supplement_marketing', re: /\b(supplement|capsules?|softgels?|gummies)\b.*\b(weight[- ]loss|pre-?workout|male enhancement)\b/i },
];

// Bulk / B2B packaging and supply-chain signals.
const BULK_WEIGHT_LB_RE = /\b(1[0-9]|[2-9]\d|\d{3,})\s*[- ]?(lb|lbs|pound|pounds)\b/i;
const BULK_WEIGHT_KG_RE = /\b(1[0-9]|[2-9]\d|\d{3,})\s*[- ]?(kg|kilogram|kilograms)\b/i;
const BULK_CONTAINER_RE = /\b(tote(s)?|drum(s)?|pallet(s)?|bulk sack(s)?|supersack(s)?|ibc tote(s)?|gaylord(s)?)\b/i;
const COMMON_BULK_SIZES_RE = /\b(25|50)\s*[- ]?(lb|lbs|kg|kilogram)\b/i;

const INDUSTRIAL_INGREDIENT_RE = /\b(seasoning blend|seasoning mix|flavor compound|flavoring compound|food ingredient|raw material|premix|concentrate base|milk powder|dried milk powder|whey powder|protein powder base|spice blend)\b/i;
const MANUFACTURING_USE_RE = /\b(for (further )?processing|for manufacturers?|for food processors?|ingredient only|not for retail|commercial use only|institutional use|food service only|supplied to manufacturers?|distributed to manufacturers?|sold to (food )?manufacturers?)\b/i;

// Strong retail / consumer rescue signals.
const RETAIL_BRAND_RE = /\b(good & gather|good and gather|utz|wawa|trader joe'?s?|market of choice|kroger|safeway|publix|whole foods|aldi|costco|sam'?s club|target|walmart|heb\b|wegmans|publix|cheerios|kraft|nestl[eé]|general mills|kellogg'?s?)\b/i;
const RETAIL_PRODUCT_RE = /\b(trail mix|potato chips|tortilla chips|corn chips|iced tea|bottled tea|prepared salad|salad kit|ice cream|frozen yogurt|frozen dinner|frozen meal|snack mix|granola bars?|breakfast cereal|rice\b(?! powder)|flour\b(?! for industrial)|petite rice|jasmine rice|basmati rice)\b/i;
const RETAIL_PACKAGE_RE = /\b(\d+(\.\d+)?\s*(oz|fl\.? oz|ounce|ounces|ml|milliliter|liter|litre|count|ct\.?|pack|pk\.?))\b/i;
const CONSUMER_DISTRIBUTION_RE = /\b(retail stores?|grocery stores?|supermarkets?|consumers?|sold directly to consumers?|sold at retail|point of purchase|deli counter|restaurant locations?|quick service restaurants?|convenience stores?)\b/i;
const RESTAURANT_PREPARED_RE = /\b(prepared (food|salad|meal|sandwich|entree)|deli (salad|item)|ready[- ]to[- ]eat|sold at (wawa|taco bell|subway|mcdonald|chipotle|starbucks))\b/i;

function buildHaystack(record) {
  const r = record || {};
  return [
    r.productDescription,
    r.reasonForRecall,
    r.distributionPattern,
    r.codeInfo,
    r.recallingFirm,
  ].filter(Boolean).join('\n');
}

function isSupplementProduct(text) {
  if (FORTIFIED_FOOD_RE.test(text)) return false;
  for (const { re } of SUPPLEMENT_PATTERNS) {
    if (re.test(text)) return true;
  }
  return false;
}

function hasBulkIndustrialPackaging(text) {
  if (BULK_CONTAINER_RE.test(text)) return true;
  if (COMMON_BULK_SIZES_RE.test(text)) return true;
  if (BULK_WEIGHT_LB_RE.test(text)) return true;
  if (BULK_WEIGHT_KG_RE.test(text)) return true;
  return false;
}

function hasIndustrialSupplyContext(text) {
  if (MANUFACTURING_USE_RE.test(text)) return true;
  if (INDUSTRIAL_INGREDIENT_RE.test(text) && hasBulkIndustrialPackaging(text)) return true;
  if (INDUSTRIAL_INGREDIENT_RE.test(text) && /\b(bag(s)?|sack(s)?|drum|tote)\b/i.test(text)) return true;
  return false;
}

function hasRetailConsumerRescue(text) {
  if (RETAIL_BRAND_RE.test(text)) return true;
  if (RETAIL_PRODUCT_RE.test(text) && (RETAIL_PACKAGE_RE.test(text) || CONSUMER_DISTRIBUTION_RE.test(text))) {
    return true;
  }
  if (RESTAURANT_PREPARED_RE.test(text) && CONSUMER_DISTRIBUTION_RE.test(text)) return true;
  if (RETAIL_PRODUCT_RE.test(text) && !hasBulkIndustrialPackaging(text)) return true;
  if (CONSUMER_DISTRIBUTION_RE.test(text) && RETAIL_PACKAGE_RE.test(text) && !INDUSTRIAL_INGREDIENT_RE.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {object} record normalized openFDA enforcement record
 * @returns {{ include: boolean, reason: string, category: string|null }}
 */
function consumerFacingFilter(record) {
  const text = buildHaystack(record);

  if (isSupplementProduct(text)) {
    return { include: false, reason: 'excluded_supplement', category: 'supplement' };
  }

  const industrialPackaging = hasBulkIndustrialPackaging(text);
  const industrialSupply = hasIndustrialSupplyContext(text);

  if (industrialPackaging || industrialSupply) {
    if (hasRetailConsumerRescue(text)) {
      return { include: true, reason: 'consumer_retail_override', category: 'consumer' };
    }
    if (industrialPackaging && INDUSTRIAL_INGREDIENT_RE.test(text)) {
      return { include: false, reason: 'excluded_industrial:bulk_ingredient', category: 'industrial' };
    }
    if (industrialPackaging) {
      return { include: false, reason: 'excluded_industrial:bulk_packaging', category: 'industrial' };
    }
    return { include: false, reason: 'excluded_industrial:manufacturing_use', category: 'industrial' };
  }

  return { include: true, reason: 'consumer_facing', category: 'consumer' };
}

module.exports = {
  consumerFacingFilter,
  buildHaystack,
  // Exported for unit tests only.
  isSupplementProduct,
  hasBulkIndustrialPackaging,
  hasRetailConsumerRescue,
};
