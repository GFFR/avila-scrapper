# Avila Spaces — OfficeRnD Flex Data Model

**Audience:** the team building a product on top of this data.
**Source:** OfficeRnD Flex v2 API, mirrored locally by this tool (Postgres + JSON snapshots).
**Profiled from:** `data/json/*.json`, manifest exported `2026-06-16T10:26:32Z`.

This document describes the data *as it actually exists* in the Avila Spaces org — field types, relationships, enumerations, and the embedded/custom structures — so it can be consumed without re-deriving anything from the API or the source records.

---

## 1. How the data is stored

Every OfficeRnD collection is mirrored into one Postgres table and one JSON file of the same name. Each row is:

| Column | Type | Meaning |
|--------|------|---------|
| `_id` | `TEXT` PK | OfficeRnD record id (24-hex Mongo ObjectId) |
| `created_at` | timestamp | record `createdAt` (nullable) |
| `modified_at` | timestamp | record `modifiedAt`/`updatedAt`, drives incremental sync |
| `synced_at` | timestamp | when this tool last wrote the row |
| `data` | `JSONB` | **full raw record — the source of truth** |

The JSON files are arrays of the raw `data` objects. **All field documentation below describes the contents of `data`.**

### Conventions used throughout

- **`_id`** — 24-char hex ObjectId string. Primary key of every collection.
- **Foreign keys are bare id strings**, not nested objects. A field like `member`, `company`, `location` holds the `_id` of a record in the correspondingly-named collection. There is **no referential integrity enforced** — a referenced id can point to a record outside the synced set (e.g. an archived user). Treat all FKs as nullable-in-practice.
- **Timestamps** are ISO-8601 UTC strings (`2026-06-16T10:26:32.752Z`). Date-only values still carry a `T00:00:00.000Z` time component.
- **`createdBy` / `modifiedBy`** are FKs to *operators/users* (OfficeRnD staff accounts). These ids are **not** in the `members` collection — they are system users and largely opaque for product purposes.
- **`properties`** (on members, companies, bookings, fees, memberships, plans…) is an open key/value bag of **custom fields**. See §5.
- **Money** is a plain `number` in the org's currency (**EUR**); `currency` is usually null and should be assumed EUR.
- **Presence %** in the field tables = share of sampled records where the field is non-null. Low presence ⇒ optional/sparse.

---

## 2. Domain map

The 32 collections group into seven domains:

```
                        ┌──────────────┐
                        │  locations   │◄────────────── floors
                        └──────┬───────┘
                               │ (every record carries location)
        ┌──────────────────────┼───────────────────────────────┐
        │                       │                                │
  ┌─────▼──────┐         ┌──────▼──────┐                  ┌──────▼──────┐
  │  CRM /     │         │  SPACE &    │                  │  BILLING &  │
  │  COMMUNITY │         │  INVENTORY  │                  │  FINANCE    │
  └────────────┘         └─────────────┘                  └─────────────┘
  companies  ◄─┐         resources ──► resourceTypes      payments ◄─ charges
  members ──────┤        resourceRates                    payments ─► (lines)
  visitors      │        amenities                        fees ──► payment
  checkins      │        bookings ──► resources/rates     paymentDetails
  opportunities │        passes                           credits
  (+Statuses)   │                                         contracts ──► plans
                │                                         taxRates / revenueAccounts
   memberships ─┘
   assignments        ENGAGEMENT: events, posts, tickets, benefits
                      META: customProperties, webhooks, plans
```

**Central hubs:** `companies` (the billing/account entity, "team" in OfficeRnD terms) and `members` (individual people). Almost everything points back to one or both, plus a `location`.

> **Terminology note:** In OfficeRnD a **company = "team"** and a **member = "person"**. Many custom-field `targets` use `team`/`member`/`office` rather than `company`/`member`. A `company` of one person still exists as a company.

---

## 3. Core entities

### `companies` (3,254) — the account / billing entity ("team")
The customer organization. The unit most billing and contracts hang off.

