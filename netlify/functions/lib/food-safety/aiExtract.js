/**
 * AI extraction fallback (strictly flag-gated by FDA_AI_EXTRACTION_ENABLED).
 *
 * Used only when deterministic extraction cannot confidently interpret
 * unstructured prose. Every AI-extracted field carries evidence and is
 * post-validated deterministically; AI can never override a deterministic
 * validated value without review.
 */

const { config } = require('./config');
const { extractStateList } = require('./states');
const { parseCountToken } = require('./normalize');

const EXTRACTOR_VERSION = 'fda-ai-extract-1.0.0';

const JSON_SCHEMA = {
  name: 'food_safety_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['fields'],
    properties: {
      fields: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'value', 'evidence', 'confidence'],
          properties: {
            name: {
              type: 'string',
              enum: [
                'company', 'brands', 'product_name', 'hazard_name',
                'illnesses', 'hospitalizations', 'deaths',
                'case_states', 'distribution_states', 'public_action',
                'retailers', 'lot_codes', 'upcs',
              ],
            },
            value: { type: ['string', 'number', 'array', 'null'], items: { type: 'string' } },
            evidence: { type: 'string' },
            section: { type: ['string', 'null'] },
            confidence: { type: 'number' },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = [
  'You extract structured facts from official FDA food-safety text.',
  'Rules:',
  '- Only extract values explicitly stated in the provided text.',
  '- Never infer, estimate, or invent values.',
  '- Never convert absent numbers to zero; omit the field instead.',
  '- Never extract states from company mailing addresses.',
  '- Every field must include a short verbatim evidence excerpt from the text.',
  '- If nothing is explicitly stated for a field, do not include that field.',
].join('\n');

/**
 * Run AI extraction on ambiguous prose. Returns { fields, meta } or null
 * when disabled/unavailable. Each field: { name, value, evidence, section,
 * confidence, deterministicValidation }.
 */
async function aiExtractFields(text, { sourceUrl, sourceSection = null, logger = console } = {}) {
  if (!config.aiExtractionEnabled) return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn && logger.warn('[food-safety ai] FDA_AI_EXTRACTION_ENABLED but OPENAI_API_KEY missing');
    return null;
  }

  const trimmed = String(text || '').slice(0, 24000);
  if (!trimmed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.FDA_AI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Source: ${sourceUrl}\nSection: ${sourceSection || 'full text'}\n\n${trimmed}` },
        ],
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    logger.warn && logger.warn(`[food-safety ai] OpenAI HTTP ${response.status}`);
    return null;
  }

  let parsed;
  try {
    const data = await response.json();
    parsed = JSON.parse(data.choices[0].message.content);
  } catch (e) {
    logger.warn && logger.warn(`[food-safety ai] unparseable AI output: ${e.message}`);
    return null;
  }

  const fields = [];
  for (const field of parsed.fields || []) {
    const validated = validateAiField(field, trimmed);
    if (!validated) continue; // reject output lacking evidence or failing validation
    fields.push({
      ...validated,
      sourceUrl,
      section: field.section || sourceSection || null,
      extractorVersion: EXTRACTOR_VERSION,
    });
  }

  return {
    fields,
    meta: {
      extractorVersion: EXTRACTOR_VERSION,
      fieldCount: fields.length,
      rejectedCount: (parsed.fields || []).length - fields.length,
    },
  };
}

/**
 * Deterministic post-validation of an AI-extracted field.
 * - Evidence must actually appear in the source text.
 * - Numbers must round-trip.
 * - States must normalize through the state dictionary.
 * Returns the cleaned field or null (reject).
 */
function validateAiField(field, sourceText) {
  if (!field || !field.name) return null;
  const evidence = String(field.evidence || '').trim();
  if (evidence.length < 4) return null;
  // Evidence must be findable in the source (whitespace-normalized)
  const normText = sourceText.replace(/\s+/g, ' ').toLowerCase();
  const normEvidence = evidence.replace(/\s+/g, ' ').toLowerCase().slice(0, 160);
  const evidenceFound = normText.includes(normEvidence);
  if (!evidenceFound) return null;

  const confidence = typeof field.confidence === 'number'
    ? Math.max(0, Math.min(1, field.confidence)) : 0;

  let value = field.value;
  let deterministicValidation = true;

  if (['illnesses', 'hospitalizations', 'deaths'].includes(field.name)) {
    const n = parseCountToken(value);
    if (n === null) return null;
    // The number must literally appear in the evidence
    if (!new RegExp(`\\b${n.toLocaleString('en-US')}\\b|\\b${n}\\b`).test(evidence)) return null;
    value = n;
  }

  if (['case_states', 'distribution_states'].includes(field.name)) {
    const list = Array.isArray(value) ? value.join(', ') : String(value || '');
    const { states, confident } = extractStateList(list);
    if (!confident || states.length === 0) return null;
    value = states;
    deterministicValidation = confident;
  }

  if (['brands', 'retailers', 'lot_codes', 'upcs'].includes(field.name)) {
    if (!Array.isArray(value)) value = value ? [String(value)] : [];
    value = value.map((v) => String(v).trim()).filter(Boolean).slice(0, 20);
    if (value.length === 0) return null;
  }

  return {
    name: field.name,
    value,
    evidence: evidence.slice(0, 240),
    confidence,
    deterministicValidation,
  };
}

module.exports = { aiExtractFields, validateAiField, EXTRACTOR_VERSION, JSON_SCHEMA };
