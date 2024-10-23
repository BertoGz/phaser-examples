import EventEmitter from "../EventEmitter";
import DexieSingleton from "../DexieSingleton";

const QUERY_OBJECT_BATCH_SIZE = Infinity; // Read note 1a
const CREATE_OBJECT_BATCH_SIZE = 50;
const CREATE_OBJECT_BATCH_DELAY = 5;

/**
 * note 1a:
 * we are suppose to fetch the objects from an array of keys
 * we originally had a limit to slice fetch the data in slices (batches)
 * but for now it has been removed since the map should have priority. if
 * a map is too big to fetch then the user should work with smaller maps/chunks.
 */

function handleObjectDestroy(chunk) {
  self.postMessage({
    type: "handleObjectDestroy",
    payload: chunk.clientKey,
  });
}

// SINGLETON
class Timer {
  static instance;
  constructor() {
    if (!Timer.instance) {
      Timer.instance = this;
      this.timers = new Map();
    }
    return Timer.instance;
  }
  add(fn, time) {
    const timeSet = Date.now();
    //   const key = `${fn.name}-${timeSet}`;
    this.timers.set(fn, { fn, time, timeSet });
  }
  execute() {
    this.timers.forEach((t, key) => {
      const { fn, time, timeSet } = t || {};

      if (Date.now() - timeSet > time) {
        fn();

        this.timers.delete(key);
      }
    });
  }
  cleanUp() {
    delete Timer.instance;
  }
}

class ClientPosition {
  constructor(
    parent,
    param = { resolution, chunkDimensions, gridSize, trailDistance }
  ) {
    this.parent = parent;
    this.chunkDimensions = param.chunkDimensions;
    this.resolution = param.resolution;
    this.gridSize = param.gridSize;
    this.trailDistance = param.trailDistance;
    this.eventEmitter = this.parent.eventEmitter;
    this.x = 0;
    this.y = 0;
    this.prevX = undefined;
    this.prevY = undefined;
    this.stale = false;
  }

  /**
   *
   * @param {{x,y}} clientPosition
   * @description sets the client position in chunks
   */
  execute(clientPosition) {
    const { x, y } = clientPosition || {};

    this.x =
      Math.floor(x / this.chunkDimensions.width) * this.chunkDimensions.width;
    this.y =
      Math.floor(y / this.chunkDimensions.height) * this.chunkDimensions.height;

    if (this.prevX !== this.x || this.prevY !== this.y || this.stale) {
      this.eventEmitter.notify("clientChunkChange", this);
      this.prevX = this.x;
      this.prevY = this.y;
      this.stale = false;
    }
  }
  setStale() {
    this.stale = true;
  }

  cleanUp() {
    delete ClientPosition.instance;
  }
}

class Chunk {
  creator = undefined;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  key = "";
  clientKey = undefined; // a more unique key sent to the client
  state = "";
  data = [];
  objects = [];
  eventEmitter = undefined;
  dateCreated = undefined;
  isAborted = false;
  isSettled = false;

  constructor(payload, creator) {
    const { position, xOff, yOff, data } = payload || {};

    this.creator = creator;
    this.chunkDimensions = this.creator.chunkDimensions;
    this.x = xOff;
    this.y = yOff;
    this.key = `${
      Math.floor(xOff / this.chunkDimensions.width) * this.chunkDimensions.width
    },${
      Math.floor(yOff / this.chunkDimensions.height) *
      this.chunkDimensions.height
    }`;

    this.data = data;
    this.width = this.chunkDimensions.width;
    this.height = this.chunkDimensions.height;
    this.creator.createdChunks.set(this.key, this);
    this.eventEmitter = this.creator.eventEmitter;
    this.clientKey = `${this.key}-${Date.now()}`;
  }

  _isWithinMatrix() {
    const trailW =
      (this.creator.trailDistance - 1) * this.chunkDimensions.width;
    const trailH =
      (this.creator.trailDistance - 1) * this.chunkDimensions.height;
    const boundary = this.creator.matrixBoundary;

    const isWithin =
      this.x >= boundary.x1 - trailW &&
      this.x < boundary.x2 + trailW &&
      this.y >= boundary.y1 - trailH &&
      this.y < boundary.y2 + trailH;

    return isWithin;
  }
  deReference = () => {
    this.eventEmitter = undefined;
    this.creator.createdChunks.delete(this.key);
    self.postMessage({
      type: "cleanUp-chunk",
      payload: this.clientKey,
    });
  };
  abort() {
    this.isAborted = true;
  }
  settle() {
    this.isSettled = true;
  }
  getPrimitive() {
    return { x: this.x, y: this.y };
  }
}

