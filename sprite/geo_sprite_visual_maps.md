# Geo-SPRITE Visual Maps for AP European History

20 visual concept maps using Mermaid diagrams and markdown tables. These maps show how Geo-SPRITE lenses interact within and across AP units.

---

## Map 1: Geo-SPRITE Wheel (Central Concept Map)

The seven lenses and how they connect to each other. Every historical event can be analyzed through multiple lenses simultaneously.

```mermaid
graph TD
    geoSprite["Geo-SPRITE Framework"]
    geoSprite --> geo["Geography: Where and why location matters"]
    geoSprite --> soc["Social: Who has status, who doesn't"]
    geoSprite --> pol["Political: Who holds power, how"]
    geoSprite --> rel["Religious: What people believe, how it shapes action"]
    geoSprite --> int["Intellectual: What people think, how ideas spread"]
    geoSprite --> tech["Technology: What tools exist, how they change society"]
    geoSprite --> econ["Economic: Who produces, trades, profits"]

    geo -->|"resources shape"| econ
    econ -->|"wealth funds"| pol
    pol -->|"power enforces"| soc
    soc -->|"status shapes access to"| int
    int -->|"ideas challenge"| rel
    rel -->|"beliefs justify"| pol
    tech -->|"tools transform"| econ
    tech -->|"communication spreads"| int
    geo -->|"terrain determines"| tech
    soc -->|"labor drives"| tech
```

**Key insight:** No lens operates in isolation. The strongest AP essays show how two or three lenses interact to produce a historical outcome.

---

## Map 2: Renaissance Geo-SPRITE (Dominant Lenses)

Which lenses dominate the Italian Renaissance, and which are secondary.

```mermaid
graph LR
    ren["Italian Renaissance 1350-1550"]

    ren --> primary["PRIMARY LENSES"]
    ren --> secondary["SECONDARY LENSES"]
    ren --> minor["MINOR LENSES"]

    primary --> intLens["Intellectual: Humanism, classical revival, secular inquiry"]
    primary --> econLens["Economic: Medici banking, patronage, Commercial Revolution"]

    secondary --> geoLens["Geography: Italian city-state position, Mediterranean trade"]
    secondary --> socLens["Social: Courtier culture, new merchant elite, status through art"]
    secondary --> polLens["Political: Machiavelli, city-state competition, papal politics"]

    minor --> relLens["Religious: Church as patron, but not the driving force"]
    minor --> techLens["Technology: Printing press arrives late in the period"]
```

| Lens | Dominance | Example Evidence | Common Misuse |
|------|-----------|-----------------|---------------|
| Intellectual | Primary | Petrarch, Pico, humanism | Calling humanists atheists |
| Economic | Primary | Medici patronage, banking | Ignoring that most people were poor |
| Geography | Secondary | City-state trade positions | Treating all city-states as identical |
| Social | Secondary | Castiglione's courtier ideal | Projecting elite culture onto all classes |
| Political | Secondary | Machiavelli's The Prince | Reducing to "ends justify means" |
| Religious | Minor | Church patronage of art | Calling the Renaissance anti-religious |
| Technology | Minor | Printing press (late period) | Overstating Gutenberg's role in the Renaissance |

---

## Map 3: Reformation Geo-SPRITE

How the Reformation activates nearly every lens simultaneously.

```mermaid
graph TD
    reform["Protestant Reformation 1517-1648"]

    reform --> relDom["RELIGIOUS: Luther, Calvin, Trent, Jesuits"]
    reform --> polDom["POLITICAL: Princes vs. Emperor, wars, state churches"]
    reform --> intDom["INTELLECTUAL: Sola scriptura, humanist methods, printing"]

    reform --> socSup["SOCIAL: Peasants' War, clerical marriage, literacy"]
    reform --> techSup["TECHNOLOGY: Printing press as force multiplier"]
    reform --> econSup["ECONOMIC: Church wealth, indulgence economy, secularization"]
    reform --> geoSup["GEOGRAPHY: HRE fragmentation, Swiss independence, urban vs. rural"]

    relDom -->|"theological split justified"| polDom
    polDom -->|"political fragmentation enabled"| relDom
    intDom -->|"humanist tools read scripture"| relDom
    techSup -->|"press spread pamphlets"| intDom
    econSup -->|"indulgence revenue provoked"| relDom
    geoSup -->|"HRE decentralization protected"| polDom
    socSup -->|"peasants applied theology to"| polDom
```

