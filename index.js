'use client';

import React from 'react';
import { useRef, useEffect } from 'react';

// The dimensions of the tetris game.
const WIDTH = 300;
const HEIGHT = 500;

// The height of the topbar, in which the score and title of the
// game is displayed.
const TOPBAR_HEIGHT = 100;

// The number of rows (vertical) and columns (horizontal).
const NO_COLS = 15;
const NO_ROWS = 20;

// The horizontal center, used to spawn pieces in the middle of the field
const CENTER_X = Math.floor(NO_COLS / 2);

// The size in pixels of a single block / cell.
const BLOCK_SIZE = 20;

// The framerate of the game is constant, and does not affect the
// speed at which the game runs, only the speed at which the game
// is rendered.
const FRAME_RATE = 1000 / 20;

export function Tetris() {
  // A reference to the actual <canvas> element.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A reference to the tetris game, needed so we can listen to the
  // keyboard events and set them inside the tetris.keyboard key property.
  const tetrisRef = useRef<Tetris | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      // Get the actual <canvas> element.
      const canvas = canvasRef.current;

      // Try getting a 2d context, this only fails in rare cases,
      // which we will not handle.
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Create a tetris object which represents the game.
        const tetris = createTetris();

        // Store it inside of a React ref so we can access it when
        // listing to key events.
        tetrisRef.current = tetris;

        // Create a game loop at the framerate
        const intervalId = window.setInterval(() => {
          // Each loop move the tetris object to the next tick.
          tick(tetris);

          // After the tick is done, render the tetris object
          render(tetris, ctx);
        }, FRAME_RATE);

        return () => {
          window.clearInterval(intervalId);
        };
      }
    }
  }, []);

  // Listen to the key events
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const tetris = tetrisRef.current;

      if (!tetris) {
        return;
      }

      // Listen to both arrow and wasd keys
      if (event.code === 'ArrowLeft' || event.code === 'a') {
        tetris.keyboardKey = 'left';
      } else if (event.code === 'ArrowRight' || event.code === 'd') {
        tetris.keyboardKey = 'right';
      } else if (event.code === 'ArrowDown' || event.code === 's') {
        tetris.keyboardKey = 'down';
      } else if (event.code === 'Space') {
        tetris.keyboardKey = 'space';
      } else if (event.code === 'ArrowUp' || event.code === 'w') {
        tetris.keyboardKey = 'rotate';
      } else {
        tetris.keyboardKey = null;
      }

      if (tetris.keyboardKey) {
        event.preventDefault();
      }
    }

    document.addEventListener('keydown', keydown);

    // Unsubscribe whenever the player leaves the page.
    return () => {
      document.removeEventListener('keydown', keydown);
    };
  });

  return (
    <div className="flex justify-center">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="mb-4">
        An implementation of the game Tetris
      </canvas>
    </div>
  );
}

type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
type Color = string;
type KeyboardKey = 'left' | 'right' | 'down' | 'space' | 'rotate' | null;
type Position = { x: number; y: number };

type Row = Color | null;
type Field = Row[][];

type Piece = {
  /**
   * The type of the piece.
   */
  type: PieceType;

  /**
   * The color for the piece.
   */
  color: Color;

  /**
   * The current position the piece takes up in the field.
   */
  positions: Position[];

  /**
   * Which index of the positions is considered the center, this
   * information is needed to determine how to rotate the piece.
   */
  center: number;
};

type Tetris = {
  /**
   * Whether or not the game is over.
   */
  isGameOver: boolean;

  /**
   * The score of the current game.
   */
  score: number;

  /**
   * The number of rows scored in the current game, used to calculate
   * a bonus.
   */
  rowsScored: number;

  /**
   * The piece that the player can currently move.
   */
  piece: Piece;

  /**
   * A ghost (gray) represents the position to where the piece will fall
   * if the player does not do anything / does not move or rotate
   * the piece.
   *
   * The ghost allows the player to more easily see what the piece
   * will do. This is especially useful when using space to instadrop
   * the piece.
   */
  ghost: Piece;

  /**
   * The playing field, a grid of colors, when the cell is null it
   * means that no piece ever landed there and that it is empty.
   * When the cell has a color it means that a piece landed there.
   */
  field: Field;

  /**
   * The fallrate the piece currently has, as the player scores more
   * points the fallRate is decreased, meaning it will fall faster.
   */
  fallRate: number;

  /**
   * The time of the last tick, used to calculate whether or not
   * to perform the tick.
   */
  lastTick: number;

  /**
   * Which event the player wants to perform the next tick.
   */
  keyboardKey: KeyboardKey | null;
};