| Field | Type | % | Notes |
|-------|------|---|-------|
| `_id` | id | 100 | |
| `name` | string | 100 | |
| `email` | string | 100 | |
| `status` | enum | 100 | `active` · `inactive` · `former` · `drop-in` · `lead` |
| `location` | FK→locations | 100 | home location |
| `startDate` | datetime | 100 | |
| `address` | object | 100 | `{street, zip, city, state?, country}` (often `{}`; **note: Avila data sometimes swaps zip/city**) |
| `billingDetails` | object | 100 | `{shouldSendOverdueReminders, …}` |
| `properties` | object (custom) | 100 | client number, VAT id, IBAN, status, etc. — see §5 |
| `tags` | string[] | 100 | |
| `url` / `image` / `description` | string | 2–15 | sparse |
| `activeMembersAllowanceLimit` | number\|null | 100 | seat cap |
| `hasActiveMembersAllowance` | bool | 100 | |
| `portalPrivacy` | object | 2 | `{isVisible}` |
| `createdAt`/`modifiedAt`/`createdBy`/`modifiedBy` | meta | 100 | |

### `members` (5,743) — individual people
A person, always attached to a company.

| Field | Type | % | Notes |
|-------|------|---|-------|
| `name`, `email` | string | 100 | |
| `company` | FK→companies | 100 | **every member belongs to a company** |
| `location` | FK→locations | 100 | |
| `status` | enum | 100 | `active` · `former` · `contact` · `drop-in` · `lead` |
| `phone` | string | 99 | |
| `startDate` | datetime | 99 | |
| `isBillingPerson` / `isContactPerson` | bool | 100 | role flags within the company |
| `address` | object | 35 | `{street, zip, city, country}` |
| `billingDetails` | object | 100 | |
| `properties` | object (custom) | 100 | access card nr, printing pin, "Community Person", etc. |
| `description` | string\|null | 42 | free-text bio |
| `socialProfiles` | object | 4 | `{instagram, linkedin, …}` |
| `portalPrivacy` | object | 23 | `{isVisible, showContactDetails, showSocialProfiles}` |
| `image` | string | 5 | |

### `visitors` (120) — pre-registered guests
Lightweight, **no FK to member/company in the record**. `{_id, name, email, phone?, type}`. `type`: `preregistration`.

### `checkins` (7,894) — physical presence events
| Field | Type | Notes |
|-------|------|-------|
| `member` | FK→members | |
| `company` | FK→companies | |
| `location` | FK→locations | |
| `pass` | FK→passes (95%) | the pass consumed, if any |
| `resourceType` | string | e.g. `hotdesk` |
| `start` / `end` | datetime | |

> No `createdAt`/`modifiedAt` — only `start`/`end`. Treat `start` as the event time.

### `opportunities` (897) + `opportunityStatuses` (3) — sales pipeline / leads
`opportunities`: `{member?, company?, name, status→opportunityStatuses, dealSize, probability, membersCount, requestedPlans[], resources[], startDate}`.
`opportunityStatuses` is a tiny lookup: `{_id, description, probability, isSystem}` (only 3 rows; `opportunities.status` holds one of those ids).

---

## 4. Membership, contracts & space

### `memberships` (2,268) — recurring subscriptions
The recurring revenue backbone — a company/member subscribed to a plan.

| Field | Type | Notes |
|-------|------|-------|
| `company` | FK→companies | always |
| `member` | FK→members (93%) | null = team-level membership |
| `plan` | FK→plans | what they're subscribed to |
| `location` | FK→locations | |
| `name` | string | denormalized plan name |
| `status` | enum | only `approved` in data |
| `calculatedStatus` | enum | **`active` · `expired` · `not_started`** ← use this for live state |
| `type` | enum | `month_to_month` · `fixed` |
| `price` / `discountedPrice` / `discountAmount` / `deposit` | number | |
| `intervalLength` / `intervalCount` | string/number | billing cadence (`month`, n) |
| `startDate` / `endDate` | datetime | endDate nullable (open-ended) |
| `isLocked` / `isPersonal` | bool | |
| `properties` | object (custom) | |

### `assignments` (259) — space allocations
Links a membership to a physical resource for a date range. **Fan-out collection** (queried per resource).
`{membership→memberships, resource→resources, startDate, endDate?}`.

