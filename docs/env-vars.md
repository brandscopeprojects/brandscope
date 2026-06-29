# Brandscope — Environment Variables Reference

**Document:** 9 of 10  
**Purpose:** Variable name reference for all environment variables used in Brandscope. Actual values are configured in Supabase Vault and Vercel environment settings — never stored here. Claude Code references this document for correct variable names when writing Edge Functions, API routes, and server-side code.

---

## Critical Rule

**Never hardcode any value that belongs in an environment variable.**  
**Never expose server-side variables to the frontend.**  
**Never log environment variable values to console or to any log table.**

---

## Variable Reference

### Supabase

| Variable Name | Used In | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend + server | Safe for client — public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Safe for client — RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions + server API routes ONLY | Bypasses RLS — NEVER expose to frontend |

---

### AI & LLM APIs

| Variable Name | Used In | Model/Service |
|---|---|---|
| `ANTHROPIC_API_KEY` | Edge Functions | Claude Sonnet 4.6, Claude Haiku 4.5 |
| `OPENAI_API_KEY` | Edge Functions | GPT-4.1, GPT-4.1 Mini, text-embedding-3-small, Moderation API |
| `DEEPSEEK_API_KEY` | Edge Functions | DeepSeek V3.2 — bulk extraction |
| `KIMI_API_KEY` | Edge Functions | Moonshot/Kimi — African language tasks |
| `XAI_API_KEY` | Edge Functions | Grok — GEO monitoring |
| `TOGETHER_AI_API_KEY` | Edge Functions | Llama/Meta AI — GEO monitoring |

---

### Data Source APIs

| Variable Name | Used In | Service |
|---|---|---|
| `DATAFORSEO_LOGIN` | Edge Functions | DataForSEO Basic Auth login |
| `DATAFORSEO_PASSWORD` | Edge Functions | DataForSEO Basic Auth password |
| `FIRECRAWL_API_KEY` | Edge Functions | Firecrawl web scraping |
| `APIFY_TOKEN` | Edge Functions | Apify social media scraping |
| `DETECTZESTACK_API_KEY` | Edge Functions | Tech stack detection |
| `DETECTZESTACK_WEBHOOK_SECRET` | Webhook handler | HMAC-SHA256 signature verification |

---

### Storage

| Variable Name | Used In | Service |
|---|---|---|
| `CLOUDFLARE_R2_ACCOUNT_ID` | Edge Functions | Cloudflare R2 account |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Edge Functions | R2 access credentials |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Edge Functions | R2 secret credentials |
| `CLOUDFLARE_R2_BUCKET_NAME` | Edge Functions | R2 bucket name |
| `CLOUDFLARE_R2_PUBLIC_URL` | Edge Functions | Base URL for signed URL generation |

---

### Observability

| Variable Name | Used In | Service |
|---|---|---|
| `LANGFUSE_PUBLIC_KEY` | Edge Functions | Langfuse trace ingestion |
| `LANGFUSE_SECRET_KEY` | Edge Functions | Langfuse authentication |
| `LANGFUSE_HOST` | Edge Functions | Self-hosted Railway URL |

---

### Communications

| Variable Name | Used In | Service |
|---|---|---|
| `RESEND_API_KEY` | Edge Functions | Transactional email (scan complete, alerts) |
| `IDEOGRAM_API_KEY` | Edge Functions | Ad creative image generation |

---

### Internal

| Variable Name | Used In | Notes |
|---|---|---|
| `CRON_SECRET` | Cron trigger endpoint | Validates cron calls are legitimate |
| `INTERNAL_ADMIN_SECRET` | Internal admin auth | Separate from brand auth |
| `WEBHOOK_SIGNING_SECRET` | Outbound webhooks | Signs payloads to brand webhook URLs |

---

## Frontend vs Server Rules

```
SAFE FOR FRONTEND (NEXT_PUBLIC_ prefix):
→ NEXT_PUBLIC_SUPABASE_URL
→ NEXT_PUBLIC_SUPABASE_ANON_KEY

SERVER-SIDE ONLY (Edge Functions + API routes):
→ Everything else in this document

NEVER USE IN CLIENT COMPONENTS:
→ SUPABASE_SERVICE_ROLE_KEY
→ ANTHROPIC_API_KEY
→ OPENAI_API_KEY
→ Any *_SECRET or *_PASSWORD variable
→ Any API key that calls an external paid service
```

---

## DataForSEO Authentication Pattern

DataForSEO uses Basic Auth — login and password combined:

```typescript
const credentials = btoa(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`);

const response = await fetch('https://api.dataforseo.com/v3/...', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify([...])
});
```

---

## Cloudflare R2 Access Pattern

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!
  }
});
```

---

## Langfuse Tracing Pattern

```typescript
import Langfuse from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_HOST!
});
```

---

## DetectZeStack Webhook Verification Pattern

```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.DETECTZESTACK_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  return expected === signature;
}
```

---

## Environment Setup Locations

| Environment | Where Configured |
|---|---|
| Production | Vercel environment variables (frontend) + Supabase Vault (Edge Functions) |
| Development | `.env.local` file (never committed to git) |
| Edge Functions | Supabase project settings → Edge Function secrets |

---

## .env.local Template (Development Only)

Copy this template to `.env.local` and fill in values. This file is in `.gitignore` — never commit it.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI & LLM
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
KIMI_API_KEY=
XAI_API_KEY=
TOGETHER_AI_API_KEY=

# Data Sources
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
FIRECRAWL_API_KEY=
APIFY_TOKEN=
DETECTZESTACK_API_KEY=
DETECTZESTACK_WEBHOOK_SECRET=

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=

# Observability
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=

# Communications
RESEND_API_KEY=
IDEOGRAM_API_KEY=

# Internal
CRON_SECRET=
INTERNAL_ADMIN_SECRET=
WEBHOOK_SIGNING_SECRET=
```

---

*Actual values are never stored in this document. This document defines variable names only. All values are configured in Vercel and Supabase Vault by the project owner.*
