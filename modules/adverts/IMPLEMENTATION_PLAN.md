# Meta Ads Integration — Implementation Plan

## What We're Building

Artists on your platform can connect their **Facebook Page**, create ad campaigns with Traffic / Engagement / Brand Awareness objectives, pay via **Stripe in a single checkout**, and go live on Meta — all from your dashboard. You run ads through **your own Meta Ad Account** and take a **15% platform fee**. Artists see full analytics on your platform.

---

## Phase 0 — Meta Platform Setup (Before Any Code)

> Do this first. Everything else depends on it.

### Step 1 — Set Up Your Meta Business Manager
- Go to **business.facebook.com**
- Create your company Business Manager
- Add a payment method (credit card) — this is what Meta will charge for ad spend

### Step 2 — Create Your Meta Ad Account
- Inside Business Manager → **Accounts → Ad Accounts → Add → Create a new ad account**
- This gives you your `act_XXXXXXXXXX` — save this, it goes in your `.env`

### Step 3 — Create a System User (Your Backend Token)
- Inside Business Manager → **System Users → Add**
- Role: **Admin**
- Click **Generate Token** → select your App → grant these permissions:
  - `ads_management`
  - `ads_read`
  - `business_management`
  - `pages_manage_ads`
  - `pages_read_engagement`
- Save this token as `META_SYSTEM_USER_TOKEN` in your `.env`
- This token **never expires** — it's your backend's key to Meta API

### Step 4 — Configure Your Meta Developer App
- Go to **developers.facebook.com** → your app
- Add the **Marketing API** product to your app
- Add the **Facebook Login** product (for artist page OAuth)
- Under Facebook Login → Valid OAuth Redirect URIs, add:
  `https://yourdomain.com/api/v2/meta-ads/auth/callback`
- Set App Mode to **Development** while building, **Live** when ready for real users

### Step 5 — Meta Permissions You Need (App Review)
Request these permissions through App Review before going live:

| Permission | Purpose | Review Required |
|---|---|---|
| `pages_show_list` | List artist's Facebook pages | ✅ Yes |
| `pages_manage_ads` | Run ads for their page | ✅ Yes |
| `pages_read_engagement` | Read page-level metrics | ✅ Yes |
| `ads_management` | Only if artists connect their own ad accounts (not needed in your model) | N/A |
| `business_management` | Link pages to your Business Manager | ✅ Yes |

> **Note:** In Development mode, you can test with up to 25 Facebook accounts added as testers. Submit for App Review before public launch.

### Your `.env` Keys After Phase 0
```
META_APP_ID=
META_APP_SECRET=
META_SYSTEM_USER_TOKEN=
META_AD_ACCOUNT_ID=act_XXXXXXXXXX
META_BUSINESS_MANAGER_ID=
META_API_VERSION=v20.0
```

---

## Phase 1 — Database Models

### Step 6 — MetaConnection Model
*Stores artist's connected Facebook Page*

```
modules/adverts/models/MetaConnection.model.js

Fields:
  - artistId          (ref: Artist, unique)
  - facebookUserId    (string)
  - facebookPageId    (string) ← the page their ad will run from
  - facebookPageName  (string)
  - pageAccessToken   (string, encrypted)
  - userAccessToken   (string, encrypted) ← store for page management
  - tokenExpiresAt    (Date)
  - isConnected       (boolean, default: true)
  - connectedAt       (Date)
```

### Step 7 — MetaAdCampaign Model
*The main campaign record — lives in your DB, linked to Meta IDs*

```
modules/adverts/models/MetaAdCampaign.model.js

Fields:
  - artistId              (ref: Artist)
  - facebookPageId        (string)
  - campaignName          (string)
  - objective             (enum: TRAFFIC, ENGAGEMENT, REACH)
  - status                (enum: draft, payment_pending, active, paused, completed, failed)

  -- Meta IDs (populated after publish) --
  - metaCampaignId        (string)
  - metaAdSetId           (string)
  - metaAdCreativeId      (string)
  - metaAdId              (string)

  -- Budget & Schedule --
  - totalBudget           (number) ← what artist paid in USD cents
  - platformFee           (number) ← 15% your cut
  - adSpendBudget         (number) ← 85% sent to Meta
  - dailyBudget           (boolean) ← true = daily budget, false = lifetime
  - startDate             (Date)
  - endDate               (Date)

  -- Ad Creative --
  - adHeadline            (string)
  - adBody                (string)
  - adImageS3Key          (string) ← artist uploaded image stored in your S3
  - adImageUrl            (string)
  - destinationUrl        (string) ← link for Traffic objective

  -- Targeting --
  - targetCountries       ([string])
  - targetAgeMin          (number, default: 18)
  - targetAgeMax          (number, default: 65)
  - targetInterests       ([string])

  -- Payment --
  - stripePaymentIntentId (string)
  - stripePaymentStatus   (string)
  - paidAt                (Date)

  -- Meta Failure --
  - failureReason         (string)
  - refundStatus          (enum: none, pending, refunded)
```

