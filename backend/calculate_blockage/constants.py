import os
import numpy as np

# Beam heights cache
if not os.path.exists("beams.npz"):
    raise FileNotFoundError("Run precompute_beams.py first to generate beams.npz")
_beams = np.load("beams.npz", mmap_mode="r")
BEAM_CACHE = { float(k): _beams[k] for k in _beams.files }

DEM_PATH = "_dem090_epsg_3857.tif"

VCP12 = [0.5, 0.9, 1.3, 1.8, 2.4, 3.1, 4.0, 5.1, 6.4, 8.0, 10.0, 12.5, 15.6, 19.5]

dem_pixel_size = 114
window_size = 4028