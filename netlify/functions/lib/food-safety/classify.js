/**
 * Scope filtering, hazard classification, and editorial labeling for
 * FDA food-safety candidates.
 *
 * All classification is deterministic and based only on official source text.
 */

// The nine official U.S. major food allergens (FASTER Act). Do NOT extend.
const MAJOR_ALLERGENS = [
  'milk', 'egg', 'fish', 'crustacean shellfish', 'tree nuts',
  'peanuts', 'wheat', 'soybeans', 'sesame',
];

const ALLERGEN_PATTERNS = [
  { allergen: 'milk', re: /\bmilk\b|\bdairy\b|\bcasein(ate)?\b|\bwhey\b|\blactose\b/i },
  { allergen: 'egg', re: /\begg(s)?\b|\balbumen\b/i },
  { allergen: 'fish', re: /\bfish\b|\banchov(y|ies)\b|\bcod\b|\bsalmon\b(?=.*undeclared)|\btilapia\b/i },
  { allergen: 'crustacean shellfish', re: /\bcrustacean\b|\bshellfish\b|\bshrimp\b|\bcrab\b|\blobster\b|\bcrawfish\b/i },
  { allergen: 'tree nuts', re: /\btree ?nut(s)?\b|\balmond(s)?\b|\bcashew(s)?\b|\bwalnut(s)?\b|\bpecan(s)?\b|\bpistachio(s)?\b|\bhazelnut(s)?\b|\bmacadamia\b|\bcoconut\b(?=.*undeclared)/i },
  { allergen: 'peanuts', re: /\bpeanut(s)?\b/i },
  { allergen: 'wheat', re: /\bwheat\b|\bgluten\b(?=.*undeclared)/i },
  { allergen: 'soybeans', re: /\bsoy(bean)?(s)?\b|\bsoya\b/i },
  { allergen: 'sesame', re: /\bsesame\b|\btahini\b/i },
];

const PATHOGEN_PATTERNS = [
  { name: 'Salmonella', re: /\bsalmonell(a|osis)\b/i },
  { name: 'Listeria monocytogenes', re: /\blisteria( monocytogenes)?\b|\blisteriosis\b/i },
  { name: 'E. coli', re: /\be\.? ?coli\b|\bstec\b|\bo1[0-9]{2}(:h\d+)?\b|\bescherichia\b/i },
  { name: 'Cyclospora', re: /\bcyclospor(a|iasis)\b/i },
  { name: 'Norovirus', re: /\bnorovirus\b/i },
  { name: 'Clostridium botulinum', re: /\bbotulism\b|\bclostridium botulinum\b|\bbotulinum\b/i },
  { name: 'Cronobacter', re: /\bcronobacter\b/i },
  { name: 'Hepatitis A', re: /\bhepatitis a\b/i },
  { name: 'Vibrio', re: /\bvibrio\b/i },
  { name: 'Campylobacter', re: /\bcampylobacter\b/i },
  { name: 'Shigella', re: /\bshigell(a|osis)\b/i },
  { name: 'Bacillus cereus', re: /\bbacillus cereus\b/i },
  { name: 'Clostridium perfringens', re: /\bclostridium perfringens\b/i },
  { name: 'Staphylococcus aureus', re: /\bstaphylococc(us|al)\b/i },
];

const SEROTYPE_RE = /\b(O\d{2,3}(?::?H\d{1,2})?|Typhimurium|Enteritidis|Newport|Infantis|Thompson|Oranienburg|Braenderup|Javiana|Saintpaul|Muenchen|Montevideo|Senftenberg|Mbandaka|Virchow|Hartford|Anatum|Stanley)\b/;

// Animal-only products: must never be admitted because productType is generic "Food".
const VETERINARY_OR_PET_FOOD_RE = /\b(pet food|dog food|cat food|wet dog food|wet cat food|puppy food|kitten food|animal food|animal feed|livestock feed|pet treats?|dog treats?|cat treats?|veterinary\b|for dogs\b|for cats\b|for pets\b|(dog|cat|pet)\s+(kibble|formula|snack|nutrition|wet food))\b/i;

