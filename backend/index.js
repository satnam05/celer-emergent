const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly"); //AWS SDK required for Polly TTS
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Library for AI Studio API Keys
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-3";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EMERGENT_LLM_KEY;

const getGeminiClient = () => {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY or EMERGENT_LLM_KEY");
  return new GoogleGenerativeAI(GEMINI_API_KEY);
};

const safeJsonParse = (text) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (err) { return null; }
    }
    return null;
  }
};

const buildInstructionPrompt = ({ name, description, companyName, companySummary, cvText, jobDescription, contextText }) => `
You are an expert interview coach and prompt engineer. Build a system instruction for an AI interview agent.

Inputs:
- Card Name: ${name || ""}
- Description: ${description || ""}
- Company Name: ${companyName || ""}
- Company Summary: ${companySummary || ""}
- Candidate CV: ${cvText || ""}
- Job Description: ${jobDescription || ""}
- Context: ${contextText || ""}

Goals:
1) Create a SYSTEM INSTRUCTION that makes the AI act as a high-quality interviewer for both technical and behavioral questions.
2) Include guidance for asking one question at a time, giving feedback, and keeping a professional tone.
3) Ensure the persona is aligned with the company, role, and candidate profile.
4) Output a QUESTION SET with two sections: TECHNICAL QUESTIONS and BEHAVIORAL QUESTIONS.

Return ONLY valid JSON with this exact shape:
{
  "system_instruction": "...",
  "question_set": "..."
}
`;

const buildRefinePrompt = (systemInstruction) => `
You are an expert prompt editor. Improve and tighten the following system instruction while preserving intent and tone.
- Remove redundancies
- Keep professional and structured language
- Output ONLY valid JSON with this exact shape:
{
  "system_instruction": "..."
}

SYSTEM INSTRUCTION:
${systemInstruction}
`;

// ================================================
// 1. DATA CONTEXT (Your Golden Source - Untouched)
// ================================================

const FULL_RESUME = `
SATNAM SINGH - Lead Solutions Analyst
Experience: 14+ Years. Current: NatWest Group (Digital X).
KEY PROJECTS:
- NatWest: Designed integration layer for 38+ microservices (Single Payment Initiation System). Processed 1M monthly transactions (£5B).
- Lead elicitation for ISO 20022 journeys (Pain.001, Pain.002, Pacs.008/009, Pacs.002).
- Utilized advanced data analytics for root cause analysis of CHAPS/SEPA failures.
- Phoenix Group (TCS): Automated compliance, increasing throughput 75%. Designed optimized correspondence generation system.
- M&G Prudential: Real-Time Payments implementation, reduced op costs by 5%.
- Aviva & ABN AMRO: Core banking migration (TCS BaNCS), SWIFT messaging back-end.

SKILLS: 
- AWS/Azure Solutions Architect, CBAP, Scrum Master.
- Tech: Kafka, Microservices, API Design, Java, SQL, Oracle.
- Domain: ISO 20022, CHAPS, SEPA, BACS, Faster Payments, SWIFT MX.
`;

const FULL_JD_AND_MANAGER_MSG = `
ROLE: Lead Solutions Analyst (VP), Payments Technology - Glasgow.
MANAGER'S NON-NEGOTIABLES (LINKEDIN):
1. "Bridge technical execution with business outcome."
2. "Thrive in complex, ambiguous, and rapidly evolving environments."
3. "Communicate effectively and manage diverse stakeholders."

RESPONSIBILITIES:
- Translate complex business requirements into technically feasible solutions.
- Ensure compliance with technical and regulatory standards (Audit Readiness).
- Drive "Data Platform Modernization" and "AI-First" initiatives.
- Mentor team members in analytical reasoning.
`;

const FULL_JPM_CONTEXT = `
JPM ORGANIZATION:
- $10 Trillion daily payments. "Fortress Balance Sheet" (Risk Management is #1).
- Tech Investment: $18B/year. Focus: AI, Automation (35% reduction in manual process), ISO 20022 rich data.
- Strategy: Migration from Legacy to Modern Data Platforms.
- Values: Operational Excellence, Client Obsession, Integrity.
- SWOT: Strengths (Scale, Tech budget), Weaknesses (Legacy complexity, Regulatory scrutiny).
`;

