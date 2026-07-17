/**
 * Deterministic, explainable Noteworthy editorial severity (1–5) for
 * food-safety events. This is NOT the FDA recall classification, which is
 * stored separately in fda_recall_classification.
 *
 * Returns { severity, reasons } so the calculation is auditable.
 */

function computeSeverity(event) {
  const reasons = [];
  let severity = 1;

  const deaths = numeric(event.deaths);
  const hosp = numeric(event.hospitalizations);
  const illnesses = numeric(event.illnesses);
  const classI = /class i\b/i.test(event.fda_recall_classification || '');
  const nationwide = event.geographic_scope === 'nationwide';
  const multistate = event.geographic_scope === 'multistate'
    || (Array.isArray(event.case_states) && event.case_states.length > 1);
  const hasAction = Boolean(event.public_action);
  const isOutbreak = event.event_kind === 'outbreak';
  const infantFood = /\binfant formula|baby food|infant\b/i.test(
    [event.product_name, event.product_description, event.title].filter(Boolean).join(' '),
  );
  const botulism = /botulism|botulinum/i.test(event.hazard_name || event.organism || '');
  const majorAllergen = event.hazard_category === 'allergen'
    && Array.isArray(event.allergens) && event.allergens.length > 0;
  const seriousPathogen = event.hazard_category === 'pathogen';
  const ended = event.status === 'ended' || event.status === 'terminated';
  const expanded = event.status === 'expanded';

  // Severity 5
  if (deaths !== null && deaths > 0) {
    severity = 5;
    reasons.push(`deaths_reported:${deaths}`);
  } else if (botulism) {
    severity = 5;
    reasons.push('botulism_or_equivalent_acute_hazard');
  } else if (infantFood && (seriousPathogen || /cronobacter/i.test(event.organism || ''))) {
    severity = 5;
    reasons.push('life_threatening_infant_food_hazard');
  } else if (classI && nationwide && hasAction && seriousPathogen) {
    severity = 5;
    reasons.push('major_nationwide_class_i_with_action');
  } else if (illnesses !== null && illnesses >= 1000 && hosp !== null && hosp > 0) {
    severity = 5;
    reasons.push(`exceptionally_large_outbreak:${illnesses}_ill_${hosp}_hospitalized`);
  }

  // Severity 4
  if (severity < 4) {
    if (isOutbreak && multistate && illnesses !== null && illnesses > 0) {
      severity = 4;
      reasons.push('confirmed_multistate_outbreak');
    }
    if (hosp !== null && hosp > 0) {
      severity = 4;
      reasons.push(`hospitalizations_reported:${hosp}`);
    }
    if (expanded && severity < 4) {
      severity = 4;
      reasons.push('active_recall_expansion');
    }
    if (majorAllergen && hasAction && (nationwide || multistate)) {
      severity = 4;
      reasons.push('major_allergen_broad_distribution_with_action');
    }
    if (seriousPathogen && nationwide && severity < 4) {
      severity = 4;
      reasons.push('serious_pathogen_broad_distribution');
    }
  }

  // Severity 3
  if (severity < 3) {
    if (event.event_kind === 'recall' && hasAction) {
      severity = 3;
      reasons.push('actionable_consumer_recall');
    }
    if (seriousPathogen) {
      severity = 3;
      reasons.push('foodborne_contamination_hazard');
    }
    if (majorAllergen) {
      severity = 3;
      reasons.push('undeclared_major_allergen');
    }
    if (event.hazard_category === 'foreign_material' || event.hazard_category === 'chemical'
        || event.hazard_category === 'toxin') {
      severity = Math.max(severity, 3);
      reasons.push(`significant_${event.hazard_category}_hazard`);
    }
  }

  // Severity 2 floor cases
  if (severity < 2) {
    if (event.event_kind === 'safety_alert' || event.event_kind === 'allergen_alert') {
      severity = 2;
      reasons.push('lower_urgency_safety_item');
    }
  }

  // Ended/terminated updates without new risk cap at 2
  if (ended && severity > 2) {
    severity = 2;
    reasons.push('ended_or_terminated_no_new_risk_cap');
  }

  if (reasons.length === 0) reasons.push('monitoring_only_baseline');

  return { severity, reasons };
}

function numeric(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

module.exports = { computeSeverity };
