"""Hold a SQLite reserved write lock until the orchestrating process closes stdin."""
import sqlite3
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
if not source.is_file():
    raise SystemExit('Source does not exist')
with sqlite3.connect(source.as_uri() + '?mode=rw', uri=True, timeout=5) as db:
    db.execute('BEGIN IMMEDIATE')
    try:
        print('LOCKED', flush=True)
        sys.stdin.read()
    finally:
        db.rollback()
