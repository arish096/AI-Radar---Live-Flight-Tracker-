# ✈️ AI Radar — Live Flight Tracker

> **A real-time aircraft tracking platform powered by OpenSky Network, with an interactive radar UI and grounded AI assistance through Astra / MCP.**

AI Radar is a production-oriented live flight tracking application that visualizes **real aircraft data** from the OpenSky Network on an interactive world map.

The core principle of this project is simple:

**AI never invents aircraft data.**

Every aircraft position, callsign, altitude, speed, heading, and other flight-related fact comes from the live data layer provided by the backend/MCP server.

---

## 🚀 Overview

AI Radar combines real-time flight data, a modern radar interface, backend APIs, MCP tools, and optional AI assistance into one application.

```text
                    ┌──────────────────────┐
                    │   OpenSky Network    │
                    │  Real ADS-B Data     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Express Backend    │
                    │ Cache • Normalize    │
                    │ Search • Filtering   │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
        ┌──────────────────┐       ┌──────────────────┐
        │ React + Leaflet  │       │   MCP Server     │
        │   Live Radar UI  │       │  Astra Tools     │
        └────────┬─────────┘       └────────┬─────────┘
                 │                          │
                 ▼                          ▼
          Human Interaction           AI Assistance
```

---

## ✨ Features

### 🌍 Live Flight Tracking

* Real aircraft state vectors from OpenSky Network
* Interactive world map using Leaflet
* Automatic data polling
* Backend caching to reduce upstream requests
* Real-time aircraft information

### ✈️ Aircraft Information

Each aircraft can provide:

* Callsign
* ICAO24 address
* Latitude
* Longitude
* Altitude
* Ground speed
* Heading
* Last contact timestamp

Missing values are preserved as `null` instead of being replaced with fake data.

### 🔎 Search & Filtering

The radar supports:

* Callsign search
* ICAO24 search
* Altitude filtering
* Speed filtering
* Heading filtering
* Bounding-box filtering
* Nearby-aircraft lookup

### 🤖 AI Assistance

The project includes optional AI assistance through **Astra**.

Astra is grounded in the application's live aircraft dataset and follows strict data-grounding rules.

It cannot create or guess:

* Aircraft positions
* Callsigns
* Altitudes
* Speeds
* Headings
* ICAO24 addresses

If live data is unavailable, Astra reports that the data is unavailable rather than generating an answer.

### 🔌 MCP Integration

The MCP server exposes live-flight tools that can be used by an AI host.

Available tools:

| Tool                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `get_live_aircraft`          | Get current live aircraft            |
| `search_aircraft`            | Search by callsign or ICAO24         |
| `get_aircraft_details`       | Get details for one aircraft         |
| `filter_aircraft`            | Filter aircraft by flight parameters |
| `get_aircraft_near_location` | Find aircraft near coordinates       |

---

# 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Leaflet
* Modern CSS / UI components

### Backend

* Node.js
* Express
* TypeScript
* REST API
* In-memory caching

### AI

* Astra
* OpenAI Responses API
* MCP

### Flight Data

* OpenSky Network
* OAuth2 authentication
* ADS-B state vectors

---

# 📁 Project Structure

```text
AI-Radar---Live-Flight-Tracker/
│
├── backend/
│   ├── src/
│   │   ├── opensky.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── mcp-server/
│   ├── src/
│   └── package.json
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

# ⚙️ Requirements

Before running the project, install:

* **Node.js 20+**
* OpenSky Network API credentials
* Optional OpenAI API key for Astra

> Node.js 20+ is recommended because the MCP TypeScript SDK v2 requires Node.js 20 or newer.

---

# 🔐 Environment Variables

Create a `.env` file in the project root.

```env
OPEN_SKY_CLIENT_ID=your_client_id
OPEN_SKY_CLIENT_SECRET=your_client_secret
```

### Optional — Astra

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.6
```

### Important

Never expose these credentials in frontend code.

```text
❌ OPEN_SKY_CLIENT_SECRET → Frontend
❌ OPENAI_API_KEY         → Frontend

✅ Backend only
```

---

# 🛰️ OpenSky Network Setup

AI Radar uses authenticated OpenSky access through OAuth2 client credentials.

You need to create an API client in your OpenSky account and configure:

```env
OPEN_SKY_CLIENT_ID=...
OPEN_SKY_CLIENT_SECRET=...
```

The backend handles authentication and token refreshing.

The browser never receives the OpenSky credentials.

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/arish096/AI-Radar---Live-Flight-Tracker-.git
```

Enter the project:

```bash
cd AI-Radar---Live-Flight-Tracker-
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Then add your API credentials.

---

# ▶️ Run the Application

Start the backend and frontend:

```bash
npm run dev
```

The application will be available at:

```text
Frontend
http://localhost:5173

Backend
http://localhost:8787

Health Check
http://localhost:8787/api/health
```

---

# 🔌 Backend API

## Get Live Aircraft

```http
GET /api/aircraft
```

Optional parameters:

```text
lamin
lomin
lamax
lomax
limit
```

Example:

```text
/api/aircraft?lamin=28&lomin=76&lamax=29&lomax=78
```

---

## Get Aircraft Details

```http
GET /api/aircraft/:icao24
```

Example:

```text
/api/aircraft/3c6444
```

---

## Search Aircraft

```http
GET /api/search?q=AI101
```

Searches the current live dataset using:

* Callsign
* ICAO24

---

## Area Filtering

```http
GET /api/aircraft/area
```

Supports the same bounding-box parameters as `/api/aircraft`.

---

## Health Check

```http
GET /api/health
```

Provides backend and upstream/cache status.

