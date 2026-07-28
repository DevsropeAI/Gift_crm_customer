const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "access_token";

export type LeadStatus = "New" | "Qualified" | "Quoted" | "Approved";
export type LeadTemperature = "Hot" | "Warm" | "Cold";

export interface Lead {
  lead_id: number;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  requested_product: string | null;
  expected_order_value: number | null;
  assigned_rep_id: number | null;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  created_at: string;
  updated_at: string;
  customer_user_id: number | null;
}

export interface CreateLeadInput {
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  lead_source?: string | null;
  requested_product?: string | null;
  expected_order_value?: number | null;
  assigned_rep_id?: number | null;
  temperature?: LeadTemperature | null;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Session expired. Please log in again.") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

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
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await request<{ access_token: string; token_type: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export async function getLeads(status?: LeadStatus): Promise<Lead[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<Lead[]>(`/leads${query}`);
}

export async function getLead(leadId: number): Promise<Lead> {
  return request<Lead>(`/leads/${leadId}`);
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  return request<Lead>("/leads", {
    method: "POST",
    body: JSON.stringify({ status: "New", ...input }),
  });
}

export async function updateLeadStatus(leadId: number, status: LeadStatus): Promise<Lead> {
  return request<Lead>(`/leads/${leadId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export type LeadUrgency = "High" | "Medium" | "Low";

export interface QualifyResult {
  temperature: LeadTemperature;
  urgency: LeadUrgency;
  value_assessment: string;
  next_action: string;
}

export async function qualifyLead(leadId: number): Promise<QualifyResult> {
  return request<QualifyResult>(`/leads/${leadId}/qualify`, {
    method: "POST",
  });
}

export type QuoteStatus = "Draft" | "Sent" | "Approved";

export interface QuoteItemInput {
  product_name: string;
  quantity: number;
  unit_price: number;
  is_addon?: boolean;
  is_upsell?: boolean;
}

export interface QuoteItem {
  item_id: number;
  quote_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  is_addon: boolean;
  is_upsell: boolean;
}

export interface QuoteSummary {
  quote_id: number;
  lead_id: number;
  version: number;
  status: QuoteStatus;
  created_at: string;
  customer_feedback: string | null;
}

export interface QuoteDetail extends QuoteSummary {
  payment_terms: string | null;
  updated_at: string;
  items: QuoteItem[];
  total_price: number;
}

export async function createQuote(
  leadId: number,
  items: QuoteItemInput[],
  paymentTerms?: string | null
): Promise<QuoteDetail> {
  return request<QuoteDetail>("/quotes", {
    method: "POST",
    body: JSON.stringify({ lead_id: leadId, payment_terms: paymentTerms ?? null, items }),
  });
}

export async function getQuotes(): Promise<QuoteSummary[]> {
  return request<QuoteSummary[]>("/quotes");
}

export async function getQuote(quoteId: number): Promise<QuoteDetail> {
  return request<QuoteDetail>(`/quotes/${quoteId}`);
}

export async function updateQuoteStatus(quoteId: number, status: QuoteStatus): Promise<QuoteDetail> {
  return request<QuoteDetail>(`/quotes/${quoteId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getLeadQuotes(leadId: number): Promise<QuoteSummary[]> {
  return request<QuoteSummary[]>(`/leads/${leadId}/quotes`);
}

export interface CustomerQuoteItem {
  item_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  is_addon: boolean;
  is_upsell: boolean;
}

export interface CustomerQuote {
  quote_id: number;
  lead_id: number;
  company_name: string;
  version: number;
  status: QuoteStatus;
  payment_terms: string | null;
  customer_feedback: string | null;
  created_at: string;
  updated_at: string;
  items: CustomerQuoteItem[];
  total_price: number;
}

export async function getMyQuotes(): Promise<CustomerQuote[]> {
  return request<CustomerQuote[]>("/my/quotes");
}

export async function approveMyQuote(quoteId: number): Promise<CustomerQuote> {
  return request<CustomerQuote>(`/my/quotes/${quoteId}/approve`, {
    method: "PATCH",
  });
}

export async function requestQuoteChanges(quoteId: number, comment: string): Promise<CustomerQuote> {
  return request<CustomerQuote>(`/my/quotes/${quoteId}/request-changes`, {
    method: "PATCH",
    body: JSON.stringify({ comment }),
  });
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

export function getRoleFromToken(token: string): string | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const payload = JSON.parse(base64UrlDecode(payloadSegment));
    return typeof payload.role_name === "string" ? payload.role_name : null;
  } catch {
    return null;
  }
}

export type ProductionStage = "Proofing" | "Production" | "Quality Check" | "Packaging" | "Shipping" | "Completed";

export const PRODUCTION_STAGES: ProductionStage[] = [
  "Proofing",
  "Production",
  "Quality Check",
  "Packaging",
  "Shipping",
  "Completed",
];

export interface OrderSummary {
  order_id: number;
  quote_id: number;
  lead_id: number;
  company_name: string;
  production_stage: ProductionStage;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  updated_at: string;
}

export async function getOrders(): Promise<OrderSummary[]> {
  return request<OrderSummary[]>("/orders");
}

export async function getOrder(orderId: number): Promise<OrderDetail> {
  return request<OrderDetail>(`/orders/${orderId}`);
}

export async function updateOrderStage(orderId: number, stage: ProductionStage): Promise<OrderDetail> {
  return request<OrderDetail>(`/orders/${orderId}/stage`, {
    method: "PATCH",
    body: JSON.stringify({ production_stage: stage }),
  });
}

export type ProofStatus = "Uploaded" | "Sent to Customer" | "Approved" | "Revision Requested";

export interface Proof {
  proof_id: number;
  order_id: number;
  version: number;
  status: ProofStatus;
  file_url: string | null;
  customer_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrderProofs(orderId: number): Promise<Proof[]> {
  return request<Proof[]>(`/orders/${orderId}/proofs`);
}

export async function uploadProof(orderId: number, fileUrl: string): Promise<Proof> {
  return request<Proof>(`/orders/${orderId}/proofs`, {
    method: "POST",
    body: JSON.stringify({ file_url: fileUrl }),
  });
}

export async function sendProofToCustomer(proofId: number): Promise<Proof> {
  return request<Proof>(`/proofs/${proofId}/status`, {
    method: "PATCH",
  });
}

export interface CustomerProof {
  proof_id: number;
  order_id: number;
  lead_id: number;
  company_name: string;
  version: number;
  status: ProofStatus;
  file_url: string | null;
  customer_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMyProofs(): Promise<CustomerProof[]> {
  return request<CustomerProof[]>("/my/proofs");
}

export async function approveMyProof(proofId: number): Promise<CustomerProof> {
  return request<CustomerProof>(`/my/proofs/${proofId}/approve`, {
    method: "PATCH",
  });
}

export async function requestProofRevision(proofId: number, comment: string): Promise<CustomerProof> {
  return request<CustomerProof>(`/my/proofs/${proofId}/request-revision`, {
    method: "PATCH",
    body: JSON.stringify({ comment }),
  });
}
