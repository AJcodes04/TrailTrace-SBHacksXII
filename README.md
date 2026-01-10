# TrailTrace - Running Route Generator

A Next.js web application providing a GPS map foundation for running route generation in Southern California. Built with OpenStreetMap and Leaflet.

## Features

- 🗺️ Interactive map rendering with OpenStreetMap tiles
- 🏃 Support for polyline route overlays
- 🔍 Zoom and pan controls
- 📍 Centered on Southern California (Los Angeles area)
- 🎯 Ready for AI-generated route integration
- 🚀 Next.js 14 with App Router
- ⚡ TypeScript for type safety

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Map Library**: Leaflet with react-leaflet
- **Map Provider**: OpenStreetMap
- **Language**: TypeScript
- **Styling**: CSS (no dependencies)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Main page with map integration
│   └── globals.css      # Global styles and Leaflet CSS
├── components/
│   └── RouteMap.tsx     # Main map component with polyline support
├── types/
│   └── route.ts         # TypeScript interfaces for routes
├── utils/
│   └── routeHelpers.ts  # Helper functions for route creation and validation
└── package.json
```

## Usage

### Adding Routes Programmatically

The `RouteMap` component accepts a `routes` prop containing an array of route objects:

```typescript
import RouteMap from '@/components/RouteMap'
import { createRoute } from '@/utils/routeHelpers'

// Using helper function (recommended)
const route = createRoute(
  [
    { lat: 34.0522, lng: -118.2437 },
    { lat: 34.0620, lng: -118.2500 },
    // ... more coordinates
  ],
  {
    id: 'route-1',
    name: 'My Running Route',
    color: '#3b82f6',
    weight: 5,
    opacity: 0.8,
  }
)

// Or create manually
const routes: Route[] = [
  {
    id: 'route-1',
    name: 'My Running Route',
    coordinates: [
      { lat: 34.0522, lng: -118.2437 },
      { lat: 34.0620, lng: -118.2500 },
    ],
    color: '#3b82f6',
    weight: 5,
    opacity: 0.8,
  }
]

<RouteMap routes={routes} />
```

### Route Interface

```typescript
interface Route {
  id?: string
  name?: string
  coordinates: Coordinate[]  // Array of {lat, lng} points
  color?: string            // Hex color (default: '#3b82f6')
  weight?: number           // Line width (default: 5)
  opacity?: number          // Line opacity (default: 0.8)
}
```

### Map Configuration

- **Initial Center**: Los Angeles area (34.0522°N, 118.2437°W)
- **Initial Zoom**: 10
- **Map Provider**: OpenStreetMap tiles
- **Auto-fit bounds**: Enabled when routes are provided

## Next Steps

The application is designed to be extended with:

1. **Backend Integration**: Connect to a routing engine API
2. **AI Route Generation**: Overlay AI-generated running routes
3. **Route Management**: Add/edit/delete routes
4. **Route Optimization**: Implement route optimization algorithms
5. **Elevation Data**: Add elevation profiles and terrain analysis

## SSR Considerations

The map component is dynamically imported with `ssr: false` to avoid hydration errors, as Leaflet requires browser APIs. This is handled automatically in `app/page.tsx`.

## License

MIT