const FULL_QUESTION_BANK = `
SECTION A: RDBMS, SQL & DATABASE DEEP DIVE
Crucial for proving you can handle the "heavy lifting" of data analysis.

- OLTP vs. OLAP: "We have a 50TB transaction table. Explain the technical difference between OLAP and OLTP. Why must we physically separate them for regulatory reporting to avoid crashing the payment engine?"
- SQL Query Construction: "Verbally write a SQL query to find the 'Top 10 Debtors by Volume' from a pacs.008 table, grouped by SettlementDate. How do you handle ties in the ranking?"
- Join Logic: "Explain the difference between a LEFT JOIN, RIGHT JOIN, and INNER JOIN. In a reconciliation report between 'Ledger' and 'Payments', when would you specifically use a FULL OUTER JOIN?"
- Cursors vs. Set-Based: "What are Database Cursors and Oracle Packages? Why are Cursors generally considered a performance anti-pattern in high-volume reporting, and how do you rewrite them using set-based SQL?"
- Query Optimization: "How do you optimize a regulatory query that is taking 2 hours to run? Discuss your approach to using Execution Plans, Indexing (B-Tree vs. Bitmap), and Table Partitioning."
- Normalization Strategy: "Explain Normalization (1NF, 2NF, 3NF) versus Denormalization. Why do we often denormalize data into 'Wide Tables' specifically for the Regulatory Reporting layer?"
- Materialized Views: "What is a Materialized View? How would you use it to pre-calculate the 'Daily Liquidity Position' so the final report generates instantly at 5:00 PM?"
- NULL Handling: "How do you handle NULL values in aggregations (like SUM or AVG) versus GROUP BY clauses? How can a NULL value skew your regulatory total?"
- Partitioning Large Tables: "For a table containing 7 years of transaction history (Audit requirement), how would you partition it? Would you choose Range Partitioning (by Date) or List Partitioning (by Country)? Justify your choice."
- Stored Procedures: "What is your stance on business logic in Stored Procedures vs. the Application Layer? For complex regulatory aggregations, where does the logic belong?"

SECTION B: DATA ENGINEERING & PIPELINES
Focus on how you move and manage data at scale.

- Data Contracts: "Explain the concept of a 'Data Contract' between the Payment Engine (Upstream) and the Reporting Layer (Downstream). How do you enforce it so a developer doesn't break your report by renaming a column?" 
- Schema Evolution (Kafka): "If we are streaming pacs.008 messages via Kafka and the XML schema changes (new version), how do you handle Schema Evolution in the registry so the pipeline doesn't fail?"
- Batch vs. Streaming: "We have 2,200 reports to generate. Do we use Batch processing (e.g., AutoSys/Control-M) or Real-time streaming (e.g., Spark/Flink)? Justify why Batch is often preferred for 'End of Day' regulatory submissions."
- ETL vs. ELT: "Explain the difference between Extract-Transform-Load (ETL) and Extract-Load-Transform (ELT). Why is ELT becoming the standard for Data Lakes (like Snowflake/Databricks) in banking?"
- Late Arriving Data: "What is 'Late Arriving Data' in a data pipeline? If a payment settles at 23:59:59 but the event arrives at 00:01:00, how does your 'Daily Liquidity Report' logic capture it?"
- Data Quality Gates: "How do you ensure Data Quality (DQ) before the data hits the regulatory report? Describe how you would implement automated 'Null Checks' or 'Format Validation' in the pipeline."
- Dependency Management: "You have a dependency chain: Ingest -> Validate -> Transform -> Report. If the 'Transform' job fails, how do you ensure the 'Report' job doesn't run with partial data?"
- The "Golden Source": "We have customer data in Core Banking and different data in the KYC System. How do you architect the pipeline to determine the 'Golden Source' for the regulatory report?"
- API Contracts: "When integrating core banking with new reporting layers, how do you design 'rigid contracts' to ensure that a change in the payment service doesn't break the regulatory reporting downstream?"

SECTION C: ISO 20022 DATA MAPPING & MODELING
Focus on the specific job requirement of mapping XML to Tables.

- Tag-to-Column Mapping: "Map the following ISO 20022 XML tags to a Relational Database Schema: <InstrId>, <EndToEndId>, <InstdAmt>, and <Dbtr><Nm>. What data types would you assign to each?"
- Flattening XML: "How do you flatten a complex, nested ISO 20022 XML message into a flat table for SQL querying? Do you use a parsing script or a native DB XML/JSON parser?"
- Handling 1:Many Relationships: "A pain.001 message has one Group Header but multiple Payment Information blocks. How do you model this in the database (ERD) to maintain the relationship without duplicating data?"
- Specific Message Fields: "We need to generate a 'Suspicious Transaction Report' (SAR). Which specific ISO 20022 fields (e.g., RemittanceInfo, UltimateDebtor) are critical to extract?"
- Legacy Migration: "Scenario: You need to migrate legacy SWIFT MT data (text-based) into an ISO 20022 (XML) relational schema. How do you map the unstructured Field 70 (Remittance) to the structured ISO elements?"
Status Codes: "The regulator requires a report on 'Failed Payments per Country'. Which status codes in a pacs.002 message (e.g., RJCT) do you query to build this?"
Truncation Risks: "ISO 20022 supports extensive character sets. How do you ensure your SQL database doesn't silently truncate a 140-character name into a 50-character column?"
Report Logic: "Explain how you generate a 'Daily Liquidity Position' report using data from pain.001 (Initiations) and pacs.009 (Bank Transfers). How do you differentiate between 'Inbound' and 'Outbound' funds?"

SECTION D: REGULATORY REPORTING SPECIFICS
Focus on the business outcome: Compliance.

- Report Examples: "Give examples of 3 critical regulatory reports you have worked on (e.g., MiFID II, Dodd-Frank, BOE Statistical) and the specific data challenges you faced with them."
- Sanctions Reporting: "How do you construct a 'Sanctions Hit' report? What tables do you join (e.g., TRANSACTIONS vs WATCHLIST_HITS) and how do you filter for 'False Positives'?"
- Reconciliation: "How do you prove to an auditor that the data in the report matches the raw data in the Payment Engine? Describe your automated Reconciliation Framework." 
- Scheduling: "How do you schedule a job to run at 5:00 PM EST that aggregates all transactions from the last 24 hours? How do you handle 'Time Zone' conversion (UTC to Local) in your SQL?"
- Multi-Jurisdiction: "How would you design a data model that supports reporting for both the UK (BOE) and the US (Fed) using the same underlying transaction table?"
- Correction Messages: "How does your reporting logic handle a camt.056 (Cancellation Request)? If a payment is reported and then cancelled the next day, how is the report amended?"
- Audit Trails: "How do you implement Data Lineage? If a regulator asks exactly where the 'Debtor Name' in a report came from (which system, which transformation), how do you prove it?"
- Historical Reporting: "A regulator asks for a re-submission of reports from 2 years ago using today's logic. How do you design your system to support this 'Retroactive Reporting'?"

SECTION E: SCENARIO & TROUBLESHOOTING
Focus on problem-solving in a live environment.

- Cartesian Products: "A regulatory report meant to have 10,000 rows suddenly has 10 million rows and crashes the server. You suspect a Cartesian Product. How do you debug the SQL join to find the error?"
- Performance Degradation: "The 'Weekly AML Report' used to run in 10 minutes. Now it takes 2 hours. What is the first thing you check in the Database (e.g., Stale Statistics, Index Fragmentation)?" 
- Data Gaps: "You discover a data quality issue that has affected 3 months of regulatory reports already submitted. What is your immediate technical response plan?"
- Unstructured Data Analysis: "We have unstructured data in the 'Remittance Information' field. How would you use SQL (like LIKE or Regex) to flag keywords like 'Invoice' or 'Weapon' for a compliance check?"
- Integration Testing: "How do you test a new regulatory report? Do you just check the row count, or do you perform 'Cell-by-Cell' comparison against a known expected result set?"
- Scaling: "If our transaction volume doubles next year (to 20TB daily), what part of your current reporting architecture breaks first, and how would you re-architect it?

SECTION F: ISO 20022 Data Structure Deep Dive
Crucial to know ISO 20022 MX message data structure

- "Walk me through the three-level hierarchy of a pain.001 (Customer Credit Transfer) message. specifically, what data sits in the Group Header (GrpHdr) vs. Payment Information (PmtInf) vs. Credit Transfer Transaction (CdtTrfTxInf)?"
- "In a pacs.008, if the 'Settlement Method' is defined at the Group Header level, can you override it at the Transaction level? Why or why not?"
- "Explain the difference between 'Instructed Amount' (<InstdAmt>) and 'Interbank Settlement Amount' (<IntrBkSttlmAmt>). In which scenario would they be different?"
- "We have a payment where the sender is sending funds on behalf of someone else. Where do you map the 'Ultimate Debtor' (<UltmtDbtr>) versus the 'Debtor' (<Dbtr>)? How does this impact AML screening?"
- "How do you handle unstructured remittance data in the <RmtInf> block versus structured data? Which tag specifically holds the free-text invoice details (<Ustrd>)?"
- "Where in the pacs.008 structure do we find the 'Charge Bearer' (<ChrgBr>) code (DEBT, CRED, SHAR)? Does this sit at the Payment Info level or the Transaction level?"
- "What is the critical structural difference between a pacs.008 (Core) and pacs.009 (COV)? Specifically, explain the role of the 'Underlying Customer Credit Transfer' block in a pacs.009 COV."
- "In a pacs.009, where do you map the 'Intermediary Agent'? Why is this field critical for finding the next hop in the payment chain?"
- "In a pacs.002 (Payment Status Report), which specific tag tells you the status of the payment? What is the difference between ACCP (Accepted Customer Profile) and ACSC (Accepted Settlement Completed)?"
- "If we receive a Return, the pacs.004 message will contain a Return Reason Code. Under which XML tag path would you find this ISO code (e.g., AM09 for Wrong Amount)?"
`;

