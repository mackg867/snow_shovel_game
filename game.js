const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 40;
const GRID_WIDTH = 12;
const GRID_HEIGHT = 12;

const PLAYER_COLOR = "blue";
const SNOW_COLOR = "white";
const CLEAR_COLOR = "gray";
const GARAGE_COLOR = "black";

const MAX_SHOVEL_CAPACITY = 3;
const COMMON_MAX_THRESHOLD = 15;

const DEEP_BLUE = { r: 0, g: 0, b: 139 };
const START_COLOR = { r: 200, g: 230, b: 255 };

let energySpent = 0;
let gameOver = false;
let pushMode = false; // Tracks whether the next movement should push snow

// Grid initialization
let grid = Array.from({ length: GRID_HEIGHT }, (_, y) =>
  Array.from({ length: GRID_WIDTH }, (_, x) => {
    if (y === 0) return 2; // Garage
    if (y >= 1 && y <= GRID_HEIGHT - 2 && x >= 1 && x <= GRID_WIDTH - 2) return 1; // Snow
    return 0; // Disposal
  })
);

let player = { x: 1, y: 1, holding: 0 };

// Helpers
function getInterpolatedColor(count, maxThreshold, startColor) {
  let ratio = Math.min(count, maxThreshold) / maxThreshold;
  const r = Math.round(startColor.r * (1 - ratio) + DEEP_BLUE.r * ratio);
  const g = Math.round(startColor.g * (1 - ratio) + DEEP_BLUE.g * ratio);
  const b = Math.round(startColor.b * (1 - ratio) + DEEP_BLUE.b * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}
function getDisposalPileColor(count) {
  return getInterpolatedColor(count, COMMON_MAX_THRESHOLD, START_COLOR);
}
function getDrivewayPileColor(count) {
  return getInterpolatedColor(count, COMMON_MAX_THRESHOLD, START_COLOR);
}
function getZone(x, y) {
  if (y === 0) return "garage";
  if (y === GRID_HEIGHT - 1) return "bottom";
  if (x === 0) return "left";
  if (x === GRID_WIDTH - 1) return "right";
  return "driveway";
}

// Drawing
function drawGrid() {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const zone = getZone(x, y);
      let fillColor = CLEAR_COLOR;
      
      if (zone === "garage") {
        fillColor = GARAGE_COLOR;
      } else if (zone === "driveway") {
        let cellValue = grid[y][x];
        if (cellValue === 0) fillColor = CLEAR_COLOR;
        else if (cellValue === 1) fillColor = SNOW_COLOR;
        else fillColor = getDrivewayPileColor(cellValue);
      } else {
        fillColor = grid[y][x] > 0 ? getDisposalPileColor(grid[y][x]) : CLEAR_COLOR;
      }
      
      ctx.fillStyle = fillColor;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      
      ctx.strokeStyle = (zone === "left" || zone === "right" || zone === "bottom") ? "white" : "black";
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  
  // Disposal borders
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, TILE_SIZE, TILE_SIZE, (GRID_HEIGHT - 2) * TILE_SIZE);
  ctx.strokeRect((GRID_WIDTH - 1) * TILE_SIZE, TILE_SIZE, TILE_SIZE, (GRID_HEIGHT - 2) * TILE_SIZE);
  ctx.strokeRect(TILE_SIZE, (GRID_HEIGHT - 1) * TILE_SIZE, (GRID_WIDTH - 2) * TILE_SIZE, TILE_SIZE);
  ctx.lineWidth = 1;
  
  // "Garage" label
  const garageX = TILE_SIZE;
  const garageWidth = (GRID_WIDTH - 2) * TILE_SIZE;
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Garage", garageX + garageWidth / 2, TILE_SIZE / 1.5);
}

function drawPlayer() {
  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(
    player.x * TILE_SIZE + 5,
    player.y * TILE_SIZE + 5,
    TILE_SIZE - 10,
    TILE_SIZE - 10
  );
}

// Win condition
function checkWinCondition() {
  for (let y = 1; y <= GRID_HEIGHT - 2; y++) {
    for (let x = 1; x <= GRID_WIDTH - 2; x++) {
      if (grid[y][x] > 0) return false;
    }
  }
  gameOver = true;
  return true;
}

// Master update
function updateGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPlayer();
  if (gameOver) {
    ctx.fillStyle = "red";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("You Win!", canvas.width / 2, canvas.height / 2);
    document.getElementById("energyCounter").innerText = `Final Energy: ${Math.round(energySpent * 10) / 10}`;
  } else {
    document.getElementById("energyCounter").innerText = `Energy Spent: ${Math.round(energySpent * 10) / 10}`;
  }
  updateUIControls(); // Update button states
}

// Movement
function movePlayer(dx, dy) {
  if (gameOver) return;
  const newX = player.x + dx;
  const newY = player.y + dy;
  if (newX >= 1 && newX <= GRID_WIDTH - 2 && newY >= 1 && newY <= GRID_HEIGHT - 2) {
    let moveCost = (player.holding > 0) ? player.holding : 1;
    player.x = newX;
    player.y = newY;
    energySpent += moveCost;
    updateGame();
  }
}

