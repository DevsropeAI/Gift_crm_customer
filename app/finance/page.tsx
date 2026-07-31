"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, LogOut, Paperclip, Plus, Send, Sparkles, X } from "lucide-react";
import {
  CreateInvoiceInput,
  Invoice,
  InvoiceStatus,
  clearToken,
  createInvoice,
  downloadInvoiceReceipt,
  getInvoices,
  getOrderQuoteAmount,
  getRoleFromToken,
  getToken,
  updateInvoiceStatus,
  UnauthorizedError,
} from "@/lib/api";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20",
  Sent: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
  Paid: "bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20",
  Overdue: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
};

const TABLE_COLUMNS = ["Company", "Order", "Amount", "Status", "Due Date", "Paid", "Payment Ref", "Actions"];

const emptyForm: CreateInvoiceInput = { order_id: 0, due_date: "" };

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
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

export default function FinancePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateInvoiceInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [previewOrderId, setPreviewOrderId] = useState<number | null>(null);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [previewCompany, setPreviewCompany] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentRefDrafts, setPaymentRefDrafts] = useState<Record<number, string>>({});
  const [viewingReceiptId, setViewingReceiptId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRoleFromToken(token);
    if (role !== "Finance" && role !== "Admin") {
      setForbidden(true);
      setAuthChecked(true);
      return;
    }
    setAuthChecked(true);
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  function openForm() {
    setForm(emptyForm);
    setFormError(null);
    setPreviewOrderId(null);
    setPreviewAmount(null);
    setPreviewCompany(null);
    setPreviewError(null);
    setFormOpen(true);
  }

  async function loadPreview(orderId: number) {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewAmount(null);
    setPreviewCompany(null);
    try {
      const data = await getOrderQuoteAmount(orderId);
      setPreviewAmount(data.amount);
      setPreviewCompany(data.company_name);
      setPreviewOrderId(orderId);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setPreviewOrderId(null);
      setPreviewError(err instanceof Error ? err.message : "Could not find that order.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleOrderIdBlur() {
    if (form.order_id && form.order_id > 0) {
      loadPreview(form.order_id);
    }
  }

  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.order_id || form.order_id <= 0) {
      setFormError("Enter a valid order ID.");
      return;
    }
    if (!form.due_date) {
      setFormError("Choose a due date.");
      return;
    }
    if (previewOrderId !== form.order_id || previewAmount === null) {
      setFormError("Enter the order ID and wait for its quote amount to load before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await createInvoice(form);
      setFormOpen(false);
      await loadInvoices();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setFormError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdvanceStatus(invoice: Invoice, nextStatus: InvoiceStatus) {
    setStatusUpdatingId(invoice.invoice_id);
    setRowError((prev) => ({ ...prev, [invoice.invoice_id]: "" }));
    try {
      const updated = await updateInvoiceStatus(invoice.invoice_id, nextStatus);
      setInvoices((prev) =>
        prev ? prev.map((i) => (i.invoice_id === invoice.invoice_id ? updated : i)) : prev
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [invoice.invoice_id]: err instanceof Error ? err.message : "Failed to update status.",
      }));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleViewReceipt(invoiceId: number) {
    setViewingReceiptId(invoiceId);
    setRowError((prev) => ({ ...prev, [invoiceId]: "" }));
    try {
      const blob = await downloadInvoiceReceipt(invoiceId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [invoiceId]: err instanceof Error ? err.message : "Could not load the receipt.",
      }));
    } finally {
      setViewingReceiptId(null);
    }
  }

  function openPaidPrompt(invoice: Invoice) {
    setRowError((prev) => ({ ...prev, [invoice.invoice_id]: "" }));
    setPaymentRefDrafts((prev) => ({
      ...prev,
      [invoice.invoice_id]: prev[invoice.invoice_id] || invoice.customer_payment_reference || "",
    }));
    setPayingId(invoice.invoice_id);
  }

  function cancelPaidPrompt(invoiceId: number) {
    setPayingId(null);
    setPaymentRefDrafts((prev) => ({ ...prev, [invoiceId]: "" }));
  }

  async function handleConfirmPaid(invoice: Invoice) {
    const ref = (paymentRefDrafts[invoice.invoice_id] ?? "").trim();
    if (!ref) {
      setRowError((prev) => ({ ...prev, [invoice.invoice_id]: "Enter a payment reference." }));
      return;
    }
    setStatusUpdatingId(invoice.invoice_id);
    setRowError((prev) => ({ ...prev, [invoice.invoice_id]: "" }));
    try {
      const updated = await updateInvoiceStatus(invoice.invoice_id, "Paid", ref);
      setInvoices((prev) =>
        prev ? prev.map((i) => (i.invoice_id === invoice.invoice_id ? updated : i)) : prev
      );
      setPayingId(null);
      setPaymentRefDrafts((prev) => ({ ...prev, [invoice.invoice_id]: "" }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [invoice.invoice_id]: err instanceof Error ? err.message : "Failed to update status.",
      }));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="max-w-sm rounded-2xl border border-red-900/50 bg-red-950/30 p-8 text-center">
          <p className="text-lg font-semibold text-white">403 — Access denied</p>
          <p className="mt-2 text-sm text-red-300">This page is only available to Finance and Admin accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">SignatureGifts CRM</span>
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
        <div className="animate-fade-in-up mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Finance Panel</h1>
            <p className="mt-1 text-sm text-slate-400">Create and track invoices for orders.</p>
          </div>
          <button
            onClick={openForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:shadow-xl hover:shadow-indigo-500/30"
          >
            <Plus className="h-4 w-4" /> Create Invoice
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {formOpen && (
          <div className="animate-fade-in-up mb-6 rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">New Invoice</h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Order ID</label>
                <input
                  type="number"
                  min="1"
                  value={form.order_id || ""}
                  onChange={(e) => setForm({ ...form, order_id: Number(e.target.value) })}
                  onBlur={handleOrderIdBlur}
                  placeholder="e.g. 6"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Amount (from quote)</label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2.5 text-sm">
                  {previewLoading && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Looking up quote total…
                    </span>
                  )}
                  {!previewLoading && previewError && <span className="text-red-400">{previewError}</span>}
                  {!previewLoading && !previewError && previewAmount !== null && (
                    <span className="text-slate-100">
                      {formatMoney(previewAmount)}{" "}
                      <span className="text-slate-500">— {previewCompany}</span>
                    </span>
                  )}
                  {!previewLoading && !previewError && previewAmount === null && (
                    <span className="text-slate-500">Enter an order ID to look up its quote total.</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  This amount is pulled automatically from the order&apos;s approved quote and can&apos;t be edited.
                </p>
              </div>

              {formError && <p className="sm:col-span-2 text-sm text-red-400">{formError}</p>}

              <div className="sm:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Creating…" : "Create Invoice"}
                </button>
              </div>
            </form>
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
                {!loading && invoices && invoices.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="px-4 py-12 text-center text-sm text-slate-500">
                      No invoices yet. Create one for an order to get started.
                    </td>
                  </tr>
                )}
                {!loading &&
                  invoices &&
                  invoices.map((invoice, idx) => {
                    const err = rowError[invoice.invoice_id];
                    const isUpdating = statusUpdatingId === invoice.invoice_id;
                    return (
                      <tr
                        key={invoice.invoice_id}
                        className={`border-t border-slate-800/60 transition-colors hover:bg-indigo-500/5 ${
                          idx % 2 === 1 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5 font-medium text-white">{invoice.company_name}</td>
                        <td className="px-4 py-3.5 text-slate-300">#{invoice.order_id}</td>
                        <td className="px-4 py-3.5 text-slate-300">{formatMoney(invoice.amount)}</td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">{formatDate(invoice.due_date)}</td>
                        <td className="px-4 py-3.5 text-slate-300">{formatDate(invoice.paid_at)}</td>
                        <td className="px-4 py-3.5 text-slate-300">{invoice.payment_reference || "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            {(invoice.status === "Sent" || invoice.status === "Overdue") &&
                              invoice.receipt_file_url && (
                                <div className="mb-1 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/20">
                                      <Paperclip className="h-3 w-3" /> Receipt attached
                                    </span>
                                    <button
                                      onClick={() => handleViewReceipt(invoice.invoice_id)}
                                      disabled={viewingReceiptId === invoice.invoice_id}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 transition hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {viewingReceiptId === invoice.invoice_id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <FileText className="h-3 w-3" />
                                      )}
                                      View Receipt
                                    </button>
                                  </div>
                                  {invoice.customer_payment_reference && (
                                    <p className="max-w-[220px] text-[11px] text-slate-400">
                                      Customer says:{" "}
                                      <span className="font-medium text-slate-200">
                                        {invoice.customer_payment_reference}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}
                            {invoice.status === "Draft" && (
                              <button
                                onClick={() => handleAdvanceStatus(invoice, "Sent")}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isUpdating ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                Mark Sent
                              </button>
                            )}
                            {(invoice.status === "Sent" || invoice.status === "Overdue") &&
                              (payingId === invoice.invoice_id ? (
                                <div className="flex min-w-[200px] flex-col gap-1.5">
                                  <input
                                    autoFocus
                                    value={paymentRefDrafts[invoice.invoice_id] ?? ""}
                                    onChange={(e) =>
                                      setPaymentRefDrafts((prev) => ({
                                        ...prev,
                                        [invoice.invoice_id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Payment reference / txn ID"
                                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleConfirmPaid(invoice)}
                                      disabled={isUpdating}
                                      className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isUpdating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => cancelPaidPrompt(invoice.invoice_id)}
                                      disabled={isUpdating}
                                      className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openPaidPrompt(invoice)}
                                  className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Mark Paid
                                </button>
                              ))}
                            {invoice.status === "Paid" && <span className="text-xs text-slate-500">Paid</span>}
                            {err && <span className="max-w-[220px] text-xs text-red-400">{err}</span>}
                          </div>
                        </td>
                      </tr>
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
