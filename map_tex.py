import json, struct
with open('public/models/sonic.glb', 'rb') as f:
    f.read(12)
    chunk0_len, _ = struct.unpack('<II', f.read(8))
    gltf = json.loads(f.read(chunk0_len).decode('utf-8'))
    
for mat in gltf.get('materials', []):
    name = mat.get('name', 'Unknown')
    pbr = mat.get('pbrMetallicRoughness', {})
    bct = pbr.get('baseColorTexture', {})
    if 'index' in bct:
        tex_idx = bct['index']
        img_idx = gltf['textures'][tex_idx].get('source')
        print(f"Material '{name}' -> tex_{img_idx}.png")
