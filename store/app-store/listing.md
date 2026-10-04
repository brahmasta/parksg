# App Store Connect listing (iOS 1.0.0)

Paste-ready text for App Store Connect. Field limits in brackets.

## App information

| Field | Value |
|---|---|
| Name (30) | `wheretopark.sg: SG Parking` |
| Subtitle (30) | `Carpark rates & live lots` |
| Bundle ID | `sg.wheretopark.app` |
| SKU | `wheretopark-ios` |
| Primary language | English (U.K.) |
| Primary category | Navigation |
| Secondary category | Travel |
| Content rights | "Contains, shows or accesses third-party content": **Yes**, and you have the rights: public carpark data (LTA DataMall, URA, HDB/data.gov.sg, OneMap) under their open licences |
| Age rating | 4+ (answer "None" to every question; no web browsing, no user-generated content shown to others beyond carpark check-ins) |
| Copyright | `2026 Brahmasta Adipradana` |
| Price | Free |
| Availability | Singapore only (the app has no data elsewhere) |

## Version 1.0.0

**Promotional text (170)**

```
Know the price before the ramp. See what parking will really cost near where you're going in Singapore, and whether there are lots free right now.
```

**Description (4000)**

```
Know the price before the ramp.

wheretopark.sg shows what parking will actually cost near where you're going in Singapore, and whether there are lots free right now. Search a destination, mall or postcode, and see nearby carparks sorted by the estimated price for your stay.

WHAT YOU GET
• Real rates for thousands of carparks: HDB, URA, malls, offices and more
• An estimated cost for your stay, using the time you arrive and how long you're staying, including weekend and evening rates
• Live available lots, where the carpark publishes them
• Walking time and route from the carpark to your destination
• List or map view, sorted by cheapest or nearest
• Filters for available lots, EV charging, motorcycles and heavy vehicles
• Height limits and full rate schedules for each carpark
• One tap to navigate with Apple Maps, Google Maps or Waze
• "Use my location" to find parking around you, or long-press the app icon for Near me

SAVE AND SHARE
• Save carparks and favourite destinations like Office or Home
• Share a carpark or a list of results with friends
• Optional sign-in with Apple or Google to sync your saves across your iPhone and the web

HELP KEEP IT ACCURATE
Spotted a wrong rate or a missing carpark? Report it in the app, or check in to tell other drivers whether a carpark is full.

PRIVACY
No ads and no tracking. You can use the app without an account. Your location is only used to find carparks near you and is not stored. You can delete your account at any time from the app.

Carpark data comes from public sources including LTA DataMall, URA, HDB (data.gov.sg) and OneMap, plus operator rates and community reports. Rates can change, so check the signs at the carpark. wheretopark.sg is independent and not affiliated with any government agency or carpark operator.

Feedback: contact@wheretopark.sg
```

**Keywords (100, comma-separated, no spaces after commas)**

```
carpark,car park,hdb,ura,lta,lots,rates,price,ev charging,mall,cheap,motorcycle,height limit,waze
```

**URLs**

| Field | Value |
|---|---|
| Support URL | `https://wheretopark.sg/` (feedback link in the footer; contact@wheretopark.sg) |
| Marketing URL | `https://wheretopark.sg/` |
| Privacy Policy URL | `https://wheretopark.sg/privacy` |

## App Review information

| Field | Value |
|---|---|
| Sign-in required | No. Every feature except syncing saves works signed out |
| Demo account | Not needed: Sign in with Apple works with any Apple ID |
| Contact | Brahmasta Adipradana, contact@wheretopark.sg |

**Notes**

```
wheretopark.sg finds carparks in Singapore and estimates what parking will cost for your stay. It only has data for Singapore.

To try it: search "Orchard Road" (or "ION Orchard"), pick a result, then open a carpark for its rates, live lots and walking route. "Use my location" only works inside Singapore; elsewhere the app says so and suggests a search instead. You can simulate a Singapore location in Xcode, e.g. 1.3040, 103.8318.

No account is needed. Signing in (Sign in with Apple, or Google) only syncs saved carparks and destinations with the website. Account deletion is in Account > Delete account and also revokes the Sign in with Apple token.

Long-press the app icon for the Near me and Saved shortcuts. Links to wheretopark.sg/carpark/... open in the app.

Location is used only while the app is open, to search around the user, and is not stored.
```

## App Privacy (must match ios/App/App/PrivacyInfo.xcprivacy and /privacy)

Data used to track you: **None**.

Data linked to you:

| Data type | Purpose | Notes |
|---|---|---|
| Contact Info → Email Address | App Functionality | Only when signed in |
| Contact Info → Name | App Functionality | Only when signed in |
| Identifiers → User ID | App Functionality | Google / Apple account id |
| Search History | Analytics, App Functionality | Destination searches, linked while signed in |
| Usage Data → Product Interaction | Analytics | Viewed / saved carparks, maps app chosen |
| Other → Customer Support | App Functionality | Feedback and reports, with name and email |

Not collected: Location (used on device and in the request only, not stored),
Contacts, Photos, Financial, Health, Browsing History, Diagnostics.

## Screenshots

`screenshots/`: 6.9" set, 1320 × 2868 JPEG (no alpha), iPhone 18 Pro Max
simulator, signed out, light theme, Orchard Road. Upload in this order;
App Store Connect scales them down for smaller iPhones.

1. `1-results-list.jpg`: 42 carparks near Orchard Road, cheapest first
2. `2-results-map.jpg`: price pins on the map
3. `3-detail.jpg`: Emerald Link, cost, walking route
4. `4-rates.jpg`: rate schedule and community "How full is it now?"
5. `5-plan-stay.jpg`: Plan your stay
6. `6-home.jpg`: home (optional)

To retake: `xcrun simctl status_bar <device> override --time 9:41 ...`,
`xcrun simctl location <device> set 1.3040,103.8318`, then
`xcrun simctl io <device> screenshot` and convert with
`sips -s format jpeg -s formatOptions 92`.