### Step 8 — MetaCampaignInsights Model
*Analytics data synced from Meta every hour*

```
modules/adverts/models/MetaCampaignInsights.model.js

Fields:
  - metaAdCampaignId  (ref: MetaAdCampaign)
  - artistId          (ref: Artist)
  - date              (Date) ← the day this snapshot is for
  - impressions       (number)
  - clicks            (number)
  - reach             (number)
  - spend             (number) ← in USD
  - cpm               (number) ← cost per 1000 impressions
  - cpc               (number) ← cost per click
  - ctr               (number) ← click-through rate %
  - frequency         (number)
  - syncedAt          (Date)
```

---

## Phase 2 — Facebook Page OAuth (Connect Account)

### Step 9 — OAuth URL Generator
```
GET /api/v2/meta-ads/auth/url
Auth: required (artist must be logged in)

What it does:
  → Generates a Facebook OAuth URL with scopes:
     pages_show_list, pages_manage_ads, pages_read_engagement
  → Stores a state token in Redis (CSRF protection)
  → Returns the URL to frontend
  
Frontend: opens this URL in a popup/redirect
```

### Step 10 — OAuth Callback Handler
```
GET /api/v2/meta-ads/auth/callback?code=XXX&state=XXX

What it does:
  1. Verify state token (CSRF check)
  2. Exchange code → short-lived access token
     POST https://graph.facebook.com/v20.0/oauth/access_token
  3. Exchange short-lived → long-lived token (60 days)
     GET https://graph.facebook.com/v20.0/oauth/access_token
        ?grant_type=fb_exchange_token&...
  4. Fetch artist's pages:
     GET https://graph.facebook.com/v20.0/me/accounts
  5. Let artist pick which page to use (return list to frontend)
  6. Store in MetaConnection model (encrypted)
  7. Redirect back to your platform dashboard
```

### Step 11 — Page Selection & Save
```
POST /api/v2/meta-ads/auth/select-page
Body: { pageId, pageName, pageAccessToken }

What it does:
  → Saves selected page to MetaConnection
  → Connection is now complete
```

### Step 12 — Connection Status
```
GET  /api/v2/meta-ads/auth/status       → returns connection info
DEL  /api/v2/meta-ads/auth/disconnect   → removes connection
```

---

## Phase 3 — Campaign Draft Builder

### Step 13 — Create Campaign Draft
```
POST /api/v2/meta-ads/campaigns/draft
Auth: required
Body: {
  campaignName,
  objective,          // TRAFFIC | ENGAGEMENT | REACH
  adHeadline,
  adBody,
  destinationUrl,     // for TRAFFIC only
  totalBudget,        // in USD (e.g. 100)
  isDailyBudget,      // true = $X/day, false = total lifetime
  startDate,
  endDate,
  targetCountries,    // ["US", "GB", "IN"]
  targetAgeMin,
  targetAgeMax,
  targetInterests     // ["music", "indie music"]
}

What it does:
  → Creates MetaAdCampaign with status: "draft"
  → Validates: wallet connection exists, page is connected
  → Returns: campaignId (used in next steps)
```

### Step 14 — Upload Ad Image
```
POST /api/v2/meta-ads/campaigns/:id/upload-image
Content-Type: multipart/form-data
Body: { image } ← file upload

What it does:
  → Uploads image to your S3 bucket (under /meta-ads/ prefix)
  → Stores S3 key in campaign record
  → Returns: imageUrl (shown as preview to artist)

Note: Reuse your existing S3 upload infrastructure
```

### Step 15 — Get / Update Draft
```
GET /api/v2/meta-ads/campaigns/:id        → get campaign details
PUT /api/v2/meta-ads/campaigns/:id/draft  → update draft fields
GET /api/v2/meta-ads/campaigns            → list all artist campaigns
```

---

## Phase 4 — Payment + Publish Pipeline

