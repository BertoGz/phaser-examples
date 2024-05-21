import { lerp } from "../Functions/lerp";
import { getGameScaling } from "../Functions/getGameScaling";

export default class PhaserCamera extends Phaser.Cameras.Scene2D.Camera {
  constructor(scene, x = 0, y = 0, scaling) {
    super(x, y, scene.game.config.width, scene.game.config.height);
    this.upscale = scene.game.config.upscale ?? scaling ?? 1;
    this.scene = scene;
    // remove the main camera
    scene.cameras.remove(scene.cameras.main);
    // make this the main camera
    scene.cameras.addExisting(this, false);

    this.target = null;

    this.smoothing = 1;
  }

  /**
   *
   * @param {Phaser.GameObjects.GameObject} target
   * @param {Number} smoothing
   */
  setTarget(target, smoothing) {
    this.target = target;
    if (smoothing) {
      this.smoothing = smoothing;
    }
  }
  setLerp(smoothing) {
    this.smoothing = smoothing || 1;
  }

  update(time, delta) {
    super.update(time, delta); // Call the parent class update method

    this.scrollXUnscaled = this.worldView.x;
    this.scrollYUnscaled = this.worldView.y;

    if (this.target) {
      // set the smooth target values
      const lerpedTargetX =
        this.target.x * this.upscale - getGameScaling(this.scene).width / 2;
      const lerpedTargetY =
        this.target.y * this.upscale - getGameScaling(this.scene).height / 2;

      // apply target values to camera scroll position
      this.scrollX = lerp(this.scrollX, lerpedTargetX, this.smoothing);
      this.scrollY = lerp(this.scrollY, lerpedTargetY, this.smoothing);
    }
  }
}
