# Enterprise NeXus
### Multi-Agent AI Business Automation OS with Security Intelligence

---

## Team Information

| Field | Details |
|---|---|
| **Course Code** | CSE4204 |
| **Section** | 8B |
| **Team Number** | T04 |
| **Official Team Name** | CSE4204-8B-T04 |
| **Project Title** | Enterprise NeXus — Multi-Agent AI Business Automation OS with Security Intelligence |

## Team Members

| Role | Name | Student ID |
|---|---|---|
| Team Leader & AI Integration Lead | Nazmus Sakib | 11220320888 |
| Backend Developer | Shoeb Shariar Mashuk | 11220320878 |
| Frontend Developer — 1 | Most Sumiya Sanjida | 11220320874 |
| Database Manager & Frontend Developer — 2 | Sabrina Ibrahim | 11220320895 |

---

## Project Description

Enterprise NeXus is a Multi-Agent AI Business Automation Operating System designed to unify and intelligently automate core business functions for small and medium enterprises, startups, and growing organizations.

The platform deploys five specialized AI agents — an HR Agent, a Finance Agent, a Support Agent, an Analytics Agent, and an Executive Agent — each responsible for a distinct operational domain. These agents operate through a centralized orchestration layer powered by LangChain and CrewAI, enabling them to collaborate autonomously, delegate sub-tasks across departments, and deliver synthesized intelligence to a unified, role-based web dashboard. A dedicated Security Intelligence module monitors threats and enforces data protection across the entire system.

---

## Proposed Features

- Multi-Agent AI Orchestration (HR, Finance, Support, Analytics, Executive)
- Intelligent CV Screening via the HR Agent
- Financial Pattern Recognition and Anomaly Detection
- Context-Aware Customer Support with RAG
- Executive Synthesis — Cross-domain strategic summaries
- Semantic Search with AI-generated embeddings
- Security Intelligence and Threat Monitoring
- Role-Based Unified Web Dashboard
- Real-Time AI-Driven Insights and Reporting
- Document and Policy Retrieval via Vector Search

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js / Next.js |
| **Styling** | Tailwind CSS |
| **Backend** | Node.js + Express.js |
| **Authentication** | JWT + bcrypt |
| **Workflow Automation** | n8n |
| **Database** | PostgreSQL |
| **Vector Database** | Pinecone / ChromaDB |
| **Core LLM** | OpenAI GPT-4 / Google Gemini |
| **AI Framework** | LangChain |
| **Multi-Agent Orchestration** | CrewAI |
| **Conversational Agents** | AutoGen |
| **Version Control** | GitHub |

---

## Objectives

1. **Automate Department-Level Operations** — Deploy five specialized AI agents to autonomously handle routine business workflows.
2. **Deliver Intelligent Decision Support** — Leverage Google Gemini to generate data-driven insights, anomaly alerts, KPI narratives, and strategic briefings.
3. **Centralize Business Intelligence** — Unify HR, financial, support, and operational data into a single platform with a real-time dashboard.
4. **Ensure Enterprise-Grade Security** — Implement JWT-based authentication, RBAC, bcryptjs hashing, rate limiting, and input sanitisation.
5. **Enable Scalable, Cloud-Native Deployment** — Build a production-ready system using Docker, GitHub Actions CI, Vercel, Render, and Supabase.
6. **Demonstrate Full-Stack AI Engineering** — Produce a well-documented, end-to-end software system as a complete academic deliverable for CSE4204.

---

## Repository Structure

```
Enterprise-NeXus/
│   .gitignore
│   README.md
│
├── assets/
│   └── logo/
│
├── backend/
├── database/
├── frontend/
├── n8n-workflows/
│
└── documentation/
    ├── proposal/
    ├── srs/
    ├── system-design/
    ├── diagram/
    │   ├── ai-workflow/
    │   ├── architecture/
    │   ├── er-diagram/
    │   ├── use-case-diagram/
    │   └── user-flow/
    └── ui-design/
        ├── figma.md
        ├── CSE4204-8B-T04_UIDesign.pdf
        └── screens/           ← 41 screens (PNG + HTML per screen)
```

---

## Documentation

| Document | Link |
|---|---|
| **Project Proposal** | [CSE4204-8B-T04_Proposal.pdf](documentation/proposal/CSE4204-8B-T04_Proposal.pdf) |
| **Software Requirements Specification** | [CSE4204-8B-T04_SRS.pdf](documentation/srs/CSE4204-8B-T04_SRS.pdf) |
| **System Design** | [CSE4204-8B-T04_SystemDesign.pdf](documentation/system-design/CSE4204-8B-T04_SystemDesign.pdf) |
| **Architecture Diagram** | [CSE4204-8B-T04_ArchitectureDiagram.pdf](documentation/diagram/architecture/CSE4204-8B-T04_ArchitectureDiagram.pdf) |
| **ER Diagram** | [CSE4204-8B-T04_ERDiagram.pdf](documentation/diagram/er-diagram/CSE4204-8B-T04_ERDiagram.pdf) |
| **Use Case Diagram** | [CSE4204-8B-T04_UseCaseDiagram.pdf](documentation/diagram/use-case-diagram/CSE4204-8B-T04_UseCaseDiagram.pdf) |
| **UI Design Prototype** | [CSE4204-8B-T04_UIDesign.pdf](documentation/ui-design/CSE4204-8B-T04_UIDesign.pdf) |
| **Figma Prototype** | [View on Figma](documentation/ui-design/figma.md) |