**Key insight:** The Reformation is uniquely "full-spectrum" in Geo-SPRITE terms. The AP loves it for comparison and causation prompts because every lens is active.

---

## Map 4: Absolutism vs. Constitutionalism

Side-by-side Geo-SPRITE comparison of two political models emerging in the 17th century.

```mermaid
graph TD
    comp["17th-Century State Models"]
    comp --> abs["Absolutism: France under Louis XIV"]
    comp --> con["Constitutionalism: England after 1689"]

    abs --> absP["Political: Divine right, Versailles, intendants"]
    abs --> absE["Economic: Mercantilism, Colbert, state-directed trade"]
    abs --> absS["Social: Nobility tamed at court, no Estates-General"]
    abs --> absR["Religious: Revocation of Edict of Nantes 1685"]

    con --> conP["Political: Bill of Rights, parliamentary sovereignty"]
    con --> conE["Economic: Bank of England, property rights, freer trade"]
    con --> conS["Social: Gentry in Parliament, limited franchise"]
    con --> conR["Religious: Toleration Act 1689, but excludes Catholics"]
```

| Lens | Absolutism (France) | Constitutionalism (England) |
|------|--------------------|-----------------------------|
| Political | King rules by divine right; no legislature meets | Parliament controls taxation and legislation |
| Economic | State-directed mercantilism under Colbert | Emerging free market; Bank of England (1694) |
| Social | Nobles trapped at Versailles, politically neutered | Gentry govern locally; limited but real representation |
| Religious | Catholic uniformity enforced; Huguenots expelled | Toleration Act, but Catholics and dissenters restricted |
| Intellectual | Censorship; Academie Francaise controls culture | Locke publishes Two Treatises; freer press |
| Geography | Large continental state requiring centralized army | Island nation; navy over army; harder to invade |
| Technology | Versailles as political technology of control | Financial instruments (national debt, stock markets) |

---

## Map 5: Scientific Revolution to Enlightenment Chain

How ideas built on each other across the two movements.

```mermaid
graph LR
    copernicus["Copernicus: Heliocentric model 1543"] --> galileo["Galileo: Telescope evidence 1609"]
    galileo --> kepler["Kepler: Planetary motion laws"]
    kepler --> newton["Newton: Principia 1687"]
    newton --> enlightenment["ENLIGHTENMENT: If nature has laws, so does society"]

    bacon["Bacon: Empirical method"] --> sciMethod["Scientific method established"]
    descartes["Descartes: Rational doubt 1637"] --> sciMethod
    sciMethod --> enlightenment

    enlightenment --> locke["Locke: Natural rights, consent 1689"]
    enlightenment --> montesquieu["Montesquieu: Separation of powers 1748"]
    enlightenment --> voltaire["Voltaire: Religious tolerance, free speech"]
    enlightenment --> rousseau["Rousseau: Popular sovereignty, general will 1762"]
    enlightenment --> smith["Smith: Free markets 1776"]

    locke --> revolutions["ATLANTIC REVOLUTIONS"]
    montesquieu --> revolutions
    rousseau --> revolutions
```

**Key insight:** The chain runs: empirical observation challenges authority (Science) --> reason can discover laws governing society (Enlightenment) --> existing political arrangements are not divinely ordained (Revolution).

---

## Map 6: French Revolution Geo-SPRITE Explosion

How the French Revolution activates all seven lenses in rapid succession.

```mermaid
graph TD
    frRev["French Revolution 1789-1799"]

    frRev --> phase1["Phase 1: Liberal 1789-1792"]
    frRev --> phase2["Phase 2: Radical 1792-1794"]
    frRev --> phase3["Phase 3: Reaction 1794-1799"]

    phase1 --> p1Pol["Political: Estates-General, National Assembly, constitutional monarchy"]
    phase1 --> p1Soc["Social: Abolition of feudal privileges Aug 4"]
    phase1 --> p1Int["Intellectual: Declaration of Rights of Man"]
    phase1 --> p1Econ["Economic: Fiscal crisis, bread prices, assignats"]

    phase2 --> p2Pol["Political: Republic declared, king executed"]
    phase2 --> p2Rel["Religious: Dechristianization, Civil Constitution of Clergy"]
    phase2 --> p2Soc["Social: Terror, Committee of Public Safety, levee en masse"]
    phase2 --> p2Tech["Technology: Guillotine as democratic execution, metric system"]

    phase3 --> p3Pol["Political: Thermidorian Reaction, Directory, instability"]
    phase3 --> p3Geo["Geography: Revolutionary wars spread ideology across Europe"]
    phase3 --> p3Econ["Economic: Inflation, economic chaos, military contracts"]
```

