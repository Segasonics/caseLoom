# CaseLoom (MERN + n8n)

CaseLoom is a doctor-first case-threading workspace. Doctors capture a patient narrative as a structured timeline, mark decision points, and trigger follow-up workflows via n8n.

## Core workflow
1. Create a case thread.
2. Add timeline events (symptoms, exam, tests, interventions).
3. Mark decision points (what you decided and why).
4. n8n receives decision-point webhooks to automate reminders and follow-ups.

## Local setup

### Server
1. Copy `server/.envExample` to `server/.env` and fill in values:

```
MONGO_URL=mongodb://localhost:27017/caseloom
PORT=4000
N8N_WEBHOOK_URL=http://localhost:5678/webhook/caseloom-decision-point
OPENAI_API_KEY=replace-with-your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
```

2. Install deps and run:

```
cd server
npm install
npm run dev
```

### Client
```
cd client
npm install
npm run dev
```

### n8n
Import `n8n/caseloom-decisionpoint-workflow.json` into n8n. It listens for decision-point webhooks and sends an email + creates a follow-up task.

## Notes
- This is a scaffold MVP with minimal UI.
- No PHI/clinical compliance features are included.
- Login/signup use JWT + password hashing (server-side).
- AI Assist uses OpenAI and expects de-identified data only.
