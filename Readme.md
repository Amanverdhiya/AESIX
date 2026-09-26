# AESIX (Mediksha) — Unified Healthcare & Clinical Intelligence Platform

<div align="center">

# 🏥 HealthCare Portal

### Secure Medical Document Management Platform

<p>
  <a href="https://vercel.com">
    <img src="https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  </a>

  <a href="https://render.com">
    <img src="https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" />
  </a>

  <a href="https://www.mongodb.com/atlas">
    <img src="https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  </a>

  <a href="https://react.dev">
    <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  </a>

  <a href="https://vitejs.dev">
    <img src="https://img.shields.io/badge/Bundler-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  </a>

  <a href="https://nodejs.org">
    <img src="https://img.shields.io/badge/Backend-Node.js%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  </a>

  <a href="https://abdm.gov.in">
    <img src="https://img.shields.io/badge/ABDM-Ayushman%20Bharat%20Compliant-FF6B00?style=for-the-badge" />
  </a>
</p>

</div>

**AESIX (Mediksha)** is a next-generation healthcare platform integrating **Ayushman Bharat Digital Mission (ABDM)** standards, **WHO ICD-11** disease coding, **Ayush NAMASTE** terminology dual-coding, structured **SOCRATES clinical symptom analytics**, consent-driven Doctor-Patient data sharing, live hospital geolocation radar, and an intelligent **Multilingual GenAI Medical Assistant**.

---

## 🌟 Key Features & Modules

### 1. 🔐 ABDM-Compliant Authentication & Identity
- **ABHA ID Integration**: Seamless creation, verification, and management of Ayushman Bharat Health Accounts (ABHA).
- **Aadhaar OTP Flow**: Secure OTP-based registration and login flows with transaction tracking.
- **Role-Based Portals**: Dedicated, permissioned workflows for Patients and Doctors.

### 2. 🏥 Patient Portal & Personal Health Record (PHR)
- **Interactive Health Dashboard**: Vital metrics tracking, timeline of recent consultations, and health summary.
- **Medical Records & Cloud Vault**: Upload, categorize, and view lab reports, prescriptions, and diagnostic documents (powered by Cloudinary).
- **Consent Management**: Granular privacy controls allowing patients to view, approve, or revoke medical record access requests from healthcare providers.
- **Emergency & Nearby Hospital Radar**: Live GPS geolocation with interactive Leaflet radar map to locate 24/7 emergency centers, hospitals, and clinics with direct emergency calling.

### 3. 🩺 Doctor Consultation Portal
- **Patient Directory & ABHA Lookup**: Instant patient discovery via ABHA ID or demographic queries.
- **Consent-Driven Access**: Send digital consent requests to access patient medical records and SOCRATES symptom logs.
- **Clinical Review**: In-depth view of accepted patient histories, diagnostic records, and symptom logs.

### 4. 🧬 Dual-Coding & CDSS (Clinical Decision Support)
- **WHO ICD-11 Code Explorer**: Direct integration with the WHO ICD-11 API for international disease classification.
- **Ayush NAMASTE Portal**: Standardized terminology search for traditional medicine (Ayurveda, Siddha, Unani).
- **Bidirectional Mapping**: Cross-system mapping bridging modern ICD-11 clinical classifications with traditional Ayush NAMASTE codes.

### 5. 📋 SOCRATES Clinical Symptom Logging
- Structured symptom assessment utilizing the **SOCRATES** framework:
  - **S**ite, **O**nset, **C**haracter, **R**adiation, **A**ssociations, **T**ime Course, **E**xacerbating/Relieving factors, **S**everity.
- Patient submission and direct synchronization with Doctor Review feeds.

### 6. 🤖 Multilingual GenAI Clinical Assistant
- **Groq LLM Integration**: High-speed AI inference powered by modern large language models.
- **Multilingual Support**: Real-time communication and guidance in English, Hindi (हिंदी), Bengali (বাংলা), and Tamil (தமிழ்).
- **Interactive Navigation Helper**: Built-in routing assistant with clickable deep-links to relevant platform pages and tools.