**Key insight:** The Revolution is the single best AP topic for showing how lenses interact. Economic crisis triggers political upheaval, which unleashes social transformation, which provokes religious conflict, all while intellectual ideas provide justification.

---

## Map 7: Industrial Revolution Transformation

Before-and-after across all Geo-SPRITE lenses.

```mermaid
graph TD
    ir["Industrial Revolution 1760-1850"]

    ir --> before["BEFORE: Agrarian, rural, artisan"]
    ir --> after["AFTER: Industrial, urban, factory"]

    before --> bEcon["Economic: Putting-out system, guild production"]
    before --> bSoc["Social: Rural communities, landed hierarchy"]
    before --> bTech["Technology: Hand tools, water power, animal transport"]
    before --> bGeo["Geography: Dispersed population, local markets"]
    before --> bPol["Political: Landed aristocracy dominates Parliament"]

    after --> aEcon["Economic: Factory system, wage labor, capitalism"]
    after --> aSoc["Social: Urban working class, middle-class industrialists"]
    after --> aTech["Technology: Steam power, railroads, mechanized textiles"]
    after --> aGeo["Geography: Cities explode, national and global markets"]
    after --> aPol["Political: Reform Acts extend vote, new political movements"]

    bEcon -->|"transformed into"| aEcon
    bSoc -->|"displaced by"| aSoc
    bTech -->|"replaced by"| aTech
    bGeo -->|"reorganized into"| aGeo
    bPol -->|"challenged by"| aPol
```

| Lens | Pre-Industrial | Post-Industrial | CCOT Angle |
|------|---------------|-----------------|------------|
| Economic | Agrarian, guild-based | Capitalist, factory-based | Continuity: inequality persisted, just in new forms |
| Social | Rural, hierarchical by birth | Urban, class-based by wealth | Continuity: elites still dominated, but elite identity changed |
| Technology | Hand tools, animal power | Steam, iron, mechanization | Change: qualitative break in production capacity |
| Geography | Local markets, dispersed | National/global markets, concentrated | Change: urbanization rate unprecedented |
| Political | Aristocratic control | Gradual democratization | Continuity: property requirements for voting persisted decades |

---

## Map 8: Nationalism Evolution (Liberal to Ethnic)

How nationalism changed character across the 19th century.

```mermaid
graph TD
    nat["Nationalism Across the 19th Century"]

    nat --> liberal["LIBERAL NATIONALISM 1789-1848"]
    nat --> unification["UNIFICATION NATIONALISM 1848-1871"]
    nat --> ethnic["ETHNIC/AGGRESSIVE NATIONALISM 1871-1914"]

    liberal --> libGoals["Goals: Constitution, self-determination, citizenship"]
    liberal --> libEx["Examples: 1848 Revolutions, Mazzini, Greek independence"]
    liberal --> libSprite["Geo-SPRITE: Intellectual + Political dominant"]

    unification --> uniGoals["Goals: State-building, realpolitik, national consolidation"]
    unification --> uniEx["Examples: Bismarck, Cavour, German/Italian unification"]
    unification --> uniSprite["Geo-SPRITE: Political + Economic dominant"]

    ethnic --> ethGoals["Goals: Racial purity, imperial expansion, exclusion"]
    ethnic --> ethEx["Examples: Dreyfus Affair, Pan-Slavism, anti-Semitism"]
    ethnic --> ethSprite["Geo-SPRITE: Social + Political dominant"]

    liberal -->|"failures of 1848 discredit idealism"| unification
    unification -->|"success of force breeds aggression"| ethnic
```

---

## Map 9: Imperialism Cause Map

Multiple causes feeding into European imperialism, organized by Geo-SPRITE lens.

