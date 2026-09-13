/* Original classroom practice. This supplement is not a College Board assessment. */
(function () {
  'use strict';

  window.EURO_CLASSROOM_CONTENT = {
    version: 1,
    reviewed: '2026-09-13',
    notice: 'Original practice for discussion and formative feedback, organized around the nine AP European History units. This is a study supplement, not a complete course or an official AP assessment. Source paraphrases and instructional summaries are labeled; open the linked original for close reading.',
    sources: [
      { label: 'College Board: course and exam description, effective fall 2026', url: 'https://apcentral.collegeboard.org/media/pdf/ap-european-history-course-and-exam-description.pdf' },
      { label: 'College Board: exam format', url: 'https://apcentral.collegeboard.org/courses/ap-european-history/exam' },
      { label: 'College Board: changes beginning with the May 2027 exam', url: 'https://apcentral.collegeboard.org/courses/ap-history-exam-updates' }
    ],
    units: [
      {
        id: 1, title: 'Renaissance and Exploration', dates: 'c. 1450–1648',
        question: 'How did new ways of learning and expanding trade change European society?',
        focus: ['Explain humanism alongside continuing religious belief.', 'Connect Atlantic commerce to colonization, enslavement, and the Columbian Exchange.', 'Trace how print and patronage shaped the circulation of ideas.']
      },
      {
        id: 2, title: 'Age of Reformation', dates: 'c. 1450–1648',
        question: 'How did religious change reshape political authority and everyday life?',
        focus: ['Compare Protestant reforms with Catholic renewal.', 'Distinguish theological disputes from rulers’ political interests.', 'Explain the scope and limits of religious settlements.']
      },
      {
        id: 3, title: 'Absolutism and Constitutionalism', dates: 'c. 1648–1815',
        question: 'Why did European states develop different ways to organize and limit power?',
        focus: ['Compare monarchy in France with parliamentary limits in England.', 'Explain the relationship between commerce, taxation, and state power.', 'Consider how nobles and local institutions constrained rulers.']
      },
      {
        id: 4, title: 'Scientific, Philosophical, and Political Developments', dates: 'c. 1648–1815',
        question: 'How did challenges to established knowledge change ideas about society?',
        focus: ['Assess how observation and mathematics challenged inherited explanations.', 'Connect Enlightenment arguments to debates about rights and education.', 'Evaluate the limits of reform under enlightened absolutists.']
      },
      {
        id: 5, title: 'Conflict, Crisis, and Reaction in the Late 18th Century', dates: 'c. 1648–1815',
        question: 'How far did revolution and war transform the European political order?',
        focus: ['Weigh fiscal, social, and intellectual causes of revolution.', 'Assess changes and continuities under Napoleon.', 'Explain the Congress of Vienna’s approach to political stability.']
      },
      {
        id: 6, title: 'Industrialization and Its Effects', dates: 'c. 1815–1914',
        question: 'How did industrialization change work, social relations, and political demands?',
        focus: ['Explain Britain’s early industrialization and its uneven spread.', 'Compare liberal, socialist, and reformist responses to industrial society.', 'Distinguish legislation from workers’ lived conditions.']
      },
      {
        id: 7, title: '19th-Century Perspectives and Political Developments', dates: 'c. 1815–1914',
        question: 'How did nationalism, mass politics, and empire reshape power and belonging?',
        focus: ['Compare the roles of popular movements and state leaders in unification.', 'Explain how reform and repression operated together in mass politics.', 'Evaluate imperial justifications alongside colonial coercion and resistance.']
      },
      {
        id: 8, title: '20th-Century Global Conflicts', dates: 'c. 1914–present',
        question: 'How did war, economic crisis, and political choices transform Europe?',
        focus: ['Distinguish underlying conditions, immediate triggers, and decisions leading to war.', 'Compare the timing and mechanisms of authoritarian takeovers.', 'Study the Holocaust through evidence about persecution, perpetrators, and victims.']
      },
      {
        id: 9, title: 'Cold War and Contemporary Europe', dates: 'c. 1914–present',
        question: 'How did division, decolonization, and integration redefine Europe’s place in the world?',
        focus: ['Explain competing visions of security and society during the Cold War.', 'Connect local opposition with the end of Soviet control in Eastern Europe.', 'Assess European integration and decolonization as changes in sovereignty.']
      }
    ],
    practice: [
      {
        id: 'u1-humanism', unit: 1, skill: 'Contextualization',
        stem: 'Instructional summary: Renaissance humanists studied ancient Greek and Roman texts, emphasized rhetoric and moral education, and often remained practicing Christians. Which conclusion best follows from this combination?',
        options: ['Classical learning could be used to pursue civic and Christian reform.', 'Humanist education depended on rejecting religious belief.', 'Humanists sought to replace ancient literature with medieval commentaries.', 'Humanism required governments to separate church and state.'],
        answer: 0,
        explanation: 'Humanism was an approach to learning that could serve religious and civic aims. Erasmus’s Christian humanism is one example. Studying classical texts did not automatically imply atheism or a modern separation of church and state.'
      },
      {
        id: 'u1-atlantic', unit: 1, skill: 'Causation',
        stem: 'Instructional summary: Demand for sugar grew in Europe while plantation owners in the Americas sought a large, controlled labor force. Which development most directly connected these changes?',
        options: ['The spread of independent peasant ownership across plantation colonies.', 'The decline of European maritime commerce in favor of overland trade.', 'The expansion of the forced transportation and enslavement of Africans.', 'The replacement of export plantations by production for local consumption.'],
        answer: 2,
        explanation: 'European consumption and plantation production helped drive the Atlantic slave trade. Enslaved Africans’ coerced labor generated wealth for planters and merchants. This connection describes exploitation; it does not erase African resistance or the different experiences of individual colonies.'
      },
      {
        id: 'u1-print', unit: 1, skill: 'Evaluating evidence',
        stem: 'A student argues that printing quickly made European intellectual life equally accessible to everyone. Which evidence most directly qualifies that argument?',
        options: ['Printers produced religious works as well as secular works.', 'Literacy, book prices, language, and censorship still affected who could read texts.', 'Some printers sold editions of works written in antiquity.', 'Printed pamphlets could circulate beyond the city where they were produced.'],
        answer: 1,
        explanation: 'Printing increased the scale and speed of circulation, but access remained unequal. The other choices describe print’s range or reach without directly challenging the claim of equal access. A qualified claim preserves the change while explaining its limits.'
      },
      {
        id: 'u2-nantes', unit: 2, skill: 'Comparison',
        stem: 'Instructional summary: The Peace of Augsburg (1555) recognized Catholicism and Lutheranism within the Holy Roman Empire. The Edict of Nantes (1598) granted French Huguenots limited protections while Catholicism remained the established religion. What did both settlements demonstrate?',
        options: ['Religious settlements made individual freedom of belief the basis of all government.', 'Calvinism became the established religion in France and the German states.', 'Religious institutions ceased to influence the political order.', 'Rulers accepted limited religious accommodation as a way to reduce conflict.'],
        answer: 3,
        explanation: 'Both arrangements used limited accommodation to address conflict, but their terms differed. Augsburg privileged rulers’ confessional choices and excluded Calvinism; Nantes granted specified rights to Huguenots. Neither established modern, universal religious equality.'
      },
      {
        id: 'u2-catholic-reform', unit: 2, skill: 'Continuity and change',
        stem: 'Instructional summary: The Council of Trent reaffirmed Catholic teachings on sacraments and salvation while strengthening clergy training and addressing abuses. Which interpretation best explains this combination?',
        options: ['Catholic leaders pursued institutional renewal while defending core doctrine.', 'Catholic leaders adopted Luther’s central teachings to reunify western Christianity.', 'The council transferred final doctrinal authority from the Church to individual believers.', 'The council ended missionary activity in order to focus exclusively on Europe.'],
        answer: 0,
        explanation: 'Catholic reform involved both continuity and change: the Church defended its doctrinal position while reforming institutions and discipline. Reform therefore did not necessarily mean conversion to Protestantism. Catholic missionary activity also expanded.'
      },
      {
        id: 'u2-france-war', unit: 2, skill: 'Evaluating an argument',
        stem: 'Instructional summary: Catholic France entered the Thirty Years’ War directly against the Habsburg powers in 1635 and cooperated with Protestant opponents of the Habsburgs. Which claim does this evidence most strongly support?',
        options: ['French leaders had converted the monarchy to Lutheranism.', 'Religious divisions had disappeared from European politics by 1635.', 'Dynastic and strategic interests could outweigh confessional solidarity.', 'The war was fought solely over overseas colonial markets.'],
        answer: 2,
        explanation: 'France’s policy is evidence that weakening Habsburg power could matter more than cooperation with other Catholic rulers. It qualifies an explanation based only on religion, but does not prove religion was irrelevant to the war.'
      },
      {
        id: 'u3-bill-rights', unit: 3, skill: 'Source analysis',
        stem: 'Paraphrase of the English Bill of Rights (1689): The Crown may not suspend laws or raise revenue on its own authority without Parliament’s consent. Which political change does this provision best illustrate?',
        options: ['The replacement of Parliament by an elected presidency.', 'The limitation of royal authority through parliamentary institutions.', 'The introduction of equal voting rights for all adults.', 'The removal of religious restrictions from English public life.'],
        answer: 1,
        explanation: 'The provision restricts unilateral royal action and strengthens Parliament. It is evidence of constitutional monarchy, not universal democracy: the franchise and access to public office remained restricted.',
        source: { label: 'UK Parliament: Bill of Rights, 1689', url: 'https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/revolution/collections1/collections-glorious-revolution/billofrights/' }
      },
      {
        id: 'u3-mercantilism', unit: 3, skill: 'Causation',
        stem: 'Instructional summary: Jean-Baptiste Colbert supported domestic manufacturing, protective tariffs, and French overseas commerce under Louis XIV. What was a central political aim of these policies?',
        options: ['To make nobles financially independent of the monarchy.', 'To eliminate the state’s role in directing commerce.', 'To transfer control over French taxation to colonial assemblies.', 'To increase the resources available for royal power and competition with rival states.'],
        answer: 3,
        explanation: 'Mercantilist policies linked economic development and regulated trade to state power. Colbert sought revenues and productive capacity that could support the monarchy. These policies differ from laissez-faire and did not aim to give colonies independent control of imperial commerce.'
      },
      {
        id: 'u3-absolute-limits', unit: 3, skill: 'Evaluating an argument',
        stem: 'A student writes: “An absolute monarch exercised effective control over every institution and person.” Which evidence would most directly require revision of this claim?',
        options: ['French kings negotiated with privileged elites and faced limits in taxation and local administration.', 'Louis XIV used elaborate ceremony to demonstrate royal authority.', 'French officials defended the doctrine of divine-right monarchy.', 'Versailles displayed imagery celebrating the achievements of the king.'],
        answer: 0,
        explanation: 'Absolutism describes claims to sovereignty and efforts to concentrate power, not unlimited administrative capacity. Negotiations, exemptions, and local resistance show the gap between royal ambitions and practical control. Court ceremony mainly supports a claim about the image of power.'
      },
      {
        id: 'u4-wollstonecraft', unit: 4, skill: 'Source analysis',
        stem: 'Paraphrase of Mary Wollstonecraft, A Vindication of the Rights of Woman (1792): Women’s dependence results in part from an education that neglects their capacity to reason. Which Enlightenment idea does this argument extend?',
        options: ['Inherited social rank determines a person’s intellectual abilities.', 'Political obedience depends on preserving women’s ignorance.', 'Human reason provides a basis for questioning customary hierarchies.', 'Education should prepare women only to please men.'],
        answer: 2,
        explanation: 'Wollstonecraft uses reason to challenge gender hierarchy and unequal education. Her argument exposes a tension between claims about universal human capacities and the exclusion of women. It should not be mistaken for evidence that legal equality had already been achieved.',
        source: { label: 'Mary Wollstonecraft: A Vindication of the Rights of Woman (1792)', url: 'https://www.gutenberg.org/ebooks/3420' }
      },
      {
        id: 'u4-galileo', unit: 4, skill: 'Evaluating evidence',
        stem: 'Instructional summary: Galileo observed moons orbiting Jupiter and the phases of Venus. These observations challenged important features of traditional Ptolemaic astronomy. What is the most defensible historical interpretation?',
        options: ['The observations caused Europeans immediately to abandon all religious beliefs.', 'New instruments supplied evidence that could challenge inherited explanations of nature.', 'Galileo’s observations established Newton’s laws of motion before Newton was born.', 'Observation replaced all use of mathematics in studying the natural world.'],
        answer: 1,
        explanation: 'The telescope made observations available that challenged inherited models and supported a different approach to astronomy. These findings were significant evidence, not an instant proof accepted by everyone. Scientific change involved debate, mathematics, patronage, and continuing religious commitments.',
        source: { label: 'NASA: Galileo’s observations of the Moon, Jupiter, Venus, and the Sun', url: 'https://science.nasa.gov/solar-system/moon/galileos-observations-of-the-moon-jupiter-venus-and-the-sun/' }
      },
      {
        id: 'u4-enlightened-rule', unit: 4, skill: 'Continuity and change',
        stem: 'Instructional summary: Catherine II corresponded with Enlightenment thinkers and discussed legal reform, yet preserved autocracy and strengthened noble privileges. Which interpretation best fits this evidence?',
        options: ['Catherine’s interest in philosophy made Russia a parliamentary monarchy.', 'Russia had abolished serfdom before the French Revolution began.', 'Enlightenment ideas had no influence on any European ruler.', 'A ruler could adopt reformist language while protecting the social foundations of absolute power.'],
        answer: 3,
        explanation: 'Enlightened absolutism combined selective reform with continued monarchical authority. Catherine’s dependence on the nobility helps explain the limits of reform. Interest in Enlightenment ideas did not automatically produce political participation or the emancipation of serfs.'
      },
      {
        id: 'u5-declaration', unit: 5, skill: 'Source analysis',
        stem: 'Paraphrase of the Declaration of the Rights of Man and of the Citizen (1789): Political authority comes from the nation; rights include liberty and property, and the law should apply equally. Which feature of the Old Regime did these principles most directly challenge?',
        options: ['Political legitimacy grounded in hereditary authority and legally privileged estates.', 'The existence of private property and legally protected ownership.', 'The idea that public authority should protect personal security.', 'The use of representative institutions to express the nation’s will.'],
        answer: 0,
        explanation: 'National sovereignty and legal equality challenged hereditary political authority and estate privilege. The declaration defended property rather than abolishing it. Its broad principles also prompted disputes over the exclusion of women and enslaved people from equal rights.',
        source: { label: 'Declaration of the Rights of Man and of the Citizen (1789), Yale Avalon Project', url: 'https://avalon.law.yale.edu/18th_century/rightsof.asp' }
      },
      {
        id: 'u5-napoleon', unit: 5, skill: 'Continuity and change',
        stem: 'Instructional summary: Napoleon’s Civil Code preserved legal equality for men and property rights while reinforcing husbands’ authority over wives. His government also restricted political opposition. Which thesis best explains his relationship to the Revolution?',
        options: ['Napoleon restored the Old Regime’s legal estates and abandoned all revolutionary reforms.', 'Napoleon fulfilled the Revolution’s most expansive claims of political and gender equality.', 'Napoleon institutionalized some revolutionary reforms while limiting political freedom and women’s autonomy.', 'Napoleon’s domestic policies had no connection to debates raised during the Revolution.'],
        answer: 2,
        explanation: 'This thesis explains both change and continuity using specific dimensions: law, property, politics, and gender. It avoids treating Napoleon as either a complete restoration of the Old Regime or a full realization of revolutionary equality.'
      },
      {
        id: 'u5-vienna', unit: 5, skill: 'Causation',
        stem: 'Instructional summary: At the Congress of Vienna (1814–1815), the major powers restored dynasties and adjusted territory so that no single state could easily dominate Europe. What best explains these decisions?',
        options: ['A shared commitment to satisfy every nationalist movement’s demand for a state.', 'An effort to prevent renewed upheaval through legitimacy and a balance of power.', 'A plan to abolish monarchy throughout the continent.', 'An agreement to eliminate diplomatic cooperation among the major powers.'],
        answer: 1,
        explanation: 'The settlement sought stability after revolutionary and Napoleonic war. Dynastic restoration and the balance of power were central principles, although rulers also pursued their own strategic interests. Liberal and nationalist demands were frequently subordinated to those goals.'
      },
      {
        id: 'u6-factory-act', unit: 6, skill: 'Evaluating evidence',
        stem: 'Instructional summary: Britain’s Factory Act of 1833 restricted children’s hours in textile mills and created a factory inspectorate. Which additional evidence would best help assess how effectively the law changed working conditions?',
        options: ['The number of copies of a novel about rural life printed in 1833.', 'A list of the monarchs who ruled Britain before industrialization.', 'A map of Britain’s medieval dioceses.', 'Inspectors’ reports, prosecution records, and workers’ accounts after the act took effect.'],
        answer: 3,
        explanation: 'Passing a law and enforcing it are different historical questions. Reports, prosecutions, and workers’ accounts can reveal compliance, evasion, and experience. Use several types of evidence because an official report or an individual testimony may not represent every workplace.',
        source: { label: 'The National Archives: 1833 Factory Act and records for investigation', url: 'https://www.nationalarchives.gov.uk/education/resources/1833-factory-act/' }
      },
      {
        id: 'u6-ideologies', unit: 6, skill: 'Comparison',
        stem: 'Instructional summary: Classical economic liberals emphasized private property and competition. Marx and Engels argued that capitalist ownership generated conflict between the bourgeoisie and proletariat. What most clearly distinguishes these positions?',
        options: ['Whether private ownership of productive property should remain the basis of the economic order.', 'Whether the steam engine had any practical applications.', 'Whether the population of European cities had grown.', 'Whether industrial production required work by human beings.'],
        answer: 0,
        explanation: 'Both positions responded to industrial society, but they differed fundamentally over capitalist ownership and class relations. Marx and Engels advocated overcoming capitalism through class struggle. The comparison is about interpretation and proposed social organization, not the existence of factories or cities.'
      },
      {
        id: 'u6-industrial-chronology', unit: 6, skill: 'Causation',
        stem: 'A student claims that the British Reform Act of 1832 caused the beginning of Britain’s Industrial Revolution. Which revision best addresses the chronological problem?',
        options: ['Replace 1832 with 1848 because revolutions always produce industrialization.', 'Remove all political and institutional factors from explanations of industrialization.', 'Explain earlier industrialization through factors such as coal, capital, markets, and agricultural change; examine 1832 as a later political development.', 'Treat industrialization as an event that occurred in a single year after the act passed.'],
        answer: 2,
        explanation: 'Britain’s industrial transformation began in the eighteenth century, before the 1832 Reform Act. An event cannot explain the start of a process already underway. Earlier institutions and policies may still be relevant; the mistake is the timing of this particular claim.'
      },
      {
        id: 'u7-bismarck', unit: 7, skill: 'Source analysis',
        stem: 'Paraphrase of Bismarck’s speech to the Reichstag on workers’ compensation (1884): The state should act to improve workers’ security rather than leave social reform to its political opponents. In the context of the Anti-Socialist Laws, what does this position suggest?',
        options: ['Bismarck intended to transfer control of the state to socialist parties.', 'Social welfare could be used to strengthen loyalty to a conservative state.', 'Bismarck believed that industrial workers should receive no state assistance.', 'The German government had stopped trying to restrict political opposition.'],
        answer: 1,
        explanation: 'Bismarck combined social insurance with repression of socialist organization. The speech’s purpose was to win support for government-led reform and present the state as a protector of workers. Supporting welfare did not make his government democratic or socialist.',
        source: { label: 'Bismarck’s Reichstag speech, March 15, 1884 — German History in Documents and Images', url: 'https://germanhistorydocs.org/en/forging-an-empire-bismarckian-germany-1866-1890/bismarck-s-reichstag-speech-on-the-law-for-workers-compensation-march-15-1884' }
      },
      {
        id: 'u7-imperial-evidence', unit: 7, skill: 'Evaluating evidence',
        stem: 'A historian is investigating European claims that imperial rule primarily benefited colonized peoples. Which research approach would most effectively test those claims?',
        options: ['Accept official colonial speeches as complete descriptions of colonial society.', 'Exclude economic records because imperialism concerned only culture.', 'Study European motives without considering the experiences of colonized people.', 'Compare official claims with labor records, economic outcomes, and accounts by colonized people.'],
        answer: 3,
        explanation: 'A claim about colonial rule’s effects requires evidence beyond the rulers’ stated intentions. Labor systems, resource transfers, and accounts of resistance or adaptation help test the claim. Sources should be evaluated for perspective, context, and representativeness rather than accepted solely because they are official.'
      },
      {
        id: 'u7-unification', unit: 7, skill: 'Comparison',
        stem: 'Instructional summary: Italian unification involved Cavour’s diplomacy, Piedmont-Sardinia’s military action, and Garibaldi’s volunteers. German unification involved Prussian leadership, Bismarck’s diplomacy, and wars against neighboring powers. What is the strongest comparison?',
        options: ['Both processes combined nationalist aspirations with diplomacy and military action led by existing states.', 'Both were accomplished solely through peaceful votes in representative assemblies.', 'Both created republics that excluded hereditary rulers.', 'Both depended entirely on popular volunteers without a role for established governments.'],
        answer: 0,
        explanation: 'State leadership, diplomacy, warfare, and nationalist ideas interacted in both cases, although their balance differed. Italy’s popular military movement was especially important. Germany and Italy became monarchies, and neither unification can be reduced to purely peaceful or purely popular action.'
      },
      {
        id: 'u8-nuremberg', unit: 8, skill: 'Source analysis',
        stem: 'Paraphrase of the Reich Citizenship Law (1935): Full political rights were reserved for people the Nazi state classified as being of German or related ancestry. What does this source reveal about Nazi rule?',
        options: ['It protected equal citizenship regardless of ancestry or religion.', 'It made religious conversion sufficient to escape persecution.', 'It embedded racist exclusion in state institutions and law.', 'It was a postwar measure used to prosecute Nazi officials.'],
        answer: 2,
        explanation: 'The Nuremberg Laws institutionalized antisemitic persecution through false racial categories. They helped exclude Jews from public life before wartime deportation and mass murder. These 1935 laws must not be confused with the postwar Nuremberg trials.',
        source: { label: 'US Holocaust Memorial Museum: Nuremberg Laws, including translated text', url: 'https://encyclopedia.ushmm.org/content/en/article/nuremberg-laws' }
      },
      {
        id: 'u8-july-crisis', unit: 8, skill: 'Causation',
        stem: 'Instructional sequence: Archduke Franz Ferdinand was assassinated in June 1914; Austria-Hungary then issued an ultimatum to Serbia; mobilizations and declarations of war widened the crisis. Which explanation best distinguishes a trigger from the process of escalation?',
        options: ['The assassination made all later diplomatic and military decisions irrelevant.', 'The assassination triggered a crisis that leaders’ choices, alliances, and military planning helped turn into a wider war.', 'The war began because Germany was already a member of the postwar League of Nations.', 'The assassination was an effect of the Treaty of Versailles.'],
        answer: 1,
        explanation: 'The assassination was an immediate trigger, while subsequent choices and existing tensions helped escalate the conflict. This preserves both context and human agency. An alliance system created pressures but did not remove the need for governments to decide how to respond.'
      },
      {
        id: 'u8-interwar-timing', unit: 8, skill: 'Evaluating an argument',
        stem: 'Instructional chronology: Mussolini became prime minister in 1922; the Wall Street crash occurred in 1929; Hitler became chancellor in 1933. Which argument is best supported by this chronology?',
        options: ['The Great Depression explains Mussolini’s original appointment in 1922.', 'Italy and Germany followed identical political paths after the crash.', 'Economic conditions cannot contribute to political instability.', 'The Depression helped Nazi gains, but earlier conditions are needed to explain Italian fascism’s rise.'],
        answer: 3,
        explanation: 'The sequence rules out the 1929 crash as the cause of Mussolini’s appointment seven years earlier. Italy’s postwar instability, political violence, and elite decisions mattered. The Depression contributed to Nazi support, but Hitler’s appointment also involved political choices and institutional weaknesses.'
      },
      {
        id: 'u9-schuman', unit: 9, skill: 'Source analysis',
        stem: 'Paraphrase of the Schuman Declaration (1950): France and Germany should place coal and steel production under a shared authority open to other European states. What was the proposal’s central political logic?',
        options: ['Joint management of strategic industries could support reconstruction and make renewed Franco-German war harder.', 'All European states should immediately adopt a single currency.', 'France should permanently prohibit all German industrial production.', 'Economic reconstruction should proceed without cooperation between former enemies.'],
        answer: 0,
        explanation: 'Coal and steel were important to industry and warfare. Pooling them linked recovery to cooperation and reduced the scope for national rivalry. The proposal led toward the European Coal and Steel Community; it did not immediately create the EU or the euro.',
        source: { label: 'European Union: Schuman Declaration, May 9, 1950', url: 'https://european-union.europa.eu/principles-countries-history/history-eu/1945-59/schuman-declaration-may-1950_en' }
      },
      {
        id: 'u9-1989', unit: 9, skill: 'Comparison and causation',
        stem: 'Instructional summary: Soviet troops suppressed the Hungarian uprising in 1956 and the Prague Spring in 1968. In 1989, the USSR did not use comparable force to keep Eastern European communist governments in power. Which interpretation best explains the importance of this difference?',
        options: ['Eastern Europeans had stopped organizing opposition by 1989.', 'All communist governments disappeared on the same day in 1989.', 'Changed Soviet policy gave local movements more room to challenge regimes already facing serious problems.', 'The Soviet Union had already dissolved before the Hungarian uprising.'],
        answer: 2,
        explanation: 'Gorbachev’s reduced willingness to intervene changed the possibilities for domestic opposition. Economic difficulties, Solidarity in Poland, demonstrations, and negotiations also mattered. The USSR dissolved in 1991; the revolutions of 1989 should not be collapsed into a single event.'
      },
      {
        id: 'u9-decolonization', unit: 9, skill: 'Causation',
        stem: 'A student explains post-1945 decolonization only as a consequence of European weakness after World War II. Which addition would most strengthen the explanation?',
        options: ['European empires ended before nationalist organizations developed.', 'Anticolonial organizers, mass movements, and armed struggles also pressed claims to self-determination.', 'Every colony gained independence through the same peaceful negotiation.', 'Formal independence ended all economic and cultural relationships with former imperial powers.'],
        answer: 1,
        explanation: 'European exhaustion mattered, but colonized people actively challenged imperial rule. Negotiation, protest, and warfare varied across cases such as India and Algeria. Independence changed political sovereignty while leaving contested economic, migratory, and cultural connections.'
      }
    ],
    writing: [
      {
        unit: 1,
        prompt: 'Develop a claim about the extent to which the Renaissance changed European intellectual life between c. 1450 and 1600. Support it with two specific examples and explain one important continuity.',
        checklist: ['State a defensible claim about the extent of change.', 'Use two specific examples, such as humanist education, patronage, or printing.', 'Explain how each example supports the claim.', 'Account for continuing religious belief or unequal access to education.']
      },
      {
        unit: 2,
        prompt: 'Explain the relative importance of religious and political motives in European conflict from 1517 to 1648. Use two specific developments to support a claim and show how the motives could overlap.',
        checklist: ['Make a claim about the relationship between religion and politics.', 'Use precise examples such as Augsburg, the French Wars of Religion, or France’s entry into the Thirty Years’ War.', 'Explain the motives of particular actors instead of treating all rulers alike.', 'Address evidence that qualifies an explanation based on a single cause.']
      },
      {
        unit: 3,
        prompt: 'Compare how rulers and institutions exercised political power in France and England between 1648 and 1715. Explain one significant similarity and one significant difference using specific evidence.',
        checklist: ['Identify a meaningful basis for comparison, such as taxation or control of elites.', 'Support the comparison with evidence from both states.', 'Explain the significance of parliamentary limits and royal claims to authority.', 'Distinguish claims to absolute power from rulers’ practical capacity.']
      },
      {
        unit: 4,
        prompt: 'Read the linked Wollstonecraft source in this unit’s practice. Explain how her argument uses Enlightenment reasoning to challenge women’s unequal status, then connect it to one other eighteenth-century debate about rights.',
        checklist: ['Identify Wollstonecraft’s claim accurately.', 'Explain how her purpose shapes her criticism of women’s education.', 'Use a specific example from another debate about rights.', 'Distinguish arguments for change from evidence of actual legal or social change.']
      },
      {
        unit: 5,
        prompt: 'Evaluate the extent to which Napoleon preserved the achievements of the French Revolution. Develop a claim using two specific policies or institutions and address a significant limit or contradiction.',
        checklist: ['Define which revolutionary achievements you are evaluating.', 'Use at least two specific pieces of relevant evidence.', 'Connect the evidence to the claim instead of listing policies.', 'Consider different effects on political participation, property, or women’s status.']
      },
      {
        unit: 6,
        prompt: 'Explain how industrialization contributed to demands for political or social reform in nineteenth-century Europe. Support a causal argument with two specific examples and explain why reform did not benefit all workers equally.',
        checklist: ['Explain the connection between a working or living condition and a demand for reform.', 'Use specific evidence, such as Chartism, factory legislation, or socialist organization.', 'Show how a reform or movement addressed the problem.', 'Consider differences by class, gender, age, region, or enforcement.']
      },
      {
        unit: 7,
        prompt: 'Read the linked Bismarck speech in this unit’s practice. Explain how social reform could strengthen a conservative government, then evaluate this interpretation using one other policy of the German state.',
        checklist: ['Identify the speech’s intended audience and political purpose.', 'Explain how social insurance might affect workers’ relationship to the state.', 'Use specific additional evidence, such as the Anti-Socialist Laws.', 'Show how reform and repression could coexist without assuming identical motives among all participants.']
      },
      {
        unit: 8,
        prompt: 'Explain why an account of authoritarianism in interwar Europe needs more than a single economic cause. Compare Italy and Germany using their political chronology and at least one specific institutional or political factor in each case.',
        checklist: ['Make a causal claim that recognizes both conditions and decisions.', 'Place Mussolini’s appointment in 1922 and Hitler’s appointment in 1933 correctly.', 'Use evidence about political violence, elite support, constitutional arrangements, or opposition.', 'Avoid treating an authoritarian outcome as inevitable or implying that every European state followed the same path.']
      },
      {
        unit: 9,
        prompt: 'Read the linked Schuman Declaration in this unit’s practice. Explain its proposed relationship between economic cooperation and peace, then use a later development to evaluate the possibilities and limits of European integration.',
        checklist: ['Explain the proposal in the context of World War II and reconstruction.', 'Connect shared economic institutions to the goal of reducing rivalry.', 'Use a specific later development, such as the Treaty of Rome, Maastricht, enlargement, or Brexit.', 'Explain how cooperation and national sovereignty could create both opportunities and tensions.']
      }
    ]
  };
}());
