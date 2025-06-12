from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, JSONResponse
from processor import calculate_coverage
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
    tower_ft: float | None = None
    max_alt: float = 3000
    elevation_angles: Optional[List[float]] = None
    beam_model: str = 'radar_beam_4_3.npz'

@app.post("/calculate_blockage")
def calculate_blockage(req: CoverageRequest):
    try:
        print("Request recieved: ", req)
        img_buf = calculate_coverage(
            easting=req.easting,
            northing=req.northing,
            tower_ft=req.tower_ft,
            max_alt=req.max_alt,
            elevation_angles=req.elevation_angles,
            beam_model=req.beam_model
        )
        return StreamingResponse(img_buf, media_type="image/png")

    except Exception as e:
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