function createTetris(): Tetris {
  const field: Field = [];

  for (let row = 0; row < NO_ROWS; row++) {
    field.push(emptyRow());
  }

  const piece = randomPiece();

  return {
    isGameOver: false,
    score: 0,
    rowsScored: 0,
    piece,
    ghost: ghostForPiece(piece, field),
    field,
    fallRate: 800,
    lastTick: new Date().getTime(),
    keyboardKey: null,
  };
}

function tick(tetris: Tetris): void {
  // The pieces should fall at a certain rate, so we take the current
  // time and check if it is before the delta + fallrate. If so
  // this tick needs to be ignored.
  const time = new Date().getTime();
  if (time < tetris.lastTick + tetris.fallRate) {
    return;
  }
  tetris.lastTick = time;

  // When the game is over we need not do anything, except check if
  // the player wants to restart the game.
  if (tetris.isGameOver) {
    // Restart if space is pressed.
    if (tetris.keyboardKey === 'space') {
      Object.assign(tetris, createTetris());
      tetris.keyboardKey = null;
    }

    return;
  }

  // Has the piece finished dropping down the playfield
  if (piecePlayed(tetris.piece, tetris.field)) {
    // When the piece is played color the field the same color
    // as the piece at the pieces final position.
    for (const { x, y } of tetris.piece.positions) {
      tetris.field[y][x] = tetris.piece.color;
    }

    // Remove the finished rows, and get back how many rows have been finished.
    const finishedRows = removeFinishedRows(tetris);

    if (finishedRows > 0) {
      updateScore(tetris, finishedRows);

      tetris.rowsScored += finishedRows;

      // The fallRate decreases / speeds up for every finished row.
      tetris.fallRate -= finishedRows * 25;
    }

    // Generate a new piece
    tetris.piece = randomPiece();

    // If that new piece is played on spawn the game is over.
    tetris.isGameOver = piecePlayed(tetris.piece, tetris.field);
  } else {
    // When space is pressed drop the piece at the ghosts position,
    // but do not drop the piece any further, or it will fall through
    // the bottom.
    if (tetris.keyboardKey === 'space') {
      tetris.piece.positions = tetris.ghost.positions;
    } else {
      if (tetris.keyboardKey === 'rotate') {
        rotatePiece(tetris.piece);
      }

      // Move the piece based on keyboard input, otherwise when
      // no player input is found drop it by one.
      movePiece(tetris);
    }
  }

  // Determine where the ghost is at this point, by doing this each
  // tick the ghost is always accurate.
  tetris.ghost = ghostForPiece(tetris.piece, tetris.field);

  // We have handled the event
  tetris.keyboardKey = null;
}

function piecePlayed(piece: Piece, field: Field): boolean {
  // The piece is played when it will collide with the bottom
  // row or another piece
  return piece.positions.some(({ x, y }) => hasCollision(field, x, y + 1));
}

function hasCollision(field: Field, x: number, y: number): boolean {
  // Check if there is a collision with the right and left walls.
  if (x < 0 || x >= NO_COLS) {
    return true;
  }

  // Check if there is a collision with the bottom and top walls
  if (y < 0 || y >= NO_ROWS) {
    return true;
  }

  // Finally check if the field at the provided position is not
  // filled in with a color. If there is a color present this means
  // this is another piece's final resting place.
  return field[y][x] !== null;
}

function ghostForPiece(piece: Piece, field: Field): Piece {
  // Step 1: clone the piece object, so the ghost does not interfere
  // with the real piece.
  const ghost = structuredClone(piece);

  // Step 2: continue dropping the ghost down until it has hit
  // either the bottom or another piece
  while (!piecePlayed(ghost, field)) {
    dropPiece(ghost);
  }

  // At this point the ghosts position is the position the piece will
  // have if the player does move the piece.

  // Step 3: make the ghost gray so the player knows it is the ghost.
  ghost.color = 'gray';

  return ghost;
}

