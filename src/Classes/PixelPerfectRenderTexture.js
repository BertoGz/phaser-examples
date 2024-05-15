export default class PixelPerfectRenderTexture extends Phaser.GameObjects
  .RenderTexture {
  constructor(scene, camera, x = 0, y = 0, width, height) {
    super(
      scene,
      x,
      y,
      width ?? scene.game.config.width,
      height ?? this.scene.game.config.height
    );
    // set camera
    this.camera = camera || scene.cameras.main;
    this.items = [];
  }
  add(item) {
    this.items.push(item);
  }
  remove(item) {
    this.items.filter((i) => i === item);
  }
  execute() {
    const newCam = {
      x: Math.floor(this.camera.scrollX),
      y: Math.floor(this.camera.scrollY),
    };
    // prepare render texture
    this.clear();

    //batch draw grass texture
    this.beginDraw();
    this.items.forEach((gm) => {
      this.batchDraw(
        gm,
        Math.round(gm.x) - newCam.x,
        Math.round(gm.y) - newCam.y
      );
    });

    this.endDraw();
    const diffX = Math.round(newCam.x) - this.camera.scrollX;
    const diffY = Math.round(newCam.y) - this.camera.scrollY;
    this.x = diffX;
    this.y = diffY;
  }
}
