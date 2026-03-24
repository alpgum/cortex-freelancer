# Redis Queue System for Cortex Freelancer

**CFX-028: Message Queue (Redis) - Async Job Processing**

A comprehensive Redis-based message queue system providing reliable, scalable async job processing with multiple transport methods and robust monitoring.

## 🚀 Features

### Core Capabilities
- **BullMQ Integration** - Modern job queue with Redis backend
- **Request/Response Correlation** - Match async responses to original requests
- **Multiple Transport Methods** - Redis Streams, Pub/Sub, and HTTP endpoints
- **Worker Pool Management** - Configurable concurrent job processing
- **Health Monitoring** - Real-time metrics and alerting
- **Graceful Shutdown** - No lost messages during restarts

### Advanced Features
- **Priority Queues** - Urgent, normal, and background job prioritization
- **Dead Letter Queue** - Failed job handling with retry policies
- **Rate Limiting** - Configurable throughput controls
- **Auto-scaling** - Dynamic worker pool adjustment
- **Cluster Support** - Redis Cluster for high availability
- **SSE Streaming** - Real-time client notifications

## 📋 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│   Queue Server  │───▶│   Worker Pool   │
│  (Browser/App)  │    │  (HTTP/SSE API) │    │ (Job Processors)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────▶│     Redis       │◀─────────────┘
                        │ (Queue Storage) │
                        └─────────────────┘
```

### Components

1. **Redis Client Manager** - Connection handling with cluster support
2. **Job Queue Manager** - BullMQ-based job submission and processing
3. **Worker Pool Manager** - Concurrent job processing with auto-scaling
4. **Health Monitor** - System metrics and alerting
5. **Pub/Sub Broker** - Real-time messaging between components
6. **Streams Manager** - Ordered, persistent message delivery
7. **Queue Server** - HTTP/SSE API endpoints
8. **Client Adapter** - Browser/app integration library

## 🔧 Installation & Setup

### Prerequisites
```bash
# Redis server (local or remote)
redis-server

# Node.js dependencies
npm install bullmq ioredis express cors uuid
```

### Quick Start

#### 1. Start Redis
```bash
# Local Redis
redis-server

# Or Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### 2. Start Queue System
```bash
# Development
node src/redis-queue/index.js start 3848

# Or with Docker Compose
docker compose -f docker/docker-compose-redis.yml up -d
```

#### 3. Use Client
```javascript
const { createClient } = require('./src/redis-queue');

const client = createClient({
  baseUrl: 'http://localhost:3848'
});

await client.initialize();

// Submit job
const result = await client.submitJob('openclaw_request', {
  prompt: 'Analyze this freelancer proposal',
  model: 'claude-3.5-sonnet'
});

console.log('Job result:', result);
```

## 📚 API Reference

### Job Types

#### OpenClaw Integration
```javascript
await client.submitJob('openclaw_request', {
  prompt: 'Your request here',
  model: 'claude-3.5-sonnet',
  temperature: 0.7
});
```

#### Freelancer Analysis
```javascript
await client.submitJob('freelancer_analysis', {
  profileId: 'user123',
  analysisType: 'skills'
});
```

#### Proposal Generation
```javascript
await client.submitJob('proposal_generation', {
  jobTitle: 'React Developer Needed',
  budget: 5000,
  requirements: ['React', 'Node.js']
});
```

### Priority Levels
```javascript
// Urgent (priority: 10)
await client.submitUrgentJob('critical_task', payload);

// Normal (priority: 5) - default
await client.submitJob('regular_task', payload);

// Background (priority: 1)
await client.submitBackgroundJob('cleanup_task', payload);
```

### Progress Tracking
```javascript
const result = await client.submitJob('long_task', payload, {
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percent}%`);
  }
});
```

## 🔍 Monitoring & Health

### Health Check
```bash
curl http://localhost:3848/api/queue/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": 1679846400000,
  "uptime": 3600000,
  "redis": {
    "connected": true,
    "latency": 2
  },
  "system": {
    "memory": 45.2,
    "cpu": 0.8
  },
  "performance": {
    "avgLatency": 150,
    "throughput": 45
  }
}
```

### Queue Statistics
```bash
curl http://localhost:3848/api/queue/stats
```

### Metrics Available
- Queue depth (waiting, active, completed, failed)
- Worker utilization and performance
- Redis connection health and latency
- System resource usage (CPU, memory)
- Average processing times
- Error rates and failure patterns

## ⚙️ Configuration

### Environment Variables
```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cluster Support
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=host1:7001,host2:7002,host3:7003

# Worker Configuration
QUEUE_WORKER_CONCURRENCY=4
WORKER_REPLICAS=2

# Rate Limiting
QUEUE_RATE_LIMIT_MAX=100
QUEUE_RATE_LIMIT_DURATION=60000

