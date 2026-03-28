#!/bin/bash
set -euo pipefail

# Update system packages
yum update -y

# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs

# Install CloudWatch agent
yum install -y amazon-cloudwatch-agent

# Create application directory
mkdir -p /opt/app
cd /opt/app

# Start application (placeholder — replace with your deploy logic)
echo '{"status":"ok"}' >/opt/app/health.json
echo "EC2 userdata complete"
