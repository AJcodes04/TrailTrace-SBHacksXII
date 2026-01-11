# Route Generation Strategy: Drawing to Safe Routes

## Current Implementation

You're currently using **OSRM (Open Source Routing Machine)** which is excellent for routing, but the drawing-to-route conversion is the missing piece. Here's the best approach:

## Recommended Architecture

### Phase 1: Drawing Interpretation (AI/ML)

**Option A: Computer Vision + Path Extraction (Recommended for Hackathon)**

**Tools:**
1. **OpenCV.js** (Client-side) or **OpenCV Python** (Backend)
   - Extract path/skeleton from drawing
   - Convert stroke to coordinate points
   - Clean up noise and simplify paths

2. **TensorFlow.js / MediaPipe**
   - Hand drawing detection and recognition
   - Line/figure detection
   - Shape classification (heart, letter, animal, etc.)

3. **Claude/GPT-4 Vision API** (Anthropic/OpenAI)
   - Analyze drawing and extract key waypoints
   - Understand user intent (shape, complexity)
   - Generate semantic waypoints

**Why this works:**
- **OpenCV**: Extract actual path coordinates from canvas drawings
- **MediaPipe**: Real-time drawing detection (if using touch/pen input)
- **Vision AI**: Understand context (e.g., "this looks like a heart near campus")

**Implementation:**
```javascript
// 1. Capture drawing as image/coordinates
const drawingPoints = canvas.getPath() // Array of {x, y}

// 2. Convert to geographic coordinates
const geoWaypoints = drawingPoints.map(point => {
  // Convert canvas coordinates to lat/lng based on map bounds
  return canvasToGeo(point, mapBounds)
})

// 3. Use OSRM (already implemented) to route between waypoints
const route = await snapToRoads(geoWaypoints, 'walking')
```

---

### Phase 2: Route Generation (Your Current Stack + Enhancements)

**Current: OSRM** ✅ (Good foundation)

**Enhancements:**

1. **GraphHopper API** (Alternative/Complement to OSRM)
   - More flexible routing options
   - Better pedestrian/cycling profiles
   - Commercial tier available

2. **Mapbox Directions API**
   - Excellent routing with customizable profiles
   - Better for production (paid but reliable)
   - Great documentation

3. **Google Maps Directions API**
   - Most reliable, best road data
   - Expensive but excellent quality
   - Good for demo/prototype

---

### Phase 3: Safety Integration (Critical Feature)

**Crime Data Sources:**

1. **FBI UCR Data** (Public)
   - Aggregated crime statistics by area
   - Free but requires processing

2. **SpotCrime API**
   - Real-time crime data
   - Paid API (~$50-200/month)
   - Good coverage for urban areas

3. **Crimemapping.com API**
   - Public crime data
   - Some areas have open APIs

4. **Local Police Department APIs**
   - Santa Barbara Police data
   - Many cities have open data portals

**Safety Scoring Algorithm:**
```javascript
function calculateSafetyScore(route, crimeData) {
  let score = 100
  const segments = getRouteSegments(route)
  
  segments.forEach(segment => {
    const crimes = getCrimesInArea(segment, crimeData)
    const density = crimes.length / segment.length
    score -= density * 10 // Penalize high crime density
  })
  
  return Math.max(0, Math.min(100, score))
}
```

---

## Most Powerful AI Tools (Ranked)

### Tier 1: Vision + Route Generation (Best for Hackathon)

1. **Claude 3.5 Sonnet / GPT-4 Vision** (Anthropic/OpenAI)
   - **Use Case**: Analyze drawing, extract waypoints, understand intent
   - **API Cost**: ~$0.01-0.03 per image
   - **Integration**: Easy REST API
   - **Example**:
     ```javascript
     const response = await fetch('https://api.anthropic.com/v1/messages', {
       method: 'POST',
       headers: {
         'x-api-key': API_KEY,
         'anthropic-version': '2023-06-01',
         'content-type': 'application/json'
       },
       body: JSON.stringify({
         model: 'claude-3-5-sonnet-20241022',
         max_tokens: 1024,
         messages: [{
           role: 'user',
           content: [
             {
               type: 'image',
               source: {
                 type: 'base64',
                 media_type: 'image/png',
                 data: drawingImageBase64
               }
             },
             {
               type: 'text',
               text: 'Extract key waypoints from this drawing. Return as JSON array of {lat, lng} coordinates around UCSB campus area.'
             }
           ]
         }]
       })
     })
     ```

2. **OpenCV.js** (Open Source)
   - **Use Case**: Extract path coordinates from drawing strokes
   - **Cost**: Free
   - **Integration**: Client-side or server-side
   - **Best for**: Converting canvas strokes to coordinate arrays

### Tier 2: Route Optimization

