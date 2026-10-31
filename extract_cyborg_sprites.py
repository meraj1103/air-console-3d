from PIL import Image
import os

sheet_path = None
char_dir = r'M:\MJ\games\library\character'
for f in os.listdir(char_dir):
    if '693b67bf' in f:
        sheet_path = os.path.join(char_dir, f)
        break

if not sheet_path:
    # Fallback to first file
    sheet_path = os.path.join(char_dir, os.listdir(char_dir)[0])

print("Using sheet:", sheet_path)
im = Image.open(sheet_path).convert('RGBA')
w, h = im.size

# Function to make white background transparent
def make_transparent(img, threshold=240):
    datas = img.getdata()
    new_data = []
    for item in datas:
        # If near white, make transparent
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            # Alpha based on distance from pure white
            dist = max(item[0], item[1], item[2])
            if dist >= 250:
                new_data.append((255, 255, 255, 0))
            else:
                alpha = int((255 - dist) * 15)
                new_data.append((item[0], item[1], item[2], min(255, alpha)))
        else:
            new_data.append(item)
    img.putdata(new_data)
    return img

print("Converting white background to alpha transparency...")
im = make_transparent(im, threshold=242)

out_folder = 'public/assets/fighter/cyborg'
os.makedirs(out_folder, exist_ok=True)

# Row bounds based on analysis:
# Row 0: Idle (y: 50 to 320)
# Row 1: Run (y: 370 to 620)
# Row 2: Attack1 with Red Saber Arc (y: 630 to 920)
# Row 3: Jump (y: 930 to 1230)
# Row 4: TakeHit / Death (y: 1250 to 1530)

rows = [
    ('Idle.png', 50, 320, 5),
    ('Run.png', 370, 620, 6),
    ('Attack1.png', 630, 920, 6),
    ('Jump.png', 930, 1230, 5),
    ('TakeHit.png', 1250, 1530, 2),
    ('Death.png', 1250, 1530, 5)
]

for name, y1, y2, frames in rows:
    # Crop the row strip across width
    # Find active width for this row
    row_crop = im.crop((0, y1, w, y2))
    
    # Trim empty horizontal space on edges
    bbox = row_crop.getbbox()
    if bbox:
        trimmed = row_crop.crop(bbox)
        # Resize to standard fighting game sprite strip height (e.g., height ~120px)
        aspect = trimmed.width / trimmed.height
        target_h = 130
        target_w = int(target_h * aspect)
        final_strip = trimmed.resize((target_w, target_h), Image.Resampling.LANCZOS)
        out_path = os.path.join(out_folder, name)
        final_strip.save(out_path, 'PNG')
        print(f"Saved {name}: {final_strip.size} ({frames} frames)")

# Save Avatar icon for UI
avatar_crop = im.crop((110, 50, 320, 320))
av_box = avatar_crop.getbbox()
if av_box:
    avatar_crop = avatar_crop.crop(av_box).resize((100, 100), Image.Resampling.LANCZOS)
    avatar_crop.save(os.path.join(out_folder, 'avatar.png'), 'PNG')
    print("Saved avatar.png")

print("All Cyborg character sprites extracted successfully!")

