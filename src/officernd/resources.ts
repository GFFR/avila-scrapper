/**
 * Registry of OfficeRnD Flex v2 collections to back up.
 *
 * - `name`     stable local identifier (used as SQLite table + JSON filename)
 * - `path`     API path relative to the org base URL
 * - `incremental` whether daily syncs may use a `modifiedSince` filter
 * - `incrementalField` timestamp field to filter on (default "modifiedAt")
 *
 * Small / mostly-static collections are marked non-incremental: they are cheap
 * to pull in full every run, which sidesteps any uncertainty about whether their
 * timestamp fields are indexed/filterable.
 *
 * NOTE: exact filterability of `modifiedAt` per collection is not guaranteed by
 * OfficeRnD docs. The sync engine falls back to a full pull automatically if an
 * incremental filter is rejected by the API.
 */
export interface ResourceDef {
  name: string;
  path: string;
  incremental: boolean;
  incrementalField?: string;
}

export const RESOURCES: ResourceDef[] = [
  // Community / CRM
  { name: "members", path: "/members", incremental: true },
  { name: "companies", path: "/companies", incremental: true },
  { name: "checkins", path: "/checkins", incremental: true },
  { name: "opportunities", path: "/opportunities", incremental: true },
  { name: "opportunityStatuses", path: "/opportunityStatuses", incremental: false },
  { name: "visitors", path: "/visitors", incremental: true },
  { name: "visits", path: "/visits", incremental: true },

  // Membership & contracts
  { name: "memberships", path: "/memberships", incremental: true },
  { name: "plans", path: "/plans", incremental: false },
  { name: "contracts", path: "/contracts", incremental: true },
  { name: "fees", path: "/fees", incremental: true },
  { name: "assignments", path: "/assignments", incremental: true },

  // Billing & financial
  { name: "charges", path: "/charges", incremental: true },
  { name: "payments", path: "/payments", incremental: true },
  { name: "paymentDetails", path: "/paymentDetails", incremental: true },
  { name: "credits", path: "/credits", incremental: true },
  { name: "passes", path: "/passes", incremental: true },
  { name: "taxRates", path: "/taxRates", incremental: false },
  { name: "revenueAccounts", path: "/revenueAccounts", incremental: false },

  // Spaces & resources
  { name: "resources", path: "/resources", incremental: true },
  { name: "resourceTypes", path: "/resourceTypes", incremental: false },
  { name: "resourceRates", path: "/resourceRates", incremental: false },
  { name: "amenities", path: "/amenities", incremental: false },
  { name: "locations", path: "/locations", incremental: false },
  { name: "floors", path: "/floors", incremental: false },
  { name: "bookings", path: "/bookings", incremental: true },

  // Engagement / support
  { name: "events", path: "/events", incremental: true },
  { name: "posts", path: "/posts", incremental: true },
  { name: "tickets", path: "/tickets", incremental: true },
  { name: "benefits", path: "/benefits", incremental: false },

  // Settings / meta
  { name: "customProperties", path: "/customProperties", incremental: false },
  { name: "webhooks", path: "/webhooks", incremental: false },
];