3. **OR-Tools** (Google)
   - **Use Case**: Optimize waypoint order (TSP - Traveling Salesman Problem)
   - **Cost**: Free (open source)
   - **Language**: Python/C++ (can be called from Node.js)

4. **Valhalla Routing Engine**
   - **Use Case**: Advanced routing with elevation, multimodal transport
   - **Cost**: Self-hosted (free) or Mapbox (paid)
   - **Better than OSRM for**: Complex route preferences

### Tier 3: Pattern Recognition

5. **TensorFlow.js Models**
   - **Use Case**: Pre-trained models for shape recognition
   - **Cost**: Free
   - **Best for**: Classifying drawings (heart, letter, animal)

---

## Recommended Implementation for SB Hacks

### Quick Win Approach (2-3 hours)

1. **Capture drawing coordinates directly**
   - No AI needed initially
   - User draws on map canvas
   - Get waypoints from drawing strokes
   - Use existing OSRM routing

2. **Add basic safety scoring**
   - Use static crime heatmap data (pre-loaded)
   - Calculate score based on route segments
   - Display safety badge

### Enhanced Approach (Full Hackathon)

1. **OpenCV.js for path extraction**
   ```bash
   npm install opencv-js
   ```
   - Extract coordinates from canvas drawing
   - Clean and simplify path
   - Convert to waypoints

2. **Claude/GPT-4 Vision for intent understanding**
   - Analyze drawing if uploaded as image
   - Extract waypoints with context
   - Understand desired shape/complexity

3. **OSRM (current) + Safety scoring**
   - Route between waypoints
   - Apply safety penalties
   - Re-route if safety score too low

4. **Fallback to GraphHopper if OSRM fails**
   - More reliable routing
   - Better for production demos

---

## Code Example: Drawing to Route Pipeline

```typescript
async function convertDrawingToRoute(
  drawingCanvas: HTMLCanvasElement,
  mapBounds: MapBounds,
  safetyThreshold: number = 70
): Promise<Route> {
  
  // Step 1: Extract waypoints from drawing
  const waypoints = extractWaypointsFromCanvas(drawingCanvas, mapBounds)
  
  // Step 2: (Optional) Use AI to refine waypoints
  // const refinedWaypoints = await refineWithVisionAI(drawingCanvas, waypoints)
  
  // Step 3: Route between waypoints (existing OSRM code)
  let route = await snapToRoads(waypoints, 'walking', true, true)
  
  // Step 4: Calculate safety score
  const safetyScore = await calculateSafetyScore(route, crimeData)
  
  // Step 5: If safety too low, try alternative routes
  if (safetyScore < safetyThreshold) {
    route = await findSaferRoute(waypoints, safetyThreshold)
  }
  
  // Step 6: Optimize route (remove unnecessary detours)
  route.coordinates = optimizeRouteShape(route.coordinates)
  
  return route
}

function extractWaypointsFromCanvas(
  canvas: HTMLCanvasElement,
  bounds: MapBounds
): Coordinate[] {
  // Get drawing path data (you'd implement this based on your canvas library)
  const strokes = canvas.getStrokes() // Pseudo-code
  
  // Convert canvas coordinates to geographic
  return strokes.map(stroke => ({
    lat: bounds.south + (stroke.y / canvas.height) * (bounds.north - bounds.south),
    lng: bounds.west + (stroke.x / canvas.width) * (bounds.east - bounds.west)
  }))
}
```

---

## Resources & APIs

### Free/Open Source
- **OSRM**: https://project-osrm.org/ (current)
- **OpenCV.js**: https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html
- **OR-Tools**: https://developers.google.com/optimization
- **FBI UCR Data**: https://www.fbi.gov/services/cjis/ucr

### Paid but Powerful
- **Mapbox Directions API**: $0.50 per 1,000 requests
- **Google Maps API**: $5 per 1,000 requests
- **SpotCrime API**: $50-200/month
- **Claude API**: $0.003 per 1K tokens (very cheap)

### Recommended Stack for Demo
1. **Drawing**: Canvas API (native) or Fabric.js
2. **Path Extraction**: OpenCV.js or direct coordinate capture
3. **Routing**: OSRM (current) + Mapbox as backup
4. **Safety**: Pre-loaded crime data (static for demo)
5. **AI Enhancement** (optional): Claude Vision API for shape understanding

---

## Next Steps

1. ✅ **Keep OSRM** - It's working well
2. 🔄 **Add coordinate extraction** - Capture drawing as waypoints
3. 🆕 **Integrate safety scoring** - Use crime data
4. ⭐ **Add AI vision** (optional) - Claude/GPT-4 for better waypoint extraction
5. 🚀 **Optimize route shape** - Ensure it matches the drawing

The key insight: **You don't need complex AI** - you need good coordinate extraction from drawings + your existing OSRM routing + safety data overlay.

