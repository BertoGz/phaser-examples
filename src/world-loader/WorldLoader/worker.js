import EventEmitter from "../EventEmitter";
import DexieSingleton from "../DexieSingleton";

const QUERY_OBJECT_BATCH_SIZE = 10000;
const CREATE_OBJECT_BATCH_SIZE = 50;
const CREATE_OBJECT_BATCH_DELAY = 5;

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
    param = { resolution, chunkSize, gridSize, trailDistance }
  ) {
    this.parent = parent;
    this.chunkSize = param.chunkSize;
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

    this.x = Math.floor(x / this.chunkSize) * this.chunkSize;
    this.y = Math.floor(y / this.chunkSize) * this.chunkSize;

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
    this.chunkSize = this.creator.chunkSize;
    this.x = xOff;
    this.y = yOff;
    this.key = position;
    this.data = data;
    this.width = this.chunkSize;
    this.height = this.chunkSize;
    this.creator.createdChunks.set(this.key, this);
    this.eventEmitter = this.creator.eventEmitter;
    this.clientKey = `${this.key}-${Date.now()}`;
  }

  _isWithinMatrix() {
    const trail = (this.creator.trailDistance - 1) * this.chunkSize;
    const boundary = this.creator.matrixBoundary;

    const isWithin =
      this.x >= boundary.x1 - trail &&
      this.x < boundary.x2 + trail &&
      this.y >= boundary.y1 - trail &&
      this.y < boundary.y2 + trail;

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
    this.chunkSize = this.parent.chunkSize;
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
    const chunkSize = this.parent.chunkSize;
    this.matrixBoundary = {
      x1: clientPosition.x - Math.floor(gridSize / 2) * chunkSize,
      y1: clientPosition.y - Math.floor(gridSize / 2) * chunkSize,
      x2: clientPosition.x + Math.ceil(gridSize / 2) * chunkSize,
      y2: clientPosition.y + Math.ceil(gridSize / 2) * chunkSize,
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
    const startTime = Date.now();

    const [getChunks, abort] = this.queryData(regionChunks);

    // this.eventEmitter.notify("objectCreatorStart", []);
    getChunks.then((data) => {
      const totalTime = Date.now() - startTime;
      //  console.log("done getting chunks. time elapsed:", totalTime);
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

        for (const chunk of regionChunks) {
          const { x, y } = chunk || {};
          const key = `${x},${y}`;
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
    const chunkSize = this.parent.chunkSize;
    const chunks = [];

    for (
      let x = this.matrixBoundary.x1;
      x < this.matrixBoundary.x2;
      x += chunkSize
    ) {
      for (
        let y = this.matrixBoundary.y1;
        y < this.matrixBoundary.y2;
        y += chunkSize
      ) {
        const key = `${x},${y}`;

        if (!this.createdChunks.has(key)) {
          const chunkBounds = { x, y, width: chunkSize, height: chunkSize };
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
  async createGameObjects(chunk, objects) {
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
        // function might abort early before all objects are created
        // therefor at the end of this await try and delete
        await this.createGameObjects(payload.chunk, payload.data);

        if (!payload.chunk._isWithinMatrix() || payload.chunk.isAborted) {
          payload.chunk.abort();
          const chunkToDelete = payload.chunk;

          payload.chunk.deReference();

          handleObjectDestroy(chunkToDelete);
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
      let totalTime = 0;
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
        payload.chunk.data = []; // free up memory
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
    const { gridSize, chunkSize, trailDistance, tableName } = params || {};

    const resolution = 16;

    this.chunkSize = chunkSize;

    this.trailDistance = trailDistance;

    this.tableName = tableName;

    this.gridSize = gridSize;

    this.eventEmitter = new EventEmitter();

    this.clientPosition = new ClientPosition(this, {
      resolution,
      chunkSize,
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
    self.postMessage({ type: "worker-ready" });
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
