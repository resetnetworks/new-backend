# Meta Ads Integration - Task Tracker

> Done = [x] | Pending = [ ]
> Do NOT remove tasks - cross them off with [x] as you go.

---

## Phase 0 - Meta Platform Setup

### Meta Business Manager
- [x] Meta Business Manager created -> `reset music` portfolio

### Meta Ad Account
- [x] Ad Account created -> `Music Reset Ads` (ID: `act_2271412326951711`)
- [x] Ad Account linked to Business Portfolio
- [ ] BLOCKED: Payment method added to Ad Account (pending - discuss with founder)
- [ ] Fix "Country and currency don't match" billing warning on Ad Account

### Meta Developer App
- [x] Developer App exists -> `first-camp-draft` (App ID: `2225691774887219`)
- [x] App connected to Business Portfolio
- [ ] Rename app from `first-camp-draft` to `Music Reset` before going live

### System User (Backend Token)
- [x] System User created -> `ADMIN_USER` (ID: `61592328043030`) with Admin role
- [x] Ad Account `Music Reset Ads` assigned to ADMIN_USER
- [x] Facebook Page `Reset music` assigned to ADMIN_USER
- [x] App `first-camp-draft` assigned to ADMIN_USER with Full Access
- [x] System User Token generated

### Environment Variables
- [x] `META_AD_ACCOUNT_ID` added to `.env`
- [x] `META_SYSTEM_USER_TOKEN` added to `.env`
- [x] `META_APP_ID` added to `.env` -> `2225691774887219`
- [x] `META_API_VERSION` added to `.env` -> `v20.0`
- [ ] `META_APP_SECRET` added to `.env` <- get from developers.facebook.com -> app -> Settings -> Basic
- [ ] `META_BUSINESS_MANAGER_ID` added to `.env` <- get from Business Settings URL

### Meta App - Products and Permissions
- [ ] Marketing API product added to app (developers.facebook.com -> your app -> Add Product)
- [ ] Facebook Login product added to app
- [ ] Valid OAuth Redirect URI added -> `https://yourdomain.com/api/v2/meta-ads/auth/callback`

---

## Phase 1 - Database Models

- [x] `MetaConnection.model.js` created -> stores artist's connected Facebook Page info
- [ ] `MetaAdCampaign.model.js` created -> main campaign record with Meta IDs + budget + creative
- [ ] `MetaCampaignInsights.model.js` created -> hourly analytics synced from Meta

---

## Phase 2 - Facebook Page OAuth (Connect Account)

- [x] `GET /api/v2/meta-ads/auth/url` -> generate Facebook OAuth URL + store state in Redis
- [x] `GET /api/v2/meta-ads/auth/callback` -> exchange code for long-lived token, fetch pages list
- [x] `GET /api/v2/meta-ads/auth/pages` -> return pages list after callback (for page selection UI)
- [x] `POST /api/v2/meta-ads/auth/select-page` -> artist picks which page to use, save to DB
- [x] `GET /api/v2/meta-ads/auth/status` -> return connection info for artist
- [x] `DELETE /api/v2/meta-ads/auth/disconnect` -> remove artist's Meta connection

---

## Phase 3 - Campaign Draft Builder

- [ ] `POST /api/v2/meta-ads/campaigns/draft` -> create campaign draft (objective, targeting, dates, budget)
- [ ] `POST /api/v2/meta-ads/campaigns/:id/upload-image` -> upload ad image to S3
- [ ] `GET /api/v2/meta-ads/campaigns/:id` -> get single campaign details
- [ ] `PUT /api/v2/meta-ads/campaigns/:id/draft` -> update draft fields
- [ ] `GET /api/v2/meta-ads/campaigns` -> list all artist's campaigns

---

## Phase 4 - Payment + Publish Pipeline (Core)

NOTE: Stripe is ALREADY set up in modules/payment/.
We REUSE stripe.client.js (stripe instance) and the existing Checkout Session pattern.
Payment flow = Stripe Checkout redirect (NOT inline PaymentIntent).
Existing webhook at modules/payment/webhooks/stripe.webhook.js stays - we just ADD a new case inside it.

### What gets REUSED (no new files needed here)
- [x] `modules/payment/providers/stripe.client.js` -> stripe instance already exported, just import it
- [x] `modules/payment/webhooks/stripe.webhook.js` -> existing webhook handler, ADD a case inside it