function rotatePiece(piece: Piece): void {
  // The O / block piece cannot be rotated.
  if (piece.type === 'O') {
    return;
  }

  // Get a reference to the center block of the tetris piece.
  const center = piece.positions[piece.center];

  piece.positions = piece.positions.map(({ x, y }) => {
    // First calculate the distance between the center block
    // and the block.
    const dx = x - center.x;
    const dy = y - center.y;

    // Now rotate 90 degrees but take into account the center piece.
    const newX = 0 * dx - 1 * dy + center.x;
    const newY = 1 * dx + 0 * dy + center.y;

    // See: https://en.wikipedia.org/wiki/Rotation_matrix heading "Common 2d rotations"
    return { x: newX, y: newY };
  });
}

function movePiece(tetris: Tetris): void {
  const { piece, field } = tetris;

  // First calculate the positions based on the user input.
  const newPositions = piece.positions.map(({ x, y }) => {
    // Always move down at least one position.
    let newY = y + 1;

    let newX = x;
    if (tetris.keyboardKey === 'left') {
      newX = x - 1;
    } else if (tetris.keyboardKey === 'right') {
      newX = x + 1;
    } else if (tetris.keyboardKey === 'down') {
      newY = y + 2;
    }
    return { x: newX, y: newY };
  });

  // If the positions have collided, which can happen if the player
  // tried moving the piece into another piece, we simply ignore
  // the player input and shift the piece down by one position.
  if (newPositions.some(({ x, y }) => hasCollision(field, x, y))) {
    dropPiece(piece);
  } else {
    piece.positions = newPositions;
  }
}

function dropPiece(piece: Piece) {
  // To drop a piece increase the y by one, remember that
  // in the Canvas API the top of the canvas has a y of zero!
  // So increasing the y moves the piece down.
  piece.positions = piece.positions.map(({ x, y }) => {
    return { x, y: y + 1 };
  });
}

function emptyRow() {
  const row: (Color | null)[] = [];
  for (let col = 0; col < NO_COLS; col++) {
    row.push(null);
  }
  return row;
}

function removeFinishedRows(tetris: Tetris): number {
  // Keep all rows which are not finished
  const newField = tetris.field.filter((row) => {
    // A row is finished if every cell has a color
    return row.some((cell) => cell === null);
  });

  // The number of finished rows is the total number of rows 
  // minus the rows that where not finished.
  const noFinishedRows = NO_ROWS - newField.length;

  for (let i = 0; i < noFinishedRows; i++) {
    // Add empty rows at the start of the newField array.
    // This will push all remaining rows down!
    newField.unshift(emptyRow());
  }

  // finally set update the field.
  tetris.field = newField;

  // and return the number of finished rows for scoring.
  return noFinishedRows;
}

function updateScore(tetris: Tetris, finishedRows: number) {
  // Calculate a bonus based on the rows scored at this point.
  const bonus = tetris.rowsScored * 10;

  // Reward a 100 points per finishedRow and a multiplier for each row
  // finished by this piece. This way the player is rewarded for removing
  // multiple lines with one piece.
  const score = finishedRows * 100 * finishedRows;

  // Update the score
  tetris.score += score + bonus;
}

// Render

