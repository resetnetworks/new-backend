# Meta Ads - Facebook Authorization Layer

> Purpose: Define exactly how the Facebook OAuth connection works,
> what data flows in, and what gets stored in our database.
> This doc is for internal review before development begins.

---

## What Is This Layer?

Before any artist can create a Meta ad campaign from our platform,
they must connect their Facebook Page to our system.

This is a ONE-TIME setup step per artist.
After this, we use the stored data every time they publish a campaign.

Think of it like: "Connect your Facebook account" - same as how
Wix, Buffer, or Hootsuite ask you to connect your social accounts.

---

## The Full Authorization Flow - Step by Step

### Step 1 - Artist Clicks "Connect Facebook Page"

Artist is on the Ads section of our platform dashboard.
They see a button: "Connect Facebook Page".
They click it.

### Step 2 - We Generate a Facebook OAuth URL

Our backend builds a Facebook login URL with these parameters:

```
https://www.facebook.com/v20.0/dialog/oauth
  ?client_id=2225691774887219           <- our Meta App ID
  &redirect_uri=https://api.musicreset.com/api/v2/meta-ads/auth/callback
  &scope=pages_show_list,pages_manage_ads,pages_read_engagement
  &state=RANDOM_CSRF_TOKEN              <- stored in Redis for 10 minutes
  &response_type=code
```

We store the `state` token in Redis linked to the artist's session.
This protects against CSRF attacks.

We return this URL to the frontend.

### Step 3 - Facebook Login Popup

Frontend opens this URL in a popup or redirect.
Artist sees the standard Facebook login screen.
They log in with their personal Facebook account.

### Step 4 - Artist Grants Permissions

Facebook shows a consent screen listing what our app is requesting:
- "See the list of Pages you manage"
- "Create and manage ads for Pages you manage"
- "Read engagement and insights from Pages you manage"

Artist clicks "Continue" / "Allow".

### Step 5 - Facebook Redirects Back to Our Callback

Facebook redirects to:
```
https://api.musicreset.com/api/v2/meta-ads/auth/callback
  ?code=TEMPORARY_AUTH_CODE
  &state=RANDOM_CSRF_TOKEN
```

### Step 6 - Our Backend Handles the Callback

We receive the code and state.

SECURITY CHECK: We verify the state matches what we stored in Redis.
If it doesn't match -> reject the request (possible CSRF attack).

### Step 7 - Exchange Code for Short-Lived Token

We call Facebook:
```
GET https://graph.facebook.com/v20.0/oauth/access_token
  ?client_id=2225691774887219
  &client_secret=META_APP_SECRET
  &redirect_uri=...our callback url...
  &code=TEMPORARY_AUTH_CODE
```

Facebook returns:
```json
{
  "access_token": "EAAxxxxx...",   <- valid for 1-2 hours only
  "token_type": "bearer"
}
```

### Step 8 - Exchange for Long-Lived Token (60 days)

Short-lived tokens are useless for our use case. We extend it:

```
GET https://graph.facebook.com/v20.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=2225691774887219
  &client_secret=META_APP_SECRET
  &fb_exchange_token=SHORT_LIVED_TOKEN
```

Facebook returns:
```json
{
  "access_token": "EAAxxxxx...",   <- valid for 60 days
  "token_type": "bearer",
  "expires_in": 5183944            <- seconds (approx 60 days)
}
```

This is the token we store.

### Step 9 - Fetch Artist's Facebook Pages

Using the long-lived token, we ask Facebook what Pages this person manages:

```
GET https://graph.facebook.com/v20.0/me/accounts
  ?access_token=LONG_LIVED_TOKEN
  &fields=id,name,picture,fan_count,category
```

Facebook returns a list of pages this person is an admin of:
```json
{
  "data": [
    {
      "id": "123456789",
      "name": "John Doe Music",
      "picture": { "data": { "url": "https://..." } },
      "fan_count": 1240,
      "category": "Musician/band",
      "access_token": "PAGE_SPECIFIC_TOKEN"
    },
    {
      "id": "987654321",
      "name": "John's Side Project",
      ...
    }
  ]
}
```

Note: Each page has its own `access_token` (page-level token).
This is different from the user-level token.

### Step 10 - Artist Selects Which Page to Use

We send the list of pages back to the frontend.
Artist sees a dropdown or selection UI:
"Which Facebook Page should your ads run from?"

Artist selects one page. They click "Confirm".

### Step 11 - We Store Everything

Frontend sends the selected page details to:
```
POST /api/v2/meta-ads/auth/select-page
```

We save to our database. Authorization is complete.

---

## What Gets Stored in the Database

### Model: MetaConnection

One record per artist. Stores their connected Facebook Page.

