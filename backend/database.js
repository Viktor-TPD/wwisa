const sqlite3 = require("sqlite3").verbose();
const config = require("./config");

// Create and initialize database
const db = new sqlite3.Database(config.databasePath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log(`✓ Connected to SQLite database: ${config.databasePath}`);
    initDatabase();
  }
});

// Initialize tables
function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(
      `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating users table:", err);
        } else {
          console.log("✓ Users table ready");
        }
      }
    );

    // Files table
    db.run(
      `
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err) {
          console.error("Error creating files table:", err);
        } else {
          console.log("✓ Files table ready");
        }
      }
    );

    // Create index on user_id for faster queries
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)
    `);
  });
}

// Helper functions for database operations

// Users
const createUser = (username, email, hashedPassword) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, username, email });
      }
    );
  });
};

const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

// Files
const createFile = (userId, filename, originalName, fileType, fileSize) => {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO files (user_id, filename, original_name, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
      [userId, filename, originalName, fileType, fileSize],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

const getFilesByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC",
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

const getFileById = (fileId, userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM files WHERE id = ? AND user_id = ?",
      [fileId, userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
};

const deleteFile = (fileId, userId) => {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM files WHERE id = ? AND user_id = ?",
      [fileId, userId],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
};

const deleteAllUserFiles = (userId) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM files WHERE user_id = ?", [userId], function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
};

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  createFile,
  getFilesByUserId,
  getFileById,
  deleteFile,
  deleteAllUserFiles,
};
