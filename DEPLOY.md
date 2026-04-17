# Deploying InvoiceEase — Vercel (frontend + backend), Supabase, Razorpay, Resend

This guide walks through deploying InvoiceEase using the free tiers of Vercel (frontend + backend server), Supabase (Postgres + Storage), Razorpay (payments), and Resend (transactional email).

1) Prepare accounts
- Create a Supabase project and note `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Create a Supabase Storage bucket (name it `public` or set `SUPABASE_STORAGE_BUCKET`).
- Create Vercel account and connect your GitHub repo.
- Create Razorpay account and obtain `KEY_ID` and `KEY_SECRET`.
- Create Resend account and obtain `RESEND_API_KEY`.

2) Set environment variables
- In Vercel project settings (for server), add the variables from `env.example`:
  - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `JWT_SECRET`, `WHATSAPP_TOKEN` (if available), `WHATSAPP_PHONE_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, `CLIENT_URL` (Vercel frontend URL).

3) Decide deployment model for the API
- Two options:
  - Serverless API (Vercel Functions): Deploy `server` as serverless functions. Ensure `server` code is compatible with serverless (stateless, no local file write for PDFs). For PDF generation, prefer streaming to Supabase Storage rather than saving locally.
  - Node server (Vercel Server): Use a `vercel.json` and an adapter to keep Express app running (may require Docker). Simpler path: deploy as a separate server on Render/Heroku or use Vercel with serverless-compatible PDF generation.

4) Supabase migrations & DB
- Replace in-memory `server/db.js` with Postgres-backed migrations when ready. For now, set `USE_POSTGRES=true` and ensure migration scripts are run during deploy or manual setup.
- Create tables for `users`, `invoices`, `conversations`, and `payments`. Confirm schemas in `/server/db-postgres` (if present).

5) Storage for logos & PDFs
- Server includes `/api/users/upload-logo` that uploads base64 images to Supabase Storage. Use this endpoint from the client when users upload logos.
- For PDFs, update server to upload generated PDFs to Supabase Storage and return public URLs (recommended) instead of saving locally.

6) Webhooks
- For WhatsApp and Razorpay webhooks, configure public endpoint on Vercel: `https://<your-vercel-domain>/api/whatsapp/webhook` and `.../api/payments/webhook`.
- Validate webhook secret and store keys in Vercel env.

7) Email (Resend)
- Use `RESEND_API_KEY` and call Resend API from server to send transactional emails after successful payments or invoice generation.

8) Final checks
- Verify `/api/health` responds.
- Upload a test logo via `/api/users/upload-logo` and ensure URL is publicly accessible.
- Create a test invoice, generate PDF, and ensure PDF is stored/shared via Supabase Storage.
- Test payment flow with Razorpay sandbox keys.

9) Rollout
- Start with staging Vercel environment, validate everything, then promote to production domain.

Notes & caveats
- Vercel serverless functions have execution time/memory limits. For heavy PDF generation or long-running tasks, use a background worker or external server.
- Free tier limits exist for Supabase and Vercel; verify quotas for your expected workload.
