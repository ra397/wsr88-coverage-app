# precompute_beams.py

import numpy as np
from calculate_blockage.ground_range import ground_range_grid
from calculate_blockage.beam_model import slant_range, beam_height_4_3

WINDOW = 5112
RES    = 90
EAS    = [0.5, 0.9, 1.3, 1.8, 2.4, 3.1, 4.0,
          5.1, 6.4, 8.0, 10.0, 12.5, 15.6, 19.5]

# build ground-range once
ground = ground_range_grid(WINDOW, RES)

# collect beams into a dict
beam_dict = {}
for ea in EAS:
    adjusted_ea = ea - (.9/2)
    ea_rad = np.deg2rad(adjusted_ea)
    sl    = slant_range(ground, ea_rad).astype(np.uint32)
    bh    = beam_height_4_3(sl, ea_rad).astype(np.uint32)
    beam_dict[f"{ea}"] = bh

# save all in one file
np.savez_compressed("beams_v2.npz", **beam_dict)