const INTERVIEWER_PROFILES = `
1. DATA ARCHITECT VP: Obsessed with SQL optimization, Database Schema (Star vs Snowflake), Data Pipelines, and Data Contracts
2. REGULATORY OPS VP: Obsessed with "On-Time Delivery" of reports, Audit Trails, and specific field mappings (e.g., "Where is the Ultimate Debtor Address?").
`;

const PAYMENT_CONCEPT_COVERAGE = `
1. SQL & Database Mastery
   - Joins (Inner, Left, Right, Full) & Set Operations (Union, Intersect).
   - Aggregations (Group By, Having, Window Functions like RANK(), ROW_NUMBER()).
   - Objects: Views, Materialized Views, Stored Procedures, Packages, Cursors.
   - Concepts: Indexing, Partitioning, Normalization vs Denormalization (Star Schema).

2. ISO 20022 Data Structure
   - Critical Tags: <InstrId> (Instruction ID), <EndToEndId> (E2E ID), <TxId> (Transaction ID).
   - Parties: <Dbtr> (Debtor), <Cdtr> (Creditor), <UltmtDbtr> (Ultimate Debtor).
   - Flow: pain.001 (Customer Init) -> pacs.008 (Customer Clearing) -> pacs.009 (Bank Clearing) -> camt.053 (Statement).

3. Data Engineering Concepts
   - Data Contracts: Formal agreements on data structure between producers and consumers.
   - Data Lineage: Tracing data from Source -> Transformation -> Report.
   - ETL vs ELT: Processing data before or after loading into the warehouse.
   - Batch vs Stream: Scheduled jobs (Autosys/Airflow) vs Real-time events (Kafka).
`;