```mermaid
graph TD
    imp["New Imperialism 1870-1914"]

    econCause["ECONOMIC: Markets for goods, sources of raw materials, investment opportunities"]
    polCause["POLITICAL: National prestige, great-power competition, strategic bases"]
    techCause["TECHNOLOGY: Maxim gun, quinine, steamships, telegraph, railroads"]
    intCause["INTELLECTUAL: Social Darwinism, civilizing mission, racial science"]
    relCause["RELIGIOUS: Christian missionary activity, moral justification"]
    socCause["SOCIAL: Emigration outlet, settler colonies, class tensions redirected outward"]
    geoCause["GEOGRAPHY: Strategic chokepoints: Suez, Cape, Straits"]

    econCause --> imp
    polCause --> imp
    techCause --> imp
    intCause --> imp
    relCause --> imp
    socCause --> imp
    geoCause --> imp

    imp --> conseq["CONSEQUENCES: African partition, Asian subjugation, great-power rivalry, WWI tensions"]
```

| Cause Category | Specific Evidence | Weight in AP Essays |
|---------------|-------------------|-------------------|
| Economic | Hobson's theory of surplus capital; rubber, diamonds, oil | High: graders expect economic analysis |
| Political | Berlin Conference 1884-85; Fashoda Crisis 1898 | High: geopolitical competition is central |
| Technology | Maxim gun; quinine prophylaxis; steamships | Medium: explains HOW, not WHY |
| Intellectual | Social Darwinism; Kipling's "White Man's Burden" | Medium: justification, not root cause |
| Religious | Missionary societies; Livingstone | Lower: supporting, not primary |
| Social | Settler colonies; emigration pressure | Lower: context, not driver |
| Geography | Suez Canal; Cape route; naval bases | Medium: explains WHERE, not WHY |

---

## Map 10: WWI Causation

The layered causes of World War I.

```mermaid
graph TD
    wwi["World War I Outbreak 1914"]

    longTerm["LONG-TERM CAUSES 1870-1907"]
    midTerm["MID-TERM CAUSES 1905-1913"]
    shortTerm["SHORT-TERM TRIGGER 1914"]

    longTerm --> alliance["Alliance system: Triple Alliance vs. Triple Entente"]
    longTerm --> imperial["Imperial rivalries: Africa, Asia, Ottoman territories"]
    longTerm --> militarism["Militarism: Arms race, war planning, Schlieffen Plan"]
    longTerm --> nationalism["Nationalism: Pan-Slavism, irredentism, Alsace-Lorraine"]

    midTerm --> crises["Crises: Morocco 1905/1911, Bosnia 1908, Balkan Wars 1912-13"]
    midTerm --> armsRace["Naval arms race: Dreadnought competition Britain vs. Germany"]
    midTerm --> decline["Ottoman decline: power vacuum in Balkans"]

    shortTerm --> assassination["Assassination of Franz Ferdinand, June 28, 1914"]
    shortTerm --> julycrisis["July Crisis: ultimatums, mobilization timetables"]

    alliance --> wwi
    imperial --> wwi
    militarism --> wwi
    nationalism --> wwi
    crises --> wwi
    armsRace --> wwi
    decline --> wwi
    assassination --> wwi
    julycrisis --> wwi
```

**Key insight for AP essays:** Long-term causes explain WHY Europe was a powder keg. The short-term trigger explains WHEN it exploded. Strong essays distinguish between the two.

---

## Map 11: Fascism / Nazism / Stalinism Comparison

Three totalitarian systems compared across Geo-SPRITE lenses.

```mermaid
graph TD
    total["Totalitarian Systems 1920s-1940s"]

    total --> fasc["Fascist Italy: Mussolini"]
    total --> nazi["Nazi Germany: Hitler"]
    total --> stal["Stalinist USSR: Stalin"]

    fasc --> fascP["Political: One-party state, corporatism, Lateran Treaty"]
    fasc --> fascE["Economic: Corporatist state, autarky attempts"]
    fasc --> fascS["Social: Cult of masculinity, youth indoctrination"]

    nazi --> naziP["Political: Fuhrer principle, Enabling Act, Gestapo"]
    nazi --> naziE["Economic: Rearmament-driven recovery, Schacht/Speer"]
    nazi --> naziR["Religious/Racial: Anti-Semitism, Nuremberg Laws, Holocaust"]

    stal --> stalP["Political: Purges, show trials, secret police NKVD"]
    stal --> stalE["Economic: Five-Year Plans, collectivization, Gulag labor"]
    stal --> stalI["Intellectual: Socialist realism, Lysenko pseudoscience"]
```