// Create Chunks
class ChunkCreator {
  constructor(parent) {
    this.parent = parent;
    this.chunkDimensions = this.parent.chunkDimensions;
    this.trailDistance = this.parent.trailDistance;
    this.eventEmitter = this.parent.eventEmitter;
    this.abort = undefined;
    this.eventEmitter.subscribe("clientChunkChange", this.onClientChunkChange);
    this.createdChunks = new Map();
    this.eventEmitter.subscribe("chunkReady", this.onChunkReady);
  }
  onChunkReady = (chunk) => {
    chunk.settle();
    let allDone = true;

    for (let c of this.createdChunks.values()) {
      if (!c._isWithinMatrix()) {
        c.abort();
        c.deReference();
        handleObjectDestroy(c);
        continue; // Exits the loop early
      }

      if (c.isSettled === false) {
        allDone = false;
      }
    }
    if (allDone) {
      //  this.parent.onChunksAllReady();
      self.postMessage({ type: "onChunksAllReady" });
    }
  };

  onClientChunkChange = async (clientPosition) => {
    const gridSize = this.parent.gridSize;
    const chunkDimensions = this.parent.chunkDimensions;
    this.matrixBoundary = {
      x1: clientPosition.x - Math.floor(gridSize / 2) * chunkDimensions.width,
      y1: clientPosition.y - Math.floor(gridSize / 2) * chunkDimensions.height,
      x2: clientPosition.x + Math.ceil(gridSize / 2) * chunkDimensions.width,
      y2: clientPosition.y + Math.ceil(gridSize / 2) * chunkDimensions.height,
    };

    // delete pre-existing chunks that are no longer in the matrix
    this.createdChunks.forEach(async (chunk) => {
      if (!chunk._isWithinMatrix()) {
        chunk.abort();

        const chunkToDestroy = chunk;
        chunk.deReference();

        handleObjectDestroy(chunkToDestroy);
      }
    });

    const regionChunks = this.createRegionChunks();

    const [getChunks, abort] = this.queryData(regionChunks);

    getChunks.then((data) => {
      const chunks = this.initChunks(data);
      this.eventEmitter.notify("objectCreatorStart", chunks);
      this.abort = undefined;
    });
  };
  queryData(regionChunks, fromTable) {
    const tableName = worldDb.name;

    if (!regionChunks) {
      console.error("chunk not specified");
      return [Promise.reject("chunks not specified"), () => {}];
    }
    if (!tableName) {
      console.error("table not specified");
      return [Promise.reject("table not specified"), () => {}];
    }

    const chunksTable = worldDb.dexie.db.table(`${tableName}_chunks`);

    let txPar = null;

    const promise = worldDb.dexie.db.transaction(
      "r",
      chunksTable,
      async (tx) => {
        txPar = tx;

        let chunkKeysInRegion = [];

        /// TODO find map chunk dimensions
        for (const chunk of regionChunks) {
          const { x, y } = chunk || {};

          const key = `${
            Math.floor(x / this.chunkDimensions.width) *
            this.chunkDimensions.width
          },${
            Math.floor(y / this.chunkDimensions.height) *
            this.chunkDimensions.height
          }`;

          chunkKeysInRegion.push(key);
        }

        // Query chunks within the boundary
        let chunksWithinBoundary = await chunksTable
          .where("position")
          .anyOf(chunkKeysInRegion)
          .toArray();

        return chunksWithinBoundary;
      }
    );

    // returns promise and abort functions
    return [promise, () => {}];
  }

  createRegionChunks() {
    const chunkDimensions = this.parent.chunkDimensions;
    const chunks = [];

    for (
      let x = this.matrixBoundary.x1;
      x < this.matrixBoundary.x2;
      x += chunkDimensions.width
    ) {
      for (
        let y = this.matrixBoundary.y1;
        y < this.matrixBoundary.y2;
        y += chunkDimensions.height
      ) {
        const key = `${x},${y}`;

        if (!this.createdChunks.has(key)) {
          const chunkBounds = {
            x,
            y,
            width: chunkDimensions.width,
            height: chunkDimensions.height,
          };
          chunks.push(chunkBounds);
        }
      }
    }

    return chunks;
  }
  initChunks(data) {
    const newChunks = [];
    for (const chunkData of data) {
      if (this.createdChunks.has(chunkData.position)) {
        continue;
      }
      const chunk = new Chunk(chunkData, this);

      if (chunk._isWithinMatrix()) {
        newChunks.push(chunk);
      }
    }
    return newChunks;
  }
  setStale(chunkKey) {
    if (chunkKey) {
      const chunk = this.createdChunks.get(chunkKey);
      chunk.abort();
      chunk.deReference();
      handleObjectDestroy(chunk);
    } else {
      this.createdChunks.forEach((c) => {
        c.abort();
        c.deReference();
        handleObjectDestroy(c);
      });
    }
  }
}

