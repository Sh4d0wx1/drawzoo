import re
with open('src/zoo/ZooScene.ts', 'r') as f:
    code = f.read()

# 1. Remove buildNameLabels invocation
code = code.replace("const nameSprites = buildNameLabels(scene, animals);", "")

# 2. Remove updateNameLabels
code = code.replace("updateNameLabels(nameSprites, animals);", "")

# 3. Remove nameSprites from dispose
dispose_old = """    nameSprites.forEach(s => {
      (s.material as THREE.SpriteMaterial).map?.dispose();
      s.material.dispose();
    });"""
code = code.replace(dispose_old, "")

# 4. Remove pickLabelAt
pickLabel_old = """  // ── Label picking ─────────────────────────────────────────────────────────
  function pickLabelAt(clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return pickLabel(nameSprites, ndcX, ndcY, camera);
  }"""
code = code.replace(pickLabel_old, "")

# 5. Fix renameAnimal
rename_old = """  function renameAnimal(index: number, newName: string): void {
    if (index < 0 || index >= animals.length) return;
    animals[index].name = newName;
    refreshNameLabel(nameSprites[index], newName);
  }"""
rename_new = """  function renameAnimal(index: number, newName: string): void {
    if (index < 0 || index >= animals.length) return;
    animals[index].name = newName;
  }"""
code = code.replace(rename_old, rename_new)

# 6. Add removeAnimal
remove_animal_code = """  function removeAnimal(dbId: string): void {
    const idx = animals.findIndex(a => a.group.userData?.dbId === dbId);
    if (idx < 0) return;
    const animal = animals[idx];
    
    animals.splice(idx, 1);
    scene.remove(animal.group);
    
    animal.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        meshToAnimal.delete(o.uuid);
      }
    });
    
    if (hlTarget === animal) {
      hlTarget = null;
    }
  }"""
code = code.replace(rename_new, rename_new + "\n\n" + remove_animal_code)

# 7. Update addAnimal signature
add_animal_old = """  function addAnimal(
    species: AnimalSpecies,
    name: string,
    color?: string,
    dbId?: string,
    shouldFocus = true,
  ): AnimalData {"""
add_animal_new = """  function addAnimal(
    species: AnimalSpecies,
    name: string,
    color?: string,
    dbId?: string,
    shouldFocus = true,
    customColors?: Record<string, string>,
    userId?: string,
  ): AnimalData {"""
code = code.replace(add_animal_old, add_animal_new)

# 8. Update spawnAnimal call
spawn_old = """    const animal = spawnAnimal(species, name, color);
    if (dbId) {
      animal.group.userData.dbId = dbId;
    }"""
spawn_new = """    const animal = spawnAnimal(species, name, color, customColors);
    if (dbId) {
      animal.group.userData.dbId = dbId;
    }
    if (userId) {
      animal.group.userData.userId = userId;
    }"""
code = code.replace(spawn_old, spawn_new)

# 9. Remove name sprite creation
sprite_create_old = """    const sprite = createNameLabelSprite(animal);
    scene.add(sprite);
    nameSprites.push(sprite);"""
code = code.replace(sprite_create_old, "")

# 10. Fix export object
export_old = """  return {
    renderer, camera, animals, raycaster,
    dispose, pickAnimal,
    pickLabel: pickLabelAt,
    renameAnimal,
    highlightAnimal,
    addAnimal,
    panCameraTo,
  };"""
export_new = """  return {
    renderer, camera, animals, raycaster,
    dispose, pickAnimal,
    renameAnimal,
    removeAnimal,
    highlightAnimal,
    addAnimal,
    panCameraTo,
    get sonicModel() { return null; },
    get headphonesGroup() { return null; },
    get phoneGroup() { return null; },
  };"""
code = code.replace(export_old, export_new)

with open('src/zoo/ZooScene.ts', 'w') as f:
    f.write(code)
print("done")
