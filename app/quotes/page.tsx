"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
  LogOut,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import {
  Lead,
  QuoteDetail,
  QuoteStatus,
  clearToken,
  getLead,
  getOrders,
  getQuote,
  getQuotes,
  getToken,
  updateQuoteStatus,
  UnauthorizedError,
} from "@/lib/api";

const STATUSES: QuoteStatus[] = ["Draft", "Sent", "Approved"];

const STATUS_STYLES: Record<QuoteStatus, string> = {
  Draft: "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20",
  Sent: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
  Approved: "bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20",
};

const TABLE_COLUMNS = ["Company", "Version", "Status", "Total Price", "Created", "Order"];

async function createOrderFromQuote(quoteId: number): Promise<{ order_id: number }> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const token = getToken();
  const res = await fetch(`${API_BASE}/orders/from-quote/${quoteId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // response had no JSON body
    }
    throw new Error(detail);
  }

  return res.json();
}

interface QuoteRow extends QuoteDetail {
  companyName: string;
}

function navLinkClass(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
  }`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="border-t border-slate-800">
          {TABLE_COLUMNS.map((_, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-3.5 w-full max-w-[100px] animate-pulse rounded bg-slate-800" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
        <Inbox className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-white">No quotes yet</p>
      <p className="mt-1 text-sm text-slate-400">Create a quote from the Leads page for a qualified lead.</p>
    </div>
  );
}

export default function QuotesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [orderedQuoteIds, setOrderedQuoteIds] = useState<Set<number>>(new Set());
  const [creatingOrderId, setCreatingOrderId] = useState<number | null>(null);
  const [orderActionError, setOrderActionError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuotes() {
    setLoading(true);
    setError(null);
    try {
      const summaries = await getQuotes();
      const details = await Promise.all(summaries.map((s) => getQuote(s.quote_id)));

      const leadIds = Array.from(new Set(details.map((d) => d.lead_id)));
      const leadsById = new Map<number, Lead>();
      await Promise.all(
        leadIds.map(async (id) => {
          try {
            leadsById.set(id, await getLead(id));
          } catch {
            // ignore lookup failures — fall back to a generic label below
          }
        })
      );

      const rows: QuoteRow[] = details
        .map((d) => ({ ...d, companyName: leadsById.get(d.lead_id)?.company_name ?? `Lead #${d.lead_id}` }))
        .sort((a, b) => b.quote_id - a.quote_id);

      setQuotes(rows);

      const orders = await getOrders();
      setOrderedQuoteIds(new Set(orders.map((o) => o.quote_id)));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load quotes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(quoteId: number) {
    setCreatingOrderId(quoteId);
    setOrderActionError((prev) => ({ ...prev, [quoteId]: "" }));
    try {
      await createOrderFromQuote(quoteId);
      setOrderedQuoteIds((prev) => new Set(prev).add(quoteId));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setOrderActionError((prev) => ({
        ...prev,
        [quoteId]: err instanceof Error ? err.message : "Failed to create order.",
      }));
    } finally {
      setCreatingOrderId(null);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  async function handleStatusChange(quoteId: number, status: QuoteStatus) {
    setUpdatingId(quoteId);
    setError(null);
    try {
      const updated = await updateQuoteStatus(quoteId, status);
      setQuotes((prev) =>
        prev
          ? prev.map((q) => (q.quote_id === quoteId ? { ...q, status: updated.status as QuoteStatus } : q))
          : prev
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to update quote status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </div>
              <span className="text-base font-semibold tracking-tight text-white">SignatureGifts CRM</span>
            </div>
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/leads" className={navLinkClass(pathname === "/leads")}>
                Leads
              </Link>
              <Link href="/quotes" className={navLinkClass(pathname === "/quotes")}>
                Quotes
              </Link>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="animate-fade-in-up mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Quotes</h1>
          <p className="mt-1 text-sm text-slate-400">Track quotes from draft through approval.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div
          className="animate-fade-in-up overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg shadow-black/20"
          style={{ animationDelay: "80ms" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  {TABLE_COLUMNS.map((col) => (
                    <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows />}
                {!loading && quotes && quotes.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length}>
                      <EmptyState />
                    </td>
                  </tr>
                )}
                {!loading &&
                  quotes &&
                  quotes.map((quote, idx) => {
                    const isExpanded = expandedId === quote.quote_id;
                    return (
                      <Fragment key={quote.quote_id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : quote.quote_id)}
                          className={`cursor-pointer border-t border-slate-800/60 transition-colors hover:bg-indigo-500/5 ${
                            idx % 2 === 1 ? "bg-white/[0.02]" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 font-medium text-white">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              {quote.companyName}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-300">v{quote.version}</td>
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={quote.status as QuoteStatus} />
                              <select
                                value={quote.status}
                                disabled={updatingId === quote.quote_id}
                                onChange={(e) => handleStatusChange(quote.quote_id, e.target.value as QuoteStatus)}
                                className="rounded-md border border-slate-700 bg-slate-800 py-1 pl-1.5 pr-6 text-xs text-slate-300 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-200">{formatNumber(quote.total_price)}</td>
                          <td className="px-4 py-3.5 text-slate-300">{formatDate(quote.created_at)}</td>
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            {quote.status === "Approved" && (
                              <>
                                {orderedQuoteIds.has(quote.quote_id) ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-500/20">
                                    <CheckCircle2 className="h-3 w-3" /> Order created
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleCreateOrder(quote.quote_id)}
                                    disabled={creatingOrderId === quote.quote_id}
                                    className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {creatingOrderId === quote.quote_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <PackagePlus className="h-3 w-3" />
                                    )}
                                    Create Order
                                  </button>
                                )}
                                {orderActionError[quote.quote_id] && (
                                  <p className="mt-1 max-w-[200px] text-xs text-red-400">
                                    {orderActionError[quote.quote_id]}
                                  </p>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                        {quote.customer_feedback &&
                          (() => {
                            const isResolved = quote.status !== "Draft";
                            return (
                              <tr className="border-t border-slate-800/60">
                                <td colSpan={TABLE_COLUMNS.length} className="px-4 py-3">
                                  <div
                                    className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                                      isResolved
                                        ? "border-slate-700 bg-slate-800/30 text-slate-500"
                                        : "border-amber-700/50 bg-amber-950/30 text-amber-300"
                                    }`}
                                  >
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                    <p>
                                      <span className="font-medium">
                                        {isResolved
                                          ? "Customer previously requested changes:"
                                          : "Customer requested changes:"}
                                      </span>{" "}
                                      {quote.customer_feedback}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            );
                          })()}
                        {isExpanded && (
                          <tr className="border-t border-slate-800/60 bg-slate-800/20">
                            <td colSpan={TABLE_COLUMNS.length} className="px-4 py-4">
                              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                                {quote.payment_terms && (
                                  <p className="mb-3 text-sm text-slate-400">
                                    <span className="font-medium text-slate-300">Payment terms:</span>{" "}
                                    {quote.payment_terms}
                                  </p>
                                )}
                                <table className="w-full text-left text-sm">
                                  <thead>
                                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                                      <th className="pb-2 pr-4 font-semibold">Product</th>
                                      <th className="pb-2 pr-4 font-semibold">Qty</th>
                                      <th className="pb-2 pr-4 font-semibold">Unit Price</th>
                                      <th className="pb-2 pr-4 font-semibold">Subtotal</th>
                                      <th className="pb-2 font-semibold">Tags</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {quote.items.map((item) => (
                                      <tr key={item.item_id} className="border-t border-slate-700/60">
                                        <td className="py-2 pr-4 text-slate-200">{item.product_name}</td>
                                        <td className="py-2 pr-4 text-slate-300">{item.quantity}</td>
                                        <td className="py-2 pr-4 text-slate-300">{formatNumber(item.unit_price)}</td>
                                        <td className="py-2 pr-4 font-medium text-slate-200">
                                          {formatNumber(item.quantity * item.unit_price)}
                                        </td>
                                        <td className="py-2">
                                          <div className="flex gap-1.5">
                                            {item.is_addon && (
                                              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
                                                Add-on
                                              </span>
                                            )}
                                            {item.is_upsell && (
                                              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                                                Upsell
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="mt-3 flex justify-end border-t border-slate-700/60 pt-3">
                                  <span className="text-sm font-semibold text-white">
                                    Total: {formatNumber(quote.total_price)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
