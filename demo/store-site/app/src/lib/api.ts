import { shopperId } from "./shopper";
import type {
  AccountResponse,
  Card,
  Cart,
  CompareResponse,
  Department,
  HelpArticle,
  HelpArticleSummary,
  HelpSearchResult,
  HomeResponse,
  Order,
  OrderDetail,
  Product,
  QuestionsResponse,
  ReturnRecord,
  ReviewsResponse,
  SearchResponse,
  ShippingResponse,
  SuggestResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  const { query, headers, ...rest } = init;
  const url = withQuery(path, query);
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        Accept: "application/json",
        "X-Shopper": shopperId(),
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(
      "We couldn't reach Brambleway. Check your connection and try again.",
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    let message = `Something went wrong (${response.status}).`;
    try {
      payload = await response.json();
      const asRecord = payload as { error?: string } | null;
      if (asRecord && typeof asRecord.error === "string") {
        message = asRecord.error;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  departments: (signal?: AbortSignal) =>
    request<Department[]>("/api/shop/departments", { signal }),

  home: (signal?: AbortSignal) =>
    request<HomeResponse>("/api/shop/home", { signal }),

  search: (query: Query, signal?: AbortSignal) =>
    request<SearchResponse>("/api/shop/search", { query, signal }),

  suggest: (q: string, signal?: AbortSignal) =>
    request<SuggestResponse>("/api/shop/suggest", { query: { q }, signal }),

  product: (id: string | number, signal?: AbortSignal) =>
    request<Product>(`/api/shop/product/${id}`, { signal }),

  reviews: (
    id: string | number,
    query: { page?: number; sort?: string; stars?: number | string },
    signal?: AbortSignal,
  ) =>
    request<ReviewsResponse>(`/api/shop/product/${id}/reviews`, {
      query,
      signal,
    }),

  questions: (id: string | number, query: { page?: number }, signal?: AbortSignal) =>
    request<QuestionsResponse>(`/api/shop/product/${id}/questions`, {
      query,
      signal,
    }),

  compare: (ids: string, signal?: AbortSignal) =>
    request<CompareResponse>("/api/shop/compare", { query: { ids }, signal }),

  cart: (signal?: AbortSignal) =>
    request<Cart>("/api/shop/cart", { signal }),

  addToCart: (sku: string, qty: number, mode?: "set") =>
    request<Cart>("/api/shop/cart", {
      method: "POST",
      body: JSON.stringify({ sku, qty, ...(mode ? { mode } : {}) }),
    }),

  removeFromCart: (sku: string) =>
    request<Cart>(withQuery("/api/shop/cart", { sku }), { method: "DELETE" }),

  shipping: (signal?: AbortSignal) =>
    request<ShippingResponse>("/api/shop/shipping", { signal }),

  wishlist: (signal?: AbortSignal) =>
    request<{ items: Card[] }>("/api/shop/wishlist", { signal }),

  addToWishlist: (productId: number | string) =>
    request<unknown>("/api/shop/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  removeFromWishlist: (productId: number | string) =>
    request<unknown>(withQuery("/api/shop/wishlist", { productId }), {
      method: "DELETE",
    }),

  orders: (signal?: AbortSignal) =>
    request<{ orders: Order[] }>("/api/shop/orders", { signal }),

  order: (id: string, signal?: AbortSignal) =>
    request<OrderDetail>(`/api/shop/orders/${id}`, { signal }),

  placeOrder: (body: {
    address: Record<string, string>;
    shipping: string;
    giftWrap: boolean;
  }) =>
    request<Order>("/api/shop/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cancelOrder: (id: string) =>
    request<Order>(`/api/shop/orders/${id}/cancel`, { method: "POST" }),

  returns: (signal?: AbortSignal) =>
    request<{ returns: ReturnRecord[] }>("/api/shop/returns", { signal }),

  startReturn: (body: {
    orderId: string;
    lines: { sku: string; qty: number }[];
    reason: string;
    method: "dropoff" | "mail";
  }) =>
    request<{ return?: ReturnRecord } & Record<string, unknown>>(
      "/api/shop/returns",
      { method: "POST", body: JSON.stringify(body) },
    ),

  account: (signal?: AbortSignal) =>
    request<AccountResponse>("/api/shop/account", { signal }),

  help: (signal?: AbortSignal) =>
    request<{ articles: HelpArticleSummary[] }>("/api/shop/help", { signal }),

  helpArticle: (slug: string, signal?: AbortSignal) =>
    request<HelpArticle>(`/api/shop/help/${slug}`, { signal }),

  helpSearch: (q: string, signal?: AbortSignal) =>
    request<{ results: HelpSearchResult[] }>("/api/shop/help-search", {
      query: { q },
      signal,
    }),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function isAbort(error: unknown): boolean {
  return (error as Error | null)?.name === "AbortError";
}