| Lens | Fascist Italy | Nazi Germany | Stalinist USSR |
|------|--------------|--------------|----------------|
| Political | One-party corporate state | Fuhrer dictatorship, total state | Party dictatorship, purge-based control |
| Economic | Corporatism, limited autarky | Rearmament boom, Mefo bills | Central planning, forced collectivization |
| Social | Masculinity cult, Roman nostalgia | Racial hierarchy, Volksgemeinschaft | Class war, "new Soviet man" |
| Religious | Concordat with Vatican | Nazified Christianity, neo-paganism | State atheism, persecution of churches |
| Intellectual | Anti-liberalism, futurism | Racial pseudoscience, book burning | Marxism-Leninism, socialist realism |
| Technology | Military modernization attempts | Autobahn, rocketry, industrial warfare | Rapid industrialization, space program foundations |
| Geography | Mediterranean empire ambitions | Lebensraum in Eastern Europe | Eurasian continental power |

---

## Map 12: Cold War Division Map

How the Cold War divided Europe across every Geo-SPRITE dimension.

```mermaid
graph TD
    coldWar["Cold War Division of Europe 1947-1991"]

    coldWar --> west["WESTERN BLOC"]
    coldWar --> east["EASTERN BLOC"]

    west --> wPol["Political: Liberal democracy, NATO, multi-party elections"]
    west --> wEcon["Economic: Marshall Plan, market capitalism, EEC/EU"]
    west --> wSoc["Social: Consumer culture, welfare state, individual rights"]
    west --> wInt["Intellectual: Academic freedom, existentialism, postmodernism"]

    east --> ePol["Political: Communist one-party states, Warsaw Pact, Soviet control"]
    east --> eEcon["Economic: Central planning, COMECON, collectivized agriculture"]
    east --> eSoc["Social: Enforced equality, limited consumer goods, state housing"]
    east --> eInt["Intellectual: Marxism-Leninism enforced, dissidents persecuted"]

    west ---|"Iron Curtain"| east
```

| Lens | Western Bloc | Eastern Bloc | Convergence Point |
|------|-------------|--------------|-------------------|
| Political | Multi-party democracy | One-party communist rule | Both suppressed radical opposition (McCarthyism / purges) |
| Economic | Market capitalism with welfare | Central planning | Both achieved postwar reconstruction, by different means |
| Social | Consumer individualism | Collective equality rhetoric | Both urbanized rapidly and expanded education |
| Religious | Freedom of religion (mostly) | State atheism, persecution | Both secularized over time |
| Intellectual | Academic freedom (with limits) | State-controlled ideology | Both invested heavily in science and technology |
| Technology | Consumer technology, space race | Military/space technology | Nuclear deterrence shaped both sides |
| Geography | Atlantic orientation, NATO | Continental/Eurasian, Warsaw Pact | Berlin: divided city as microcosm |

---

## Map 13: Cross-Unit Bridge Map

How AP units connect to each other. No unit exists in isolation.

```mermaid
graph LR
    u1["Unit 1: Renaissance and Exploration"]
    u2["Unit 2: Reformation"]
    u3["Unit 3: Absolutism and Constitutionalism"]
    u4["Unit 4: Scientific Revolution and Enlightenment"]
    u5["Unit 5: Revolutionary Era"]
    u6["Unit 6: Industrialization"]
    u7["Unit 7: Nationalism and Imperialism"]
    u8["Unit 8: World Wars and Totalitarianism"]
    u9["Unit 9: Cold War and Contemporary"]

    u1 -->|"Humanism provides tools for"| u2
    u1 -->|"Commercial Revolution funds"| u3
    u2 -->|"Religious wars demand"| u3
    u2 -->|"Sola scriptura models"| u4
    u3 -->|"State power provokes critique in"| u4
    u4 -->|"Enlightenment ideas fuel"| u5
    u5 -->|"Revolution disrupts, industrialization fills vacuum"| u6
    u5 -->|"Napoleonic wars spread nationalism"| u7
    u6 -->|"Industrialization creates class tensions and imperial motives"| u7
    u7 -->|"Imperial rivalries and nationalism cause"| u8
    u8 -->|"WWII outcome creates"| u9
    u6 -->|"Industrial inequality fuels socialist/communist ideology in"| u8
```

**Key AP skill:** The best long-essay responses show how causes in one unit produce effects in another. This map shows the most common bridges.

---

## Map 14: Causation Web (Major Cause-Effect Chains)

The longest causal chains in AP European History.

