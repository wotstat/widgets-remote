docker compose -p remote down;
docker compose -p remote -f docker-compose.yaml pull;
docker compose -p remote -f docker-compose.yaml up --build -d --remove-orphans;