const SYSTEM_INSTRUCTION = `

  You are an Expert Technical Interviewer for a J.P. Morgan "Lead Solutions Analyst" role.
  You are Mentoring Satnam Singh for a VP Role Interview as a Lead Solution Analyst.
  
  Purpose and Goals:

* Assist candidates in preparing for technical and domain-specific interviews within the Payments, Fintech, and Banking sectors.
* Provide deep insights into Payments Technology data architecture, ISO 20022, Payment Systems, and Regulatory Reporting.
* Simulate high-pressure interview scenarios to enhance candidate readiness.
* Deliver detailed feedback on technical responses, communication skills, and problem-solving approaches.
* Offer model answers that reflect industry best practices and JPMorgan Chase's standards.
* Analyse the attached context resources CANDIDATE: ${FULL_RESUME}, ROLE: ${FULL_JD_AND_MANAGER_MSG}, JPM DATA: ${FULL_JPM_CONTEXT}, QUESTION BANK: ${FULL_QUESTION_BANK}, PANEL: ${INTERVIEWER_PROFILES}, COVERAGE: ${PAYMENT_CONCEPT_COVERAGE} and based on these help the Interviewee crack the job interview.

BEHAVIORS AND RULES:

1) MOCK  INTERVIEW EXECUTION:

 a) Conduct realistic mock interviews by asking one question at a time. Wait for the user's response before proceeding.
 b) Provide constructive feedback on both technical accuracy and communication style after each answer.
 c) Offer 'Model Answers' that demonstrate ideal responses, explaining why they are effective.
 d) Emphasize clarity, conciseness, and structured thinking in responses.
 e) Simulate a high-pressure interview environment to prepare the candidate for real-world scenarios.

2) OVERALL TONE:

* Professional, authoritative, yet encouraging.
* Highly knowledgeable and detail-oriented regarding global payments technology and financial regulations.
* Efficient and structured, mimicking a high-stakes corporate interview environment.

3) YOUR PERSONA:
  You are a Senior Data Architect at J.P. Morgan. You care about:
  1. **SQL Proficiency:** Can the candidate actually write complex queries? (Joins, Window Functions, Cursors).
  2. **Data Modeling:** Can they map nested ISO 20022 XML to relational tables (ER Diagrams)?
  3. **Reporting Pipelines:** How do they build the pipes that generate 2200+ reports daily?
  
  RESOURCES:
  1. CANDIDATE: ${FULL_RESUME}
  2. ROLE: ${FULL_JD_AND_MANAGER_MSG}
  3. JPM DATA: ${FULL_JPM_CONTEXT}
  4. QUESTION BANK: ${FULL_QUESTION_BANK}
  5. PANEL: ${INTERVIEWER_PROFILES}
  6. COVERAGE: ${PAYMENT_CONCEPT_COVERAGE}

  YOUR PROTOCOL:
  - STEP 1: EVALUATE (Grade Satnam's response based on VP-level expectations).
  - STEP 2: COACH (Explain the "Why" like a Expert Technical Interviewer and improve Satnam's interview skill).
  - STEP 3: CHALLENGE (Ask the next hard question from the bank OR as per context).
  
  STRICT RESPONSE RULES:
  1. DO NOT use any Markdown formatting. NO asterisks (*), NO hashes (#), NO bolding.
  2. Speak in plain, professional text only.
  3. If Satnam asks to repeat a question, do so immediately without extra commentary.
  4. Be concise and conversational, as this text is being read aloud.
  
`;

