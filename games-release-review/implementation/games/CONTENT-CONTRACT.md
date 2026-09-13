# Waterline Files content contract

`games/content.js` is a dependency-free UMD module. Node uses `require('./content')`; browser code uses `window.NoteworthyContent`. Its data is recursively frozen. Current content edition: `waterline-files-1.0.0`. The first mission and short case passed an integrated playtest before expansion. The complete season contains six missions across three chapters, six Case Files and a balanced 24-item Quick Check bank. Human editorial review remains pending.

## Public API

- `version`, `label`, `verdicts`, `world`, `chapters`, `missions`, `cases`, `quickChecks`
- `getMission(id)`, `getCase(id)`, `getQuick(id)` return immutable entries or `null`.
- `validate()` returns `{ok, errors}`; it accepts a replacement collection for fixture validation.
- `bindObservations(missionId, bundle)` validates, copies and freezes a derived observation bundle with a mission. It never mutates the source mission or caller's bundle.
- `visibleObservations(missionOrId, bundle, measurementChoiceId)` returns a frozen **array** with only authorized times, features and variables. Use it in observation tables, graphs and grading. Missions 2 and 5 expose concentration; the other missions expose depth. Unauthorized variables, earlier times and the unchosen held-out location stay hidden.

The world uses local Cartesian metres, east/right and north/up, extent `[0,0,1200,800]`. It has no latitude/longitude and is not georeferenced to the real atlas. IDs are `north-works`, `old-town`, `reed-marsh`, `east-wharf`, `south-outfall`.

## Short cases and Quick Checks

Cases contain `stages`. Each stage has `id`, `weight`, `claim`, `context`, 3–5 `evidence` records, selectable `reasons`, `verification`, `rubric`, `explanation`, `uncertainty` and `additionalMeasurement`. Stage weights sum to exactly 100. The first case uses weights 40 and 60; prior verdicts remain judged against their own immutable evidence snapshot.

`stage.rubric` is `{verdict, decisiveEvidenceIds, maxEvidence:2, reasonId, verificationAnswer}`. The verdict enum is `supported | misleading | false | insufficient`; display the last as **Insufficient evidence**. `verification` contains `{question, options:[{id,label}], answer}`. The answer is repeated in the rubric for straightforward fixed scoring, not a second reward.

For each stage, allocate 60% to verdict, 30% to the bounded decisive evidence/reason, and 10% to the case-specific verification answer. Multiply the resulting fraction by `weight` exactly once. No opening-card, speed, confidence, revisit or stage-transition rewards. Selecting more than the allowed evidence must not earn full evidence credit. Confidence is optional unscored feedback; prose is private player-authored reflection.

All short cases and Quick Checks have a meaningful verification question. A future case without one must explicitly normalize the other components rather than automatically award ten points. Quick Checks use the same structure as a flat single 100-point stage. Six items use each verdict. Components are allocated with largest-remainder rounding so their displayed sum always equals the total.

Evidence documents may contain authored, inspectable graphics: `chart:{labels,values,unit,croppedMin,max}`, `sourceChain:{nodes:[{id,label}],edges:[{from,to}],arrowMeaning}`, `table:{columns,rows}`, or `timestamps:[{label,value}]`. These are source records for the exercise, not decorative data. The cropped-axis chart is 75% to 80% with a 70% baseline; a zero-baseline view must preserve those values. Keep the textual record available alongside each graphic.

## Mission schema and grading contract

Mission display fields: `title`, `chapterId`, `dek`, `briefing`, `claim`, `context`, `scenarioId`, `comparisonScenarioIds`, `hypotheses[{id,label,parameter}]`, `documents[{id,title,body,featureId,time,kind,provenance}]`, `guidedSteps`, `measurementChoices[{id,label,probeId,explanation}]`, `conclusions[{id,label,conditions}]`, `uncertaintyChoices` and `rubric`.

`rubric.weights` is `{conclusion:40,spatial:20,experiment:20,uncertainty:20}`. `maxEvidence` is three. Documents may explain an assumption or method, but a checked document alone cannot stand in for a computed analysis or graph.

The first mission accepts two conclusion paths:

1. `m1-drain-supported` requires a genuinely controlled drainage comparison and a reproducible observation-fit result that favors `blocked-drain` over `sealed-works`, including the North Works held-out reading. The tested tolerance is 0.001 m. Do not treat the content ID as proof that the condition has been met.
2. `m1-mechanism-not-unique` requires a valid one-factor comparison and an explicit non-identifiability limitation. It is a valid bounded conclusion about the player's selected evidence. Do not require guessing the hidden reference parameter.

`rubric.spatial.operations` names acceptable operation categories. Adapt engine operation names to these categories in the scoring boundary. A scoring analysis record must retain actual inputs, affected feature IDs, output, units, time window, scenario/model/analysis version and reproducibility fingerprint. Check the referenced feature inputs and actual output. A buffer around North Works can establish proximity; it earns no causal conclusion by itself. A 400 m buffer includes Old Town in this authored geometry: the centre-to-centre distance is approximately 360.56 m.

`rubric.experiment` identifies the allowed changed parameters and the inputs that must remain fixed. Compare two genuine engine snapshots of distinct runs, equal duration and unchanged non-target inputs. Require a numerical output change and an Old Town probe series. Check actual run records and the observation comparison; a parameter checkbox is insufficient. Preserve baseline and changed graphs in the saved briefing.

Supported public parameter keys agreed with the engine: `rainfallMmHr`, `permeabilityMmHr` at North Works, `drainageM3s` at the Old Town outlet, `missingConnection`, `tracerPulse:{at,massG,featureId}`, and `terrainEdits:[{index,deltaM}]`.

## Binding physical evidence

The mission's `observationBinding` specifies the reference scenario and initial/held-out feature IDs. Authored text contains no asserted water-depth, tracer, arrival-time or fit results. The engine must generate these.

Expected bundle: `{configFingerprint, rows:[{id,featureId,t,depth,concentration,provenance:{kind:'synthetic-observation',scenarioId,scenarioVersion,modelVersion}}], ...optional reproducibility metadata}`. `observations` may be used as the row-array key instead of `rows`. Time is seconds, depth metres, and concentration uses the engine's declared mass/volume unit. The bundle should also retain the exact seed/configuration, duration and sampling specification needed to reproduce it. Runtime experiments must never write into this bundle. Held-out measurements come from this same frozen source, not from the player's current parameter settings.

For mission 1, expose initially only Old Town depth at 3,600 s; the player may reveal North Works **or** East Wharf depth at 2,400 s. Other observation times and concentration are hidden. Full **experiment prediction** graphs may remain visible and must be labeled accordingly. Keep the source scenario's descriptive answer name/config out of the initial evidence presentation; use “Saved synthetic field record.” Its internal identity and configuration remain reproducible engine metadata, not a player-facing clue.

Calibration measured with `waterline-fv-1`, scenario version 1, 5 s integration steps:

| Selected observation | Blocked-drain prediction | Sealed-works prediction | At ±0.001 m precision |
| --- | ---: | ---: | --- |
| Old Town depth, 3,600 s | 0.1190228022 m | 0.1188947050 m | Both fit |
| North Works depth, 2,400 s | 0.0001680125 m | 0.0155512755 m | Discriminates |
| East Wharf depth, 2,400 s | 0.2209688009 m | 0.2209755467 m | Both fit |

Earlier Old Town depths **do** distinguish the configurations. Exposing the entire observed time series would invalidate the initial ambiguity. Tests rerun the numerical model to verify these relationships; the table is a calibration note, not the runtime observation source.

## Pure mission rubric API

`games/mission-rubric.js` exports UMD `NoteworthyMissionRubric`. Load it after `content.js`, `gis.js` and `physics.js`.

Snapshot contract:

```js
{ id, name, scenarioId, scenarioVersion, modelVersion,
  config, configFingerprint, duration,
  probeSeries: { probeId: [{ t, depth, concentration }] } }
```

Use `state.config`, `state.scenario.fingerprint`, `state.t` and `state.sensorHistory` from the actual engine state. Configuration fingerprints are verified against normalized inputs. A different model version cannot be graded silently as the current model.