### Step 16 — Create Stripe Payment Intent
```
POST /api/v2/meta-ads/campaigns/:id/payment-intent
Auth: required

What it does:
  → Validates campaign draft is complete (all fields present)
  → Validates Facebook Page is connected
  → Calculates:
       platformFee = totalBudget * 0.15
       adSpendBudget = totalBudget * 0.85
  → Creates Stripe PaymentIntent:
       amount: totalBudget (in cents, e.g. $100 = 10000)
       currency: usd
       metadata: { campaignId, artistId, platformFee, adSpendBudget }
  → Updates campaign status: "payment_pending"
  → Returns: { clientSecret } → sent to Stripe.js on frontend
  
Frontend: uses clientSecret to open Stripe Payment Sheet
          Artist enters card → pays
          Stripe confirms payment on frontend
```

### Step 17 — Publish Campaign (The Main Endpoint)
```
POST /api/v2/meta-ads/campaigns/:id/publish
Auth: required
Body: { stripePaymentIntentId }

This is the most important endpoint. Called by frontend 
immediately after Stripe confirms payment on the client side.

STEP A — Verify Payment
  → Call Stripe API: retrieve PaymentIntent by ID
  → Confirm status === "succeeded"
  → Confirm amount matches campaign budget
  → If failed → return 400 (artist already sees failure on frontend)

STEP B — Record Revenue
  → Update campaign: stripePaymentIntentId, stripePaymentStatus, paidAt
  → Record platformFee in your revenue tracking

STEP C — Upload Image to Meta
  → Download image from your S3
  → POST https://graph.facebook.com/v20.0/{AD_ACCOUNT_ID}/adimages
     Headers: Authorization: Bearer {SYSTEM_USER_TOKEN}
     Body: { bytes: base64encodedImage }
  → Returns: image_hash ← save this

STEP D — Create Meta Campaign
  → POST https://graph.facebook.com/v20.0/{AD_ACCOUNT_ID}/campaigns
     Body: {
       name: campaignName,
       objective: "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_AWARENESS",
       status: "ACTIVE",
       special_ad_categories: []
     }
  → Returns: { id } ← save as metaCampaignId

STEP E — Create Meta Ad Set
  → POST https://graph.facebook.com/v20.0/{AD_ACCOUNT_ID}/adsets
     Body: {
       name: campaignName + " - Ad Set",
       campaign_id: metaCampaignId,
       billing_event: "IMPRESSIONS",
       optimization_goal: "REACH" | "LINK_CLICKS" | "ENGAGEMENT",
       lifetime_budget: adSpendBudget * 100,  ← in cents
       start_time: startDate (unix timestamp),
       end_time: endDate (unix timestamp),
       targeting: {
         geo_locations: { countries: targetCountries },
         age_min: targetAgeMin,
         age_max: targetAgeMax,
         interests: [{ id: ..., name: ... }]
       },
       status: "ACTIVE"
     }
  → Returns: { id } ← save as metaAdSetId

STEP F — Create Meta Ad Creative
  → POST https://graph.facebook.com/v20.0/{AD_ACCOUNT_ID}/adcreatives
     Body: {
       name: campaignName + " - Creative",
       object_story_spec: {
         page_id: facebookPageId,
         link_data: {
           image_hash: imageHash,
           message: adBody,
           name: adHeadline,
           link: destinationUrl,
           call_to_action: { type: "LEARN_MORE" }
         }
       }
     }
  → Returns: { id } ← save as metaAdCreativeId

STEP G — Create Meta Ad (Final Step)
  → POST https://graph.facebook.com/v20.0/{AD_ACCOUNT_ID}/ads
     Body: {
       name: campaignName + " - Ad",
       adset_id: metaAdSetId,
       creative: { creative_id: metaAdCreativeId },
       status: "ACTIVE"
     }
  → Returns: { id } ← save as metaAdId

STEP H — Update Your DB
  → Update MetaAdCampaign:
       status: "active"
       metaCampaignId, metaAdSetId, metaAdCreativeId, metaAdId
  → Return success to frontend

--- If ANY Meta step (C through G) fails ---
  → Trigger automatic Stripe refund:
     stripe.refunds.create({ payment_intent: stripePaymentIntentId })
  → Update campaign: status: "failed", failureReason, refundStatus: "refunded"
  → Return error to frontend with refund confirmation
```

---

## Phase 5 — Campaign Management

### Step 18 — Pause / Resume Campaign
```
POST /api/v2/meta-ads/campaigns/:id/pause
POST /api/v2/meta-ads/campaigns/:id/resume

What it does:
  → POST https://graph.facebook.com/v20.0/{metaCampaignId}
     Body: { status: "PAUSED" | "ACTIVE" }
     Headers: Authorization: Bearer {SYSTEM_USER_TOKEN}
  → Update local DB status
```

### Step 19 — Stop / End Campaign
```
POST /api/v2/meta-ads/campaigns/:id/stop

What it does:
  → POST https://graph.facebook.com/v20.0/{metaCampaignId}
     Body: { status: "DELETED" }
  → Get remaining unspent budget from Meta Insights
  → Update campaign status: "completed"
  → Note: No refund for unspent amount (Meta's billing is near real-time)
```

