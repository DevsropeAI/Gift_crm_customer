"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Inbox, LogOut, Sparkles } from "lucide-react";
import {
  CustomerProof,
  CustomerQuote,
  ProofStatus,
  QuoteStatus,
  approveMyProof,
  approveMyQuote,
  clearToken,
  getMyProofs,
  getMyQuotes,
  getToken,
  requestProofRevision,
  requestQuoteChanges,
  UnauthorizedError,
} from "@/lib/api";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
};

const PROOF_STATUS_STYLES: Record<ProofStatus, string> = {
  Uploaded: "bg-gray-100 text-gray-600",
  "Sent to Customer": "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
  "Revision Requested": "bg-amber-100 text-amber-700",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusPill({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function ProofStatusPill({ status }: { status: ProofStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${PROOF_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <Inbox className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-base font-medium text-gray-900">No quotes yet</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Your sales representative will share a quote here as soon as one is ready for you.
      </p>
    </div>
  );
}

function EmptyProofsState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <FileText className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-base font-medium text-gray-900">No proofs yet</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Once production starts on your order, design proofs will show up here for your review.
      </p>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 h-5 w-40 rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded bg-gray-100" />
            <div className="h-3.5 w-2/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortalPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<CustomerQuote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<Record<number, string>>({});
  const [commentBoxId, setCommentBoxId] = useState<number | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [proofs, setProofs] = useState<CustomerProof[] | null>(null);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [proofsError, setProofsError] = useState<string | null>(null);
  const [proofActioningId, setProofActioningId] = useState<number | null>(null);
  const [proofActionError, setProofActionError] = useState<Record<number, string>>({});
  const [proofCommentBoxId, setProofCommentBoxId] = useState<number | null>(null);
  const [proofCommentDrafts, setProofCommentDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadQuotes();
    loadProofs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuotes() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyQuotes();
      setQuotes(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "We couldn't load your quotes. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProofs() {
    setProofsLoading(true);
    setProofsError(null);
    try {
      const data = await getMyProofs();
      setProofs(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setProofsError(err instanceof Error ? err.message : "We couldn't load your proofs. Please try again.");
    } finally {
      setProofsLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  async function handleApprove(quoteId: number) {
    setActioningId(quoteId);
    setActionError((prev) => ({ ...prev, [quoteId]: "" }));
    try {
      const updated = await approveMyQuote(quoteId);
      setQuotes((prev) => (prev ? prev.map((q) => (q.quote_id === quoteId ? updated : q)) : prev));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setActionError((prev) => ({
        ...prev,
        [quoteId]: err instanceof Error ? err.message : "Could not approve this quote.",
      }));
    } finally {
      setActioningId(null);
    }
  }

  function openCommentBox(quoteId: number) {
    setCommentBoxId(quoteId);
    setCommentDrafts((prev) => ({ ...prev, [quoteId]: prev[quoteId] ?? "" }));
    setActionError((prev) => ({ ...prev, [quoteId]: "" }));
  }

  function closeCommentBox() {
    setCommentBoxId(null);
  }

  async function handleSubmitChanges(quoteId: number) {
    const comment = (commentDrafts[quoteId] ?? "").trim();
    if (!comment) {
      setActionError((prev) => ({ ...prev, [quoteId]: "Please describe the change you'd like." }));
      return;
    }
    setActioningId(quoteId);
    setActionError((prev) => ({ ...prev, [quoteId]: "" }));
    try {
      const updated = await requestQuoteChanges(quoteId, comment);
      setQuotes((prev) => (prev ? prev.map((q) => (q.quote_id === quoteId ? updated : q)) : prev));
      setCommentBoxId(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setActionError((prev) => ({
        ...prev,
        [quoteId]: err instanceof Error ? err.message : "Could not send your request.",
      }));
    } finally {
      setActioningId(null);
    }
  }

  async function handleApproveProof(proofId: number) {
    setProofActioningId(proofId);
    setProofActionError((prev) => ({ ...prev, [proofId]: "" }));
    try {
      const updated = await approveMyProof(proofId);
      setProofs((prev) => (prev ? prev.map((p) => (p.proof_id === proofId ? updated : p)) : prev));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setProofActionError((prev) => ({
        ...prev,
        [proofId]: err instanceof Error ? err.message : "Could not approve this proof.",
      }));
    } finally {
      setProofActioningId(null);
    }
  }

  function openProofCommentBox(proofId: number) {
    setProofCommentBoxId(proofId);
    setProofCommentDrafts((prev) => ({ ...prev, [proofId]: prev[proofId] ?? "" }));
    setProofActionError((prev) => ({ ...prev, [proofId]: "" }));
  }

  function closeProofCommentBox() {
    setProofCommentBoxId(null);
  }

  async function handleSubmitProofRevision(proofId: number) {
    const comment = (proofCommentDrafts[proofId] ?? "").trim();
    if (!comment) {
      setProofActionError((prev) => ({ ...prev, [proofId]: "Please describe the change you'd like." }));
      return;
    }
    setProofActioningId(proofId);
    setProofActionError((prev) => ({ ...prev, [proofId]: "" }));
    try {
      const updated = await requestProofRevision(proofId, comment);
      setProofs((prev) => (prev ? prev.map((p) => (p.proof_id === proofId ? updated : p)) : prev));
      setProofCommentBoxId(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setProofActionError((prev) => ({
        ...prev,
        [proofId]: err instanceof Error ? err.message : "Could not send your request.",
      }));
    } finally {
      setProofActioningId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <span className="text-base font-semibold tracking-tight text-gray-900">SignatureGifts</span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Your Quotes</h1>
          <p className="mt-2 text-base text-gray-500">
            Review your quotes below. Approve when you&apos;re happy, or let us know if anything needs to change.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && <SkeletonCards />}

        {!loading && quotes && quotes.length === 0 && <EmptyState />}

        {!loading && quotes && quotes.length > 0 && (
          <div className="space-y-6">
            {quotes.map((quote) => {
              const isActioning = actioningId === quote.quote_id;
              const showCommentBox = commentBoxId === quote.quote_id;
              const rowError = actionError[quote.quote_id];

              return (
                <div key={quote.quote_id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{quote.company_name}</p>
                      <p className="mt-0.5 text-sm text-gray-400">
                        Quote v{quote.version} &middot; {formatDate(quote.created_at)}
                      </p>
                    </div>
                    <StatusPill status={quote.status} />
                  </div>

                  <div className="divide-y divide-gray-100 border-y border-gray-100">
                    {quote.items.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <p className="text-xs text-gray-400">
                              {item.quantity} &times; {formatNumber(item.unit_price)}
                            </p>
                            {item.is_addon && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                                Add-on
                              </span>
                            )}
                            {item.is_upsell && (
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                                Upsell
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-700">
                          {formatNumber(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-gray-500">
                      {quote.payment_terms && <p>Payment terms: {quote.payment_terms}</p>}
                    </div>
                    <p className="text-xl font-bold text-gray-900">Total: {formatNumber(quote.total_price)}</p>
                  </div>

                  {quote.status === "Draft" && quote.customer_feedback && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">You requested:</p>
                      <p className="mt-1">{quote.customer_feedback}</p>
                    </div>
                  )}

                  {quote.status === "Draft" && !quote.customer_feedback && (
                    <p className="mt-5 text-sm text-gray-400">Your sales representative is preparing this quote.</p>
                  )}

                  {quote.status === "Approved" && (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                      <CheckCircle2 className="h-5 w-5" /> You approved this quote. Thank you!
                    </div>
                  )}

                  {rowError && <p className="mt-4 text-sm text-red-600">{rowError}</p>}

                  {quote.status === "Sent" && !showCommentBox && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApprove(quote.quote_id)}
                        disabled={isActioning}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                      >
                        {isActioning ? "Approving…" : "Approve Quote"}
                      </button>
                      <button
                        onClick={() => openCommentBox(quote.quote_id)}
                        disabled={isActioning}
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                      >
                        Request Changes
                      </button>
                    </div>
                  )}

                  {quote.status === "Sent" && showCommentBox && (
                    <div className="mt-6 space-y-3">
                      <label className="block text-sm font-medium text-gray-700">What would you like changed?</label>
                      <textarea
                        value={commentDrafts[quote.quote_id] ?? ""}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [quote.quote_id]: e.target.value }))}
                        rows={3}
                        placeholder="e.g. Could we get a lower quantity, or a different color?"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleSubmitChanges(quote.quote_id)}
                          disabled={isActioning}
                          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isActioning ? "Sending…" : "Submit Request"}
                        </button>
                        <button
                          onClick={closeCommentBox}
                          disabled={isActioning}
                          className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-8 mt-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Your Proofs</h2>
          <p className="mt-2 text-base text-gray-500">
            Review design proofs for your order. Approve when it looks right, or request a revision.
          </p>
        </div>

        {proofsError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {proofsError}
          </div>
        )}

        {proofsLoading && <SkeletonCards />}

        {!proofsLoading && proofs && proofs.length === 0 && <EmptyProofsState />}

        {!proofsLoading && proofs && proofs.length > 0 && (
          <div className="space-y-6">
            {proofs.map((proof) => {
              const isActioning = proofActioningId === proof.proof_id;
              const showCommentBox = proofCommentBoxId === proof.proof_id;
              const rowErr = proofActionError[proof.proof_id];

              return (
                <div key={proof.proof_id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{proof.company_name}</p>
                      <p className="mt-0.5 text-sm text-gray-400">
                        Proof v{proof.version} &middot; {formatDate(proof.created_at)}
                      </p>
                    </div>
                    <ProofStatusPill status={proof.status} />
                  </div>

                  {proof.file_url && (
                    <p className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      {proof.file_url}
                    </p>
                  )}

                  {proof.status === "Revision Requested" && proof.customer_feedback && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">You requested:</p>
                      <p className="mt-1">{proof.customer_feedback}</p>
                    </div>
                  )}

                  {proof.status === "Uploaded" && (
                    <p className="mt-5 text-sm text-gray-400">This proof hasn&apos;t been sent to you yet.</p>
                  )}

                  {proof.status === "Approved" && (
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                      <CheckCircle2 className="h-5 w-5" /> You approved this proof. Thank you!
                    </div>
                  )}

                  {rowErr && <p className="mt-4 text-sm text-red-600">{rowErr}</p>}

                  {proof.status === "Sent to Customer" && !showCommentBox && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApproveProof(proof.proof_id)}
                        disabled={isActioning}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                      >
                        {isActioning ? "Approving…" : "Approve Proof"}
                      </button>
                      <button
                        onClick={() => openProofCommentBox(proof.proof_id)}
                        disabled={isActioning}
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                      >
                        Request Revision
                      </button>
                    </div>
                  )}

                  {proof.status === "Sent to Customer" && showCommentBox && (
                    <div className="mt-6 space-y-3">
                      <label className="block text-sm font-medium text-gray-700">What would you like changed?</label>
                      <textarea
                        value={proofCommentDrafts[proof.proof_id] ?? ""}
                        onChange={(e) =>
                          setProofCommentDrafts((prev) => ({ ...prev, [proof.proof_id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="e.g. Could we adjust the colors or make the logo bigger?"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleSubmitProofRevision(proof.proof_id)}
                          disabled={isActioning}
                          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isActioning ? "Sending…" : "Submit Request"}
                        </button>
                        <button
                          onClick={closeProofCommentBox}
                          disabled={isActioning}
                          className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
