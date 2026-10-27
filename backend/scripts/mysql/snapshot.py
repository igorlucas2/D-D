"""Create an exclusive SQLite backup; no writes to the source database."""
import sqlite3
import sys
from pathlib import Path

source, target = (Path(arg).resolve() for arg in sys.argv[1:])
if not source.is_file() or source == target:
    raise SystemExit('Invalid source or destination')
target.parent.mkdir(parents=True, exist_ok=True)
with target.open('xb'):
    pass  # Never overwrite an earlier backup.
with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
    with sqlite3.connect(target) as dst:
        src.backup(dst)
        if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise SystemExit('Backup integrity check failed')
        if dst.execute('PRAGMA foreign_key_check').fetchall():
            raise SystemExit('Source has foreign key violations')
print('SQLite backup verified:', target.name)
