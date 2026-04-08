const fs = require("fs");
const path = require("path");

const ROSTER_PATH = path.join(__dirname, "..", "data", "board-roster.json");

function loadBoardRosterUsers() {
  const raw = fs.readFileSync(ROSTER_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.users)) {
    throw new Error("board-roster.json must contain a users array.");
  }
  return data.users;
}

module.exports = { loadBoardRosterUsers, ROSTER_PATH };