```mermaid
graph TD
    blackDeath["Black Death 1347"] --> laborShortage["Labor shortage empowers workers"]
    laborShortage --> commercialGrowth["Commercial growth, merchant class rises"]
    commercialGrowth --> renaissancePatronage["Patronage funds Renaissance art and thought"]
    renaissancePatronage --> humanism["Humanism: back to original sources"]
    humanism --> lutherMethod["Luther applies humanist method to Bible"]
    lutherMethod --> reformation["Reformation splits Christendom"]
    reformation --> religiousWars["Wars of Religion 1562-1648"]
    religiousWars --> westphalia["Peace of Westphalia: sovereignty principle"]
    westphalia --> stateSystem["Modern state system emerges"]
    stateSystem --> absolutism["Absolutism vs. constitutionalism debate"]
    absolutism --> enlightenmentCritique["Enlightenment critiques of absolute power"]
    enlightenmentCritique --> frenchRev["French Revolution 1789"]
    frenchRev --> napoleon["Napoleonic Wars spread nationalism"]
    napoleon --> nineteenthNat["19th-century nationalism"]
    nineteenthNat --> unification["German/Italian unification"]
    unification --> imperialRivalry["Imperial rivalries"]
    imperialRivalry --> ww1["World War I"]
    ww1 --> versailles["Versailles settlement"]
    versailles --> instability["Interwar instability"]
    instability --> ww2["World War II"]
    ww2 --> coldWarDivision["Cold War division"]
    coldWarDivision --> europeanIntegration["European integration as response"]
```

**Key insight:** This chain from the Black Death to the EU spans the entire AP curriculum. Being able to trace long causal chains is the highest-order skill the exam tests.

---

## Map 15: CCOT Bands (Change vs. Continuity by Unit)

What changed and what persisted in each major AP unit.

| AP Unit | Major Changes | Key Continuities |
|---------|--------------|-----------------|
| 1: Renaissance/Exploration | Secular art, classical revival, Atlantic trade, Columbian Exchange | Church remained dominant patron; feudal structures persisted; most people illiterate |
| 2: Reformation | Christianity splits, state churches, religious wars | Christian framework universal; women's status unchanged; peasant life largely same |
| 3: Absolutism/Constitutionalism | Centralized states, standing armies, Westphalian sovereignty | Aristocratic privilege continued; serfdom expanded in East; monarchy universal |
| 4: Scientific Rev./Enlightenment | Empirical method, natural rights theory, secular philosophy | Most people unaffected; religion remained central; monarchies persisted |
| 5: Revolutionary Era | Popular sovereignty, legal equality, nationalist ideology | Gender hierarchy persisted; colonial exploitation continued; property still = power |
| 6: Industrialization | Factory system, urbanization, working class, railroads | Agricultural sector remained large; rural poverty continued; elite political control |
| 7: Nationalism/Imperialism | Nation-states, colonial empires, mass politics | Great-power system continued; class hierarchy persisted; gender norms mostly stable |
| 8: World Wars | Total war, genocide, collapse of empires, totalitarianism | Nationalism persisted; state power grew further; colonial empires survived (briefly) |
| 9: Cold War/Contemporary | Decolonization, European integration, welfare state, 1989 | National identity persisted; economic inequality continued; security dilemmas remained |

```mermaid
graph LR
    continuity["CONTINUITIES ACROSS ALL UNITS"]
    continuity --> c1["Elites control political power, though elite identity changes"]
    continuity --> c2["Gender hierarchy persists until very late in the curriculum"]
    continuity --> c3["Economic inequality is a constant, only its form changes"]
    continuity --> c4["Religion remains important even as secularization advances"]
    continuity --> c5["State power grows continuously from 1450 to present"]
```

---

## Map 16: The Printing Press Cascade

How a single technology reshaped every Geo-SPRITE lens across multiple centuries.

