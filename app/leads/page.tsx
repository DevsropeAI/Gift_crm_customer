"use client";

import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  FilePlus,
  Inbox,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import {
  Lead,
  LeadStatus,
  LeadTemperature,
  LeadUrgency,
  QualifyResult,
  QuoteItemInput,
  UserSummary,
  clearToken,
  createLead,
  createQuote,
  getLeads,
  getToken,
  getUsers,
  qualifyLead,
  updateLeadStatus,
  UnauthorizedError,
} from "@/lib/api";

const STATUSES: LeadStatus[] = ["New", "Qualified", "Quoted", "Approved"];
const SOURCES = ["Website", "Referral", "Social Media", "Email Campaign", "SEO"];

const STATUS_STYLES: Record<LeadStatus, string> = {
  New: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
  Qualified: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20",
  Quoted: "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20",
  Approved: "bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20",
};

const TEMP_STYLES: Record<LeadTemperature, string> = {
  Hot: "text-red-400",
  Warm: "text-amber-400",
  Cold: "text-blue-400",
};

const URGENCY_STYLES: Record<LeadUrgency, string> = {
  High: "bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20",
  Medium: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20",
  Low: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
};

const inputClass =
  "w-full rounded-lg border border-transparent bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20";

const TABLE_COLUMNS = [
  "Company",
  "Contact",
  "Email",
  "Phone",
  "Assigned Rep",
  "Source",
  "Product",
  "Value",
  "Status",
  "Temperature",
  "AI Qualification",
  "Quote",
  "Customer",
];

const emptyQuoteItem = { product_name: "", quantity: "1", unit_price: "", is_addon: false, is_upsell: false };

