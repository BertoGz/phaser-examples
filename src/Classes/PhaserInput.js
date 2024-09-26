export default class PhaserInput {
  constructor(scene, keyName) {
    this.scene = scene; // The Phaser scene
    this.key = scene.input.keyboard.addKey(keyName); // Map the key
    this.isKeyPressed = false; // Track whether the key is currently pressed

    // Callbacks for key press and release
    this.onPress = null;
    this.onRelease = null;
  }

  update() {
    // Check if the key is down and hasn't been pressed yet
    if (this.key.isDown && !this.isKeyPressed) {
      this.isKeyPressed = true;
      if (this.onPress) {
        this.onPress(); // Call the onPress callback if defined
      }
    }

    // Check if the key was released
    if (this.key.isUp && this.isKeyPressed) {
      this.isKeyPressed = false;
      if (this.onRelease) {
        this.onRelease(); // Call the onRelease callback if defined
      }
    }
  }
}
