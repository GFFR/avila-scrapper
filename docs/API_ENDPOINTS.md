# Avila Spaces — OfficeRnD Flex API Endpoint Reference

A quick lookup of **every data type, its endpoint, and the OAuth scope** needed to read it.
Source of truth: `src/officernd/resources.ts`. Pairs with [`DATA_MODEL.md`](./DATA_MODEL.md).

> **Two layers of documentation in this file:**
> - **Part A (§1–§6)** — what *this backup tool* reads today (the 32 collections it syncs).
> - **Part B (§7 onward)** — the **full OfficeRnD Flex v2 API**: every endpoint and every scope (read + write), researched from the official reference, for building a product beyond read-only backup.

---

# Part A — What this tool syncs

---

## Connection basics

| | |
|---|---|
| **API base** | `https://app.officernd.com/api/v2/organizations/{ORG_SLUG}` |
| **Token endpoint** | `https://identity.officernd.com/oauth/token` |
| **Auth** | OAuth2 `client_credentials` (client id + secret) → bearer token |
| **API version** | Flex **v2** |
| **Org** | configured via `OFFICERND_ORG_SLUG` |

Full URL for a collection = **API base + path** (e.g. `…/organizations/{ORG_SLUG}/members`).

### Auth flow
```
POST https://identity.officernd.com/oauth/token
  grant_type=client_credentials
  client_id={OFFICERND_CLIENT_ID}
  client_secret={OFFICERND_CLIENT_SECRET}
  scope={space-separated scopes}     ← only request scopes granted to the app
→ { access_token, ... }

GET  {API base}{path}?{query}
  Authorization: Bearer {access_token}
```
> The token request **fails entirely** if it includes a scope not granted to the app in OfficeRnD → Developer Tools. Only request scopes you've been granted.

### Query / pagination conventions (v2)
| Param | Purpose |
|-------|---------|
| `$limit` | page size — **max 50** |
| `$cursorNext` | cursor for the next page (from response `cursorNext`) |
| `{field}[$gte]=<ISO>` | incremental filter, e.g. `modifiedAt[$gte]=2026-06-01T00:00:00.000Z` |
| `{param}=<id>` | parent filter for fan-out endpoints (e.g. `company=<id>`) |

Response shape: `{ results: [...], cursorNext: "<cursor|null>" }` (some endpoints return a bare array). Rate limit ≈ **400 reads/min**.

---

## Endpoint catalogue

Legend — **Sync**: `incremental` filters on a timestamp; `full` always pulls everything; `fan-out` is queried once per parent id (no bulk list). All scopes below are **granted** to the Avila app.

### Community / CRM
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| members | `GET /members` | `flex.community.members.read` | incremental (`modifiedAt`) |
| companies | `GET /companies` | `flex.community.companies.read` | incremental (`modifiedAt`) |
| checkins | `GET /checkins` | `flex.community.checkins.read` | incremental (`start`) |
| opportunities | `GET /opportunities` | `flex.community.opportunities.read` | incremental (`modifiedAt`) |
| opportunityStatuses | `GET /opportunity-statuses` | `flex.community.opportunityStatuses.read` | full |
| visitors | `GET /visitors` | `flex.community.visitors.read` | full (no timestamp) |
| visits | `GET /visits` | `flex.community.visits.read` | full (no timestamp) |

### Membership & contracts
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| memberships | `GET /memberships` | `flex.community.memberships.read` | incremental (`modifiedAt`) |
| plans | `GET /plans` | `flex.billing.plans.read` | full |
| contracts | `GET /contracts` | `flex.community.contracts.read` | incremental (`modifiedAt`) |
| fees | `GET /fees` | `flex.community.fees.read` | incremental (`modifiedAt`) |
| assignments | `GET /assignments?resource={id}` | `flex.space.assignments.read` | fan-out (parent: resources) |

