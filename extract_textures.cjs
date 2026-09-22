const fs = require('fs');
const { NodeIO } = require('@gltf-transform/core');

const io = new NodeIO();
async function run() {
  const document = await io.read('public/models/sonic.glb');
  const root = document.getRoot();
  const textures = root.listTextures();
  console.log("Found " + textures.length + " textures");
  
  if (!fs.existsSync('public/models/sonic_textures')) {
    fs.mkdirSync('public/models/sonic_textures', { recursive: true });
  }

  textures.forEach((tex, i) => {
    const name = tex.getName() || 'tex_' + i;
    const ext = tex.getMimeType() === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `public/models/sonic_textures/${name}.${ext}`;
    fs.writeFileSync(filename, tex.getImage());
    console.log(`Saved ${filename}`);
  });
}
run().catch(console.error);