---

# 🧠 Astra Grounding Architecture

Astra follows a strict grounding policy.

### Rule 1 — Live data is the source of truth

Aircraft facts must originate from the backend or MCP layer.

### Rule 2 — No hallucinated aircraft

Astra must never invent:

```text
Callsign
ICAO24
Latitude
Longitude
Altitude
Speed
Heading
```

### Rule 3 — Missing data stays missing

If OpenSky does not provide a field, the backend returns:

```json
null
```

The application does not manufacture replacement values.

### Rule 4 — Data availability is transparent

If live aircraft data cannot be retrieved, Astra explains that live data is currently unavailable.

### Rule 5 — Timestamp awareness

When useful, Astra can reference the dataset retrieval timestamp.

---

# 🔌 MCP Server

Build the MCP server:

```bash
npm run build:mcp
```

Start it:

```bash
npm run start:mcp
```

The MCP server delegates flight-data requests to the Express backend.

This creates a single source of truth:

```text
OpenSky
   ↓
Express Backend
   ↓
MCP
   ↓
Astra
```

This prevents different parts of the application from using inconsistent aircraft datasets.

---

# 🛡️ Reliability & Error Handling

AI Radar is designed to fail safely.

The application handles:

* OpenSky authentication failures
* OAuth token expiration
* API rate limits
* Missing aircraft fields
* Empty datasets
* Upstream failures
* Network errors
* Cache expiration

The application does **not** generate fake aircraft when live data is unavailable.

---

# 🧭 Data Semantics

OpenSky state vectors can contain missing information.

AI Radar preserves this distinction.

| Field        | Unit                        |
| ------------ | --------------------------- |
| Latitude     | Decimal degrees             |
| Longitude    | Decimal degrees             |
| Altitude     | Feet                        |
| Ground Speed | Knots                       |
| Heading      | Degrees                     |
| Last Contact | Timestamp                   |
| Fetched At   | Backend retrieval timestamp |

Missing values are represented as:

```json
null
```

rather than artificial values.

---

# 🚦 Troubleshooting

### `401 Unauthorized`

Check:

```env
OPEN_SKY_CLIENT_ID
OPEN_SKY_CLIENT_SECRET
```

The backend automatically attempts to refresh expired OAuth tokens.

Persistent `401` errors usually indicate invalid credentials.

---

### `429 Too Many Requests`

The OpenSky rate limit may have been reached.

AI Radar uses backend caching to reduce unnecessary upstream requests.

Wait for the configured cache window before retrying.

---

### Empty Radar

An empty map does not necessarily mean the application is broken.

Check:

```text
http://localhost:8787/api/health
```

Also verify:

* OpenSky credentials
* Network connection
* API availability
* Bounding-box filters

---

### Astra Says Live Data Is Unavailable

Check that:

1. The backend is running.
2. OpenSky credentials are configured.
3. `/api/health` is healthy.
4. `OPENAI_API_KEY` is configured if local Astra chat is enabled.

---

# 🚀 Production Considerations

Before public deployment:

* Use HTTPS
* Put the backend behind a reverse proxy
* Store secrets in a secret manager
* Restrict `CORS_ORIGIN`
* Keep backend caching enabled
* Monitor OpenSky `401`, `429`, and `5xx` responses
* Consider distributed caching for multiple backend instances
* Protect public MCP endpoints with authentication
* Never expose API secrets to the frontend

---

# ⚠️ OpenSky Limitations

OpenSky data availability depends on:

* Account/access level
* Network coverage
* API limits
* Current upstream availability

Worldwide `/states/all` requests can also be considerably larger than regional requests.

For better efficiency, use bounding-box queries when appropriate.

---

# 🔒 Security

Sensitive credentials must remain server-side.

```text
Browser
   │
   │ No secrets
   ▼
Express Backend
   │
   ├── OpenSky credentials
   └── OpenAI credentials
```

Never commit:

```text
.env
```

to GitHub.

Use:

```text
.env.example
```

for documenting required environment variables.

---

# 📸 Project Highlights

### Live Flight Radar

Interactive map displaying real aircraft positions from OpenSky Network.

### Aircraft Search

Search aircraft using callsigns or ICAO24 identifiers.

### Advanced Filtering

Filter aircraft based on altitude, speed, heading, and geographic area.

### AI + MCP

Ask Astra questions about the current aircraft dataset while keeping responses grounded in live backend data.

---

# 🎯 Project Goals

This project was built to demonstrate how real-time data systems and AI can work together without allowing the AI model to become the source of truth.

The architecture focuses on:

* Real-time data ingestion
* API design
* Backend caching
* Geographic filtering
* Interactive visualization
* MCP tool integration
* AI grounding
* Error handling
* Secure API architecture

---

# 🧪 Future Improvements

Potential future additions:

* 🌎 Advanced geographic regions
* ✈️ Flight path/history visualization
* 🛫 Airport information
* 📊 Flight statistics dashboard
* 🔔 Aircraft alerts
* 🛰️ More live data providers
* 📱 Responsive mobile radar
* 🤖 More Astra/MCP capabilities
* ☁️ Cloud deployment
* 📈 Historical flight analytics

---

# 📜 License

Application code in this repository is provided as a starter implementation.

Before public or commercial deployment, review the OpenSky Network terms, API conditions, and applicable data-licensing requirements.

---

# 👨‍💻 Author

**Arish Islam**

GitHub:
https://github.com/arish096

---

## ⭐ Support

If you find this project interesting, consider giving the repository a ⭐ on GitHub.

---

> **AI Radar — Real aircraft data. Real-time tracking. Grounded AI.**
