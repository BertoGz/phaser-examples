/**
 * NEW IDEA:
 * create a system that uses a query region to create chunks. NO
 *
 * first it checks which chunk keys already exist, if any of them are
 * farther than the distance limit destroy them,
 * if any chunk keys dont exist start preloading them.
 * we push the chunk regions and wait until all have finished fetching chunk
 *
 * the preload feature handles loading the actual chunk from the chunks table
 * if the player has moved to an new matrix alignment abort the query
 *
 * once the chunk query resolves the data is pushed to a second query that is called once
 * all chunks in the matrix finished preloading.
 *
 * the onPreloadComplete method is executed with the data from the chunks query
 * here we query the actual game objects from the objects table
 *
 * we iterate through all the found data assigning each object to a chunk
 */

// SINGLETON

const createLoaderDefaultParams = {
  gridSize: 1,
  trailDistance: 1,
  tableName: "",
};
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

/**
 * destroyInBatches
 * @param {Object} parent - The parent object holding the timer
 * @param {Object} chunk - The chunk object containing a list of objects to destroy
 * @param {Function} fn - Function to call for each object destruction
 * @param {Number} batchSize - How many objects to destroy in each batch
 * @param {Number} delay - Delay between each batch
 */
async function destroyInBatches(
  parent,
  chunk,
  fn,
  batchSize = 500,
  delay = 500
) {
  if (!chunk || !chunk.objects || chunk.objects.length === 0) {
    return; // If no chunk or empty objects list, just exit
  }

  let objectIndex = 0;

  const processBatch = async () => {
    let processedInBatch = 0;

    // Process only up to `batchSize` objects in each run
    while (objectIndex < chunk.objects.length && processedInBatch < batchSize) {
      const object = chunk.objects[objectIndex];
      fn(object); // Perform destruction on the object
      objectIndex++;
      processedInBatch++;
    }

    // Wait for the next batch after delay, if there are more objects to process
    if (objectIndex < chunk.objects.length) {
      await new Promise((resolve) => setTimeout(resolve, delay)); // Delay to spread out the destruction
      return processBatch(); // Process the next batch
    }
  };
  processBatch();
}

class Loader {
  constructor(parent, params = createLoaderDefaultParams) {
    this.chunks = new Map();
    this.worker = new Worker(new URL("./worker.js", import.meta.url)); // new Loader(params);
    this.parent = parent;
    this.worker.postMessage({
      type: "world-db-init",
      payload: parent.fileName,
    });
    this.workerReady = false;

    this.onWorkerReady = () => {
      this.workerReady = true;
      this.worker.postMessage({ type: "loader-init", payload: params });
    };

    this.worker.onerror = function (error) {
      this.workerReady = false;
      console.log(error);
    };

    this.worker.onmessage = async (event) => {
      const { type, payload } = event.data || {};
      switch (type) {
        case "onCreateObject":
          const key = payload.chunk.key;
          if (!this.chunks.has(key)) {
            const newChunk = { ...payload.chunk, objects: [] };
            this.chunks.set(key, newChunk);
          }
          const chunk = this.chunks.get(key);

          this.onCreateObject({ chunk, object: payload.object });

          break;
        case "onChunksAllReady":
          this.onChunksAllReady(payload);
          break;
        case "cleanUp-chunk":
          break;
        case "handleObjectDestroy":
          const chunk2 = this.chunks.get(payload);
          // item might not be part of a chunk if creation got aborted
          if (chunk2) {
            await destroyInBatches(
              this.parent,
              chunk2,
              this.onDestroyObject,
              50,
              5
            );
            this.chunks.delete(payload);
          }

          break;
        case "worker-ready":
          this.onWorkerReady();
          break;
      }
    };
  }
  postMessage(params) {
    this.worker.postMessage(params);
  }
  cleanUp() {
    this.worker.terminate();
  }
  setStale(chunkKey) {
    this.worker.postMessage({ type: "loader-set-stale", payload: chunkKey });
  }

  // called by the api when an object needs to be created
  onCreateObject = () => {};

  // called by the api when all chunks are prepared
  onChunksAllReady = () => {};

  // called by the api when an object needs to be destroyed
  onDestroyObject = () => {};
}
export default class WorldAPI {
  constructor(fileName) {
    this.fileName = fileName;
    this.loaders = [];
    this.timer = new Timer();
  }

  createLoader(params = createLoaderDefaultParams) {
    const loader = new Loader(this, params);
    this.loaders.push(loader);
    return loader;
  }
  execute(clientPosition) {
    {
      for (const loader of this.loaders) {
        if (loader.workerReady) {
          loader.postMessage({
            type: "loader-execute",
            payload: clientPosition,
          });
        }
      }
    }
    this.timer.execute();
  }

  cleanUp() {
    this.worldDb.cleanUp();
    this.loaders.forEach((loader) => {
      loader.cleanUp();
    });
    this.timer.cleanUp();
    this.loaders = [];
  }
}

/**
 * Example usage:
 * const worldLoader = new WorldLoader('world2')
 * 
 * create(){
 *  worldLoader.onPreload=(chunk)=>{
 *  
 *  }
 *  worldLoader.onCreate=(payload)=>{
 *      const {data} = payload || {}
 *      return data.map((obj)=>{
 *          const {x,y} = obj || {}
 *          const obj = new Phaser.image('sprite',x,y)
 *          tree.add(obj)
 *          return obj
 *      })
 * 
 *  worldLoader.onDestroy = (payload)=>{
 *  const {objects} = payload || {}
 *  objects.forEach((o)=>{
 *      o.destroy()
 *  })
 * 
 * }

 * }
 * }
 * 
 * update(){
 * worldLoader.execute(player)
 * }
 */

/**
 * Read map file.
 * convert map file if doesnt exist in system. else skip convert.
 * init WorldLoader Library
 * set the clientPosition (once per frame)
 * worldLoader notifys to create new chunks (when clientChunkPosition changes)
 * clear any previous chunks that are not within the boundary by calling destroy on each chunk.
 * create new chunks around player.
 * when new chunks have finished creating, redestribute the quadtree.
 *
 *
 *
 *
 * when a new client position is added we go into chunk creation mode.
 * first we update the chunk boundary to its latest.
 * we check each existing chunk to see if its still within boundary.
 * if not within boundary begin destruction on each.
 *
 * CHUNK DESTRUCTION.
 * a chunk can be in several states when chunk destruction occurs.
 * 1) chunk is being loaded from disk
 * 2) chunk objects are being loaded from disk (in batches)
 * 3) phaser 3 objects are being created (in batches)
 *
 * in any of these cirumstances we need to be able to handle chunk destruction properly.
 * if in case #1, we can simply not push the chunk to the list of created chunks.
 * if in case #2, we can abort the process at the beginning of each batch.
 * if in case #3, we can immediately remove the chunk from createdChunks, and call
 * destroy(chunk)
 *
 * if a queue is being resolved in the middle of this happening.
 * the query will resolve with when it was previously a valid chunk.
 * with each query before calling create game objects, check if its still withink
 * the matrix b
 *
 */
