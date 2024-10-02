let total = 0;

/*!
 * Author: Berto Gonzalez
 * License: MIT
 * Version: 1.0.0
 * Date: 2024-05-21
 */

class Id {
  cursor = 0;
  static instance;
  constructor() {
    if (!Id.instance) {
      Id.instance = this;
    }
    return Id.instance;
  }
  generate() {
    return this.cursor++;
  }
  clear() {
    this.cursor = 0;
  }
  destroy() {
    this.clear(); // Clear instance data when destroyed
    Id.instance = undefined;
  }
}

class Timer {
  static instance;
  constructor() {
    if (!Timer.instance) {
      Timer.instance = this;
      this.timers = new Map();
    }
    return Timer.instance;
  }
  add(point, fn, time) {
    const timeSet = Date.now();
    this.timers.set(point.id, { fn, time, timeSet });
  }
  execute() {
    const newTime = Date.now();
    this.timers.forEach((t, key) => {
      const { fn, time, timeSet } = t || {};
      a;
      if (newTime - timeSet > time) {
        fn();
        this.timers.delete(key);
      }
    });
  }
  destroy() {
    this.timers.clear(); // Clear all timers
    Timer.instance = undefined;
  }
}

export class Boundary {
  constructor(x, y, width, height, padding = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.padding = padding;
  }

  /**
   * @description
   * used to check if a boundary intersects this boundary.
   */
  intersects(other) {
    const padding = this.padding;

    // check if boundary boxes intersect
    const did =
      this.x < other.x + other.width + other.padding &&
      this.x + this.width > other.x - other.padding &&
      this.y < other.y + other.height + other.padding &&
      this.y + this.height > other.y - other.padding;

    return did;
  }

  /**
   * @description
   * used to check if a point is within this boundary
   *
   */
  contains(point) {
    const padding = this.padding;
    const didContain =
      point.x >= this.x - padding &&
      point.x <= this.x + this.width + padding &&
      point.y >= this.y - padding &&
      point.y <= this.y + this.height + padding;
    return didContain;
  }
}

/**
 * @description wrapper for data
 */

export class QuadTreeObject {
  constructor(gameObject) {
    this.gm = gameObject;
    this.point = undefined;
    this.tree = undefined;
    this.isMounted = false;
  }
  init(tree) {
    this.tree = tree;
    const time = new Date().getTime();
    this.id = `${time}-${this.name}-${QuadtreeManager.instance.generateId()}`;
    this.gm.id = this.id;
    // this.parent = obj;
    const fn = [this.destroy];
    this.cacheFn = fn[0];
    this.destroy = () => {
      this.cacheFn();
      if (this.point) {
        this.point.remove();
      } else {
        this.tree.errorPoints.push(this);
      }
    };
    this.isInit = true;
  }

  addToQuadtree(tree) {
    this.point.setTree(tree);
  }

  getPosition() {
    console.error(
      "getPosition must be overwritten with custom getter returning [x,y] object position"
    );
  }
  updatePosition() {
    this.point.updatePosition(this);
  }
}

/**
 * @description a point on the quadtree. Holds reference to the game object and methodfs to modify its stale value and more.
 */
export class QuadTreePoint {
  constructor(pos, obj, tree) {
    this.x = pos.x;
    this.y = pos.y;
    this.quadNode = undefined;
    this._tree = tree;
    this.stale = false;
    this.id = obj.id;
    this.color = "black";
    this.obj = obj;
    this.obj.point = this;
  }
  getData() {
    return this.obj;
  }
  setStale() {
    this.stale = true;
    return this.stale;
  }

  updatePosition(data) {
    const [newX, newY] = data.getPosition()[0];
    this.x = newX;
    this.y = newY;
    this.setStale();
  }
  getPosition() {
    return [this.x, this.y];
  }
  setTree(tree) {
    this._tree = tree;
  }
  // remove the point from the quadnode
  // remove the point from the tree
  remove() {
    this.setStale();
    // remove point if currenly pare of node
    if (this.quadNode) {
      this.quadNode.deReferencePoint(this);
    }
    // remove point if currently in queued list
    this._tree.queuedPoints.delete(this.id);
  }
}

