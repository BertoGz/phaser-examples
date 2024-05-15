import Phaser from "phaser";
import { lerp } from "../Functions/lerp";
class MovementHandler {
  constructor(gameObject, config = { moveSpeed: 1 }) {
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
    this.maxSpeed = config.moveSpeed; // Maximum speed of movement

    this.movementX = 0;
    this.movementY = 0;
  }
  steerCharacter() {
    this.steerSpeed = 1;

    // Update target position based on input
    if (this.keyA.isDown) {
      this.movementX = lerp(this.movementX, -this.maxSpeed, 0.1);
    } else if (this.keyD.isDown) {
      this.movementX = lerp(this.movementX, this.maxSpeed, 0.1);
    } else {
      this.movementX = lerp(this.movementX, 0, 0.1);
    }
    if (this.keyW.isDown) {
      this.movementY = lerp(this.movementY, -this.maxSpeed, 0.1);
    }
    if (this.keyS.isDown) {
      this.movementY = lerp(this.movementY, this.maxSpeed, 0.1);
    } else {
      this.movementY = lerp(this.movementY, 0, 0.1);
    }

    this.gameObject.x += this.movementX;
    this.gameObject.y += this.movementY;
  }
  update() {
    this.steerCharacter();
  }
}
export default class Player extends Phaser.GameObjects.Image {
  constructor(scene, x, y, config) {
    super(scene, x, y, "char_sprite", 6 * 8 - 1);
    this.scene = scene;
    this.movementHandler = new MovementHandler(this, config);
    //);
    this.setOrigin(0.5, 0.5);
  }
  update() {
    this.movementHandler.update();
  }
}
