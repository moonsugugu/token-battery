# assets/icon-512.png → assets/icon.ico (윈도우 바탕화면·작업표시줄용, 16~256px 포함)
import os
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
assets = os.path.join(here, '..', 'assets')
src = Image.open(os.path.join(assets, 'icon-512.png')).convert('RGBA')
src.save(os.path.join(assets, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('wrote icon.ico')