### Billing & finance
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| charges | `GET /charges` | `flex.billing.charges.read` | incremental (`modifiedAt`) |
| payments | `GET /payments` | `flex.billing.payments.read` | incremental (`modifiedAt`) |
| paymentDetails | `GET /payment-details?company={id}` | `flex.billing.paymentDetails.read` | fan-out (parent: companies) |
| credits | `GET /credits` | `flex.space.credits.read` | incremental (`modifiedAt`) |
| passes | `GET /passes` | `flex.space.passes.read` | incremental (`modifiedAt`) |
| taxRates | `GET /tax-rates` | `flex.billing.taxRates.read` | full |
| revenueAccounts | `GET /revenue-accounts` | `flex.billing.revenueAccounts.read` | full |

### Spaces & resources
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| resources | `GET /resources` | `flex.space.resources.read` | incremental (`modifiedAt`) |
| resourceTypes | `GET /resource-types` | `flex.space.resourceTypes.read` | full |
| resourceRates | `GET /resource-rates` | `flex.billing.resourceRates.read` | full |
| amenities | `GET /amenities` | `flex.space.amenities.read` | full |
| locations | `GET /locations` | `flex.space.locations.read` | full |
| floors | `GET /floors` | `flex.space.floors.read` | full |
| bookings | `GET /bookings` | `flex.space.bookings.read` | incremental (`modifiedAt`) |

### Engagement / support
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| events | `GET /events` | `flex.collaboration.events.read` | incremental (`modifiedAt`) |
| posts | `GET /posts` | `flex.collaboration.posts.read` | incremental (`modifiedAt`) |
| tickets | `GET /tickets` | `flex.collaboration.tickets.read` | incremental (`modifiedAt`) |
| benefits | `GET /benefits` | `flex.collaboration.benefits.read` | full |

### Settings / meta
| Data type | Endpoint | Scope | Sync |
|-----------|----------|-------|------|
| customProperties | `GET /custom-properties` | `flex.settings.customProperties.read` | full |
| webhooks | `GET /webhooks` | `flex.settings.webhooks.read` | full |

---

## Scope module summary

OfficeRnD scopes follow `flex.{module}.{resource}.read`. The modules in use:

| Module | Covers |
|--------|--------|
| `flex.community` | members, companies, checkins, opportunities(+statuses), visitors, visits, memberships, contracts, fees |
| `flex.billing` | plans, charges, payments, paymentDetails, taxRates, revenueAccounts, resourceRates |
| `flex.space` | assignments, credits, passes, resources, resourceTypes, amenities, locations, floors, bookings |
| `flex.collaboration` | events, posts, tickets, benefits |
| `flex.settings` | customProperties, webhooks |

> Note the non-obvious placements: `credits` is under **`flex.space`** (not billing), and `resourceRates`/`plans` are under **`flex.billing`** (not space).

---

## Fan-out endpoints (no bulk list)

Two endpoints can't be listed in bulk and must be queried per parent id:

| Data type | Endpoint | Parent | Query param |
|-----------|----------|--------|-------------|
| assignments | `GET /assignments?resource={id}` | resources | `resource` |
| paymentDetails | `GET /payment-details?company={id}` | companies | `company` |

For these you first list the parent collection, then call the child endpoint once per parent `_id`.
> `paymentDetails` fanned out over **companies** misses payment methods attached only to a member; switch the param to `member` for full coverage at the cost of more requests.

---

## Copy-paste examples

```bash
# 1. Get a token (only request granted scopes)
curl -s https://identity.officernd.com/oauth/token \
  -d grant_type=client_credentials \
  -d client_id="$OFFICERND_CLIENT_ID" \
  -d client_secret="$OFFICERND_CLIENT_SECRET" \
  -d scope="flex.community.members.read"

# 2. First page of members (max 50)
curl -s "https://app.officernd.com/api/v2/organizations/$ORG/members?\$limit=50" \
  -H "Authorization: Bearer $TOKEN"

# 3. Next page (cursor from previous response's cursorNext)
curl -s "https://app.officernd.com/api/v2/organizations/$ORG/members?\$limit=50&\$cursorNext=$CURSOR" \
  -H "Authorization: Bearer $TOKEN"

# 4. Incremental — members modified since a date
curl -s "https://app.officernd.com/api/v2/organizations/$ORG/members?modifiedAt%5B%24gte%5D=2026-06-01T00:00:00.000Z" \
  -H "Authorization: Bearer $TOKEN"

# 5. Fan-out — payment methods for one company
curl -s "https://app.officernd.com/api/v2/organizations/$ORG/payment-details?company=$COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

*Part A generated from `src/officernd/resources.ts`. If endpoints/scopes change there, regenerate those tables.*

---

# Part B — Full OfficeRnD Flex v2 API reference

Researched from the official OfficeRnD developer documentation (see [Sources](#sources)). This covers the **entire** Flex v2 surface — read **and** write — not just what the backup tool uses. Use it to scope a product, request the right OAuth scopes, and find write endpoints.

- **Base URL & auth:** identical to Part A — `https://app.officernd.com/api/v2/organizations/{ORG_SLUG}` + bearer token.
- **Path column** is relative to that base.
- **✓ synced** marks endpoints this backup tool already reads.
- ~175 endpoints across 6 domains. Counts/get-by-id variants share their parent's `.read` scope.

