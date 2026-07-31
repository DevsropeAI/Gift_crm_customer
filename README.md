# Signature Gifts CRM — Frontend

The Next.js frontend for the Signature Gifts CRM: role-aware dashboards for Sales, Production,
Finance, and Admin, plus a dedicated Customer Portal — all talking to the FastAPI backend in
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
  `Customer → /portal`, `Production → /production`, `Finance → /finance`, everyone else
  (`Sales`/`Admin`) `→ /leads`.
- Root route (`app/page.tsx`) applies the same role-based redirect when a valid session already
  exists, so visiting `/` directly lands you in the right place without re-logging in.

### Leads (`app/leads/page.tsx`) — Sales/Admin
- List, create, and view leads; update lead status (`New/Qualified/Quoted/Approved`) — the
  backend enforces forward-only, one-step-at-a-time transitions for non-Admins.
- **AI qualification** trigger per lead, with the returned reasoning (urgency, value
  assessment, next action) shown inline once run.
- **Live "Assigned Rep" dropdown and table column**, populated from the backend's user
  directory (`GET /users?role=Sales`) instead of a hardcoded list.
- **Link Customer** action per lead — links a lead to a Customer-role account by email, with
  a persistent "Linked ✓" indicator once done.
- **Create Quote** modal — multi-item quote builder (products, add-ons, upsells) with a live-
  calculated total, only available once a lead is past `New`.

### Quotes (`app/quotes/page.tsx`) — Sales/Admin
- List all quotes with status management (`Draft/Sent/Approved`).
- **Customer feedback banner** — surfaces a customer's "Request Changes" comment directly on
  the quote row, de-emphasized once the quote is re-sent.
- **Create Order** action on `Approved` quotes — creates a production order from the quote,
  with the button replaced by an "Order created ✓" badge once done.

### Production Panel (`app/production/page.tsx`) — Production/Admin
- Board of all orders with their current production stage as a colored badge.
- **Move to next stage** progression through the 6-stage workflow (forward-only for
  Production; Admin can move backward). The backend blocks moving `Proofing → Production`
  without an approved proof.
- Per-order proofing with **real PDF file upload** (file picker restricted to `.pdf`, 10MB
  cap) and a **"View Proof (PDF)"** button that downloads and opens the actual file, plus
  **Send to Customer** once ready.
- Client-side role gate: non-Production/Admin accounts see an in-page 403 message rather than
  the board.

### Customer Portal (`app/portal/page.tsx`) — Customer
- View only your own quotes, proofs, orders, and invoice (backend-enforced ownership, not
  just hidden in the UI).
- **Quotes**: approve a sent quote or request changes with a comment; resolved/unresolved
  states are kept visible rather than disappearing once addressed.
- **Proofs**: only proofs actually sent for review are shown; approve or request a revision,
  and **view the real uploaded PDF** in a new tab.
- **Invoices**: see the invoice's status (`Draft/Sent/Paid/Overdue`), amount, and due date.
  - For `Sent`/`Overdue` invoices, an expandable **"How to Pay"** section shows the company's
    bank details (from `GET /payment-instructions`) and a reminder to use the Invoice ID as
    the payment reference.
  - Below that, an **"I've Paid — Submit Proof"** flow: upload a receipt (PDF/JPG/PNG) plus
    the payment reference/transaction ID actually used, which is sent to Finance for
    verification. After submission the section is replaced with a confirmation showing the
    reference that was submitted.
  - Once Finance confirms the payment, the invoice shows a final green "Paid" confirmation
    instead of any payment/upload UI.

### Finance Panel (`app/finance/page.tsx`) — Finance/Admin
- List all invoices with status, due date, paid date, and payment reference.
- **Create Invoice**: enter an order ID and due date — the amount is **auto-fetched from the
  order's quote total** (`GET /orders/{order_id}/quote-amount`) and shown read-only; there is
  no way to type an arbitrary amount.
- **Mark Sent** / **Mark Paid** status actions. Marking Paid opens an inline prompt for a
  payment reference (required) rather than a single click.
  - If the customer has uploaded a receipt, a **"Receipt attached"** badge appears with the
    customer's submitted reference displayed and a **"View Receipt"** link to open the actual
    file. The Mark Paid reference field is pre-filled with the customer's submitted reference
    as a starting point (still editable).
  - If Finance submits a reference that doesn't match what the customer claimed, the backend's
    mismatch error is shown inline so Finance can re-check before retrying. If the customer
    never uploaded a receipt, Finance can confirm payment manually with any reference.
- Client-side role gate: non-Finance/Admin accounts see an in-page 403 message.

### Shared (`lib/api.ts`)
- Typed fetch wrapper that attaches the JWT `Authorization` header automatically, parses
  backend error details, and handles session expiry (401) uniformly (including a variant for
  `FormData`/file-upload requests, which must omit an explicit `Content-Type`).
- One typed function per backend endpoint the UI uses, plus a client-side JWT role decoder
  used for the login/root redirect logic.

## Not Yet Built / Roadmap

Matches the backend's roadmap:
- **Reports / management dashboard** — no cross-cutting reporting views across leads, quotes,
  orders, and invoices.
- **Completed-order archive view** — no dedicated screen for browsing fully completed orders.
- **Real payment gateway integration** — payment confirmation is manual bank transfer +
  customer-submitted reference, verified by Finance; there's no checkout/payment-processor UI.
- **Real file storage** — uploaded proofs/receipts are served from the backend's local disk,
  not a cloud storage provider.

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

> **Important:** run the dev server with `npm run dev -- --webpack`, **not** the default
> `npm run dev`. This project has hit a reproducible Turbopack persistent-cache corruption
> issue in local development (Turbopack panics trying to read a corrupted `.sst` cache file,
> even after clearing `.next`). Falling back to the webpack compiler avoids it entirely. If a
> future Next.js/Turbopack version fixes this upstream, this note can be removed and the
> plain `npm run dev` used again — until then, always pass `-- --webpack`.

```bash
npm run dev -- --webpack
```

The app will be available at `http://localhost:3000`.

## Page / Route Reference

| Route | Purpose | Accessible to |
|---|---|---|
| `/login` | Sign in, redirects by role | Public |
| `/` | Root redirect (role-aware) | Any authenticated session |
| `/leads` | Lead management, AI qualification, rep assignment, quote creation | Sales, Admin |
| `/quotes` | Quote status management, order creation | Sales, Admin |
| `/production` | Order board, stage progression, real PDF proof upload/view | Production, Admin |
| `/portal` | Customer's own quotes, proofs, orders, invoices, payment instructions, receipt upload | Customer |
| `/finance` | Invoice creation (auto-calculated amount), status management, receipt review & reference matching | Finance, Admin |

## Project Structure

```
crm_frontend/
├── app/
│   ├── layout.tsx           # Root layout, fonts, metadata
│   ├── page.tsx             # Root route — role-based redirect
│   ├── login/page.tsx       # Login form + post-login role-based redirect
│   ├── leads/page.tsx       # Sales/Admin leads dashboard (live reps dropdown, AI qualification, customer linking)
│   ├── quotes/page.tsx      # Sales/Admin quotes dashboard, order creation
│   ├── production/page.tsx  # Production/Admin order board + real PDF proof upload/view
│   ├── portal/page.tsx      # Customer portal: quotes, proofs, orders, invoices, payment instructions, receipt upload
│   └── finance/page.tsx     # Finance/Admin invoicing panel
├── lib/
│   └── api.ts               # Typed API client shared by every page
└── .env.local                # Not committed — see Setup above
```