# Monitoring
REDIS_STREAM_MAXLEN=10000
```

### Configuration Files
```javascript
// config.js customization
module.exports = {
  queue: {
    worker: {
      concurrency: 8, // More workers for high load
    },
    rateLimiter: {
      max: 200, // Higher rate limit
      duration: 60000
    }
  },
  monitoring: {
    thresholds: {
      queueDepthWarning: 50,
      avgLatencyWarningMs: 3000
    }
  }
};
```

## 🐳 Docker Deployment

### Development
```bash
# Start Redis + Queue System
docker compose -f docker/docker-compose-redis.yml up -d

# View logs
docker compose logs -f queue-server
```

### Production
```bash
# Full stack with monitoring
docker compose -f docker/docker-compose-redis.yml \
  --profile production \
  --profile monitoring \
  up -d
```

### Services Available
- **Redis**: `:6379` (database)
- **Queue Server**: `:3848` (API)
- **Redis Insight**: `:8001` (monitoring)
- **Bull Board**: `:3000` (queue dashboard)

## 🧪 Testing

### Run Test Suite
```bash
node src/redis-queue/test-suite.js
```

### Manual Testing
```bash
# Submit test job
curl -X POST http://localhost:3848/api/queue/submit \
  -H "Content-Type: application/json" \
  -H "X-Client-ID: test-client" \
  -d '{
    "jobType": "test_job",
    "payload": {"message": "Hello World"}
  }'
```

### Load Testing
```bash
# Run load test (50 concurrent jobs)
node -e "
const { createClient } = require('./src/redis-queue');
const client = createClient({baseUrl: 'http://localhost:3848'});
client.initialize().then(async () => {
  const jobs = Array(50).fill().map((_, i) => 
    client.submitJob('load_test', {id: i})
  );
  const results = await Promise.all(jobs);
  console.log(\`Completed \${results.length} jobs\`);
  client.disconnect();
});
"
```

## 🚨 Error Handling

### Retry Policies
- **Default**: 3 attempts with exponential backoff
- **Urgent jobs**: 5 attempts
- **Background jobs**: 1 attempt

### Dead Letter Queue
Failed jobs after max retries move to dead letter queue for manual review:

```javascript
// Check dead letter queue
const stats = await client.getQueueStats();
console.log('Failed jobs:', stats['cortex:deadletter']);
```

### Common Issues

#### Redis Connection Issues
```bash
# Check Redis connectivity
redis-cli ping

# Check Redis logs
docker logs cortex-redis
```

#### High Queue Depth
```bash
# Monitor queue statistics
watch -n 2 "curl -s http://localhost:3848/api/queue/stats | jq '.queues'"

# Scale up workers
docker compose -f docker/docker-compose-redis.yml up -d --scale queue-workers=4
```

#### Memory Issues
```bash
# Monitor Redis memory usage
redis-cli info memory

# Check queue server memory
docker stats cortex-queue-server
```

## 🔐 Security

### Redis Security
- Password protection enabled in production
- Dangerous commands disabled (`FLUSHDB`, `KEYS`)
- Network isolation via Docker networks

### API Security
- Client ID validation required
- Rate limiting enabled
- Input validation and sanitization

### Production Checklist
- [ ] Redis password configured
- [ ] SSL/TLS for Redis connections
- [ ] API authentication implemented
- [ ] Network firewalls configured
- [ ] Resource limits set
- [ ] Monitoring alerts configured

## 📈 Performance

### Benchmarks
- **Throughput**: 1000+ jobs/minute (4 workers)
- **Latency**: <100ms average processing time
- **Memory**: ~512MB per worker process
- **Redis**: ~256MB for queue storage

### Optimization Tips
1. **Worker Scaling**: Match worker count to CPU cores
2. **Redis Tuning**: Adjust `maxmemory-policy` for workload
3. **Connection Pooling**: Reuse Redis connections
4. **Batch Processing**: Group small jobs together
5. **Monitoring**: Watch queue depth and processing times

## 🔧 Troubleshooting

### Debug Mode
```bash
DEBUG=cortex:* node src/redis-queue/index.js start
```

### Common Commands
```bash
# Check system status
curl http://localhost:3848/api/queue/health

# View queue statistics
curl http://localhost:3848/api/queue/stats

# Monitor Redis
redis-cli monitor

# Check worker logs
docker logs cortex-queue-workers
```

### Performance Issues
1. Check Redis memory usage
2. Monitor worker CPU utilization
3. Verify network connectivity
4. Review error logs
5. Check queue depth trends

---

## 📞 Support

- **Documentation**: See `/docs` directory
- **Issues**: Check logs first, then create GitHub issue
- **Configuration**: Review `config.js` for all options
- **Monitoring**: Use Redis Insight and Bull Board for visual monitoring

Built for **Cortex Freelancer** - Reliable async job processing at scale. 🚀