# Deploy Guide

## Prerequisites

- AWS account with IAM user/role that can create EC2, RDS, S3, CloudFront
- AWS CLI installed and configured (`aws configure`)
- SSH key pair created in AWS (or use existing)
- Domain name (optional, can use IP initially)

## Step 1: Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier str-revenue-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username str_revenue \
  --master-user-password YOUR_STRONG_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --publicly-accessible \
  --vpc-security-group-ids sg-xxxxx
```

Note the RDS endpoint (e.g., `str-revenue-db.xxxx.us-east-1.rds.amazonaws.com`).

## Step 2: Create EC2 Instance

1. Launch EC2 instance:
   - AMI: Amazon Linux 2023
   - Instance type: t3.micro
   - Key pair: Select your SSH key
   - Security group: Allow ports 22, 80, 443
   - User data: Paste contents of `scripts/ec2-setup.sh`

2. SSH into instance:
   ```bash
   ssh -i your-key.pem ec2-user@YOUR_EC2_IP
   ```

## Step 3: Configure Environment

Create `backend/.env` on the EC2 instance:

```bash
DATABASE_URL=postgresql://str_revenue:YOUR_STRONG_PASSWORD@YOUR_RDS_ENDPOINT:5432/str_revenue
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=$(openssl rand -hex 32)
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
EMAIL_PROVIDER=ses
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=STR Revenue
APP_BASE_URL=http://YOUR_EC2_IP
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_AWS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET
SEARXNG_URL=http://searxng:8080
```

## Step 4: Deploy

From your local machine:

```bash
# Make scripts executable
chmod +x scripts/deploy.sh

# Set environment variables
export EC2_HOST=YOUR_EC2_IP
export SSH_KEY=~/.ssh/your-key.pem

# Deploy
./scripts/deploy.sh
```

## Step 5: Verify

```bash
# Check API health
curl http://YOUR_EC2_IP/health

# Open in browser
open http://YOUR_EC2_IP
```

## Step 6: Set Up Domain (Optional)

1. Point your domain's A record to EC2 IP
2. Update `APP_BASE_URL` in `backend/.env`
3. Update CORS in `backend/app/main.py` to allow your domain
4. Redeploy

## Ongoing Management

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# View logs
cd /app && docker-compose logs -f

# Restart services
docker-compose restart

# Update code
git pull && ./scripts/deploy.sh
```