### `contracts` (19) — formal agreements
| Field | Type | Notes |
|-------|------|-------|
| `company` / `member` | FK | |
| `number` | string | e.g. `CON-R-2025-2` |
| `type` | enum | `new` · `renewal` |
| `status` | enum | `not_signed` (only value seen) |
| `signatureStatus` | null | |
| `documentType` | string | `membershipagreement` |
| `startDate`/`endDate` | datetime | |
| `isRolling` | bool | |
| `notice` | object | `{months}` |
| `plans` | object[] | **embedded** — see below |
| `baseTotal` / `plansTotal` / `oneOffsTotal` / `resourcesTotal` / `total` | number | pricing breakdown |
| `percentagePriceIncrease` / `previousDepositHeld` | number | |
| `legalDocuments` | id[] | |

`contracts.plans[]` embedded shape:
```json
{ "id": "<plan _id>", "count": 1, "price": 65, "deposit": 130,
  "increasePriceInRolling": false,
  "steps": [{ "price": 65, "startDate": "...", "endDate": "...", "discount": null }] }
```

### `plans` (209) — product catalog
The catalog of purchasable products (offices, hotdesks, virtual office, services…).

| Field | Type | Notes |
|-------|------|-------|
| `name` / `code` | string | |
| `type` | enum | `team_room` · `desk` · `hotdesk` · `service` |
| `price` | number | base price (note: some in cents-like magnitudes, e.g. `20000` — **verify scale per plan**) |
| `intervalLength`/`intervalCount` | | billing cadence |
| `deposit`/`depositPercent`/`useDepositPercent` | | |
| `forMembers`/`forNonMembers`/`forTeamMembers` | bool | visibility |
| `requiresApproval`/`allowsCancellation`/`shouldProrate` | bool | |
| `amenities` | id[]→amenities | |
| `credits` | object[] | embedded credit allowances (see below) |
| `discounts` | string[] | named discounts |
| `setupFees` / `legalDocuments` / `locations` | id[] | |
| `revenueAccount` | FK→revenueAccounts | |
| `properties` | object (custom) | **planTier, planCategory, planVertical, hasMailbox, commitment, …** — rich; see §5 |

`plans.credits[]` embedded shape:
```json
{ "type": "hour", "count": 4, "validFor": "resourceTypes",
  "resourceTypes": ["<id>"], "rates": [], "oneOffPlans": [] }
```

### `resources` (353) — bookable/assignable physical inventory
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | e.g. `R.1.01` |
| `type` | enum | `meeting_room` · `team_room` · `hotdesk` · `desk` |
| `location` | FK→locations | |
| `floor` | FK→floors (78%) | |
| `rate` | FK→resourceRates (8%) | pricing for bookables |
| `targetPlan` | FK→plans (21%) | |
| `price` | number\|null | |
| `privacy` | enum | `full` · `limited` · `active_members` |
| `availability` | object | `{startDate, endDate}` |
| `amenities` | id[] | |
| `parents` | id[]→resources | hierarchy (room → desks) |
| `limitedTo` | object | `{companies:[...]}` when restricted |
| `images` | string[] | |
| `size` / `area` | number | |

### `resourceTypes` (6) — resource categories
`{title, type, bookingMode:"time", checkinMode:"day", canBook, canAssign, isHierarchical, isPrimary, icon}`.
`type`: `team_room`·`desk`·`desk_tr`·`desk_na`·`meeting_room`·`hotdesk`.

### `resourceRates` (6) — pricing for bookable resources
`{name, code, type, price, intervalLength:"hour", revenueAccount, amenities[], locations[], rates[], shouldProrate, useCoins}`.
`rates[]`: `{_id, price, isOffRate, intervalLength, intervalCount}` (peak/off-peak variants).

### `amenities` (32), `floors` (15), `locations` (3)
- **amenities**: `{title, icon, createdBy}`.
- **floors**: `{name, floor, location→locations, area, isOpen}`.
- **locations**: `{name, code, timezone:"Europe/Lisbon", isOpen, isPublic, address{…+lat/lng+formattedAddress}, image, properties{BIC, IBAN, Vat Id, City…}}`. Only 3: Avenida da República, + two others.

