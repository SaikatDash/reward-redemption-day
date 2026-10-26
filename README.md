# Slowday — Reward Inbox

**A calm, public-ready rewards shelf that does the remembering for you.** Paste a coupon, points notice, or offer email and hosted AI pulls out the merchant, value, expiry, and redemption steps. Review the result, save it, then mark the reward redeemed when you use it.

## What happens to your data

- Saved rewards stay in the visitor's browser storage. The site does not create accounts or send the saved shelf to its server.
- Offer text is sent to the configured AI endpoint only when the visitor selects **Extract details**. It is processed by the operator's chosen inference provider; configure that provider's retention and privacy policies before inviting the public.
- The model returns a draft. Visitors review and edit the details before saving. The extractor is instructed to leave uncertain expiry dates blank.
- The browser makes no third-party analytics, font, or tracking requests. The AI service is the only external service needed for extraction.

## Run locally

Requirements: Python 3.10+, Node.js 20.19+, npm, and Ollama (only needed for AI extraction).

```bash
npm install
ollama pull qwen2.5:3b
```

Set the inference configuration and start the app:

```bash
AI_BASE_URL=http://127.0.0.1:11434/v1 AI_MODEL=qwen2.5:3b python app.py
```

In a second terminal, run `npm run dev` and open the Vite address. On PowerShell, set the variables with `$env:AI_BASE_URL="http://127.0.0.1:11434/v1"` and `$env:AI_MODEL="qwen2.5:3b"` before `python app.py`.

To serve the production React build from the Python app, run `npm run build` then `python app.py`. The app defaults to `127.0.0.1:8000` for private local use.

## Deploy as a public website

### Netlify frontend with a private Ollama backend

Netlify hosts the React files; it does not run Ollama. Run the Python API and Ollama together on a separate server using Docker Compose, then point the frontend at that server's HTTPS API URL. The browser never connects directly to Ollama.

1. Copy `.env.example` to `.env` on the backend server. Set `ALLOWED_ORIGINS` to the exact Netlify origin (for example, `https://your-site-name.netlify.app`). If using a custom domain, include that exact origin too, comma-separated. Keep `AI_BASE_URL=http://ollama:11434/v1` so the API reaches Ollama over the private Docker network.
2. Start the backend stack on a server with enough memory and disk for the model:

```bash
docker compose up --build -d
```

3. Put the backend behind HTTPS (a TLS reverse proxy or your host's HTTPS ingress). Keep port 11434 private; expose only the API/web port. If using a reverse proxy, configure it to overwrite `X-Forwarded-For`.
4. In Netlify, import the repository and use the included `netlify.toml` settings (`npm run build`, publish `dist`). Add the build environment variable `VITE_API_BASE_URL=https://your-api-domain.example.com`, replacing it with the public HTTPS origin of your backend. Netlify rebuilds the frontend with this URL.
5. If you later change the Netlify domain, update the backend's `ALLOWED_ORIGINS` to match the new origin and redeploy the API.

The backend allows 8 extraction requests per client IP per minute in each app instance. This in-memory limit resets when the API restarts; use an edge or shared rate limiter for multiple replicas. Never put an AI provider key in frontend code. `AI_API_KEY` is only for an external provider and stays on the backend.

For a single-host demo, the included Docker Compose setup also serves the React site directly from the API container. Only the web port is published; Ollama's port stays private. A first launch downloads the model weights. Open `http://your-server:8000` after starting the stack.

To use a hosted OpenAI-compatible provider instead of the bundled Ollama service, set `AI_BASE_URL` to its API base URL, `AI_MODEL` to an available model name, and `AI_API_KEY` if required. Keep the key only in the server environment. When using an external provider, the offer text is sent there for inference and that provider's data policies apply.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_BASE_URL` | `http://127.0.0.1:11434/v1` | OpenAI-compatible inference API base URL |
| `AI_MODEL` | `qwen2.5:3b` | Model name sent to the inference service |
| `AI_API_KEY` | empty | Optional server-side bearer token for hosted providers |
| `ALLOWED_ORIGINS` | local Vite origins | Comma-separated exact browser origins allowed to call the API |
| `VITE_API_BASE_URL` | empty (same origin) | Frontend build-time URL for the API; set this in Netlify |
| `HOST` | `127.0.0.1` | Bind address; set `0.0.0.0` inside the container |
| `PORT` | `8000` | Web app port |

## How it works

```text
Offer text --when Extract is clicked--> Server API --> Configured AI
     |                                         |
     +---- reviewed draft in browser <---------+
                  |
                  +--> rewards saved in this browser only
```

The React interface and Python API are open-source. The app uses the same OpenAI-compatible chat-completions format for local Ollama or a hosted inference service, so the operator can swap providers without changing the browser app. Local Ollama is also supported for private offline use after model setup.

## License

MIT. See [LICENSE](LICENSE).