// Create Game Objects
class ObjectCreator {
  constructor(parent) {
    this.parent = parent;
    this.eventEmitter = this.parent.eventEmitter;
    this.chunkCreator = this.parent.chunkCreator;
    this.clientPosition = this.parent.clientPosition;
    this.timer = new Timer();
    this.objectsCreatedCount = 0;
    this.gameObjects = [];
    this.abort = undefined;

    this.eventEmitter.subscribe("objectCreatorStart", this.onStart);
  }

  /**
   *
   * @param {*} chunk
   * @param {*} objects
   * @description handles creating bulk game objects
   */
  async createGameObjects(chunk, objects, chunkDimensions) {
    return new Promise((resolve, reject) => {
      const batchSize = CREATE_OBJECT_BATCH_SIZE;
      const delay = CREATE_OBJECT_BATCH_DELAY;

      let objectIndex = 0; // Keep track of the current index in the objects array

      // Function to process a batch of objects
      const processBatch = () => {
        let batchCount = 0;

        // Process only a limited number of objects (batchSize) in each batch
        while (
          objectIndex < objects.length &&
          batchCount < batchSize &&
          !chunk.isAborted
        ) {
          const object = objects[objectIndex];

          // Call onDestroyObject for each object in the batch

          self.postMessage({
            type: "onCreateObject",
            payload: {
              chunk: {
                x: chunk.x,
                y: chunk.y,
                width: chunk.width,
                height: chunk.height,
                key: chunk.clientKey,
              },
              object,
            },
          });
          objectIndex++; // Move to the next object
          batchCount++; // Track how many objects we've processed in this batch
        }

        // process the next batch after a delay
        if (objectIndex < objects.length && !chunk.isAborted) {
          this.timer.add(() => processBatch(), delay);
        } else {
          this.eventEmitter.notify("chunkReady", chunk);

          resolve();
        }
      };
      try {
        this.timer.add(() => processBatch(), delay);
      } catch (e) {
        reject();
      }
    });
    // Start processing batches
    //  return await processBatch();
  }

  onStart = (chunks) => {
    const fromTable = "";
    if (!chunks) {
      console.error("chunks not specified at queryObjects");
      return [Promise.reject("data not specified"), () => {}];
    }

    const [fetch, abort] = this.queryObjects(chunks);
    // update abort refernce to latest work
    this.abort = abort;
    fetch.then((chunkObjs) => {
      if (!chunkObjs) {
        return;
      }

      chunkObjs.forEach(async (payload) => {
        if (payload.chunk) {
          // function might abort early before all objects are created
          // therefor at the end of this await try and delete
          await this.createGameObjects(payload.chunk, payload.data);

          if (!payload.chunk._isWithinMatrix() || payload.chunk.isAborted) {
            payload.chunk.abort();
            const chunkToDelete = payload.chunk;

            payload.chunk.deReference();

            handleObjectDestroy(chunkToDelete);
          }
        } else {
          console.log(chunkObjs);
        }
      });
    });
  };