```mermaid
graph TD
    press["Gutenberg's Printing Press c.1456"]

    press --> intEffect["INTELLECTUAL: Books accessible, literacy grows, ideas spread faster"]
    press --> relEffect["RELIGIOUS: Luther's pamphlets go viral, Reformation spreads"]
    press --> polEffect["POLITICAL: Public opinion becomes a political force"]
    press --> socEffect["SOCIAL: Literacy divides educated from uneducated"]
    press --> econEffect["ECONOMIC: Publishing industry, bookselling, advertising emerge"]
    press --> techEffect["TECHNOLOGY: Standardized texts enable scientific collaboration"]

    intEffect --> enlightenmentLink["Enlightenment depends on printed books and periodicals"]
    relEffect --> counterRef["Counter-Reformation uses print: catechisms, Index of Forbidden Books"]
    polEffect --> revLink["Revolutionary pamphlets, newspapers fuel 1789"]
    socEffect --> publicSphere["Public sphere: coffeehouses, salons, reading societies"]
    econEffect --> newsIndustry["Newspaper industry shapes 19th-century politics"]
    techEffect --> sciJournals["Scientific journals enable peer review and cumulative knowledge"]
```

---

## Map 17: The Atlantic System Web

How the Atlantic economy connected four continents and reshaped European power.

```mermaid
graph TD
    atlantic["Atlantic Economic System 1500-1800"]

    europe["EUROPE: Manufactures, capital, demand"]
    africa["AFRICA: Enslaved labor, gold, ivory"]
    americas["AMERICAS: Silver, sugar, tobacco, cotton"]
    asia["ASIA: Spices, textiles, porcelain via re-export"]

    europe -->|"Manufactured goods, weapons"| africa
    africa -->|"Enslaved people via Middle Passage"| americas
    americas -->|"Raw materials, silver"| europe
    europe -->|"Silver from Americas buys"| asia
    asia -->|"Luxury goods re-exported via"| europe

    atlantic --> priceRev["Price Revolution: American silver inflates European prices"]
    atlantic --> mercSystem["Mercantilism: Colonies exist to enrich mother country"]
    atlantic --> slaveEcon["Plantation system: Sugar, tobacco, cotton drive demand for enslaved labor"]
    atlantic --> commercialRev["Commercial Revolution: Banks, joint-stock companies, insurance"]
```

| Component | Geo-SPRITE Lens | AP Significance |
|-----------|----------------|-----------------|
| Silver flows | Economic/Geographic | Inflated European prices, destabilized Spain, funded Asian trade |
| Enslaved labor | Social/Economic | Central to plantation agriculture; not peripheral to European wealth |
| Plantation commodities | Economic/Technology | Sugar, tobacco, cotton transformed European consumption and industry |
| Mercantilist policy | Political/Economic | States competed for colonial advantage through trade regulation |
| Middle Passage | Social/Geographic | Largest forced migration in history; demographic catastrophe for Africa |

---

## Map 18: Women's History Through AP European History

How women's roles changed (and didn't change) across the curriculum.

```mermaid
graph TD
    women["Women in AP European History"]

    women --> medieval["Medieval/Renaissance: Christine de Pizan, women as patrons, convents as spaces"]
    women --> reform["Reformation: Clerical marriage, Protestant domesticity, Catholic women's orders"]
    women --> enlight["Enlightenment: Salons, Wollstonecraft, Olympe de Gouges"]
    women --> indust["Industrialization: Factory labor, domestic ideology, suffrage movements"]
    women --> twentiethC["20th Century: WWI mobilization, suffrage, de Beauvoir, welfare state"]

    medieval -->|"Limited change"| reform
    reform -->|"Domesticity reinforced"| enlight
    enlight -->|"Ideas of equality articulated"| indust
    indust -->|"Structural change begins"| twentiethC

    continuity["CONTINUITY: Legal subordination, limited property rights, exclusion from formal politics"]
    continuity -.->|"persists through"| medieval
    continuity -.->|"persists through"| reform
    continuity -.->|"persists through"| enlight
    continuity -.->|"persists through"| indust
    continuity -.->|"finally challenged in"| twentiethC
```

| Period | Key Figure/Event | What Changed | What Continued |
|--------|-----------------|--------------|----------------|
| Renaissance | Christine de Pizan | Elite women as patrons, writers | Legal subordination, no political rights |
| Reformation | Clerical marriage normalized | Protestant wives gain new domestic status | Women excluded from clergy, theology |
| Enlightenment | Wollstonecraft, salon hostesses | Intellectual participation argued | No legal or political rights gained |
| Industrial | Factory Acts, suffrage campaigns | Working-class women enter public labor force | Domestic ideology intensifies for middle class |
| 20th Century | WWI, suffrage, de Beauvoir | Voting rights, legal equality, workplace access | Pay gaps, care burdens, cultural expectations |

---

## Map 19: Revolutions Compared (1789, 1830, 1848, 1917)

