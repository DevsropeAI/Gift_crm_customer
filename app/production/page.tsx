"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronUp, Loader2, LogOut, Send, Sparkles, UploadCloud } from "lucide-react";
import {
  OrderSummary,
  PRODUCTION_STAGES,
  ProductionStage,
  Proof,
  clearToken,
  getOrderProofs,
  getOrders,
  getRoleFromToken,
  getToken,
  sendProofToCustomer,
  updateOrderStage,
  uploadProof,
  UnauthorizedError,
} from "@/lib/api";

const STAGE_STYLES: Record<ProductionStage, string> = {
  Proofing: "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
  Production: "bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20",
  "Quality Check": "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20",
  Packaging: "bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/20",
  Shipping: "bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-500/20",
  Completed: "bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20",
};

const PROOF_STATUS_STYLES: Record<string, string> = {
  Uploaded: "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20",
  "Sent to Customer": "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20",
  Approved: "bg-green-500/10 text-green-300 ring-1 ring-inset ring-green-500/20",
  "Revision Requested": "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20",
};

const TABLE_COLUMNS = ["Company", "Stage", "Created", "Actions"];

const inputClass =
  "w-full rounded-lg border border-transparent bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/20";

function StageBadge({ stage }: { stage: ProductionStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STAGE_STYLES[stage]}`}>
      {stage}
    </span>
  );
}

function ProofStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        PROOF_STATUS_STYLES[status] ?? "bg-slate-500/10 text-slate-300 ring-1 ring-inset ring-slate-500/20"
      }`}
    >
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

