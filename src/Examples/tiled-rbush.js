import Phaser from "phaser";
import RBush from "rbush";

import Player from "../Prefabs/Player";
import PhaserCamera from "../Classes/PhaserCamera";

import ConvertTiled from "world-loader/src/ConvertTiled";
import WorldAPI from "world-loader/src/WorldLoader";
import { lerp } from "../Functions/lerp";
import { createPixelScene } from "../Classes/PhaserPixelScene";
import ScaledRenderTexture from "../Classes/ScaledRenderTexture";
const UPSCALE_FACTOR = 3;
const GAME_WIDTH = 352;
const GAME_HEIGHT = 352 / 1;

const ROOT_PATH = "/assets/world3-files";
const WORLD_FILENAME = "world3.json";

const worldFile = `${ROOT_PATH}/${WORLD_FILENAME}`;
const convertTiled = new ConvertTiled();
const worldAPI = new WorldAPI(WORLD_FILENAME);

const loaderConfig = {
  gridSize: 3,
  trailDistance: 1,
  name: "environment",
  table: "any",
};

async function prepareDb() {
  await convertTiled.init();
  await convertTiled.convertWorld(worldFile);
}
function createRenderTexture() {
  return new ScaledRenderTexture(
    this,
    this.camera,
    0,
    0,
    this.camera.width,
    this.camera.height
  )
    .setOrigin(0)
    .setScrollFactor(0, 0);
}

