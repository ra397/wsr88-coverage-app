import json
from common import *
from qrtRadar import beamTracker1D, quarterRotate
from time import time
from math import floor
from multiprocessing import Pool

RADAR_NPZ = r"radar_beam_90m_0.10deg_1.33.npz"
DEM_SRC = r"_dem090"

def worker(args):
    qr, easting, northing, tower_ft, max_alt = args
    bt = beamTracker1D(path_beammodel=RADAR_NPZ)
    bt.dem_src = DEM_SRC
    bt.setRadar(easting, northing, ft2m(tower_ft))
    bt.readDEM(quarter_pref=qr)

    print(bt.model['antenna_elevations'][:])

    for ae in bt.model['antenna_elevations'][:]:
        bt.calcBlockage(ae, ft2m(max_alt))
    return {qr: quarterRotate(pref=qr, data=bt.getBlockage())}

def calculate_coverage(easting, northing, tower_ft=None, max_alt=3000):
    if tower_ft is None:
        tower_ft = m2ft(read_dem_value(DEM_SRC, easting, northing) + ft2m(100))
    else:
        tower_ft = m2ft(read_dem_value(DEM_SRC, easting, northing) + ft2m(tower_ft))


    print("Calculating coverage with: ", easting, northing, tower_ft, max_alt)

    total_tm = time()
    with Pool(4) as pool:
        results = pool.map(worker, [(qr, easting, northing, tower_ft, max_alt) for qr in QRTS])

    combined = putTogether({k: v for d in results for k, v in d.items()})
    print('Total -> ', time() - total_tm)

    img_buf = makePNG(combined)

    '''
    with open("radar_coverage.png", "wb") as f:
        f.write(img_buf.getbuffer())
    '''

    return img_buf

if __name__ == "__main__":
    calculate_coverage(448049.26648561255, 2080241.2158965976)