## 7. Scope model

Scopes follow **`flex.{module}.{resource}.{action}`**.

- **Modules:** `community` · `billing` · `space` · `collaboration` · `settings` · `user`
- **Actions:** `read` · `create` · `update` · `delete` + resource-specific verbs (`sign`, `terminate`, `cancel`, `validate`, `authorize`, `impersonate`, `allocations.create`, `portalAccess.update`, …)
- **Granularity:** a `.read` scope covers list, get-by-id, and count for that resource. Write actions each need their own scope.
- **Requesting:** include only granted scopes in the token request (space-separated) — an ungranted scope makes the whole token call fail.

**Read-only product** → request the `*.read` scopes you need. **Read/write product** (provisioning members, taking bookings, issuing fees…) → add the matching `create`/`update`/`delete` scopes.

## 8. Authentication & user management

| Endpoint | Method | Path | Scope |
|----------|--------|------|-------|
| Generate OAuth token | POST | (identity server) `/oauth/token` | — (client credentials) |
| Sign in a user | POST | `/auth/signin` | `flex.user.auth.signin` |
| Create a user | POST | `/auth/signup` | `flex.user.auth.signup` |
| Validate JWT token | POST | `/auth/verifytoken` | `flex.user.auth.verify` |
| Impersonate a member | POST | `/auth/impersonate` | `flex.user.auth.impersonate` |
| Change password | POST | `/password/change` | `flex.user.password.update` |
| Reset password | POST | `/password/reset` | `flex.user.password.update` |

## 9. Community (CRM)

| Endpoint | Method | Path | Scope | |
|----------|--------|------|-------|---|
| Get members / one / count | GET | `/members` · `/members/{id}` · `/members/count` | `flex.community.members.read` | ✓ synced |
| Add member | POST | `/members` | `flex.community.members.create` | |
| Update member | PATCH | `/members/{id}` | `flex.community.members.update` | |
| Update member status | PATCH | `/members/{id}/status` | `flex.community.members.update` | |
| Update member company | PATCH | `/members/{id}/company` | `flex.community.members.update` | |
| Manage portal access | PATCH | `/members/{id}/portal-access` | `flex.community.members.portalAccess.update` | |
| Delete member | DELETE | `/members/{id}` | `flex.community.members.delete` | |
| Get companies / one | GET | `/companies` · `/companies/{id}` | `flex.community.companies.read` | ✓ synced |
| Add / update / delete company | POST/PATCH/DELETE | `/companies` · `/companies/{id}` | `flex.community.companies.{create,update,delete}` | |
| Get check-ins / one / visitor check-ins | GET | `/checkins` · `/checkins/{id}` · `/checkins/visitors` | `flex.community.checkins.read` | ✓ synced |
| Check in member | POST | `/checkins` | `flex.community.checkins.create` | |
| Check out member | PATCH | `/checkins/{id}` | `flex.community.checkins.update` | |
| Get contracts / one / count | GET | `/contracts` · `/contracts/{id}` · `/contracts/count` | `flex.community.contracts.read` | ✓ synced |
| Add / update / delete contract | POST/PATCH/DELETE | `/contracts` · `/contracts/{id}` | `flex.community.contracts.{create,update,delete}` | |
| Sign contract | POST | `/contracts/{id}/sign` | `flex.community.contracts.sign` | |
| Terminate contract | POST | `/contracts/{id}/terminate` | `flex.community.contracts.terminate` | |
| Get fees / one / count | GET | `/fees` · `/fees/{id}` · `/fees/count` | `flex.community.fees.read` | ✓ synced |
| Add / update / delete fee | POST/PATCH/DELETE | `/fees` · `/fees/{id}` | `flex.community.fees.{create,update,delete}` | |
| Get memberships / one / count | GET | `/memberships` · `/memberships/{id}` · `/memberships/count` | `flex.community.memberships.read` | ✓ synced |
| Add / update / delete membership | POST/PATCH/DELETE | `/memberships` · `/memberships/{id}` | `flex.community.memberships.{create,update,delete}` | |
| Get opportunities / one / count | GET | `/opportunities` · `/opportunities/{id}` · `/opportunities/count` | `flex.community.opportunities.read` | ✓ synced |
| Add / update / delete opportunity | POST/PATCH/DELETE | `/opportunities` · `/opportunities/{id}` | `flex.community.opportunities.{create,update,delete}` | |
| Get opportunity statuses | GET | `/opportunity-statuses` | `flex.community.opportunityStatuses.read` | ✓ synced |
| Get visitors / one | GET | `/visitors` · `/visitors/{id}` | `flex.community.visitors.read` | ✓ synced |
| Add / delete visitor | POST/DELETE | `/visitors` · `/visitors/{id}` | `flex.community.visitors.{create,delete}` | |
| Get visits / one | GET | `/visits` · `/visits/{id}` | `flex.community.visits.read` | ✓ synced |
| Add / delete visit | POST/DELETE | `/visits` · `/visits/{id}` | `flex.community.visits.{create,delete}` | |
| Get reception flows | GET | `/reception-flows` | `flex.community.receptionFlows.read` | |

