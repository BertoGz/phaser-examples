import Phaser from "phaser";
import { lerp } from "../Functions/lerp";

class MovementHandler {
  constructor(gameObject, config = { moveSpeed: 1, lerp: 1 }) {
    this.gameObject = gameObject;

    this.keyA = gameObject.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.A
    );
    this.keyD = gameObject.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.D
    );
    this.keyW = gameObject.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.W
    );
    this.keyS = gameObject.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.S
    );
    this.maxSpeed = config.maxSpeed || 1; // Maximum speed of movement
    this.lerp = config.lerp || 1;
    this.movementX = 0;
    this.movementY = 0;
  }
  steerCharacter(time, delta = 1) {
    this.steerSpeed = 1;
    const lerpWithDelta = this.lerp * delta;
    // Update target position based on input
    if (this.keyA.isDown) {
      this.movementX = lerp(this.movementX, -this.maxSpeed, lerpWithDelta);
    } else if (this.keyD.isDown) {
      this.movementX = lerp(this.movementX, this.maxSpeed, lerpWithDelta);
    } else {
      this.movementX = lerp(this.movementX, 0, lerpWithDelta);
    }
    if (this.keyW.isDown) {
      this.movementY = lerp(this.movementY, -this.maxSpeed, lerpWithDelta);
    } else if (this.keyS.isDown) {
      this.movementY = lerp(this.movementY, this.maxSpeed, lerpWithDelta);
    } else {
      this.movementY = lerp(this.movementY, 0, lerpWithDelta);
    }

    this.gameObject.x += this.movementX;
    this.gameObject.y += this.movementY;
  }
  update(time, delta) {
    this.steerCharacter(time, delta);
  }
}

export default class Player extends Phaser.GameObjects.Image {
  /**
   * @description Player class
   * @param {scene} scene
   * @param {number} x
   * @param {number} y
   * @param {Object} config
   * @param {number} config.maxSpeed - The name of the person.
   * @returns {number} The sum of num1 and num2.
   */
  constructor(scene, x, y, config) {
    super(scene, x, y, "char_sprite", 6 * 8 - 1);
    this.scene = scene;
    this.movementHandler = new MovementHandler(this, config);

    this.setOrigin(0.5, 0.5);
  }
  update(time, delta) {
    this.movementHandler.update(time, delta);
  }
}
