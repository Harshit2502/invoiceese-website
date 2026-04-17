# Deploy Checklist — InvoiceEase

Status: Partially ready (see items below)

Essential items to complete before production deploy:

- [ ] Configure Supabase project (Postgres) and set `DATABASE_URL`.
- [ ] Create Supabase Storage bucket for `logos` and `pdfs` and set `SUPABASE_STORAGE_BUCKET`.
- [ ] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to server env.
- [ ] Move uploaded logos from data-URL to Supabase Storage (server now supports `/api/users/upload-logo`).
- [ ] Ensure `JWT_SECRET` is set and rotated safely.
- [ ] Provision Razorpay keys and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
- [ ] Provision Resend API key and set `RESEND_API_KEY` for transactional emails.
- [ ] Configure Vercel projects for client and server and add environment variables in Vercel dashboard.
- [ ] Add HTTPS domain and validate webhooks endpoints (WhatsApp, Razorpay).
- [ ] Replace any in-memory seeds with real DB migrations; enable `USE_POSTGRES=true` once migrations are ready.
- [ ] Configure process manager or use Vercel serverless functions for API (confirm server compatibility with Vercel serverless).
- [ ] Confirm PDF generation assets (fonts) are available on server runtime.
- [ ] Set up logging/monitoring and health checks; ensure `/api/health` accessible.

Optional / recommended:

- [ ] Add CI job to run `npm run build` for client and server and post checklist summary to PR.
- [ ] Add tests and run them in CI.
- [ ] Add backup plan and automated DB backups in Supabase.

Notes:
- The server now supports Supabase Storage uploads via `/api/users/upload-logo`. Provide `SUPABASE_*` env vars to enable.
- WhatsApp live flows require Meta credentials and a public HTTPS webhook (use Vercel URL or ngrok for staging).