## 10. Billing & payments

| Endpoint | Method | Path | Scope | |
|----------|--------|------|-------|---|
| Retrieve charges | GET | `/charges` | `flex.billing.charges.read` | ✓ synced |
| Create / update / delete charge | POST/PATCH/DELETE | `/charges` · `/charges/{id}` | `flex.billing.charges.{create,update,delete}` | |
| Get payments / one / count | GET | `/payments` · `/payments/{id}` · `/payments/count` | `flex.billing.payments.read` | ✓ synced |
| Create overpayment | POST | `/payments/overpayment` | `flex.billing.payments.create` | |
| Update payment | PATCH | `/payments/{id}` | `flex.billing.payments.update` | |
| Create / update allocation | POST/PATCH | `/payments/{id}/allocations` | `flex.billing.payments.allocations.{create,update}` | |
| Get payment documents | GET | `/payments/{id}/documents` | `flex.billing.payments.documents.read` | |
| Get payment methods | GET | `/payments/methods` | `flex.billing.payments.methods.read` | |
| Get payment details | GET | `/payment-details` | `flex.billing.paymentDetails.read` | ✓ synced |
| Add / delete payment details | POST/DELETE | `/payment-details` · `/payment-details/{id}` | `flex.billing.paymentDetails.{create,delete}` | |
| Authorize payment intent | POST | `/payment-gateways/authorize` | `flex.billing.paymentGateways.authorize` | |
| Execute checkout | POST | `/checkout` | `flex.billing.checkout.create` | |
| Get checkout preview | GET | `/checkout/summary` | `flex.billing.checkout.create` | |
| Get plans / one / count | GET | `/plans` · `/plans/{id}` · `/plans/count` | `flex.billing.plans.read` | ✓ synced |
| Get resource rates / one / count | GET | `/resource-rates` · `/resource-rates/{id}` · `/resource-rates/count` | `flex.billing.resourceRates.read` | ✓ synced |
| Get revenue accounts / one | GET | `/revenue-accounts` · `/revenue-accounts/{id}` | `flex.billing.revenueAccounts.read` | ✓ synced |
| Get tax rates / one | GET | `/tax-rates` · `/tax-rates/{id}` | `flex.billing.taxRates.read` | ✓ synced |
| Get billing settings | GET | `/billing-settings` | `flex.settings.billing.read` | |

## 11. Space & resources

