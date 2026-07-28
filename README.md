# Signature Gifts CRM — Frontend

The Next.js frontend for the Signature Gifts CRM: role-aware dashboards for Sales, Production,
and Admin, plus a dedicated Customer Portal — all talking to the FastAPI backend in
`CRM_backend`.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** lucide-react

## Features Implemented

### Login (`app/login/page.tsx`)
- Email/password login form (split-screen branded layout).
- Stores the JWT returned by the backend and **redirects based on the decoded role**:
  `Customer → /portal`, `Production → /production`, everyone else (`Sales`/`Admin`) `→ /leads`.
- Root route (`app/page.tsx`) applies the same role-based redirect when a valid session already
  exists, so visiting `/` directly lands you in the right place without re-logging in.

### Leads (`app/leads/page.tsx`) — Sales/Admin
- List, create, and view leads; update lead status (`New/Qualified/Quoted/Approved`).
- **AI qualification** trigger per lead, with the returned reasoning (urgency, value
  assessment, next action) shown inline once run.
- **Link Customer** action per lead — links a lead to a Customer-role account by email, with
  a persistent "Linked ✓" indicator once done.
- **Create Quote** modal — multi-item quote builder (products, add-ons, upsells) with a live-
  calculated total, only available once a lead is past `New`.

### Quotes (`app/quotes/page.tsx`) — Sales/Admin
- List all quotes with status management (`Draft/Sent/Approved`).
- **Customer feedback banner** — surfaces a customer's "Request Changes" comment directly on
  the quote row (not buried in a detail view), de-emphasized once the quote is re-sent.
- **Create Order** action on `Approved` quotes — creates a production order from the quote,
  with the button replaced by an "Order created ✓" badge once done (backed by a live check
  against existing orders, not local-only state).

### Production Panel (`app/production/page.tsx`) — Production/Admin
- Board of all orders with their current production stage as a colored badge.
- **Move to next stage** progression through the 6-stage workflow (forward-only for
  Production; Admin can move backward).
- Per-order proof management: upload a new proof version (file URL/path), and **Send to
  Customer** once ready.
- Client-side role gate: non-Production/Admin accounts see an in-page 403 message rather than
  the board.

### Customer Portal (`app/portal/page.tsx`) — Customer
- View only your own quotes and proofs (backend-enforced ownership, not just hidden in the UI).
- **Approve** a sent quote or proof, or **Request Changes / Request Revision** with a comment.
- Clear resolved/unresolved states: approved items show a success confirmation, and past
  feedback stays visible instead of disappearing once addressed.
- Deliberately simpler, lighter, more spacious design than the internal dashboards — this is
  the one external-facing screen.

### Shared (`lib/api.ts`)
- Typed fetch wrapper that attaches the JWT `Authorization` header automatically, parses
  backend error details, and handles session expiry (401) uniformly.
- One typed function per backend endpoint the UI uses, plus a client-side JWT role decoder
  used for the login/root redirect logic.

## Not Yet Built / Roadmap

Matches the backend's roadmap:
- **Finance / Invoicing UI** — no corresponding backend functionality yet either.
- **Real file uploads for proofs** — currently a plain URL/path text field, no actual file
  picker or storage.
- **Reports / management dashboard** — no cross-cutting reporting views.
- **Completed-order archive view** — no dedicated screen for browsing fully completed orders.

## Prerequisites

- Node.js 20+ (developed against v24)
- The backend API running (see `CRM_backend/README.md`)

## Setup

```bash
git clone https://github.com/DevsropeAI/Gift_crm_customer
cd Gift_crm_customer
git checkout dev

npm install
```

Create a `.env.local` file in the project root with:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Running the App

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Page / Route Reference

| Route | Purpose | Accessible to |
|---|---|---|
| `/login` | Sign in | Public |
| `/` | Root redirect (role-aware) | Any authenticated session |
| `/leads` | Lead management, AI qualification, quote creation | Sales, Admin |
| `/quotes` | Quote status management, order creation | Sales, Admin |
| `/production` | Order board, stage progression, proofing | Production, Admin |
| `/portal` | Customer's own quotes and proofs | Customer |

## Project Structure

```
crm_frontend/
├── app/
│   ├── layout.tsx        # Root layout, fonts, metadata
│   ├── page.tsx          # Root route — role-based redirect
│   ├── login/page.tsx    # Login form + post-login redirect
│   ├── leads/page.tsx    # Sales/Admin leads dashboard
│   ├── quotes/page.tsx   # Sales/Admin quotes dashboard
│   ├── production/page.tsx # Production/Admin order & proofing board
│   └── portal/page.tsx   # Customer-facing portal
├── lib/
│   └── api.ts            # Typed API client shared by every page
└── .env.local             # Not committed — see Setup above
```