### What gets CREATED (new files)
- [ ] `controllers/advert.payment.controller.js` in adverts module:
  - [ ] `POST /api/v2/meta-ads/campaigns/:id/checkout` -> create Stripe Checkout Session
    - Calculate 15% platform fee + 85% ad spend from campaign budget
    - Set campaign status to `payment_pending` in DB
    - Pass `itemType: "meta-ad-campaign"` and `campaignId` in Stripe session metadata
    - Return `checkoutUrl` -> frontend redirects artist to Stripe hosted payment page
    - success_url -> `/ads/campaign/:id/success` (frontend polls GET /campaigns/:id for status)
    - cancel_url -> `/ads/campaign/:id/draft` (back to draft, no charge)

### What gets ADDED to existing stripe.webhook.js
- [ ] New case inside `checkout.session.completed` for `itemType === "meta-ad-campaign"`:
  - [ ] Step A: Extract `campaignId` from Stripe session metadata
  - [ ] Step B: Record platform fee + ad spend amounts in MetaAdCampaign DB record
  - [ ] Step C: Upload ad image to Meta (POST /{AD_ACCOUNT}/adimages) -> get image_hash
  - [ ] Step D: Create Meta Campaign (POST /{AD_ACCOUNT}/campaigns) -> get metaCampaignId
  - [ ] Step E: Create Meta Ad Set with targeting + budget (POST /{AD_ACCOUNT}/adsets) -> get metaAdSetId
  - [ ] Step F: Create Meta Ad Creative with page + image (POST /{AD_ACCOUNT}/adcreatives) -> get metaAdCreativeId
  - [ ] Step G: Create Meta Ad linking all together (POST /{AD_ACCOUNT}/ads) -> get metaAdId
  - [ ] Step H: Update MetaAdCampaign status -> `active`, save all Meta IDs to DB
  - [ ] Step I: If ANY Meta step fails -> auto-refund via stripe.refunds.create() -> status -> `failed`

---

## Phase 5 - Campaign Management

- [ ] `POST /api/v2/meta-ads/campaigns/:id/pause` -> pause campaign on Meta + update DB
- [ ] `POST /api/v2/meta-ads/campaigns/:id/resume` -> resume campaign on Meta + update DB
- [ ] `POST /api/v2/meta-ads/campaigns/:id/stop` -> stop/end campaign on Meta + update DB

---

## Phase 6 - Analytics Sync

- [ ] `workers/metaInsightsSync.worker.js` -> cron job every 1 hour to sync insights from Meta API
- [ ] `GET /api/v2/meta-ads/campaigns/:id/insights` -> return analytics from DB (daily breakdown)
- [ ] `GET /api/v2/meta-ads/campaigns/:id/insights/live` -> real-time direct call to Meta Insights API

---

## Phase 7 - App Registration and Routing

- [x] Register route in `app.js` -> `app.use("/api/v2/meta-ads", metaAdsRoutes)`
- [ ] Add `modules/adverts` to `.gitignore` if needed

---

## Phase 8 - Meta App Review (Before Going Live)

- [ ] Submit `pages_show_list` permission for App Review
- [ ] Submit `pages_manage_ads` permission for App Review
- [ ] Submit `pages_read_engagement` permission for App Review
- [ ] Submit `business_management` permission for App Review
- [ ] Prepare demo video of the full campaign creation flow for Meta review
- [ ] Switch app mode from Development to Live

---

## File Structure to Create

```
modules/adverts/
  models/
    MetaConnection.model.js          <- new
    MetaAdCampaign.model.js          <- new
    MetaCampaignInsights.model.js    <- new
  controllers/
    auth.controller.js               <- new (OAuth flow)
    campaign.controller.js           <- new (draft builder)
    advert.payment.controller.js     <- new (reuses stripe.client.js)
    insights.controller.js           <- new (analytics)
  services/
    meta.api.service.js              <- new (all Meta API calls)
    campaign.service.js              <- new (business logic)
    insights.service.js              <- new (analytics sync logic)
  routes/
    meta-ads.routes.js               <- new
  workers/
    metaInsightsSync.worker.js       <- new

modules/payment/webhooks/stripe.webhook.js
  -> MODIFY: add new case for itemType === "meta-ad-campaign"
```

---

Last updated: 2026-07-29
Current Status: Phase 0 in progress - 2 env vars pending + payment method blocked (founder)
Next Step: Add META_APP_SECRET + META_BUSINESS_MANAGER_ID to .env -> then start Phase 1 models