  queryObjects(chunks) {
    const tableName = worldDb.name;
    const objectsTable = worldDb.dexie.db.table(`${tableName}_objects`);
    const sampleChunk = chunks[0];

    // Batch size for each bulkGet operation
    const batchSize = QUERY_OBJECT_BATCH_SIZE; // Adjust as needed for your use case

    // Wrapping the logic in an async function to handle asynchronous calls properly
    const queryAndProcess = async () => {
      if (!chunks.length > 0) {
        return;
      }
      let allData = [];
      // Iterate over each chunk in the 2D array (chunks)
      for (const chunk of chunks) {
        let abortThis = false;
        if (!Array.isArray(chunk.data[0])) {
          continue;
        }

        try {
          // While there are still IDs in the current chunk
          while (Array.isArray(chunk.data[0]) && chunk.data[0].length > 0) {
            // Get the next batch from the chunk using splice (modifies the original chunk)
            const batchToUse = chunk.data[0].splice(0, batchSize);

            // check if chunk is still valid
            if (!chunk._isWithinMatrix() || chunk.isAborted) {
              chunk.abort();
              chunk.deReference();
              abortThis = true;
              break;
            }
            try {
              // Start a new transaction for each bulkGet operation
              await worldDb.dexie.db.transaction(
                "r",
                `${tableName}_objects`,
                async () => {
                  const batch = await objectsTable.bulkGet(batchToUse);

                  allData.push(...batch);

                  return batch;
                }
              );

              // Add a small delay before the next iteration to avoid overwhelming the database

              //  await delay(10); // Adjust delay time as needed
            } catch (error) {
              console.error("Error in transaction or bulkGet:", error);
            }
          }
          if (abortThis) {
            continue;
          }
        } catch (e) {
          debugger;
        }
      }

      // assign data to chunks
      const chunkObjects = new Map();

      allData.forEach((obj) => {
        const chunkX =
          Math.floor(obj.x / sampleChunk.width) * sampleChunk.width;
        const chunkY =
          Math.floor(obj.y / sampleChunk.height) * sampleChunk.height;
        const key = `${chunkX},${chunkY}`;

        if (!chunkObjects.has(key)) {
          const chunk = chunks.find((c) => c.x === chunkX && c.y === chunkY);
          chunkObjects.set(key, { chunk, data: [] });
        }
        chunkObjects.get(key).data.push(obj);
      });
      allData = []; // free up memory

      chunkObjects.forEach((payload) => {
        if (payload.chunk) {
          payload.chunk.data = []; // free up memory
        }
      });

      return chunkObjects;
    };

    // Return a promise for the asynchronous operation
    const promise = queryAndProcess();

    return [promise, () => {}];
  }
  execute() {
    this.timer.execute();
  }
}

class Loader {
  constructor(params) {
    const { gridSize, trailDistance, tableName } = params || {};

    const resolution = 16;

    this.chunkDimensions = worldDb.chunkDimensions;

    this.trailDistance = trailDistance;

    this.tableName = tableName;

    this.gridSize = gridSize;

    this.eventEmitter = new EventEmitter();

    this.clientPosition = new ClientPosition(this, {
      resolution,
      chunkDimensions: this.chunkDimensions,
      trailDistance,
      gridSize,
    });

    this.chunkCreator = new ChunkCreator(this);
    this.objectCreator = new ObjectCreator(this);
  }

  execute(clientPosition) {
    this.clientPosition.execute(clientPosition);
    this.objectCreator.execute();
  }

  cleanUp() {
    this.clientPosition.cleanUp();
  }
  setStale(chunkKey) {
    this.chunkCreator.setStale(chunkKey);
    this.clientPosition.setStale();
  }
  // called by the api when an object needs to be created
  onCreateObject = undefined;

  // called by the api when all chunks are prepared
  onChunksAllReady = undefined;

  // called by the api when an object needs to be destroyed
  onDestroyObject = undefined;
}

// SINGLETON
class WorldDb {
  static instance;
  constructor(fileName) {
    if (!WorldDb.instance) {
      if (!fileName) {
        throw new Error("fileName for worldDb not specified");
      } else {
        WorldDb.instance = this;
        this.name = fileName;
        this.dexie = new DexieSingleton();

        this.openDb();
      }
    }
    return WorldDb.instance;
  }
  async openDb() {
    await this.dexie.db.open();
    const converted_worlds = this.dexie.db.table("converted_worlds");

    const converted_world = await converted_worlds
      .where("world_name")
      .equals(this.name)
      .toArray();

    // if world exists, find its params
    if (converted_world.length >= 1) {
      const { chunkWidth, chunkHeight } = converted_world[0] || {};
      this.chunkDimensions = { width: chunkWidth, height: chunkHeight };

      self.postMessage({ type: "worker-ready" });
    }
  }
  cleanUp() {
    delete WorldDb.instance;
  }
}
let worldDb = undefined;
let loader = undefined;

self.onmessage = async (event) => {
  const { type, payload } = event.data;
  switch (type) {
    case "world-db-init":
      worldDb = new WorldDb(payload);
      break;
    case "loader-init":
      loader = new Loader(payload);
      break;
    case "loader-execute":
      loader.execute(payload);
      break;
    case "loader-set-stale":
      loader.setStale(payload);
      break;
  }
};
