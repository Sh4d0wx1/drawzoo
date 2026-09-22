const fs = require('fs');

function inspectGLB(filePath) {
    const buffer = fs.readFileSync(filePath);
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46546C67) {
        console.log(`${filePath} is not a valid GLB`);
        return;
    }
    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    
    let chunkLength = buffer.readUInt32LE(12);
    let chunkType = buffer.readUInt32LE(16);
    
    if (chunkType !== 0x4E4F534A) {
        console.log(`${filePath} JSON chunk not found`);
        return;
    }
    
    const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
    const json = JSON.parse(jsonStr);
    
    console.log(`\n=== Materials for ${filePath} ===`);
    if (json.materials) {
        json.materials.forEach((m, i) => {
            console.log(`Material ${i}: ${m.name}`);
        });
    } else {
        console.log('No materials found.');
    }
    
    console.log(`\n=== Meshes for ${filePath} ===`);
    if (json.meshes) {
        json.meshes.forEach((m, i) => {
            console.log(`Mesh ${i}: ${m.name}`);
            if (m.primitives) {
                m.primitives.forEach((p, j) => {
                    console.log(`  Primitive ${j} -> Material Index: ${p.material}`);
                });
            }
        });
    } else {
        console.log('No meshes found.');
    }
}

inspectGLB('public/models/giraffe.glb');
inspectGLB('public/models/zebra.glb');
inspectGLB('public/models/shark.glb');
inspectGLB('public/models/baby_wolf.glb');

