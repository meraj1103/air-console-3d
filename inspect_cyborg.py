from PIL import Image
import os

char_dir = r'M:\MJ\games\library\character'
for fname in os.listdir(char_dir):
    p = os.path.join(char_dir, fname)
    if not os.path.isfile(p): continue
    im = Image.open(p).convert('RGB')
    w, h = im.size
    print("=" * 60)
    print("Processing:", fname, im.size)
    
    # Check vertical bands (rows)
    step_y = 10
    row_activity = []
    for y in range(0, h, step_y):
        count = 0
        for x in range(0, w, 20):
            r, g, b = im.getpixel((x, y))
            if r < 245 or g < 245 or b < 245:
                count += 1
        row_activity.append((y, count))
    
    bands = []
    in_band = False
    start_y = 0
    threshold = (w // 20) * 0.02
    for y, count in row_activity:
        if count > threshold and not in_band:
            in_band = True
            start_y = y
        elif count <= threshold and in_band:
            in_band = False
            if y - start_y > 40:
                bands.append((start_y, y))
    if in_band:
        bands.append((start_y, h))
    
    print("Detected Rows:", len(bands), bands)
    
    # For each row, find columns
    for row_idx, (y1, y2) in enumerate(bands):
        col_activity = []
        for x in range(0, w, 10):
            col_count = 0
            for y in range(y1, y2, 10):
                r, g, b = im.getpixel((x, y))
                if r < 245 or g < 245 or b < 245:
                    col_count += 1
            col_activity.append((x, col_count))
        
        cols = []
        in_col = False
        start_x = 0
        col_thresh = ((y2 - y1) // 10) * 0.02
        for x, cnt in col_activity:
            if cnt > col_thresh and not in_col:
                in_col = True
                start_x = x
            elif cnt <= col_thresh and in_col:
                in_col = False
                if x - start_x > 30:
                    cols.append((start_x, x))
        if in_col:
            cols.append((start_x, w))
        print(f"  Row {row_idx}: {len(cols)} sprites -> {cols}")

