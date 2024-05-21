class ScaledGame {
  constructor(game, width, height, upscaleFactor = 1) {
    if (!game) {
      return console.error("missing phaser game object");
    }
    game.upscaleFactor = upscaleFactor;
    this.width = width * upscaleFactor;
    this.height = height * upscaleFactor;
    this.nativeWidth = width;
    this.nativeHeight = height;
  }
}
