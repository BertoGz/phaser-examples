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
  update() {
    this.timers.forEach((t, key) => {
      const { fn, time, timeSet } = t || {};

      if (Date.now() - timeSet > time) {
        fn();
        this.timers.delete(key);
      }
    });
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
 * @description a point on the quadtree. Holds reference to the game object and methodfs to modify its stale value and more.
 */
export class QuadTreePoint {
  constructor(pos, id, tree) {
    this.x = pos.x;
    this.y = pos.y;
    this.quadNode = undefined;
    this._tree = tree;
    this.stale = false;
    this.id = id;
    this.color = "black";
  }
  getData() {
    return this._tree.allPoints.get(this.id);
  }
  setStale() {
    this.quadNode = undefined;
    this.stale = true;
    return this.stale;
  }
  updatePoint() {
    this._tree.updatePoint(this);
  }
  getPosition() {
    return [this.x, this.y];
  }
  setTree(tree) {
    this._tree = tree;
  }
  destroy() {
    if (this.quadNode) {
      this.quadNode.removePoint(this.id);
    }
    if (this._tree) {
      this._tree.removePoint(this.id);
    }
    this.data = undefined;
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
  getSubtreePoints(node = this) {
    const subtreePoints = [];
    if (node === null || !node.children) {
      return [];
    }

    subtreePoints.push(...node.points);

    for (const child of node.children) {
      const childPoints = this.getSubtreePoints(child);
      subtreePoints.push(...childPoints);
    }

    return subtreePoints;
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
        if (!this.subdivide()) {
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
  subdivide() {
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
  /**
   * @description
   * run a function on each of the points returned by the quadtree
   * @param {*} range boundary
   * @param {*} fn fn to run
   */
  executeWithinRange = (boundary, fn, onEnd) => {
    let delta = 0;
    if (!this.lastCall) {
      this.lastCall = Date.now();
    } else {
      delta = Date.now() - this.lastCall;
      this.lastCall = Date.now();
    }

    for (let point of this.points) {
      let canCall = true;
      if (!this._quadtree.rootBoundary.contains(point)) {
        // point.getData().destroy();
        // point.destroy();
        canCall = false;
      }

      if (boundary.contains(point)) {
        canCall && fn(point);

        Timer.instance.add(point, () => onEnd(point), delta);
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

  removePoint(pointId) {
    this.points = this.points.filter((p) => p.id !== pointId);
  }
}

class QuadTree {
  root = undefined;
  allPoints = new Map();
  name = "default";
  _stale;
  _staleTime;
  _lastExecuteTime = Date.now();
  quadtreeManager = QuadtreeManager.instance;
  queuedPoints = [];
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
    this.rootBoundary = boundary; // save the size of the roo boundary
    this.root = new QuadTreeNode(boundary); // node
    this.root._quadtree = this;
    this._staleTime = staleTime;
    this._clientPosition = initialPosition;
  }
  /**
   * @description clears the quad tree
   */
  clear() {
    this.root = new QuadTreeNode(this.rootBoundary);
    this.root._quadtree = this;
  }

  /**
   * @description clears all data points from quadtree and creates new root. TODO: rename to clearPoints
   */
  delete() {
    this.allPoints.clear();
    this.root = undefined;
    Id.instance.clear();
  }

  /**
   * executes a function for each node
   */
  executeOnEachQuadNode(node = this.root, fn) {
    if (!this.root) {
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
  /**
   * @description goes through quadtree in search of all points
   */
  collectAllPoints() {
    const allPoints = this.root.getSubtrees();
    return allPoints;
  }
  /**
   * @description returns all points in quadtree
   */
  getAllPoints() {
    return this.allPoints;
  }
  /**
   * @description returns all points in range
   */
  getItemsInRange(boundary) {
    if (!this.root) {
      return;
    }
    return [...this.root.queryRange(boundary), ...this.allPoints];
  }
  /**
   * used by quadtreeManager, calls a function on items within range.
   */
  executeWithinRange(range, fn, onEnd) {
    if (!this.root) {
      return;
    }
    return this.root.executeWithinRange(range, fn, onEnd);
  }

  /**
   *
   */
  executeOutsideRange(range, fn) {
    if (!this.root) {
      return;
    }
    return this.root.executeOutsideRange(range, fn);
  }
  /**
   * @description\
   * finds the position within quadtree space of a world space
   */
  _getPointPos(x, y) {
    const outputX = x;
    const outputY = y;
    return { x: outputX, y: outputY };
  }
  /**
   * @description inserts a point into the quadtree
   */
  _addPoint(pointPos, object) {
    const point = new QuadTreePoint(pointPos, object.id);
    object.point = point;
    this.allPoints.set(object.id, object);
    const node = this.root.insert(point);
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
    this.queuedPoints.push({ position: pointPos, object });
  }
  addQueuedPoints() {
    this.queuedPoints.forEach((p) => {
      this._addPoint(p.position, p.object);
    });
    // this._lastExecuteTime = Date.now();
    this.queuedPoints = [];
  }
  _updatePointPosition(point) {
    if (!point) {
      return;
    }
    // update gameObjectPosition
    const gameObject = point.getData();
    const pointPos = gameObject.getPosition(gameObject);
    this.point.x = pointPos[0];
    this.point.y = pointPos[1];
  }
  _updatePoints() {
    // collect all points
    const ps = this.allPoints;

    //this.clear();

    // debugger;
    ps.forEach((point) => {
      try {
        // create a new version of the point
        this._updatePointPosition(point);
        // delete the old one from allPoints list
      } catch (e) {}
    });

    this.redistributeNodes();
  }
  renderBoundary(camPosX = 0, camPosY = 0) {
    if (this.root) {
      this.root.renderBoundary(camPosX, camPosY);
    }
  }
  update(clientPosX, clientPosY) {
    this._clientPosition = { x: clientPosX, y: clientPosY };
    this.rootBoundary = new Boundary(
      clientPosX - this.rootBoundary.width / 2,
      clientPosY - this.rootBoundary.height / 2,
      this.rootBoundary.width,
      this.rootBoundary.height
    );
    ///////////////////////
    // check for stale data
    ////////////////////////
    const currentTime = Date.now();
    const elapsedTime = currentTime - this._lastExecuteTime;
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
  addItem(item) {
    const [x, y] = item.getPosition();
    item.tree = this;
    item._mount(item);
    const pointPos = this._getPointPos(x, y);

    this._queueNewPoint(pointPos, item);
  }
  removePoint(pointId) {
    this.allPoints.delete(pointId);
  }
  redistributeNodes() {
    // clear the quadtree
    this.clear();

    // reset staleTime
    this.stale = false;
    this._lastExecuteTime = Date.now();

    // add new points to quadtree
    this.allPoints.forEach((p) => {
      const [x, y] = p.getPosition();
      this._addPoint({ x, y }, p);
    });
  }
  refresh() {
    this.addQueuedPoints();
    this.redistributeNodes();
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
    this.trees.forEach((tree) => tree.update(clientPosX, clientPosY));
    Timer.instance.update();
  }
  getTree(treeName) {
    return QuadtreeManager.instance.trees.find((t) => t.name === treeName);
  }
  destroy() {
    QuadtreeManager.instance = undefined;
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
  }

  _mount(obj) {
    const time = new Date().getTime();
    this.id = `${time}-${this.name}-${QuadtreeManager.instance.generateId()}`;
    this.gm.id = this.id;
    this.parent = obj;
    const fn = [this.destroy];
    this.cacheFn = fn[0];
    this.destroy = () => {
      this.removeFromQuadTree();
      this.cacheFn();
    };
  }

  addToQuadtree(tree) {
    this.point.setTree(tree);
  }
  removeFromQuadTree() {
    if (this.point) {
      this.point.destroy();
    }
  }
  getPosition() {
    console.error(
      "getPosition must be overwritten with custom getter returning [x,y] object position"
    );
  }
}