class QuadTreeNode {
  constructor(boundary, capacity = 4, parent) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.children = null;
    this.parent = parent;
    this.id = Date.now() + Math.random() * 100;
    this._quadtree = undefined;
    this.quadtreeManager = QuadtreeManager.instance;
    const arr = [
      "red",
      "yellow",
      "blue",
      "green",
      "black",
      "teal",
      "brown",
      "purple",
      "lightblue",
      "orange",
    ];
    this.color = arr[Math.floor(Math.random() * arr.length)];
  }
  // returns all the subtrees in a list
  getSubtrees(node = this) {
    if (node === null || !node.children) {
      return [];
    }

    let subtrees = [];

    for (let i = 0; i < 4; i++) {
      subtrees = subtrees.concat(this.getSubtrees(node.children[i]));
    }

    subtrees.push(node);

    return subtrees;
  }
  // Method to gather all points from the quadtree recursively
  getAllPoints() {
    let allPoints = [...this.points]; // Gather points from this node

    // If this node has children, gather points from them as well
    if (this.children) {
      for (let child of this.children) {
        allPoints.push(...child.getAllPoints()); // Recursively gather points from children
      }
    }

    return allPoints; // Return all gathered points
  }

  getRoot() {
    if (this.parent) {
      return this.parent.getRoot();
    } else {
      return this;
    }
  }

  insert(point) {
    if (!this.boundary.contains(point)) {
      return undefined;
    }

    const doInsert = () => {
      point.color = this.color;
      point.quadNode = this;
      this.points.push(point);
      return this;
    };
    // check if this shape has minimum capacity left
    if (this.points.length < this.capacity) {
      doInsert();
    } else {
      // if this quad has full shapes
      // try and create a subdivision
      if (!this.children) {
        // try subdivide
        // if could not sub divide then we reached minimum quad size
        // so just push shape onto this quad
        if (!this._subdivide()) {
          doInsert();
        }
      }
      // check if there are subdivisions
      // if there are try to insert child into
      //

      if (this.children?.length) {
        let inserted = false;
        for (let child of this.children) {
          if (child.insert(point)) {
            inserted = true;
            return child;
            //  break;
          }
        }
      }
    }
    return this;
  }
  _subdivide() {
    const { x, y, width, height } = this.boundary;
    //exit so that we dont create infinite space.
    if (Math.floor(width) <= this.quadtreeManager.resolution) {
      return false;
    }
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const nw = new Boundary(x, y, halfWidth, halfHeight);
    const ne = new Boundary(x + halfWidth, y, halfWidth, halfHeight);
    const sw = new Boundary(x, y + halfHeight, halfWidth, halfHeight);
    const se = new Boundary(
      x + halfWidth,
      y + halfHeight,
      halfWidth,
      halfHeight
    );

    this.children = [
      new QuadTreeNode(nw, this.capacity, this),
      new QuadTreeNode(ne, this.capacity, this),
      new QuadTreeNode(sw, this.capacity, this),
      new QuadTreeNode(se, this.capacity, this),
    ];
    this.children.forEach((c) => {
      c._quadtree = this._quadtree;
    });
    return true;
  }

  /**
   * @description
   * returns points in the quadtree that lie within boundary
   * @param {*} rangeBoundary
   * @returns
   */
  queryRange(boundary) {
    const pointsInRange = [];
    if (!this.boundary.intersects(boundary)) {
      return pointsInRange;
    }

    for (let point of this.points) {
      if (boundary.contains(point)) {
        pointsInRange.push(point);
      }
    }

    if (this.children) {
      for (let child of this.children) {
        pointsInRange.push(...child.queryRange(boundary));
      }
    }
    return pointsInRange;
  }
  executeWithinRangedd(boundary) {
    let delta = 0;
    // check when we lasted called
    // if enough time passes we can execute this function call again
    if (!this.lastCall) {
      this.lastCall = Date.now();
    } else {
      delta = Date.now() - this.lastCall;
      this.lastCall = Date.now();
    }

    for (let point of this.points) {
      // check if the point falls within the boundary of the quadtree if it doesnt, skip the call
      if (!this._quadtree.rootBoundary.contains(point)) {
        continue;
      }

      if (boundary.contains(point)) {
        fn(point);
        Timer.instance.add(point, () => onEnd(point), delta);
      }
    }

    if (this.children) {
      for (let child of this.children) {
        child.executeWithinRange(boundary);
      }
    }
    return;
  }
  /**
   * @description
   * run a function on each of the points returned by the quadtree
   * @param {*} range boundary
   * @param {*} fn fn to run
   */
  executeWithinRange = (boundary, fn, onEnd) => {
    let delta = 0;
    // check when we lasted called
    // if enough time passes we can execute this function call again
    if (!this.lastCall) {
      this.lastCall = Date.now();
    } else {
      delta = Date.now() - this.lastCall;
      this.lastCall = Date.now();
    }

    for (let point of this.points) {
      // check if the point falls within the boundary of the quadtree if it doesnt, skip the call
      if (!this._quadtree.treeBoundary.contains(point)) {
        continue;
      }

      if (boundary.contains(point)) {
        fn(point);
        //   Timer.instance.add(point, () => onEnd(point), delta);
      }
    }

    if (this.children) {
      for (let child of this.children) {
        child.executeWithinRange(boundary, fn, onEnd);
      }
    }
    return;
  };
  /**
   * @description
   * run a function on each of the points outside the boundary in the quadtree
   * @param {*} range boundary
   * @param {*} fn fn to run
   */
  executeOutsideRange = (boundary, fn) => {
    if (!this.boundary.intersects(boundary)) {
      // If the current quadtree boundary is entirely outside the given boundary, return all points.
      for (let point of this.points) {
        fn(point);
      }
    } else {
      for (let point of this.points) {
        if (!boundary.contains(point)) {
          // If the point is outside the given boundary, execute the function.
          fn(point);
        }
      }
    }

    if (this.children) {
      for (let child of this.children) {
        child.executeOutsideRange(boundary, fn);
      }
    }
    return;
  };

  // rework to find point on tree itself
  deReferencePoint(point) {
    // Remove point from the current node

    this.points = this.points.filter((p) => p.id !== point.id);
  }
  _cleanupNode() {
    // You can implement any logic here to clean up nodes
    // for example, you could collapse this node if it's empty and has no children
    if (this.parent && Array.isArray(this.parent.children)) {
      // Check if all sibling nodes of this node are also empty
      const allSiblingsEmpty = this.parent.children.every(
        (child) => child.points.length === 0 && !child.children
      );

      // If all siblings are empty, remove all children
      if (allSiblingsEmpty) {
        this.parent.children = null;
      }
    }
  }

  // deletes all points and its children node points
  delete() {
    // call destroy on each quadtree data point
    this.points.forEach((point) => {
      point.remove();
    });
    this.points = [];

    // call recursively
    if (this.children) {
      for (let child of this.children) {
        child.delete();
      }
    }
  }
}