// ======================================================
// 1.1 NEW: BEHAVIORAL CONTEXT (VP LEADERSHIP)
// ======================================================
const BEHAVIORAL_CONTEXT = `
CANDIDATE "ABOUT ME" PITCH:
"I am a Lead Solutions Analyst with 15 years of experience in Banking and Financial Services, currently leading the Payments API & Orchestration team at NatWest.
My career is defined by two main chapters:
First, my current focus on Payment Modernization: Over the last 3 years, I have transitioned from a hands-on contributor to leading a strategic squad of Engineers, BAs, and QAs. My primary focus has been re-architecting our payment rails for ISO 20022. I led the design for critical services like the Agency Single Payment Service (handling pacs.008 and pacs.009, pacs.002), Single Payment Initiation Service (handling pain.001/pain.002), Standing Order Mandate Management (pain.009, pain.010, pain.011, 018), Validation Payment Service, Payment Scheme Validation, Amend/ReleaseFDP etc. Technically, I work heavily with the ICON Payment Framework (IPF). Because I am AWS certified, I don't just look at the functional requirements; I challenge the non-functional design—ensuring our low-code solutions are actually resilient and scalable in the cloud.
Second, my deep technical foundation: Prior to NatWest, I spent years at TCS working close to the metal. I started as a Java programmer and moved into Data Engineering—writing complex Oracle PL/SQL, managing Control-M batches, and handling large-scale Correspondence and Report generation. This means I understand the 'plumbing'—I know what happens to the data when it leaves the API and hits the ledger.
On a personal level: I am a craft-oriented person who values precision. I play classical Bamboo flute and bake sourdough bread—both of which have taught me that great results require patience and iteration. I am also an adventurer; riding my motorbike into the Himalayas taught me resilience and how to keep a calm head when conditions change rapidly.
Why I am here today: I am looking to bring that combination of ISO 20022 domain expertise and hands-on technical architecture to a 'Fortress Balance Sheet' environment like J.P. Morgan, where I can own the end-to-end delivery of complex payment solutions."

STAR STORIES (YOUR "AMMUNITION"):
1. [Vendor Performance] Agency Single Payment Service (ASPS): ICON vendor was slow. I used data (commit logs/story points) to prove the gap. Result: Vendor rebalanced team, met BoE deadline.
2. [Mentoring] ICON IPF: Vendor dependency was high. I self-studied IPF, got certified, and mentored 4 team members to certification. Result: Reduced vendor cost/risk.
3. [Conflict/Stakeholder] "Simple Change": Front-end dev wanted simple purpose codes. I demonstrated via Postman why backend regulatory mapping was complex. Result: Agreed on UI dropdowns mapped to complex ISO codes.
4. [Conflict/Blame] The "Rubbish Data" Email: John Hill blamed orchestration for errors. I traced the XML lineage, proved data was valid, and showed the issue was the Channel UI. Result: John softened, channel fixed UI.
5. [Feedback] "Channel Perspective": Paul Connor said I was too platform-focused. I designed an API Versioning Strategy to protect consumers. Result: Paul cited it as a model of customer-centricity.
6. [Difficult Manager] Saurabh: He was temperamental. I created a "calm micro-environment," pre-briefed my team, and stuck to facts. Result: Team morale survived, delivery hit targets.
7. [Failure/Perfectionism] Reporting Spec: I over-refined a spec and missed a deadline. Result: Now I use time-boxing and clarify "good enough" early.

BEHAVIORAL QUESTION BANK (VP LEVEL):
- "Tell me about yourself"?
- "How do you handle disagreement or conflict within your team or with other teams?"
- "Describe a situation where you had to push back on a senior stakeholder because their ask was not feasible or compliant."
- "Tell me about a time you influenced a technical or business decision without formal authority."
- "Give an example of a time you turned a skeptical or resistant stakeholder into a supporter."
- "How do you build trust and credibility quickly with new teams or stakeholders?"
- "Describe a time you coached someone through a difficult problem or skill gap."
- "What do you do when a team member consistently underperforms or resists feedback?"
- "Describe a time you received critical or negative feedback. How did you respond and what changed?"
- "How do you handle disagreement or conflict within your team or with other teams?"
- "Tell me about a delivery that was at risk of missing a critical deadline (regulatory, business). What did you do?"
- "Tell me about a project that failed or was cancelled. What did you learn?"
- "How do you balance innovation/speed with rigorous controls in a large regulated bank?"
- "How would you describe JP Morgan culture based on what you know, and where would you fit?"
- "How do you stay current with emerging technologies, industry trends, and best practices?"
- "What does continuous learning and improvement mean to you, and how do you foster it?"
- "As a senior IC, how do you prioritise when you have multiple stakeholders (Compliance, Ops, Tech) all asking for urgent changes?"
- "Describe a time you received critical feedback from a stakeholder (not your manager)."
- "Have you ever had to push back on a senior stakeholder because their ask was not feasible or compliant?"
- "Tell me about a time you influenced a technical or business decision without formal authority."
- "Give specific examples of how you have mentored junior analysts or team members."
- "You are going to be an individual contributor what would you do when you lose interest?"
- "Any bad feedback from previous manager how did you work on it?"
- "Have you ever failed and could not deliver? Where did you fail and why? Any feedback?"
- "Have you ever had any stakeholder you could not convince?"
- "Why are you changing the job?"
- "What is your biggest conflict How did you handle it?"
- "What is your biggest failure? How did you handle it?"
`;

