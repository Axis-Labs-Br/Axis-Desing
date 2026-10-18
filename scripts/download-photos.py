import urllib.request, pathlib, concurrent.futures
photos = {
 'coast':'photo-1518837695005-2083093ee35b',
 'interior':'photo-1600210492486-724fe5c67fb0',
 'flowers':'photo-1490750967868-88aa4486c946',
 'mountain':'photo-1464822759023-fed622ff2c3b',
 'portrait':'photo-1534528741775-53994a69daeb',
 'orange':'photo-1611080626919-7cf5a9dbab5b',
 'leaves':'photo-1501004318641-b39e6451bec6',
 'building':'photo-1487958449943-2429e8be8625',
 'coffee':'photo-1442512595331-e89e73853f31',
 'art-studio':'photo-1513364776144-60967b0f800f',
 'cuisine':'photo-1547592180-85f173990554',
 'skincare':'photo-1601049541289-9b1b7bbbfe19',
 'salon':'photo-1560066984-138dadb4c035',
 'audio-studio':'photo-1598488035139-bdbb2231ce04',
 'deck-city':'photo-1486406146926-c627a92ad1ab',
 'deck-office':'photo-1497366216548-37526070297c',
 'deck-desk':'photo-1497366811353-6870744d04b2',
 'deck-workspace':'photo-1524758631624-e2822e304c36',
 'deck-data':'photo-1551288049-bebda4e38f71',
 'deck-planning':'photo-1552664730-d307ca884978',
 'deck-architecture':'photo-1487958449943-2429e8be8625',
 'deck-boardroom':'photo-1497366754035-f200968a6e72',
 'deck-meeting':'photo-1517245386807-bb43f82c33c4',
 'deck-project':'photo-1519389950473-47ba0277781c',
 'deck-craft':'photo-1455390582262-044cdead277a',
 'deck-partnership':'photo-1521791136064-7986c2920216',
 'deck-workshop':'photo-1551836022-d5d88e9218df'
}
def get(item):
 name, ident = item
 try:
  size = 'w=1920&h=1080&q=78' if name.startswith('deck-') else 'w=1400&q=85'
  req=urllib.request.Request(f'https://images.unsplash.com/{ident}?auto=format&fit=crop&{size}',headers={'User-Agent':'AxisDesign/0.1'})
  data=urllib.request.urlopen(req,timeout=35).read()
  pathlib.Path(f'public/photos/{name}.jpg').write_bytes(data)
  return (name,len(data))
 except Exception as e: return (name,str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for result in pool.map(get, photos.items()): print(result)
