# RFP Scenario Coach — Domain Input Request

**To:** Rachel Symond, AI Strategy Leader for Commercial, Marsh
**From:** Development Team
**Date:** 15 April 2026
**Re:** Domain-specific inputs needed to ensure persona voice authenticity and coaching credibility

---

## Context

The RFP Scenario Coach development spec is architecturally complete and ready for implementation. The reusable components from the War Game Engine (LLM proxy, state management, three-column layout, persona messaging, deployment pipeline) carry over directly.

What we are missing is **domain colour** — the vocabulary, phrasing, and situational detail that will make Kent, Finch, and Chen sound like they actually work in reinsurance placement, not like they read about it. Experienced brokers will lose confidence in the tool within two minutes if the personas use textbook language instead of market language.

This document describes seven specific inputs that would materially improve the coaching quality. Each is scoped to be deliverable in a short conversation or a one-page written contribution. We have listed them in priority order — the first three items will have the greatest impact on launch quality.

---

## 1. Real Underwriter Objection Language

**Priority:** Critical
**Best contributor:** A senior reinsurance underwriter, or a broker who regularly presents submissions to underwriters
**Effort:** 30-minute interview or a written list

**What we need:**

5 to 10 actual phrases underwriters use when reviewing a distressed renewal submission. Not sanitised corporate language — the real phrasing as it sounds in a meeting room or on a call.

Specific examples we are looking for:

- What does an underwriter actually say when the cat model version is outdated?
- How do they signal they will likely decline without formally saying no?
- What language do they use when the loss narrative is not credible?
- How do they express "we need to see more before we commit capacity" versus "we are not going to lead this"?
- What does "we will follow but not lead" sound like in practice?

**Why this matters:**

Dr. Michael Chen's persona must voice the underwriter's perspective. If his objections sound like a textbook description of underwriting concerns rather than the actual words an underwriter uses, the coaching loses credibility with experienced placement teams. The difference between "the cat model output requires updating" and "you are showing me RMS v17 — my desk runs v21, and the AAL delta on a programme like this is not trivial" is the difference between a tool that feels real and one that does not.

---

## 2. Market Benchmarking Language and Glossary

**Priority:** Critical
**Best contributor:** A pricing actuary, market analyst, or Finch's real-world equivalent at Marsh
**Effort:** One-page glossary with example usage

**What we need:**

A glossary of 10 to 15 terms that Dr. Alistair Finch should use naturally when modelling commercial positions and market dynamics. Each term should include a one-sentence plain-English definition and an example of how Finch would use it in a coaching response.

Terms we expect to include (confirm, correct, or expand):

- Rate-on-line
- Technical price
- Burning cost
- ILW (Industry Loss Warranty)
- Attachment point
- Exhaustion point
- Aggregate deductible
- Cat bond spread
- Retention level
- Cession percentage
- Loss ratio (gross, net, combined)
- Experience rating vs. exposure rating

Additionally, we need examples of how market benchmarking is expressed conversationally:

- How does a broker say "the lead is going to ask for 30 percent" in internal discussion?
- How is "the follow market will come in at lead terms plus 5 percent" phrased?
- What does "the market is hardening" sound like when Finch delivers it with data?

**Why this matters:**

Finch is the commercial engine of the coaching session. His responses must anchor every commercial observation in specific language that experienced brokers recognise as authentic. If Finch describes market dynamics in general terms rather than the precise vocabulary the team uses daily, the tool will feel like a training exercise rather than live preparation.

---

## 3. Placement Action Validation

**Priority:** Critical
**Best contributor:** Rachel or a senior placement broker
**Effort:** 30-minute review pass on the 12 actions in the spec

**What we need:**

A review of the 12 placement actions defined in the development spec (PA-01 through PA-12), answering:

- **Realism check:** Are any of these actions unrealistic or never actually performed in practice? Should any be removed or reworded?
- **Missing actions:** Are there standard placement moves that an experienced broker would expect to see but are not listed? For example: requesting a binding authority extension, formal capacity reservation, quota share restructure, or similar.
- **Timing accuracy:** Are the timing constraints realistic? Can a loss engineering review realistically be commissioned and returned within the scenario timeline (10 weeks to renewal)?
- **Cost calibration:** Are the relationship costs appropriately scaled? Is PA-07 "Introduce Competing Panel" really a -1 Relationship Capital event, or is it considered a more severe relationship breach in some market segments? Is PA-12 "Broker Principal Call" correctly positioned as the highest-stakes action?
- **Precondition accuracy:** Do the prerequisites for each action reflect actual market practice? For example, does a pre-submission meeting with the lead reinsurer genuinely require Relationship Capital of at least 2, or is it standard practice regardless?

**Why this matters:**

If an experienced broker plays a coaching session and encounters an action that does not exist in their practice, or notices that an obvious standard action is missing, the tool loses credibility immediately. The action library is the primary interaction mechanic — it must be professionally accurate.

---

## 4. Bordereaux Quality Assessment Example

**Priority:** High
**Best contributor:** A technical underwriting analyst
**Effort:** One anonymised example with annotations

