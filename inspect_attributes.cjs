const fs = require('fs');
function inspectGLB(filePath) {
    const buffer = fs.readFileSync(filePath);
    const chunkLength = buffer.readUInt32LE(12);
    const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
    const json = JSON.parse(jsonStr);
    console.log(`\n=== Meshes for ${filePath} ===`);
    if (json.meshes) {
        json.meshes.forEach((m, i) => {
            if (m.primitives) {
                m.primitives.forEach((p, j) => {
                    console.log(`  Primitive ${j} Attributes:`, Object.keys(p.attributes));
                });
            }
        });
    }
}
inspectGLB('public/models/baby_wolf.glb');
