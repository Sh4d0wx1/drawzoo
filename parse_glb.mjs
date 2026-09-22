import fs from 'fs';
const buf = fs.readFileSync('public/models/sonic.glb');
const magic = buf.readUInt32LE(0);
if (magic === 0x46546C67) {
  const jsonChunkLength = buf.readUInt32LE(12);
  const jsonString = buf.toString('utf8', 20, 20 + jsonChunkLength);
  const gltf = JSON.parse(jsonString);
  const nodes = gltf.nodes.map(n => n.name).filter(n => n && n.includes('sonic'));
  console.log("Nodes:", nodes.slice(0, 30));
}
