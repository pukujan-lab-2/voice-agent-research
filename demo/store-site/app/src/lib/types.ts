export interface Card {
  id: number;
  slug: string;
  title: string;
  brand: string;
  price: number;
  max_price: number;
  list_price: number | null;
  deal: number;
  deal_ends: string | null;
  rating: number | null;
  review_count: number;
  question_count: number;
  image: string;
  in_stock: boolean | number;
  colors: string[];
  sizes: string[];
  category: string;
  cat_slug: string;
  dept: string;
  dept_slug: string;
}

export interface Variant {
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  stock: number;
  image: string;
}

export interface Spec {
  name: string;
  value: string;
}

export interface Review {
  id: number | string;
  stars: number;
  title: string;
  body: string;
  author: string;
  location: string;
  date: string;
  helpful: number;
  variant: string | null;
}

export interface Question {
  id: number | string;
  question: string;
  answer: string;
  answered_by: string;
  votes: number;
  date: string;
}

export interface Product extends Card {
  description: string;
  bullets: string[];
  specs: Spec[];
  variants: Variant[];
  dist: { stars: number; count: number }[];
  top_reviews: Review[];
  top_questions: Question[];
  related: Card[];
  tags?: string[];
  audience?: string | null;
  demoNote: string;
}

export interface FacetOption {
  label: string;
  value: string;
  count: number;
}

export interface PriceBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
}

export interface Facets {
  depts: FacetOption[];
  categories: FacetOption[];
  brands: FacetOption[];
  colors: FacetOption[];
  sizes: FacetOption[];
  ratings: FacetOption[];
  prices: PriceBucket[];
  deals: number | { count: number };
  inStock: number | { count: number };
  priceRange: [number, number];
}

export interface SearchResponse {
  total: number;
  page: number;
  per: number;
  pages: number;
  items: Card[];
  query: string;
  correctedFrom: string | null;
  relaxed: boolean;
  facets: Facets;
}

export interface SuggestResponse {
  categories: FacetOption[];
  products: { id: number; title: string; image: string }[];
}

export interface DepartmentCategory {
  kind: string;
  name: string;
  slug: string;
  count: number;
}

export interface Department {
  slug: string;
  name: string;
  categories: DepartmentCategory[];
}

export interface HomeResponse {
  deals: Card[];
  topRated: Card[];
  newArrivals: Card[];
  departments: { name: string; slug: string; image: string }[];
  counts: { products: number; variants: number; reviews: number };
}

export interface ShipOption {
  id: "standard" | "expedited" | "nextday" | "freight";
  label: string;
  days: string;
  price: number;
  cost: number;
  note: string;
}

export interface CartLine {
  sku: string;
  qty: number;
  color: string | null;
  size: string | null;
  price: number;
  stock: number;
  product_id: number;
  slug: string;
  title: string;
  brand: string;
  image: string;
  line_total: number;
}

export interface Cart {
  lines: CartLine[];
  count: number;
  subtotal: number;
  shipping: ShipOption[];
  freeShippingAt: number;
}

export interface ShippingResponse {
  options: ShipOption[];
  subtotal: number;
  taxRate: number;
}

export interface Address {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

export interface OrderLine {
  sku: string;
  product_id: number;
  title: string;
  color: string | null;
  size: string | null;
  price: number;
  qty: number;
  image: string;
}

export interface OrderStep {
  status: string;
  at: string | null;
  done: boolean;
}

export interface Order {
  id: string;
  created_at: string;
  status: string;
  address: Address;
  shipping: string;
  lines: OrderLine[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  steps: OrderStep[];
  estimate: string;
  carrier: string;
  trackingNumber: string;
  canCancel: boolean;
  canReturn: boolean;
}

export interface ReturnRecord {
  id: string;
  orderId: string;
  created_at: string;
  status: string;
  reason: string;
  method: "dropoff" | "mail";
  lines: { sku: string; qty: number; title?: string }[];
}

export interface OrderDetail extends Order {
  returns: ReturnRecord[];
}

export interface AccountResponse {
  name: string;
  orders: number;
  returns: number;
  wishlist: number;
  last_address: Address | null;
  note: string;
}

export interface HelpArticleSummary {
  slug: string;
  title: string;
  section: string;
  summary: string;
}

export interface HelpArticle extends HelpArticleSummary {
  body: { anchor: string; heading: string; paragraphs: string[] }[];
}

export interface HelpSearchResult {
  title: string;
  section: string;
  href: string;
  snippet: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  label: string;
}

export interface QuestionsResponse {
  questions: Question[];
  total: number;
  page: number;
  label: string;
}

export interface CompareResponse {
  products: Product[];
  specNames: string[];
}

export const productHref = (card: { id: number; slug: string }) =>
  `/p/${card.id}/${card.slug}`;
