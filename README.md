# AI Radar — Live Flight Tracker

A production-oriented live aircraft radar built around **real OpenSky Network state vectors**. The architecture deliberately separates the source of truth from AI reasoning:

**OpenSky Network → Express backend → Radar UI → Astra / MCP**

Astra never generates aircraft positions. Every aircraft fact shown or discussed by Astra must originate from live data returned by the backend/MCP layer.

## Features

- Real OpenSky live state vectors; no fake/random/hardcoded aircraft.
- Interactive Leaflet world map.
- Callsign, ICAO24, latitude/longitude, altitude, ground speed and heading.
- Automatic polling with backend caching to reduce upstream traffic.
- Search and filters for callsign, ICAO24, altitude, speed and heading.
- Bounding-box area filtering.
- Nearby-aircraft lookup using haversine distance.
- Selected-aircraft detail panel.
- Optional local Astra assistant through the OpenAI Responses API.
- MCP server exposing `get_live_aircraft`, `search_aircraft`, `get_aircraft_details`, `filter_aircraft`, and `get_aircraft_near_location`.
- Graceful handling for rate limits, missing fields, unavailable data and expired OpenSky OAuth tokens.

## Architecture

```text
                    ┌────────────────────────────┐
                    │       OpenSky Network      │
                    │     OAuth2 /states/all     │
                    └──────────────┬─────────────┘
                                   │ real ADS-B state vectors
                                   ▼
                    ┌────────────────────────────┐
                    │       Express Backend      │
                    │ cache + normalization +    │
                    │ filters + search + errors  │
                    └─────────────┬──────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
       ┌─────────────────┐                 ┌──────────────────┐
       │ React + Leaflet │                 │   MCP Server     │
       │ Live Radar UI   │                 │ Astra live tools  │
       └────────┬────────┘                 └─────────┬────────┘
                │                                    │
                ▼                                    ▼
       Human radar controls                    ChatGPT / Astra
```

## Requirements

- Node.js 20+ (the MCP TypeScript SDK v2 requires Node 20+).
- An OpenSky account/API client for authenticated access.
- Optional OpenAI API key if you want the local Astra chat endpoint.

## 1. Configure OpenSky

OpenSky's current REST API uses OAuth2 client credentials. Create an API client in your OpenSky account and put the resulting values in `.env`:

```env
OPEN_SKY_CLIENT_ID=your_client_id
OPEN_SKY_CLIENT_SECRET=your_client_secret
```

The backend exchanges these credentials for a short-lived bearer token and refreshes it before expiry. Credentials never go to the browser.

## 2. Install

```bash
cp .env.example .env
npm install
```

## 3. Run the backend and frontend

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8787
- Health: http://localhost:8787/api/health

The frontend calls only the backend. It does not contain OpenSky credentials.

## 4. Optional local Astra

Add:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.6
```

Restart the backend. Astra then uses the backend's live aircraft dataset through a server-side tool function. If `OPENAI_API_KEY` is absent, the radar still works and the UI explains that local AI chat is not configured.

## 5. MCP server

Build and run it in a second terminal:

```bash
npm run build:mcp
npm run start:mcp
```

The included MCP server uses the current TypeScript MCP SDK v2 and exposes live-flight tools. For a local MCP host, stdio is the simplest integration. For a hosted ChatGPT app, deploy the MCP server behind HTTPS and connect the remote MCP endpoint using the host's supported app/MCP configuration.

The MCP server delegates all flight data access to the same Express backend, so there is one source of truth and one cache/rate-limit boundary.

## MCP tools

- `get_live_aircraft` — current aircraft, optional bounding box and limit.
- `search_aircraft` — search the current live dataset by callsign or ICAO24.
- `get_aircraft_details` — retrieve one current aircraft by ICAO24.
- `filter_aircraft` — filter current live aircraft by altitude, speed and heading.
- `get_aircraft_near_location` — return aircraft closest to a latitude/longitude.

## Astra grounding rules

Astra is instructed to:

1. Treat backend/MCP live aircraft data as the only source of aircraft facts.
2. Never invent callsigns, positions, altitudes, speeds or headings.
3. Say that live data is unavailable when the backend has no live data.
4. Mention the live dataset timestamp when useful.
5. Distinguish missing fields from zero-valued fields.

## Backend endpoints

### `GET /api/aircraft`

Optional query parameters:

- `lamin`, `lomin`, `lamax`, `lomax` — bounding box.
- `limit` — maximum number of returned aircraft.

Example:

```text
/api/aircraft?lamin=28&lomin=76&lamax=29&lomax=78
```

### `GET /api/aircraft/:icao24`

Returns one aircraft from the current live dataset.

### `GET /api/search?q=AI101`

Searches current callsigns and ICAO24 addresses. Search is intentionally limited to the current live dataset.

### `GET /api/aircraft/area`

Alias for bounding-box filtering with the same parameters as `/api/aircraft`.

### `GET /api/health`

Returns backend and upstream/cache status.

## Data semantics

OpenSky state vectors can contain missing values. The backend preserves missing fields as `null` instead of manufacturing values. Altitude is returned in feet, speed in knots, heading in degrees, and coordinates in decimal degrees.

`lastContact` is the timestamp associated with the state vector. `fetchedAt` is when the backend retrieved the dataset.

## Production deployment notes

- Put the backend behind HTTPS and a reverse proxy.
- Store OpenSky/OpenAI credentials in a secret manager, not source control.
- Restrict `CORS_ORIGIN` to your real frontend origin.
- Keep the upstream cache enabled; do not proxy every map interaction to OpenSky.
- Add observability around OpenSky 401/429/5xx responses.
- Consider a distributed cache if running multiple backend replicas.
- Use an authenticated gateway for a public MCP endpoint.
- Do not expose `OPEN_SKY_CLIENT_SECRET` or `OPENAI_API_KEY` to the frontend.

## OpenSky limitations

OpenSky data availability and rate limits depend on account/access level and network coverage. The application therefore reports upstream errors instead of presenting stale or fabricated aircraft. A world-wide `/states/all` request can also be substantially larger than a regional bounding-box request; use area filters when appropriate.

## Troubleshooting

### `401` from OpenSky
Your OAuth client credentials may be invalid or the cached token may have expired. The backend automatically refreshes tokens after a 401; persistent 401s mean the credentials need attention.

### `429` from OpenSky
The upstream rate limit was reached. The backend reports a rate-limit error and retains the last successful cache only for the configured cache window; it does not invent replacement aircraft.

### Empty map
An empty result is a valid state. Check the backend health endpoint and OpenSky credentials/network access.

### Astra says live data is unavailable
Check `/api/health`, ensure the backend is running, and if using local AI chat ensure `OPENAI_API_KEY` is configured.

## License

Application code in this repository is provided as a starter implementation. Review OpenSky's terms and data-licensing requirements before public commercial deployment.
#   A I - R a d a r - - - L i v e - F l i g h t - T r a c k e r -  
 