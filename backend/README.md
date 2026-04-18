# Backend Setup

## 1) Install dependencies

```bash
pip install -r requirements.txt
```

## 2) Configure environment

Copy `.env.example` to `.env` and set real values:

- `MONGODB_URL`: your MongoDB Atlas connection string
- `MONGODB_DB_NAME`: database name
- `REDIS_URL`: redis connection string (local or cloud)
- `LOG_LEVEL`: INFO, DEBUG, etc.

## 3) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

## 4) Health check

Open:

- `http://localhost:8000/health`

If startup succeeds, the app will connect to MongoDB and Redis automatically.