### `bookings` (15,933) — room/desk reservations
| Field | Type | Notes |
|-------|------|-------|
| `resource` | FK→resources | what's booked |
| `member` | FK→members (97%) | booker |
| `company` | FK→companies (97%) | |
| `location` | FK→locations | |
| `rate` | FK→resourceRates (97%) | |
| `members` / `visitors` | id[] | attendees |
| `start`/`end` | datetime | actual occurrence |
| `seriesStart`/`seriesEnd` | datetime | for recurring series |
| `recurrence` | object | `{rrule}` (rrule string or null) |
| `reference` | string | human code e.g. `JCZQD67` |
| `source` | enum | `portal`·`admin`·`public`·`Google`·`public-api`·`mobile`·`ConnectApi`·`embedded-portal` |
| `title`/`description` | string | sparse |
| `fees` | object[] | linked fee snippets |
| `isCancelled`/`isFree`/`isTentative`/`isAccounted` | bool | sparse flags (absent ⇒ false) |
| `serviceSlots` | object | `{before, after}` buffer minutes |
| `properties` | object (custom) | e.g. "Notas Internas AvilaSpaces" |
| `timezone` | string | `Europe/Lisbon` |

### `passes` (934) — day-pass / quota entitlements
`{company, member?, resourceType:"hotdesk", count, usedCount, status(expired·valid·pending), validFrom, validTo?, intervalLength, fee?→fees, isPersonal, shouldGrantActiveStatus}`.

---

## 5. Billing & finance

> **The money flow:** `memberships`/`bookings`/`passes` → generate **`fees`** → grouped into **`payments`** (invoices/credit notes) → settled by **`charges`** (transactions). **`credits`** track consumable allowances. **`paymentDetails`** are saved payment methods.

### `payments` (7,566) — invoices & credit notes
The invoice-level document.

| Field | Type | Notes |
|-------|------|-------|
| `number` | string | `INV-6` etc. |
| `documentType` | enum | `invoice` · `creditNote` |
| `status` | enum | `paid`·`overdue`·`pending`·`refunded`·`partially_paid`·`failed`·`awaiting_payment` |
| `company` | FK→companies | (member is usually null at payment level) |
| `location` | FK→locations | |
| `date` / `dueDate` | datetime | |
| `amount` / `subTotal` / `baseTotal` | number | |
| `paidAmount`/`payableAmount`/`pendingAmount`/`allocatedAmount` | number | |
| `taxType` | enum | `included` · `excluded` |
| `taxAmounts` | object[] | `[{total, percent, taxRate→taxRates}]` |
| `lines` | object[] | **invoice line items — see below** |
| `allocations` | object[] | `[{_id, amount, target, documentType}]` credit-note links |
| `accounting` | object | external ERP sync: `{provider:"PHC", providerId, lastSync, externalOrgId}` |
| `chargeMethod` | string | sparse |
| `isPaid`/`isFailed`/`isSent` | bool | |
| `reference` | string | |

`payments.lines[]` embedded shape (the actual billed detail):
```json
{ "fee": "<id>|null", "plan": "<id>", "description": "...",
  "quantity": 5, "unitPrice": 3.34, "price": 16.7, "subTotal": 16.7,
  "discount": 0, "discountAmount": 0, "taxRate": "<id>", "taxPercent": 23,
  "taxAmount": 3.12, "total": 16.7, "baseTotal": 13.58, "baseUnitPrice": 2.7154,
  "account": "<revenueAccount id>", "location": "<id>",
  "startDate": "...", "endDate": "..." }
```

### `fees` (18,798) — individual billable charges
The pre-invoice charge line (what gets rolled into a payment).

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `company` | FK→companies | |
| `member` | FK→members (51%) | |
| `location` | FK→locations | |
| `plan` | FK→plans (99%) | |
| `planType` | enum | `ResourceRate` · `Plan` |
| `payment` | object | `{_id→payments, status}` — link to its invoice + status (`invoiced`, …) |
| `price`/`quantity`/`discountedPrice`/`discountAmount`/`calculatedDiscountAmount` | number | |
| `discount` | FK (5%) | |
| `status` | enum | `approved` (only value) |
| `source` | enum | `portal`·`admin`·`public-api`·`public`·`mobile`·`ConnectApi`·`embedded-portal` |
| `issueDate` | datetime | |
| `isPersonal`/`isRefundable`/`shouldBillInAdvance` | bool | |
| `properties` | object | |

### `charges` (7,660) — payment transactions
The money-movement record against a payment.