class QuadTree {
  rootNode = undefined;
  treeSize = 0;
  name = "default";
  _stale;
  _staleTime;
  _lastExecuteTime = Date.now();
  quadtreeManager = QuadtreeManager.instance;
  queuedPoints = new Map();
  dequeuedPoints = new Map();
  /**
   *
   * @param {Object} config
   * @param {string} config.name
   * @param {number} config.staleTime
   * @param {object} config.initialPosition
   */
  constructor(config) {
    const {
      name,
      staleTime = Infinity,
      initialPosition = { x: 0, y: 0 },
    } = config || {};
    const width = 1e30;
    const height = 1e30;

    //create the quadtree boundary
    const boundary = new Boundary(-width / 2, -height / 2, width, height);
    if (name) {
      this.name = name;
    }
    this.treeBoundary = boundary; // save the size of the root boundary
    this.rootNode = new QuadTreeNode(boundary); // node
    this.rootNode._quadtree = this;
    this._staleTime = staleTime;
    this._clientPosition = initialPosition;
    this.errorPoints = [];
  }
  /**
   * @description clears the quad tree
   */
  clear() {
    this.rootNode = new QuadTreeNode(this.treeBoundary);
    this.rootNode._quadtree = this;
  }

  /**
   * @description clears all data points from quadtree and creates new root. TODO: rename to clearPoints
   */
  delete() {
    if (this.rootNode) {
      this.rootNode.delete(); // Recursively delete root and children
      this.rootNode = new QuadTreeNode(boundary); // node
    }
    this.queuedPoints.clear();
    this.dequeuedPoints.clear();
  }

