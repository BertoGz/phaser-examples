export function calculateDistance(position1, position2) {
    // Replace this with your logic to calculate distance between two positions
    // For demonstration purposes, let's assume it's a simple Euclidean distance
    const dx = position1.x - position2.x;
    const dy = position1.y - position2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }