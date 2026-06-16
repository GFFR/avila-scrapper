/**
 * OfficeRnD Flex v2 endpoint catalogue.
 *
 * Hand-maintained from the official reference (developer.officernd.com) because
 * OfficeRnD does not publish a downloadable OpenAPI spec. `openapi.js` turns this
 * into an OpenAPI 3 document. Keep in sync with docs/API_ENDPOINTS.md.
 *
 * Each entry: { method, path, tag, summary, scope, body?, incremental? }
 *  - path        relative to /api/v2/organizations/{orgSlug}; {id} = path param
 *  - incremental "modifiedAt" | "start"  → adds a <field>[$gte] query param
 *  - body        true → write endpoint, exposes a free-form JSON request body
 *
 * GET collection endpoints (no {id}, not /count|/status|…) automatically get
 * $limit / $cursorNext pagination params and common filters in openapi.js.
 */

export const SERVER_NAME = "OfficeRnD Flex v2";

export const ENDPOINTS = [
  // ── Community / CRM ───────────────────────────────────────────────
  { method: "get",    path: "/members",                 tag: "Community · Members",       summary: "List members",            scope: "flex.community.members.read", incremental: "modifiedAt" },
  { method: "get",    path: "/members/{id}",            tag: "Community · Members",       summary: "Get member",              scope: "flex.community.members.read" },
  { method: "get",    path: "/members/count",           tag: "Community · Members",       summary: "Count members",           scope: "flex.community.members.read" },
  { method: "post",   path: "/members",                 tag: "Community · Members",       summary: "Add member",              scope: "flex.community.members.create", body: true },
  { method: "patch",  path: "/members/{id}",            tag: "Community · Members",       summary: "Update member",           scope: "flex.community.members.update", body: true },
  { method: "patch",  path: "/members/{id}/status",     tag: "Community · Members",       summary: "Update member status",    scope: "flex.community.members.update", body: true },
  { method: "patch",  path: "/members/{id}/company",    tag: "Community · Members",       summary: "Update member company",   scope: "flex.community.members.update", body: true },
  { method: "patch",  path: "/members/{id}/portal-access", tag: "Community · Members",    summary: "Manage portal access",    scope: "flex.community.members.portalAccess.update", body: true },
  { method: "delete", path: "/members/{id}",            tag: "Community · Members",       summary: "Delete member",           scope: "flex.community.members.delete" },

  { method: "get",    path: "/companies",               tag: "Community · Companies",     summary: "List companies",          scope: "flex.community.companies.read", incremental: "modifiedAt" },
  { method: "get",    path: "/companies/{id}",          tag: "Community · Companies",     summary: "Get company",             scope: "flex.community.companies.read" },
  { method: "post",   path: "/companies",               tag: "Community · Companies",     summary: "Add company",             scope: "flex.community.companies.create", body: true },
  { method: "patch",  path: "/companies/{id}",          tag: "Community · Companies",     summary: "Update company",          scope: "flex.community.companies.update", body: true },
  { method: "delete", path: "/companies/{id}",          tag: "Community · Companies",     summary: "Delete company",          scope: "flex.community.companies.delete" },

  { method: "get",    path: "/checkins",                tag: "Community · Check-ins",     summary: "List check-ins",          scope: "flex.community.checkins.read", incremental: "start" },
  { method: "get",    path: "/checkins/{id}",           tag: "Community · Check-ins",     summary: "Get check-in",            scope: "flex.community.checkins.read" },
  { method: "get",    path: "/checkins/visitors",       tag: "Community · Check-ins",     summary: "List visitor check-ins",  scope: "flex.community.checkins.read" },
  { method: "post",   path: "/checkins",                tag: "Community · Check-ins",     summary: "Check in member",         scope: "flex.community.checkins.create", body: true },
  { method: "patch",  path: "/checkins/{id}",           tag: "Community · Check-ins",     summary: "Check out member",        scope: "flex.community.checkins.update", body: true },

  { method: "get",    path: "/contracts",               tag: "Community · Contracts",     summary: "List contracts",          scope: "flex.community.contracts.read", incremental: "modifiedAt" },
  { method: "get",    path: "/contracts/{id}",          tag: "Community · Contracts",     summary: "Get contract",            scope: "flex.community.contracts.read" },
  { method: "get",    path: "/contracts/count",         tag: "Community · Contracts",     summary: "Count contracts",         scope: "flex.community.contracts.read" },
  { method: "post",   path: "/contracts",               tag: "Community · Contracts",     summary: "Add contract",            scope: "flex.community.contracts.create", body: true },
  { method: "patch",  path: "/contracts/{id}",          tag: "Community · Contracts",     summary: "Update contract",         scope: "flex.community.contracts.update", body: true },
  { method: "post",   path: "/contracts/{id}/sign",     tag: "Community · Contracts",     summary: "Sign contract",           scope: "flex.community.contracts.sign", body: true },
  { method: "post",   path: "/contracts/{id}/terminate",tag: "Community · Contracts",     summary: "Terminate contract",      scope: "flex.community.contracts.terminate", body: true },
  { method: "delete", path: "/contracts/{id}",          tag: "Community · Contracts",     summary: "Delete contract",         scope: "flex.community.contracts.delete" },

  { method: "get",    path: "/fees",                    tag: "Community · Fees",          summary: "List fees",               scope: "flex.community.fees.read", incremental: "modifiedAt" },
  { method: "get",    path: "/fees/{id}",               tag: "Community · Fees",          summary: "Get fee",                 scope: "flex.community.fees.read" },
  { method: "get",    path: "/fees/count",              tag: "Community · Fees",          summary: "Count fees",              scope: "flex.community.fees.read" },
  { method: "post",   path: "/fees",                    tag: "Community · Fees",          summary: "Add fee",                 scope: "flex.community.fees.create", body: true },
  { method: "patch",  path: "/fees/{id}",               tag: "Community · Fees",          summary: "Update fee",              scope: "flex.community.fees.update", body: true },
  { method: "delete", path: "/fees/{id}",               tag: "Community · Fees",          summary: "Delete fee",              scope: "flex.community.fees.delete" },

  { method: "get",    path: "/memberships",             tag: "Community · Memberships",   summary: "List memberships",        scope: "flex.community.memberships.read", incremental: "modifiedAt" },
  { method: "get",    path: "/memberships/{id}",        tag: "Community · Memberships",   summary: "Get membership",          scope: "flex.community.memberships.read" },
  { method: "get",    path: "/memberships/count",       tag: "Community · Memberships",   summary: "Count memberships",       scope: "flex.community.memberships.read" },
  { method: "post",   path: "/memberships",             tag: "Community · Memberships",   summary: "Add membership",          scope: "flex.community.memberships.create", body: true },
  { method: "patch",  path: "/memberships/{id}",        tag: "Community · Memberships",   summary: "Update membership",       scope: "flex.community.memberships.update", body: true },
  { method: "delete", path: "/memberships/{id}",        tag: "Community · Memberships",   summary: "Delete membership",       scope: "flex.community.memberships.delete" },

  { method: "get",    path: "/opportunities",           tag: "Community · Opportunities", summary: "List opportunities",      scope: "flex.community.opportunities.read", incremental: "modifiedAt" },
  { method: "get",    path: "/opportunities/{id}",      tag: "Community · Opportunities", summary: "Get opportunity",         scope: "flex.community.opportunities.read" },
  { method: "get",    path: "/opportunities/count",     tag: "Community · Opportunities", summary: "Count opportunities",     scope: "flex.community.opportunities.read" },
  { method: "post",   path: "/opportunities",           tag: "Community · Opportunities", summary: "Add opportunity",         scope: "flex.community.opportunities.create", body: true },
  { method: "patch",  path: "/opportunities/{id}",      tag: "Community · Opportunities", summary: "Update opportunity",      scope: "flex.community.opportunities.update", body: true },
  { method: "delete", path: "/opportunities/{id}",      tag: "Community · Opportunities", summary: "Delete opportunity",      scope: "flex.community.opportunities.delete" },
  { method: "get",    path: "/opportunity-statuses",    tag: "Community · Opportunities", summary: "List opportunity statuses", scope: "flex.community.opportunityStatuses.read" },

  { method: "get",    path: "/visitors",                tag: "Community · Visitors",      summary: "List visitors",           scope: "flex.community.visitors.read" },
  { method: "get",    path: "/visitors/{id}",           tag: "Community · Visitors",      summary: "Get visitor",             scope: "flex.community.visitors.read" },
  { method: "post",   path: "/visitors",                tag: "Community · Visitors",      summary: "Add visitor",             scope: "flex.community.visitors.create", body: true },
  { method: "delete", path: "/visitors/{id}",           tag: "Community · Visitors",      summary: "Delete visitor",          scope: "flex.community.visitors.delete" },
  { method: "get",    path: "/visits",                  tag: "Community · Visits",        summary: "List visits",             scope: "flex.community.visits.read" },
  { method: "get",    path: "/visits/{id}",             tag: "Community · Visits",        summary: "Get visit",               scope: "flex.community.visits.read" },
  { method: "post",   path: "/visits",                  tag: "Community · Visits",        summary: "Add visit",               scope: "flex.community.visits.create", body: true },
  { method: "delete", path: "/visits/{id}",             tag: "Community · Visits",        summary: "Delete visit",            scope: "flex.community.visits.delete" },
  { method: "get",    path: "/reception-flows",         tag: "Community · Visits",        summary: "List reception flows",    scope: "flex.community.receptionFlows.read" },

  // ── Billing & finance ─────────────────────────────────────────────
  { method: "get",    path: "/charges",                 tag: "Billing · Charges",         summary: "List charges",            scope: "flex.billing.charges.read", incremental: "modifiedAt" },
  { method: "post",   path: "/charges",                 tag: "Billing · Charges",         summary: "Create charge",           scope: "flex.billing.charges.create", body: true },
  { method: "patch",  path: "/charges/{id}",            tag: "Billing · Charges",         summary: "Update charge",           scope: "flex.billing.charges.update", body: true },
  { method: "delete", path: "/charges/{id}",            tag: "Billing · Charges",         summary: "Delete charge",           scope: "flex.billing.charges.delete" },

  { method: "get",    path: "/payments",                tag: "Billing · Payments",        summary: "List payments",           scope: "flex.billing.payments.read", incremental: "modifiedAt" },
  { method: "get",    path: "/payments/{id}",           tag: "Billing · Payments",        summary: "Get payment",             scope: "flex.billing.payments.read" },
  { method: "get",    path: "/payments/count",          tag: "Billing · Payments",        summary: "Count payments",          scope: "flex.billing.payments.read" },
  { method: "get",    path: "/payments/methods",        tag: "Billing · Payments",        summary: "Get payment methods",     scope: "flex.billing.payments.methods.read" },
  { method: "get",    path: "/payments/{id}/documents", tag: "Billing · Payments",        summary: "Get payment documents",   scope: "flex.billing.payments.documents.read" },
  { method: "post",   path: "/payments/overpayment",    tag: "Billing · Payments",        summary: "Create overpayment",      scope: "flex.billing.payments.create", body: true },
  { method: "patch",  path: "/payments/{id}",           tag: "Billing · Payments",        summary: "Update payment",          scope: "flex.billing.payments.update", body: true },
  { method: "post",   path: "/payments/{id}/allocations", tag: "Billing · Payments",      summary: "Create credit allocation", scope: "flex.billing.payments.allocations.create", body: true },
  { method: "patch",  path: "/payments/{id}/allocations", tag: "Billing · Payments",      summary: "Update allocation accounting", scope: "flex.billing.payments.allocations.update", body: true },

  { method: "get",    path: "/payment-details",         tag: "Billing · Payment details", summary: "List payment details",    scope: "flex.billing.paymentDetails.read" },
  { method: "post",   path: "/payment-details",         tag: "Billing · Payment details", summary: "Add payment details",     scope: "flex.billing.paymentDetails.create", body: true },
  { method: "delete", path: "/payment-details/{id}",    tag: "Billing · Payment details", summary: "Delete payment details",  scope: "flex.billing.paymentDetails.delete" },
  { method: "post",   path: "/payment-gateways/authorize", tag: "Billing · Payment details", summary: "Authorize payment intent", scope: "flex.billing.paymentGateways.authorize", body: true },

  { method: "post",   path: "/checkout",                tag: "Billing · Checkout",        summary: "Execute checkout",        scope: "flex.billing.checkout.create", body: true },
  { method: "get",    path: "/checkout/summary",        tag: "Billing · Checkout",        summary: "Get checkout preview",    scope: "flex.billing.checkout.create" },

  { method: "get",    path: "/plans",                   tag: "Billing · Plans",           summary: "List plans",              scope: "flex.billing.plans.read" },
  { method: "get",    path: "/plans/{id}",              tag: "Billing · Plans",           summary: "Get plan",                scope: "flex.billing.plans.read" },
  { method: "get",    path: "/plans/count",             tag: "Billing · Plans",           summary: "Count plans",             scope: "flex.billing.plans.read" },
  { method: "get",    path: "/resource-rates",          tag: "Billing · Rates",           summary: "List resource rates",     scope: "flex.billing.resourceRates.read" },
  { method: "get",    path: "/resource-rates/{id}",     tag: "Billing · Rates",           summary: "Get resource rate",       scope: "flex.billing.resourceRates.read" },
  { method: "get",    path: "/tax-rates",               tag: "Billing · Rates",           summary: "List tax rates",          scope: "flex.billing.taxRates.read" },
  { method: "get",    path: "/tax-rates/{id}",          tag: "Billing · Rates",           summary: "Get tax rate",            scope: "flex.billing.taxRates.read" },
  { method: "get",    path: "/revenue-accounts",        tag: "Billing · Rates",           summary: "List revenue accounts",   scope: "flex.billing.revenueAccounts.read" },
  { method: "get",    path: "/revenue-accounts/{id}",   tag: "Billing · Rates",           summary: "Get revenue account",     scope: "flex.billing.revenueAccounts.read" },

  // ── Space & resources ─────────────────────────────────────────────
  { method: "get",    path: "/resources",               tag: "Space · Resources",         summary: "List resources",          scope: "flex.space.resources.read", incremental: "modifiedAt" },
  { method: "get",    path: "/resources/{id}",          tag: "Space · Resources",         summary: "Get resource",            scope: "flex.space.resources.read" },
  { method: "get",    path: "/resources/count",         tag: "Space · Resources",         summary: "Count resources",         scope: "flex.space.resources.read" },
  { method: "get",    path: "/resources/{id}/status",   tag: "Space · Resources",         summary: "Get resource status",     scope: "flex.space.resources.read" },
  { method: "get",    path: "/resource-types",          tag: "Space · Resources",         summary: "List resource types",     scope: "flex.space.resourceTypes.read" },
  { method: "get",    path: "/amenities",               tag: "Space · Resources",         summary: "List amenities",          scope: "flex.space.amenities.read" },
  { method: "get",    path: "/amenities/{id}",          tag: "Space · Resources",         summary: "Get amenity",             scope: "flex.space.amenities.read" },

  { method: "get",    path: "/assignments",             tag: "Space · Assignments",       summary: "List assignments",        scope: "flex.space.assignments.read" },
  { method: "post",   path: "/assignments",             tag: "Space · Assignments",       summary: "Create assignment",       scope: "flex.space.assignments.create", body: true },
  { method: "delete", path: "/assignments/{id}",        tag: "Space · Assignments",       summary: "Delete assignment",       scope: "flex.space.assignments.delete" },

  { method: "get",    path: "/bookings",                tag: "Space · Bookings",          summary: "List bookings",           scope: "flex.space.bookings.read", incremental: "modifiedAt" },
  { method: "get",    path: "/bookings/{id}",           tag: "Space · Bookings",          summary: "Get booking",             scope: "flex.space.bookings.read" },
  { method: "get",    path: "/bookings/count",          tag: "Space · Bookings",          summary: "Count bookings",          scope: "flex.space.bookings.read" },
  { method: "get",    path: "/bookings/occurrences",    tag: "Space · Bookings",          summary: "List booking occurrences", scope: "flex.space.bookings.read" },
  { method: "post",   path: "/bookings",                tag: "Space · Bookings",          summary: "Add booking",             scope: "flex.space.bookings.create", body: true },
  { method: "patch",  path: "/bookings/{id}",           tag: "Space · Bookings",          summary: "Update booking",          scope: "flex.space.bookings.update", body: true },
  { method: "post",   path: "/bookings/{id}/cancel",    tag: "Space · Bookings",          summary: "Cancel booking",          scope: "flex.space.bookings.cancel", body: true },
  { method: "post",   path: "/bookings/validate",       tag: "Space · Bookings",          summary: "Validate booking",        scope: "flex.space.bookings.validate", body: true },
  { method: "delete", path: "/bookings/{id}",           tag: "Space · Bookings",          summary: "Delete booking",          scope: "flex.space.bookings.delete" },

  { method: "get",    path: "/credits",                 tag: "Space · Credits",           summary: "List credits",            scope: "flex.space.credits.read", incremental: "modifiedAt" },
  { method: "get",    path: "/credits/{id}",            tag: "Space · Credits",           summary: "Get credit",              scope: "flex.space.credits.read" },
  { method: "post",   path: "/credits",                 tag: "Space · Credits",           summary: "Create credits",          scope: "flex.space.credits.create", body: true },
  { method: "patch",  path: "/credits/{id}",            tag: "Space · Credits",           summary: "Update credits",          scope: "flex.space.credits.update", body: true },
  { method: "delete", path: "/credits/{id}",            tag: "Space · Credits",           summary: "Delete credits",          scope: "flex.space.credits.delete" },
  { method: "get",    path: "/coins/stats",             tag: "Space · Credits",           summary: "Get coin balance",        scope: "flex.space.coins.read" },

  { method: "get",    path: "/passes",                  tag: "Space · Passes",            summary: "List passes",             scope: "flex.space.passes.read", incremental: "modifiedAt" },
  { method: "get",    path: "/passes/{id}",             tag: "Space · Passes",            summary: "Get pass",                scope: "flex.space.passes.read" },
  { method: "post",   path: "/passes",                  tag: "Space · Passes",            summary: "Add pass",                scope: "flex.space.passes.create", body: true },
  { method: "patch",  path: "/passes/{id}",             tag: "Space · Passes",            summary: "Update pass",             scope: "flex.space.passes.update", body: true },
  { method: "delete", path: "/passes/{id}",             tag: "Space · Passes",            summary: "Delete pass",             scope: "flex.space.passes.delete" },

  { method: "get",    path: "/locations",               tag: "Space · Locations",         summary: "List locations",          scope: "flex.space.locations.read" },
  { method: "get",    path: "/locations/{id}",          tag: "Space · Locations",         summary: "Get location",            scope: "flex.space.locations.read" },
  { method: "get",    path: "/floors",                  tag: "Space · Locations",         summary: "List floors",             scope: "flex.space.floors.read" },
  { method: "get",    path: "/floors/{id}",             tag: "Space · Locations",         summary: "Get floor",               scope: "flex.space.floors.read" },

  // ── Collaboration ─────────────────────────────────────────────────
  { method: "get",    path: "/events",                  tag: "Collaboration · Events",    summary: "List events",             scope: "flex.collaboration.events.read", incremental: "modifiedAt" },
  { method: "get",    path: "/events/{id}",             tag: "Collaboration · Events",    summary: "Get event",               scope: "flex.collaboration.events.read" },
  { method: "get",    path: "/events/count",            tag: "Collaboration · Events",    summary: "Count events",            scope: "flex.collaboration.events.read" },
  { method: "post",   path: "/events",                  tag: "Collaboration · Events",    summary: "Create event",            scope: "flex.collaboration.events.create", body: true },
  { method: "patch",  path: "/events/{id}",             tag: "Collaboration · Events",    summary: "Update event",            scope: "flex.collaboration.events.update", body: true },
  { method: "delete", path: "/events/{id}",             tag: "Collaboration · Events",    summary: "Delete event",            scope: "flex.collaboration.events.delete" },

  { method: "get",    path: "/posts",                   tag: "Collaboration · Posts",     summary: "List posts",              scope: "flex.collaboration.posts.read", incremental: "modifiedAt" },
  { method: "get",    path: "/posts/{id}",              tag: "Collaboration · Posts",     summary: "Get post",                scope: "flex.collaboration.posts.read" },
  { method: "post",   path: "/posts",                   tag: "Collaboration · Posts",     summary: "Add post",                scope: "flex.collaboration.posts.create", body: true },
  { method: "delete", path: "/posts/{id}",              tag: "Collaboration · Posts",     summary: "Delete post",             scope: "flex.collaboration.posts.delete" },

  { method: "get",    path: "/benefits",                tag: "Collaboration · Benefits",  summary: "List benefits",           scope: "flex.collaboration.benefits.read" },
  { method: "get",    path: "/benefits/{id}",           tag: "Collaboration · Benefits",  summary: "Get benefit",             scope: "flex.collaboration.benefits.read" },
  { method: "get",    path: "/benefits/count",          tag: "Collaboration · Benefits",  summary: "Count benefits",          scope: "flex.collaboration.benefits.read" },

  { method: "get",    path: "/tickets",                 tag: "Collaboration · Tickets",   summary: "List tickets",            scope: "flex.collaboration.tickets.read", incremental: "modifiedAt" },
  { method: "get",    path: "/tickets/{id}",            tag: "Collaboration · Tickets",   summary: "Get ticket",              scope: "flex.collaboration.tickets.read" },
  { method: "get",    path: "/tickets/count",           tag: "Collaboration · Tickets",   summary: "Count tickets",           scope: "flex.collaboration.tickets.read" },
  { method: "post",   path: "/tickets",                 tag: "Collaboration · Tickets",   summary: "Add ticket",              scope: "flex.collaboration.tickets.create", body: true },
  { method: "patch",  path: "/tickets/{id}",            tag: "Collaboration · Tickets",   summary: "Update ticket",           scope: "flex.collaboration.tickets.update", body: true },
  { method: "get",    path: "/tickets/{id}/comments",   tag: "Collaboration · Tickets",   summary: "Get ticket comments",     scope: "flex.collaboration.ticketComments.read" },
  { method: "post",   path: "/tickets/{id}/comments",   tag: "Collaboration · Tickets",   summary: "Add ticket comment",      scope: "flex.collaboration.ticketComments.create", body: true },
  { method: "get",    path: "/ticket-options",          tag: "Collaboration · Tickets",   summary: "Get ticket options",      scope: "flex.collaboration.ticketOptions.read" },

  // ── Settings & meta ───────────────────────────────────────────────
  { method: "get",    path: "/custom-properties",       tag: "Settings",                  summary: "List custom properties",  scope: "flex.settings.customProperties.read" },
  { method: "get",    path: "/organization",            tag: "Settings",                  summary: "Get organization",        scope: "flex.settings.organization.read" },
  { method: "get",    path: "/business-hours",          tag: "Settings",                  summary: "Get business hours",      scope: "flex.settings.businessHours.read" },
  { method: "get",    path: "/billing-settings",        tag: "Settings",                  summary: "Get billing settings",    scope: "flex.settings.billing.read" },
  { method: "get",    path: "/integrations/{id}",       tag: "Settings",                  summary: "Get integration",         scope: "flex.settings.integrations.read" },
  { method: "get",    path: "/secondary-currencies",    tag: "Settings",                  summary: "List secondary currencies", scope: "flex.settings.secondaryCurrencies.read" },
  { method: "get",    path: "/secondary-currencies/{id}", tag: "Settings",                summary: "Get secondary currency",  scope: "flex.settings.secondaryCurrencies.read" },
  { method: "patch",  path: "/secondary-currencies/{id}", tag: "Settings",                summary: "Update secondary currency", scope: "flex.settings.secondaryCurrencies.update", body: true },
  { method: "get",    path: "/webhooks",                tag: "Settings",                  summary: "List webhooks",           scope: "flex.settings.webhooks.read" },
  { method: "get",    path: "/webhooks/{id}",           tag: "Settings",                  summary: "Get webhook",             scope: "flex.settings.webhooks.read" },
  { method: "post",   path: "/webhooks",                tag: "Settings",                  summary: "Add webhook",             scope: "flex.settings.webhooks.create", body: true },
  { method: "patch",  path: "/webhooks/{id}",           tag: "Settings",                  summary: "Update webhook",          scope: "flex.settings.webhooks.update", body: true },
  { method: "delete", path: "/webhooks/{id}",           tag: "Settings",                  summary: "Delete webhook",          scope: "flex.settings.webhooks.delete" },
];