class InitializeData extends Phaser.Scene {
  constructor() {
    super({ key: "initializeData" });
  }
  preload() {
    prepareDb().then(() => {
      console.log("scene 1 ended");
      this.scene.start("Scene");
    });
  }
  create() {
    this.add.text(0, 40, "performing file setup", {
      fontSize: 20,
      align: "center",
      fixedWidth: 360,
    });
    const waitLabel = this.add.text(0, 40 + 40, "please wait...", {
      fontSize: 10,
      align: "center",
      fixedWidth: 360,
    });

    // Array to store the different loading states (i.e., "loading.", "loading..", "loading...")
    const loadingStates = ["Loading", "Loading.", "Loading..", "Loading..."];
    let dotIndex = 0;

    // Create a timed event to update the text every 500 milliseconds
    this.time.addEvent({
      delay: 500, // Update every 500ms (half a second)
      callback: () => {
        // Update the text content with the current loading state
        waitLabel.setText(loadingStates[dotIndex]);

        // Move to the next state (loop back if needed)
        dotIndex = (dotIndex + 1) % loadingStates.length;
      },
      loop: true, // Loop this event indefinitely
    });
  }
}
let debug = false;
class Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Scene" });
    console.log("scene started2 ");
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
    this.load.image("background", "./assets/icons_16x16.png");
    this.load.image("air-balloon", "./assets/air-balloon.png");
    this.load.image("tree", "./assets/tree.png");
  }
  create() {
    this.worldLoader = worldAPI.createLoader(loaderConfig);
    createRenderTexture = createRenderTexture.bind(this);
    this.zoomScale = 1;
    this.isZoomedOut = false;
    this.lastClick = undefined;
    this.playerIsMoving = false;
    // create quadtree
    this.tree = new RBush(4);

    //create camera and player
    this.camera = new PhaserCamera(this, 0, 0); //.setScroll(0, 0);

    this.player = new Player(this, 500 * UPSCALE_FACTOR, 500 * UPSCALE_FACTOR, {
      maxSpeed: 7,
      lerp: 0.1,
    }).setDepth(10);

    //  this.camera.startFollow(this.player, 0.1);
    this.enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );

    // create render texture to draw game objects to
    this.renderTexture = createRenderTexture();

    // this.renderTexture.setScale(this.zoomScale);

    this.renderTexture.setOrigin(0);
    this.renderTexture.setScrollFactor(0);
    // let phaser manage this object
    this.add.existing(this.renderTexture);

    this.fpsText = this.add
      .text(0, 0, "", {
        font: "20px Arial",
        fill: "#000000",
      })
      .setFontSize(10 * this.zoomScale)
      .setScrollFactor(0)
      .setDepth(20); // Center the text and make it interactive;
    this.input.on("pointerdown", (pointer) => {
      console.log("pointer down");
      const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);

      //   return;
      this.lastClick = {
        x: worldPoint.x,
        y: worldPoint.y,
      };
      // destroy any prev markers
      if (this.marker) {
        this.marker.destroy();
      }
      this;
      this.marker = this.add
        .text(
          pointer.x * this.zoomScale + this.camera.scrollX,
          pointer.y * this.zoomScale + this.camera.scrollY,
          "x",
          {
            fontSize: 40 * this.zoomScale,
            color: "black",
          }
        )

        .setOrigin(0.5);
    });
    this.camera.setOrigin(0);
    const zoomSetting = document.getElementById("zoom-out");
    zoomSetting.addEventListener("change", (event) => {
      this.isZoomedOut = event.target.checked;

      if (this.isZoomedOut) {
        this.zoomScale = 9;
        this.player.movementHandler.setMaxSpeed(30);
        // use smaller scale player sprite
        this.player.setScale((1 * this.zoomScale) / 1);
        this.player.setTexture("air-balloon");
        this.player.setOrigin(0.5, 0.8);
      } else {
        this.zoomScale = 1;
        this.player.movementHandler.setMaxSpeed(1);
        this.player.setTexture("char_sprite", 6 * 8 - 1);
        this.player.setOrigin(0.5);
        // use bigger scale player sprite
        this.player.setScale(1);
      }

      this.fpsText.setFontSize(40 * this.zoomScale);

      this.camera.setZoom(1 / this.zoomScale);

      this.renderTexture.destroy();
      this.renderTexture = createRenderTexture();
      this.renderTexture.setScale(this.zoomScale);

      this.add.existing(this.renderTexture);
      this.camera.scrollX =
        this.player.x - (this.camera.width / 2) * this.zoomScale;
      this.camera.scrollY =
        this.player.y - (this.camera.height / 2) * this.zoomScale;

      // this.worldLoader.setStale();
    });
    const clearStorageSetting = document.getElementById("clear storage");
    clearStorageSetting.addEventListener("change", (event) => {
      if (event.target.checked) {
        convertTiled.deleteDatabase();
      }
    });

    // Add event listeners for the text button

    // Event listener for pointer (mouse or touch) click

    this.worldLoader.onCreateObject = (payload) => {
      if (Math.random() > 0.15 && this.isZoomedOut) {
        //   return;
      }
      const { object, chunk } = payload || {};
      const { tileId, x, y } = object || {};

      const tile = new Phaser.GameObjects.Image(
        this,
        x * UPSCALE_FACTOR,
        y * UPSCALE_FACTOR,
        "nature_tile",
        tileId
      );

      tile.name = "grass";

      chunk.objects.push(tile);
      const treeItem = {
        gm: tile,
        minX: tile.x,
        minY: tile.y,
        maxX: tile.x,
        maxY: tile.y,
      };
      this.tree.insert(treeItem);
      tile.treeItem = treeItem;
    };
    this.worldLoader.onChunksAllReady = () => {};

    this.worldLoader.onDestroyObject = (obj) => {
      // console.log("called first");
      // debugger;
      //    this.renderTexture.remove(obj, 0);
      this.tree.remove(obj.treeItem);
      obj.destroy();
    };
    this.worldLoader.onDestroyComplete = () => {};
  }
  update(time, delta) {
    //  console.log(this.camera.scrollX, this.camera.worldView.x);
    if (
      this.lastClick &&
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.lastClick.x,
        this.lastClick.y
      ) > 2
    ) {
      moveTowards(
        this.player,
        this.lastClick.x,
        this.lastClick.y,
        10 * this.zoomScale
      );
      this.playerIsMoving = true;
    } else {
      this.lastClick = undefined;
      this.playerIsMoving = false;
    }
    if (this?.lastElapse == undefined) {
      this.lastElapse = Date.now();
    }

    // Calculate the current FPS
    const fps = this.game.loop.actualFps;

    // Update the FPS text

    this.player.update(time, 1);

    worldAPI.execute({
      x: this.player.x / UPSCALE_FACTOR,
      y: this.player.y / UPSCALE_FACTOR,
    });

    const steerPointX =
      this.player.x - (this.camera.width / 2) * this.zoomScale;
    const steerPointY =
      this.player.y - (this.camera.height / 2) * this.zoomScale;
    this.camera.scrollY = lerp(this.camera.scrollY, steerPointY, 0.1);
    this.camera.scrollX = lerp(this.camera.scrollX, steerPointX, 0.1);

    if (!this.playerIsMoving && this.marker) {
      this.marker.destroy();
      this.marker = undefined;
    }

    let padding = -60 * this.zoomScale;
    if (this.isZoomedOut) {
      padding = 10 * this.zoomScale;
    }

    let boundary = {
      minX: this.camera.scrollX + padding,
      minY: this.camera.scrollY + padding,
      maxX: this.camera.scrollX + this.camera.width * this.zoomScale - padding,
      maxY: this.camera.scrollY + this.camera.height * this.zoomScale - padding,
    };

    if (Date.now() - this.lastElapse > 100) {
      this.renderTexture.removeAll();
      let instancesDrawn = 0;
      this.lastElapse = Date.now();
      const points = this.tree.search(boundary);
      points.forEach((p) => {
        // when zoomed out show less sprites to prevent slow down
        if (this.isZoomedOut) {
          const isGrassTile = p.gm.frame.name === 20;
          if (!isGrassTile && Math.random() > 0.3) {
            return;
          }
          if (isGrassTile && Math.random() > 0.8) {
            return;
          }
        }
        instancesDrawn++;
        this.renderTexture.add(p.gm, 0);
      });
      this.fpsText.setText(
        `fps: ${Math.round(fps)}\nsprites:${instancesDrawn}`
      );
    }
    this.renderTexture.add(this.player, 1);
    this.renderTexture.execute();

    if (this.enterKey.isDown) {
      setTimeout(function () {
        debug = true;
      }, 1000);
    }
    if (debug === true) {
      debug = false;
      debugger;
    }
  }
}

const phaserConfig = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  type: Phaser.WEBGL,
  upscale: UPSCALE_FACTOR,
  backgroundColor: "#2273a8",
  orientation: "landscape",
  powerPreference: "high-performance",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  physics: {
    default: "arcade",
    fps: 60, // Sync physics to 60 FPS
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  pixelArt: true,
  scene: [InitializeData],
};
const game = createPixelScene(phaserConfig, Scene);

function moveTowards(object, targetX, targetY, speed) {
  const dx = targetX - object.x;
  const dy = targetY - object.y;

  // Calculate the distance between the object and the target
  const distance = Math.sqrt(dx * dx + dy * dy);

  // If the object is already close enough to the target, stop moving
  if (distance < speed) {
    object.x = targetX;
    object.y = targetY;
  } else {
    // Normalize the direction
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Move the object by the speed in the direction of the target
    object.x += directionX * speed;
    object.y += directionY * speed;
  }
}
