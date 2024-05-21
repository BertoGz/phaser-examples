export default class ScaledRenderTexture extends Phaser.GameObjects
  .RenderTexture {
  constructor(scene, camera, x = 0, y = 0, width, height, scaling) {
    if (!width || !height) {
      console.error("width or height not specified");
    }
    super(
      scene,
      x,
      y,
      width ?? scene.game.config.width,
      height ?? scene.game.config.height
    );

    this.upscale = scene.game.config.upscale ?? scaling ?? 1;
    this.setOrigin(0, 0);
    this.setScrollFactor(0, 0);
    // set camera
    this.camera = camera || scene.cameras.main;
    this.items = [];
  }
  add(item, index = 0) {
    if (!Array.isArray(this.items[index])) {
      this.items[index] = [];
    }
    this.items[index].push(item);
  }
  removeAll() {
    this.items = [];
  }
  execute(fn) {
    const newCam = {
      x: Math.floor(this.camera.scrollX),
      y: Math.floor(this.camera.scrollY),
    };
    // prepare render texture
    this.clear();

    //batch draw grass texture
    this.beginDraw();

    //sort items depth wise
    // traverse each array element

    this.items.forEach((innerArray, index) => {
      if (Array.isArray(innerArray)) {
        this.items[index] = innerArray.sort(function (a, b) {
          return a.depth - b.depth;
        });
      }
    });

    // draw each item starting at lowest depth and working up
    this.items.forEach((innerArray) => {
      if (Array.isArray(innerArray)) {
        innerArray.forEach((gm) => {
          // apply any upscaling to graphics
          const tempScale = gm.scale;
          gm.scale = this.upscale;
          this.batchDraw(
            gm,
            Math.round(gm.x * this.upscale - newCam.x),
            Math.round(gm.y * this.upscale - newCam.y)
          );
          gm.scale = tempScale;
        });
      }
    });

    this.endDraw();
    const diffX = Math.floor(newCam.x) - this.camera.scrollX;
    const diffY = Math.floor(newCam.y) - this.camera.scrollY;

    this.x = diffX;
    this.y = diffY;
  }
}
