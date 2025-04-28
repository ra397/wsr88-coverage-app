from common import *
from qrtRadar import beamTracker1D, quarterRotate
from time import time
from math import floor
from multiprocessing import Pool
from typing import Tuple
from rasterio import features
from rasterio.transform import from_origin

RADAR_NPZ = r"backend\resources\radar_beam_90m_0.10deg_1.33.npz"
DEM_SRC = r"backend\resources\_dem090"
WSR_SRC = r"backend\resources\nexrad_epsg5070.geojson"

ANGLE_GRID = r"backend\resources\angle_grid.npy"
DISTANCE_GRID = r"backend\resources\distance_grid.npy"


def worker(args: Tuple[str, float, float, float, float]) -> dict:
    qr, easting, northing, tower_ft, max_alt = args
    bt = beamTracker1D(path_beammodel=RADAR_NPZ)
    bt.dem_src = DEM_SRC
    bt.setRadar(easting, northing, ft2m(tower_ft))
    bt.readDEM(quarter_pref=qr)
    for ae in bt.model['antenna_elevations'][:]:
        bt.calcBlockage(ae, ft2m(max_alt))
    return {qr: quarterRotate(pref=qr, data=bt.getBlockage())}

def process_radar_coverage(easting: float, northing: float, max_alt: float = 3000) -> str:
    """
    Process radar coverage and generate a GeoTIFF file.
    
    Args:
        easting: Easting coordinate in EPSG:5070
        northing: Northing coordinate in EPSG:5070
        tower_ft: Tower height in feet
        max_alt: Maximum altitude in feet
        
    Returns:
        str: Path to the generated GeoTIFF file
    """

    tower_m = read_dem_value(DEM_SRC, easting, northing)
    tower_ft = m2ft(tower_m)

    # Create args for each worker
    worker_args = [(qr, easting, northing, tower_ft, max_alt) for qr in QRTS]
    
    # Run the multiprocessing pool
    with Pool(4) as pool:
        results = pool.map(worker, worker_args)
    
    # Process results
    combined = putTogether({k: v for d in results for k, v in d.items()})
    combined = np.flipud(combined)

    angle_grid = np.load(ANGLE_GRID)
    distance_grid = np.load(DISTANCE_GRID)

    border_grid = find_furthest_unblocked(angle_grid, combined, distance_grid)

    center = border_grid.shape[0] // 2

    coords = get_epsg5070_coordinates_ordered_by_angle(
        border_grid, angle_grid, easting, northing, center, center, cell_size=90
    )

    return coords_to_polygon_geojson(coords, epsg_code=5070)


if __name__ == "__main__":
    geojson = process_radar_coverage(-724341.319300967734307, 1895659.981413539964706, 3000)