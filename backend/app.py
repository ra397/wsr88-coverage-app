from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, JSONResponse
from processor import get_blockage
from population.calculate_pop_points import calculate_pop_points
import io
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import httpx

# For debugging purposes
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow everything during testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CoverageRequest(BaseModel):
    easting: float
    northing: float
    tower_m: Optional[float] = None
    max_alt_m: Optional[float] = None
    elevation_angles: Optional[List[float]] = None

@app.post("/calculate_blockage")
def calculate_blockage(req: CoverageRequest):
    try:
        print("Request recieved: ", req)
        img_buf = get_blockage(
            easting=req.easting,
            northing=req.northing,
            elevation_angles_deg=req.elevation_angles,
            tower_m=req.tower_m,
            agl_threshold_m=req.max_alt_m,
        )
        return StreamingResponse(img_buf, media_type="image/png")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/population_points")
async def get_population_points(request: Request):
    try:
        body = await request.json()
        threshold = body.get("population_threshold")

        if threshold is None or not (0 <= threshold <= 100000):
            raise HTTPException(status_code=400, detail="Invalid population threshold")

        geojson_result = calculate_pop_points(
            population_threshold=threshold
        )

        return JSONResponse(content=geojson_result)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    
@app.get("/get_basin_boundary/{usgs_id}")
async def get_basin_boundary(usgs_id: str):
    url = f'http://s-iihr80.iihr.uiowa.edu/_MOVE_/pbf/{usgs_id}.pbf'
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url)
            r.raise_for_status()
            return Response(content=r.content, media_type="application/octet-stream")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch PBF: {e}")