import json
from common import *
from qrtRadar import beamTracker1D, quarterRotate
from time import time
from math import floor
from multiprocessing import Pool

RADAR_NPZ_4_3 = r"radar_beam_4_3.npz"
RADAR_NPZ_1_21 = r"radar_beam_1_21.npz"
DEM_SRC = r"_dem090"

def worker(args):
    qr, easting, northing, tower_ft, max_alt, beam_model = args
    bt = beamTracker1D(path_beammodel=beam_model)
    bt.dem_src = DEM_SRC
    bt.setRadar(easting, northing, ft2m(tower_ft))
    bt.readDEM(quarter_pref=qr)
    for ae in bt.model['antenna_elevations'][:]:
        bt.calcBlockage(ae, ft2m(max_alt))
    return {qr: quarterRotate(pref=qr, data=bt.getBlockage())}

def calculate_coverage(easting, northing, tower_ft=None, max_alt=3000, beam_model=RADAR_NPZ_4_3):
    if tower_ft is None:
        tower_ft = m2ft(read_dem_value(DEM_SRC, easting, northing) + ft2m(100))
    else:
        tower_ft = m2ft(read_dem_value(DEM_SRC, easting, northing) + ft2m(tower_ft))


    print("Calculating coverage with: ", easting, northing, tower_ft, max_alt, beam_model)

    total_tm = time()
    with Pool(4) as pool:
        results = pool.map(worker, [(qr, easting, northing, tower_ft, max_alt, beam_model) for qr in QRTS])

    combined = putTogether({k: v for d in results for k, v in d.items()})
    print('Total -> ', time() - total_tm)

    img_buf = makePNG(combined)

    
    with open("radar_coverage.png", "wb") as f:
        f.write(img_buf.getbuffer())
    

    return img_buf

if __name__ == "__main__":
    calculate_coverage(-724341.319300967734307, 1895659.981413539964706)