// Shovel
function shovelSnow() {
  if (gameOver) return;
  let cellSnow = grid[player.y][player.x];
  if (cellSnow > 0 && player.holding < MAX_SHOVEL_CAPACITY) {
    const availableCapacity = MAX_SHOVEL_CAPACITY - player.holding;
    const shoveled = Math.min(cellSnow, availableCapacity);
    grid[player.y][player.x] -= shoveled;
    player.holding += shoveled;
    energySpent += shoveled;
    updateGame();
    if (checkWinCondition()) updateGame();
  }
}

// Throw
function throwSnow() {
  if (gameOver) return;
  if (player.holding > 0) {
    let pileX = player.x;
    let pileY = player.y;
    if (player.x === 1) {
      pileX = 0; 
    } else if (player.x === GRID_WIDTH - 2) {
      pileX = GRID_WIDTH - 1;
    } else if (player.y === GRID_HEIGHT - 2) {
      pileY = GRID_HEIGHT - 1;
    } else {
      alert("You can only throw snow on a driveway edge!");
      return;
    }
    grid[pileY][pileX] += player.holding;
    energySpent += Math.pow(player.holding, 1.5);
    player.holding = 0;
    updateGame();
  }
}

// Push
function pushSnow(dx, dy) {
  if (gameOver) return;
  const minX = 1, maxX = GRID_WIDTH - 2;
  const minY = 1, maxY = GRID_HEIGHT - 2;
  
  const srcX = player.x + dx;
  const srcY = player.y + dy;
  const destX = player.x + 2 * dx;
  const destY = player.y + 2 * dy;
  
  if (
    srcX < minX || srcX > maxX ||
    srcY < minY || srcY > maxY ||
    destX < minX || destX > maxX ||
    destY < minY || destY > maxY
  ) {
    alert("Cannot push snow off the driveway!");
    return;
  }
  
  let sourceSnow = grid[srcY][srcX];
  if (sourceSnow <= 0) {
    alert("No snow to push!");
    return;
  }
  
  let destSnow = grid[destY][destX];
  let newAmount = destSnow + sourceSnow;
  
  if (newAmount <= MAX_SHOVEL_CAPACITY) {
    grid[destY][destX] = newAmount;
    grid[srcY][srcX] = 0;
  } else {
    const spill = newAmount - MAX_SHOVEL_CAPACITY;
    grid[destY][destX] = MAX_SHOVEL_CAPACITY;
    
    if (dx !== 0 && dy === 0) {
      let aboveValid = (destY - 1 >= minY);
      let belowValid = (destY + 1 <= maxY);
      if (aboveValid && belowValid) {
        grid[destY - 1][destX] += spill / 2;
        grid[destY + 1][destX] += spill / 2;
      } else if (aboveValid) {
        grid[destY - 1][destX] += spill;
      } else if (belowValid) {
        grid[destY + 1][destX] += spill;
      }
    } else if (dy !== 0 && dx === 0) {
      let leftValid = (destX - 1 >= minX);
      let rightValid = (destX + 1 <= maxX);
      if (leftValid && rightValid) {
        grid[destY][destX - 1] += spill / 2;
        grid[destY][destX + 1] += spill / 2;
      } else if (leftValid) {
        grid[destY][destX - 1] += spill;
      } else if (rightValid) {
        grid[destY][destX + 1] += spill;
      }
    } else {
      alert("Diagonal pushes are not allowed!");
      return;
    }
    grid[srcY][srcX] = 0;
  }
  
  energySpent += sourceSnow;
  
  // Move player onto the pushed cell
  player.x = srcX;
  player.y = srcY;
  updateGame();
}

// Handle move or push based on pushMode
function handleMove(dx, dy) {
  if (pushMode) {
    pushSnow(dx, dy);
    pushMode = false; // Automatically turn off push mode
  } else {
    movePlayer(dx, dy);
  }
}

// Button event listeners
document.getElementById("upBtn").addEventListener("click", () => handleMove(0, -1));
document.getElementById("downBtn").addEventListener("click", () => handleMove(0, 1));
document.getElementById("leftBtn").addEventListener("click", () => handleMove(-1, 0));
document.getElementById("rightBtn").addEventListener("click", () => handleMove(1, 0));

document.getElementById("shovelBtn").addEventListener("click", shovelSnow);
document.getElementById("throwBtn").addEventListener("click", throwSnow);
document.getElementById("pushBtn").addEventListener("click", () => {
  pushMode = !pushMode; 
  updateUIControls(); // Refresh button states so user sees push toggled
});

// Disable/enable buttons based on conditions
function updateUIControls() {
  document.getElementById("shovelBtn").disabled = !canShovel();
  document.getElementById("throwBtn").disabled  = !canThrow();
  document.getElementById("pushBtn").disabled   = !canPush();
  
  // If pushMode is active, highlight push button (optional)
  document.getElementById("pushBtn").style.backgroundColor = pushMode ? "#ffcccc" : "";
}

function canShovel() {
  if (gameOver) return false;
  let cellSnow = grid[player.y][player.x];
  return (cellSnow > 0 && player.holding < MAX_SHOVEL_CAPACITY);
}

function canThrow() {
  if (gameOver) return false;
  if (player.holding <= 0) return false;
  // Must be on an edge (left/right/bottom of driveway)
  return (player.x === 1 || player.x === GRID_WIDTH - 2 || player.y === GRID_HEIGHT - 2);
}

function canPush() {
  if (gameOver) return false;
  // Example rule: not allowed if currently holding snow
  if (player.holding > 0) return false;
  return true;
}

// Start
updateGame();
