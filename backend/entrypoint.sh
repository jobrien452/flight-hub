#!/bin/sh
set -e

echo "waiting for mongo..."
python -c "
import sys
import time
import pymongo

deadline = time.time() + 300  # 5 minutes
while True:
    try:
        pymongo.MongoClient('$MONGO_URL', serverSelectionTimeoutMS=3000).admin.command('ping')
        break
    except Exception as e:
        if time.time() > deadline:
            print('mongo never became available:', e, file=sys.stderr)
            sys.exit(1)
        time.sleep(3)
"
echo "mongo is up"

# apply any pending migrations before the app starts serving
pymongo-migrate migrate -u "$MONGO_URL/$MONGO_DB_NAME" -m migrations

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
