"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Inbox,
  Landmark,
  Loader2,
  LogOut,
  Receipt,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  ApiError,
  CustomerProof,
  CustomerQuote,
  Invoice,
  InvoiceStatus,
  PaymentInstructions,
  ProofStatus,
  QuoteStatus,
  approveMyProof,
  approveMyQuote,
  clearToken,
  downloadProofFile,
  getMyOrders,
  getMyProofs,
  getMyQuotes,
  getOrderInvoice,
  getPaymentInstructions,
  getToken,
  requestProofRevision,
  requestQuoteChanges,
  uploadInvoiceReceipt,
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

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
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

function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_STYLES[status]}`}
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
  const [viewingProofId, setViewingProofId] = useState<number | null>(null);
  const [invoicesByOrder, setInvoicesByOrder] = useState<Record<number, Invoice | null>>({});
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);
  const [paymentInstructionsError, setPaymentInstructionsError] = useState<string | null>(null);
  const [payOpenOrderId, setPayOpenOrderId] = useState<number | null>(null);
  const [receiptDrafts, setReceiptDrafts] = useState<Record<number, File | null>>({});
  const [receiptRefDrafts, setReceiptRefDrafts] = useState<Record<number, string>>({});
  const [receiptInputKey, setReceiptInputKey] = useState<Record<number, number>>({});
  const [uploadingReceiptId, setUploadingReceiptId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadQuotes();
    loadProofs();
    loadInvoices();
    loadPaymentInstructions();
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

  async function loadInvoices() {
    setInvoicesLoading(true);
    setInvoicesError(null);
    let orderIds: number[] = [];
    try {
      const orders = await getMyOrders();
      orderIds = orders.map((o) => o.order_id);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setInvoicesError(err instanceof Error ? err.message : "We couldn't load your orders.");
      setInvoicesLoading(false);
      return;
    }

    if (orderIds.length === 0) {
      setInvoicesLoading(false);
      return;
    }

    const results: Record<number, Invoice | null> = {};
    for (const orderId of orderIds) {
      try {
        results[orderId] = await getOrderInvoice(orderId);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          results[orderId] = null;
        } else {
          setInvoicesError(err instanceof Error ? err.message : "We couldn't load your invoice.");
        }
      }
    }
    setInvoicesByOrder(results);
    setInvoicesLoading(false);
  }

  async function loadPaymentInstructions() {
    try {
      const data = await getPaymentInstructions();
      setPaymentInstructions(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setPaymentInstructionsError(err instanceof Error ? err.message : "We couldn't load payment details.");
    }
  }

  function togglePayInfo(orderId: number) {
    setPayOpenOrderId((prev) => (prev === orderId ? null : orderId));
  }

  async function handleUploadReceipt(invoice: Invoice) {
    const file = receiptDrafts[invoice.invoice_id];
    const reference = (receiptRefDrafts[invoice.invoice_id] ?? "").trim();
    if (!file) {
      setReceiptError((prev) => ({ ...prev, [invoice.invoice_id]: "Choose a PDF or image file first." }));
      return;
    }
    if (!reference) {
      setReceiptError((prev) => ({
        ...prev,
        [invoice.invoice_id]: "Enter the payment reference/transaction ID you used.",
      }));
      return;
    }
    setUploadingReceiptId(invoice.invoice_id);
    setReceiptError((prev) => ({ ...prev, [invoice.invoice_id]: "" }));
    try {
      const updated = await uploadInvoiceReceipt(invoice.invoice_id, file, reference);
      setInvoicesByOrder((prev) => ({ ...prev, [invoice.order_id]: updated }));
      setReceiptDrafts((prev) => ({ ...prev, [invoice.invoice_id]: null }));
      setReceiptInputKey((prev) => ({ ...prev, [invoice.invoice_id]: (prev[invoice.invoice_id] ?? 0) + 1 }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setReceiptError((prev) => ({
        ...prev,
        [invoice.invoice_id]: err instanceof Error ? err.message : "Could not upload the receipt.",
      }));
    } finally {
      setUploadingReceiptId(null);
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

  async function handleViewProof(proofId: number) {
    setViewingProofId(proofId);
    setProofActionError((prev) => ({ ...prev, [proofId]: "" }));
    try {
      const blob = await downloadProofFile(proofId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setProofActionError((prev) => ({
        ...prev,
        [proofId]: err instanceof Error ? err.message : "Could not load the proof file.",
      }));
    } finally {
      setViewingProofId(null);
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
                    <button
                      onClick={() => handleViewProof(proof.proof_id)}
                      disabled={viewingProofId === proof.proof_id}
                      className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-indigo-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {viewingProofId === proof.proof_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      View Proof (PDF)
                    </button>
                  )}

                  {proof.status === "Revision Requested" && proof.customer_feedback && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium">You requested:</p>
                      <p className="mt-1">{proof.customer_feedback}</p>
                    </div>
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

        {(invoicesLoading || invoicesError || Object.keys(invoicesByOrder).length > 0) && (
          <div className="mt-12">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Your Invoice</h2>
              <p className="mt-2 text-base text-gray-500">Track invoice status for your order.</p>
            </div>

            {invoicesError && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {invoicesError}
              </div>
            )}

            {invoicesLoading && <SkeletonCards />}

            {!invoicesLoading && (
              <div className="space-y-6">
                {Object.entries(invoicesByOrder).map(([orderId, invoice]) =>
                  invoice ? (
                    <div key={orderId} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-gray-900">{invoice.company_name}</p>
                          <p className="mt-0.5 text-sm text-gray-400">Order #{invoice.order_id}</p>
                        </div>
                        <InvoiceStatusPill status={invoice.status} />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                        <p className="text-sm text-gray-500">
                          Due {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                        </p>
                        <p className="text-xl font-bold text-gray-900">{formatNumber(invoice.amount)}</p>
                      </div>
                      {invoice.status === "Paid" && invoice.paid_at && (
                        <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                          <CheckCircle2 className="h-5 w-5" /> Paid on {formatDate(invoice.paid_at)}. Thank you!
                        </div>
                      )}

                      {(invoice.status === "Sent" || invoice.status === "Overdue") && (
                        <div className="mt-5">
                          <button
                            onClick={() => togglePayInfo(invoice.order_id)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                          >
                            <span className="flex items-center gap-2">
                              <Landmark className="h-4 w-4" /> How to Pay
                            </span>
                            {payOpenOrderId === invoice.order_id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          {payOpenOrderId === invoice.order_id && (
                            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-700">
                              {paymentInstructionsError && (
                                <p className="text-red-600">{paymentInstructionsError}</p>
                              )}
                              {!paymentInstructionsError && !paymentInstructions && (
                                <p className="text-gray-400">Loading payment details…</p>
                              )}
                              {paymentInstructions && (
                                <>
                                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-gray-400">Bank</p>
                                      <p className="font-medium text-gray-900">{paymentInstructions.bank_name}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-gray-400">Account Title</p>
                                      <p className="font-medium text-gray-900">
                                        {paymentInstructions.account_title}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-gray-400">
                                        Account Number
                                      </p>
                                      <p className="font-medium text-gray-900">
                                        {paymentInstructions.account_number}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-gray-400">IBAN</p>
                                      <p className="font-medium text-gray-900">{paymentInstructions.iban}</p>
                                    </div>
                                  </div>
                                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
                                    Please include{" "}
                                    <span className="font-semibold">Invoice #{invoice.invoice_id}</span> as your
                                    payment reference so we can match your payment. {paymentInstructions.note}
                                  </p>
                                </>
                              )}
                            </div>
                          )}

                          <div className="mt-4">
                            {invoice.receipt_file_url ? (
                              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                <p className="flex items-center gap-2 font-medium">
                                  <CheckCircle2 className="h-5 w-5" /> Payment proof submitted — awaiting
                                  confirmation from our finance team.
                                </p>
                                {invoice.customer_payment_reference && (
                                  <p className="mt-1.5 pl-7 text-blue-600">
                                    Reference submitted:{" "}
                                    <span className="font-semibold">{invoice.customer_payment_reference}</span>
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                                <p className="mb-2 text-sm font-medium text-gray-700">I&apos;ve Paid — Submit Proof</p>
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={receiptRefDrafts[invoice.invoice_id] ?? ""}
                                    onChange={(e) =>
                                      setReceiptRefDrafts((prev) => ({
                                        ...prev,
                                        [invoice.invoice_id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Your payment reference/transaction ID"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                  />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      key={receiptInputKey[invoice.invoice_id] ?? 0}
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                      onChange={(e) =>
                                        setReceiptDrafts((prev) => ({
                                          ...prev,
                                          [invoice.invoice_id]: e.target.files?.[0] ?? null,
                                        }))
                                      }
                                      className="min-w-[200px] flex-1 cursor-pointer text-xs text-gray-500 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-300"
                                    />
                                    <button
                                      onClick={() => handleUploadReceipt(invoice)}
                                      disabled={
                                        uploadingReceiptId === invoice.invoice_id ||
                                        !receiptDrafts[invoice.invoice_id] ||
                                        !(receiptRefDrafts[invoice.invoice_id] ?? "").trim()
                                      }
                                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {uploadingReceiptId === invoice.invoice_id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <UploadCloud className="h-4 w-4" />
                                      )}
                                      Submit Proof
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-2 text-xs text-gray-400">PDF, JPG, or PNG — max 10MB.</p>
                                {receiptError[invoice.invoice_id] && (
                                  <p className="mt-2 text-xs text-red-600">{receiptError[invoice.invoice_id]}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      key={orderId}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-500 shadow-sm"
                    >
                      <Receipt className="h-5 w-5 text-gray-300" />
                      Invoice not yet issued for this order.
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
