import Phaser from "phaser";
import Player from "./Prefabs/Player";
import SmoothCamera from "./Classes/SmoothCamera";
import PixelPerfectRenderTexture from "./Classes/PixelPerfectRenderTexture";
const UPSCALE_FACTOR = 4;
const GAME_WIDTH = 360 * UPSCALE_FACTOR;
const GAME_HEIGHT = (360 / 1.78) * UPSCALE_FACTOR; /// aspect;

let tiles = [];
let trees = [];

class Scene extends Phaser.Scene {
  preload() {
    // load game assets
    this.load.spritesheet("char_sprite", "./assets/monster-ghost.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("nature_tile", "./assets/nature-tile.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image("tree", "./assets/tree.png");
  }

  create() {
    //create camera
    this.camera = new SmoothCamera(this, 0, 0);

    this.camera.setZoom(UPSCALE_FACTOR);

    // make render texture for grass tiles
    this.renderTexture = new PixelPerfectRenderTexture(
      this,
      this.camera,
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT
    );
    this.add.existing(this.renderTexture);

    //align render texture to top left
    this.renderTexture.setOrigin(0, 0);
    this.renderTexture.setScrollFactor(0, 0);

    // create grass tiles
    for (let x = -25; x < 25; x++) {
      for (let y = -25; y < 25; y++) {
        const newTile = new Phaser.GameObjects.Image(
          this,
          x * 16,
          y * 16,
          "nature_tile",
          12
        );
        this.renderTexture.add(newTile);
      }
    }
    const tree = new Phaser.GameObjects.Image(this, 100, 100, "tree");
    this.renderTexture.add(tree);
    // create player
    this.player = new Player(this, 0, 0, { moveSpeed: 2 });
    this.renderTexture.add(this.player);

    this.player.setDepth(10);
    this.camera.startFollow(this.player, false, 0.01);
  }

  update(time, delta) {
    this.player.update(time, delta);
    requestAnimationFrame(() => {
      this.renderTexture.execute();
    });
  }
  preUpdate() {}
}

const phaserConfig = {
  type: Phaser.WEBGL,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  orientation: "landscape",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scene: [Scene],
  pixelArt: true,
  roundPixels: false,
  autoRound: false,
};

new Phaser.Game(phaserConfig);
