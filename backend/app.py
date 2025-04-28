from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from processor import process_radar_coverage

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow everything during testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RadarRequest(BaseModel):
    easting: float
    northing: float
    max_alt: float = 3000  # Optional, defaults to 3000 if not sent

@app.post("/process_radar")
def process_radar(request: RadarRequest):
    try:
        geojson_result = process_radar_coverage(
            easting=request.easting,
            northing=request.northing,
            max_alt=request.max_alt
        )
        return JSONResponse(content={"geojson": geojson_result})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)