| Endpoint | Method | Path | Scope | |
|----------|--------|------|-------|---|
| Get resources / one / count / status | GET | `/resources` · `/resources/{id}` · `/resources/count` · `/resources/{id}/status` | `flex.space.resources.read` | ✓ synced |
| Get resource types | GET | `/resource-types` | `flex.space.resourceTypes.read` | ✓ synced |
| Get amenities / one | GET | `/amenities` · `/amenities/{id}` | `flex.space.amenities.read` | ✓ synced |
| Get assignments | GET | `/assignments` | `flex.space.assignments.read` | ✓ synced |
| Create / delete assignment | POST/DELETE | `/assignments` · `/assignments/{id}` | `flex.space.assignments.{create,delete}` | |
| Get bookings / one / count / occurrences | GET | `/bookings` · `/bookings/{id}` · `/bookings/count` · `/bookings/occurrences` | `flex.space.bookings.read` | ✓ synced |
| Add / update / delete booking | POST/PATCH/DELETE | `/bookings` · `/bookings/{id}` | `flex.space.bookings.{create,update,delete}` | |
| Cancel booking | POST | `/bookings/{id}/cancel` | `flex.space.bookings.cancel` | |
| Validate booking | POST | `/bookings/validate` | `flex.space.bookings.validate` | |
| Get credits / one | GET | `/credits` · `/credits/{id}` | `flex.space.credits.read` | ✓ synced |
| Create / update / delete credits | POST/PATCH/DELETE | `/credits` · `/credits/{id}` | `flex.space.credits.{create,update,delete}` | |
| Get coin balance | GET | `/coins/stats` | `flex.space.coins.read` | |
| Get passes / one | GET | `/passes` · `/passes/{id}` | `flex.space.passes.read` | ✓ synced |
| Add / update / delete pass | POST/PATCH/DELETE | `/passes` · `/passes/{id}` | `flex.space.passes.{create,update,delete}` | |
| Get floors / one | GET | `/floors` · `/floors/{id}` | `flex.space.floors.read` | ✓ synced |
| Get locations / one | GET | `/locations` · `/locations/{id}` | `flex.space.locations.read` | ✓ synced |

## 12. Collaboration (engagement & support)

| Endpoint | Method | Path | Scope | |
|----------|--------|------|-------|---|
| Get events / one / count | GET | `/events` · `/events/{id}` · `/events/count` | `flex.collaboration.events.read` | ✓ synced |
| Create / update / delete event | POST/PATCH/DELETE | `/events` · `/events/{id}` | `flex.collaboration.events.{create,update,delete}` | |
| Get posts / one | GET | `/posts` · `/posts/{id}` | `flex.collaboration.posts.read` | ✓ synced |
| Add / delete post | POST/DELETE | `/posts` · `/posts/{id}` | `flex.collaboration.posts.{create,delete}` | |
| Get benefits / one / count | GET | `/benefits` · `/benefits/{id}` · `/benefits/count` | `flex.collaboration.benefits.read` | ✓ synced |
| Get tickets / one / count | GET | `/tickets` · `/tickets/{id}` · `/tickets/count` | `flex.collaboration.tickets.read` | ✓ synced |
| Add / update ticket | POST/PATCH | `/tickets` · `/tickets/{id}` | `flex.collaboration.tickets.{create,update}` | |
| Get / add ticket comments | GET/POST | `/tickets/{id}/comments` | `flex.collaboration.ticketComments.{read,create}` | |
| Get ticket options | GET | `/ticket-options` | `flex.collaboration.ticketOptions.read` | |

> **Tip for tickets:** `tickets.type`/`priority`/`severity` are ids resolved via `/ticket-options` (`flex.collaboration.ticketOptions.read`). The backup tool doesn't sync that lookup yet — add it if you need human-readable ticket metadata. Ticket threads come from `/tickets/{id}/comments`.

## 13. Settings & configuration