| Field | Type | Notes |
|-------|------|-------|
| `payment` | FK→payments | |
| `amount` | number | |
| `status` | enum | `success` · `fail` · `refund` · `pending` |
| `account` | enum | `Bank Transfer`·`Cash`·`Stripe Card`·`POS`·`Stripe SEPA`·`Cheque` |
| `date` | datetime | |
| `source` | string | `OfficeRnD` |
| `reference` / `providerChargeReference` | string | Stripe ids (`ch_…`), sparse |
| `currency` | string\|null | EUR when present |

### `credits` (33,811) — consumable allowances
Largest collection. Tracks meeting-room hours / day-pass credits granted and consumed.

| Field | Type | Notes |
|-------|------|-------|
| `company` | FK→companies | |
| `member` | FK→members (3%) | mostly team-level |
| `membership` | FK→memberships (99%) | source of the allowance |
| `parent` | FK→credits (76%) | parent credit (renewals chain) |
| `count` / `usedCount` | number | granted vs consumed |
| `validFor` | enum | `resourceTypes` · `all` · `rates` |
| `resourceTypes` / `resourceRates` | id[] | what it applies to |
| `intervalLength` | enum | `once` · `month` |
| `validFrom` / `validTo` | datetime | validity window |
| `startDate` / `endDate` | datetime | sparse |
| `bookings` | object[] | **consumption ledger** — `[{booking→bookings, count, occurrenceDate}]` |

### `paymentDetails` (572) — saved payment methods
**Fan-out** (per company). `{method:"card", type:"stripe", paymentCustomer:"cus_…", paymentSource:"card_…", locations[], details{…}}`.
`details`: `{id, name, brand, last4, country, funding, expirationMonth, expirationYear, cvcCheck, authorization{status}}`. **Contains PII / card metadata — handle accordingly.**

### `taxRates` (3) & `revenueAccounts` (11) — finance lookups
- **taxRates**: `{name, rate, type, components:[{_id, name, rate}]}`. Referenced by payment lines & revenue accounts.
- **revenueAccounts**: `{name, description, defaultFor?, taxRate→taxRates}`. `defaultFor` e.g. `deposit`.

---

## 6. Engagement & support
*(These five scopes were recently enabled — see `src/officernd/resources.ts`.)*

- **`events` (108)** — community events. `{title, description(HTML), start, end, location, locations[], member?, company?, limit?, links[], where, image, timezone}`.
- **`posts` (114)** — community feed posts. `{title, description, type(info·important·event), member?, locations[], url?, createdAt}`.
- **`tickets` (281)** — support/issue tracker. `{subject, message, status(open·resolved), member, company, location, assignedTo→user, type, priority, severity, attachments[], resolvedDate?, createdAt, modifiedAt}`. Note `type`/`priority`/`severity` are FK ids to lookup configs **not currently synced** (no collection for them).
- **`benefits` (19)** — member perks/marketplace. `{name, category, description, coverImage, url, locations[]}`. No timestamps.

---

## 7. Meta & configuration

### `customProperties` (37) — the custom-field schema
**This is the schema for every `properties` bag elsewhere.** Each entry defines one custom field:
`{key, title, type, privacy, targets[], values?, placeholder?, rates[]}`.

- `type`: `String` · `Text` · `Boolean` · `Number` · `select`
- `privacy`: `admin` · `protected`
- `targets`: which entity the field attaches to — `team`(company) · `member` · `office` · `lead` · `plan-membership` · `plan-fee` · `bookings` · `invoice`
- `values`: option list for `select` types

Key custom fields the product will likely care about:

| key | type | target | purpose |
|-----|------|--------|---------|
| `clientNumber` | String | team, member | external client id (e.g. `0001`) |
| `Vat Id`, `Business name`, `Registration number` | | office | legal/invoicing identity |
| `IBAN`, `BIC`, `Bank Name` | | office | banking |
| `planVertical` | select | plan | `Cowork`·`VirtualAssistant`·`VirtualOffice`·`DayPassCowork`·`DayPassOffice`·`LisboaCentro`… |
| `planTier` | select | plan | `Basic`·`Corporate`·`Plus`·`Premium`·`Business`·`1dia`·`10dias`… |
| `planCategory` | select | plan | `Flex`·`Fix`·`VirtualOffice`·`VirtualAssistant`·`LisboaCentro`·`DayPassCowork` |
| `commitment` | select | plan | `1M`·`6M`·`12M` |
| `hasMailbox`/`hasPhoneLine`/`hasCommunications`/`hasPrivateOffice`/`hasWallLogo`… | Boolean | plan | feature toggles |
| `interestedIn` | select | lead | sales interest |
| `Access Card Nr`, `Biometric Access Card Nr` | String | team, member | physical access |
| `printingPin` | Number | member | |
| `Community Person`, `kioskVisible` | Boolean | member | |
| `vatScheme` | select | team | `Standard`·`CashAccounting` |
| `invoicingSystemInvoice`/`invoicingSystemReceipt` | Boolean | invoice | ERP routing |

