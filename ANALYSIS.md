# TrailTrace Application Analysis

**Generated:** January 10, 2026  
**Project:** TrailTrace-SBHacksXII  
**Framework:** Next.js 14 (App Router)  
**Language:** TypeScript

---

## Executive Summary

TrailTrace is a **multi-featured Next.js web application** that combines:
1. **Primary Feature**: Running route generator with drawing-to-route conversion
2. **Secondary Feature**: Nutrition/barcode scanner (macroscanner)
3. **Integrations**: Strava OAuth integration for activity uploads
4. **Authentication**: Firebase Authentication (GitHub OAuth)

The application appears to be built for **SB Hacks XII** hackathon, combining fitness tracking with nutrition tracking capabilities.

---

## Architecture Overview

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18.3
- TypeScript
- TailwindCSS
- Leaflet + react-leaflet (mapping)
- Leaflet Draw (drawing tools)

**Backend/Infrastructure:**
- Next.js API Routes
- Firebase Authentication (client + admin)
- Firebase Firestore (user data storage)
- OSRM (Open Source Routing Machine) - Custom VPS instance at `178.128.70.119:5000`
- Strava OAuth API

**Key Dependencies:**
- `firebase` & `firebase-admin` - Authentication & database
- `leaflet` & `react-leaflet` - Map rendering
- `leaflet-draw` - Drawing interface
- `sharp` - Image processing
- `zod` - Schema validation (used in nutrition API)

---

## Feature Analysis

### 1. Running Route Generator (Primary Feature)

**Location:** `/app/map/page.tsx`, `/components/RouteMap.tsx`, `/components/DrawingCanvas.tsx`

**Functionality:**
- Interactive map centered on Southern California (Los Angeles area)
- Drawing canvas for user-created routes
- OSRM routing engine integration for snapping paths to roads
- Waypoint dragging and manipulation
- Route visualization with polyline overlays

**Key Components:**
- `RouteMap.tsx` - Main map component using Leaflet
- `DrawingCanvas.tsx` - HTML5 canvas for drawing routes
- `routeHelpers.ts` - Routing utilities (snapToRoads, path optimization, etc.)

**Current Implementation Status:**
- ✅ Map rendering with OpenStreetMap tiles
- ✅ Drawing interface (canvas-based)
- ✅ OSRM routing integration
- ✅ Waypoint dragging
- ✅ Route snapping to roads
- ⚠️ Safety scoring (mentioned in docs, not fully implemented)
- ⚠️ Route sharing/social features (UI exists, backend unclear)

**Technical Details:**
- Uses custom OSRM server at `178.128.70.119:5000`
- Routes coordinates through OSRM `/route` API with walking profile
- Converts canvas coordinates to geographic coordinates
- Supports multiple routes on single map
- Dynamic route generation from drawings

---

### 2. Landing Page / Marketing Site

**Location:** `/app/page.tsx`

**Functionality:**
- Marketing/landing page with dark mode support
- Sections: Overview, How it works, Safety, For friends, Get started
- Modern UI with TailwindCSS
- Smooth scrolling navigation
- Responsive design (mobile + desktop)

**Features Highlighted:**
- Draw any route shape (hearts, letters, etc.)
- Safety-aware routing (crime data integration - planned)
- Social features (share routes with friends - planned)
- Route generation from sketches

---

### 3. Nutrition Scanner (Macroscanner)

**Location:** `/app/macroscanner/page.tsx`, `/app/api/nutrition/route.ts`

**Functionality:**
- Barcode scanning for nutrition information
- Multiple item management
- Nutrition scoring system
- Combined nutrition calculations

**Status: ⚠️ INCOMPLETE**
- API route exists (`/app/api/nutrition/route.ts`)
- References missing dependencies:
  - `@/core/lookup` - Nutrition lookup function
  - `@/lib/scoring-engine` - Nutrition scoring
  - `@/lib/combine-nutrition` - Combine nutrition results
- Components exist but may not function without backend:
  - `NutritionDashboard.tsx`
  - `BarcodeCapture.tsx`
  - `NutritionFactsTable.tsx`
  - `ScoringCard.tsx`
  - `MultiItemManager.tsx`

**Components Present:**
- `NutritionDashboard.tsx` - Main dashboard
- `BarcodeCapture.tsx` - Barcode scanning UI
- `NutritionFactsTable.tsx` - Nutrition facts display
- `ScoringSection.tsx` - Scoring UI
- `MultiItemManager.tsx` - Multiple items management
- `DerivedMetrics.tsx` - Calculated metrics
- `IngredientsList.tsx` - Ingredients display
- `SourceAndWarnings.tsx` - Source attribution
- `FlagsDisplay.tsx` - Warning flags

