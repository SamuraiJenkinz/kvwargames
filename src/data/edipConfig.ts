import type { GameConfig } from "@/types/game";

export const EDIP_CONFIG = {
  name: "EDIP Security of Supply Wargame",
  domain: "European Defence Technological and Industrial Base (EDTIB)",
  description: "Stress-test EDIP Security of Supply mechanisms under two crisis scenarios. Explore when EDIP tools enable effective collective action and where they create bottlenecks. Generate concrete observations and recommendations. NOT a legal interpretation exercise, exact military simulation, or forecasting model.",

  scenarios: [
    {
      id: "S1",
      name: "Scenario 1: Germanium / CRM Supply Crisis",
      description: "Escalating tensions with China culminate in a Germanium export cut-off. EU depends on imports for infrared optics, thermal imaging, UAV payloads and space sensors. Up to 20% of EU UAV production at risk. Stress-test EDIP supply crisis activation, information-gathering, prioritisation and coordinated procurement under a non-military but defence-relevant market disruption.",
      rounds: 4,
      startState: { crisisSeverity: 0, crisisState: "No Crisis" as const, edipLegitimacy: 0 },
      injects: [
        "ROUND 1 — SHOCK & DISCOVERY: China announces a significant restriction of Germanium exports to Western countries. Markets react; prices spike sharply. Crisis Severity rises to 1. No EDIP crisis state yet. Hidden CRM distribution is uneven — some teams have multi-year stockpiles, others are acutely exposed. KEY TENSION: do teams lean into early EDIP monitoring tools, or rely on national and industry channels until the crisis worsens?",
        "ROUND 2 — SUPPLY CRISIS THRESHOLD?: Additional suppliers hint at aligning with Chinese restrictions; risk of broader global CRM tightening. Some Member States are exploring aggressive national stockpiling. Crisis Severity moving toward 2–3 depending on prior actions; EU faces risk of divergent national measures. KEY TENSION: whether EDIP can prevent fragmented national responses and align allocation of scarce CRM and production capacity.",
        "ROUND 3 — DIVERGENCE OR COORDINATION: Deeper analysis reveals up to 20% of EU UAV production is at risk. Several states face acute CRM shortages while others have ample stock. Crisis Severity rises to 2; arguments emerge about whether EDIP supply crisis activation threshold is now met. KEY TENSION: whether to activate formal supply crisis and accept EDIP obligations vs continue with national emergency measures and bilateral deals.",
        "ROUND 4 — STABILISE OR FRAGMENT: Trajectory reflects earlier choices — either partial stabilisation via EDIP coordination, or deepening fragmentation with national export controls and hoarding. Crisis Severity may stabilise or remain high. KEY TENSION: willingness to accept longer-term EDIP constraints and production acceleration in exchange for greater EDTIB resilience."
      ]
    },
    {
      id: "S2",
      name: "Scenario 2: Eastern Flank — Hybrid to Hot War",
      description: "Escalating Russian hybrid actions against EU's eastern flank evolve into a hot war with an attack on Baltic states. NATO and EU must reinforce and sustain high-intensity operations under severe supply and industrial pressures. Stress-test security-related supply crisis, mandatory prioritisation, intra-EU transfers, continuity of production and mutual recognition.",
      rounds: 5,
      startState: { crisisSeverity: 0, crisisState: "No Crisis" as const, edipLegitimacy: 0 },
      injects: [
        "ROUND 1 — HYBRID PRESSURE: Increased Russian hybrid activities — cyber attacks on infrastructure, disinformation campaigns, airspace violations, small border incidents. Crisis Severity rises to 1. EDIP Crisis State remains No Crisis. KEY TENSION: whether to use EDIP monitoring tools early or rely primarily on NATO and national channels at this stage.",
        "ROUND 2 — ESCALATING INCIDENTS: A serious incident — artillery strike in a border area, major cyber disruption to rail and logistics; limited kinetic engagements begin. Crisis Severity rises to 2. Questions arise about activating EDIP supply crisis for key munitions and systems. KEY TENSION: when is a supply crisis label justified, and which states support or oppose early activation?",
        "ROUND 3 — ATTACK ON BALTIC STATES: Russia launches a large-scale attack on one or more Baltic states; heavy kinetic operations and mobilisations begin; NATO and EU invoke high-level responses. Crisis Severity jumps to 3–4; defence stocks in frontline states begin to deplete rapidly. KEY TENSION: willingness to accept far-reaching EDIP powers under existential threat vs concerns about sovereignty and industrial disruption.",
        "ROUND 4 — SUSTAINED HIGH-INTENSITY CONFLICT: Weeks of intense operations; attrition of munitions, air defence interceptors and ISR assets; industrial bottlenecks are now binding. Crisis Severity remains high; Security-related supply crisis state is active. KEY TENSION: whether EDIP production acceleration tools can prevent supply collapse and how repeated mandatory orders affect EDIP legitimacy and domestic politics.",
        "ROUND 5 — STABILISATION, ESCALATION OR STALEMATE: Several possible trajectories — stabilised front, risk of escalation, or ceasefire proposals. EDIP Crisis State may remain Security-related or begin to wind down. KEY TENSION: which EDIP tools are seen as structurally valuable for future resilience vs too intrusive for normal times?"
      ]
    }
  ],

  teams: [
    {
      id: "A",
      name: "Team A: Frontline & High-Threat",
      description: "High security exposure, limited industrial depth, strong case for EDIP support. High political urgency and legitimacy claims; sensitive domestic opinion.",
      personas: [
        "Minister Jana Novak — Defence Minister. Wants early crisis activation, rapid resupply, mandatory prioritisation if voluntary fails. Will not accept plans risking frontline capability gaps. Strongly favours CS-01/CS-02 activation. Impatient with legal delays.",
        "General Mikko Saarinen — Chief of Defence. Sceptical of process; focused on operational results. Will not tolerate diversion of supplies already committed to frontline units. Neutral on information requests; impatient with slow voluntary measures."
      ],
      uniqueAction: "ESCALATE SECURITY NARRATIVE (once per round): If Readiness ≤ 3 OR crisis inject clearly justifies it, may increase Crisis Severity +1 (max 5). Makes stronger EDIP tools more plausible. Cost: PC -1. If ≥ 2 other teams declare escalation premature: EDIP Legitimacy -1 (perceived alarmism).",
      pc: 3, po: 0, readiness: 3, stock: 2, crm: 2, ic: 2
    },
    {
      id: "B",
      name: "Team B: Industrial Powerhouses",
      description: "Large defence industrial bases, critical stocks and capacity. Key actors in prioritisation and production ramp-up. Sensitive to EDIP obligations and long-term competitiveness impact.",
      personas: [
        "Minister Clara Moreau — Industry & Defence Economy. Protects long-term competitiveness; resists intrusive information requests; accepts mandatory prioritisation only as last resort with fair compensation. Wants EU support for capacity ramp-up.",
        "PM Luca Rossi — Council Representative. Manages coalition stability; wants safeguards on all mandatory orders; shapes Council outcomes to avoid bloc polarisation. Wants to appear solidary without bearing disproportionate burden."
      ],
      uniqueAction: "SHAPE INDUSTRIAL RESPONSE (once per round — choose Mode): Mode A SURGE: gain +1 temporary Industrial Capacity (IC) this round only; PO -1 (domestic overtime/environmental backlash). Mode B SHIELD: designate one IC token that cannot be targeted by Mandatory Prioritisation Order (SP-02) this round; PC -1. IMPORTANT: If Team B also receives EDIP help this round while using Shield, flag EDIP Legitimacy -1 in debrief (perceived free-riding asymmetry).",
      pc: 4, po: 1, readiness: 3, stock: 3, crm: 2, ic: 5
    },
    {
      id: "C",
      name: "Team C: Rear Support & Logistics",
      description: "Crucial for logistics corridors, basing and niche production. Controls the timing of support flows. Must manage domestic opinion around support roles and perceived militarisation.",
      personas: [
        "Minister Elena Petrova — Foreign Affairs. Wants recognition and compensation for rear-area role; will not be treated as mere transit corridor; cautious about being drawn deeper into conflict. Uses logistics leverage to bargain for investment.",
        "General Markus Lindgren — Logistics & Infrastructure Commander. Focused on corridor feasibility; demands investment and regulatory waivers; will not overload single corridors without redundancy. Positive on fast-track transfers if corridors are funded."
      ],
      uniqueAction: "REAR SUPPORT LEVERAGE (once per round): After EDIP decisions but BEFORE final token moves are applied, select one agreed transfer or allocation. BOOST FLOW: that transfer arrives this round instead of next (no automatic cost; seen positively as facilitation). CONSTRAIN FLOW: that transfer is delayed by +1 round; Team C PC +1; the recipient team PO -1 (domestic frustration at allied delay).",
      pc: 3, po: 0, readiness: 3, stock: 3, crm: 3, ic: 3
    },
    {
      id: "D",
      name: "Team D: Balancing / Mixed-Interest",
      description: "Politically influential, diverse interests, often pivotal in building Council compromises. Strong voice on legal and procedural aspects; swing influence in EDIP decisions.",
      personas: [
        "Minister Sofia Weber — Justice/EU Affairs. Demands proportionality and clear legal basis; will not support EDIP measures without documented trigger justification; positive on voluntary measures, hostile to mandatory without safeguards.",
        "Minister Tomasz Kowalski — Finance. Limits unplanned fiscal exposure; resists open-ended commitments without cost caps; positive on coordinated procurement for economies of scale; wants burden-sharing mechanisms in place before agreeing mandatory orders."
      ],
      uniqueAction: "PROCEDURAL CHALLENGE (once per round): Select one EDIP proposal on the agenda. Option A RAISE THRESHOLD: that proposal now requires Support from all 4 teams to pass this round (instead of the standard Support ≥ 3). Option B DELAY: remove proposal from this round's agenda; place at top of next round. Cost: PC -1. Team D must briefly state a rule-of-law or proportionality concern. If used in two consecutive rounds: EDIP Legitimacy -1 (system perceived as gridlocked by procedure).",
      pc: 4, po: 1, readiness: 3, stock: 3, crm: 3, ic: 3
    }
  ],

  nationalActions: [
    {
      id: "NA-1",
      name: "Adjust National Stockpiles",
      summary: "Move any stock/CRM tokens into a 'Committed this round' area. Only committed tokens can be used to raise Readiness or offered in voluntary transfers/EDIP measures this round. Tokens consumed only when actually spent, transferred, or required by EDIP card. Mandatory EDIP measures can still target uncommitted stock.",
      cost: "No direct track cost. Over-committing exposes more stock to requests; under-committing limits your own readiness gains and credibility."
    },
    {
      id: "NA-2",
      name: "National Emergency Measure",
      summary: "Declare a national control on one stock type for this round. Cannot voluntarily transfer/commit that stock type to others (except via mandatory EDIP tools). Your Readiness/Resilience will not drop this round purely due to that stock type.",
      cost: "PC -1. If at least one other team publicly objects: EDIP Legitimacy -1. Seen as undermining coordination."
    },
    {
      id: "NA-3",
      name: "Bilateral / Minilateral Deal",
      summary: "Negotiate a deal with one or more teams (all parties must consent). May trade: stock/CRM tokens, IC tokens (this or next round), up to ±1 PC per party, explicit future support for a named EDIP measure. Token moves take effect according to agreed timing.",
      cost: "Uses one action slot + whatever tokens/PC you give up. No hidden extra penalties."
    },
    {
      id: "NA-4",
      name: "Public Narrative Management",
      summary: "Option A 'Sell EDIP at home': PO +1; EDIP Legitimacy +1 if you visibly backed at least one strong EDIP card this round (CS-01/02, SP-02, PA-01/02, TR-01); PC -1. Option B 'Blame Brussels': PO +1; EDIP Legitimacy -1; you cannot request new strong EDIP measures next round (you've told domestic audiences they're a problem).",
      cost: "A: PC -1. B: no PC cost but lose ability to request strong EDIP next round."
    }
  ],

  cards: [
    {
      id: "CS-01", name: "Activate Supply Crisis", cat: "Crisis State",
      timing: "This Round",
      req: "Crisis Severity ≥ 2. Evidence of serious disruptions or imminent risk in supply of crisis-relevant products. Evidence of potential divergent national measures.",
      effect: "Move EDIP Crisis State marker to Supply Crisis. Unlocks standard crisis tools: information requests, voluntary and mandatory prioritisation, coordinated procurement. All teams PC -1. EDIP Legitimacy +1 if activation is timely and widely supported; -1 if perceived premature or divisive."
    },
    {
      id: "CS-02", name: "Activate Security-Related Supply Crisis", cat: "Crisis State",
      timing: "This Round",
      req: "Crisis Severity ≥ 3. Defence product shortages clearly linked to security threats (e.g. high-intensity conflict on EU territory). Risk of divergent national measures.",
      effect: "Move EDIP Crisis State to Security-Related Supply Crisis. Unlocks extended tools: intra-EU transfer fast-track, permit/continuity measures, mutual recognition, working-time flexibility. Crisis Severity cannot fall below 2 while this state is active. All teams PC -1. EDIP Legitimacy +1 if clearly overdue; -1 if perceived as overreach."
    },
    {
      id: "MP-01", name: "Targeted Information Requests (EOs)", cat: "Monitoring",
      timing: "This Round",
      req: "Supply crisis active or imminent (Crisis Severity ≥ 2). Commission must consult Member States of relevant economic operators before sending requests.",
      effect: "Reveal selected hidden stock/capacity information for 1–2 targeted teams to the requester and/or all teams. Clarifies CRM dependencies, bottlenecks, spare production capacity. Each targeted team PO -1 and Sovereignty Sensitivity +1 (domestic backlash about intrusive EU data demands). Draw EO Response Card."
    },
    {
      id: "MP-02", name: "General Information Mapping Initiative", cat: "Monitoring",
      timing: "This Round",
      req: "Crisis Severity ≥ 2, any crisis state. Broad political recognition that a systemic view of EDTIB vulnerabilities is needed.",
      effect: "EDIP Engine presents a high-level dependency map: who depends on which suppliers, where key bottlenecks lie. All teams receive 1 Insight token to ask one precise factual question later. EDIP Legitimacy +1 (seen as responsible governance). In the next round, no more than 2 EDIP measures on the agenda."
    },
    {
      id: "SP-01", name: "Voluntary Prioritisation Request", cat: "Prioritisation (Soft)",
      timing: "This Round",
      req: "Supply crisis active. Commission must consult the Member State of the economic operator before sending the voluntary request.",
      effect: "Providing team voluntarily shifts 1 IC token to produce for the beneficiary this round or next. Beneficiary gains additional Defence Stock or Resilience effect. Provider loses PC -1 OR PO -1 (their choice, reflects domestic trade-off). If provider refuses or offers partial cooperation, it sets narrative justification for SP-02."
    },
    {
      id: "SP-02", name: "Mandatory Prioritisation Order", cat: "Prioritisation (Hard)",
      timing: "This Round",
      req: "Supply OR Security-related crisis active. Voluntary measures have failed or proven insufficient. Commission must consult BOTH the Member State of the production site AND the headquarters of the economic operator.",
      effect: "Provider must shift 2 IC tokens to priority production for the beneficiary this round or next. Provider PC -2 and PO -1. EDIP Legitimacy -1 if passed over strong objections; +1 from beneficiary perspective if it prevents readiness collapse. Provider may invoke internal security interests ONCE per scenario to halve effect (1 IC instead of 2). Draw EO Response Card."
    },
    {
      id: "CP-01", name: "Coordinated Procurement / Add-On Orders", cat: "Demand Coordination",
      timing: "Next Round",
      req: "Supply OR Security-related crisis active. Two or more MS teams seek similar products (e.g. ammo, UAVs, sensors).",
      effect: "Teams pool demand under EDIP-coordinated procurement. Industrial team benefits from more predictable long-term contracts; production planned at scale. Possible +1 efficiency bonus (e.g. 3 IC → 4 units Defence Stock). Participating teams accept EU-level influence over delivery sequencing and priority. Non-participating states may perceive bias if excluded."
    },
    {
      id: "PA-01", name: "Permit Fast-Track & Continuity of Production", cat: "Production Acceleration",
      timing: "Ongoing from Next Round",
      req: "Security-related crisis OR supply crisis with high severity and clear production constraints. A Member State requests accelerated permits and continuity measures for critical facilities.",
      effect: "Selected industrial or support team gains +1 IC token per round from next round onward (dedicated to crisis-relevant products). PO -1 and Sovereignty Sensitivity +1 (domestic backlash over overriding ecological or planning constraints). Repeated use on same team may trigger a 'legal challenge' narrative event in later rounds."
    },
    {
      id: "PA-02", name: "Mutual Recognition & Fast-Track Certification", cat: "Production Acceleration",
      timing: "This Round",
      req: "Security-related supply crisis active. Member States agree to mutually recognise certificates and allow fast-track certification for specific defence products.",
      effect: "For one selected product line, time-to-field is reduced by one round (product becomes available one round earlier). EDIP Legitimacy +1 if perceived as pragmatic and well-targeted. Overuse risk: facilitator may introduce a minor 'quality concern' narrative event."
    },
    {
      id: "PA-03", name: "Working-Time Flexibility & Innovation Support", cat: "Production Acceleration",
      timing: "This Round (Optional)",
      req: "Security-related supply crisis active.",
      effect: "Target team gains +1 temporary IC this round only. PO -1 (domestic workforce concerns about overtime and safety). This is an optional card — facilitator discretion on whether to include given pace and scenario focus."
    },
    {
      id: "TR-01", name: "Intra-EU Transfer Fast-Track & Export Ban Constraint", cat: "Transfers",
      timing: "This Round (Ongoing Effect)",
      req: "Security-related supply crisis active. Internal transfer bottlenecks and/or threats of national export bans for security-related products are emerging.",
      effect: "For the rest of the scenario, intra-EU transfers are processed on a fast-track basis (same-round delivery instead of default next-round). Member States cannot impose effective export bans on security-related products without incurring significant political costs. All teams Sovereignty Sensitivity +1. Any attempt to reimpose export ban: PC -2 and EDIP Legitimacy penalty."
    }
  ],

  objective: "Keep Europe's defence response viable — ensuring the most exposed states do not run out of critical capabilities — by deciding when and how to use EDIP tools and national actions, without breaking domestic politics and industrial interests. Maintain frontline Readiness above collapse. Manage Political Capital, Public Opinion and EDIP Legitimacy so the system stays politically sustainable. There is no winner. Success = quality of insights about EDIP's functioning.",

  redLines: "EDIP Legitimacy at -2 = political crisis for the entire mechanism. PC = 0: team cannot propose new strong EDIP measures. PC = 1 (STRAINED): only 1 national action per round, limited EDIP requests. Readiness = 0: team has failed its core function — a debrief-critical failure state that must be explicitly noted.",

  pcThresholds: "PC 3–6: Normal — full range of actions available. PC 2: Caution — review exposure. PC 1: Strained — only 1 national action per round, limited EDIP requests. PC 0: Crisis — no new strong EDIP proposals possible.",

  votingRule: "For each EDIP proposal: Support ≥ 3 AND Objections ≤ 1 → measure passes and the EDIP card effect is applied. Teams may spend 1 PC to gain 1 extra Support or Objection token for that round. If Political Capital falls too low, teams face penalties (only 1 national action, no strong EDIP proposals).",

  eoMechanic: "When an EDIP measure directly affects Economic Operators (information requests, prioritisation orders), draw an EO Response Card. Responses include: Full Compliance, Partial Compliance, Resistance or Delay. Partial compliance or resistance may trigger enforcement decisions (penalties) and can affect EDIP Legitimacy and team Political Capital.",

  resourceLogic: "Blue cubes = Defence Stock (usable defence products). Red discs = CRM/critical components (needed to fully exploit IC — effective capacity = min(IC tokens, CRM discs)). Grey cylinders = Industrial Capacity (each slot can produce 1 blue cube OR cancel a -1 Readiness drop per round). Tokens move between teams only via SP-01, SP-02, PA-01/PA-03, or Bilateral Deals.",

  facilitation: "Four roles: Lead Facilitator (narrates injects, chairs Council phase), Note-Taker/Observer (captures decisions and EDIP tensions for debrief), EDIP/EDTIB SME (answers legal and technical questions), Logistics Support. Micro-debrief after each round: 2–3 minutes, 1–2 prompts. Final plenary debrief: activation thresholds, information powers, prioritisation, production, transfers, cross-cutting EDIP legitimacy and sovereignty themes."
} as const satisfies GameConfig;