  /**
   * executes a function for each node
   */
  executeOnEachQuadNode(node = this.rootNode, fn) {
    if (!this.rootNode) {
      return;
    }
    total++;
    fn(node);
    if (node.children) {
      for (let child of node.children) {
        this.executeOnEachQuadNode(child, fn);
      }
    }
  }
  clearTotal() {
    total = 0;
  }
  getTotal() {
    return total;
  }
  _setTreeSize(length) {
    this.treeSize = length;
  }

  /**
   * @description returns all points in quadtree
   */
  getAllPoints() {
    const allPoints = this.rootNode.getAllPoints();
    return allPoints;
  }
  /**
   * @description returns all points in range
   */
  getItemsInRange(boundary) {
    if (!this.rootNode) {
      return;
    }
    return [...this.rootNode.queryRange(boundary), ...this.allPoints];
  }
  /**
   * used by quadtreeManager, calls a function on items within range.
   */
  executeWithinRange(range, fn, onEnd) {
    if (!this.rootNode) {
      return;
    }
    return this.rootNode.executeWithinRange(range, fn, onEnd);
  }

  /**
   *
   */
  executeOutsideRange(range, fn) {
    if (!this.rootNode) {
      return;
    }
    return this.rootNode.executeOutsideRange(range, fn);
  }

  /**
   * @description inserts a point into the quadtree
   */
  _makePoint(pointPos, object) {
    const point = new QuadTreePoint(pointPos, object);

    const node = this.rootNode.insert(point);
    if (node) {
      point.setTree(this);
    }
    return point;
  }
  /**
   * @description
   * queue bunch of points to the quadtree using an array
   * at the end of creation, insert them to quad tree.
   * when points are deleted, or moved within quadtree space
   * call redistribute points
   */

  _queueNewPoint(pointPos, object) {
    this.queuedPoints.set(object.id, { position: pointPos, object });
  }
  addQueuedPoints() {
    //console.log("queded pts", this.queuedPoints.size);
    // add to quadtree, delete from queue
    this.queuedPoints.forEach((p) => {
      this._makePoint(p.position, p.object);
      this.queuedPoints.delete(p.object.id);
    });
  }