function render(tetris: Tetris, ctx: CanvasRenderingContext2D): void {
  // Fill the entire canvas with white so we reset the canvas.
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Render each position in the field.
  for (let y = 0; y < tetris.field.length; y++) {
    for (let x = 0; x < tetris.field[y].length; x++) {
      const color = tetris.field[y][x] ?? 'white';

      renderBlock({ x, y }, color, ctx);
    }
  }

  // Render the ghost first and then the piece, so when there is
  // overlap between the piece and the ghost, the piece renders
  // on top of the ghost.
  renderPiece(tetris.ghost, ctx);
  renderPiece(tetris.piece, ctx);

  // Set the font
  ctx.font = 'bold 32px mono';

  // Render the title of the game, or game over.
  const text = tetris.isGameOver ? 'Game Over' : 'Tetris';
  ctx.fillStyle = 'red';
  ctx.fillText(text, 10, TOPBAR_HEIGHT / 2 + 10);

  // From now on render all text as black
  ctx.fillStyle = 'black';

  // Render the score
  const score = tetris.score.toString();
  // measureText gives back the size in pixels the text will have
  // given the ctx.font, useful for when you want to center the text.
  const size = ctx.measureText(score);
  ctx.fillText(score, WIDTH - size.width - 10, TOPBAR_HEIGHT / 2 + 10);

  // Render the black dividing line between the topbar and playfield
  ctx.fillRect(0, TOPBAR_HEIGHT - 5, WIDTH, 5);

  // Render an instruction on how to restart the game when it is over
  if (tetris.isGameOver) {
    // First render a white transparent border
    const borderHeight = 100;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, HEIGHT / 2 - borderHeight / 2, WIDTH, borderHeight);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'black';

    // Then render the restart text
    const restartText = 'Press space to restart';
    const size = ctx.measureText(restartText);
    ctx.fillText(restartText, WIDTH - size.width - 10, HEIGHT / 2 + 10);
  }
}

function renderPiece(piece: Piece, ctx: CanvasRenderingContext2D) {
  for (const position of piece.positions) {
    renderBlock(position, piece.color, ctx);
  }
}

function renderBlock(
  { x, y }: Position,
  color: string,
  ctx: CanvasRenderingContext2D
) {
  ctx.fillStyle = color;

  // Render color
  ctx.fillRect(
    x * BLOCK_SIZE,
    TOPBAR_HEIGHT + y * BLOCK_SIZE,
    BLOCK_SIZE,
    BLOCK_SIZE
  );
}

// Piece creators

function createI(): Piece {
  const piece: Piece = {
    type: 'I',
    color: 'cyan',
    positions: [
      /*
          0
          1
          2
          3
      */
      { x: CENTER_X, y: 0 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X, y: 2 },
      { x: CENTER_X, y: 3 },
    ],
    center: 1,
  };

  return piece;
}

function createJ(): Piece {
  return {
    type: 'J',
    color: 'deepskyblue',
    positions: [
      /*
          0
          123
      */
      { x: CENTER_X - 1, y: 0 },
      { x: CENTER_X - 1, y: 1 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X + 1, y: 1 },
    ],
    center: 2,
  };
}

function createL(): Piece {
  return {
    type: 'L',
    color: 'orange',
    positions: [
      /*
            0
          321
      */
      { x: CENTER_X + 1, y: 0 },
      { x: CENTER_X + 1, y: 1 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X - 1, y: 1 },
    ],
    center: 2,
  };
}

function createO(): Piece {
  return {
    type: 'O',
    color: 'gold',
    positions: [
      { x: CENTER_X, y: 0 },
      { x: CENTER_X + 1, y: 0 },
      { x: CENTER_X + 1, y: 1 },
      { x: CENTER_X, y: 1 },
    ],
    center: -1,
  };
}

function createS(): Piece {
  return {
    type: 'S',
    color: 'green',
    positions: [
      /*
          02
         31
      */
      { x: CENTER_X, y: 0 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X + 1, y: 0 },
      { x: CENTER_X - 1, y: 1 },
    ],
    center: 1,
  };
}

function createT(): Piece {
  return {
    type: 'T',
    color: 'purple',
    positions: [
      /*
         3
        012
      */
      { x: CENTER_X - 1, y: 1 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X + 1, y: 1 },
      { x: CENTER_X, y: 0 },
    ],
    center: 1,
  };
}

function createZ(): Piece {
  return {
    type: 'Z',
    color: 'red',
    positions: [
      /*
         20
          13
      */
      { x: CENTER_X, y: 0 },
      { x: CENTER_X, y: 1 },
      { x: CENTER_X - 1, y: 0 },
      { x: CENTER_X + 1, y: 1 },
    ],
    center: 1,
  };
}

const PIECES = [createI, createJ, createL, createO, createS, createT, createZ];

function randomPiece(): Piece {
  const random = Math.floor(Math.random() * PIECES.length);

  return PIECES[random]();
}
