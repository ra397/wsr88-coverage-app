from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from processor import calculate_coverage
import io
from fastapi.middleware.cors import CORSMiddleware

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

@app.post("/calculate_blockage")
def calculate_blockage(req: CoverageRequest):
    try:
        img_buf = calculate_coverage(
            easting=req.easting,
            northing=req.northing,
            tower_ft=req.tower_ft,
            max_alt=req.max_alt
        )
        return StreamingResponse(img_buf, media_type="image/png")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))