// Non-food FDA material that must be excluded even from the general feeds.
const EXCLUDE_PATTERNS = [
  { reason: 'drug', re: /\b(tablets?|capsules?|injection|injectable|prescription|rx only|otc drug|drug products?|api\b|mg\b.*(tablet|capsule)|sildenafil|tadalafil|losartan|metformin|valsartan|eye ?drops?|nasal spray|hand sanitizer)\b/i },
  { reason: 'medical_device', re: /\b(medical device|catheter|defibrillator|infusion pump|pacemaker|ventilator|syringe|implant|glucose meter|test strips)\b/i },
  { reason: 'biologic', re: /\b(vaccine|blood products?|plasma-derived|biologics?)\b/i },
  { reason: 'cosmetic', re: /\b(cosmetics?|shampoo|lotion|mascara|eyeliner|skin cream|sunscreen|tattoo ink)\b/i },
  { reason: 'tobacco', re: /\b(tobacco|e-?cigarettes?|vap(e|ing)|nicotine)\b/i },
  { reason: 'veterinary_or_pet_food', re: VETERINARY_OR_PET_FOOD_RE },
  { reason: 'dietary_supplement', re: /\b(dietary supplements?|weight[- ]loss (pills?|capsules?|supplements?)|male enhancement|kratom|pre-?workout)\b/i },
];

/** Hard excludes are never overridden by generic openFDA productType="Food". */
const HARD_EXCLUDE_REASONS = new Set(['veterinary_or_pet_food']);

function isGenericFoodProductType(productType) {
  const pt = String(productType || '').trim().toLowerCase();
  return pt === 'food' || pt === 'foods';
}

function isSpecificHumanFoodProductType(productType) {
  if (!productType || isGenericFoodProductType(productType)) return false;
  return /food|beverage|allergen/i.test(productType);
}

function productTypeOverridesExclusion(reason, productType) {
  if (HARD_EXCLUDE_REASONS.has(reason)) return false;
  return isSpecificHumanFoodProductType(productType);
}

function matchesVeterinaryOrPetFood(text) {
  if (!text) return false;
  // Human-food phrases that contain animal words but are not pet products.
  if (/\bhot dogs?\b/i.test(text) && !/\b(pet food|dog food|wet dog food|dog treats?|for dogs)\b/i.test(text)) {
    return false;
  }
  if (/\bcorn dogs?\b/i.test(text) && !/\b(pet food|dog food|dog treats?|for dogs)\b/i.test(text)) {
    return false;
  }
  if (/\bcatfish\b/i.test(text) && !/\b(pet food|cat food|cat treats?|for cats)\b/i.test(text)) {
    return false;
  }
  return VETERINARY_OR_PET_FOOD_RE.test(text);
}

// Signals that this is an actionable consumer food-safety item.
const FOOD_SAFETY_INCLUDE_RE = new RegExp([
  'recall', 'outbreak', 'safety alert', 'public health alert', 'advisory',
  'undeclared', 'contaminat', 'salmonell', 'listeria', 'e\\.? ?coli',
  'cyclospor', 'norovirus', 'botulism', 'cronobacter', 'hepatitis a',
  'vibrio', 'campylobacter', 'shigell', 'bacillus cereus',
  'allergy alert', 'allergen', 'foreign material', 'foodborne',
  'do not eat', 'do not consume', 'infant formula',
].join('|'), 'i');

// Informational / administrative FDA material to skip.
const NON_ACTIONABLE_RE = /\b(annual report|advisory committee|meeting|workshop|webinar|guidance for industry|warning letters?|import alert(?!.*consumer)|constituent update|proposed rule|comment period)\b/i;

/**
 * Scope filter: decide whether an FDA item belongs in the food-safety
 * pipeline. Returns { include: boolean, reason: string }.
 */
function scopeFilter({ title = '', description = '', productType = '', url = '' }) {
  const haystack = [title, description, productType].filter(Boolean).join('\n');

  // Product-type metadata from the recall table / canonical page is the
  // strongest signal when present.
  if (productType) {
    const pt = productType.toLowerCase();
    if (/(drug|device|biologic|cosmetic|tobacco|animal|veterinary)/.test(pt)
        && !/food|beverage/.test(pt)) {
      return { include: false, reason: `excluded_product_type:${pt.slice(0, 40)}` };
    }
    if (/dietary supplement/.test(pt) && !/food|beverage/.test(pt)) {
      return { include: false, reason: 'excluded_product_type:dietary_supplement' };
    }
  }

  for (const { reason, re } of EXCLUDE_PATTERNS) {
    const matched = reason === 'veterinary_or_pet_food'
      ? matchesVeterinaryOrPetFood(haystack)
      : re.test(haystack);
    if (matched) {
      // Specific human food product types (e.g. "Food & Beverages") can override
      // weak text matches such as "milk" in a cosmetic false positive — but generic
      // openFDA productType="Food" must never override pet/animal exclusions.
      if (productTypeOverridesExclusion(reason, productType)) continue;
      return { include: false, reason: `excluded:${reason}` };
    }
  }

  if (NON_ACTIONABLE_RE.test(title)) {
    return { include: false, reason: 'non_actionable_informational' };
  }

  if (!FOOD_SAFETY_INCLUDE_RE.test(haystack)) {
    return { include: false, reason: 'no_food_safety_signal' };
  }

  return { include: true, reason: 'food_safety_signal' };
}

