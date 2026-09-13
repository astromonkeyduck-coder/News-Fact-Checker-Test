(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteworthyContent = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const version = 'waterline-files-1.0.0';
  const verdicts = ['supported', 'misleading', 'false', 'insufficient'];
  const label = 'Original fictional case material · Educational simulation';
  const review = { status: 'pending-human-review', reviewer: null, reviewedAt: null };
  const provenance = { kind: 'original-fictional-simulation', creator: 'Noteworthy Games', label, sourceUrl: null };
  const clone = value => JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  const metadata = (id, title, skills, difficulty) => ({ id, version: 1, contentVersion: version, title, skillTags: skills, difficulty, provenance: clone(provenance), editorialReview: clone(review) });
  const document = (id, title, body, featureId, kind = 'simulated-document', time = null) => ({ id, title, body, featureId, kind, time, provenance: clone(provenance) });
  const world = {
    id: 'merehaven', name: 'Merehaven estuary', fictional: true,
    description: 'An invented estuary used to investigate water, harmless tracer and the limits of evidence. No scene is a real emergency.',
    coordinateSystem: { kind: 'local-cartesian', units: 'm', xDirection: 'east', yDirection: 'north', extent: [0, 0, 1200, 800], georeference: null },
    atlasRelationship: 'This local simulation has no Earth latitude/longitude. Atlas Expedition uses a separate real-world country dataset.',
    features: [
      { id: 'north-works', label: 'North Works', x: 325, y: 675 },
      { id: 'old-town', label: 'Old Town', x: 525, y: 375 },
      { id: 'reed-marsh', label: 'Reed Marsh', x: 775, y: 225 },
      { id: 'east-wharf', label: 'East Wharf', x: 1025, y: 375 },
      { id: 'south-outfall', label: 'South Outfall', x: 775, y: 25 },
    ],
  };
  const chapters = [
    { id: 'chapter-1', title: 'The first account', dek: 'Separate a convincing picture from a tested explanation.', missionIds: ['map-everyone-shared', 'missing-connection'] },
    { id: 'chapter-2', title: 'The hidden assumptions', dek: 'Choose the measurement that can change your mind.', missionIds: ['perfect-match', 'fix-moved-problem'] },
    { id: 'chapter-3', title: 'The public record', dek: 'Reconstruct timing, compare tradeoffs, and publish only what the evidence supports.', missionIds: ['out-of-time', 'waterline-briefing'] },
  ];
  const mission = {
    ...metadata('map-everyone-shared', 'The map everyone shared', ['source-context', 'spatial-reasoning', 'controlled-experiments', 'uncertainty'], 'guided'),
    chapterId: 'chapter-1', estimatedMinutes: [15, 25], dek: 'A cluster is visible. Its cause is still a question.',
    briefing: 'A simulated community graphic puts Old Town inside a ring around North Works and declares that the development explains the water. The ring measures proximity, not drainage. Examine the saved sensor record, compute a useful spatial relationship, and change one physical input at a time. Your task is to distinguish a mechanism that the model supports from a cause that the evidence uniquely establishes.',
    claim: 'The new surface at North Works is the only explanation for water accumulating in Old Town.',
    context: { place: 'Merehaven estuary', time: 'A fixed simulated storm; the experiment clock is seconds from its start.', scope: 'A fictional causal claim, not a real flood report.', label },
    scenarioId: 'blocked-drain', comparisonScenarioIds: ['baseline-storm', 'sealed-works'],
    observationBinding: { referenceScenarioId: 'blocked-drain', kind: 'synthetic-observation', initialFeatureIds: ['old-town'], initialTimes: [3600], heldOutFeatureIds: ['north-works', 'east-wharf'], heldOutTimes: [2400], variables: ['depth'], depthToleranceM: 0.001, duration: 3600, modelVersion: 'waterline-fv-1', sourceImmutable: true, status: 'awaiting-derived-bundle' },
    hypotheses: [
      { id: 'surface-explanation', label: 'Reduced permeability at North Works increases the water reaching Old Town.', parameter: 'permeabilityMmHr' },
      { id: 'drain-explanation', label: 'Restricted drainage lets water remain in the Old Town basin.', parameter: 'drainageM3s' },
      { id: 'not-unique', label: 'The initial measurements may fit more than one explanation.', parameter: null },
    ],
    documents: [
      document('m1-shared-graphic', 'The graphic in circulation', 'SIMULATED GRAPHIC TRANSCRIPT. A 400 m circle is centered on North Works. Its caption reads: “Inside the ring: the development did it.” The graphic contains no terrain, pipe directions, sensor times or controlled comparison. Reproducing its circle can test the spatial statement without accepting its causal caption.', 'north-works', 'simulated-graphic'),
      document('m1-observation-register', 'The field record', 'SIMULATED SENSOR REGISTER. The initial packet contains one final Old Town depth reading at 3,600 seconds, with a reading tolerance of ±0.001 m. Earlier depths and tracer readings are not part of this packet. Its value does not change when you edit an experiment. You may request one separate depth reading at 2,400 seconds from North Works or East Wharf; choose the location whose competing predictions differ.', 'old-town', 'observation-register'),
      document('m1-network-note', 'Two routes for an explanation', 'SIMULATED FIELD NOTE. North Works changes the surface where rain enters the model. Old Town has a basin and an outlet whose drainage capacity can also be changed. These are different mechanisms. The map names locations; network and terrain tools calculate how those locations connect. No cause has been established by this note.', 'old-town', 'simulated-field-note'),
      document('m1-experiment-protocol', 'Keep the storm fixed', 'SIMULATED EXPERIMENT PROTOCOL. Save a reference run. Change permeability OR drainage, preserve the same rainfall, tracer release, terrain and simulation duration, then compare the Old Town graph. A changed result shows sensitivity to the changed input within this model. To choose between historical explanations, compare the predictions with the immutable readings, including a useful held-out location.', 'old-town', 'experiment-protocol'),
    ],
    guidedSteps: [
      { id: 'orient', title: 'Find the claim’s footprint', instruction: 'Inspect North Works and Old Town. Draw a 400 m buffer around North Works or measure the distance between the two features. Pin the computed result and say what it measures.', requiredKind: 'analysis' },
      { id: 'read', title: 'Read one real game measurement', instruction: 'Open the saved final Old Town depth reading. Check 3,600 seconds, metres and the ±0.001 m tolerance. It is synthetic, but its value comes from the physical model. Experiment graphs are predictions; they are not additional observed history.', requiredKind: 'observation' },
      { id: 'compare', title: 'Make a counterfactual', instruction: 'Save the starting run, vary permeability or drainage, and keep the storm and clock the same. Pin the comparison with both input sets and an actual probe graph.', requiredKind: 'experiment-comparison' },
      { id: 'choose', title: 'Spend one observation wisely', instruction: 'Inspect the alternative predictions. Choose a North Works or East Wharf held-out reading where the predictions differ, or state that your current evidence is insufficient to separate them.', requiredKind: 'measurement-choice' },
      { id: 'brief', title: 'File a bounded conclusion', instruction: 'Choose no more than three documentary or generated evidence records. Include a spatial result, a controlled comparison, and the uncertainty that your briefing must retain.', requiredKind: 'briefing' },
    ],
    measurementChoices: [
      { id: 'm1-measure-works', label: 'Reveal North Works depth at 2,400 seconds', probeId: 'north-works', explanation: 'Tests what the competing configurations predict nearer the changed surface. Its usefulness must be checked against those predictions.' },
      { id: 'm1-measure-wharf', label: 'Reveal East Wharf depth at 2,400 seconds', probeId: 'east-wharf', explanation: 'Tests a separate location. A reading that the models predict equally well does not discriminate between them.' },
      { id: 'm1-withhold-measurement', label: 'Keep the stronger cause unresolved', probeId: null, explanation: 'A valid stopping point if the evidence does not identify a unique explanation. The briefing must say which additional measurement would help.' },
    ],
    conclusions: [
      { id: 'm1-drain-supported', label: 'The drainage explanation fits the selected measurements better; the ring alone proves nothing.', conditions: [{ type: 'observation-fit', betterScenarioId: 'blocked-drain', thanScenarioId: 'sealed-works', requireHeldOut: true, heldOutProbeId: 'north-works', variable: 'depth', tolerance: 0.001 }, { type: 'controlled-experiment', parameter: 'drainageM3s' }] },
      { id: 'm1-mechanism-not-unique', label: 'The model shows a possible mechanism, but this selection of evidence does not establish one unique cause.', conditions: [{ type: 'controlled-experiment', anyParameter: ['permeabilityMmHr', 'drainageM3s'] }, { type: 'acknowledge-nonidentifiability' }] },
      { id: 'm1-proximity-proves-cause', label: 'Old Town is near North Works, so the development is proven to be the only cause.', conditions: [{ type: 'invalid-causal-inference' }] },
      { id: 'm1-model-is-proof', label: 'One matching graph establishes exactly what happened and rules out every omitted factor.', conditions: [{ type: 'invalid-model-certainty' }] },
    ],
    uncertaintyChoices: [
      { id: 'm1-model-limits', label: 'This simplified synthetic world omits real ground, drainage and measurement uncertainties.', correct: true },
      { id: 'm1-proximity-limit', label: 'A buffer measures proximity; it is neither a flow connection nor a flood boundary.', correct: true },
      { id: 'm1-unique-from-one', label: 'A match at one gauge guarantees a uniquely correct explanation.', correct: false },
      { id: 'm1-hidden-measurement', label: 'A second observation is useful only if the competing predictions differ there.', correct: true },
    ],
    interpretations: [
      { id: 'sensitivity-only', label: 'The controlled change reveals a response within this model; it does not by itself identify a unique historical cause.' },
      { id: 'heldout-discriminates', label: 'A withheld reading favors one modeled explanation beyond the stated reading tolerance.' },
      { id: 'proximity-is-causation', label: 'A nearby location and a matching image establish the cause without testing alternatives.' },
    ],
    rubric: {
      weights: { conclusion: 40, spatial: 20, experiment: 20, uncertainty: 20 }, maxEvidence: 3,
      decisiveEvidenceIds: ['m1-observation-register', 'm1-network-note', 'm1-experiment-protocol'],
      acceptedConclusionIds: ['m1-drain-supported', 'm1-mechanism-not-unique'],
      spatial: { operations: ['buffer', 'distance', 'intersection', 'spatialJoin', 'network'], featureIds: ['north-works', 'old-town'], units: ['m', 'm2', 'feature count'], requireComputedOutput: true, requireInputProvenance: true, bufferRadiusRangeM: [200, 600] },
      experiment: { parameters: ['permeabilityMmHr', 'drainageM3s'], heldConstant: ['rainfallMmHr', 'tracerPulse', 'missingConnection', 'terrainEdits'], probeIds: ['old-town'], interpretationIds: ['sensitivity-only', 'heldout-discriminates'], requireDistinctRuns: true, requireChangedNumericalOutput: true, requireSameDuration: true, requireObservationComparison: true },
      uncertainty: { acceptedIds: ['m1-model-limits', 'm1-proximity-limit', 'm1-hidden-measurement'], maxChoices: 2 },
      notes: 'No credit for opening cards. Numerical comparisons must come from reproducible engine records, not a chosen checkbox. Full conclusion credit requires satisfying the selected conclusion conditions. A justified uncertain conclusion is a valid path; it need not guess a hidden parameter.',
    },
    explanation: 'The ring can establish a nearby location. A controlled experiment can establish sensitivity within the model. Comparing independent saved measurements can favor one explanation, but neither a pretty map nor one matching curve proves every omitted mechanism irrelevant.',
    uncertainty: 'Synthetic observations share this model’s assumptions. Reproducing them does not validate real-world forecasting. A changed model result is not an edit to the original observations.',
    additionalMeasurement: 'Compare the predicted depth series at an unrevealed North Works or East Wharf probe, then choose the location with a measurable separation between hypotheses.',
  };
  const archiveCase = {
    ...metadata('archive-frame', 'One frame, two dates', ['date-context', 'visual-evidence', 'source-tracing'], 'guided'),
    dek: 'The caption arrived today. Did the image?', estimatedMinutes: [3, 7],
    context: { place: 'East Wharf, fictional Merehaven', date: '2031-10-12', label },
    stages: [
      {
        id: 'archive-frame-stage-1', weight: 40,
        claim: 'This frame was captured at East Wharf during the October 12 field trial.',
        context: 'Only the repost, a stripped export record and the current trial roster are available at this stage. All are original simulated documents.',
        evidence: [
          document('af-repost', 'The October 12 repost', 'SIMULATED POST. Posted October 12 at 09:12: “East Wharf, this morning.” Attached is a constructed storyboard of the wharf, showing a triangular sign and two stacked blue crates. The timestamp belongs to the post. The post provides no camera or capture record.', 'east-wharf', 'simulated-image-caption', '2031-10-12T09:12:00Z'),
          document('af-export', 'Export metadata excerpt', 'SIMULATED FILE RECORD. File name: wharf-share.png. Exported: October 12 at 09:09. Original capture time: absent from this export. The file name and export time identify this copy, not when the underlying frame was made.', 'east-wharf', 'simulated-metadata', '2031-10-12T09:09:00Z'),
          document('af-roster', 'The current field-trial roster', 'SIMULATED ROSTER. A team was assigned to East Wharf on October 12. Its task was to inventory posts and benches. A team being present makes a new image possible; the roster does not identify or date the shared frame.', 'east-wharf', 'simulated-roster', '2031-10-12T08:00:00Z'),
        ],
        reasons: [
          { id: 'af-date-unestablished', label: 'The available times date the post and export, not the capture.' },
          { id: 'af-roster-proves', label: 'The field-team roster proves that every shared image is new.' },
          { id: 'af-no-date-false', label: 'A missing capture time proves the frame is old.' },
        ],
        verification: { question: 'Which timestamp in the supplied records establishes when the frame itself was captured?', options: [{ id: 'capture-absent', label: 'None of them establishes capture time.' }, { id: 'post-time', label: '09:12, when the post appeared.' }, { id: 'export-time', label: '09:09, when the copy was exported.' }], answer: 'capture-absent' },
        rubric: { verdict: 'insufficient', decisiveEvidenceIds: ['af-repost', 'af-export'], maxEvidence: 2, reasonId: 'af-date-unestablished', verificationAnswer: 'capture-absent' },
        explanation: 'Insufficient evidence is warranted. The current roster is compatible with a new frame but does not establish that this is one. Missing metadata is not proof that the caption is false. Preserve this answer against this stage’s evidence, even if a later record changes the conclusion.',
        uncertainty: 'The frame could be new or reused. The current snapshot cannot decide.',
        additionalMeasurement: 'Retrieve an independently maintained original capture manifest and compare the frame identity, not merely a similar-looking location.',
        nextStageIntro: 'A separately kept archive manifest and its attached frame are now released. Your first decision stays on the record; assess the new snapshot.',
      },
      {
        id: 'archive-frame-stage-2', weight: 60,
        claim: 'This frame was captured at East Wharf during the October 12 field trial.',
        context: 'The archive now identifies the exact underlying frame. Judge this stage using both the repost and the newly released records.',
        evidence: [
          document('af2-repost', 'The same repost', 'SIMULATED POST. October 12, 09:12: “East Wharf, this morning.” The same triangular sign, crate arrangement and frame identifier AF-017 are visible.', 'east-wharf', 'simulated-image-caption', '2031-10-12T09:12:00Z'),
          document('af2-manifest', 'Original capture manifest', 'SIMULATED ARCHIVE MANIFEST. Frame AF-017 was captured October 5 at 15:24 and entered into the archive October 5 at 15:31. Its constructed frame shows the identical triangular sign and two blue crates. The manifest dates the capture, not a later export.', 'east-wharf', 'simulated-archive', '2031-10-05T15:24:00Z'),
          document('af2-match', 'Frame identity comparison', 'SIMULATED COMPARISON. The repost and archive attachment share identifier AF-017 and the same complete pixel-pattern identifier. This authored match establishes reuse of the same constructed frame; it is stronger than two images simply showing the same wharf.', 'east-wharf', 'simulated-comparison'),
          document('af2-roster', 'A team really was there', 'SIMULATED ROSTER. The October 12 team assignment is authentic within the case. It establishes a visit, not the capture date of AF-017. True surrounding details do not repair the false date claim.', 'east-wharf', 'simulated-roster', '2031-10-12T08:00:00Z'),
        ],
        reasons: [
          { id: 'af-capture-conflict', label: 'An exact frame match links the repost to a capture seven days earlier.' },
          { id: 'af-team-visit', label: 'A real team visit makes the repost’s image date accurate.' },
          { id: 'af-all-post-false', label: 'A false image date means no team visited East Wharf.' },
        ],
        verification: { question: 'Which date belongs to the capture of the matched frame AF-017?', options: [{ id: 'october-5', label: 'October 5, from the original capture manifest.' }, { id: 'october-12', label: 'October 12, from the repost.' }, { id: 'unknown-date', label: 'Neither date identifies the capture.' }], answer: 'october-5' },
        rubric: { verdict: 'false', decisiveEvidenceIds: ['af2-manifest', 'af2-match'], maxEvidence: 2, reasonId: 'af-capture-conflict', verificationAnswer: 'october-5' },
        explanation: 'The exact capture-date claim is false in this fictional record. The frame was captured on October 5 and reused on October 12. This does not prove that no field trial or team visit happened. Revising the earlier insufficient-evidence verdict is warranted because the evidence changed.',
        uncertainty: 'The records establish the frame’s date. They do not establish the reposter’s intention.',
        additionalMeasurement: 'A documented correction or account from the reposter could explain how the old frame acquired its new caption; it would not change the capture manifest.',
      },
    ],
  };
  function seasonMission(config) {
    const { prefix, spatial, experiment, accepted, uncertainties, ...authored } = config;
    const uncertaintyChoices = uncertainties.map((text, i) => ({ id: prefix + '-limit-' + (i + 1), label: text, correct: true })).concat({ id: prefix + '-no-limits', label: 'A successful simulation rules out every omitted real-world factor.', correct: false });
    return {
      ...metadata(authored.id, authored.title, authored.skillTags, authored.difficulty || 'intermediate'),
      estimatedMinutes: [15, 25], context: { place: 'Merehaven estuary', time: 'One fixed hour of a fictional storm; all clocks use seconds from model start.', scope: 'An original educational investigation, not a real emergency.', label },
      ...authored,
      observationBinding: { kind: 'synthetic-observation', depthToleranceM: 0.001, concentrationToleranceGm3: 0.001, duration: 3600, modelVersion: 'waterline-fv-1', sourceImmutable: true, status: 'awaiting-derived-bundle', ...authored.observationBinding },
      uncertaintyChoices,
      interpretations: [
        { id: 'sensitivity-only', label: 'The controlled result establishes a response in this model, while the wider historical or policy conclusion remains bounded.' },
        { id: 'heldout-discriminates', label: 'The selected saved readings favor one tested prediction beyond the stated tolerance; they do not validate every model assumption.' },
        { id: 'proximity-is-causation', label: 'The map and one matching prediction remove any need to consider omitted factors.' },
      ],
      rubric: {
        weights: { conclusion: 40, spatial: 20, experiment: 20, uncertainty: 20 }, maxEvidence: 3,
        decisiveEvidenceIds: authored.documents.filter(doc => doc.kind !== 'simulated-claim').map(doc => doc.id), acceptedConclusionIds: accepted,
        spatial: { units: ['m', 'm2', 'feature count'], requireComputedOutput: true, requireInputProvenance: true, ...spatial },
        experiment: { interpretationIds: ['sensitivity-only', 'heldout-discriminates'], requireDistinctRuns: true, requireChangedNumericalOutput: true, requireSameDuration: true, requireObservationComparison: true, duration: 3600, ...experiment },
        uncertainty: { acceptedIds: uncertaintyChoices.filter(choice => choice.correct).map(choice => choice.id), maxChoices: 2 },
        notes: 'Pin one source document, one relevant computed spatial record and one controlled numerical comparison. Conclusion-specific conditions can require additional saved predictions or an input range. Opening tools or selecting every card never earns credit.',
      },
      uncertainty: uncertainties.join(' '),
    };
  }
  const missionTwo = seasonMission({
    id: 'missing-connection', prefix: 'm2', title: 'The missing connection', chapterId: 'chapter-1', difficulty: 'intermediate',
    skillTags: ['source-tracing', 'network-analysis', 'controlled-experiments', 'uncertainty'],
    dek: 'A missing line can change the story. A straight line cannot settle it.',
    briefing: 'A harmless tracer released at North Works appears in an East Wharf record. A copied drainage map shows no directed Works–Wharf path, while a maintenance sketch marks a possible link. Reconstruct the source chain, calculate the network with and without that optional edge, and run the coupled model. The question is whether enabling a connection can explain a change in the recorded concentration—not whether a map line proves a real pipe exists.',
    claim: 'The recorded network is complete, so the East Wharf tracer record must be fabricated.',
    scenarioId: 'missing-connection', comparisonScenarioIds: ['baseline-storm', 'clock-offset'],
    observationBinding: { referenceScenarioId: 'missing-connection', initialFeatureIds: ['east-wharf'], initialTimes: [2400], heldOutFeatureIds: ['north-works', 'old-town'], heldOutTimes: [1800], variables: ['concentration'] },
    hypotheses: [{ id: 'm2-link', label: 'An omitted directed connection changes tracer transport.', parameter: 'missingConnection' }, { id: 'm2-clock', label: 'A different release time changes the graph without adding a connection.', parameter: 'tracerPulse' }, { id: 'm2-unresolved', label: 'The network inventory remains incomplete outside the tested model.', parameter: null }],
    documents: [
      document('m2-claim', 'The impossible-record caption', 'SIMULATED CAPTION. “No line on this map means no route exists. The wharf measurement must be fake.” The graphic cites a copied inventory, without identifying its revision date or checking optional links.', 'east-wharf', 'simulated-claim'),
      document('m2-inventory', 'Inventory and maintenance sketch', 'SIMULATED SOURCE CHAIN. The circulating map was traced from inventory revision N3. A separate maintenance sketch records a proposed Works–Wharf connection, direction Works to Wharf, but its installation status is unverified. Test the optional network edge explicitly; do not turn this sketch into a confirmed construction record.', 'north-works', 'simulated-network-record'),
      document('m2-field', 'One saved wharf sample', 'SIMULATED LAB REGISTER. The initial measurement is East Wharf tracer concentration at 2,400 seconds, in grams per cubic metre, with ±0.001 g/m³ tolerance. The tracer is harmless. This reading is generated by the fixed game model and cannot change when you edit the network.', 'east-wharf', 'observation-register'),
      document('m2-protocol', 'Separate topology from timing', 'SIMULATED PROTOCOL. Compare maintained drainage with the optional Works–Wharf edge enabled. Keep the release at 600 seconds, its mass at 600 grams, its source at North Works and the same rainfall, terrain and drains. Compare East Wharf concentration for the full hour. Drain links transfer water between cells without resolving pipe travel time: network distance divided by arrival time is not a pipe speed measurement.', 'north-works', 'experiment-protocol'),
    ],
    guidedSteps: [
      { id: 'm2-path', title: 'Compute the directed path', instruction: 'Use the network tool from North Works to East Wharf. Inspect the no-link result, then enable the optional connection and compute it again. The result is connectivity and network length, not arrival time.', requiredKind: 'analysis' },
      { id: 'm2-control', title: 'Change one connection', instruction: 'Save a one-hour maintained-drainage run and a one-hour missing-connection run. Select tracer concentration. Keep the release, rainfall and other inputs fixed; pin the computed comparison.', requiredKind: 'experiment-comparison' },
      { id: 'm2-sample', title: 'Compare the saved sample', instruction: 'Read the wharf concentration at 2,400 seconds and its tolerance. Compare the two numerical predictions with the fixed record. A matching synthetic mechanism is not proof of installation.', requiredKind: 'observation' },
      { id: 'm2-file', title: 'Correct the inference', instruction: 'File a network record, a source document and a concentration comparison. Preserve the distinction between an omitted line, an effective model link and a verified physical connection.', requiredKind: 'briefing' },
    ],
    measurementChoices: [{ id: 'm2-measure-works', label: 'North Works concentration at 1,800 seconds', probeId: 'north-works', explanation: 'Adds an upstream check of the shared release prediction.' }, { id: 'm2-measure-town', label: 'Old Town concentration at 1,800 seconds', probeId: 'old-town', explanation: 'Checks another modeled receiving location.' }, { id: 'm2-withhold', label: 'Retain the installation uncertainty', probeId: null, explanation: 'The existing comparison can show a possible transport mechanism without verifying an installation.' }],
    conclusions: [
      { id: 'm2-link-supported', label: 'The optional connection explains the saved wharf sample better than the unchanged network in this model; its real installation remains unverified.', conditions: [{ type: 'controlled-experiment', parameter: 'missingConnection' }, { type: 'network-connected', fromId: 'north-works', toId: 'east-wharf', edgeId: 'works-wharf' }, { type: 'observation-fit', betterScenarioId: 'missing-connection', thanScenarioId: 'baseline-storm', variable: 'concentration', tolerance: 0.001 }] },
      { id: 'm2-mechanism-only', label: 'The connection changes modeled transport, but these records do not prove whether the proposed link was installed.', conditions: [{ type: 'controlled-experiment', parameter: 'missingConnection' }, { type: 'acknowledge-nonidentifiability' }] },
      { id: 'm2-fabricated', label: 'A missing line proves the saved tracer record is fabricated.', conditions: [{ type: 'invalid-causal-inference' }] },
    ],
    accepted: ['m2-link-supported', 'm2-mechanism-only'], spatial: { operations: ['network'], featureIds: ['north-works', 'east-wharf'] },
    experiment: { parameters: ['missingConnection'], heldConstant: ['rainfallMmHr', 'permeabilityMmHr', 'drainageM3s', 'tracerPulse', 'terrainEdits'], probeIds: ['east-wharf'] },
    uncertainties: ['A modeled connection is a hypothesis; the supplied sketch does not verify installation.', 'Network length is not tracer travel time, and these drain links do not resolve transit inside a pipe.', 'Synthetic concentration readings share the educational model’s assumptions.'],
    explanation: 'Topology is testable: the directed path and the coupled transport prediction change when the optional link is enabled. The absence of a line in a copied inventory cannot by itself discredit a measurement. Separate the mechanism supported by this model from the installation evidence still missing.',
    additionalMeasurement: 'An independently dated inspection of the proposed junction would test installation; synchronized upstream and wharf samples would test transport beyond one observation.',
  });
  const missionThree = seasonMission({
    id: 'perfect-match', prefix: 'm3', title: 'The perfect match', chapterId: 'chapter-2', difficulty: 'advanced', skillTags: ['statistics', 'spatial-reasoning', 'controlled-experiments', 'uncertainty'],
    dek: 'Two different explanations can fit the same number.',
    briefing: 'Two teams fit the final Old Town depth using different combinations of rainfall and drainage. The smaller residual is being sold as proof of the correct explanation. Compare both hypotheses at the actual measurement tolerance, isolate one input in a third run, then decide where a new observation would separate their predictions. A two-input preset comparison can reveal ambiguity; it cannot isolate either input’s effect.',
    claim: 'The hypothesis with the smallest final Old Town residual must identify the true rainfall and drain capacity.',
    scenarioId: 'low-rain-restricted', comparisonScenarioIds: ['high-rain-open', 'baseline-storm'],
    observationBinding: { referenceScenarioId: 'low-rain-restricted', initialFeatureIds: ['old-town'], initialTimes: [3600], heldOutFeatureIds: ['east-wharf', 'north-works'], heldOutTimes: [3600], variables: ['depth'] },
    hypotheses: [{ id: 'm3-low', label: '55 mm/h rain with a 0.05 m³/s drain.', parameter: null }, { id: 'm3-high', label: '75 mm/h rain with a 0.45 m³/s drain.', parameter: null }, { id: 'm3-precision', label: 'Both may fit the single initial reading within its precision.', parameter: null }],
    documents: [
      document('m3-claim', 'The winning-fit headline', 'SIMULATED HEADLINE. “Smallest residual wins: the drain capacity is now known.” It gives no measurement tolerance and treats a single fitted value as a unique parameter estimate.', 'old-town', 'simulated-claim'),
      document('m3-register', 'Precision of the initial record', 'SIMULATED REGISTER. One Old Town depth at 3,600 seconds is supplied at ±0.001 m tolerance. Extra printed decimal places are model arithmetic, not added field precision. Earlier Old Town samples are withheld. Judge both candidate fits against this one available reading.', 'old-town', 'observation-register'),
      document('m3-inputs', 'Two explicit hypotheses', 'SIMULATED MODEL NOTE. Candidate L uses rain 55 mm/h and drain capacity 0.05 m³/s. Candidate H uses rain 75 mm/h and drain capacity 0.45 m³/s. Permeability, tracer release, terrain, initial water and duration agree. These candidates differ in TWO inputs. Add a third run changing only rainfall or only drainage to learn sensitivity.', 'old-town', 'experiment-protocol'),
      document('m3-budget', 'One more station', 'SIMULATED OBSERVATION BUDGET. A single additional final depth can be requested at North Works or East Wharf. Compute their spatial relationships and examine the candidate predictions before choosing. A farther station can carry more discriminating information than a nearer one.', 'east-wharf', 'simulated-field-note'),
    ],
    guidedSteps: [
      { id: 'm3-pair', title: 'Save both fitted hypotheses', instruction: 'Run Lighter rain, restricted drain and Heavier rain, open drain to 60:00. Both snapshots are needed to assess whether the initial reading identifies one explanation.', requiredKind: 'experiment-comparison' },
      { id: 'm3-single', title: 'Build a one-factor comparison', instruction: 'From the lighter-rain preset, change rainfall from 55 to 75 while leaving its drain at 0.05. Save the third run and pin that controlled comparison. Changing rain and drain together earns no isolated-effect credit.', requiredKind: 'experiment-comparison' },
      { id: 'm3-place', title: 'Choose useful geography', instruction: 'Measure Old Town to East Wharf, or join the available observations to their land-use zones. Compare candidate predictions at East Wharf and North Works before spending the one extra reading.', requiredKind: 'analysis' },
      { id: 'm3-brief', title: 'Report what the tolerance permits', instruction: 'A justified initial non-uniqueness conclusion needs both candidate snapshots and the controlled third run. A stronger selected-hypothesis conclusion also needs a discriminating held-out record.', requiredKind: 'briefing' },
    ],
    measurementChoices: [{ id: 'm3-measure-wharf', label: 'Reveal East Wharf final depth', probeId: 'east-wharf', explanation: 'Check whether a downstream location separates the candidate predictions.' }, { id: 'm3-measure-works', label: 'Reveal North Works final depth', probeId: 'north-works', explanation: 'A station close to the changed surface is not automatically informative.' }, { id: 'm3-withhold', label: 'Publish the initial non-uniqueness result', probeId: null, explanation: 'Keep both compatible hypotheses in the record and identify the next useful station.' }],
    conclusions: [
      { id: 'm3-not-identified', label: 'Both hypotheses fit the initial town reading at its stated precision; that reading alone does not uniquely identify rain and drainage.', conditions: [{ type: 'controlled-experiment', anyParameter: ['rainfallMmHr', 'drainageM3s'] }, { type: 'observation-compatibility', scenarioIds: ['low-rain-restricted', 'high-rain-open'], initialOnly: true }, { type: 'acknowledge-nonidentifiability' }] },
      { id: 'm3-low-supported', label: 'The initial reading fits both; the selected wharf measurement favors the lighter-rain hypothesis within this model.', conditions: [{ type: 'controlled-experiment', anyParameter: ['rainfallMmHr', 'drainageM3s'] }, { type: 'observation-fit', betterScenarioId: 'low-rain-restricted', thanScenarioId: 'high-rain-open', requireHeldOut: true, heldOutProbeId: 'east-wharf', variable: 'depth', tolerance: 0.001 }] },
      { id: 'm3-decimals-prove', label: 'The smallest displayed residual proves an exact and unique drain capacity.', conditions: [{ type: 'invalid-model-certainty' }] },
    ],
    accepted: ['m3-not-identified', 'm3-low-supported'], spatial: { operations: ['distance', 'spatialJoin'], featureIds: ['old-town', 'east-wharf'] },
    experiment: { parameters: ['rainfallMmHr', 'drainageM3s'], heldConstant: ['permeabilityMmHr', 'tracerPulse', 'missingConnection', 'terrainEdits'], probeIds: ['old-town'] },
    uncertainties: ['Printed numerical precision is not additional observation accuracy.', 'Changing two inputs together cannot identify either input’s separate effect.', 'The usefulness of a second station depends on separation between predictions there, not just its distance.'],
    explanation: 'The calibration demonstrates non-identifiability at the initial station and tolerance. A controlled third run identifies a model response; a strategically chosen held-out station can distinguish candidate configurations. Neither result proves all omitted explanations impossible.',
    additionalMeasurement: 'Obtain a synchronized East Wharf final depth with the stated precision, and independently constrain the storm total or drain capacity before making a unique parameter claim.',
  });
  const missionFour = seasonMission({
    id: 'fix-moved-problem', prefix: 'm4', title: 'The fix that moved the problem', chapterId: 'chapter-2', difficulty: 'intermediate', skillTags: ['network-analysis', 'controlled-experiments', 'statistics', 'uncertainty'],
    dek: 'A lower town graph is only half of the comparison.',
    briefing: 'An expanded Old Town drain is proposed as an unqualified success. Follow the directed connection to Reed Marsh and compare both places under the same storm. A model intervention can reduce one location’s peak while increasing another’s. Your briefing must say what changed, who or what lies downstream, and which real impacts this simplified water model cannot assess.',
    claim: 'Expanding the Old Town drain reduces water everywhere and has no downstream tradeoff.',
    scenarioId: 'baseline-storm', comparisonScenarioIds: ['fast-drain', 'retention'],
    observationBinding: { referenceScenarioId: 'baseline-storm', initialFeatureIds: ['old-town', 'reed-marsh'], initialTimes: [3600], heldOutFeatureIds: ['south-outfall', 'east-wharf'], heldOutTimes: [2400], variables: ['depth'] },
    hypotheses: [{ id: 'm4-transfer', label: 'A faster town drain transfers water to Reed Marsh.', parameter: 'drainageM3s' }, { id: 'm4-everywhere', label: 'A lower town peak means every receiving location improves.', parameter: null }],
    documents: [
      document('m4-headline', 'The town-only success chart', 'SIMULATED PROPOSAL. The caption reads: “Lower water in Old Town means a safer estuary.” Only the town graph is shown. The proposal omits receiving locations and offers no ecological, structural or human-impact assessment.', 'old-town', 'simulated-claim'),
      document('m4-network', 'Where the outlet goes', 'SIMULATED NETWORK RECORD. The modeled town drain is directed from Old Town to Reed Marsh, then toward South Outfall. Compute the directed path and inspect the terrain or network. Do not treat the sink at the town gauge as removal from every other location.', 'reed-marsh', 'simulated-network-record'),
      document('m4-protocol', 'Equal storms, two places', 'SIMULATED COMPARISON PROTOCOL. Run maintained drainage at 0.18 m³/s and expanded drainage at 0.65 m³/s. Keep rainfall, land surface, release, initial water and terrain equal. Run both for 3,600 seconds and compare peak water depth in BOTH Old Town and Reed Marsh, using a shared graph scale.', 'old-town', 'experiment-protocol'),
      document('m4-limits', 'What a peak cannot measure', 'SIMULATED PLANNING NOTE. Peak water depth is an output of the toy model. It is not a prediction of injury, building damage or ecological harm. Reed Marsh is not an empty remainder: choosing a policy needs additional impact data, not a claim that the model alone has weighed every consequence.', 'reed-marsh', 'simulated-field-note'),
    ],
    guidedSteps: [{ id: 'm4-route', title: 'Find the receiving location', instruction: 'Compute the directed network from Old Town to Reed Marsh, or a terrain profile connecting them.', requiredKind: 'analysis' }, { id: 'm4-run', title: 'Compare a single intervention', instruction: 'Save maintained and expanded-drain runs at 60:00. The comparison requires both Old Town and Reed Marsh probe histories; keep the other inputs fixed.', requiredKind: 'experiment-comparison' }, { id: 'm4-peaks', title: 'Read two peaks', instruction: 'Inspect the peak in each place in both actual prediction series. A final reading is not a substitute for a peak across the complete hour.', requiredKind: 'observation' }, { id: 'm4-file', title: 'Name the tradeoff', instruction: 'A transfer claim needs the computed opposite peak directions. An uncertain policy conclusion can be valid while retaining the observed model response.', requiredKind: 'briefing' }],
    measurementChoices: [{ id: 'm4-measure-outfall', label: 'South Outfall depth at 2,400 seconds', probeId: 'south-outfall', explanation: 'Adds a downstream check; depth alone does not measure all exported water.' }, { id: 'm4-measure-wharf', label: 'East Wharf depth at 2,400 seconds', probeId: 'east-wharf', explanation: 'Adds a separate location beyond the proposed receiving path.' }, { id: 'm4-withhold', label: 'Retain policy uncertainty', probeId: null, explanation: 'The modeled tradeoff can be described without claiming a validated impact forecast.' }],
    conclusions: [{ id: 'm4-tradeoff', label: 'Under the equal storm, the expanded drain lowers the modeled town peak and raises the marsh peak; this is a transfer tradeoff, not universal improvement.', conditions: [{ type: 'controlled-experiment', parameter: 'drainageM3s' }, { type: 'probe-directions', parameter: 'drainageM3s', statistic: 'peak', expectations: [{ probeId: 'old-town', direction: 'decrease' }, { probeId: 'reed-marsh', direction: 'increase' }] }] }, { id: 'm4-policy-unresolved', label: 'The drain changes water distribution in the model; the preferred policy remains unresolved without downstream impact evidence.', conditions: [{ type: 'controlled-experiment', parameter: 'drainageM3s' }, { type: 'acknowledge-nonidentifiability' }] }, { id: 'm4-no-tradeoff', label: 'A lower town depth proves the intervention improves every location with no tradeoff.', conditions: [{ type: 'invalid-model-certainty' }] }],
    accepted: ['m4-tradeoff', 'm4-policy-unresolved'], spatial: { operations: ['network', 'profile'], featureIds: ['old-town', 'reed-marsh'] },
    experiment: { parameters: ['drainageM3s'], heldConstant: ['rainfallMmHr', 'permeabilityMmHr', 'tracerPulse', 'missingConnection', 'terrainEdits'], probeIds: ['old-town', 'reed-marsh'] },
    uncertainties: ['Depth changes do not by themselves quantify ecological, structural or human impacts.', 'A town benefit can coexist with greater modeled water at a receiving location.', 'The 50 m grid and simplified drains omit smaller routes and structures.'],
    explanation: 'Compare the actual one-hour peak depths at both linked locations. The modeled intervention transfers part of the water burden, so a single town chart cannot support an estuary-wide success claim. The model informs a tradeoff; it does not decide how the community should value it.',
    additionalMeasurement: 'Measure downstream water levels and discharge through time, then obtain separate ecological and asset information before choosing the outlet policy.',
  });
  const missionFive = seasonMission({
    id: 'out-of-time', prefix: 'm5', title: 'Out of time', chapterId: 'chapter-3', difficulty: 'advanced', skillTags: ['date-context', 'source-tracing', 'network-analysis', 'controlled-experiments'],
    dek: 'A timestamp error can look like a transport anomaly.',
    briefing: 'A shared graph places the harmless tracer release at 09:10 UTC. The original release log records 09:20 UTC, twenty minutes after the model clock begins. Compare the records on one time origin, inspect the Works–Town route, and change only the release time. Concentration responds to the release clock even though the drainage topology stays fixed. Do not solve a clock mismatch by inventing a new pipe or calculating pipe speed from a diagram.',
    claim: 'A mismatch with the 09:10 tracer prediction proves the Works–Town drainage route changed.',
    scenarioId: 'clock-offset', comparisonScenarioIds: ['baseline-storm', 'missing-connection'],
    observationBinding: { referenceScenarioId: 'clock-offset', initialFeatureIds: ['old-town'], initialTimes: [1800], heldOutFeatureIds: ['north-works', 'east-wharf'], heldOutTimes: [2400], variables: ['concentration'] },
    hypotheses: [{ id: 'm5-clock', label: 'The release happened 1,200 seconds after model start, not 600.', parameter: 'tracerPulse' }, { id: 'm5-network', label: 'A different route, rather than a clock mismatch, changed transport.', parameter: 'missingConnection' }],
    documents: [
      document('m5-caption', 'The shared graph caption', 'SIMULATED CAPTION. “Released 09:10; this prediction misses the later town sample, so the route changed.” The graph was labeled from a copied preparation schedule, not the executed-release record.', 'old-town', 'simulated-claim', '2031-10-12T09:10:00Z'),
      document('m5-clock', 'Common clock register', 'SIMULATED CLOCK REGISTER. Model t=0 corresponds to 09:00:00 UTC. Sensor times are already elapsed seconds from that instant. The executed tracer release is logged at 09:20:00 UTC, which is t=1,200 seconds. The preparation schedule’s 09:10 corresponds to t=600, but it is not the executed-release timestamp.', 'north-works', 'simulated-timestamp-record', '2031-10-12T09:20:00Z'),
      document('m5-release', 'Executed-release record', 'SIMULATED ORIGINAL LOG. Released 600 grams of harmless tracer at North Works at 09:20 UTC. Source and mass agree with the earlier plan; only the execution time differs. This record does not report a network alteration. Retain the original timestamp when correcting the graph.', 'north-works', 'simulated-source-record', '2031-10-12T09:20:00Z'),
      document('m5-protocol', 'Test timing without changing transport', 'SIMULATED PROTOCOL. Compare maintained drainage with a 600-second release against the same configuration with release at 1,200 seconds. Preserve mass 600 grams, source North Works, rainfall, permeability, drainage, terrain and duration. Use Old Town concentration over the hour. Drain edges do not resolve internal pipe travel time; timing agreement is not a measured pipe velocity.', 'old-town', 'experiment-protocol'),
    ],
    guidedSteps: [{ id: 'm5-align', title: 'Align the source clocks', instruction: 'Read the executed-release record and calculate elapsed time from 09:00 UTC. The 09:20 release maps to t=1,200 seconds; preserve both the source time and its model conversion.', requiredKind: 'observation' }, { id: 'm5-route', title: 'Keep the route explicit', instruction: 'Compute the directed North Works–Old Town path. The map identifies a connection but cannot supply pipe transit time.', requiredKind: 'analysis' }, { id: 'm5-experiment', title: 'Move only the release time', instruction: 'Save the maintained and later-release presets at 60:00. Compare concentration while mass, source and every water input stay fixed.', requiredKind: 'experiment-comparison' }, { id: 'm5-correct', title: 'File the corrected interpretation', instruction: 'Use the original clock record, the network calculation and the controlled concentration comparison. A timing correction can explain a model discrepancy without proving the network changed.', requiredKind: 'briefing' }],
    measurementChoices: [{ id: 'm5-measure-works', label: 'North Works concentration at 2,400 seconds', probeId: 'north-works', explanation: 'Adds a release-side check at a synchronized time.' }, { id: 'm5-measure-wharf', label: 'East Wharf concentration at 2,400 seconds', probeId: 'east-wharf', explanation: 'A location outside the tested Works–Town path need not distinguish timing hypotheses.' }, { id: 'm5-withhold', label: 'Limit the correction to timing', probeId: null, explanation: 'Correct the timestamp and model claim without asserting that all actual routes are known.' }],
    conclusions: [{ id: 'm5-timing-supported', label: 'The 1,200-second release fits the saved town concentration better with topology unchanged; the earlier mismatch did not prove a new route.', conditions: [{ type: 'controlled-experiment', parameter: 'tracerPulse' }, { type: 'observation-fit', betterScenarioId: 'clock-offset', thanScenarioId: 'baseline-storm', variable: 'concentration', tolerance: 0.001 }] }, { id: 'm5-timing-bounded', label: 'Correcting the release clock changes the concentration prediction while the network stays fixed; the supplied model cannot establish every real transport detail.', conditions: [{ type: 'controlled-experiment', parameter: 'tracerPulse' }, { type: 'acknowledge-nonidentifiability' }] }, { id: 'm5-speed', label: 'Divide route length by the graph delay to establish exact pipe velocity and prove a new route.', conditions: [{ type: 'invalid-causal-inference' }] }],
    accepted: ['m5-timing-supported', 'm5-timing-bounded'], spatial: { operations: ['network'], featureIds: ['north-works', 'old-town'] },
    experiment: { parameters: ['tracerPulse'], heldConstant: ['rainfallMmHr', 'permeabilityMmHr', 'drainageM3s', 'missingConnection', 'terrainEdits', 'tracerPulse.massG', 'tracerPulse.featureId'], probeIds: ['old-town'] },
    uncertainties: ['A corrected timestamp does not independently verify every transport path.', 'Drain links do not resolve travel within a pipe, so map distance divided by delay is not a pipe-speed measurement.', 'The original source timestamp and the correction should remain visible together.'],
    explanation: 'Source timing is part of the experiment. The shared schedule and the executed-release log describe different events. Testing 600 against 1,200 seconds while holding mass, source and hydraulics fixed reveals a timing response without changing the network.',
    additionalMeasurement: 'Synchronize an independent release logger and downstream sampler, retaining clock calibration records and the original event times.',
  });
  const missionSix = seasonMission({
    id: 'waterline-briefing', prefix: 'm6', title: 'The Waterline briefing', chapterId: 'chapter-3', difficulty: 'advanced', skillTags: ['statistics', 'spatial-reasoning', 'controlled-experiments', 'uncertainty'],
    dek: 'Make a recommendation that can survive its own limitations.',
    briefing: 'The final proposal combines a lowered North Works parcel with a more permeable surface. Its sponsor presents one favorable run as a guarantee. Reconstruct the terrain context, isolate permeability while holding the lowered parcel fixed, and calculate a rainfall range. Your final brief may recommend a limited further trial or defer the choice, but it must retain the source record, reproducible results and the questions the model cannot answer.',
    claim: 'The retention package is guaranteed to keep every location safe under any future storm.',
    scenarioId: 'retention', comparisonScenarioIds: ['baseline-storm', 'fast-drain'],
    observationBinding: { referenceScenarioId: 'retention', initialFeatureIds: ['old-town', 'reed-marsh'], initialTimes: [3600], heldOutFeatureIds: ['north-works', 'east-wharf'], heldOutTimes: [2400], variables: ['depth'] },
    hypotheses: [{ id: 'm6-package', label: 'The lowered parcel and permeability together change modeled storage and runoff.', parameter: null }, { id: 'm6-permeability', label: 'Permeability has an isolatable effect with parcel elevation held fixed.', parameter: 'permeabilityMmHr' }, { id: 'm6-range', label: 'A range of rainfall inputs can expose sensitivity, without becoming a probability guarantee.', parameter: 'rainfallMmHr' }],
    documents: [
      document('m6-promise', 'The guarantee on the cover', 'SIMULATED PROPOSAL COVER. “One successful run: a permanent, risk-free solution.” The cover neither states which inputs changed nor gives future rainfall probabilities or impact thresholds.', 'north-works', 'simulated-claim'),
      document('m6-package', 'What the package changes', 'SIMULATED DESIGN SHEET. The retention preset lowers the Works parcel by 0.10 m and raises its permeability from 28 to 48 mm/h. This is a TWO-input package. Starting from that preset, set permeability to 28 while preserving the lowered parcel; compare with 48 to isolate the surface effect.', 'north-works', 'experiment-protocol'),
      document('m6-range', 'A transparent sensitivity range', 'SIMULATED REVIEW REQUEST. With the retention configuration fixed, run rainfall at 80%, 100% and 120% of 65 mm/h: 52, 65 and 78 mm/h. Keep the remaining configuration and one-hour duration identical. Report the envelope of these explicit trials. It has no assigned occurrence probabilities and is not a confidence interval.', 'old-town', 'experiment-protocol'),
      document('m6-public-record', 'The record a reader should receive', 'SIMULATED EDITORIAL CHECKLIST. Preserve the proposal, the selected source documents, actual map analysis, named inputs and comparison, saved readings, uncertainty and your recommendation. A recommendation may be conditional or deferred. Missing ecology, construction reliability, cost and real-world calibration cannot be supplied by rhetorical confidence.', 'reed-marsh', 'simulated-field-note'),
    ],
    guidedSteps: [{ id: 'm6-terrain', title: 'Reconstruct the proposal’s place', instruction: 'Load the retention preset and compute a terrain profile from North Works to Old Town. Inspect the lowered parcel in the map context rather than treating it as an isolated switch.', requiredKind: 'analysis' }, { id: 'm6-isolate', title: 'Separate the two-input package', instruction: 'Save the retention preset at 60:00. Keep retentionM=0.10 and change only permeability from 48 to 28; run for the same hour and pin the Old Town and Reed Marsh comparison.', requiredKind: 'experiment-comparison' }, { id: 'm6-range', title: 'Test the rainfall envelope', instruction: 'Restore the retention preset at 65 mm/h and use “Compute three rainfall variants” in the notebook. Inspect 52, 65 and 78 mm/h. This actual range is required for either final recommendation.', requiredKind: 'input-range' }, { id: 'm6-file', title: 'File a conditional public record', instruction: 'Pin a design or protocol source, the terrain profile and the controlled comparison. Keep at least one relevant limitation; distinguish a limited further trial from a universal safety guarantee.', requiredKind: 'briefing' }],
    measurementChoices: [{ id: 'm6-measure-works', label: 'North Works depth at 2,400 seconds', probeId: 'north-works', explanation: 'Adds a local check of the fixed retention record.' }, { id: 'm6-measure-wharf', label: 'East Wharf depth at 2,400 seconds', probeId: 'east-wharf', explanation: 'Adds a receiving-location check outside the main town–marsh pair.' }, { id: 'm6-withhold', label: 'Keep broader evidence gaps explicit', probeId: null, explanation: 'A policy choice still needs impact and calibration evidence beyond this educational model.' }],
    conclusions: [{ id: 'm6-limited-trial', label: 'The modeled response warrants a limited further trial, with the explicit rainfall range and unresolved impact questions attached; it is not a safety guarantee.', conditions: [{ type: 'controlled-experiment', parameter: 'permeabilityMmHr' }, { type: 'input-range', parameter: 'rainfallMmHr', values: [52, 65, 78], fixedParameters: { permeabilityMmHr: 48, retentionM: 0.1 }, duration: 3600 }, { type: 'acknowledge-nonidentifiability' }] }, { id: 'm6-defer', label: 'Keep the modeled response and rainfall range in the record, but defer selecting the package until calibration and impact evidence improve.', conditions: [{ type: 'controlled-experiment', parameter: 'permeabilityMmHr' }, { type: 'input-range', parameter: 'rainfallMmHr', values: [52, 65, 78], fixedParameters: { permeabilityMmHr: 48, retentionM: 0.1 }, duration: 3600 }, { type: 'acknowledge-nonidentifiability' }] }, { id: 'm6-guaranteed', label: 'The three simulations guarantee safety under every future storm and settle all policy tradeoffs.', conditions: [{ type: 'invalid-model-certainty' }] }],
    accepted: ['m6-limited-trial', 'm6-defer'], spatial: { operations: ['profile'], featureIds: ['north-works', 'old-town'] },
    experiment: { parameters: ['permeabilityMmHr'], heldConstant: ['rainfallMmHr', 'drainageM3s', 'retentionM', 'tracerPulse', 'missingConnection', 'terrainEdits'], requiredParameters: { retentionM: 0.1 }, probeIds: ['old-town', 'reed-marsh'] },
    uncertainties: ['An input envelope has no assigned probabilities and is not a confidence interval or a universal safety threshold.', 'The model omits real-world calibration, construction reliability, cost and ecological impacts.', 'The original package changes two inputs; only an isolated comparison can attribute a response to permeability.'],
    explanation: 'A defensible public record connects a source proposal, geography, actual controlled outputs and an explicit rainfall sensitivity range. Both a limited further trial and a deferred choice can be coherent when their uncertainty is visible. Neither conclusion converts this fictional model into an operational forecast.',
    additionalMeasurement: 'Measure real infiltration, terrain and storm response for calibration, then obtain construction, cost and ecological evidence before translating a modeled proposal into a decision.',
  });
  const missions = [mission, missionTwo, missionThree, missionFour, missionFive, missionSix];
  function caseStage(config) {
    const { verdict, decisive, reason, verificationAnswer, ...stage } = config;
    return { weight: 100, ...stage, rubric: { verdict, decisiveEvidenceIds: decisive, maxEvidence: 2, reasonId: reason, verificationAnswer }, verification: { ...stage.verification, answer: verificationAnswer } };
  }
  const echoCase = {
    ...metadata('source-echo', 'Three stories, one source', ['source-tracing', 'visual-evidence'], 'intermediate'),
    dek: 'Count independent evidence, not matching headlines.', estimatedMinutes: [4, 7], context: { place: 'Fictional Merehaven', date: '2031-10-13', label },
    stages: [caseStage({ id: 'echo-stage', claim: 'These three stories provide three independent field confirmations that the wharf pump stopped.',
      context: 'Three fictional outlet cards, their citation trails and the underlying observer note are available. The exercise concerns independence of evidence, not the outlets’ reputation.',
      evidence: [
        { ...document('echo-stories', 'Three outlet cards', 'SIMULATED CLIPPINGS. Harbor Sheet: “Wharf pump stopped, observer says.” Estuary Roundup repeats the account, crediting Harbor Sheet. Local Brief repeats the account, linking to Estuary Roundup. Three outlets published the same claim, but publication count is not witness count.', 'east-wharf', 'simulated-source-chain'), sourceChain: { nodes: [{ id: 'observer', label: 'Observer note O-6' }, { id: 'harbor', label: 'Harbor Sheet' }, { id: 'roundup', label: 'Estuary Roundup' }, { id: 'brief', label: 'Local Brief' }], edges: [{ from: 'harbor', to: 'observer' }, { from: 'roundup', to: 'harbor' }, { from: 'brief', to: 'roundup' }], arrowMeaning: 'cites' } },
        document('echo-original', 'The only underlying observation', 'SIMULATED NOTE O-6. One passerby reports that the wharf cabinet was quiet at 09:15. The note does not state whether the pump was scheduled to run, whether it was operating silently, or whether a mechanical test was performed. No second field account is supplied.', 'east-wharf', 'simulated-original-note'),
        document('echo-schedule', 'Operating schedule', 'SIMULATED SCHEDULE. The pump may cycle off between demand periods. The schedule explains a possibility, not the cabinet’s actual state at 09:15. It cannot independently confirm or disprove the reported stoppage.', 'east-wharf', 'simulated-schedule'),
        document('echo-format', 'A polished presentation', 'SIMULATED PRESENTATION NOTE. All three cards use professional logos and a publication timestamp. Those features identify the publishers and copies; they do not add an independent observation.', 'east-wharf', 'simulated-design-note'),
      ],
      reasons: [{ id: 'echo-one-origin', label: 'The citation chain leads to one underlying account, not three independent confirmations.' }, { id: 'echo-three-logos', label: 'Different mastheads guarantee different reporting.' }, { id: 'echo-silence-proof', label: 'A quiet cabinet proves a broken pump regardless of its schedule.' }],
      verification: { question: 'How many independent field accounts are present in the supplied chain?', options: [{ id: 'one', label: 'One.' }, { id: 'three', label: 'Three.' }, { id: 'zero', label: 'None: repeated publication erases the original account.' }] },
      verdict: 'false', decisive: ['echo-stories', 'echo-original'], reason: 'echo-one-origin', verificationAnswer: 'one',
      explanation: 'The exact claim of three independent field confirmations is false. The stories depend on the same source chain. That does not show the passerby invented the account; it means repetition adds no independent confirmation and the pump’s actual state remains unsettled.',
      uncertainty: 'The supplied evidence does not establish whether the pump failed or why the cabinet was quiet.',
      additionalMeasurement: 'Obtain the original operating log or a documented independent equipment check at the claimed time.',
    })],
  };
  const axisCase = {
    ...metadata('cropped-axis', 'The dramatic increase', ['statistics', 'visual-evidence'], 'intermediate'),
    dek: 'The numbers can be right while the picture distorts their scale.', estimatedMinutes: [4, 7], context: { place: 'Fictional Merehaven monitoring network', date: '2031-10-14', label },
    stages: [caseStage({ id: 'axis-stage', claim: 'This presentation accurately conveys the scale of the monitoring-coverage increase: 6.7% growth, drawn as a doubling of bar height.',
      context: 'Judge the combined presentation, including its true relative-growth figure and truncated bars. “Misleading” here means a true element is presented in a way that distorts the comparison.',
      evidence: [
        { ...document('axis-chart', 'The published coverage graphic', 'SIMULATED CHART. Coverage rises from 75% to 80%. The vertical axis starts at 70%, so the visible bars have heights of 5 and 10 percentage points. The headline says “Coverage climbs 6.7%” and emphasizes the doubled bar height. Expand the scale before interpreting the picture.', 'old-town', 'simulated-chart'), chart: { labels: ['Before', 'After'], values: [75, 80], unit: '% of monitored locations', croppedMin: 70, max: 100 } },
        document('axis-register', 'The unchanged location register', 'SIMULATED REGISTER. The same 40 eligible locations are counted in both periods: 30 monitored before and 32 after. Coverage is 30/40=75% and 32/40=80%. The increase is five percentage points, or 2/30≈6.7% relative to the earlier monitored count.', 'old-town', 'simulated-data-table'),
        document('axis-new-sites', 'Two new station entries', 'SIMULATED INSTALLATION NOTE. The two new monitored locations were added on the comparison date. Their entries support a real increase. They do not make the entire monitored network twice as large.', 'east-wharf', 'simulated-roster'),
      ],
      reasons: [{ id: 'axis-distorts', label: 'The relative growth is correct, but the truncated bars visually exaggerate a five-percentage-point increase.' }, { id: 'axis-number-wrong', label: 'Any cropped axis makes every printed number false.' }, { id: 'axis-doubled', label: 'Twice the visible bar height means twice as many locations are monitored.' }],
      verification: { question: 'What is the absolute coverage change when both percentages use the same denominator?', options: [{ id: 'five-points', label: '5 percentage points.' }, { id: 'six-seven-points', label: '6.7 percentage points.' }, { id: 'double', label: 'A doubling from 40% to 80%.' }] },
      verdict: 'misleading', decisive: ['axis-chart', 'axis-register'], reason: 'axis-distorts', verificationAnswer: 'five-points',
      explanation: 'The monitored count really rose from 30 to 32, and 6.7% relative growth is a reasonable rounded figure. But the cropped bar baseline makes the increase look like a doubling. The accurate comparison is 75% to 80%, five percentage points. A zero-baseline view makes the magnitude easier to assess.',
      uncertainty: 'Coverage does not by itself show that every installed sensor produced reliable readings.',
      additionalMeasurement: 'Inspect station uptime and calibration records before equating installed coverage with usable measurement coverage.',
    })],
  };
  const denominatorCase = {
    ...metadata('denominator-shift', 'The changing denominator', ['statistics', 'source-context'], 'advanced'),
    dek: 'A rising total can hide declines in every group.', estimatedMinutes: [5, 8], context: { place: 'Old Town and East Wharf, fictional Merehaven', date: '2031-10-15', label },
    stages: [
      caseStage({ id: 'denominator-stage-1', weight: 40, claim: 'The higher combined inspection pass rate shows that the pass rate improved in both districts.',
        context: 'At first, only the overall totals and inspection protocol are supplied. The district breakdown has not yet been released.',
        evidence: [document('den1-total', 'Combined results', 'SIMULATED INSPECTION TOTALS. Round 1: 100 passes in 200 inspections, 50%. Round 2: 72 passes in 100 inspections, 72%. The totals are correctly calculated, but this extract gives no district counts.', 'old-town', 'simulated-data-table'), document('den1-protocol', 'What was sampled', 'SIMULATED PROTOCOL. Both Old Town and East Wharf were eligible. The number of inspections in each district could change between rounds. The supplied aggregate record does not state each district’s share.', 'east-wharf', 'simulated-method-note'), document('den1-caption', 'The broad interpretation', 'SIMULATED CAPTION. “The combined pass rate rose, so both districts improved.” The caption adds a district-level conclusion to an aggregate table without supplying district-level evidence.', 'old-town', 'simulated-claim')],
        reasons: [{ id: 'den1-missing', label: 'An aggregate change does not establish the direction within each district when the sample mix may change.' }, { id: 'den1-total-proves', label: 'A higher combined percentage mathematically requires every district to improve.' }, { id: 'den1-fewer', label: 'Fewer total inspections prove lower pass rates in every district.' }],
        verification: { question: 'Which additional information is needed to test the claim about both districts?', options: [{ id: 'district-counts', label: 'Passes and total inspections for each district in each round.' }, { id: 'rounded-total', label: 'The same combined percentages with more decimal places.' }, { id: 'bigger-title', label: 'A clearer title on the aggregate chart.' }] },
        verdict: 'insufficient', decisive: ['den1-total', 'den1-protocol'], reason: 'den1-missing', verificationAnswer: 'district-counts',
        explanation: 'The overall rise is supported, but the claim about both districts is not established. Changing sample proportions can change a total even when individual groups move differently. Do not label the district claim false before seeing its breakdown.',
        uncertainty: 'Either district may have improved or declined; the current snapshot cannot tell.', additionalMeasurement: 'Obtain the district-level counts for both rounds under the same inspection definition.', nextStageIntro: 'The district table has arrived. The earlier verdict stays fixed; assess the new evidence snapshot.',
      }),
      caseStage({ id: 'denominator-stage-2', weight: 60, claim: 'The higher combined inspection pass rate shows that the pass rate improved in both districts.',
        context: 'The exact district breakdown is now supplied. Compare rates within groups as well as the changing inspection mix.',
        evidence: [
          { ...document('den2-districts', 'The district results', 'SIMULATED TABLE. Old Town: 90 passes/100 inspections in round 1; 72/90 in round 2. East Wharf: 10/100 in round 1; 0/10 in round 2. Old Town fell from 90% to 80%; East Wharf fell from 10% to 0%. The denominator in each cell is inspections, not residents.', 'old-town', 'simulated-data-table'), table: { columns: ['District', 'Round 1 passes / inspections', 'Round 2 passes / inspections'], rows: [['Old Town', '90 / 100', '72 / 90'], ['East Wharf', '10 / 100', '0 / 10']] } },
          document('den2-total', 'The total remains correct', 'SIMULATED RECONCILIATION. Round 1 totals are 100/200=50%. Round 2 totals are 72/100=72%. The higher-pass-rate district contributed half of the first sample and nine-tenths of the second, explaining why the total rose while both district rates fell.', 'old-town', 'simulated-computation'),
          document('den2-definition', 'The definition did not change', 'SIMULATED PROTOCOL CONFIRMATION. The same pass criterion was used in both rounds. Inspections were not a random sample of all properties, so these rates describe the inspected items and do not establish district-wide population rates.', 'east-wharf', 'simulated-method-note'),
        ],
        reasons: [{ id: 'den2-mix', label: 'The overall increase is real, but its changing mix conceals lower pass rates within both districts.' }, { id: 'den2-arithmetic', label: 'The aggregate arithmetic must be wrong because both district rates declined.' }, { id: 'den2-population', label: 'The inspection totals establish exact failure rates for every resident.' }],
        verification: { question: 'What happened to Old Town’s pass rate?', options: [{ id: 'down-ten', label: 'It fell 10 percentage points, from 90% to 80%.' }, { id: 'up-twenty-two', label: 'It rose 22 percentage points, like the aggregate.' }, { id: 'unchanged', label: 'It stayed the same because most round-2 inspections were there.' }] },
        verdict: 'misleading', decisive: ['den2-districts', 'den2-total'], reason: 'den2-mix', verificationAnswer: 'down-ten',
        explanation: 'The combined statistic is true; the attached claim of improvement in both districts is false. The overall presentation is misleading because it uses the changed inspection mix to imply within-district gains that did not occur. The new table justifies changing the earlier insufficient-evidence verdict.',
        uncertainty: 'These are rates among inspected items, not estimates for all properties or residents.', additionalMeasurement: 'Use a consistent sampling design and inspect why the district allocation changed before comparing population-level outcomes.',
      }),
    ],
  };
  const correctionCase = {
    ...metadata('correction-record', 'The correction that stayed visible', ['date-context', 'source-tracing'], 'intermediate'),
    dek: 'A transparent correction preserves the original record.', estimatedMinutes: [3, 6], context: { place: 'Fictional Merehaven notice desk', date: '2031-10-16', label },
    stages: [caseStage({ id: 'correction-stage', claim: 'This notice corrected the trial’s start time after publication while keeping its original publication time visible.',
      context: 'A fictional notice, its revision record and its source schedule are supplied. Assess the described correction, not whether all changes by a publisher are reliable.',
      evidence: [
        { ...document('corr-current', 'Current notice and correction block', 'SIMULATED NOTICE. Published October 16, 08:00 UTC. Updated 08:35 UTC. The trial begins at 10:00 UTC. Correction: “An earlier version stated 09:00. The source schedule specifies 10:00. We corrected the start time at 08:35.” Both publication and correction times remain displayed.', 'north-works', 'simulated-correction'), timestamps: [{ label: 'Original publication', value: '2031-10-16T08:00:00Z' }, { label: 'Correction', value: '2031-10-16T08:35:00Z' }, { label: 'Correct trial start', value: '2031-10-16T10:00:00Z' }] },
        document('corr-history', 'Version record', 'SIMULATED VERSION LOG. Revision 1, 08:00: trial start 09:00. Revision 2, 08:35: trial start 10:00; original publication field remains 08:00; visible correction note added. The earlier wording is retained in this record.', 'north-works', 'simulated-version-history'),
        document('corr-schedule', 'Trial schedule', 'SIMULATED SOURCE SCHEDULE. Issued October 15 at 17:00 UTC: the October 16 trial begins at 10:00 UTC. This schedule supports the corrected event time; it is not the notice’s publication timestamp.', 'north-works', 'simulated-source-record', '2031-10-15T17:00:00Z'),
      ],
      reasons: [{ id: 'corr-visible', label: 'The visible correction and version log distinguish original publication, correction and event time.' }, { id: 'corr-erased', label: 'Any correction means the original publication date was erased.' }, { id: 'corr-event-time', label: 'The trial’s 10:00 start is also the time the notice first appeared.' }],
      verification: { question: 'Which time belongs to the notice’s original publication?', options: [{ id: 'eight', label: '08:00 UTC.' }, { id: 'eight-thirty-five', label: '08:35 UTC.' }, { id: 'ten', label: '10:00 UTC.' }] },
      verdict: 'supported', decisive: ['corr-current', 'corr-history'], reason: 'corr-visible', verificationAnswer: 'eight',
      explanation: 'The supplied record supports the narrow claim: a correction was made after publication and the original publication time remained visible. The source schedule separately supports the corrected start time. Keeping the earlier error in a labeled history is transparency, not a renewed assertion of that error.',
      uncertainty: 'This establishes the handling of this correction, not a universal reliability judgment about the publisher.', additionalMeasurement: 'If the trial schedule changes again, obtain a new source revision and add another dated correction rather than rewriting the original event history.',
    })],
  };
  const silentCase = {
    ...metadata('silent-sensor', 'The quiet sensor', ['statistics', 'source-context', 'date-context'], 'intermediate'),
    dek: 'No recorded events can mean no usable record.', estimatedMinutes: [4, 7], context: { place: 'Reed Marsh, fictional Merehaven', date: '2031-10-17', label },
    stages: [caseStage({ id: 'silent-stage', claim: 'Zero logged threshold events establishes that the Reed Marsh depth stayed below 0.20 m throughout the hour.',
      context: 'These are authored fictional logger records for a source-verification case, not output from the interactive physical model. The question is what the missing period permits you to conclude.',
      evidence: [
        document('silent-summary', 'The event-count export', 'SIMULATED LOGGER EXPORT. Window 09:00–10:00 UTC. Logged threshold events: 0. Event threshold: depth strictly greater than 0.20 m. The summary counts received event messages; it does not itself report sensor uptime or fill absent data.', 'reed-marsh', 'simulated-data-export'),
        document('silent-uptime', 'Communication and sample log', 'SIMULATED UPTIME LOG. A 0.12 m reading was received at 09:00. The sensor then lost power until 09:50, when a 0.13 m reading arrived. No samples or event messages exist for 09:01–09:49. Those missing values are marked unavailable, not zero.', 'reed-marsh', 'simulated-uptime-record'),
        document('silent-photograph', 'A photograph after the gap', 'SIMULATED FIELD PHOTO NOTE. A photograph at 09:55 shows the gauge reading 0.13 m. It supports conditions at that time. It does not reconstruct the maximum reached during the missing interval.', 'reed-marsh', 'simulated-photo-note', '2031-10-17T09:55:00Z'),
      ],
      reasons: [{ id: 'silent-gap', label: 'The event count has a long data gap, so no messages cannot establish no threshold crossing.' }, { id: 'silent-zero', label: 'The number zero means the water depth itself was zero throughout the hour.' }, { id: 'silent-later', label: 'The later low photograph proves the earlier maximum was also low.' }],
      verification: { question: 'How should the unsampled 09:01–09:49 interval appear in an evidence graph?', options: [{ id: 'gap', label: 'As missing data with a visible gap.' }, { id: 'zero-line', label: 'As a continuous zero-depth line.' }, { id: 'smooth-certain', label: 'As a smooth line treated as observed throughout.' }] },
      verdict: 'insufficient', decisive: ['silent-summary', 'silent-uptime'], reason: 'silent-gap', verificationAnswer: 'gap',
      explanation: 'Zero received event messages is compatible with a threshold crossing during the outage. It is also compatible with no crossing. The later low reading cannot resolve the gap, so the whole-hour claim remains unestablished. Missing values must stay visibly distinct from measured zeros.',
      uncertainty: 'The maximum depth during the power loss is unknown; the supplied evidence does not establish either a crossing or its absence.', additionalMeasurement: 'Seek an independent continuous logger or a time-matched physical high-water indicator with documented interpretation limits.',
    })],
  };
  const cases = [archiveCase, echoCase, axisCase, denominatorCase, correctionCase, silentCase];
  const quickChecks = [
  {
    "id": "q01-completed-departures",
    "title": "Six departures, eight slots",
    "skillTags": [
      "source-tracing",
      "statistics"
    ],
    "difficulty": "introductory",
    "claim": "Six of the eight scheduled Old Town shuttle departures in the 09:00–12:00 window actually left the stop.",
    "context": "Fictional Merehaven case. A dispatch summary describes one morning window, not the whole day. All clocks are the same local clock.",
    "evidence": [
      {
        "id": "q01-e2",
        "title": "Schedule and status key",
        "body": "The 09:00–12:00 schedule contains eight slots, A through H. G and H are CANCELLED. LEFT STOP means a vehicle departed; a scheduled slot alone is not a completed trip.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q01-e3",
        "title": "Fleet roster",
        "body": "Eight vehicles were assigned to the depot that morning. Two were spare vehicles and could be reassigned.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q01-e1",
        "title": "Departure event log",
        "body": "Vehicle gate records: A 09:10; B 09:40; C 10:10; D 10:40; E 11:10; F 11:40. Each entry is marked LEFT STOP. No other departures appear in this window.",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q01-r3",
        "label": "The canceled slots should be counted as departures because they remained on the schedule."
      },
      {
        "id": "q01-r1",
        "label": "The event log records six actual departures and the schedule defines eight eligible slots."
      },
      {
        "id": "q01-r2",
        "label": "Eight rostered vehicles establish that all eight scheduled departures ran."
      }
    ],
    "verification": {
      "question": "How many of the eight slots have a LEFT STOP event?",
      "options": [
        {
          "id": "q01-v1",
          "label": "Six"
        },
        {
          "id": "q01-v2",
          "label": "Eight"
        },
        {
          "id": "q01-v3",
          "label": "Two"
        }
      ],
      "answer": "q01-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q01-e1",
        "q01-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q01-r1",
      "verificationAnswer": "q01-v1"
    },
    "explanation": "The schedule supplies the denominator and the gate log supplies the completed events. Six of eight is supported for this exact window.",
    "uncertainty": "The records do not establish arrival times, passenger counts, or service for the rest of the day.",
    "additionalMeasurement": "Request arrival logs matched to the six departure IDs before making an on-time-arrival claim."
  },
  {
    "id": "q02-closure-order",
    "title": "One clock, two events",
    "skillTags": [
      "date-context",
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "The pedestrian bridge closure notice was published before staff physically closed the gate.",
    "context": "Fictional Merehaven case. This checks event order at Reed Marsh, not whether every pedestrian received the notice.",
    "evidence": [
      {
        "id": "q02-e3",
        "title": "Footpath maintenance plan",
        "body": "The maintenance plan proposed a closure around 10:00. It was drafted a week earlier and is not an event log.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q02-e1",
        "title": "Notice publication receipt",
        "body": "The public notice CMS records BR-12 as first published at 10:10 on October 14. A 10:31 timestamp is a spelling correction, not first publication.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q02-e2",
        "title": "Gate operations log",
        "body": "For BR-12, the marsh gate was secured at 10:24 on October 14. The gate log and CMS both use the same local clock; neither record reports a clock fault.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q02-r1",
        "label": "The first-publication receipt precedes the actual gate event by fourteen minutes."
      },
      {
        "id": "q02-r2",
        "label": "The later spelling-correction timestamp must be used as the notice publication time."
      },
      {
        "id": "q02-r3",
        "label": "The planned 10:00 closure overrides the gate event recorded on the day."
      }
    ],
    "verification": {
      "question": "Which interval follows from the two event records?",
      "options": [
        {
          "id": "q02-v2",
          "label": "The notice followed gate closure by 7 minutes."
        },
        {
          "id": "q02-v3",
          "label": "Gate closure and notice publication were simultaneous."
        },
        {
          "id": "q02-v1",
          "label": "The notice preceded gate closure by 14 minutes."
        }
      ],
      "answer": "q02-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q02-e1",
        "q02-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q02-r1",
      "verificationAnswer": "q02-v1"
    },
    "explanation": "First publication at 10:10 precedes the 10:24 gate closure. A later page edit does not reverse that sequence.",
    "uncertainty": "Publication does not demonstrate that a particular person saw or understood the notice.",
    "additionalMeasurement": "Use an audience-delivery or acknowledgment record to investigate who received the notice."
  },
  {
    "id": "q03-completed-interviews",
    "title": "Who is in the denominator?",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "Half of the completed unique interviews in the Wharf access study favored the evening entrance.",
    "context": "Fictional Merehaven case. The assertion is deliberately limited to completed interviews rather than all Wharf residents.",
    "evidence": [
      {
        "id": "q03-e1",
        "title": "Clean interview tally",
        "body": "The final coded rows show 45 favors-evening, 30 favors-morning and 15 no-preference responses. Every row has a distinct completed-interview ID.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q03-e2",
        "title": "Fieldwork reconciliation",
        "body": "There were 120 contact attempts. Thirty produced no completed interview. The analysis denominator is the 90 unique completed interviews; repeat contact attempts are excluded.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q03-e3",
        "title": "Recruitment map",
        "body": "Recruiters worked at two Wharf entrances over three evenings. No claim of random population sampling was made.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q03-r2",
        "label": "Forty-five should be divided by all 120 contact attempts because nonresponders count as opposition."
      },
      {
        "id": "q03-r3",
        "label": "The recruitment map makes the interview result a representative estimate for every resident."
      },
      {
        "id": "q03-r1",
        "label": "Forty-five favorable interviews out of ninety completed unique interviews is one half."
      }
    ],
    "verification": {
      "question": "What denominator matches the claim?",
      "options": [
        {
          "id": "q03-v3",
          "label": "45 favorable interviews"
        },
        {
          "id": "q03-v1",
          "label": "90 completed unique interviews"
        },
        {
          "id": "q03-v2",
          "label": "120 contact attempts"
        }
      ],
      "answer": "q03-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q03-e1",
        "q03-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q03-r1",
      "verificationAnswer": "q03-v1"
    },
    "explanation": "The tally and reconciliation support 45/90, or 50%, among the completed interviews. The narrow wording keeps that arithmetic separate from population inference.",
    "uncertainty": "The nonrandom recruitment and missing responses prevent a claim about all Wharf residents.",
    "additionalMeasurement": "A defined probability sample with response follow-up would be needed for a population estimate."
  },
  {
    "id": "q04-storage-permit",
    "title": "The boundary of a permit",
    "skillTags": [
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "The Works permit authorizes indoor storage but does not itself authorize outdoor discharge.",
    "context": "Fictional Merehaven case. The following permit documents are invented educational records, not legal guidance.",
    "evidence": [
      {
        "id": "q04-e2",
        "title": "Conditions Appendix C",
        "body": "NW-44 Appendix C: this permit grants no authorization for outdoor liquid discharge. A separate discharge approval would be required; none is incorporated here.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q04-e3",
        "title": "Application cover letter",
        "body": "The applicant originally requested indoor storage and an outdoor washing area. Requested activities are not the same as issued approvals.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q04-e1",
        "title": "Issued permit scope",
        "body": "Permit NW-44 authorizes dry indoor equipment storage in Building B. The document identifies Conditions Appendix C as part of the issued permit.",
        "kind": "fictional-record",
        "featureId": "north-works"
      }
    ],
    "reasons": [
      {
        "id": "q04-r3",
        "label": "An appendix cannot limit the main document even when the permit incorporates it."
      },
      {
        "id": "q04-r1",
        "label": "The issued scope and incorporated conditions authorize one activity while expressly excluding the other."
      },
      {
        "id": "q04-r2",
        "label": "Both requested activities were authorized when the application was received."
      }
    ],
    "verification": {
      "question": "Which activity does NW-44 itself authorize?",
      "options": [
        {
          "id": "q04-v1",
          "label": "Dry indoor equipment storage in Building B"
        },
        {
          "id": "q04-v2",
          "label": "Outdoor liquid discharge from the washing area"
        },
        {
          "id": "q04-v3",
          "label": "Every activity in the original application"
        }
      ],
      "answer": "q04-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q04-e1",
        "q04-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q04-r1",
      "verificationAnswer": "q04-v1"
    },
    "explanation": "The issued permit and its incorporated conditions support this limited description. The broader application request does not expand the issued scope.",
    "uncertainty": "These two documents do not establish whether a separate approval exists elsewhere or whether any discharge occurred.",
    "additionalMeasurement": "Search the separately issued approval register before making a claim about every authorization held by the site."
  },
  {
    "id": "q05-invoice-credit",
    "title": "Count the credit once",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "After the linked credit, the two listed boardwalk invoices have a combined invoiced value of 1,800 credits.",
    "context": "Fictional Merehaven case. Credits are fictional case currency. This is an invoice-total claim, not a statement that money was paid.",
    "evidence": [
      {
        "id": "q05-e3",
        "title": "Annual spending plan",
        "body": "The annual boardwalk budget permits up to 2,500 credits. A spending limit is not a record of the invoice total.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q05-e1",
        "title": "Invoice register",
        "body": "Boardwalk invoices BW-21 and BW-22 list 1,200 credits and 800 credits. The register marks BW-22 as linked to credit note CN-8 and lists no other adjustment.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q05-e2",
        "title": "Credit note CN-8",
        "body": "CN-8 reduces BW-22 by 200 credits for returned materials. It is a credit adjustment, not a third purchase or a cash-payment receipt.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q05-r1",
        "label": "The two invoices total 2,000 and their one linked credit reduces that by 200."
      },
      {
        "id": "q05-r2",
        "label": "The annual budget should replace the invoice amounts because it is the authorized maximum."
      },
      {
        "id": "q05-r3",
        "label": "The credit note is another expense and should be added to both invoices."
      }
    ],
    "verification": {
      "question": "Which calculation matches the linked records?",
      "options": [
        {
          "id": "q05-v2",
          "label": "1,200 + 800 + 200 = 2,200"
        },
        {
          "id": "q05-v3",
          "label": "2,500 − 200 = 2,300"
        },
        {
          "id": "q05-v1",
          "label": "1,200 + 800 − 200 = 1,800"
        }
      ],
      "answer": "q05-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q05-e1",
        "q05-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q05-r1",
      "verificationAnswer": "q05-v1"
    },
    "explanation": "The claim correctly describes the adjusted invoiced amount, using the linked credit once. Neither document proves payment.",
    "uncertainty": "Payment status, delivery quality and unrelated invoices are outside this calculation.",
    "additionalMeasurement": "Match the invoice IDs to payment confirmations to establish what was actually paid."
  },
  {
    "id": "q06-stable-audit-rate",
    "title": "A comparison with the same scope",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "The share of inspected town lamps that failed the same checklist declined between the two audits.",
    "context": "Fictional Merehaven case. Only the audited lamp groups and checklist are being compared.",
    "evidence": [
      {
        "id": "q06-e1",
        "title": "Audit results",
        "body": "October audit: 12 failures among 60 inspected lamps. November audit: 6 failures among 60 inspected lamps. Every inspected lamp received a pass or fail result.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q06-e2",
        "title": "Audit protocol and roster",
        "body": "Both audits used checklist L-3 and the same fixed roster of 60 lamps. No lamp was replaced or removed from the roster between these two counts.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q06-e3",
        "title": "Repair procurement email",
        "body": "A supplier proposed a bulk purchase of 30 lamps. The email does not record completed repairs or changes to the audit roster.",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q06-r2",
        "label": "The procurement proposal proves that exactly thirty lamps were repaired before November."
      },
      {
        "id": "q06-r3",
        "label": "Equal audit sizes mean the failure share could not have changed."
      },
      {
        "id": "q06-r1",
        "label": "The matched protocol and denominator make the recorded fall from 20% to 10% comparable."
      }
    ],
    "verification": {
      "question": "What happened to the recorded failure share?",
      "options": [
        {
          "id": "q06-v3",
          "label": "It remained 20% in both audits."
        },
        {
          "id": "q06-v1",
          "label": "It fell from 20% to 10%."
        },
        {
          "id": "q06-v2",
          "label": "It fell from 12% to 6%."
        }
      ],
      "answer": "q06-v1"
    },
    "rubric": {
      "verdict": "supported",
      "decisiveEvidenceIds": [
        "q06-e1",
        "q06-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q06-r1",
      "verificationAnswer": "q06-v1"
    },
    "explanation": "The result table supplies counts, and the protocol confirms a common checklist and roster. That supports a decline within this audited group.",
    "uncertainty": "The records do not isolate which repair or environmental change caused the decline.",
    "additionalMeasurement": "Link dated completed-repair records to individual lamp IDs to examine possible mechanisms."
  },
  {
    "id": "q07-complaint-surge",
    "title": "A surge from a small base",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "Complaints tripled, showing that worsening access problems are spreading across Merehaven.",
    "context": "Fictional Merehaven case. A post uses a correct count change to describe the whole fictional town.",
    "evidence": [
      {
        "id": "q07-e2",
        "title": "Intake definitions",
        "body": "These are complaint submissions, not a count of affected people or separate sites. The desk began accepting online complaints in week two; coverage is not a representative town survey.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q07-e3",
        "title": "Population summary",
        "body": "The fictional town register contains 1,200 households. It does not indicate which households experienced an access problem.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q07-e1",
        "title": "Complaint intake counts",
        "body": "The town desk received one access complaint in week one and three in week two. All four describe the same blocked doorway on Mill Lane.",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q07-r3",
        "label": "Online submissions must be discarded because digital complaints cannot be evidence."
      },
      {
        "id": "q07-r1",
        "label": "The tripling is arithmetically true, but a small submission count at one doorway does not show problems spreading townwide."
      },
      {
        "id": "q07-r2",
        "label": "A 200% increase necessarily means most households were affected."
      }
    ],
    "verification": {
      "question": "How many distinct problem sites are identified by these four submissions?",
      "options": [
        {
          "id": "q07-v1",
          "label": "One doorway"
        },
        {
          "id": "q07-v2",
          "label": "Three neighborhoods"
        },
        {
          "id": "q07-v3",
          "label": "1,200 households"
        }
      ],
      "answer": "q07-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q07-e1",
        "q07-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q07-r1",
      "verificationAnswer": "q07-v1"
    },
    "explanation": "The true one-to-three change is framed as evidence of geographic spread. Site identity, channel change and the tiny base make that larger implication misleading.",
    "uncertainty": "Other problems may exist; these records neither locate them nor measure their frequency.",
    "additionalMeasurement": "Collect consistently defined site-level reports across the town and deduplicate repeat complaints."
  },
  {
    "id": "q08-selected-voices",
    "title": "Two voices become the whole Wharf",
    "skillTags": [
      "source-tracing",
      "statistics"
    ],
    "difficulty": "intermediate",
    "claim": "Wharf interviewees reject the evening gate proposal, a montage of two opposing interviews declares.",
    "context": "Fictional Merehaven case. The montage uses genuine excerpts but presents them as the position of the interview group.",
    "evidence": [
      {
        "id": "q08-e3",
        "title": "Production schedule",
        "body": "All eight interviews were filmed on the same afternoon. Equal recording dates do not make an edited subset representative.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q08-e1",
        "title": "Published montage transcript",
        "body": "The published segment contains interviews W-3 and W-7. Both speakers oppose the evening gate. Its closing caption reads: “The Wharf interviewees say no.”",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q08-e2",
        "title": "Complete interview index",
        "body": "Eight interviews were completed for this segment. W-3 and W-7 opposed the proposal; the other six favored it. The published montage contains none of those six responses.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q08-r1",
        "label": "The two excerpts are authentic, but omitting six contrary interviews misrepresents the group being described."
      },
      {
        "id": "q08-r2",
        "label": "An interview stops being authentic whenever it is shortened for a montage."
      },
      {
        "id": "q08-r3",
        "label": "Two opposing speakers outweigh six supporting speakers because the published segment is the final record."
      }
    ],
    "verification": {
      "question": "What fraction of the completed interview group appears in the opposing montage?",
      "options": [
        {
          "id": "q08-v2",
          "label": "6 of 8"
        },
        {
          "id": "q08-v3",
          "label": "8 of 8"
        },
        {
          "id": "q08-v1",
          "label": "2 of 8"
        }
      ],
      "answer": "q08-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q08-e1",
        "q08-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q08-r1",
      "verificationAnswer": "q08-v1"
    },
    "explanation": "The problem is selection, not fabrication of the two quotations. The full index contradicts the montage’s implication about its own interview group.",
    "uncertainty": "Even the complete eight interviews would not automatically represent all Wharf residents.",
    "additionalMeasurement": "Publish the full selection method and response distribution; use a suitable sample for broader opinion claims."
  },
  {
    "id": "q09-reclassified-backlog",
    "title": "A smaller column, not more repairs",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "The overdue-work column halved, demonstrating a major repair breakthrough at the marsh.",
    "context": "Fictional Merehaven case. Two weekly summaries use a changed reporting classification.",
    "evidence": [
      {
        "id": "q09-e1",
        "title": "Weekly backlog tables",
        "body": "Week one lists 100 jobs in the overdue-work column. Week two lists 50. Both weekly tables are authentic exports from the maintenance register.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q09-e2",
        "title": "Change and completion log",
        "body": "Between those exports, fifty still-open jobs were moved to a new “awaiting materials” column. No job was marked completed during the interval. The remaining fifty stayed in overdue-work.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q09-e3",
        "title": "Materials purchase request",
        "body": "A request for supplies was approved during the interval. Approval does not record receipt of materials or completed work.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q09-r2",
        "label": "Every job moved out of the overdue column must count as completed."
      },
      {
        "id": "q09-r3",
        "label": "The two authentic exports establish that no real reduction in overdue work could ever occur."
      },
      {
        "id": "q09-r1",
        "label": "The column count fell because open jobs were reclassified, so presenting it as repair progress omits the decisive change in definition."
      }
    ],
    "verification": {
      "question": "How many jobs does the completion log mark completed in this interval?",
      "options": [
        {
          "id": "q09-v3",
          "label": "One hundred"
        },
        {
          "id": "q09-v1",
          "label": "Zero"
        },
        {
          "id": "q09-v2",
          "label": "Fifty"
        }
      ],
      "answer": "q09-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q09-e1",
        "q09-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q09-r1",
      "verificationAnswer": "q09-v1"
    },
    "explanation": "The drop in the named column is real, but the completion log shows a classification change rather than completed repairs. The breakthrough framing is misleading.",
    "uncertainty": "The reclassification may improve administration; that separate benefit is not measured here.",
    "additionalMeasurement": "Track completed jobs and all unresolved jobs under stable definitions before comparing repair progress."
  },
  {
    "id": "q10-different-wait-clocks",
    "title": "Two waiting times with different starts",
    "skillTags": [
      "statistics",
      "date-context"
    ],
    "difficulty": "intermediate",
    "claim": "The clinic’s reported average service wait fell from twenty minutes to ten, showing the entire patient wait has halved.",
    "context": "Fictional Merehaven case. A chart joins two administrative metrics without explaining a clock-definition change.",
    "evidence": [
      {
        "id": "q10-e2",
        "title": "Metric definition change",
        "body": "The old measure ran from arrival to clinician entry. The new measure starts only after registration finishes. Registration time is excluded from the newer ten-minute value; no comparable new arrival-to-clinician average was collected.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q10-e3",
        "title": "Staff rota",
        "body": "The clinic added one registration clerk. Staffing changes alone do not provide the missing arrival-to-clinician measurements.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q10-e1",
        "title": "Published chart and source rows",
        "body": "The prior monthly row reports 20 minutes on average. The newer row reports 10 minutes. The chart labels both “service wait.”",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q10-r3",
        "label": "The new registration clerk proves exactly ten minutes were removed from every visit."
      },
      {
        "id": "q10-r1",
        "label": "Both reported numbers are real, but different clock starts prevent the claimed whole-wait comparison."
      },
      {
        "id": "q10-r2",
        "label": "Subtracting any two values expressed in minutes always yields a valid service improvement."
      }
    ],
    "verification": {
      "question": "What part of a visit is excluded from the newer metric?",
      "options": [
        {
          "id": "q10-v1",
          "label": "From arrival until registration finishes"
        },
        {
          "id": "q10-v2",
          "label": "The time after the clinician enters"
        },
        {
          "id": "q10-v3",
          "label": "The entire clinical consultation plus travel home"
        }
      ],
      "answer": "q10-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q10-e1",
        "q10-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q10-r1",
      "verificationAnswer": "q10-v1"
    },
    "explanation": "The newer value measures a narrower interval. Presenting a 20-to-10 comparison as halving the full wait conceals the changed starting point.",
    "uncertainty": "The full wait may have improved or worsened; a matched newer measure is absent.",
    "additionalMeasurement": "Record arrival, registration completion and clinician entry for the same defined cohort."
  },
  {
    "id": "q11-gross-and-net-access",
    "title": "More openings, omitted closures",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "Merehaven added ten accessible entrances this quarter, a progress card says without showing any losses.",
    "context": "Fictional Merehaven case. The card is framed as an increase in the total available entrances.",
    "evidence": [
      {
        "id": "q11-e3",
        "title": "Next-quarter plan",
        "body": "A draft proposes six more entrances. Planned entrances are not part of this quarter’s available stock.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q11-e1",
        "title": "New-entry register",
        "body": "Ten entrances became available this quarter. All ten passed the fictional accessibility checklist and are distinct entrance IDs.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q11-e2",
        "title": "Closure reconciliation",
        "body": "During the same quarter, eight previously available entrances closed permanently. Both registers use the same town boundary and availability definition. Starting stock was forty entrances.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q11-r1",
        "label": "Ten gross openings are real, but omitting eight closures exaggerates the net increase in available entrances."
      },
      {
        "id": "q11-r2",
        "label": "The ten new entrances should be ignored because any closure cancels all progress."
      },
      {
        "id": "q11-r3",
        "label": "The six planned entrances belong in this quarter’s completed total."
      }
    ],
    "verification": {
      "question": "What is the net change in available entrances?",
      "options": [
        {
          "id": "q11-v2",
          "label": "An increase of ten, from 40 to 50"
        },
        {
          "id": "q11-v3",
          "label": "An increase of sixteen, from 40 to 56"
        },
        {
          "id": "q11-v1",
          "label": "An increase of two, from 40 to 42"
        }
      ],
      "answer": "q11-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q11-e1",
        "q11-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q11-r1",
      "verificationAnswer": "q11-v1"
    },
    "explanation": "The opening count is correct. The progress card omits the matching closure count needed to understand the change in total availability.",
    "uncertainty": "An entrance count does not measure geographic distribution, opening hours or actual ease of use.",
    "additionalMeasurement": "Publish the full opening-and-closure reconciliation and an audit of access quality by location."
  },
  {
    "id": "q12-opt-in-opinion",
    "title": "The poll that chose its respondents",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "Sixty-two percent favor the barrier, so Merehaven residents back it, an open website poll announces.",
    "context": "Fictional Merehaven case. The quoted percentage is accurately computed from the website’s responses.",
    "evidence": [
      {
        "id": "q12-e1",
        "title": "Poll response export",
        "body": "The website received 100 completed responses: 62 favor, 30 oppose and 8 unsure. The displayed 62% matches these rows.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q12-e2",
        "title": "Poll recruitment note",
        "body": "The link was open to anyone who visited the campaign page. Respondents selected themselves; residency was not verified. The organizer did not draw a sample of Merehaven residents.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q12-e3",
        "title": "Poster circulation note",
        "body": "The campaign printed 200 posters containing the link. A poster count does not identify who responded or establish a representative sample.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q12-r2",
        "label": "Sixty-two favorable responses are mathematically fewer than half of one hundred."
      },
      {
        "id": "q12-r3",
        "label": "Every open online poll must contain fabricated responses."
      },
      {
        "id": "q12-r1",
        "label": "The percentage describes this opt-in response set, but the headline generalizes it to a population the poll did not sample."
      }
    ],
    "verification": {
      "question": "Which population does the 62% directly describe?",
      "options": [
        {
          "id": "q12-v3",
          "label": "Everyone who saw one of the 200 posters"
        },
        {
          "id": "q12-v1",
          "label": "The 100 completed website responses"
        },
        {
          "id": "q12-v2",
          "label": "All verified Merehaven residents"
        }
      ],
      "answer": "q12-v1"
    },
    "rubric": {
      "verdict": "misleading",
      "decisiveEvidenceIds": [
        "q12-e1",
        "q12-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q12-r1",
      "verificationAnswer": "q12-v1"
    },
    "explanation": "The calculation is correct but the scope is misleading. An unverified, self-selected response group does not supply the stated resident-wide estimate.",
    "uncertainty": "The residents’ actual distribution of opinion remains unknown from this poll.",
    "additionalMeasurement": "Use a clearly defined resident sampling frame and document nonresponse before estimating townwide opinion."
  },
  {
    "id": "q13-depth-conversion",
    "title": "A decimal becomes a meter",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "The supplied Wharf ruler record shows 120 centimetres of standing water.",
    "context": "Fictional Merehaven case. These are authored ruler-log values, not outputs from the numerical game engine.",
    "evidence": [
      {
        "id": "q13-e2",
        "title": "Instrument sheet",
        "body": "The W-19 depth column is in metres. The case conversion guide states 1 metre = 100 centimetres.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q13-e3",
        "title": "Ramp dimensions",
        "body": "The ramp is 120 centimetres wide. Width and water depth are different fields in the inspection record.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q13-e1",
        "title": "Ruler reading row",
        "body": "Wharf inspection W-19 records depth 0.12 in the depth column at the loading ramp. The row has no alternate depth entry.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q13-r3",
        "label": "The decimal can be dropped whenever metres are converted to centimetres."
      },
      {
        "id": "q13-r1",
        "label": "The reading is 0.12 metres, which is 12 centimetres; the claim is off by a factor of ten."
      },
      {
        "id": "q13-r2",
        "label": "The ramp width supplies the depth because both are lengths."
      }
    ],
    "verification": {
      "question": "Convert the recorded depth into centimetres.",
      "options": [
        {
          "id": "q13-v1",
          "label": "12 centimetres"
        },
        {
          "id": "q13-v2",
          "label": "120 centimetres"
        },
        {
          "id": "q13-v3",
          "label": "1.2 centimetres"
        }
      ],
      "answer": "q13-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q13-e1",
        "q13-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q13-r1",
      "verificationAnswer": "q13-v1"
    },
    "explanation": "The reading and unit definition directly contradict 120 centimetres. The correct conversion is 0.12 × 100 = 12.",
    "uncertainty": "One ruler reading does not establish the depth elsewhere on the ramp or at other times.",
    "additionalMeasurement": "Take a documented set of depth readings across the location if a spatial depth claim is needed."
  },
  {
    "id": "q14-chart-series-key",
    "title": "The wrong bar gets the headline",
    "skillTags": [
      "visual-evidence",
      "statistics"
    ],
    "difficulty": "intermediate",
    "claim": "The October chart records 85 millimetres at East Wharf.",
    "context": "Fictional Merehaven case. The evidence packet describes the chart’s exported values and its legend; no model prediction is involved.",
    "evidence": [
      {
        "id": "q14-e3",
        "title": "Previous chart style guide",
        "body": "An older, retired chart template used amber for Old Town. It was not used for revision R4.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q14-e1",
        "title": "Chart export values",
        "body": "October plot: blue series = 85 mm; amber series = 58 mm. The underlying data export agrees with both bar heights.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q14-e2",
        "title": "Legend and station key",
        "body": "Chart revision R4 assigns blue to Old Town station OT-1 and amber to East Wharf station EW-1. The displayed October chart is revision R4.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q14-r1",
        "label": "The current legend assigns 58 mm to East Wharf; 85 mm belongs to Old Town."
      },
      {
        "id": "q14-r2",
        "label": "The retired template overrides the legend on the actual chart."
      },
      {
        "id": "q14-r3",
        "label": "The taller bar must represent the station named first in a headline."
      }
    ],
    "verification": {
      "question": "Which value belongs to East Wharf in revision R4?",
      "options": [
        {
          "id": "q14-v2",
          "label": "85 mm"
        },
        {
          "id": "q14-v3",
          "label": "143 mm"
        },
        {
          "id": "q14-v1",
          "label": "58 mm"
        }
      ],
      "answer": "q14-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q14-e1",
        "q14-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q14-r1",
      "verificationAnswer": "q14-v1"
    },
    "explanation": "Reading the values together with the current series key gives 58 mm for East Wharf, so the specific claim is false.",
    "uncertainty": "This checks the chart attribution, not calibration or representativeness of either gauge.",
    "additionalMeasurement": "Inspect calibration and station exposure records before assessing measurement quality."
  },
  {
    "id": "q15-application-is-not-approval",
    "title": "Pending is not issued",
    "skillTags": [
      "source-tracing",
      "date-context"
    ],
    "difficulty": "intermediate",
    "claim": "The replacement Works storage permit was already issued on October 12.",
    "context": "Fictional Merehaven case. All records are fictional administrative documents with a shared local calendar.",
    "evidence": [
      {
        "id": "q15-e1",
        "title": "Application receipt",
        "body": "A replacement storage permit application was received October 11 and assigned NW-52. The receipt states: application received; no permit issued by this receipt.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q15-e2",
        "title": "Decision register",
        "body": "NW-52 remained PENDING throughout October 12. The register records the permit’s first issuance on October 15, with an effective date of October 15.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q15-e3",
        "title": "Applicant press note",
        "body": "An October 12 note says the application has been submitted. It does not contain an issued permit or an approval reference.",
        "kind": "fictional-record",
        "featureId": "north-works"
      }
    ],
    "reasons": [
      {
        "id": "q15-r2",
        "label": "Receiving an application automatically makes its requested replacement effective."
      },
      {
        "id": "q15-r3",
        "label": "A public note can change the decision register’s issuance date without an issued document."
      },
      {
        "id": "q15-r1",
        "label": "The application receipt is not an approval, and the decision register places issuance on October 15."
      }
    ],
    "verification": {
      "question": "What is the recorded first-issuance date?",
      "options": [
        {
          "id": "q15-v3",
          "label": "October 12"
        },
        {
          "id": "q15-v1",
          "label": "October 15"
        },
        {
          "id": "q15-v2",
          "label": "October 11"
        }
      ],
      "answer": "q15-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q15-e1",
        "q15-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q15-r1",
      "verificationAnswer": "q15-v1"
    },
    "explanation": "The dated receipt and decision register directly contradict issuance by October 12. This says nothing about unrelated authorizations.",
    "uncertainty": "The packet does not inventory every authorization the Works may hold.",
    "additionalMeasurement": "Consult the issued-permit register for each separate activity before making a broader authorization claim."
  },
  {
    "id": "q16-every-route-running",
    "title": "A claim about every route",
    "skillTags": [
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "Every route in the afternoon school shuttle plan operated.",
    "context": "Fictional Merehaven case. The plan and dispatch log refer to the same afternoon and the same four routes.",
    "evidence": [
      {
        "id": "q16-e2",
        "title": "Final dispatch log",
        "body": "A, C and D are marked OPERATED. B is marked CANCELLED—NO VEHICLE DEPARTED. These are final statuses, not provisional assignments.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q16-e3",
        "title": "Spare-driver roster",
        "body": "One spare driver was available that afternoon. The roster does not record the departure of an additional vehicle.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q16-e1",
        "title": "Afternoon route plan",
        "body": "The school shuttle plan contains routes A, B, C and D. “Every route” in the summary refers to these four routes.",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q16-r3",
        "label": "Three operating routes are sufficient to describe all four as operating."
      },
      {
        "id": "q16-r1",
        "label": "The final record contains one canceled route from the defined four-route plan, contradicting every route."
      },
      {
        "id": "q16-r2",
        "label": "An available spare driver means the canceled route must have run."
      }
    ],
    "verification": {
      "question": "Which planned route did not operate?",
      "options": [
        {
          "id": "q16-v1",
          "label": "Route B"
        },
        {
          "id": "q16-v2",
          "label": "Route C"
        },
        {
          "id": "q16-v3",
          "label": "No route was canceled"
        }
      ],
      "answer": "q16-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q16-e1",
        "q16-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q16-r1",
      "verificationAnswer": "q16-v1"
    },
    "explanation": "Matching the plan to the final statuses establishes a specific exception. A claim about every route is therefore false.",
    "uncertainty": "The documents do not show passenger alternatives or whether all children reached their destinations.",
    "additionalMeasurement": "Use passenger-transfer and arrival records to investigate the effects of the cancellation."
  },
  {
    "id": "q17-one-origin-three-reposts",
    "title": "Three links, one measurement",
    "skillTags": [
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "Three independent measurements corroborate the marsh reading.",
    "context": "Fictional Merehaven case. A post cites three different web addresses as if each were a separate measurement.",
    "evidence": [
      {
        "id": "q17-e3",
        "title": "Website ownership list",
        "body": "The three websites have different publishers. Different publishers do not by themselves create additional physical measurements.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q17-e1",
        "title": "Citation chain",
        "body": "The three cited pages are Notice N-7, the Town Digest copy of N-7, and the Footpath Forum screenshot of the Digest. Both later pages identify N-7 as their source.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q17-e2",
        "title": "Original record identity",
        "body": "N-7 contains one authored field reading, record MR-08, from one instrument at one time. All three cited pages repeat the same MR-08 identifier and value; none includes another measurement ID.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q17-r1",
        "label": "All three citations trace to the same original reading, so they are not three independent measurements."
      },
      {
        "id": "q17-r2",
        "label": "Different domain names always imply independent measuring instruments."
      },
      {
        "id": "q17-r3",
        "label": "A repeated reading becomes independent when its screenshot has a new upload date."
      }
    ],
    "verification": {
      "question": "How many distinct measurement IDs appear in the three cited sources?",
      "options": [
        {
          "id": "q17-v2",
          "label": "Three, one for each website"
        },
        {
          "id": "q17-v3",
          "label": "Two, because the screenshot is a new file"
        },
        {
          "id": "q17-v1",
          "label": "One: MR-08"
        }
      ],
      "answer": "q17-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q17-e1",
        "q17-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q17-r1",
      "verificationAnswer": "q17-v1"
    },
    "explanation": "The citation chain and shared record identity directly contradict the count of independent measurements. Repetition can amplify a source without corroborating it.",
    "uncertainty": "The one original reading may be accurate; this check does not establish its calibration or accuracy.",
    "additionalMeasurement": "Obtain a separately documented measurement with its own instrument, time and provenance."
  },
  {
    "id": "q18-missing-negation",
    "title": "The sentence with its condition removed",
    "skillTags": [
      "source-tracing",
      "visual-evidence"
    ],
    "difficulty": "intermediate",
    "claim": "The meeting record says the new Wharf gate is open for use now.",
    "context": "Fictional Merehaven case. An excerpt card circulates beside a complete caption transcript from the same fictional recording.",
    "evidence": [
      {
        "id": "q18-e1",
        "title": "Circulating excerpt",
        "body": "The card presents the words “the gate is open” from meeting video WG-4 and claims they announce immediate public opening.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q18-e2",
        "title": "Continuous caption transcript",
        "body": "WG-4, 12:41–12:48: “Do not tell visitors the gate is open. It remains closed until the inspection is signed.” The recording index places the quoted fragment inside this uninterrupted statement.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q18-e3",
        "title": "Construction completion note",
        "body": "The gate hardware was installed before the meeting. Installation alone does not establish permission for public use.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q18-r2",
        "label": "Installing the hardware makes any later closure instruction irrelevant."
      },
      {
        "id": "q18-r3",
        "label": "The shorter excerpt always controls because it repeats the exact three words."
      },
      {
        "id": "q18-r1",
        "label": "The uninterrupted statement explicitly says the gate remains closed; removing its negation reverses the meaning."
      }
    ],
    "verification": {
      "question": "What condition does the complete statement require before opening?",
      "options": [
        {
          "id": "q18-v3",
          "label": "Installation of the hardware alone"
        },
        {
          "id": "q18-v1",
          "label": "A signed inspection"
        },
        {
          "id": "q18-v2",
          "label": "Completion of the meeting video upload"
        }
      ],
      "answer": "q18-v1"
    },
    "rubric": {
      "verdict": "false",
      "decisiveEvidenceIds": [
        "q18-e1",
        "q18-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q18-r1",
      "verificationAnswer": "q18-v1"
    },
    "explanation": "The full sentence directly contradicts the claim. The isolated words are authentic, but their use asserts the opposite of the recorded instruction.",
    "uncertainty": "The packet does not establish whether a signed inspection was issued at a later time.",
    "additionalMeasurement": "Check the dated inspection and opening log before reporting the gate’s later status."
  },
  {
    "id": "q19-dust-and-timing",
    "title": "After the work is not because of it",
    "skillTags": [
      "causal-reasoning",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "The new Works resurfacing caused the dust reported on nearby homes.",
    "context": "Fictional Merehaven case. A complaint sequence and a project timeline are available, but the source of the dust has not been sampled.",
    "evidence": [
      {
        "id": "q19-e2",
        "title": "Project and weather note",
        "body": "Resurfacing began Monday. A dry wind episode and a separate soil-moving project west of the homes began during the same week. No source-composition or directional sampling was recorded.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q19-e3",
        "title": "Contractor invoice",
        "body": "The invoice confirms that resurfacing materials were delivered. It does not measure whether material reached the homes.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q19-e1",
        "title": "Complaint timeline",
        "body": "Four nearby households reported visible dust during the week after resurfacing began. The complaint form did not identify the dust’s material or collect pre-work samples.",
        "kind": "fictional-record",
        "featureId": "north-works"
      }
    ],
    "reasons": [
      {
        "id": "q19-r3",
        "label": "The alternative soil work proves the resurfacing contributed nothing."
      },
      {
        "id": "q19-r1",
        "label": "The timing makes a hypothesis plausible, but competing sources and missing source measurements leave this causal attribution unresolved."
      },
      {
        "id": "q19-r2",
        "label": "Any event beginning before a complaint must be its cause."
      }
    ],
    "verification": {
      "question": "Which missing evidence would most directly distinguish the candidate dust sources?",
      "options": [
        {
          "id": "q19-v1",
          "label": "Matched material samples and directional deposition measurements"
        },
        {
          "id": "q19-v2",
          "label": "A larger copy of the delivery invoice"
        },
        {
          "id": "q19-v3",
          "label": "The number of times the complaint was reposted"
        }
      ],
      "answer": "q19-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q19-e1",
        "q19-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q19-r1",
      "verificationAnswer": "q19-v1"
    },
    "explanation": "The records show coincidence in time, not a resolved source pathway. They neither prove nor disprove a contribution from the resurfacing.",
    "uncertainty": "More than one source could contribute, and the complaint group may not represent all nearby homes.",
    "additionalMeasurement": "Compare deposited material with candidate source samples while recording wind direction and upwind/downwind deposition."
  },
  {
    "id": "q20-unlocated-gauge",
    "title": "A number without a location",
    "skillTags": [
      "visual-evidence",
      "source-tracing"
    ],
    "difficulty": "introductory",
    "claim": "The close-up gauge image was taken at Old Town.",
    "context": "Fictional Merehaven case. The packet includes a cropped image description and an equipment-location register.",
    "evidence": [
      {
        "id": "q20-e3",
        "title": "Caption history",
        "body": "An anonymous repost added “Old Town.” The repost cites no original photographer, uncropped file or location record.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q20-e1",
        "title": "Image export record",
        "body": "The close-up shows gauge model G-2 reading 0.08 m. The crop excludes the instrument serial plate, surrounding landmarks and original location metadata.",
        "kind": "fictional-record",
        "featureId": "old-town"
      },
      {
        "id": "q20-e2",
        "title": "Equipment register",
        "body": "Identical G-2 faces are installed at Old Town, East Wharf and Reed Marsh. The register distinguishes them by serial plate, which is outside the supplied crop.",
        "kind": "fictional-record",
        "featureId": "old-town"
      }
    ],
    "reasons": [
      {
        "id": "q20-r1",
        "label": "The visible model is shared by three sites, and the crop lacks the identifiers needed to establish this location."
      },
      {
        "id": "q20-r2",
        "label": "Any gauge showing 0.08 m must belong to Old Town."
      },
      {
        "id": "q20-r3",
        "label": "The lack of a serial plate proves the image was made at East Wharf instead."
      }
    ],
    "verification": {
      "question": "Which identifier would connect this particular instrument to the site register?",
      "options": [
        {
          "id": "q20-v2",
          "label": "The common G-2 model label alone"
        },
        {
          "id": "q20-v3",
          "label": "The number of digits in the displayed reading"
        },
        {
          "id": "q20-v1",
          "label": "The instrument serial plate"
        }
      ],
      "answer": "q20-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q20-e1",
        "q20-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q20-r1",
      "verificationAnswer": "q20-v1"
    },
    "explanation": "The location claim is unresolved. The common gauge face cannot distinguish the listed installations, and the added caption lacks corroboration.",
    "uncertainty": "The reading itself may be authentic, but its location and circumstances remain unverified.",
    "additionalMeasurement": "Obtain the original uncropped file or a serial-number record linked to this image."
  },
  {
    "id": "q21-five-samples",
    "title": "A clear sample is not every sample",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "Every barrel in the Works delivery meets the clarity specification.",
    "context": "Fictional Merehaven case. The packet concerns 200 fictional industrial water barrels, not drinking-water safety advice.",
    "evidence": [
      {
        "id": "q21-e1",
        "title": "Laboratory result sheet",
        "body": "Five submitted samples met clarity specification C-2. The sheet lists samples S1–S5; it makes no statement about untested barrels.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q21-e2",
        "title": "Delivery and sampling record",
        "body": "The delivery contains 200 barrels. The sampling note does not link S1–S5 to barrel IDs or explain how samples were selected. No validated batch-acceptance protocol is provided.",
        "kind": "fictional-record",
        "featureId": "north-works"
      },
      {
        "id": "q21-e3",
        "title": "Supplier brochure",
        "body": "The brochure says the supplier aims for consistent clarity. It provides no test results for this delivery.",
        "kind": "fictional-record",
        "featureId": "north-works"
      }
    ],
    "reasons": [
      {
        "id": "q21-r2",
        "label": "Five passing samples prove all two hundred barrels passed because they came from one supplier."
      },
      {
        "id": "q21-r3",
        "label": "The incomplete sampling record proves every barrel failed."
      },
      {
        "id": "q21-r1",
        "label": "Passing results for five unlinked samples do not establish the asserted condition of all two hundred barrels."
      }
    ],
    "verification": {
      "question": "What essential link is absent from the provided sampling record?",
      "options": [
        {
          "id": "q21-v3",
          "label": "Whether the five laboratory values were printed in a table"
        },
        {
          "id": "q21-v1",
          "label": "Which barrels were sampled and how those samples were selected"
        },
        {
          "id": "q21-v2",
          "label": "The supplier’s preferred brochure color"
        }
      ],
      "answer": "q21-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q21-e1",
        "q21-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q21-r1",
      "verificationAnswer": "q21-v1"
    },
    "explanation": "The reported tests are favorable, but their coverage and relationship to the delivery are not established. A universal batch claim remains unsupported.",
    "uncertainty": "The untested barrels could conform or fail; neither conclusion follows from the missing information.",
    "additionalMeasurement": "Use traceable barrel IDs and a defined, appropriate sampling/acceptance procedure for the intended batch claim."
  },
  {
    "id": "q22-unmatched-transfer",
    "title": "A transfer without a matching reference",
    "skillTags": [
      "source-tracing"
    ],
    "difficulty": "intermediate",
    "claim": "The marsh contractor has received payment for invoice RM-18.",
    "context": "Fictional Merehaven case. The documents are fictional finance records. Approval, transfer initiation and receipt are separate events.",
    "evidence": [
      {
        "id": "q22-e2",
        "title": "Transfer initiation screenshot",
        "body": "A transfer of 900 credits was initiated to a masked account. The screenshot omits beneficiary identity, invoice reference and final settlement status; it cannot be matched uniquely to RM-18.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q22-e3",
        "title": "Contractor status email",
        "body": "The contractor says accounts will be reconciled next week. The email neither confirms receipt nor states that no funds arrived.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q22-e1",
        "title": "Approved invoice",
        "body": "RM-18 for 900 credits was approved for payment. Its supplier reference is MARSH-WALK; the invoice contains no paid stamp or payment confirmation.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q22-r3",
        "label": "Approval for payment proves the contractor has already received funds."
      },
      {
        "id": "q22-r1",
        "label": "The invoice is approved and a similar amount was initiated, but the records do not establish a matched settled payment to the contractor."
      },
      {
        "id": "q22-r2",
        "label": "Equal amounts establish the same transaction even without a beneficiary or invoice reference."
      }
    ],
    "verification": {
      "question": "Which record would close the central evidence gap?",
      "options": [
        {
          "id": "q22-v1",
          "label": "A settled transaction with matching beneficiary and RM-18 reference"
        },
        {
          "id": "q22-v2",
          "label": "Another copy of the approved invoice"
        },
        {
          "id": "q22-v3",
          "label": "The same transfer screenshot at higher resolution with its omissions unchanged"
        }
      ],
      "answer": "q22-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q22-e1",
        "q22-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q22-r1",
      "verificationAnswer": "q22-v1"
    },
    "explanation": "The available documents cannot link a completed transfer to this invoice and recipient. Receipt is therefore unresolved rather than disproved.",
    "uncertainty": "The contractor may have received the funds; the packet lacks the matching confirmation.",
    "additionalMeasurement": "Obtain a settled payment record or recipient acknowledgment tied to the invoice and beneficiary."
  },
  {
    "id": "q23-unfinished-ballot",
    "title": "A majority before the count is complete",
    "skillTags": [
      "statistics"
    ],
    "difficulty": "intermediate",
    "claim": "Most of the hundred invited households favor the new path.",
    "context": "Fictional Merehaven case. The response window remains open, and the claim concerns all invited households rather than current respondents.",
    "evidence": [
      {
        "id": "q23-e3",
        "title": "Reminder email",
        "body": "The organizer sent a reminder to all nonresponders. Sending a reminder does not supply their choices.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q23-e1",
        "title": "Responses received so far",
        "body": "Forty-four distinct invited households have responded: 28 favor and 16 oppose. There are no duplicate household IDs in this tally.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      },
      {
        "id": "q23-e2",
        "title": "Invitation register and deadline",
        "body": "One hundred households were invited. Fifty-six have not responded and the deadline is tomorrow. No preference has been recorded for those households.",
        "kind": "fictional-record",
        "featureId": "reed-marsh"
      }
    ],
    "reasons": [
      {
        "id": "q23-r1",
        "label": "Twenty-eight favorable responses do not determine the preferences of the fifty-six households whose choices remain unknown."
      },
      {
        "id": "q23-r2",
        "label": "The 28-to-16 lead among respondents is automatically a majority of all one hundred invitees."
      },
      {
        "id": "q23-r3",
        "label": "Every nonresponse must be counted as opposition, making the claim definitively false."
      }
    ],
    "verification": {
      "question": "How many additional favorable households would be needed to establish more than half of all 100 invitees?",
      "options": [
        {
          "id": "q23-v2",
          "label": "1, because the current respondents already form a majority"
        },
        {
          "id": "q23-v3",
          "label": "56, because every nonresponder must favor it"
        },
        {
          "id": "q23-v1",
          "label": "23, bringing the favorable count to 51"
        }
      ],
      "answer": "q23-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q23-e1",
        "q23-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q23-r1",
      "verificationAnswer": "q23-v1"
    },
    "explanation": "The current response majority and the majority of all invitees are different claims. Unknown preferences could change the latter in either direction.",
    "uncertainty": "A final response tally may still require clear treatment of nonresponse and the population being described.",
    "additionalMeasurement": "Complete the response collection or report the narrower result explicitly as a share of respondents."
  },
  {
    "id": "q24-disagreeing-instruments",
    "title": "Which instrument is wrong?",
    "skillTags": [
      "statistics",
      "source-tracing"
    ],
    "difficulty": "advanced",
    "claim": "Gauge B is the faulty instrument because it reads higher than Gauge A.",
    "context": "Fictional Merehaven case. Two authored field-log readings were taken side by side; they are not numerical-engine predictions.",
    "evidence": [
      {
        "id": "q24-e1",
        "title": "Paired reading log",
        "body": "At the same location and time, Gauge A recorded 0.120 m and Gauge B recorded 0.126 m. Both logs claim a ±0.001 m reading tolerance, but this is not a new calibration result.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q24-e2",
        "title": "Calibration file index",
        "body": "Both instruments lack a current independent reference check. The packet supplies no known water level and no third calibrated reading that could identify which instrument is closer to the reference.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      },
      {
        "id": "q24-e3",
        "title": "Purchase register",
        "body": "Gauge B was purchased more recently. Purchase age alone does not establish calibration accuracy.",
        "kind": "fictional-record",
        "featureId": "east-wharf"
      }
    ],
    "reasons": [
      {
        "id": "q24-r2",
        "label": "The higher reading must be wrong because lower values are always more conservative."
      },
      {
        "id": "q24-r3",
        "label": "The newer instrument is necessarily correct, so Gauge A is proven faulty."
      },
      {
        "id": "q24-r1",
        "label": "The disagreement exceeds the stated reading tolerances, but without a reference it does not identify Gauge B as the faulty one."
      }
    ],
    "verification": {
      "question": "What can these two readings establish without an independent reference?",
      "options": [
        {
          "id": "q24-v3",
          "label": "That averaging the values establishes the true level exactly"
        },
        {
          "id": "q24-v1",
          "label": "A disagreement that needs investigation, not which gauge is faulty"
        },
        {
          "id": "q24-v2",
          "label": "That Gauge B alone is faulty"
        }
      ],
      "answer": "q24-v1"
    },
    "rubric": {
      "verdict": "insufficient",
      "decisiveEvidenceIds": [
        "q24-e1",
        "q24-e2"
      ],
      "maxEvidence": 2,
      "reasonId": "q24-r1",
      "verificationAnswer": "q24-v1"
    },
    "explanation": "The records establish a discrepancy. They do not locate the error: either instrument, both instruments, or an unrecorded procedure difference could be involved.",
    "uncertainty": "Stated reading tolerance does not account for every calibration or placement error.",
    "additionalMeasurement": "Compare both gauges with a suitable independent reference under the same documented conditions."
  }
].map(item => ({ ...item, ...metadata(item.id, item.title, item.skillTags, item.difficulty), weight: 100, evidence: item.evidence.map(record => ({ ...record, provenance: clone(provenance) })) }));
  function validate(collection = { missions, cases, quickChecks }) {
    const errors = [], allIds = new Set();
    const addId = id => { if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || allIds.has(id)) errors.push('Invalid or duplicate content ID: ' + id); allIds.add(id); };
    if (!collection || !['missions', 'cases', 'quickChecks'].every(key => Array.isArray(collection[key]))) return { ok: false, errors: ['Content collections must be arrays.'] };
    try {
    for (const item of [...collection.missions, ...collection.cases, ...collection.quickChecks]) {
      addId(item.id);
      if (!Number.isInteger(item.version) || item.version < 1 || item.contentVersion !== version || !item.title || !Array.isArray(item.skillTags) || !item.skillTags.length || !item.difficulty || !item.context) errors.push('Incomplete metadata: ' + item.id);
      if (item.provenance?.kind !== 'original-fictional-simulation' || !item.provenance?.label) errors.push('Missing simulation provenance: ' + item.id);
      if (item.editorialReview?.status !== 'pending-human-review' || item.editorialReview?.reviewer !== null || item.editorialReview?.reviewedAt !== null) errors.push('Unverified human review claim: ' + item.id);
    }
    for (const item of [...collection.cases, ...collection.quickChecks]) {
      const stages = item.stages || [item];
      if (stages.reduce((sum, stage) => sum + (stage.weight ?? 100), 0) !== 100) errors.push('Case stages must allocate exactly 100 points: ' + item.id);
      for (const stage of stages) {
        if (stage !== item) addId(stage.id); const evidenceIds = new Set(stage.evidence.map(evidence => evidence.id));
        if (stage.evidence.length < 3 || stage.evidence.length > 5) errors.push('A stage needs 3–5 evidence records: ' + stage.id);
        stage.evidence.forEach(evidence => {
          addId(evidence.id); if (!evidence.body || !evidence.title || !evidence.provenance?.label) errors.push('Missing evidence provenance: ' + evidence.id);
          if (evidence.chart && (!Array.isArray(evidence.chart.values) || evidence.chart.values.length !== evidence.chart.labels?.length || !evidence.chart.values.every(Number.isFinite) || !Number.isFinite(evidence.chart.croppedMin) || evidence.chart.values.some(value => value < evidence.chart.croppedMin))) errors.push('Invalid authored chart: ' + evidence.id);
          if (evidence.sourceChain && (!evidence.sourceChain.nodes?.length || !evidence.sourceChain.edges?.every(edge => evidence.sourceChain.nodes.some(node => node.id === edge.from) && evidence.sourceChain.nodes.some(node => node.id === edge.to)))) errors.push('Invalid source chain: ' + evidence.id);
          if (evidence.timestamps && !evidence.timestamps.every(row => row.label && Number.isFinite(Date.parse(row.value)))) errors.push('Invalid authored timestamp: ' + evidence.id);
        });
        if (!verdicts.includes(stage.rubric.verdict) || !Number.isInteger(stage.rubric.maxEvidence) || stage.rubric.maxEvidence < 1 || stage.rubric.maxEvidence > 2 || !stage.rubric.decisiveEvidenceIds.length || new Set(stage.rubric.decisiveEvidenceIds).size !== stage.rubric.decisiveEvidenceIds.length || stage.rubric.decisiveEvidenceIds.length > stage.rubric.maxEvidence || !stage.rubric.decisiveEvidenceIds.every(id => evidenceIds.has(id))) errors.push('Invalid evidence rubric: ' + stage.id);
        if (!stage.reasons.some(reason => reason.id === stage.rubric.reasonId)) errors.push('Missing reason: ' + stage.id);
        if (!stage.verification?.question || !stage.verification.options.some(option => option.id === stage.rubric.verificationAnswer) || stage.verification.answer !== stage.rubric.verificationAnswer) errors.push('Missing verification step: ' + stage.id);
        if (!stage.claim || !stage.context || !stage.explanation || !stage.uncertainty || !stage.additionalMeasurement) errors.push('Incomplete explanation: ' + stage.id);
      }
    }
    for (const item of collection.missions) {
      if (Object.values(item.rubric.weights).reduce((sum, value) => sum + value, 0) !== 100 || item.rubric.maxEvidence > 3) errors.push('Invalid mission rubric: ' + item.id);
      const documentIds = new Set(item.documents.map(doc => doc.id));
      item.documents.forEach(doc => { addId(doc.id); if (!doc.body || !doc.provenance?.label) errors.push('Incomplete mission document: ' + doc.id); });
      if (!item.rubric.decisiveEvidenceIds.every(id => documentIds.has(id))) errors.push('Missing mission evidence: ' + item.id);
      if (!item.rubric.acceptedConclusionIds.every(id => item.conclusions.some(option => option.id === id && option.conditions.length))) errors.push('Missing conclusion conditions: ' + item.id);
      const binding = item.observationBinding;
      if (!binding.sourceImmutable || binding.duration !== 3600 || !['depth', 'concentration'].includes(binding.variables[0]) || !binding.initialTimes.length || !binding.initialFeatureIds.length || ![...binding.initialTimes, ...binding.heldOutTimes].every(time => Number.isFinite(time) && time >= 0 && time <= binding.duration && time % 60 === 0) || ![...binding.initialFeatureIds, ...binding.heldOutFeatureIds].every(id => world.features.some(feature => feature.id === id))) errors.push('Invalid observation policy: ' + item.id);
      if (!item.measurementChoices.every(choice => choice.probeId === null || binding.heldOutFeatureIds.includes(choice.probeId))) errors.push('Invalid held-out choice: ' + item.id);
      if (!item.rubric.spatial.featureIds.every(id => world.features.some(feature => feature.id === id)) || !item.rubric.experiment.probeIds.every(id => world.features.some(feature => feature.id === id))) errors.push('Unknown mission geometry: ' + item.id);
    }
    } catch (error) { errors.push('Malformed content structure: ' + error.message); }
    return { ok: errors.length === 0, errors };
  }
  function bindObservations(missionId, bundle) {
    const source = missions.find(item => item.id === missionId);
    if (!source) throw new Error('Unknown mission');
    const rows = bundle?.rows || bundle?.observations;
    if (!Array.isArray(rows) || !rows.length || typeof bundle.configFingerprint !== 'string' || !bundle.configFingerprint) throw new Error('A reproducible derived observation bundle is required');
    const ids = new Set();
    for (const row of rows) {
      if (!row.id || ids.has(row.id) || !world.features.some(feature => feature.id === row.featureId) || ![row.t, row.depth, row.concentration].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) throw new Error('Invalid derived observation');
      if (row.provenance?.kind !== 'synthetic-observation' || row.provenance.scenarioId !== (source.observationBinding.referenceScenarioId || source.scenarioId) || !row.provenance.scenarioVersion || !row.provenance.modelVersion) throw new Error('Observation provenance does not match this mission');
      ids.add(row.id);
    }
    return freeze({ ...clone(source), observations: clone(bundle), observationBinding: { ...clone(source.observationBinding), status: 'derived', configFingerprint: bundle.configFingerprint } });
  }
  function visibleObservations(missionValue, bundle, measurementChoiceId) {
    const item = typeof missionValue === 'string' ? missions.find(mission => mission.id === missionValue) : missionValue;
    if (!item?.observationBinding) throw new Error('Unknown mission observation policy');
    const binding = item.observationBinding;
    const choice = item.measurementChoices.find(option => option.id === measurementChoiceId);
    const rows = bundle?.rows || bundle?.observations || [];
    return freeze(rows.filter(row =>
      (binding.initialFeatureIds.includes(row.featureId) && binding.initialTimes.includes(row.t)) ||
      (choice?.probeId && choice.probeId === row.featureId && binding.heldOutFeatureIds.includes(row.featureId) && binding.heldOutTimes.includes(row.t))
    ).map(row => ({ id: row.id, featureId: row.featureId, t: row.t,
      ...Object.fromEntries(binding.variables.filter(variable => typeof row[variable] === 'number' && Number.isFinite(row[variable])).map(variable => [variable, row[variable]])),
      provenance: clone(row.provenance), readingTolerance: binding.variables[0] === 'concentration' ? binding.concentrationToleranceGm3 : binding.depthToleranceM,
    })));
  }
  return freeze({ version, label, verdicts, world, chapters, missions, cases, quickChecks,
    releaseScope: { status: 'complete-authored-season', expectedMissions: 6, expectedCases: 6, expectedQuickChecks: 24 },
    getMission: id => missions.find(item => item.id === id) || null,
    getCase: id => cases.find(item => item.id === id) || null,
    getQuick: id => quickChecks.find(item => item.id === id) || null,
    validate, bindObservations, visibleObservations,
  });
});