// ======================================================
// 2. THE SERVER FUNCTION
// ======================================================

/* Strategic Secret Binding. 
   This explicitly grants the function permission to access the AWS 
   credentials required for Polly Neural Speech synthesis. */
exports.interviewAgent = onRequest({
  timeoutSeconds: 120,
  secrets: ["GEMINI_API_KEY", "EMERGENT_LLM_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]
}, async (req, res) => {

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  try {
    const path = (req.path || '').toLowerCase();
    const requestData = (req.body && req.body.data) ? req.body.data : (req.body || {});
    const action = requestData.action;
    const uid = requestData.userID || "satnam_default"; // Fallback safety

    // ======================================================
    // 0. AI INSTRUCTION GENERATION (CUSTOM CARDS)
    // ======================================================

    if (path.startsWith('/api/ai/generate') || action === 'generateInstruction') {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const prompt = buildInstructionPrompt(requestData);
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const parsed = safeJsonParse(raw) || {};
      return res.status(200).json({
        system_instruction: parsed.system_instruction || parsed.systemInstruction || raw,
        question_set: parsed.question_set || parsed.questionSet || ""
      });
    }

    if (path.startsWith('/api/ai/refine') || action === 'refineInstruction') {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const prompt = buildRefinePrompt(requestData.systemInstruction || "");
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      const parsed = safeJsonParse(raw) || {};
      return res.status(200).json({
        system_instruction: parsed.system_instruction || parsed.systemInstruction || raw
      });
    }

    // ======================================================
    // 1. CLOUD SYNC ENGINE (FULL STATE)
    // ======================================================

    // NEW: Syncs EVERYTHING (Progress, Stats, Projects, Settings)
    if (action === "sync") {
      await db.collection("users").doc(uid).set({
        payload: requestData.payload, // Saves the full bundle
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return res.status(200).json({ success: true });
    }

    // NEW: Fetches EVERYTHING for device hydration
    if (action === "fetch") {
      const doc = await db.collection("users").doc(uid).get();
      // Returns the 'payload' field we saved above
      return res.status(200).json({ data: { payload: doc.data()?.payload || {} } });
    }

    // LEGACY: Keep for backward compatibility if needed
    if (action === "syncStats") {
      await db.collection("users").doc(uid).set({
        stats: requestData.stats,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return res.status(200).json({ success: true });
    }

    if (action === "fetchStats") {
      const doc = await db.collection("users").doc(uid).get();
      return res.status(200).json({ data: { stats: doc.data()?.stats || {} } });
    }

    // ======================================================
    // 2. INTERVIEW HISTORY ENGINE
    // ======================================================
    
    if (action === "fetchHistory") {
      try {
        const historySnapshot = await db.collection("interviews")
          .doc(requestData.sessionID || "anon")
          .collection("history")
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();

        const history = [];
        historySnapshot.forEach(doc => {
          history.push(doc.data());
        });

        // We return it reversed so it's in chronological order for the UI
        return res.status(200).json({ data: { history: history.reverse() } });
      } catch (e) {
        console.error("History Fetch Error:", e);
        return res.status(500).json({ data: { error: e.message } });
      }
    }

    // ======================================================
    // 3. AUDIO ENGINE (AWS POLLY)
    // ======================================================

    if (action === "getSpeech") {
      const client = new PollyClient({
        region: "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      const voiceId = requestData.region === 'en-US' ?
        (requestData.gender === 'female' ? 'Joanna' : 'Matthew') :
        (requestData.gender === 'female' ? 'Amy' : 'Brian');

      const rate = requestData.speed ? `${Math.round(requestData.speed * 100)}%` : "100%";

      const ssml = `<speak><prosody rate="${rate}">${requestData.text}</prosody></speak>`;

      try {
        const response = await client.send(new SynthesizeSpeechCommand({
          Engine: "neural", Text: ssml, TextType: "ssml", VoiceId: voiceId, OutputFormat: "mp3"
        }));

        const chunks = [];
        for await (const chunk of response.AudioStream) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', audioBuffer.length);
        return res.status(200).send(audioBuffer);
      } catch (e) {
        console.error("Polly Error:", e);
        return res.status(500).json({ data: { error: e.message } });
      }
    }

    // ======================================================
    // 3.5. INTELLIGENT TRANSCRIPT FIXER (VP-LEVEL ACCURACY)
    // ======================================================
    
    if (action === "fixGrammar") {
      try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }); 
        
        const prompt = `
          You are an Expert Technical Transcriber for a J.P. Morgan Payments Solutions Architect.
          Your goal is to correct a speech-to-text transcript to be 100% technically accurate for a VP-level interview.

          RULES:
          1. FIX capitalization for acronyms (e.g., api -> API, sql -> SQL).
          2. CORRECT phonetic errors using the dictionary below.
          3. DO NOT change the speaker's tone, grammar (unless broken), or intent.
          4. OUTPUT ONLY the corrected text. No explanations.

          DOMAIN DICTIONARY (Apply these mappings aggressively):

          [ISO 20022 & SWIFT]
          - "iso 20 0 22" / "iso twenty oh two two / iso twenty oh twenty two" -> "ISO 20022"
          - "packs" / "pax" / "tax" (followed by numbers) -> "pacs" (e.g., "pacs.008", "pacs.002")
          - "pain" / "pane" (followed by numbers) -> "pain" (e.g., "pain.001", "pain.002")
          - "camt" / "camp" / "cam tea" (followed by numbers) -> "camt" (e.g., "camt.053")
          - "swift mx" / "mx" / "em ex" / "am axe" -> "SWIFT MX"
          - "swift mt" / "mt" / "am tee" / "am tea" -> "SWIFT MT"
          - "gpi" / "g p i" -> "gpi"

          [PAYMENT SCHEMES]
          - "chaps" / "chops" -> "CHAPS"
          - "sepa" / "sepper" -> "SEPA"
          - "bacs" / "backs" -> "BACS"
          - "fed now" -> "FedNow"
          - "target two" / "target 2" -> "TARGET2"
          - "cbpr plus" / "cbpr+" -> "CBPR+"

          [ARCHITECTURE & CLOUD]
          - "cafka" / "cafca" / "coffee" -> "Kafka"
          - "sequel" -> "SQL"
          - "no sequel" -> "NoSQL"
          - "api" -> "API"
          - "aws" -> "AWS"
          - "azure" -> "Azure"
          - "micro services" -> "Microservices"
          - "idempotency" / "idem potency" -> "Idempotency"
          - "latency" -> "Latency"
          - "throughput" -> "Throughput"

          [RISK & COMPLIANCE]
          - "kyc" -> "KYC"
          - "aml" -> "AML"
          - "ofac" -> "OFAC"
          - "pep" / "peps" -> "PEP"
          - "sanctions" -> "Sanctions"
          - "sars" -> "SARs"
          - "stp" -> "STP" (Straight Through Processing)

          RAW TRANSCRIPT: 
          "${requestData.text}"
        `;

        const result = await model.generateContent(prompt);
        const fixedText = result.response.text().trim();
        
        return res.status(200).json({ data: { text: fixedText } });
      } catch (e) {
        console.error("Magic Fix Error:", e);
        // Fallback: Return original text if AI fails so the user isn't stuck
        return res.status(200).json({ data: { text: requestData.text } });
      }
    }

    // ======================================================
    // 4. AI CORE (GEMINI - NOW WITH MODES)
    // ======================================================
    if (!requestData || !requestData.message) { res.status(400).json({ error: "No message received." }); return; }

    const genAI = getGeminiClient();
    
    // --- MODE SWITCHING LOGIC ---
    const mode = requestData.interviewMode || "technical"; // Default
    let dynamicInstruction = "";

    if (mode === "behavioral") {
        dynamicInstruction = `
        !!! CURRENT MODE: BEHAVIORAL & LEADERSHIP !!!
        1. IGNORE the SQL/XML technical question bank.
        2. FOCUS on the "BEHAVIORAL_CONTEXT" provided (Satnam's STAR stories).
        3. ACT as a 'Bar Raiser' or 'Hiring Manager' (VP Level).
        4. ASK questions like: "Tell me about a time you failed," "How do you manage conflict?"
        5. EVALUATE his answers based on the STAR method (Situation, Task, Action, Result).
        6. IF he mentions a story (e.g., "John Hill"), verify if he emphasized the *Action* he took.
        7. Reference: ${BEHAVIORAL_CONTEXT}
        `;
    } else {
        dynamicInstruction = `
        !!! CURRENT MODE: TECHNICAL ARCHITECT !!!
        1. FOCUS on SQL, Data Pipelines, Kafka, and ISO 20022.
        2. DRILL DOWN into technical details (e.g., "Which XML tag?", "Write the Query").
        3. IGNORE behavioral fluff.
        `;
    }

    const baseInstruction = requestData.systemInstruction || SYSTEM_INSTRUCTION;
    const questionSet = requestData.questionSet ? `\n\nQUESTION SET:\n${requestData.questionSet}` : "";
    const finalPrompt = `${baseInstruction}\n\n${questionSet}\n\n${dynamicInstruction}`;

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: finalPrompt,
    });

    const chatHistory = (requestData.history || []).map(msg => ({
      role: msg.role === 'ai' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(requestData.message);
    const responseText = result.response.text().replace(/[*#]/g, '');

    await db.collection("interviews").doc(requestData.sessionID || "anon").collection("history").add({
      userSaid: requestData.message,
      aiSaid: responseText,
      timestamp: new Date()
    });

    res.status(200).json({ data: { text: responseText } });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(200).json({ data: { text: `⚠️ PRO ERROR: ${error.message}` } });
  }
});
