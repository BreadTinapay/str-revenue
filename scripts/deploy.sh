#!/bin/bash
set -e

# Configuration
EC2_HOST="${EC2_HOST:?Set EC2_HOST environment variable}"
EC2_USER="ec2-user"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"
DEPLOY_DIR="/app"

echo "=== Deploying to $EC2_HOST ==="

# Build frontend locally
echo "Building frontend..."
cd frontend
VITE_API_URL="http://$EC2_HOST" npm run build
cd ..

# Sync files to EC2
echo "Syncing files to EC2..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  ./ "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"

# Copy built frontend
echo "Copying frontend build..."
scp -i "$SSH_KEY" -r frontend/dist "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/frontend/"

# Copy production docker-compose
echo "Copying production config..."
scp -i "$SSH_KEY" docker-compose.prod.yaml "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/docker-compose.yaml"
scp -i "$SSH_KEY" nginx.conf "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/nginx.conf"

# Deploy on EC2
echo "Deploying on EC2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << 'EOF'
cd /app

# Create .env if it doesn't exist
if [ ! -f backend/.env ]; then
  echo "Creating backend/.env from template..."
  cp backend/.env.example backend/.env
  echo "EDIT backend/.env with your actual values before starting!"
fi

# Build and start services
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

echo "=== Deployment complete ==="
echo "API: http://localhost:8000/health"
echo "Frontend: http://localhost"
EOF

echo "=== Done ==="