**What we need:**

A one-page example (or description) of what "data quality 2 out of 5" actually looks like in a real submission. The spec uses a 1 to 5 data quality score but does not ground what each level means in concrete terms.

Specifically:

- What is typically missing or poorly formatted at quality level 2?
- What does quality level 3 look like (acceptable but not strong)?
- What does quality level 4 or 5 look like (market-ready)?
- What are the specific data elements underwriters check first? (Development triangles, Schedule F, cat model output version, management commentary structure)

**Why this matters:**

Chen's data-quality coaching needs to reference specific missing elements — "your Schedule F is missing two years of development triangles" rather than "data quality is poor." Without concrete examples of what each quality level contains, Chen's feedback will remain generic.

---

## 5. CFO vs. Risk Manager Stakeholder Dynamics

**Priority:** High
**Best contributor:** A client-facing broker or account executive who manages cedant relationships
**Effort:** 3 short written anecdotes (one paragraph each)

**What we need:**

2 to 3 real (anonymised) scenarios where the CFO and Risk Manager had conflicting priorities during a reinsurance renewal. For each scenario:

- What was the CFO's primary concern? (Cost, board optics, coverage structure)
- What was the Risk Manager's primary concern? (Coverage continuity, market relationships, technical adequacy)
- How did the broker navigate the conflict?
- What went wrong when the broker misjudged the timing or approach?
- Did the broker brief both stakeholders simultaneously or sequentially, and why?

**Why this matters:**

The Distressed Renewal scenario has this tension at its centre — the CFO resists the rate increase while the Risk Manager is more pragmatic. Kent's coaching on stakeholder navigation must reflect how this actually plays out in practice: the political risk of going over the Risk Manager's head, the timing of when to brief which stakeholder, and the CFO's real objection (which is often board optics rather than pure cost).

---

## 6. Broker Internal Conversation Samples

**Priority:** Moderate
**Best contributor:** A placement broker who has worked a distressed renewal
**Effort:** 3 to 4 short transcript-style snippets (5 to 10 lines each)

**What we need:**

Examples of real internal team discussions before critical placement moments. These do not need to be verbatim transcripts — reconstructed conversations from memory are fine. We are looking for:

- A team discussion before a lead underwriter call: what do they actually debate?
- A team discussion about whether to submit the data pack now or hold for improvement
- A team discussion about whether to brief the cedant on market reality now or wait
- The phrases teams use when they are unsure: "should we just send it?", "what if we hold the bordereaux back one more week?", "I think we are overthinking the attachment point"

**Why this matters:**

The facilitator input examples in the spec are clean and well-structured. In practice, team input during a live coaching session will be informal, unstructured, and sometimes contradictory. The system prompt needs to be tuned so that Kent, Finch, and Chen respond well to messy real-world input — not just clean action declarations. Seeing how teams actually talk will help us calibrate the personas' response style.

---

## 7. Debrief Rubric Calibration

**Priority:** Moderate
**Best contributor:** Whoever currently runs placement retrospectives or post-renewal reviews at Marsh
**Effort:** Share existing template if one exists, or a 15-minute conversation

**What we need:**

How does Marsh currently assess placement performance after a renewal? Specifically:

- Is there a formal retrospective template or rubric used after significant placements?
- The spec defines four debrief dimensions: Submission Quality, Market Sequencing, Commercial Judgement, and Cedant Communication. Do these map to how Marsh actually evaluates placement quality?
- Are there dimensions missing? For example: internal team coordination, regulatory compliance, documentation quality, or client retention metrics.
- How are action items from retrospectives currently tracked and followed up?

**Why this matters:**

The debrief action list is the tangible output of every coaching session — the document the team takes away. If the four assessment dimensions do not align with how Marsh thinks about placement quality, the coaching will not connect to the team's actual performance development framework. Alignment with existing retrospective practices means the tool reinforces rather than duplicates existing quality processes.

---

## Summary

| Priority | Input | Contributor | Estimated Effort |
|----------|-------|-------------|------------------|
| 1 | Underwriter objection language | Underwriter or facing broker | 30-minute interview |
| 2 | Market benchmarking glossary | Pricing actuary or market analyst | 1-page glossary |
| 3 | Placement action validation | Rachel or senior broker | 30-minute review pass |
| 4 | Bordereaux quality examples | Technical underwriting analyst | 1 anonymised example |
| 5 | CFO vs. Risk Manager dynamics | Client-facing broker | 3 short anecdotes |
| 6 | Broker internal conversation samples | Placement broker | 3 to 4 short snippets |
| 7 | Debrief rubric calibration | Retrospective process owner | Existing template or 15-minute call |

Items 1 through 3 are critical for launch quality — the personas will not sound credible without them. Items 4 through 7 add depth and can be incorporated iteratively after initial user testing if needed.

We can work with whatever format is easiest: written notes, a recorded conversation, annotated examples, or a short call. The goal is authentic domain language, not polished documentation.

---

*Prepared for the RFP Scenario Coach development programme.*
*Reference spec: `RFP_COACH_DEV_SPEC.md` v1.0, April 2026.*