| Endpoint | Method | Path | Scope | |
|----------|--------|------|-------|---|
| Get custom properties | GET | `/custom-properties` | `flex.settings.customProperties.read` | ✓ synced |
| Get webhooks / one | GET | `/webhooks` · `/webhooks/{id}` | `flex.settings.webhooks.read` | ✓ synced |
| Add / update / delete webhook | POST/PATCH/DELETE | `/webhooks` · `/webhooks/{id}` | `flex.settings.webhooks.{create,update,delete}` | |
| Get organization | GET | `/organization` | `flex.settings.organization.read` | |
| Get business hours | GET | `/business-hours` | `flex.settings.businessHours.read` | |
| Get billing settings | GET | `/billing-settings` | `flex.settings.billing.read` | |
| Get integration | GET | `/integrations/{id}` | `flex.settings.integrations.read` | |
| Get secondary currencies / one | GET | `/secondary-currencies` · `/secondary-currencies/{id}` | `flex.settings.secondaryCurrencies.read` | |
| Update secondary currency | PATCH | `/secondary-currencies/{id}` | `flex.settings.secondaryCurrencies.update` | |

## 14. Endpoints available but NOT backed up

Read endpoints that exist in the API but aren't in this tool's sync set — candidates if the product needs them:

| Data | Endpoint | Scope |
|------|----------|-------|
| Organization info | `GET /organization` | `flex.settings.organization.read` |
| Business hours | `GET /business-hours` | `flex.settings.businessHours.read` |
| Billing settings | `GET /billing-settings` | `flex.settings.billing.read` |
| Secondary currencies | `GET /secondary-currencies` | `flex.settings.secondaryCurrencies.read` |
| Integrations | `GET /integrations/{id}` | `flex.settings.integrations.read` |
| Reception flows | `GET /reception-flows` | `flex.community.receptionFlows.read` |
| Coin balance / stats | `GET /coins/stats` | `flex.space.coins.read` |
| Ticket options (lookup) | `GET /ticket-options` | `flex.collaboration.ticketOptions.read` |
| Ticket comments | `GET /tickets/{id}/comments` | `flex.collaboration.ticketComments.read` |
| Payment documents | `GET /payments/{id}/documents` | `flex.billing.payments.documents.read` |
| Payment methods | `GET /payments/methods` | `flex.billing.payments.methods.read` |
| Booking occurrences (expanded recurrences) | `GET /bookings/occurrences` | `flex.space.bookings.read` |

## 15. Complete read-scope set (for a full read-only product)

```
flex.community.members.read         flex.billing.charges.read
flex.community.companies.read       flex.billing.payments.read
flex.community.checkins.read        flex.billing.paymentDetails.read
flex.community.contracts.read       flex.billing.plans.read
flex.community.fees.read            flex.billing.resourceRates.read
flex.community.memberships.read     flex.billing.revenueAccounts.read
flex.community.opportunities.read   flex.billing.taxRates.read
flex.community.opportunityStatuses.read
flex.community.visitors.read        flex.space.resources.read
flex.community.visits.read          flex.space.resourceTypes.read
flex.community.receptionFlows.read  flex.space.amenities.read
                                    flex.space.assignments.read
flex.collaboration.events.read      flex.space.bookings.read
flex.collaboration.posts.read       flex.space.credits.read
flex.collaboration.tickets.read     flex.space.passes.read
flex.collaboration.ticketComments.read   flex.space.floors.read
flex.collaboration.ticketOptions.read    flex.space.locations.read
flex.collaboration.benefits.read    flex.space.coins.read

flex.settings.customProperties.read flex.settings.organization.read
flex.settings.webhooks.read         flex.settings.businessHours.read
flex.settings.billing.read          flex.settings.integrations.read
flex.settings.secondaryCurrencies.read
```

---

## Sources

- [OfficeRnD Developer Reference](https://developer.officernd.com/reference)
- [OfficeRnD API endpoint/OpenAPI index (llms.txt)](https://developer.officernd.com/llms.txt) — machine-readable index of all endpoints + scopes
- [Introducing OfficeRnD API v2](https://help.officernd.com/en/articles/300780-introducing-officernd-api-v2)
- [API v2 Migration Guide](https://developer.officernd.com/docs/api-v2-migration-guide)
- [Developer Tools — Applications (granting scopes)](https://help.officernd.com/hc/en-us/articles/360007581539-Developer-Tools-Applications)

*Part B researched from official docs on 2026-06-16. Re-fetch `llms.txt` to refresh if OfficeRnD adds endpoints.*