/**
 * Classify hazard from official text.
 * Returns { hazardCategory, hazardName, organism, serotype, allergens }.
 */
function classifyHazard(text) {
  const result = {
    hazardCategory: null,
    hazardName: null,
    organism: null,
    serotype: null,
    allergens: [],
  };
  if (!text) return result;

  for (const { name, re } of PATHOGEN_PATTERNS) {
    if (re.test(text)) {
      result.hazardCategory = 'pathogen';
      result.organism = name;
      result.hazardName = name;
      const sero = text.match(SEROTYPE_RE);
      if (sero) {
        result.serotype = sero[1];
        result.hazardName = `${name} ${sero[1]}`;
      }
      break;
    }
  }

  // Allergens: match ONLY inside the hazard phrases ("undeclared X",
  // "may contain X", "allergy to X"), never the whole text — otherwise a
  // declared ingredient in the product NAME ("Black Sesame Filling") would
  // be misread as the hazard.
  const allergenWindows = [];
  for (const m of text.matchAll(/\bundeclared\s+([^.;\n]{2,80})/gi)) allergenWindows.push(m[1]);
  for (const m of text.matchAll(/\bmay contain\s+(?:undeclared\s+)?([^.;\n]{2,80})/gi)) allergenWindows.push(m[1]);
  for (const m of text.matchAll(/\ballerg(?:y|ies|ic)\s+(?:or severe sensitivity\s+)?to\s+([^.;\n]{2,80})/gi)) allergenWindows.push(m[1]);
  if (allergenWindows.length > 0) {
    const windowText = allergenWindows.join('\n');
    for (const { allergen, re } of ALLERGEN_PATTERNS) {
      if (re.test(windowText)) result.allergens.push(allergen);
    }
    if (result.allergens.length > 0 && !result.hazardCategory) {
      result.hazardCategory = 'allergen';
      result.hazardName = `Undeclared ${formatAllergenList(result.allergens)}`;
    }
  }

  if (!result.hazardCategory) {
    if (/\b(foreign material|plastic|metal|glass|wood|rock|rubber) (pieces?|fragments?|material)?\b/i.test(text)
        || /\bmay contain (pieces of )?(plastic|metal|glass|wood)\b/i.test(text)) {
      result.hazardCategory = 'foreign_material';
      const m = text.match(/\b(plastic|metal|glass|wood|rock|rubber)\b/i);
      result.hazardName = m ? `Foreign material (${m[1].toLowerCase()})` : 'Foreign material';
    } else if (/\b(lead|cadmium|arsenic|mercury|chromium|pesticide|chemical contaminat|elevated levels? of)\b/i.test(text)) {
      result.hazardCategory = 'chemical';
      const m = text.match(/\b(lead|cadmium|arsenic|mercury|chromium)\b/i);
      result.hazardName = m ? `Chemical contamination (${m[1].toLowerCase()})` : 'Chemical contamination';
    } else if (/\b(toxin|aflatoxin|histamine|scombroid|patulin|mycotoxin)\b/i.test(text)) {
      result.hazardCategory = 'toxin';
      result.hazardName = 'Toxin';
    } else if (/\bmisbrand|mislabel|labeling error\b/i.test(text)) {
      result.hazardCategory = 'labeling';
      result.hazardName = 'Labeling error';
    }
  }

  return result;
}

function formatAllergenList(allergens) {
  if (!allergens || allergens.length === 0) return '';
  const caps = allergens.map((a) => a);
  if (caps.length === 1) return caps[0];
  if (caps.length === 2) return `${caps[0]} and ${caps[1]}`;
  return `${caps.slice(0, -1).join(', ')}, and ${caps[caps.length - 1]}`;
}

/**
 * Determine the event kind from source signals.
 */