---

## Phase 6 — Analytics Sync (Cron Job)

### Step 20 — Meta Insights Sync Worker
```
File: workers/metaInsightsSync.worker.js
Schedule: every 1 hour (cron)

What it does:
  1. Fetch all campaigns with status: "active" from your DB
  2. For each campaign, call:
     GET https://graph.facebook.com/v20.0/{metaCampaignId}/insights
        ?fields=impressions,clicks,reach,spend,cpm,cpc,ctr,frequency
        &date_preset=today
        &access_token={SYSTEM_USER_TOKEN}
  3. Upsert into MetaCampaignInsights (per campaign, per day)
  4. If Meta returns campaign_status !== ACTIVE → update your DB accordingly
  5. Check if endDate has passed → mark as "completed"
```

### Step 21 — Analytics API Endpoints
```
GET /api/v2/meta-ads/campaigns/:id/insights
  → Query: { from, to, preset }
  → Returns: insights from your DB (daily breakdown)
  → Also returns: lifetime totals, remaining budget estimate

GET /api/v2/meta-ads/campaigns/:id/insights/live
  → Calls Meta API directly (real-time, not cached)
  → Use sparingly — for the campaign detail page refresh
```

---

## Phase 7 — Stripe Webhook (Safety Net)

### Step 22 — Stripe Webhook Handler
```
POST /api/v2/meta-ads/webhook/stripe
(register this in your Stripe dashboard)

Events to handle:
  payment_intent.succeeded
    → If campaign status is still "payment_pending" 
       (edge case: frontend crashed before calling /publish)
    → Trigger publish flow from webhook as backup

  payment_intent.payment_failed
    → Update campaign status: "payment_failed"
    → Notify artist

  refund.created
    → Update campaign refundStatus: "refunded"
```

---

## Summary: Complete Meta API Calls Reference

| Step | Endpoint | Method | Purpose |
|---|---|---|---|
| Upload Image | `/{AD_ACCOUNT}/adimages` | POST | Upload ad image |
| Create Campaign | `/{AD_ACCOUNT}/campaigns` | POST | Top-level campaign |
| Create Ad Set | `/{AD_ACCOUNT}/adsets` | POST | Targeting + budget |
| Create Creative | `/{AD_ACCOUNT}/adcreatives` | POST | Visual + copy |
| Create Ad | `/{AD_ACCOUNT}/ads` | POST | Final live unit |
| Pause/Resume | `/{CAMPAIGN_ID}` | POST | Change status |
| Get Insights | `/{CAMPAIGN_ID}/insights` | GET | Analytics data |
| Get Pages | `/me/accounts` | GET | Artist OAuth pages |
| Exchange Token | `/oauth/access_token` | GET | Long-lived token |

---

## Summary: File Structure to Create

```
modules/adverts/
  ├── models/
  │   ├── MetaConnection.model.js       [NEW]
  │   ├── MetaAdCampaign.model.js       [NEW]
  │   └── MetaCampaignInsights.model.js [NEW]
  ├── controllers/
  │   ├── auth.controller.js            [NEW] ← OAuth flow
  │   ├── campaign.controller.js        [NEW] ← draft + publish
  │   ├── payment.controller.js         [NEW] ← Stripe intent + webhook
  │   └── insights.controller.js        [NEW] ← analytics
  ├── services/
  │   ├── meta.api.service.js           [NEW] ← all Meta API calls
  │   ├── campaign.service.js           [NEW] ← business logic
  │   └── insights.service.js           [NEW] ← analytics sync
  ├── routes/
  │   └── meta-ads.routes.js            [NEW]
  └── workers/
      └── metaInsightsSync.worker.js    [NEW]
```

Register in `app.js`:
```js
import metaAdsRoutes from "./modules/adverts/routes/meta-ads.routes.js";
app.use("/api/v2/meta-ads", metaAdsRoutes);
```

---

## Development Order (Recommended)

1. **Phase 0** — Set up Meta Business Manager, Ad Account, System User Token
2. **Phase 1** — Build all 3 database models
3. **Phase 2** — Build OAuth flow (connect Facebook Page)
4. **Phase 3** — Build campaign draft + image upload
5. **Phase 4** — Build Stripe payment intent + publish pipeline (core)
6. **Phase 5** — Build pause/resume/stop
7. **Phase 6** — Build analytics sync worker + endpoints
8. **Phase 7** — Add Stripe webhook safety net
9. **App Review** — Submit Meta permissions for production access
