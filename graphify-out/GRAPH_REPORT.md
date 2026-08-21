# Graph Report - Yureka.One  (2026-08-20)

## Corpus Check
- 272 files · ~240,909 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1797 nodes · 4789 edges · 80 communities (76 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Gift Cards Hubble
- Brand Portal Core
- Admin Activity
- Admin Blog Notifs
- API Client Types
- Landing Motion UI
- SEO Structured Data
- Landing Navbar Hosts
- Design Ref Deps
- Gmail Ledger Scoring
- Brand Portal Inbox
- Auth Login Reset
- User Notifications
- Admin Waitlist Store
- Waitlist Public API
- Home Brands Section
- Mail Password Reset
- Backend Express Deps
- Expense Planning UI
- CueLinks Offers
- Brand Crawler HTML
- Planning Data Store
- Admin Auth Tokens
- Planning Types
- Planning Cache Files
- CMS Blog Store
- App Frontend Deps
- Outbound Browse Bridge
- Admin User Activity
- Gift Card Types
- App TSConfig
- In-App Gift Card Bar
- Page Meta Cache
- Transaction Categorize
- Landing Deps
- Goldback Home
- Explore Brand Scenes
- Marketplace Offers
- Node TSConfig
- PWA Install Prompt
- My Cards Cache
- Hero Cinematic
- Super Browse Store
- Hero Metrics Video
- Super Browse Grid
- Waitlist Form Parse
- Mail Transport Server
- Shared Package Deps
- Guest Gift Order Page
- Landing Page Shell
- Gift Cards Checkout UI
- Landing Scramble Nav
- Scrollytelling How-To
- Journal Blog UI
- Yureka AI Demo
- Dashboard Layout Scroll
- Browse Tracking Routes
- FAQ Components
- Zwitch Agency Pages
- Oxlintrc Rules
- Blog Media Upload
- Legacy Brands Marquee
- Native App Handoff
- In-App Browser Frame
- API Fetch Helpers
- Embed Proxy Rewrite
- Landing Callout Footer
- Error Boundary
- Supabase Admin Auth
- Hamburger Menu
- Partner Logos
- Firebase Analytics
- Root TSConfig
- Yureka Logo

## God Nodes (most connected - your core abstractions)
1. `react` - 115 edges
2. `registerAdminRoutes()` - 61 edges
3. `useSupabase()` - 48 edges
4. `registerGiftcardRoutes()` - 43 edges
5. `sanitizeBrowseUrl()` - 35 edges
6. `registerPlanningRoutes()` - 31 edges
7. `registerBrandRoutes()` - 28 edges
8. `isApiError()` - 27 edges
9. `findWaitlistByEmail()` - 24 edges
10. `mailUrls()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `InAppBrowserPage()` --calls--> `sanitizeBrowseUrl()`  [EXTRACTED]
  app/Dashboard/InAppBrowser.tsx → shared/inAppBrowse.ts
- `CareersPage()` --indirect_call--> `jobPostingSchema()`  [INFERRED]
  landing/CareersPage.tsx → backend/lib/seo/structuredData.ts
- `JournalPage()` --calls--> `useSupabase()`  [EXTRACTED]
  landing/JournalPage.tsx → shared/SupabaseProvider.tsx
- `AdminDashboard()` --calls--> `normalizeEmail()`  [EXTRACTED]
  app/AdminDashboard.tsx → backend/lib/mail/emailAddress.ts
- `AccountSettings()` --calls--> `isApiError()`  [EXTRACTED]
  app/Dashboard/AccountSettings.tsx → backend/lib/api/types.ts

## Import Cycles
- None detected.

## Communities (80 total, 4 thin omitted)

### Community 0 - "Gift Cards Hubble"
Cohesion: 0.06
Nodes (98): clearHubbleCaches(), clearHubbleProductCache(), config(), fetchAllGiftCards(), getAccessToken(), getGiftCard(), getHubbleOrder(), getHubbleOrderByReference() (+90 more)

### Community 1 - "Brand Portal Core"
Cohesion: 0.08
Nodes (78): BrandActivityChart(), emptyForm, Tab, decodeJwtPayload(), productUserIdOrFail(), resolveProductUserId(), resolveRequestEmail(), brandApi (+70 more)

### Community 2 - "Admin Activity"
Cohesion: 0.07
Nodes (69): AdminActivityEvent, AdminActivityKind, AdminDayPoint, AdminGiftOrderRow, AdminNamedCount, AdminUserRollup, buildAdminOverview(), ensure() (+61 more)

### Community 3 - "Admin Blog Notifs"
Cohesion: 0.07
Nodes (57): formatInr(), formatPaise(), GiftOrdersTab(), KIND_STYLE, OverviewTab(), ScoreBadge(), ScoreSignals(), timeAgo() (+49 more)

### Community 4 - "API Client Types"
Cohesion: 0.08
Nodes (47): ReferralDashboard(), RankResult, WaitingPage(), api, ApiOptions, pointsAtLocalhost, fromApiBlog(), fromApiCard() (+39 more)

### Community 5 - "Landing Motion UI"
Cohesion: 0.05
Nodes (12): messages, MESSAGES, Segment, WordsPullUpMultiStyleProps, WordsPullUpProps, clientsData, services, react (+4 more)

### Community 6 - "SEO Structured Data"
Cohesion: 0.10
Nodes (22): esc(), injectHtml(), replaceTag(), DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, staticPageMeta (+14 more)

### Community 7 - "Landing Navbar Hosts"
Cohesion: 0.09
Nodes (33): ForBrands(), JoinWaitlistButton(), NAV_LINKS, Navbar(), NavbarProps, randomChar(), ScrambleText(), ScrambleTextProps (+25 more)

### Community 8 - "Design Ref Deps"
Cohesion: 0.05
Nodes (39): autoprefixer, dependencies, framer-motion, lucide-react, react, react-dom, devDependencies, autoprefixer (+31 more)

### Community 9 - "Gmail Ledger Scoring"
Cohesion: 0.09
Nodes (38): calculate_age(), classify_order_signals(), classify_type_bill(), compute_yureka_score(), execute_bill_scanner(), execute_expense_scanner(), execute_financial_scanner(), extract_all_body_and_attachments() (+30 more)

### Community 10 - "Brand Portal Inbox"
Cohesion: 0.09
Nodes (30): BrandPortal(), Bills(), ParsedTransaction, BROWSE_NAV, InboxNotification, KEEP_ALIVE_TABS, NAV_ITEMS, NavItem (+22 more)

### Community 11 - "Auth Login Reset"
Cohesion: 0.16
Nodes (31): BrandLoginPage(), BrandResetPasswordPage(), LoginPage(), ResetPasswordPage(), anon, authCallbackUrl(), brandAuthCallbackUrl(), brandResetPasswordCallbackUrl() (+23 more)

### Community 12 - "User Notifications"
Cohesion: 0.15
Nodes (34): notifyGiftCardOutcome(), ensureWelcomeNotification(), firstName(), formatInrFromPaise(), notifyGiftCardFailed(), notifyGiftCardFulfilled(), notifyGoldbackEarn(), notifyScoreReady() (+26 more)

### Community 13 - "Admin Waitlist Store"
Cohesion: 0.20
Nodes (36): AdminAuthState, AdminFileStore, authFilePath(), countWaitlist(), createWaitlistEntry(), deleteAdmin(), deleteWaitlistEntry(), disableSupabaseSchema() (+28 more)

### Community 14 - "Waitlist Public API"
Cohesion: 0.14
Nodes (29): clearSupabaseCircuit(), findWaitlistByEmail(), upsertWaitlistJoin(), WaitlistJoinInput, WaitlistRow, bootstrapEmails(), fail(), ok() (+21 more)

### Community 15 - "Home Brands Section"
Cohesion: 0.08
Nodes (22): Architecture(), LAYERS, BrandEntry, BrandsSection(), ROW_1, ROW_2, ROW_3, ROW_4 (+14 more)

### Community 16 - "Mail Password Reset"
Cohesion: 0.21
Nodes (24): resetRedirectBase(), sendAppPasswordResetEmail(), notifyUsersNewBlog(), notifyGiftRecipientByEmail(), firstName(), sendAccountReadyEmail(), sendAdminInviteEmail(), sendApprovalEmail() (+16 more)

### Community 17 - "Backend Express Deps"
Cohesion: 0.06
Nodes (31): dependencies, compression, cors, dotenv, express, nodemailer, @supabase/supabase-js, tsx (+23 more)

### Community 18 - "Expense Planning UI"
Cohesion: 0.15
Nodes (28): categoryLabel(), csvCell(), ExpensePlanning(), exportCsv(), inr(), monthLabel(), spring, todayIso() (+20 more)

### Community 19 - "CueLinks Offers"
Cohesion: 0.14
Nodes (27): AFFILIATE_HOSTS, brandsFromOffers(), CueLinksBrand, homeUrlForHost(), listCueLinksBrands(), merchantHost(), applyIndiaFilter(), Cache (+19 more)

### Community 20 - "Brand Crawler HTML"
Cohesion: 0.13
Nodes (25): chrome(), crawlerContentHtml(), esc(), faqBlock(), howToBlock(), NAV, buildSitemapXml(), entry() (+17 more)

### Community 21 - "Planning Data Store"
Cohesion: 0.25
Nodes (28): addEntry(), addInbox(), deleteEntry(), deleteInbox(), disableSchema(), emptySnapshot(), filePath(), forceFileMode() (+20 more)

### Community 22 - "Admin Auth Tokens"
Cohesion: 0.17
Nodes (26): adminPasswordOk(), AdminRole, AdminSession, createAdminToken(), hashInviteToken(), hashPassword(), inviteTtlHours(), newInviteToken() (+18 more)

### Community 23 - "Planning Types"
Cohesion: 0.15
Nodes (24): buildAnalysis(), dayKey(), monthKey(), isSameMonth(), parseInr(), parseTxDate(), spendByCategory(), Envelope (+16 more)

### Community 24 - "Planning Cache Files"
Cohesion: 0.17
Nodes (26): deletePlanningCache(), planningCacheDirExists(), planningCachePath(), readPlanningCache(), ROOT, safeKey(), writePlanningCache(), applyOverrides() (+18 more)

### Community 25 - "CMS Blog Store"
Cohesion: 0.20
Nodes (25): estimateReadTime(), excerptFromHtml(), looksLikeHtml(), sanitizeBlogHtml(), slugFromTitle(), BlogContentFormat, BlogFileStore, BlogInput (+17 more)

### Community 26 - "App Frontend Deps"
Cohesion: 0.08
Nodes (24): dependencies, d3, framer-motion, lucide-react, motion, react, react-dom, react-router-dom (+16 more)

### Community 27 - "Outbound Browse Bridge"
Cohesion: 0.24
Nodes (20): OutboundBridge(), BLOCKED_HOSTS, browsePath(), embedFrameSrc(), IFRAME_OK_SUFFIXES, isAffiliateRedirectUrl(), isPrivateHost(), mobileWebBrowseUrl() (+12 more)

### Community 28 - "Admin User Activity"
Cohesion: 0.16
Nodes (21): AdminUserActivity, asNum(), buildUserActivity(), txAmount(), txAt(), txCategory(), txMerchant(), blogToApi() (+13 more)

### Community 29 - "Gift Card Types"
Cohesion: 0.17
Nodes (19): giftCardAmountAllowed(), normalizeDenominations(), buildGiftCardMatch(), cardMatchesHost(), findGiftCardForHost(), GiftCardMatch, HOST_ALIASES, hostTokens() (+11 more)

### Community 30 - "App TSConfig"
Cohesion: 0.08
Nodes (23): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+15 more)

### Community 31 - "In-App Gift Card Bar"
Cohesion: 0.17
Nodes (17): hideKey(), InAppGiftCardBar(), Props, spring, cache, extractProductPriceFromHtml(), fromHostPatterns(), fromJsonLd() (+9 more)

### Community 32 - "Page Meta Cache"
Cohesion: 0.15
Nodes (19): formatTitle(), PageMeta, BLOG_TIMEOUT_FALLBACK, cache, extraSchemas(), getCached(), NOT_FOUND_META, REDIRECTS (+11 more)

### Community 33 - "Transaction Categorize"
Cohesion: 0.13
Nodes (21): BILLS, categorizeTransaction(), dedupeTransactions(), EDUCATION, emptyCategorySpend(), enrichTransaction(), ENTERTAINMENT, FOOD (+13 more)

### Community 34 - "Landing Deps"
Cohesion: 0.09
Nodes (21): dependencies, framer-motion, lucide-react, motion, react, react-dom, react-markdown, react-router-dom (+13 more)

### Community 35 - "Goldback Home"
Cohesion: 0.14
Nodes (18): AccountSettings(), spring, springSnappy, cacheKey(), DESKTOP_QUICK, firstName(), FOR_YOU_LEFT, FOR_YOU_RIGHT (+10 more)

### Community 36 - "Explore Brand Scenes"
Cohesion: 0.14
Nodes (16): ExploreBrandScenes(), MotionLink, SceneCard(), spring, BrandLogo(), BrandLogoProps, storeLogo(), storeLogoSources() (+8 more)

### Community 37 - "Marketplace Offers"
Cohesion: 0.13
Nodes (17): ExploreScenePage(), dayGreeting(), DesktopHome(), MobileHome(), CATEGORY_COLORS, MarketCache, MarketplaceBrand, OffersPage() (+9 more)

### Community 38 - "Node TSConfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 39 - "PWA Install Prompt"
Cohesion: 0.21
Nodes (16): AddToHomeScreen(), BeforeInstallPromptEvent, isStandalone(), markDismissed(), markSessionShown(), Props, registerInstallServiceWorker(), wasDismissedRecently() (+8 more)

### Community 40 - "My Cards Cache"
Cohesion: 0.17
Nodes (17): ALL_BANKS, BANK_LOGOS, MyCards(), toSnakeCard(), UserOwnedCard, AUTH_EMAIL_KEY, AUTH_STATUS_KEY, CACHE_TTL (+9 more)

### Community 41 - "Hero Cinematic"
Cohesion: 0.22
Nodes (12): GlassLayer(), HeroCinematic(), HeroCinematicProps, HeroMobile(), randomChar(), ScrambleIn(), ScrambleInProps, ScrollScrubVideo() (+4 more)

### Community 42 - "Super Browse Store"
Cohesion: 0.29
Nodes (17): deleteSuperBrowseStore(), domainFromUrl(), filePath(), FileStore, getSupabase(), isMissingSchemaError(), listSuperBrowseStores(), mapRow() (+9 more)

### Community 43 - "Hero Metrics Video"
Cohesion: 0.20
Nodes (11): HeroCinematic(), HeroCinematicProps, FEATURES, METRICS, MetricsTechnology(), randomChar(), ScrambleIn(), ScrambleInProps (+3 more)

### Community 44 - "Super Browse Grid"
Cohesion: 0.20
Nodes (10): spring, StoreTile(), SuperBrowseGrid(), EMBED_HOST_SUFFIXES, fetchSuperBrowseStores(), SUPER_BROWSE_STORES, SuperBrowseStore, prefetchSuperBrowseLinks() (+2 more)

### Community 45 - "Waitlist Form Parse"
Cohesion: 0.18
Nodes (13): ALL_BANKS, BANK_LOGOS, base64UrlDecode(), DISCOVERY_SOURCES, extractBodyText(), normalizeGender(), parseDobToInputDate(), ParsedTransaction (+5 more)

### Community 46 - "Mail Transport Server"
Cohesion: 0.21
Nodes (10): fromAddress(), getMailTransport(), MailTransport, __dirname, ensurePythonDeps(), __filename, resolvePythonExecutable(), startServer() (+2 more)

### Community 47 - "Shared Package Deps"
Cohesion: 0.14
Nodes (13): dependencies, react, react-dom, react-router-dom, @supabase/supabase-js, description, react, react-dom (+5 more)

### Community 48 - "Guest Gift Order Page"
Cohesion: 0.24
Nodes (7): StoredOrder, formatInr(), GiftOrderStatusPage(), Footer(), Loader(), LoaderProps, YurekaBrandMark()

### Community 49 - "Landing Page Shell"
Cohesion: 0.19
Nodes (8): App(), Architecture(), LAYERS, FAQS, FAQSection(), Footer(), Loader(), Navbar()

### Community 50 - "Gift Cards Checkout UI"
Cohesion: 0.29
Nodes (10): cardAmountLabel(), flexiblePresets(), formatInr(), GiftCache, giftCacheKey(), GiftCardsPage(), loadRazorpayScript(), prettyCategory() (+2 more)

### Community 51 - "Landing Scramble Nav"
Cohesion: 0.24
Nodes (7): LoaderProps, NavbarProps, randomChar(), ScrambleText(), ScrambleTextProps, YurekaLogo(), YurekaLogoProps

### Community 52 - "Scrollytelling How-To"
Cohesion: 0.24
Nodes (7): fadeUp(), HowItWorksStepper(), ParagraphRevealProps, WordRevealProps, lerp(), ScrollytellingVideo(), ScrollytellingVideoProps

### Community 53 - "Journal Blog UI"
Cohesion: 0.22
Nodes (7): CATEGORIES, JournalPage(), spring, TweetCard, tweets, ImageWithLoader(), ImageWithLoaderProps

### Community 54 - "Yureka AI Demo"
Cohesion: 0.20
Nodes (9): CAPABILITIES, CLAY_TONE, COLOR_MAP, DEMO_CHAT, GOLD_TONE, LiveChatDemo(), renderText(), STATS (+1 more)

### Community 55 - "Dashboard Layout Scroll"
Cohesion: 0.42
Nodes (8): DashboardLayout(), dashboardScrollRoot(), pathKey(), rememberBrowseReturn(), restoreDashboardPosition(), restoreDashboardScroll(), saveDashboardScroll(), scrollDashboardToId()

### Community 56 - "Browse Tracking Routes"
Cohesion: 0.42
Nodes (8): fail(), ok(), registerBrowseRoutes(), requireUser(), hostMatches(), resolveSuperBrowseLinks(), resolveTrackedOpen(), TrackedOpen

### Community 57 - "FAQ Components"
Cohesion: 0.24
Nodes (4): FaqItem, faqQuestions, FAQItemProps, FAQSection()

### Community 58 - "Zwitch Agency Pages"
Cohesion: 0.27
Nodes (5): About(), stats, Hero(), projects, Work()

### Community 59 - "Oxlintrc Rules"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 60 - "Blog Media Upload"
Cohesion: 0.36
Nodes (7): ALLOWED, BLOG_IMAGE_BUCKET, BLOG_IMAGE_MAX_BYTES, ensureBucket(), extFrom(), serviceClient(), uploadBlogImage()

### Community 61 - "Legacy Brands Marquee"
Cohesion: 0.25
Nodes (5): BrandsSection(), ROW_1, ROW_2, ROW_3, ROW_4

### Community 62 - "Native App Handoff"
Cohesion: 0.32
Nodes (4): NATIVE_APP_SCHEME, nativeAuthCallbackUrl(), shouldHandoffToNativeApp(), tryHandoffOAuthCodeToNativeApp()

### Community 63 - "In-App Browser Frame"
Cohesion: 0.38
Nodes (6): iframeLooksBlocked(), InAppBrowserFrame(), InAppBrowserPage(), Props, readIframePageUrl(), spring

### Community 64 - "API Fetch Helpers"
Cohesion: 0.29
Nodes (7): apiFetch(), errorResponse(), brandFetch(), goldbackFetch(), planningFetch(), getAuthAccessToken(), authBrowseHeaders()

### Community 65 - "Embed Proxy Rewrite"
Cohesion: 0.57
Nodes (6): escapeAttr(), fetchAllowed(), interceptScript(), registerEmbedRoutes(), rewriteHtml(), isEmbedHostAllowed()

### Community 66 - "Landing Callout Footer"
Cohesion: 0.29
Nodes (5): COMPANY_LINKS, PRODUCT_LINKS, RESOURCE_LINKS, SOCIAL_ICONS, YurekaCallout()

### Community 67 - "Error Boundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 69 - "Supabase Admin Auth"
Cohesion: 0.70
Nodes (4): createAppAuthUser(), findAuthUserByEmail(), getServiceClient(), isAlreadyRegistered()

### Community 70 - "Hamburger Menu"
Cohesion: 0.40
Nodes (4): SIZES, spring, SquashHamburger(), SquashHamburgerProps

## Knowledge Gaps
- **391 isolated node(s):** `AdminRole`, `Tab`, `Envelope`, `STATUS_TABS`, `spring` (+386 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Landing Motion UI` to `Brand Portal Core`, `Admin Blog Notifs`, `API Client Types`, `SEO Structured Data`, `Landing Navbar Hosts`, `Brand Portal Inbox`, `Auth Login Reset`, `Home Brands Section`, `Expense Planning UI`, `Brand Crawler HTML`, `Outbound Browse Bridge`, `Gift Card Types`, `In-App Gift Card Bar`, `Page Meta Cache`, `Goldback Home`, `Explore Brand Scenes`, `Marketplace Offers`, `PWA Install Prompt`, `My Cards Cache`, `Hero Cinematic`, `Hero Metrics Video`, `Super Browse Grid`, `Waitlist Form Parse`, `Guest Gift Order Page`, `Landing Page Shell`, `Gift Cards Checkout UI`, `Landing Scramble Nav`, `Scrollytelling How-To`, `Journal Blog UI`, `Yureka AI Demo`, `FAQ Components`, `Zwitch Agency Pages`, `Oxlintrc Rules`, `In-App Browser Frame`, `Error Boundary`, `Skeleton Loaders`, `Partner Logos`?**
  _High betweenness centrality (0.317) - this node is a cross-community bridge._
- **Why does `registerAdminRoutes()` connect `Admin Auth Tokens` to `Brand Portal Core`, `Admin Activity`, `Supabase Admin Auth`, `Super Browse Store`, `User Notifications`, `Admin Waitlist Store`, `Waitlist Public API`, `Blog Media Upload`, `Mail Password Reset`, `Mail Transport Server`, `CMS Blog Store`, `Admin User Activity`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `sanitizeBrowseUrl()` connect `Outbound Browse Bridge` to `Gift Cards Hubble`, `Embed Proxy Rewrite`, `Marketplace Offers`, `Super Browse Grid`, `Browse Tracking Routes`, `In-App Gift Card Bar`, `In-App Browser Frame`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `registerAdminRoutes()` (e.g. with `requireAdmin()` and `blogToApi()`) actually correct?**
  _`registerAdminRoutes()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AdminRole`, `Tab`, `Envelope` to the rest of the system?**
  _391 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gift Cards Hubble` be split into smaller, more focused modules?**
  _Cohesion score 0.05512820512820513 - nodes in this community are weakly interconnected._
- **Should `Brand Portal Core` be split into smaller, more focused modules?**
  _Cohesion score 0.08179271708683473 - nodes in this community are weakly interconnected._