function navLinkClass(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
  }`;
}

const emptyForm = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  lead_source: "",
  requested_product: "",
  expected_order_value: "",
  assigned_rep_id: "",
};

async function linkCustomerToLead(
  leadId: number,
  email: string
): Promise<{ lead_id: number; customer_user_id: number }> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  const token = getToken();
  const res = await fetch(`${API_BASE}/leads/${leadId}/link-customer`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ customer_email: email }),
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

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
        <Inbox className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-white">No leads yet</p>
      <p className="mt-1 text-sm text-slate-400">Get started by adding your first lead.</p>
      <button
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30"
      >
        <Plus className="h-4 w-4" /> Add Lead
      </button>
    </div>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [qualifyingId, setQualifyingId] = useState<number | null>(null);
  const [qualifyErrors, setQualifyErrors] = useState<Record<number, string>>({});
  const [qualifyResults, setQualifyResults] = useState<Record<number, QualifyResult>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [quoteModalLead, setQuoteModalLead] = useState<Lead | null>(null);
  const [quoteItems, setQuoteItems] = useState([{ ...emptyQuoteItem }]);
  const [quotePaymentTerms, setQuotePaymentTerms] = useState("");
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [linkModalLead, setLinkModalLead] = useState<Lead | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [reps, setReps] = useState<UserSummary[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    loadLeads();
    loadReps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeads();
      setLeads(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReps() {
    try {
      const data = await getUsers("Sales");
      setReps(data);
    } catch {
      // Non-critical: dropdown/column simply show no reps if this fails.
    }
  }

  function repName(repId: number | null): string {
    if (!repId) return "—";
    return reps.find((r) => r.user_id === repId)?.full_name ?? "—";
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  function openModal() {
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleCreateLead(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createLead({
        company_name: form.company_name.trim(),
        contact_person: form.contact_person.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        lead_source: form.lead_source || null,
        requested_product: form.requested_product.trim() || null,
        expected_order_value: form.expected_order_value ? Number(form.expected_order_value) : null,
        assigned_rep_id: form.assigned_rep_id ? Number(form.assigned_rep_id) : null,
      });
      setModalOpen(false);
      await loadLeads();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setFormError(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQualify(leadId: number) {
    setQualifyingId(leadId);
    setQualifyErrors((prev) => ({ ...prev, [leadId]: "" }));
    try {
      const result = await qualifyLead(leadId);
      setQualifyResults((prev) => ({ ...prev, [leadId]: result }));
      setExpandedId(leadId);
      setLeads((prev) =>
        prev ? prev.map((l) => (l.lead_id === leadId ? { ...l, temperature: result.temperature } : l)) : prev
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setQualifyErrors((prev) => ({
        ...prev,
        [leadId]: err instanceof Error ? err.message : "Failed to qualify lead.",
      }));
    } finally {
      setQualifyingId(null);
    }
  }

  function openQuoteModal(lead: Lead) {
    setQuoteModalLead(lead);
    setQuoteItems([{ ...emptyQuoteItem }]);
    setQuotePaymentTerms("");
    setQuoteError(null);
  }

  function closeQuoteModal() {
    setQuoteModalLead(null);
  }

  function addQuoteItemRow() {
    setQuoteItems((prev) => [...prev, { ...emptyQuoteItem }]);
  }

  function removeQuoteItemRow(index: number) {
    setQuoteItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function updateQuoteItem(index: number, field: keyof typeof emptyQuoteItem, value: string | boolean) {
    setQuoteItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  const quoteTotalPrice = quoteItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

  async function handleSaveQuote(e: FormEvent) {
    e.preventDefault();
    if (!quoteModalLead) return;
    setQuoteError(null);
    setQuoteSubmitting(true);
    try {
      const items: QuoteItemInput[] = quoteItems.map((item) => ({
        product_name: item.product_name.trim(),
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        is_addon: item.is_addon,
        is_upsell: item.is_upsell,
      }));
      await createQuote(quoteModalLead.lead_id, items, quotePaymentTerms.trim() || null);
      setQuoteModalLead(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setQuoteError(err instanceof Error ? err.message : "Failed to create quote.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function handleStatusChange(leadId: number, status: LeadStatus) {
    setUpdatingId(leadId);
    try {
      await updateLeadStatus(leadId, status);
      await loadLeads();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openLinkModal(lead: Lead) {
    setLinkModalLead(lead);
    setLinkEmail("");
    setLinkError(null);
  }

  function closeLinkModal() {
    setLinkModalLead(null);
  }

  async function handleLinkCustomer(e: FormEvent) {
    e.preventDefault();
    if (!linkModalLead) return;
    const email = linkEmail.trim();
    if (!email) {
      setLinkError("Please enter a customer email.");
      return;
    }
    setLinkError(null);
    setLinkSubmitting(true);
    try {
      const result = await linkCustomerToLead(linkModalLead.lead_id, email);
      setLeads((prev) =>
        prev
          ? prev.map((l) => (l.lead_id === result.lead_id ? { ...l, customer_user_id: result.customer_user_id } : l))
          : prev
      );
      setLinkModalLead(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setLinkError(err instanceof Error ? err.message : "Failed to link customer.");
    } finally {
      setLinkSubmitting(false);
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
        <div className="animate-fade-in-up mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Leads</h1>
            <p className="mt-1 text-sm text-slate-400">Track and manage incoming leads for your team.</p>
          </div>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
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
            <table className="w-full min-w-[1450px] text-left text-sm">
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
                {!loading && leads && leads.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length}>
                      <EmptyState onAdd={openModal} />
                    </td>
                  </tr>
                )}
                {!loading &&
                  leads &&
                  leads.map((lead, idx) => {
                    const qualifyResult = qualifyResults[lead.lead_id];
                    const qualifyError = qualifyErrors[lead.lead_id];
                    const isQualifying = qualifyingId === lead.lead_id;
                    const isExpanded = expandedId === lead.lead_id;

                    return (
                      <Fragment key={lead.lead_id}>
                        <tr
                          className={`border-t border-slate-800/60 transition-colors hover:bg-indigo-500/5 ${
                            idx % 2 === 1 ? "bg-white/[0.02]" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 font-medium text-white">{lead.company_name}</td>
                          <td className="px-4 py-3.5 text-slate-300">{lead.contact_person || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-300">{lead.email || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-300">{lead.phone || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-300">{repName(lead.assigned_rep_id)}</td>
                          <td className="px-4 py-3.5 text-slate-300">{lead.lead_source || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-300">{lead.requested_product || "—"}</td>
                          <td className="px-4 py-3.5 text-slate-300">{formatNumber(lead.expected_order_value)}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={lead.status} />
                              <select
                                value={lead.status}
                                disabled={updatingId === lead.lead_id}
                                onChange={(e) => handleStatusChange(lead.lead_id, e.target.value as LeadStatus)}
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
                          <td className="px-4 py-3.5">
                            {lead.temperature ? (
                              <span className={`font-medium ${TEMP_STYLES[lead.temperature]}`}>{lead.temperature}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Not qualified yet
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQualify(lead.lead_id)}
                                disabled={isQualifying}
                                className={
                                  lead.temperature
                                    ? "inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    : "inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                }
                              >
                                {isQualifying ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {lead.temperature ? "Re-qualify" : "Qualify"}
                              </button>
                              {qualifyResult && (
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : lead.lead_id)}
                                  className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                                  aria-label="Toggle AI reasoning"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                            {qualifyError && <p className="mt-1 max-w-[220px] text-xs text-red-400">{qualifyError}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            {lead.status !== "New" && (
                              <button
                                onClick={() => openQuoteModal(lead)}
                                className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30"
                              >
                                <FilePlus className="h-3 w-3" /> Create Quote
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {lead.customer_user_id != null ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-500/20">
                                <UserCheck className="h-3 w-3" /> Linked
                              </span>
                            ) : (
                              <button
                                onClick={() => openLinkModal(lead)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
                              >
                                <UserPlus className="h-3 w-3" /> Link Customer
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && qualifyResult && (
                          <tr className="border-t border-slate-800/60 bg-slate-800/20">
                            <td colSpan={TABLE_COLUMNS.length} className="px-4 py-4">
                              <div className="flex flex-wrap items-start gap-6 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Urgency
                                  </p>
                                  <span
                                    className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${URGENCY_STYLES[qualifyResult.urgency]}`}
                                  >
                                    {qualifyResult.urgency}
                                  </span>
                                </div>
                                <div className="max-w-sm flex-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Value assessment
                                  </p>
                                  <p className="mt-1 text-sm text-slate-300">{qualifyResult.value_assessment}</p>
                                </div>
                                <div className="max-w-sm flex-1">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Next action
                                  </p>
                                  <p className="mt-1 text-sm text-slate-300">{qualifyResult.next_action}</p>
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Lead</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Company Name" required>
                  <input
                    required
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Contact Person" required>
                  <input
                    required
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Lead Source">
                  <select
                    value={form.lead_source}
                    onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Requested Product / Campaign">
                  <input
                    value={form.requested_product}
                    onChange={(e) => setForm({ ...form, requested_product: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Expected Order Value">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.expected_order_value}
                    onChange={(e) => setForm({ ...form, expected_order_value: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Assigned Sales Rep">
                  <select
                    value={form.assigned_rep_id}
                    onChange={(e) => setForm({ ...form, assigned_rep_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Unassigned</option>
                    {reps.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quoteModalLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuoteModal();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Create Quote</h2>
              <button
                onClick={closeQuoteModal}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              For <span className="font-medium text-slate-200">{quoteModalLead.company_name}</span>
            </p>

            {quoteError && (
              <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
                {quoteError}
              </div>
            )}

            <form onSubmit={handleSaveQuote} className="space-y-5">
              <div className="space-y-3">
                <span className="block text-sm font-medium text-slate-300">Line Items</span>
                {quoteItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-white/[0.02] p-3"
                  >
                    <input
                      placeholder="Product name"
                      value={item.product_name}
                      onChange={(e) => updateQuoteItem(index, "product_name", e.target.value)}
                      className={`${inputClass} min-w-[160px] flex-1`}
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateQuoteItem(index, "quantity", e.target.value)}
                      className={`${inputClass} w-20`}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price"
                      value={item.unit_price}
                      onChange={(e) => updateQuoteItem(index, "unit_price", e.target.value)}
                      className={`${inputClass} w-28`}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={item.is_addon}
                        onChange={(e) => updateQuoteItem(index, "is_addon", e.target.checked)}
                        className="accent-indigo-500"
                      />
                      Add-on
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={item.is_upsell}
                        onChange={(e) => updateQuoteItem(index, "is_upsell", e.target.checked)}
                        className="accent-indigo-500"
                      />
                      Upsell
                    </label>
                    <button
                      type="button"
                      onClick={() => removeQuoteItemRow(index)}
                      disabled={quoteItems.length === 1}
                      className="ml-auto rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Remove item"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addQuoteItemRow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>

              <Field label="Payment Terms">
                <input
                  value={quotePaymentTerms}
                  onChange={(e) => setQuotePaymentTerms(e.target.value)}
                  placeholder="e.g. 50% deposit, balance on delivery"
                  className={inputClass}
                />
              </Field>

              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3">
                <span className="text-sm font-medium text-slate-300">Total Price</span>
                <span className="text-lg font-semibold text-white">{formatNumber(quoteTotalPrice)}</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quoteSubmitting}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {quoteSubmitting ? "Saving…" : "Save as Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkModalLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLinkModal();
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/50">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Link Customer</h2>
              <button
                onClick={closeLinkModal}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-6 text-sm text-slate-400">
              For <span className="font-medium text-slate-200">{linkModalLead.company_name}</span>
            </p>

            {linkError && (
              <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-300">
                {linkError}
              </div>
            )}

            <form onSubmit={handleLinkCustomer} className="space-y-4">
              <Field label="Customer Email" required>
                <input
                  type="email"
                  required
                  autoFocus
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className={inputClass}
                />
              </Field>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeLinkModal}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkSubmitting}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {linkSubmitting ? "Linking…" : "Link Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