**API Endpoints:**
- `GET /api/nutrition?barcode=XXX` - Single item lookup
- `POST /api/nutrition` - Multiple items lookup with servings

---

### 4. Authentication System

**Location:** `/app/login/page.tsx`, `/components/AuthWidget.tsx`, `/app/api/auth/session/route.ts`

**Implementation:**
- Firebase Authentication with GitHub OAuth
- Session cookie management
- Server-side session validation
- Client-side auth state management

**Flow:**
1. User clicks "Sign in with GitHub"
2. Firebase popup authentication
3. Client receives ID token
4. Client sends ID token to `/api/auth/session` (POST)
5. Server creates session cookie (5-day expiration)
6. Session cookie used for authenticated requests

**Files:**
- `lib/firebaseClient.ts` - Client-side Firebase config
- `lib/firebaseAdmin.ts` - Server-side Firebase admin
- `lib/getServerUser.ts` - Server-side user retrieval
- `app/api/auth/session/route.ts` - Session cookie management

---

### 5. Strava Integration

**Location:** `/app/api/strava/*`, `/components/ConnectStravaButton.tsx`, `/components/UploadGpx.tsx`

**Functionality:**
- OAuth flow with Strava
- Token storage in Firestore
- Token refresh mechanism
- GPX file upload to Strava
- Upload status tracking

**API Routes:**
- `GET /api/strava/authorize` - Initiate OAuth flow
- `GET /api/strava/callback` - OAuth callback handler
- `POST /api/strava/upload` - Upload GPX file
- `GET /api/strava/upload-status` - Check upload status

**Implementation Details:**
- Tokens stored in Firestore: `users/{uid}/integrations/strava`
- Automatic token refresh (60s buffer before expiration)
- Scope: `activity:write`
- Supports GPX file uploads

**Components:**
- `ConnectStravaButton.tsx` - Connect/disconnect Strava
- `UploadGpx.tsx` - GPX file upload interface

---

### 6. Settings Page

**Location:** `/app/settings/page.tsx`

**Simple page containing:**
- Strava connection button
- GPX upload component

---

## Project Structure

```
TrailTrace-SBHacksXII/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── auth/session/         # Session cookie management
│   │   ├── nutrition/            # Nutrition API (incomplete)
│   │   └── strava/               # Strava integration
│   ├── login/                    # Login page
│   ├── map/                      # Main route generator page
│   ├── macroscanner/             # Nutrition scanner page
│   ├── settings/                 # Settings page
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/                   # React components
│   ├── RouteMap.tsx              # Main map component
│   ├── DrawingCanvas.tsx         # Drawing interface
│   ├── AuthWidget.tsx            # Auth UI
│   ├── ConnectStravaButton.tsx   # Strava integration
│   ├── UploadGpx.tsx             # GPX upload
│   └── [Nutrition components]    # 8+ nutrition components
├── lib/                          # Libraries/utilities
│   ├── firebaseClient.ts         # Firebase client config
│   ├── firebaseAdmin.ts          # Firebase admin config
│   ├── getServerUser.ts          # Server user retrieval
│   └── strava.ts                 # Strava token management
├── utils/
│   └── routeHelpers.ts           # Route generation utilities (1000+ lines)
├── types/
│   └── route.ts                  # TypeScript interfaces
└── Documentation/
    ├── README.md                 # Basic project info
    ├── ROUTE_GENERATION_STRATEGY.md  # Route generation docs
    └── FIRST_STEP.md             # Implementation guide
```

---

## Key Implementation Details

### Route Generation Pipeline

1. **User draws on canvas** → `DrawingCanvas.tsx` captures strokes
2. **Canvas coordinates converted** → Geographic lat/lng coordinates
3. **Waypoints extracted** → Key points from drawing
4. **OSRM routing** → `snapToRoads()` function routes through waypoints
5. **Route displayed** → Leaflet polyline overlay on map

### Route Helpers (`utils/routeHelpers.ts`)

Large utility file (1000+ lines) with functions:
- `snapToRoads()` - Route waypoints through OSRM
- `snapToNearestRoad()` - Snap single point to nearest road
- `snapMultipleToNearestRoad()` - Batch snapping
- `smoothPath()` - Path smoothing algorithms
- `removeRedundantLoops()` - Loop detection and removal
- `optimizeWaypointOrder()` - TSP-like optimization
- Path simplification and optimization algorithms

### OSRM Integration

- Custom VPS instance: `http://178.128.70.119:5000`
- Walking profile for pedestrian routes
- Batch processing with rate limiting
- Caching mechanism for performance

