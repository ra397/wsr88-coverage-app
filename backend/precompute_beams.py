# precompute_beams.py

import numpy as np
from calculate_blockage.constants import VCP12, dem_pixel_size, window_size
from calculate_blockage.ground_range import ground_range_grid
from calculate_blockage.beam_model import slant_range, beam_height_4_3

# build ground-range once
ground = ground_range_grid(window_size, dem_pixel_size)

# collect beams into a dict
beam_dict = {}
for ea in VCP12:
    adjusted_ea = ea - (.9/2)
    ea_rad = np.deg2rad(adjusted_ea)
    sl    = slant_range(ground, ea_rad).astype(np.uint32)
    bh    = beam_height_4_3(sl, ea_rad).astype(np.uint32)
    beam_dict[f"{ea}"] = bh

# save all in one file
np.savez_compressed("beams.npz", **beam_dict)