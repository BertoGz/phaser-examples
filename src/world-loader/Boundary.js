class Boundary {
  constructor(x, y, width, height, padding = 0) {
    if (typeof x === "object" && x !== null) {
      this.x = x.x;
      this.y = x.y;
      this.width = x.width;
      this.height = x.height;
      this.padding = 0;
    } else {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.padding = padding;
    }
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
export default Boundary;