---

## Issues & Missing Components

### Critical Issues

1. **Nutrition Feature Incomplete**
   - Missing `@/core/lookup` module
   - Missing `@/lib/scoring-engine` module
   - Missing `@/lib/combine-nutrition` module
   - Components exist but backend incomplete
   - API routes reference non-existent functions

2. **Safety Scoring Not Implemented**
   - Mentioned in documentation and landing page
   - No implementation found in codebase
   - Crime data integration planned but not present

3. **Route Sharing/Social Features**
   - UI elements suggest social features
   - No backend implementation for sharing routes
   - No user profile or route storage system

### Minor Issues

1. **Type Safety**
   - Some `any` types in Strava callback handling
   - Canvas event handling uses type assertions

2. **Error Handling**
   - Limited error handling in route generation
   - No user-friendly error messages in some areas

3. **Documentation**
   - README is outdated (doesn't mention nutrition, Strava, auth)
   - Missing API documentation
   - No environment variable documentation

---

## Environment Variables Required

Based on code analysis, the following environment variables are needed:

**Firebase:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_PRIVATE_KEY` (for server-side)
- `FIREBASE_ADMIN_CLIENT_EMAIL` (for server-side)

**Strava:**
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI` (optional, defaults to `/api/strava/callback`)

**General:**
- `NODE_ENV` (production/development)

---

## Strengths

1. **Well-Structured Codebase**
   - Clear separation of concerns
   - TypeScript for type safety
   - Component-based architecture
   - API routes properly organized

2. **Modern Tech Stack**
   - Next.js 14 App Router
   - Latest React patterns
   - Firebase for auth (production-ready)
   - OSRM for routing (open-source, reliable)

3. **Feature-Rich Route Generator**
   - Drawing interface works
   - OSRM integration functional
   - Waypoint manipulation
   - Route optimization algorithms

4. **Professional UI**
   - Beautiful landing page
   - Dark mode support
   - Responsive design
   - Modern TailwindCSS styling

---

## Recommendations

### High Priority

1. **Complete Nutrition Feature**
   - Implement `@/core/lookup` module (barcode API integration)
   - Implement `@/lib/scoring-engine` (nutrition scoring algorithm)
   - Implement `@/lib/combine-nutrition` (combine multiple items)
   - Choose barcode API (Open Food Facts, USDA, etc.)

2. **Update Documentation**
   - Update README with all features
   - Document environment variables
   - Add API documentation
   - Document route generation workflow

3. **Fix Missing Dependencies**
   - Create missing modules or remove nutrition feature
   - Add error handling for missing modules
   - Update imports to match actual file structure

### Medium Priority

1. **Implement Safety Scoring**
   - Integrate crime data source
   - Implement safety scoring algorithm
   - Add safety visualization on map
   - Show safety scores in route details

2. **Route Storage & Sharing**
   - Add Firestore collection for routes
   - Implement route saving
   - Add route sharing functionality
   - Create route discovery/browsing

3. **Error Handling**
   - Add comprehensive error handling
   - User-friendly error messages
   - Error logging
   - Retry mechanisms for API calls

### Low Priority

1. **Testing**
   - Add unit tests for utilities
   - Integration tests for API routes
   - E2E tests for critical flows

2. **Performance Optimization**
   - Route caching
   - Image optimization
   - Code splitting
   - Bundle size optimization

3. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Screen reader support
   - Color contrast improvements

---

## Code Quality Metrics

**Overall: Good**

- ✅ TypeScript for type safety
- ✅ Modern React patterns (hooks, functional components)
- ✅ Clear component structure
- ✅ API routes properly organized
- ⚠️ Some missing implementations
- ⚠️ Documentation could be better
- ⚠️ Error handling needs improvement

**Estimated Completion:**
- Route Generator: ~85% complete
- Authentication: ~95% complete
- Strava Integration: ~90% complete
- Nutrition Feature: ~40% complete (frontend done, backend missing)
- Safety Features: ~10% complete (planned, not implemented)

---

## Conclusion

TrailTrace is a **well-architected hackathon project** with a solid foundation. The primary route generation feature is **largely functional** and demonstrates good engineering practices. The nutrition feature appears to be a **secondary addition** that is incomplete, with missing backend modules.

The application shows potential for a production-ready fitness tracking app, but would need:
1. Completion of nutrition backend
2. Implementation of safety scoring
3. Route storage and sharing features
4. Comprehensive testing and error handling

**Recommended Next Steps:**
1. Decide whether to complete or remove nutrition feature
2. Update README with current state
3. Implement missing modules or remove broken references
4. Add environment variable documentation
5. Test all features end-to-end