### 7. ⚡ Real-Time Sync & PWA Mobile Experience
- **WebSocket Synchronization**: Real-time Socket.IO broadcasts for instant consent status updates and notifications.
- **Progressive Web App (PWA)**: Installable on iOS/Android devices with offline caching via Service Worker.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, React Router v7, Vite 8, Tailwind CSS v4, Lucide Icons, Leaflet Maps, Socket.IO Client |
| **Backend** | Node.js, Express 4.x, Mongoose (MongoDB ODM), Socket.IO, Zod Validation, Multer |
| **Database & Cloud** | MongoDB Atlas, Cloudinary (Medical Document Storage) |
| **External APIs** | WHO ICD-11 API, Groq AI API, ABDM Gateway (Sandbox) |
| **Deployment** | Vercel (Frontend SPA), Render (Backend Web Service) |

---

## 📂 Project Structure

```text
SIH/
├── backend/                  # Node.js & Express API Server
│   ├── src/
│   │   ├── app.js            # Express server, Socket.IO & CORS configuration
│   │   ├── module/
│   │   │   ├── auth/         # Authentication, OTP, ABHA registration
│   │   │   ├── user/         # Patient endpoints, CDSS, SOCRATES, Documents
│   │   │   ├── doctor/       # Doctor directory, consent requests, patient profiles
│   │   │   └── genAi/        # Groq GenAI chat controller and safety guardrails
│   │   └── shared/           # Database config, logger, realtime event emitter
│   └── package.json
│
├── frontend/                 # React 19 + Vite SPA & PWA
│   ├── public/               # Manifest, icons, Service Worker (sw.js), offline fallback
│   ├── src/
│   │   ├── module/
│   │   │   ├── auth/         # Login & Register views
│   │   │   ├── user/         # Dashboard, ABHA, Documents, SOCRATES, CDSS
│   │   │   ├── doctor/       # Doctor dashboard, directory, consultation viewer
│   │   │   └── genAi/        # AI chatbot component & multilingual services
│   │   ├── shared/           # API resolver (apiBase.js), UI components, navbar
│   │   ├── routes/           # Application routing (AppRoutes.jsx)
│   │   └── main.jsx
│   ├── vercel.json           # Vercel SPA routing rewrite rules
│   └── vite.config.js
│
├── render.yaml               # Render Blueprint deployment specification
├── vercel.json               # Root Vercel monorepo configuration
├── package.json              # Monorepo scripts
└── README.md
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js**: v18+ or v20+
- **npm** or **pnpm**
- **MongoDB**: Local instance or MongoDB Atlas connection string

### 1. Clone the Repository
```bash
git clone https://github.com/Amanverdhiya/AESIX.git
cd AESIX
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory (see `.env.example`):
```env
PORT=5001
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/aesix
MONGODB_DB=aesix
FRONTEND_URL=http://localhost:3000

# GenAI
GROQ_API_KEY=your_groq_api_key
GROQ_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
GROQ_MODEL=openai/gpt-oss-120b

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# WHO ICD-11 API
ICD_CLIENT_ID=your_icd_client_id
ICD_CLIENT_SECRET=your_icd_client_secret
TOKEN_URL=https://icdaccessmanagement.who.int/connect/token
API_BASE=https://id.who.int/icd/release/11/2024-01/mms
```
Start the backend development server:
```bash
npm run dev
```

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend/` directory (optional for local dev, defaults to `/api` proxy):
```env
VITE_API_URL=/api
```
Start the frontend development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment

### Deploy Backend on Render
1. Create a **New Web Service** on [Render](https://dashboard.render.com/).
2. Connect your repository.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables from `backend/.env.example`.
5. *(Or deploy via `render.yaml` Blueprint for automated configuration)*.

### Deploy Frontend on Vercel
1. Import repository on [Vercel](https://vercel.com/).
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Add Environment Variable:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api`
5. Click **Deploy**.

---

## 👥 Contributors & Module Leads

| Module | Team Members |
|---|---|
| **Authentication & ABDM** | Avneet, Alok |
| **User & Patient Health Records** | Ayush, Avneet, Aanchal |
| **Doctor Portal & Consultations** | Alok, Anirudh |
| **GenAI Medical Assistant** | Anirudh, Aman |
| **Admin & System Architecture** | Ayush, Alok |

---

## 📄 License
This project is developed for the Smart India Hackathon (SIH) initiative. Distributed under the MIT License.
