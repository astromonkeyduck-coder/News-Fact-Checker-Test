# Waterline Files: physical model and local GIS

Model edition `waterline-fv-1`, scenario/world edition `1`, analysis edition `1`. All locations, terrain, drains, population figures, storms and instruments in Merehaven are original fictional educational case material. Numerical results are generated in the browser without a model API or network request. The source observations for a mission are a separately generated, frozen bundle; player counterfactuals never edit them.

## Design and references

The model couples water storage/terrain-driven flow with transport of a passive, harmless simulated tracer. This lets the same physical world support flooding explanations, an omitted connection, ambiguous measurements, timing checks and downstream tradeoffs.

EPA's [SWMM documentation index](https://www.epa.gov/water-research/storm-water-management-model-swmm) and [SWMM 5.2 manual, section 3.4](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10145M6.TXT) informed the choice of rainfall, infiltration, storage and a Manning-based runoff relationship. The manual describes a water-balance approach and nonlinear surface reservoirs. Our small grid solver is original JavaScript; it does **not** run SWMM or reproduce its full hydraulics, infiltration methods, calibrated parameters or professional capabilities.

The [EPA water-quality reference](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100P2NY.txt) provides the conservation and constituent-routing context. Our tracer uses a completely mixed cell concentration, conservative upwind mass transfers and explicit dispersion. It has no chemical reactions, toxicity, decay or adsorption. These are educational simplifications, not claims about a real substance.

