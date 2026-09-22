import json, struct, os, sys

def extract_glb_textures(glb_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    with open(glb_path, 'rb') as f:
        magic, version, length = struct.unpack('<III', f.read(12))
        if magic != 0x46546C67:
            return
        chunk0_len, chunk0_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(chunk0_len).decode('utf-8'))
        chunk1_len, chunk1_type = struct.unpack('<II', f.read(8))
        bin_data = f.read(chunk1_len)
        
    for i, image in enumerate(json_data.get('images', [])):
        bv = json_data['bufferViews'][image['bufferView']]
        offset = bv.get('byteOffset', 0)
        length = bv['byteLength']
        img_data = bin_data[offset:offset+length]
        
        name = image.get('name', f"tex_{i}")
        # Sanitize name
        name = "".join(c for c in name if c.isalnum() or c in ('_', '-')).strip()
        if not name:
            name = f"tex_{i}"
        
        mime = image.get('mimeType', 'image/png')
        ext = 'jpg' if mime == 'image/jpeg' else 'png'
        with open(os.path.join(output_dir, f"{name}.{ext}"), 'wb') as img_f:
            img_f.write(img_data)
        print(f"Extracted {name}.{ext}")

extract_glb_textures('public/models/sonic.glb', 'public/models/sonic_textures/')