export default function ProductionPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageUpdatingId, setStageUpdatingId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [proofsByOrder, setProofsByOrder] = useState<Record<number, Proof[]>>({});
  const [proofsLoadingId, setProofsLoadingId] = useState<number | null>(null);
  const [uploadDrafts, setUploadDrafts] = useState<Record<number, string>>({});
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const [sendingProofId, setSendingProofId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRoleFromToken(token);
    if (role !== "Production" && role !== "Admin") {
      setForbidden(true);
      setAuthChecked(true);
      return;
    }
    setAuthChecked(true);
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  async function handleToggleExpand(orderId: number) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (proofsByOrder[orderId]) return;

    setProofsLoadingId(orderId);
    try {
      const proofs = await getOrderProofs(orderId);
      setProofsByOrder((prev) => ({ ...prev, [orderId]: proofs }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : "Failed to load proofs.",
      }));
    } finally {
      setProofsLoadingId(null);
    }
  }

  async function handleMoveStage(order: OrderSummary) {
    const currentIndex = PRODUCTION_STAGES.indexOf(order.production_stage);
    if (currentIndex === -1 || currentIndex === PRODUCTION_STAGES.length - 1) return;
    const nextStage = PRODUCTION_STAGES[currentIndex + 1];

    setStageUpdatingId(order.order_id);
    setRowError((prev) => ({ ...prev, [order.order_id]: "" }));
    try {
      const updated = await updateOrderStage(order.order_id, nextStage);
      setOrders((prev) =>
        prev
          ? prev.map((o) => (o.order_id === order.order_id ? { ...o, production_stage: updated.production_stage } : o))
          : prev
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [order.order_id]: err instanceof Error ? err.message : "Failed to update stage.",
      }));
    } finally {
      setStageUpdatingId(null);
    }
  }

  async function handleUploadProof(orderId: number) {
    const fileUrl = (uploadDrafts[orderId] ?? "").trim();
    if (!fileUrl) {
      setRowError((prev) => ({ ...prev, [orderId]: "Enter a file URL/path before uploading." }));
      return;
    }
    setUploadingOrderId(orderId);
    setRowError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const proof = await uploadProof(orderId, fileUrl);
      setProofsByOrder((prev) => ({ ...prev, [orderId]: [...(prev[orderId] ?? []), proof] }));
      setUploadDrafts((prev) => ({ ...prev, [orderId]: "" }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : "Failed to upload proof.",
      }));
    } finally {
      setUploadingOrderId(null);
    }
  }

  async function handleSendToCustomer(proofId: number, orderId: number) {
    setSendingProofId(proofId);
    setRowError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const updated = await sendProofToCustomer(proofId);
      setProofsByOrder((prev) => ({
        ...prev,
        [orderId]: (prev[orderId] ?? []).map((p) => (p.proof_id === proofId ? updated : p)),
      }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        router.replace("/login");
        return;
      }
      setRowError((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : "Failed to send proof to customer.",
      }));
    } finally {
      setSendingProofId(null);
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
          <p className="mt-2 text-sm text-red-300">
            This page is only available to Production and Admin accounts.
          </p>
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
        <div className="animate-fade-in-up mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Production Panel</h1>
          <p className="mt-1 text-sm text-slate-400">Track orders through production and manage proofs.</p>
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
            <table className="w-full min-w-[800px] text-left text-sm">
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
                {!loading && orders && orders.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="px-4 py-12 text-center text-sm text-slate-500">
                      No orders yet. Orders appear here once a Sales rep creates one from an approved quote.
                    </td>
                  </tr>
                )}
                {!loading &&
                  orders &&
                  orders.map((order, idx) => {
                    const isExpanded = expandedOrderId === order.order_id;
                    const isLast = order.production_stage === "Completed";
                    const nextStage = isLast
                      ? null
                      : PRODUCTION_STAGES[PRODUCTION_STAGES.indexOf(order.production_stage) + 1];
                    const proofs = proofsByOrder[order.order_id];
                    const err = rowError[order.order_id];

                    return (
                      <Fragment key={order.order_id}>
                        <tr
                          className={`border-t border-slate-800/60 transition-colors hover:bg-indigo-500/5 ${
                            idx % 2 === 1 ? "bg-white/[0.02]" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 font-medium text-white">
                            <button
                              onClick={() => handleToggleExpand(order.order_id)}
                              className="flex items-center gap-1.5 hover:text-indigo-300"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              {order.company_name}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <StageBadge stage={order.production_stage} />
                          </td>
                          <td className="px-4 py-3.5 text-slate-300">
                            {new Date(order.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3.5">
                            {nextStage ? (
                              <button
                                onClick={() => handleMoveStage(order)}
                                disabled={stageUpdatingId === order.order_id}
                                className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm shadow-indigo-950/50 transition hover:shadow-md hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {stageUpdatingId === order.order_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ArrowRight className="h-3 w-3" />
                                )}
                                Move to {nextStage}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">Completed</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-slate-800/60 bg-slate-800/20">
                            <td colSpan={TABLE_COLUMNS.length} className="px-4 py-4">
                              <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Proofs
                                </p>

                                {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

                                {proofsLoadingId === order.order_id && (
                                  <p className="text-sm text-slate-500">Loading proofs…</p>
                                )}

                                {proofs && proofs.length === 0 && (
                                  <p className="mb-4 text-sm text-slate-500">No proofs uploaded yet.</p>
                                )}

                                {proofs && proofs.length > 0 && (
                                  <div className="mb-4 space-y-3">
                                    {proofs.map((proof) => (
                                      <div
                                        key={proof.proof_id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                                      >
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-200">
                                              v{proof.version}
                                            </span>
                                            <ProofStatusBadge status={proof.status} />
                                          </div>
                                          {proof.file_url && (
                                            <p className="mt-1 text-xs text-slate-400">{proof.file_url}</p>
                                          )}
                                          {proof.customer_feedback && (
                                            <p className="mt-1 max-w-md text-xs text-amber-300">
                                              Customer feedback: {proof.customer_feedback}
                                            </p>
                                          )}
                                        </div>
                                        {proof.status === "Uploaded" && (
                                          <button
                                            onClick={() => handleSendToCustomer(proof.proof_id, order.order_id)}
                                            disabled={sendingProofId === proof.proof_id}
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {sendingProofId === proof.proof_id ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Send className="h-3 w-3" />
                                            )}
                                            Send to Customer
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    value={uploadDrafts[order.order_id] ?? ""}
                                    onChange={(e) =>
                                      setUploadDrafts((prev) => ({ ...prev, [order.order_id]: e.target.value }))
                                    }
                                    placeholder="File URL or path for new proof version"
                                    className={`${inputClass} min-w-[240px] flex-1`}
                                  />
                                  <button
                                    onClick={() => handleUploadProof(order.order_id)}
                                    disabled={uploadingOrderId === order.order_id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {uploadingOrderId === order.order_id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UploadCloud className="h-3.5 w-3.5" />
                                    )}
                                    Upload Proof
                                  </button>
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