The [QGIS buffer introduction](https://docs.qgis.org/3.44/en/docs/gentle_gis_introduction/vector_spatial_analysis_buffers.html) and [QGIS vector-analysis lesson](https://doc.qgis.org/testing/en/docs/training_manual/vector_analysis/basic_analysis.html) informed the spatial tools. Buffers use planar metre distances. A buffer represents proximity; it does not establish a flow connection, travel time, flood outline or causal relationship. References were checked September 13, 2026.

## Coordinates, grid and units

`MEREHAVEN-LOCAL-METRES` is an explicitly fictional Cartesian coordinate system. Its origin is the southwest corner, x points east, y points north, and the extent is 1200 × 800 m. It has no latitude/longitude and no claimed georeference to the real-world Atlas Expedition. Atlas geographies must not be passed into these metre-based functions.

The default grid is 24 columns × 16 rows of 50 × 50 m cells. Arrays are ordinary JSON-compatible numbers in row-major order from the south: `index = row * nx + column`. Each cell has area 2,500 m². Its displayed centre is `[(column + .5) * 50, (row + .5) * 50]`. A coordinate on the north/east outer edge is outside the cell array; probe placement should use an interior coordinate.

| Quantity | Stored field | Units |
|---|---|---|
| Clock | `state.t`, history `t` | seconds since fictional trial start |
| Terrain elevation | `terrain[i]` | m above fictional datum |
| Water depth | `depth[i]` | m above the cell bed |
| Water storage | budget fields | m³ |
| Tracer mass | `tracerMass[i]`, tracer budget | g |
| Concentration | `sample().concentration` | g/m³ |
| Rainfall/infiltration capacity | rainfall `mmHr`, `permeability[i]` | mm/h |
| Drain capacity | `capacityM3s` | m³/s |
| Manning roughness | `roughness[i]` | s/m^(1/3) |
| Dispersion coefficient | `dispersionM2s` | m²/s |

## Equations and numerical method

Let cell area be A, bed elevation z, water depth h, water volume V = Ah, tracer mass M and concentration C = M/V. A dry cell returns concentration zero while retaining any dry tracer mass for later wetting. This is a numerical convention, not a detection claim.

Rain adds `rainfall_mm_h * dt / 3,600,000` metres of water to every cell. Rain intervals are nonoverlapping and have explicit start/end seconds. Infiltration requests `permeability_mm_h * A / 3,600,000` m³/s. This constant capacity omits soil saturation dynamics; the solver limits removal to available water. Infiltration removes tracer at the donor cell's concentration and records it as an explicit sink.

For each shared cell face, let H = z + h. Flow is from greater H to smaller H. The effective wetted face depth is `max(0, max(Ha,Hb) - max(za,zb))`. With face width w, centre distance L and mean roughness n, the requested discharge magnitude is:

`Q = (w/n) * h_face^(5/3) * sqrt(abs(Ha-Hb)/L)`.

This is a storage-and-diffusive-flow approximation; it does not solve the shallow-water momentum equations. The face transfers are evaluated from one common state, then accumulated simultaneously. A cell's aggregate outgoing volume is capped at its available volume, and the same scale factor applies to all its requested fluxes. This prevents negative storage. Rain precedes routing within a substep, and this operator order contributes a finite time-step error.

Directed drain links request `min(capacity, conductance * max(0, upstreamHead-downstreamHead))`. Each link transfers water and its tracer directly between two grid cells. Drain pipes have **no separate pipe storage or resolved transit time**. Links are simplified gravity connections; they do not model pressure, surcharging, pumps or pipe geometry. Model tracer arrival depends on this simplification and the observation sampling interval. It is not an estimate of real pipe travel time.

Upwind tracer transport transfers `waterVolumeTransferred * donorConcentration`. The receiving cell gains precisely what the donor loses. Dispersion exchanges mass down the concentration gradient across wet surface faces at rate `D * w * min(ha,hb) / L * abs(Ca-Cb)`. Simultaneous outgoing dispersive transfers are limited to donor mass. Dispersion does not move water and is not applied across remote drain links.

West, east and north exterior faces are closed. Named scenarios have a south-open boundary to a fixed level of 0 m and a separate terminal outfall drain. Both allow outward flow only; tides and inflow from the estuary are omitted. A closed boundary is available for conservation tests and custom scenes.

Every integration substep is at most 5 s. A requested `dt` below 5 s is respected. Steps are split at rain changes, exact pulse times, regular instrument sample times and the requested endpoint. The water-availability and tracer-availability limiters guarantee nonnegative stored amounts; they do not guarantee accurate arbitrary extreme scenarios. `limitedSteps` counts substeps when requested outflows exceed local availability, commonly in dry infiltrating cells. Default instruments record each 60 s and at requested endpoints. Report arrival as the first **sampled** threshold crossing, not an exact continuous arrival.

## Conservation and replay

Water ledger: `initial + rainfall - infiltrated - drained - boundaryOut - stored = error`.

Tracer ledger: `initial + injected - infiltrated - drained - boundaryOut - stored = error`.

Internal surface, drain and dispersion transfers cancel in these balances. `networkTransferredM3` is an informational cumulative link-throughput ledger; it is not another water sink. All recorded errors are in absolute m³ or g. Tiny floating-point residuals are retained for inspection.

`create`, `step` and `run` return new state. There is no wall-clock integration, randomness or renderer-dependent motion. A run's normalized configuration has a reproducibility fingerprint; this noncryptographic hash identifies local game inputs, not trusted score validation. `serialize` stores full state/configuration; `restore` checks schema, fields, scenario fingerprint, pulse history and mass balance. Replay reconstructs from the original configuration. A named run resumed at 1800 s and continued to 3600 s was numerically identical to its uninterrupted run, including sensor rows. A rewind to 1200 s and continuation was also identical. For exact comparison, keep the same time-step schedule; splitting at an arbitrary off-grid endpoint introduces an additional substep and may change numerical rounding/truncation.

## Named investigations and measured distinctions

The first guided vertical slice is supported by `baseline-storm`, `sealed-works` and `blocked-drain`. All share a 65 mm/h storm for 2700 s and a 3600 s comparison duration. Permeability changes only the North Works parcel; drainage capacity changes only the Old Town → Reed Marsh link. The `retention` preset explicitly changes both permeability and terrain and must not be graded as a one-factor comparison.

Measured default runs at 5 s steps:

| Reading | Restricted drain | Sealed Works | Interpretation |
|---|---:|---:|---|
| Old Town depth at 3600 s | 0.119023 m | 0.118895 m | Both fit one reading reported to ±0.001 m. |
| North Works depth at 2400 s | 0.000168 m | 0.015551 m | A targeted reading separates the two configurations. |
| East Wharf depth at 2400 s | 0.220969 m | 0.220976 m | This observation does not separate them at that precision. |

Only the **single final Old Town reading** is intentionally ambiguous. The full Old Town time series differs earlier and must not be described as an equally good fit. Matching generated observations does not establish real-world accuracy or eliminate unmodeled alternatives.

A distinct paired hypothesis supports a later investigation: `low-rain-restricted` uses 55 mm/h rain and 0.05 m³/s drainage; `high-rain-open` uses 75 mm/h rain and 0.45 m³/s drainage. Final Old Town depth is 0.101085 versus 0.101200 m, indistinguishable at ±1 mm. Final East Wharf depth is 0.242544 versus 0.286093 m, which separates the hypotheses. Final North Works readings are both below 0.0001 m, so that location does not separate this pair at the stated precision. These are two-input explanations, not a one-factor experiment.

`missing-connection` opens the optional Works → Wharf edge. East Wharf crosses the 0.01 g/m³ sample threshold at 660 s and reaches a sampled peak of about 2.92 g/m³. `clock-offset` retains the recorded network and delays the pulse from 600 to 1200 s; East Wharf never crosses that threshold during the 3600 s run. Time shifts must move actual release inputs or observation alignment, never rewrite source evidence.

Compared with baseline, `fast-drain` changes Old Town peak depth from about 0.11283 to 0.07213 m while increasing Reed Marsh peak from 0.03719 to 0.06667 m. The player can examine the transfer rather than assume that improving one instrument improves every location. `retention` produces more infiltration and lower total stored surface water in the same trial. None of these fictional comparisons establishes a real intervention recommendation.

An uncertainty ensemble computes separate runs for explicit parameter variants, e.g. rainfall 55, 65 and 75 mm/h. Its envelope is the min/max across those runs at each recorded time. It is an input-sensitivity range, **not** a probability/confidence interval. Model-form, terrain, boundary and measurement uncertainty remain unquantified.

Across that explicit three-storm range, the fast-drain town peak spans 0.04828–0.09647 m and marsh peak 0.05907–0.07182 m. Retention spans 0.08598–0.12253 m in town and 0.03257–0.04194 m in the marsh. Baseline spans 0.09356–0.13065 m and 0.03259–0.04197 m respectively. Intervention comparisons must pair matching rainfall inputs, not compare an intervention's driest case with another's wettest case.

## API and GIS result contract

Browser globals: `NoteworthyPhysics`, `NoteworthyGIS`, `NoteworthyWorld`; CommonJS exports have the same API. None needs a framework.

`games/simulation-worker.js` imports only the physics/world modules. Its message protocol is `{requestId,operation,state?,config?,scenarioId?,options?,variants?}` with operations `observations`, `run`, `replay`, `ensemble`. It returns `{requestId,result}` or `{requestId,error}`. The ensemble operation takes materialized engine configurations, e.g. variants produced with `World.createScenario(id,{rainfallMmHr:55})`; merely adding a scalar rainfall property to an already materialized rainfall schedule does not replace that schedule. Worker errors preserve request identity and do not return a success-shaped result. The controller owns request cancellation/stale-result handling and any main-thread fallback.

```js
const config = W.createScenario('baseline-storm', {
  rainfallMmHr: 65, permeabilityMmHr: 28, drainageM3s: 0.18,
  missingConnection: false,
  tracerPulse: { at: 600, massG: 600, featureId: 'north-works' },
  terrainEdits: [] // [{index: 318, deltaM: -0.1}]
});
let state = P.create(config);
state = P.run(state, { until: 3600, dt: 5, sampleEvery: 60 });
const reading = P.sample(state, 'old-town'); // or [525,375]
const report = P.summary(state); // per-probe peaks, arrival, final, budgets
const resumed = P.restore(P.serialize(state));
const earlier = P.replay(config, { until: 1200, dt: 5 });
const observed = W.observations(P, 'blocked-drain', {times:[2400,3600]});
const range = W.ensemble(P, 'baseline-storm', [
  {rainfallMmHr:55}, {rainfallMmHr:65}, {rainfallMmHr:75}
], {until:3600});
const probeState = P.withProbe(state, {id:'my-probe', x:600, y:300});
```

For a time-varying storm, optionally supply `rainfallSchedule: [{start:0,end:1200,mmHr:40},{start:1800,end:2700,mmHr:90}]`. The world accepts up to three nonoverlapping intervals within 0–3600 seconds and rates of 0–200 mm/h. Gaps have zero rain; an empty array means no rain. The schedule overrides `rainfallMmHr` and is retained in the exact saved parameters. Omit the property to use the original 0–2700-second constant storm, preserving existing scenario fingerprints. The world sorts and copies intervals; the solver splits steps at their boundaries. A closed-cell test with off-step rainfall boundaries agrees with the independently integrated rain volume to 1e-8 m³ at both 5 s and 2.5 s steps.

`World.observations` returns a recursively frozen bundle containing `rows` (also `observations`), `configFingerprint`, exact `config`, scenario metadata and numerical summary. Rows contain id, featureId, t, depth, concentration, x/y, point geometry and explicit synthetic provenance. Select which rows are revealed at the mission boundary; the browser-visible bundle is not a secrecy or anti-cheat mechanism.

GIS supports distance, polyline length, polygon area with holes, point buffers, point selection in a region, point-to-polygon spatial joins, directed shortest network paths and nearest-cell terrain profiles. These are bounded operations, not a replacement for full GIS topology. The buffer display is a 64-sided approximation; point inclusion uses the exact circle distance. Polygon boundaries are included; a shared-boundary point may join to multiple zones. General polygon overlay/intersection and geodesic calculations are outside this module.

Use `G.analyze(operation, inputs, context)` to create an immutable pin. It retains full inputs, units, time window, CRS, scenario/model/analysis versions, assumptions, output and a deterministic fingerprint. Operation names are `distance`, `area`, `buffer`, `selection`, `spatial-join`, `network`, `profile`. A network path reports distance and actual edge/node IDs, never an invented travel time. A terrain profile uses the same cell elevations shown by the map. Numeric drawing/probe controls and interpretation are the presentation layer's responsibility.

## Verification and measured limits

Run `node --test tests/games/physics*.test.js tests/games/gis*.test.js`.

The 22 initial model/GIS tests cover dry/no-input conditions, sloping-cell transport, still-water dispersion, an uphill dry barrier, hand-calculated rainfall volume, sinks and boundaries, exact pulse timing, nonnegative limits, purity, saved-state continuation, rewind, invalid saves, real probe sampling, discriminating/indistinguishable measurements, the drain tradeoff, immutable observations, input ensembles, metre geometry, holes/boundaries, time filtering, network direction, terrain profiles and reproducible analysis pins.

Six named storm scenarios were compared at 5 s versus 2.5 s internal steps over 3600 s. Observed maximum final cell-depth difference was 0.000121 m, maximum final tracer-field L1 difference 1.052 g out of 600 g injected, and final stored-water difference less than 0.1%. Tests enforce depth error below 0.0002 m, tracer L1/injected mass below 0.3%, stored-water relative difference below 0.1%, absolute water-budget residual below 0.000001 m³ and tracer residual below 0.0000001 g. These bounds validate this fixture set and discretization, not the real world or every sandbox edit.

On this local arm64 host, Node v22.19.0, seven named 3600 s runs took 431.7 ms total in one measured invocation. The full initial 22-test command took about 1.6 s. These are local CPU timings, not browser/mobile frame-rate claims. The application should run model jobs in its worker and render the returned state; browser throttling, keyboard, screen-reader and mobile interaction checks belong to integration QA and are not established by these numerical tests.

To change a mission, make a new named scenario/version and recompute its frozen evidence and numerical expectations. Never silently replace a saved scenario's inputs. Rerun conservation, refined-step and case-discrimination tests after changing terrain, capacities, forcing, solver equations or scenario duration. Source documents and case rubrics require the publisher's content review; no human editorial review is claimed by these model files.

Additional stress tests cover the supported world's 200 mm/h rainfall, zero/100 mm/h Works permeability, zero/2 m³/s town drainage, a −0.5 m basin edit, an optional link and 0.25 m initial storage, separately and in combination. Over 3600 s, comparing 5 s and 2.5 s steps produced at most 0.002794 m final cell-depth difference, 0.138% final stored-water difference and 2.601 g tracer-field L1 difference out of 600 g injected in the tested cases. Stress tests allow 0.004 m, 0.2% water and 0.6% tracer differences, while retaining the same strict mass-ledger residual bounds. An independent one-cell rainfall-minus-infiltration balance agrees to 1e-8 m³, and doubling the passive tracer pulse doubles tracer mass without altering water depths.

The supplied Merehaven world bounds initial depth to 0–0.25 m. A deliberately deeper 1 m initial-water trial showed about 14% final-storage disagreement on time-step refinement despite conserving its budget; that initial condition is unsupported by this approximation and is rejected by the world factory. Conservation alone is not accuracy. Arbitrary low-level engine configurations or other combinations outside the documented fixture set require new convergence checks.

The map renderer uses the same cells and actual configuration's drain enablement. Both comparison maps use fixed water (0–0.30 m) and tracer (0–1 g/m³, logarithmic color) scales, with saturation disclosed. Graphs distinguish predictions from supplied synthetic observations and include equivalent numeric tables; terrain profiles retain negative edited elevations. Generation of 20 full map markup strings took 22.9 ms in a local Node test; this excludes browser parsing/layout. Six renderer tests cover coordinates, layer order, selected/probe values, actual connections, computed buffers, graph/table agreement, units, negative terrain, empty/corrupt states and escaping. Independent browser review remains required for visual layout and keyboard interactions.

`NoteworthyInvestigationView.envelope({ensemble,probeId,variable})` plots the actual sampled minima and maxima in `Physics.ensemble`/`World.ensemble` results. It provides the equivalent numeric table, water-depth or tracer-concentration units, and exact per-scenario rainfall rates and intervals. Duplicate capped inputs remain visible. The band describes the range of the chosen simulations, not a probability interval or a forecast confidence bound. Tests compare the rendered table to actual model output and verify malformed ranges fail clearly.

Saved-state validation rejects histories belonging to unknown probes, missing configured histories and empty histories before summary/rendering can fail. The world also rejects duplicate terrain-edit indices so repeated edits cannot bypass the ±0.5 m per-cell bound. Restored snapshots preserve the original numerical arrays and source configuration; these validity checks are not a claim that a locally edited save is authentic evidence.

Ensemble construction requires the same probe IDs, coordinates and saved sample times in every variant. It rejects mismatches rather than pairing unrelated samples by array index. `tests/games/season-physics.test.js` independently exercises all six authored case rubrics using real 3600-second saved simulations and recomputable GIS records, including the initial ambiguous reading, a discriminating held-out sample, opposite town/marsh peak responses, a release-time-only change, and the final retained-parcel experiment plus the 52/65/78 mm/h range. The tests also reject unsupported stronger conclusions and a missing required envelope. These are deterministic educational scoring checks, not human subject testing or external scientific validation.
