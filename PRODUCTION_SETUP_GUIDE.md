# Cortex Freelancer - Production Setup Guide

## 🚀 Quick Deployment Checklist

### 1. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Fill in all required values in .env
nano .env
```

### 2. Firebase Setup
```bash
# 1. Create Firebase project at https://console.firebase.google.com
# 2. Enable Authentication, Firestore, Storage
# 3. Generate service account key
# 4. Download JSON and save as config/firebase-service-account.json
cp config/firebase-service-account.example.json config/firebase-service-account.json
```

### 3. External API Configuration

#### Upwork API
- Register at: https://developers.upwork.com
- Create app and get Consumer Key/Secret
- Add to .env: UPWORK_CONSUMER_KEY, UPWORK_CONSUMER_SECRET

#### Gmail API
- Enable Gmail API at: https://console.developers.google.com
- Create OAuth 2.0 credentials
- Add to .env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET

#### Stripe Payments
- Register at: https://dashboard.stripe.com
- Get API keys from dashboard
- Add to .env: STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY

#### AI Services
- Anthropic: https://console.anthropic.com → ANTHROPIC_API_KEY
- OpenAI: https://platform.openai.com → OPENAI_API_KEY

### 4. Install Dependencies
```bash
npm install
```

### 5. Initialize Database
```bash
# Run database migration
npm run migrate
```

### 6. Security Configuration
```bash
# Generate secure keys
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

### 7. Test Installation
```bash
# Run test suite
npm test

# Start development server
npm run dev
```

### 8. Production Deployment

#### Option A: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Upload firebase-service-account.json as environment variable
```

#### Option B: Traditional Server
```bash
# Start production server
NODE_ENV=production npm start

# Use PM2 for process management
npm i -g pm2
pm2 start server.js --name cortex-freelancer
pm2 startup
pm2 save
```

## 🔒 Security Checklist

### Required Security Headers
- ✅ Helmet.js configured
- ✅ CORS properly configured
- ✅ Rate limiting enabled
- ✅ Input validation with Joi
- ✅ XSS protection with DOMPurify
- ✅ JWT authentication
- ✅ AES-256-GCM encryption

### Environment Security
```bash
# Set secure file permissions
chmod 600 .env
chmod 600 config/firebase-service-account.json

# Never commit sensitive files
echo ".env" >> .gitignore
echo "config/firebase-service-account.json" >> .gitignore
```

## 📊 Monitoring & Analytics

### Health Check Endpoints
- `GET /api/health` - System health status
- `GET /api/auth/health` - Authentication service status
- `GET /api/payments/health` - Payment service status
- `GET /api/integrations/health` - External API status

### Logging
```javascript
// Winston logger configured for:
// - Error tracking
// - Request logging
// - Performance monitoring
// - Security events
```

### Analytics Dashboard
- Real-time user metrics
- Business intelligence
- AI service performance
- Revenue tracking
- Security monitoring

## 🛠 Troubleshooting

### Common Issues

#### Firebase Connection Error
```bash
# Check service account JSON format
node -e "console.log(JSON.parse(require('fs').readFileSync('config/firebase-service-account.json')))"

# Verify Firebase project settings
# Ensure Firestore and Auth are enabled
```

#### API Rate Limiting
```bash
# Check rate limit settings in .env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Per window
```

#### External API Failures
```bash
# Test API connectivity
curl -X GET "https://api.upwork.com/api/profiles/v1/metadata/categories"
curl -X GET "https://api.stripe.com/v1/products" -H "Authorization: Bearer sk_test_..."
```

### Performance Optimization

#### Database Indexes
```javascript
// Firestore indexes (auto-created by usage)
// Manual indexes in Firebase Console if needed
```

#### Caching Strategy
```javascript
// Redis recommended for production
// File-based cache included for development
```

#### CDN Configuration
```javascript
// Static assets via Vercel Edge Network
// Or configure CloudFlare for custom domains
```

## 🔄 Maintenance

### Database Backups
```bash
# Firebase automatic backups enabled
# Export data periodically:
gcloud firestore export gs://your-bucket/backup-$(date +%Y-%m-%d)
```

### Log Rotation
```bash
# Winston log rotation configured
# PM2 log rotation:
pm2 install pm2-logrotate
```

### Dependency Updates
```bash
# Check for updates
npm audit
npm outdated

# Update dependencies
npm update
```

## 📈 Scaling

### Horizontal Scaling
- Stateless server design
- Database connection pooling
- Redis for session storage
- Load balancer ready

### Vertical Scaling
- Node.js cluster mode
- PM2 process management
- Memory optimization
- CPU profiling tools

### Database Scaling
- Firestore auto-scaling
- Read replicas for analytics
- Proper indexing strategy

## 🎯 Production Checklist

### Pre-Launch
- [ ] All environment variables configured
- [ ] Firebase project setup complete
- [ ] External APIs tested and working
- [ ] SSL certificate installed
- [ ] Domain name configured
- [ ] Monitoring and alerting setup
- [ ] Backup strategy implemented
- [ ] Security audit completed
- [ ] Performance testing done
- [ ] User acceptance testing passed

### Post-Launch
- [ ] Monitor error rates and performance
- [ ] Track user engagement metrics
- [ ] Monitor external API usage and costs
- [ ] Review security logs regularly
- [ ] Update dependencies monthly
- [ ] Backup verification weekly
- [ ] Performance optimization quarterly

## 📞 Support

### Documentation
- API Documentation: `/docs/api`
- User Guide: `/docs/user-guide`
- Developer Guide: `/docs/developer`

### Monitoring
- Health Dashboard: `/admin/health`
- Analytics Dashboard: `/admin/analytics`
- Error Tracking: Integrated Winston logging

### Emergency Procedures
- System Recovery: `docs/emergency-procedures.md`
- Data Recovery: `docs/backup-recovery.md`
- Security Incidents: `docs/security-response.md`

---

**Status:** Production-ready deployment guide for enterprise-grade freelancer AI platform.

**Last Updated:** 2026-03-26 08:09 GMT+3