Pattern analysis of European revolutions using Geo-SPRITE.

```mermaid
graph TD
    revPattern["Revolutionary Pattern"]

    revPattern --> precond["PRECONDITIONS"]
    revPattern --> trigger["TRIGGER"]
    revPattern --> phases["PHASES"]
    revPattern --> outcome["OUTCOME"]

    precond --> econCrisis["Economic crisis: food prices, unemployment, fiscal collapse"]
    precond --> intIdeas["Intellectual ideas: rights, sovereignty, justice"]
    precond --> socTension["Social tension: inequality, class resentment"]
    precond --> polRigid["Political rigidity: regime refuses reform"]

    trigger --> catalystEvent["Catalyst event: storming, barricades, strikes"]

    phases --> liberal["Liberal phase: moderates seize initiative"]
    phases --> radical["Radical phase: extremists push further"]
    phases --> reaction["Reaction: exhaustion, backlash, restoration or consolidation"]

    outcome --> partialChange["Partial change: some reforms survive, others reversed"]
    outcome --> newElite["New elite emerges, old elite partially restored"]
```

| Revolution | Economic Trigger | Social Base | Intellectual Framework | Outcome |
|-----------|-----------------|-------------|----------------------|---------|
| French 1789 | Fiscal crisis, bread prices | Bourgeoisie, urban poor | Enlightenment rights | Republic, then Napoleon |
| 1830 July | Post-war recession | Liberal bourgeoisie | Constitutional liberalism | Constitutional monarchy |
| 1848 | Crop failures, unemployment | Workers and middle class | Nationalism + liberalism | Mostly failed; serfdom ended in Austria |
| Russian 1917 | WWI strain, food shortages | Workers, soldiers, peasants | Marxism + war weariness | Communist dictatorship |

---

## Map 20: The European Integration Pathway

From postwar ruins to the European Union, mapped through Geo-SPRITE lenses.

```mermaid
graph TD
    postwar["Postwar Devastation 1945"]

    postwar --> marshall["Marshall Plan 1948: American capital rebuilds Western Europe"]
    marshall --> ecsc["ECSC 1951: Coal and steel pooled to prevent war"]
    ecsc --> eec["EEC 1957: Treaty of Rome, customs union of six"]
    eec --> sea["Single European Act 1986: unified internal market"]
    sea --> maastricht["Maastricht Treaty 1992: EU created, euro planned"]
    maastricht --> enlargement["Eastern Enlargement 2004: former communist states join"]
    enlargement --> crisis["Crises: Euro crisis 2010, migration 2015, Brexit 2016"]

    econMotives["ECONOMIC: Prevent beggar-thy-neighbor policies, create scale"]
    polMotives["POLITICAL: Make war impossible, contain Germany peacefully"]
    geoMotives["GEOGRAPHIC: Create a bloc rivaling US and USSR"]
    socMotives["SOCIAL: Free movement of people, shared European identity"]
    intMotives["INTELLECTUAL: Federalist idealism, functionalist strategy"]

    econMotives --> ecsc
    polMotives --> ecsc
    geoMotives --> eec
    socMotives --> sea
    intMotives --> postwar
```

| Stage | Year | Geo-SPRITE Driver | Key Tension |
|-------|------|------------------|-------------|
| ECSC | 1951 | Economic + Political | Sovereignty vs. integration |
| EEC | 1957 | Economic + Geographic | National interest vs. common market |
| Single Act | 1986 | Economic + Social | Regulation vs. deregulation |
| Maastricht | 1992 | Political + Economic | Federal Europe vs. national sovereignty |
| Enlargement | 2004 | Geographic + Political | Rich West vs. poorer East |
| Crises | 2010s | Economic + Social | Austerity vs. solidarity; open borders vs. national control |

---

## Appendix: How to Read These Maps for AP Essays

**For causation prompts:** Follow the arrows. Identify which Geo-SPRITE lens provides the strongest causal link. Use a secondary lens for complexity.

**For comparison prompts:** Use the side-by-side tables. Pick two or three lenses where the comparison is sharpest. Avoid listing all seven lenses without analysis.

**For CCOT prompts:** Use Map 15's change/continuity bands as a starting framework. The most common AP mistake is describing only change without identifying what persisted.

**General rule:** One well-analyzed connection between two lenses beats a superficial tour of all seven. Depth over breadth.
