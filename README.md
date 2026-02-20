# NextNEXRAD: WSR-88D Radar Coverage Analysis Tool

## Overview

Interactive GIS application for analyzing NEXRAD weather radar coverage gaps across the United States. Users can simulate placement of hypothetical radar installations and quantify improvements in coverage for specific USGS hydrologic basins, measuring both geographic area and population affected.

The core problem: existing NEXRAD radar sites have terrain-blocked coverage zones. This tool computes blockage masks using a physics-based beam propagation model, then intersects those masks with watershed boundaries to produce actionable coverage statistics.

## Features

- **Custom Radar Placement**: Click anywhere on the map to simulate a new radar installation with configurable tower height, elevation angles (VCP-12 scan pattern), and maximum AGL threshold
- **Terrain Blockage Computation**: Real-time calculation of radar beam shadows using 250m DEM data and the 4/3 Earth radius refraction model
- **Basin Coverage Analysis**: Select any USGS streamgage basin to see pie chart breakdowns of area/population covered by existing NEXRAD, custom radars, and uncovered zones
- **Terrain Profile Viewer**: Draw lines on the map to visualize elevation profiles with radar beam overlays
- **Probability of Detection Layer**: Historical POD data by year/season with configurable color palettes
- **URL Sharing**: Encode custom radar configurations into shareable links

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vanilla JS)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │RadarLayer│  │UsgsLayer │  │ PodLayer │  │ TerrainProfile   │ │
│  │ - NEXRAD │  │ - Markers│  │ - POD API│  │ - beamModel.js   │ │
│  │ - Custom │  │ - Basins │  │ - dynaImg│  │ - profileViewer  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                  │           │
│  ┌────┴─────────────┴─────────────┴──────────────────┴─────┐    │
│  │              Google Maps API + Custom Overlays           │    │
│  │         (mercatorOverlay, pbfLayer, markerCollection)    │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP POST/GET
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Flask)                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /api-wsr88/calculate_blockage                               ││
│  │   ├── DemReader: GDAL window extraction from GeoTIFF        ││
│  │   ├── beam_model: slant_range() + beam_height_4_3()         ││
│  │   ├── combine_blockage_masks: ThreadPoolExecutor per angle  ││
│  │   ├── GDAL.Warp: EPSG:5070 → EPSG:3857 reprojection        ││
│  │   └── PIL: PNG generation with RGBA colorization            ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /api-wsr88/tiles                                            ││
│  │   └── recolor_png: Low-level PNG filter reversal + recolor  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /api-wsr88/get-terrain                                      ││
│  │   └── 1D profile extraction along azimuth                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow for Blockage Calculation:**
1. Frontend transforms user lat/lng to EPSG:5070 via Proj4
2. Backend extracts 460km x 460km DEM window (1840px × 1840px at 250m resolution)
3. For each VCP-12 elevation angle (0.5° to 19.5°), compute beam height using slant range formulas
4. Generate binary mask: `(beam_asl > terrain) AND (beam_agl < threshold)`
5. Bitwise-OR all angle masks into combined coverage
6. Reproject to Web Mercator, encode as base64 PNG
7. Return coverage pixel indices for client-side basin intersection

## Tech Stack

**Frontend:**
- Vanilla JavaScript (no framework)
- Google Maps API v3 with custom OverlayView subclasses
- Proj4.js for coordinate transformations
- GeoBuf/PBF for compressed vector tile loading
- Web Workers for background data processing

**Backend:**
- Python 3.12 / Flask 3.1
- GDAL 3.11 for raster operations and reprojection
- NumPy for array-based beam physics calculations
- Pillow for image generation

**Data Formats:**
- GeoTIFF DEMs at 250m (EPSG:5070) and 1000m (EPSG:3857) resolution
- Pre-computed beam height arrays (beams.npz) for 14 VCP-12 angles
- GeoBuf-encoded watershed boundaries (~100 basin files)
- Binary coverage indices for rapid set intersection

## Key Engineering Decisions

### Beam Physics Model
Uses equations from Davies-Jones et al. (2019) with 4/3 Earth radius refraction correction. The `slant_range()` function computes radar-to-target distance accounting for Earth curvature:

```python
inner = a * kappa * np.sin(s_a) - np.sin(ea_rad + s_a)
r = (1 / kappa) * (ea_rad + s_a + np.arcsin(inner))
```

This is vectorized across the entire DEM window for performance.

### Pre-computed Beam Cache
Beam heights for all 14 elevation angles are pre-computed once (`precompute_beams.py`) and memory-mapped at startup. This avoids redundant trigonometric calculations during request processing.

### Threaded Angle Processing
Coverage masks for each elevation angle are computed in parallel using `ThreadPoolExecutor`. The final mask is a bitwise-OR reduction:
```python
with ThreadPoolExecutor(max_workers=min(len(elevation_angles), 8)) as executor:
    futures = {executor.submit(_mask_for_ea, ea): ea for ea in elevation_angles}
    for fut in as_completed(futures):
        combined |= fut.result()
```

### Client-Side Basin Intersection
Rather than sending full raster masks, the backend returns flattened 1D indices of covered pixels. The frontend maintains a sorted array per custom radar, enabling O(log n) binary search lookups during basin analysis:
```javascript
function binaryIncludes(arr, target) {
  let low = 0, high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) return true;
    else if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}
```

### Low-Level PNG Recoloring
The tile endpoint performs PNG color substitution without decoding to full RGB arrays. It manually reverses PNG row filters (None, Sub, Up, Average, Paeth) to access raw pixel values, then recompresses with zlib:
```python
actual_pixels = apply_png_filter_reverse(filter_type, current_row, previous_row, 4)
if actual_pixels[pixel_idx] == 220:  # sentinel value
    processed_row += bytes([tr, tg, tb, 255])
```

### Custom Google Maps Overlays
Extends `google.maps.OverlayView` for mercator-projected raster overlays with opacity control and dynamic source updates. The `pbfLayer` class handles tiled vector data loading with zoom-level debouncing and viewport-based tile requests.

## Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Large DEM window extraction per request | GDAL `/vsimem/` virtual filesystem for in-memory GeoTIFF operations |
| 14 elevation angles × large arrays | Parallel processing + pre-computed beam cache |
| Reprojection artifacts at coverage edges | Nearest-neighbor resampling to preserve binary mask semantics |
| Basin-radar intersection at interactive speeds | Pre-indexed 1km grid with sorted coverage indices for binary search |
| POD layer rendering with dynamic palettes | `dynaImg` class caches raw data, applies color LUT on redraw without re-fetching |

## Setup Instructions

### Backend

```bash
cd backend

# Create conda environment
conda env create -f environment.yml
conda activate wsr88

# Generate beam cache (one-time)
python precompute_beams.py

# Start server
python app_wsr88.py
```

Requires:
- `dem250_epsg5070.tif` - 250m DEM covering CONUS
- `dem1000_epsg3857.tif` - 1km DEM for terrain profiles

### Frontend

```bash
cd frontend

# Serve static files (any HTTP server works)
python -m http.server 5500
```

Update `frontend/public/config.js`:
```javascript
const config = {
  APP_API: "http://localhost:5000/api-wsr88",
  // ... other endpoints
};
```

### Google Maps API

Requires a Google Maps JavaScript API key with the following APIs enabled:
- Maps JavaScript API
- Places API (for search)