### `webhooks` (9) — integration config
`{url, eventTypes[], isEnabled, secret, description}`. e.g. `company.created`/`member.created` → an Azure function ("Generate client number"). Informational; documents existing integrations.

### `visits` (0)
Empty in this org. Collection exists; no records.

---

## 8. Relationship reference (FK cheat-sheet)

```
members.company            → companies
members.location           → locations
companies.location         → locations
checkins.{member,company,location,pass} → members/companies/locations/passes
opportunities.{member,company,status}   → members/companies/opportunityStatuses
memberships.{company,member,plan,location} → companies/members/plans/locations
assignments.{membership,resource}        → memberships/resources
contracts.{company,member}               → companies/members
contracts.plans[].id                     → plans
plans.{amenities[],revenueAccount,setupFees[],legalDocuments[]} → amenities/revenueAccounts/...
resources.{location,floor,rate,targetPlan,parents[],amenities[]} → locations/floors/resourceRates/plans/resources/amenities
floors.location            → locations
bookings.{resource,member,company,location,rate,members[],visitors[]} → ...
passes.{company,member,fee} → companies/members/fees
fees.{company,member,location,plan,discount} + fees.payment._id → ... / payments
payments.lines[].{fee,plan,taxRate,account} + payments.taxAmounts[].taxRate + payments.allocations[].target
charges.payment            → payments
credits.{company,member,membership,parent} + credits.resourceTypes[]/resourceRates[] + credits.bookings[].booking
paymentDetails.locations[] → locations
revenueAccounts.taxRate    → taxRates
*.{createdBy,modifiedBy}   → OfficeRnD users (NOT in members; opaque)
*.properties               → keyed by customProperties.key
```

---

## 9. Notes & gotchas for product builders

1. **JSONB is the source of truth.** Build read models / a relational projection from `data`; don't assume the top-level columns capture everything.
2. **No enforced FKs.** Always left-join and tolerate dangling references (deleted/archived records, system users).
3. **`createdBy`/`modifiedBy` are staff users, not members.** Don't join them to `members`.
4. **Company vs member granularity.** Billing (payments, credits, fees) is largely **company-level**; `member` is often null on those. Don't assume a member on every financial record.
5. **Use `calculatedStatus` for memberships**, not `status` (which is always `approved`).
6. **Money scale varies.** Most amounts are plain EUR floats, but a few `plans.price` values look like minor units (`20000`). Verify per-plan before displaying.
7. **Custom fields are first-class business data.** Plan tier/category/vertical, client numbers, VAT, access cards all live in `properties` and are defined by `customProperties`. Join through `customProperties.key` and respect `privacy` (`admin`/`protected`) for exposure decisions.
8. **PII / payment data** lives in `paymentDetails.details`, `members` (email/phone/address), and `companies`. Scope access accordingly.
9. **HTML content** appears in `events.description` (and possibly `posts`). Sanitize before rendering.
10. **Fan-out collections** (`assignments`, `paymentDetails`) and incremental sync caveats are described in `src/officernd/resources.ts`; child changes may lag until a `sync --full`.
11. **`address` fields are dirty** in places (Avila company data has zip/city swapped). Normalize on ingest.
12. **Embedded sub-documents** (`payments.lines`, `contracts.plans`, `credits.bookings`, `plans.credits`, `resourceRates.rates`, `payments.taxAmounts`) carry critical detail and should be modeled as child tables if you build a relational projection.

---

*Generated by profiling the live JSON snapshots. Re-run the profiling against `data/json/` after a fresh sync to refresh counts and catch schema drift.*
