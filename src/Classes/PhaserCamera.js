import { lerp } from "../Functions/lerp";

/**
 * @description creates a phaser Camera
 */
export default class PhaserCamera extends Phaser.Cameras.Scene2D.Camera {
  constructor(scene, x = 0, y = 0, scaling) {
    super(x, y, scene.game.config.width, scene.game.config.height);
    this.upscale = scene.game.config.upscale ?? scaling ?? 1;
    this.scene = scene;
    // remove the main camera
    scene.cameras.remove(scene.cameras.main);
    // make this the main camera
    scene.cameras.addExisting(this, false);
  }

  getWorldPoint(x, y) {
    // let { x: outX, y: outY } = super.getWorldPoint(x, y);
    // return { x: outX / this.upscale, y: outY / this.upscale };

    const worldPoint = {
      x: x / this.zoom + this.scene.camera.scrollX,
      y: y / this.zoom + this.scene.camera.scrollY,
    };
    return worldPoint;
  }
}
