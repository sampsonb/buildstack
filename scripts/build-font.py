# Build public/fonts/archivo-v1.woff2 from the pinned Google Fonts source (OFL).
# Deterministic: pinned commit + sha256, pinned fonttools/brotli (run via uv, see header of ship notes).
import hashlib, io, urllib.request, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SHA = '6c70c829f09ea345d3590406693220ea35c6553f'
BASE = f'https://raw.githubusercontent.com/google/fonts/{SHA}/ofl/archivo/'
TTF_SHA256 = sys.argv[1] if len(sys.argv) > 1 else None
out_dir = 'public/fonts'
os.makedirs(out_dir, exist_ok=True)

def get(name):
    with urllib.request.urlopen(BASE + urllib.request.quote(name)) as r:
        return r.read()

ttf = get('Archivo[wdth,wght].ttf')
h = hashlib.sha256(ttf).hexdigest()
print('source sha256', h)
if TTF_SHA256: assert h == TTF_SHA256, 'source font changed'
open(os.path.join(out_dir, 'OFL.txt'), 'wb').write(get('OFL.txt'))

font = TTFont(io.BytesIO(ttf))
# Keep the widths we use (narrow 62 for prices and ranks, up to normal 100) and weights 400 to 850.
font = instancer.instantiateVariableFont(font, {'wdth': (62, 100), 'wght': (400, 850)})
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'lnum', 'case']
opts.name_IDs = ['*']
opts.notdef_outline = True
unicodes = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x2013, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20AC, 0x2122, 0x2190, 0x2192, 0x2212]
sub = subset.Subsetter(opts)
sub.populate(unicodes=unicodes)
sub.subset(font)
font.flavor = 'woff2'
font.recalcTimestamp = False
font['head'].modified = font['head'].created  # fixed, so builds match byte for byte
path = os.path.join(out_dir, 'archivo-v1.woff2')
font.save(path, reorderTables=True)
print('wrote', path, os.path.getsize(path))
