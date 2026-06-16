/**
 * Registry of OfficeRnD Flex v2 collections to back up.
 *
 * - `name`     stable local identifier (used as Postgres table + JSON filename)
 * - `path`     API path relative to the org base URL
 * - `scope`    OAuth2 scope required to read it (flex.<module>.<resource>.read)
 * - `available` whether our API application has been granted `scope`. The token
 *               request fails entirely if it includes an ungranted scope, so
 *               un-granted resources are skipped (not synced) until enabled in
 *               OfficeRnD > Developer Tools. Defaults to true.
 * - `incremental` whether daily syncs may use a `modifiedSince` filter
 * - `incrementalField` timestamp field to filter on (default "modifiedAt")
 *
 * Scope strings were verified against the live token endpoint. Set a resource's
 * `available: false` when its scope is not yet granted to the API app, so the
 * token request doesn't fail on an ungranted scope.
 *
 * NOTE: filterability of `modifiedAt` per collection isn't guaranteed by the
 * docs; the sync engine falls back to a full pull if a filter is rejected.
 */
export interface ResourceDef {
  name: string;
  path: string;
  scope: string;
  available?: boolean;
  incremental: boolean;
  incrementalField?: string;
  /**
   * Some endpoints can't be bulk-listed and require a parent filter. Fan-out
   * iterates the parent resource's ids, querying this collection once per id.
   * `parent` is another resource name (synced first); `param` is the query
   * parameter that takes the parent id. Fan-out collections are pulled in full.
   */
  fanOut?: { parent: string; param: string };
}

export const RESOURCES: ResourceDef[] = [
  // Community / CRM
  { name: "members", path: "/members", scope: "flex.community.members.read", incremental: true },
  { name: "companies", path: "/companies", scope: "flex.community.companies.read", incremental: true },
  // Checkins are immutable, append-mostly events with no modifiedAt; filter on `start`.
  { name: "checkins", path: "/checkins", scope: "flex.community.checkins.read", incremental: true, incrementalField: "start" },
  { name: "opportunities", path: "/opportunities", scope: "flex.community.opportunities.read", incremental: true },
  { name: "opportunityStatuses", path: "/opportunity-statuses", scope: "flex.community.opportunityStatuses.read", incremental: false },
  // visitors/visits expose no timestamp at all, so they can't be filtered incrementally (and are tiny).
  { name: "visitors", path: "/visitors", scope: "flex.community.visitors.read", incremental: false },
  { name: "visits", path: "/visits", scope: "flex.community.visits.read", incremental: false },

  // Membership & contracts
  { name: "memberships", path: "/memberships", scope: "flex.community.memberships.read", incremental: true },
  { name: "plans", path: "/plans", scope: "flex.billing.plans.read", incremental: false },
  { name: "contracts", path: "/contracts", scope: "flex.community.contracts.read", incremental: true },
  { name: "fees", path: "/fees", scope: "flex.community.fees.read", incremental: true },
  // Can't bulk-list; fan out over resources (fewer than memberships).
  { name: "assignments", path: "/assignments", scope: "flex.space.assignments.read", incremental: false, fanOut: { parent: "resources", param: "resource" } },

  // Billing & financial
  { name: "charges", path: "/charges", scope: "flex.billing.charges.read", incremental: true },
  { name: "payments", path: "/payments", scope: "flex.billing.payments.read", incremental: true },
  // Can't bulk-list; requires member or company. Fan out over companies.
  // Incremental: after the first full pull, only re-queries companies changed
  // since the last run (run `sync --full` weekly to reconcile). NOTE: payment
  // details attached only to a member (not a company) are not captured; switch
  // param to "member" (parent: members) for full coverage at more requests.
  { name: "paymentDetails", path: "/payment-details", scope: "flex.billing.paymentDetails.read", incremental: true, fanOut: { parent: "companies", param: "company" } },
  { name: "credits", path: "/credits", scope: "flex.space.credits.read", incremental: true },
  { name: "passes", path: "/passes", scope: "flex.space.passes.read", incremental: true },
  { name: "taxRates", path: "/tax-rates", scope: "flex.billing.taxRates.read", incremental: false },
  { name: "revenueAccounts", path: "/revenue-accounts", scope: "flex.billing.revenueAccounts.read", incremental: false },

  // Spaces & resources
  { name: "resources", path: "/resources", scope: "flex.space.resources.read", incremental: true },
  { name: "resourceTypes", path: "/resource-types", scope: "flex.space.resourceTypes.read", incremental: false },
  { name: "resourceRates", path: "/resource-rates", scope: "flex.billing.resourceRates.read", incremental: false },
  { name: "amenities", path: "/amenities", scope: "flex.space.amenities.read", incremental: false },
  { name: "locations", path: "/locations", scope: "flex.space.locations.read", incremental: false },
  { name: "floors", path: "/floors", scope: "flex.space.floors.read", incremental: false },
  { name: "bookings", path: "/bookings", scope: "flex.space.bookings.read", incremental: true },

  // Engagement / support
  { name: "events", path: "/events", scope: "flex.collaboration.events.read", incremental: true },
  { name: "posts", path: "/posts", scope: "flex.collaboration.posts.read", incremental: true },
  { name: "tickets", path: "/tickets", scope: "flex.collaboration.tickets.read", incremental: true },
  { name: "benefits", path: "/benefits", scope: "flex.collaboration.benefits.read", incremental: false },

  // Settings / meta
  { name: "customProperties", path: "/custom-properties", scope: "flex.settings.customProperties.read", incremental: false },
  { name: "webhooks", path: "/webhooks", scope: "flex.settings.webhooks.read", incremental: false },
];

/** Space-separated scope string for the granted (available) resources. */
export function grantedScopes(resources: ResourceDef[] = RESOURCES): string {
  return resources
    .filter((r) => r.available !== false)
    .map((r) => r.scope)
    .join(" ");
}