```
Field                  Type        Description
---------------------------------------------------------------------------
artistId               ObjectId    Links to the Artist model (unique index)
facebookUserId         String      The artist's personal Facebook user ID
                                   Example: "10225691774887219"
                                   Used to identify the Facebook account owner

facebookPageId         String      The selected Facebook Page ID
                                   Example: "123456789"
                                   This is what appears as the "advertiser"
                                   in their Meta ads

facebookPageName       String      The page's display name
                                   Example: "John Doe Music"
                                   Shown in our dashboard UI

facebookPagePicture    String      URL of the page's profile picture
                                   Shown in our dashboard UI

facebookPageCategory   String      Type of page
                                   Example: "Musician/band"
                                   Informational only

facebookPageFanCount   Number      Number of followers on the page
                                   Informational only

pageAccessToken        String      ENCRYPTED - The page-level access token
                                   Used when creating ad creatives
                                   Tied to this specific page

userAccessToken        String      ENCRYPTED - The user-level long-lived token
                                   Used to refresh page tokens if needed
                                   60-day expiry

tokenExpiresAt         Date        When the userAccessToken expires
                                   We use this to prompt re-connection
                                   Example: 2026-09-28T00:00:00Z

isConnected            Boolean     Whether connection is currently active
                                   Set to false if artist disconnects
                                   or if token expires

connectedAt            Date        When they first connected
createdAt              Date        Auto-generated by Mongoose
updatedAt              Date        Auto-generated by Mongoose
```

### Token Encryption

We do NOT store tokens in plain text.
Both `pageAccessToken` and `userAccessToken` are encrypted using AES-256
before saving to MongoDB, and decrypted at runtime when making API calls.

This ensures if the database is ever compromised, tokens are not exposed.

---

## How This Data Gets Used Later

Once an artist has a MetaConnection record, here is how we use it:

### During Campaign Draft Creation
- We check if `isConnected === true` before allowing draft creation
- We show the connected page name and picture in the UI ("Ads will run from: John Doe Music")
- If not connected -> show "Connect Facebook Page" prompt instead

### During Campaign Publishing (after Stripe payment)
- We fetch the MetaConnection for this artist
- We use `facebookPageId` when creating the Ad Creative on Meta:
  - The ad will show "Sponsored by John Doe Music" on Facebook/Instagram
- We use `pageAccessToken` (decrypted) to verify page access is still valid

### Note on Who Actually Creates the Ad
- The Ad is created using OUR `META_SYSTEM_USER_TOKEN` and OUR `META_AD_ACCOUNT_ID`
- The artist's `pageAccessToken` is only used to set the page identity in the creative
- Billing goes to OUR Meta Ad Account - not the artist's

---

## What Happens When Token Expires (60 Days)

Long-lived user tokens expire after 60 days.
When this happens:
1. Our system detects `tokenExpiresAt` is in the past
2. We set `isConnected = false` on their MetaConnection
3. When artist tries to create or manage a campaign, we show:
   "Your Facebook connection has expired. Please reconnect."
4. Artist clicks "Reconnect" -> same OAuth flow starts again
5. New tokens stored, `isConnected = true` again

We can also set up a cron job to proactively check for expiring
tokens (e.g., 7 days before expiry) and email artists to reconnect.

---

## API Endpoints Summary

```
Endpoint                                    Method    Auth     Purpose
---------------------------------------------------------------------------
/api/v2/meta-ads/auth/url                   GET       JWT      Generate Facebook OAuth URL
/api/v2/meta-ads/auth/callback              GET       none     Handle OAuth redirect from Facebook
/api/v2/meta-ads/auth/select-page          POST      JWT      Save selected page to DB
/api/v2/meta-ads/auth/status               GET       JWT      Check if artist is connected
/api/v2/meta-ads/auth/disconnect           DELETE    JWT      Remove connection from DB
```

---

## Security Summary

| Concern               | How We Handle It                              |
|-----------------------|-----------------------------------------------|
| CSRF attacks          | State token stored in Redis, verified on callback |
| Token theft           | Tokens encrypted with AES-256 in database     |
| Token expiry          | tokenExpiresAt tracked, re-auth prompted      |
| Unauthorized access   | JWT auth required on all endpoints except callback |
| Scope creep           | Only 3 permissions requested, minimal footprint |

---

## What the Founder Should Know

1. Artists connect their Facebook Page - NOT their ad account or billing.
   Their payment details on Facebook are never touched.

2. We store an encrypted access token for each artist.
   This token allows us to identify their page when creating ads.
   We do NOT store passwords or any Facebook login credentials.

3. Tokens expire every 60 days. Artists will need to reconnect periodically.
   We can automate reminders for this.

4. The connection takes less than 1 minute for the artist to complete.
   It is a standard Facebook Login flow - artists are familiar with it.

5. Meta requires App Review approval for the permissions we are requesting
   before real users (outside our test accounts) can use this feature.
   This review process takes approximately 1-4 weeks.

---

Last updated: 2026-07-29
Status: Planning - not yet implemented
