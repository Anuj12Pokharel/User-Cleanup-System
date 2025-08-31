🚀 Next.js + Django + Docker
This project runs a Next.js frontend, Django backend, Postgres database, and Redis inside Docker using docker-compose.
📂 Project Structure
project-root/
│── backend/                 # Django backend
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── requirements.txt
│   ├── manage.py
│   └── user_backend/
│
│── frontend/                # Next.js frontend
│   ├── Dockerfile.dev
│   ├── package.json
│   ├── next.config.js
│   └── src/
│
│── docker-compose.yml
⚙️ Setup
1. Clone the repo
git clone <your-repo-url> project-root
cd project-root
2. Environment variables
Backend (backend/.env)
DEBUG=1
SECRET_KEY=your-secret-key
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1]

POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=db
POSTGRES_PORT=5432

REDIS_URL=redis://redis:6379
Frontend (frontend/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
🐳 Running with Docker
Build and start containers:

docker-compose build
docker-compose up
Services:
- Backend (Django) → http://localhost:8000
- Frontend (Next.js) → http://localhost:3000
- Postgres → exposed on localhost:5432
- Redis → exposed on localhost:6379
🔥 Development
- Frontend → Uses npm run dev inside the container with hot reloading
- Backend → Uses python manage.py runserver for hot reloading
- Changes in code are reflected immediately without rebuilding the container.
🛠️ Common Commands
Create migrations:
docker-compose exec backend python manage.py makemigrations

Apply migrations:
docker-compose exec backend python manage.py migrate

Open Django shell:
docker-compose exec backend python manage.py shell

Install new Python package:
docker-compose exec backend pip install <package>
docker-compose exec backend pip freeze > requirements.txt

Install new npm package:
docker-compose exec frontend npm install <package>
📦 Volumes
- postgres_data → stores database data
- frontend_node_modules → keeps frontend dependencies between builds
✅ Next Steps
- [ ] Add Celery worker + beat to process background tasks
- [ ] Add Nginx + Gunicorn/Daphne for production setup
- [ ] Configure CI/CD pipeline
