#!/bin/sh
# Redis Cluster Initialization Script
# CFX-028 - Sets up a 6-node Redis cluster for production use

set -e

echo "🚀 Initializing Redis Cluster..."

# Create cluster data directories
for port in $(seq 7001 7006); do
    mkdir -p "/data/${port}"
done

# Generate Redis cluster configs
for port in $(seq 7001 7006); do
cat > "/data/${port}/redis.conf" << EOF
port ${port}
cluster-enabled yes
cluster-config-file nodes-${port}.conf
cluster-node-timeout 15000
cluster-announce-ip 172.20.0.10
cluster-announce-port ${port}
cluster-announce-bus-port $(expr ${port} + 10000)
appendonly yes
dir /data/${port}
bind 0.0.0.0
protected-mode no
EOF
done

# Start Redis instances in background
for port in $(seq 7001 7006); do
    redis-server "/data/${port}/redis.conf" &
    echo "Started Redis instance on port ${port}"
done

# Wait for instances to start
sleep 10

# Create the cluster
echo "📡 Creating Redis cluster..."
redis-cli --cluster create \
    172.20.0.10:7001 \
    172.20.0.10:7002 \
    172.20.0.10:7003 \
    172.20.0.10:7004 \
    172.20.0.10:7005 \
    172.20.0.10:7006 \
    --cluster-replicas 1 \
    --cluster-yes

echo "✅ Redis cluster initialized successfully"

# Keep the container running
wait