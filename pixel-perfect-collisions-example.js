/// Phaser 3 Pixel perfect collisions


// Phaser 3 scene setup
class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    // Preload assets here if any
  }

create() {
  // Player setup
  this.player = this.add.rectangle(100, 100, 32, 32, 0x00ff00); // Simple player (green square)
  this.player.setOrigin(0, 0);
  this.playerSpeed = 2; // The base speed of the player in pixels
  this.playerVelocity = { x: 0, y: 0 };

  // Create a group of blocks (multiple blocks)
  this.blocks = this.add.group({
    classType: Phaser.GameObjects.Rectangle,
    key: 'block',
    runChildUpdate: false
  });

  // Add some blocks to the group (positions are just examples)
  this.blocks.add(this.add.rectangle(300, 100, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300, 132, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300, 132+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300, 132+32+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300, 132+32+32+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300-32, 132+32+32+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300-32-32, 132+32+32+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300-32-32-32, 132+32+32+32, 32, 32, 0xff0000)); // Red block
  this.blocks.add(this.add.rectangle(300-32-32-32, 132+32+32+32, 32, 32, 0xff0000)); // Red block

  // Set up keyboard input
  this.cursors = this.input.keyboard.createCursorKeys();

  // For debugging
  this.debugGraphics = this.add.graphics();
}

  update() {
    // Set player velocity based on keyboard input
    if (this.cursors.left.isDown) {
      this.playerVelocity.x = -this.playerSpeed;
    } else if (this.cursors.right.isDown) {
      this.playerVelocity.x = this.playerSpeed;
    } else {
      this.playerVelocity.x = 0;
    }

    if (this.cursors.up.isDown) {
      this.playerVelocity.y = -this.playerSpeed;
    } else if (this.cursors.down.isDown) {
      this.playerVelocity.y = this.playerSpeed;
    } else {
      this.playerVelocity.y = 0;
    }

    // Perform pixel-perfect movement
    this.movePlayer();
  }

  movePlayer() {

    let dx = this.playerVelocity.x;
    let dy = this.playerVelocity.y;

    // If the player is moving in both x and y directions, we need to check for collisions in both directions
    if (dx !== 0 || dy !== 0) {
      let steps = Math.max(Math.abs(dx), Math.abs(dy));

      // Check for overlap pixel by pixel
      for (let i = 0; i < steps; i++) {

        let nextX = this.player.x + dx / steps * (i + 1);
        let nextY = this.player.y + dy / steps * (i + 1);

        // Check for overlap at the next position
        if (!this.checkOverlap(nextX, this.player.y)) {
          // Move the player horizontally if no overlap in the X direction
          this.player.x = nextX;
        }

        if (!this.checkOverlap(this.player.x, nextY)) {
          // Move the player vertically if no overlap in the Y direction
          this.player.y = nextY;
        }
      }
    }

    // Debugging: Draw the player and block
    this.debugGraphics.clear();
    this.debugGraphics.fillStyle(0x00ff00, 1); // Green for player
    this.debugGraphics.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    

    let children = this.blocks.getChildren();
for (let i = 0; i < children.length; i++) {
this.debugGraphics.fillStyle(0xff0000, 1); // Red for block
  const block = children[i];
  //this.debugGraphics.fillRect(block.x, block.y, block.width, block.height);
}
    
  }

// Function to check for overlap with a group of blocks
checkOverlap(x, y) {
  // Iterate through all blocks in the group and check for overlap
  for (let block of this.blocks.getChildren()) {
    if (Phaser.Geom.Rectangle.Overlaps(new Phaser.Geom.Rectangle(x, y, this.player.width, this.player.height), block.getBounds())) {
      return true; // Return true as soon as we find an overlap
    }
  }
  return false; // Return false if no overlap is found with any block
}
}

// Phaser 3 game config
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: MainScene,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false // Disable default arcade physics debug
    }
  }
};

// Create the Phaser game instance
const game = new Phaser.Game(config);