function classifyEventKind({ sourceKind = '', title = '', text = '', hazard = null }) {
  const t = `${title}\n${text}`;
  if (sourceKind === 'fda_core' || sourceKind === 'fda_rss_outbreak'
      || /\boutbreak\b|\binvestigation of\b/i.test(title)) {
    if (/\brecall\b/i.test(title) && !/\boutbreak\b/i.test(title)) return 'recall';
    return 'outbreak';
  }
  if (/\brecall/i.test(t)) {
    if (hazard && hazard.hazardCategory === 'allergen') return 'allergen_alert';
    return 'recall';
  }
  if (hazard && hazard.hazardCategory === 'allergen') return 'allergen_alert';
  if (/\bsafety alert|advisory|do not (eat|consume|use)\b/i.test(t)) return 'safety_alert';
  return 'recall';
}

/**
 * Build a clear consumer-facing display title from validated fields.
 * Never copies bureaucratic FDA headlines.
 */
function buildDisplayTitle(event) {
  const product = shortProductName(event.product_name || event.product_description);
  const brand = event.brands && event.brands.length ? event.brands[0] : null;
  const company = event.company || null;
  const hazard = event.hazard_name || null;
  const organism = event.organism || null;
  const isUpdate = (event.update_number || 0) > 0;
  const expanded = event.status === 'expanded';

  if (event.event_kind === 'outbreak') {
    const source = product || null;
    if (organism && source) {
      return `${organism} outbreak linked to ${lc(source)}`;
    }
    if (organism) {
      return `FDA investigates ${organism} outbreak; food source not yet identified`;
    }
    if (source) return `Foodborne illness outbreak linked to ${lc(source)}`;
    return 'FDA investigates foodborne illness outbreak';
  }

  if (event.event_kind === 'allergen_alert'
      || (event.hazard_category === 'allergen' && event.allergens && event.allergens.length)) {
    const who = brand || company;
    const allergenText = formatAllergenList(event.allergens || []);
    if (expanded && who && product) {
      return `${who} expands recall of ${lc(product)} over undeclared ${allergenText}`;
    }
    if (who && product) return `${who} recalls ${lc(product)} over undeclared ${allergenText}`;
    if (product) return `${sentenceCase(product)} recalled over undeclared ${allergenText}`;
    return `Food recalled over undeclared ${allergenText}`;
  }

  // Standard recall / safety alert
  if (expanded && (company || brand) && product) {
    return `${company || brand} expands recall of ${lc(product)}`;
  }
  if (product && hazard && event.hazard_category === 'pathogen') {
    return `${sentenceCase(product)} recalled over possible ${hazard} contamination`;
  }
  if (product && hazard) {
    return `${sentenceCase(product)} recalled over ${lc(hazard)}`;
  }
  if (product) return `${sentenceCase(product)} recalled${isUpdate ? ' (update)' : ''}`;
  if (company) return `${company} recalls product over safety concern`;
  return event.title || 'FDA food safety alert';
}

function shortProductName(name) {
  if (!name) return null;
  let n = String(name).trim();
  // Trim to something card-safe
  if (n.length > 80) n = `${n.slice(0, 77).trim()}…`;
  return n;
}

function lc(s) {
  if (!s) return s;
  // Lowercase leading article-cap only when the string is not an acronym/brand-like token
  if (/^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+ [A-Z]/.test(s)) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  return s;
}

function sentenceCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Derive the compact public action string from official recommendation text.
 * Only returns an action supported by FDA wording.
 */
function derivePublicAction(text) {
  if (!text) return null;
  if (/\bdo not (eat|consume|drink|serve|sell)\b/i.test(text)) return 'Do not eat';
  if (/\b(throw (it |them )?(away|out)|discard|dispose of)\b/i.test(text) && /\breturn\b/i.test(text)) {
    return 'Return or discard';
  }
  if (/\breturn (it |them )?(to the (place|store|point) of purchase)?\b/i.test(text) && /\brefund\b/i.test(text)) {
    return 'Return for a refund';
  }
  if (/\b(throw (it |them )?(away|out)|discard|dispose of)\b/i.test(text)) return 'Discard the product';
  if (/\bcheck (your )?(freezer|refrigerator|fridge|pantry)\b/i.test(text)) return 'Check your freezer';
  if (/\b(check|verify) (the )?(upc|lot|date code|use.by|best.by)\b/i.test(text)) return 'Check the UPC and lot';
  if (/\bcontact (your )?(health ?care|doctor|physician)\b/i.test(text)) return 'Seek care if symptomatic';
  if (/\bshould not (be )?(consumed|eaten|used)\b/i.test(text)) return 'Do not eat';
  return null;
}

module.exports = {
  MAJOR_ALLERGENS,
  scopeFilter,
  matchesVeterinaryOrPetFood,
  classifyHazard,
  classifyEventKind,
  buildDisplayTitle,
  derivePublicAction,
  formatAllergenList,
};
