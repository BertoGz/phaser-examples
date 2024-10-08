/*!
 * Example: Quadtree
 * Description: showcase the use of the quadtree class to draw only what is visible.
 * Author: Berto Gonzalez
 * License: MIT
 * Version: 1.0.0
 * Date: 2024-05-18
 */

import Phaser from "phaser";
import PhaserCamera from "../Classes/PhaserCamera";
import Player from "../Prefabs/Player";
import ScaledRenderTexture from "../Classes/ScaledRenderTexture";
//import QuadtreeManager, { Boundary, QuadTreeObject } from "../Classes/Quadtree";
import RBush from "rbush";

let game;

// for debugging ui overlay
let uniqueInstances = new Map();
let instancesDrawn = 0;
let totalInstances = 50000;

/**
 * @description this scene will create our player, camera, renderTexture, and quadtree.
 */
class Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Scene" });
  }
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
    //create camera and player
    this.camera = new PhaserCamera(this, 0, 0);
    this.player = new Player(this, 0, 0, {
      maxSpeed: 2,
      lerp: 0.01,
    });

    // create render texture to draw game objects to
    this.renderTexture = new ScaledRenderTexture(
      this,
      this.camera,
      0,
      0,
      game.config.width + 1,
      game.config.height + 1
    );

    // let phaser manage this object
    this.add.existing(this.renderTexture);

    // set camera follow player
    this.camera.startFollow(this.player, false, 0.05);

    // create a quadtree manager

    // create quadtree
    this.tree = new RBush(4);

    // create a mass amount of game objects
    for (let i = 0; i < totalInstances; i++) {
      const boundaryWidth = 8000;

      // create img object
      const img = new Phaser.GameObjects.Image(
        this,
        Math.round(Math.random() * boundaryWidth - boundaryWidth / 2),
        Math.round(Math.random() * boundaryWidth - boundaryWidth / 2),
        "tree"
      );
      img.depth = img.y;
      // utilize QuadTreeObject to wrap img

      const treeItem = {
        gm: img,
        minX: img.x-100,
        minY: img.y-100,
        maxX: img.x + img.width+100,
        maxY: img.y + img.height+100,
      };
      this.tree.insert(treeItem);
      img.treeItem = treeItem;
    }

    // create ui display
    this.ui = this.make
      .text({
        style: { fontSize: 10, padding: 10, backgroundColor: "rgba(0,0,0,.4)" },
      })
      .setScrollFactor(0);
  }
  update(time, delta) {
    this.renderTexture.removeAll();
    this.player.update(time, delta);
    this.renderTexture.add(this.player, 1);

    const boundary = {
      minX: this.camera.scrollX - 50,
      minY: this.camera.scrollY - 50,
      maxX: this.camera.scrollX + this.camera.width + 50,
      maxY: this.camera.scrollY + this.camera.height + 50,
    };

    let instancesDrawn = 0;

    const points = this.tree.search(boundary);
    points.forEach((p) => {
      this.renderTexture.add(p.gm, 0);
      uniqueInstances.set(p, 1);
      instancesDrawn++;
    });

    this.ui.setText(
      `currently drawn:${instancesDrawn}\nunique instances drawn:${uniqueInstances.size
        .toString()
        .padStart(5, "0")}/${totalInstances}`
    );
    this.renderTexture.execute();
  }
}

const phaserConfig = {
  width: 360,
  height: 360 / 1.78,
  type: Phaser.WEBGL,
  backgroundColor: "#4f8a56",
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
    forceSetTimeOut: false,
  },
  pixelArt: true,
  scene: [Scene],
};

game = new Phaser.Game(phaserConfig);
