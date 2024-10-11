export default class ScaledRenderTexture extends Phaser.GameObjects
  .RenderTexture {
  constructor(scene, camera, x = 0, y = 0, width, height, scaling) {
    if (!width || !height) {
      console.error("width or height not specified");
    }
    super(scene, x, y, width ?? camera.width, height ?? camera.height);
    this.scene = scene;
    this.upscale = scene.game.config.upscale ?? scaling ?? 1;

    this.setOrigin(0, 0);
    this.setScrollFactor(0, 0);
    this.camera = camera || scene.cameras.main;

    // Initialize the items as an array of layers
    this.layers = [];
  }

  // Adds an item to the specified layer (index)
  add(item, index = 0) {
    // If the layer does not exist, create it
    if (!this.layers[index]) {
      this.layers[index] = { depth: index, objects: new Map() };
    }

    // Add the item to the Map inside the layer
    this.layers[index].objects.set(item, item);
  }

  // Removes an item from the specified layer
  remove(item, index) {
    const layer = this.layers[index];
    if (layer && layer.objects.has(item)) {
      layer.objects.delete(item);
    }
  }

  // Removes all items from all layers
  removeAll() {
    this.layers.forEach((layer) => layer.objects.clear());
  }

  // Execute rendering and sorting by depth
  execute(fn) {
    const newCam = {
      x: Math.floor(this.camera.scrollX),
      y: Math.floor(this.camera.scrollY),
    };

    // Clear the render texture before drawing
    this.clear();
    this.beginDraw();

    // Sort layers by depth
    this.layers.sort((a, b) => a.depth - b.depth);

    // Loop through each layer and draw its objects
    this.layers.forEach((layer) => {
      // Iterate through each object in the layer's map
      layer.objects.forEach((gm) => {
        // Temporarily adjust the scale for rendering
        const tempScale = gm.scale;
        gm.scale = this.upscale * gm.scale;

        // Draw the object with upscaling
        this.batchDraw(
          gm,
          Math.round(gm.x * this.upscale - newCam.x),
          Math.round(gm.y * this.upscale - newCam.y)
        );

        // Restore the original scale
        gm.scale = tempScale;
      });
    });

    this.endDraw();

    // Adjust the position of the texture
    const diffX = Math.floor(newCam.x) - this.camera.scrollX;
    const diffY = Math.floor(newCam.y) - this.camera.scrollY;

    this.x = diffX;
    this.y = diffY;
  }
  updateDimensions() {
    this.destroy();

    // this.setDisplaySize(this.scene.camera.width,this.scene.camera.height);
  }
  destroy() {
    //  this.clear()
    //this.removeFromDisplayList()
    // this.removeFromUpdateList()
    // this.removeAll();
    super.destroy();
  }
}