  objectMakeStale(gameObject) {}
  _updatePoints() {
    // collect all points
    const ps = this.getAllPoints();

    //this.clear();

    // debugger;
    ps.forEach((point) => {
      try {
        // create a new version of the point
        if (!point) {
          return;
        }
        // update gameObjectPosition
        const gameObject = point.data;
        const pointPos = gameObject.getPosition(gameObject);
        this.point.x = pointPos[0];
        this.point.y = pointPos[1];
        // delete the old one from allPoints list
      } catch (e) {}
    });

    this.redistribute();
  }
  renderBoundary(camPosX = 0, camPosY = 0) {
    if (this.rootNode) {
      this.rootNode.renderBoundary(camPosX, camPosY);
    }
  }
  execute(clientPosX, clientPosY) {
    this._clientPosition = { x: clientPosX, y: clientPosY };
    this.treeBoundary = new Boundary(
      clientPosX - this.treeBoundary.width / 2,
      clientPosY - this.treeBoundary.height / 2,
      this.treeBoundary.width,
      this.treeBoundary.height
    );
    const lastTime = this.lastTime || Date.now();
    if (!this.lastTime) {
      this.lastTime = Date.now();
    }
    ///////////////////////
    // check for stale data
    ////////////////////////
    const currentTime = Date.now();
    const elapsedTime = currentTime - this._lastExecuteTime;

    if (currentTime - lastTime >= 1000) {
      // console.log(this.queuedPoints.size, this.treeSize);
      this.lastTime = Date.now();
    }

    if (elapsedTime >= this._staleTime) {
      console.log("stale", this.name);
      this._stale = true;
      this._lastExecuteTime = Date.now();
    }
    if (this._stale) {
      this._updatePoints();
      this._stale = false;
    }
  }
  /**
   * @description stores an object within the quadtree
   * @param {*} object data to store
   * @param {*} x x position within quadtree
   * @param {*} y y position within quadtree
   */
  addItem(gameObject) {
    const [x, y] = gameObject.getPosition();
    gameObject.init(this);

    this._queueNewPoint({ x, y }, gameObject);
  }
  removePoint(pointId) {
    if (this.rootNode) {
      this.rootNode.removePoint(pointId);
    }
  }
  // collects all the remaining points of the current tree
  // de-references the tree and creates a new tree using
  // the remaining points
  redistribute() {
    // Step 1: Collect all points from the current tree
    const allPoints = this.getAllPoints();
    allPoints.forEach((p) => {
      p.quadNode = undefined;
      p.stale = false;
    });

    // Step 2: de-reference the existing root node and reate a new one (starting fresh)
    this.rootNode = new QuadTreeNode(this.treeBoundary);
    this.rootNode._quadtree = this;
    // Step 4: Reinsert all points into the new quadtree
    for (let point of allPoints) {
      this.rootNode.insert(point);
    }
  }
  refresh() {
    this.redistribute();
    this.addQueuedPoints();
  }
}

export default class QuadtreeManager {
  static instance;
  staticPoints = [];
  trees = [];
  counter = -1;
  Timer = new Timer();
  constructor() {
    if (!QuadtreeManager.instance) {
      new Id();
      QuadtreeManager.instance = this;
    }
    return QuadtreeManager.instance;
  }
  createTree(config) {
    const tree = new QuadTree(config);
    this.trees.push(tree);
    return tree;
  }

  // call to render each item that is visible to the screen
  render(boundary) {
    if (!boundary) {
      throw new Error("No boundary set");
    }
    // reset nodes visited

    this.trees.forEach((t) => {
      // const ps = t.root.queryRange(boundary);
    });
  }
  generateId() {
    this.counter++;
    return this.counter;
  }
  /**
   * place in update function to execute quadtree each frame
   */

  /**
   * @descriptioncall call update to each tree using clientPosition
   */
  execute(clientPosX, clientPosY) {
    this.trees.forEach((tree) => tree.execute(clientPosX, clientPosY));
    Timer.instance.execute();
  }
  getTree(treeName) {
    return QuadtreeManager.instance.trees.find((t) => t.name === treeName);
  }

  destroy() {
    this.trees.forEach((tree) => tree.delete()); // Ensure all trees are deleted
    this.trees.length = 0; // Clear trees array
    Timer.instance.destroy(); // Ensure Timer is destroyed
    Id.instance.destroy(); // Ensure Id is destroyed
    QuadtreeManager.instance = undefined;
  }
}