```js
compareRuns(snapshotA, snapshotB, {
  observations: visibleRows, probeIds: ['old-town'],
  variable: 'depth', tolerance: 0.001
})
gradeMission(mission, {
  conclusionId, evidenceIds, uncertaintyIds, measurementChoiceId,
  interpretationId, reflection
}, { analyses, comparisons, observations: sourceBundle, snapshots, ensemble })
```

`compareRuns` returns an immutable, inspectable record with `id`, `snapshotIds`, `changedParameters`, `changedPhysicalFields`, `unexplainedConfigChanges`, `parametersA/B`, durations, aligned samples, `meanAbsoluteDifference`, `maximumAbsoluteDifference`, `fitA/B`, units, assumptions and validity/errors. Fits name each observed and predicted value, its residual, missing samples, and whether the stated tolerance is met. There is no fabricated interpolation or zero-residual substitution when an observation is missing.

`gradeMission` returns `{score,maxScore,breakdown,conclusionCorrect,selectionValid,evidenceIds,conditionResults,feedback,observedRowIds,comparisonSummaries,provenance,note}`. It does not save progress or award completion receipts; root session state owns exactly-once awards. It recomputes pinned GIS results and comparisons from their inputs/snapshot IDs instead of trusting stored success flags. The selected three records can be one relevant document, one computed analysis and one controlled comparison. For a stronger fit conclusion, both hypothesis snapshots must also exist among genuine saved runs; they need not consume two more evidence pins.

An experiment counts as controlled only when one allowed parameter and its corresponding physical fields change; unrelated physical changes, unequal durations, mismatched versions/fingerprints, unaligned samples and absent required observations fail the criterion. Reordered metadata does not masquerade as a physical change. One-factor interpretation choices come from `mission.interpretations` (`sensitivity-only`, `heldout-discriminates`, and an incorrect causal alternative).

This is local educational grading, not trusted server anti-cheat. The browser holds its content and numerical model; comparisons remain casual self-reported results. Private reflection is never machine-judged.

## Later-mission conditions

| Mission | Actual work required beyond source reading | Valid conclusion boundary |
| --- | --- | --- |
| The missing connection | Directed Works–Wharf network calculation; one-factor optional-edge experiment; concentration comparison | A model connection can explain transport without verifying installation. |
| The perfect match | Both two-input candidate snapshots; a third one-factor run; Town–Wharf spatial analysis; optional discriminating station | The initial 1 mm reading fits both. Wharf can favor one; changing two inputs does not isolate an effect. |
| The fix that moved the problem | Town–Marsh network/profile; equal-storm drain comparison; actual opposite peak directions at both probes | A town benefit can coexist with a marsh increase. Model depth is not a complete impact assessment. |
| Out of time | Original clock conversion; Works–Town network; release-time experiment with source/mass/hydraulics fixed | A concentration mismatch can arise from timing without a new route. Network distance is not pipe transit time. |
| The Waterline briefing | Retention terrain profile; permeability-only comparison at retentionM=0.1; actual 52/65/78 mm/h input envelope | A limited further trial or deferred decision can both be valid; three runs are not a safety guarantee. |

`heldConstant` accepts nested paths such as `tracerPulse.massG` and `tracerPulse.featureId`. `requiredParameters` fixes the background configuration in both controlled runs. `duration` requires a complete one-hour comparison where authored. Concentration uses `concentrationToleranceGm3`; depth uses `depthToleranceM`.

Additional conclusion conditions are `network-connected`, `observation-compatibility`, `probe-directions`, and `input-range`. They inspect the actual records and outputs. The final range accepts the engine's `ensemble` object, checks distinct authored inputs and unchanged background physics against a saved run, then recomputes the three bounded simulations to verify the envelope. The returned `inputRangeSummary` gives explicit inputs and minimum/maximum of the individual runs’ peak depths, with model version and assumptions. Preserve it in the saved briefing.

## Provenance and review

Every content item and document identifies itself as original fictional educational simulation material. Evidence has no invented external URL. The review status is `pending-human-review`, with no named reviewer or review date. Preserve that label in evidence views, exported briefings and shares. Fictional documents can be authentic **within the case** without becoming claims about real people, institutions or hazards.

The first case's frame identifiers and visual descriptions are constructed evidence, not photographs attributed to an outside source. If the interface draws the frame, label the drawing as simulated. No imagery is required to verify the decisive date and exact-frame-identity records.
