// Cortex Freelancer - Time Tracking & Productivity Analytics
// Sprint 2 - Task 7/50

class TimeTracker {
    constructor() {
        this.sessions = new Map();
        this.analytics = {
            daily: new Map(),
            weekly: new Map(),
            clients: new Map()
        };
    }

    // Start time tracking session
    startSession(projectId, clientId, description) {
        const sessionId = `session_${Date.now()}`;
        const session = {
            id: sessionId,
            projectId,
            clientId,
            description,
            startTime: new Date(),
            endTime: null,
            duration: 0,
            billableHours: 0,
            rate: 0
        };
        
        this.sessions.set(sessionId, session);
        console.log(`⏱️ Started session: ${description} for ${clientId}`);
        return sessionId;
    }

    // Stop time tracking session
    stopSession(sessionId, billableRate = 0) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        
        session.endTime = new Date();
        session.duration = Math.round((session.endTime - session.startTime) / 1000 / 60); // minutes
        session.billableHours = session.duration / 60;
        session.rate = billableRate;
        
        this.updateAnalytics(session);
        console.log(`⏹️ Stopped session: ${session.duration} minutes tracked`);
        return session;
    }

    // Update daily/weekly analytics
    updateAnalytics(session) {
        const date = session.startTime.toISOString().split('T')[0];
        const week = this.getWeekKey(session.startTime);
        
        // Daily analytics
        if (!this.analytics.daily.has(date)) {
            this.analytics.daily.set(date, {
                totalMinutes: 0,
                billableHours: 0,
                revenue: 0,
                sessions: []
            });
        }
        
        const dayData = this.analytics.daily.get(date);
        dayData.totalMinutes += session.duration;
        dayData.billableHours += session.billableHours;
        dayData.revenue += session.billableHours * session.rate;
        dayData.sessions.push(session.id);
        
        // Client analytics
        if (!this.analytics.clients.has(session.clientId)) {
            this.analytics.clients.set(session.clientId, {
                totalHours: 0,
                totalRevenue: 0,
                avgRate: 0,
                sessions: []
            });
        }
        
        const clientData = this.analytics.clients.get(session.clientId);
        clientData.totalHours += session.billableHours;
        clientData.totalRevenue += session.billableHours * session.rate;
        clientData.avgRate = clientData.totalRevenue / clientData.totalHours;
        clientData.sessions.push(session.id);
    }

    // Get productivity insights
    getProductivityInsights() {
        const insights = {
            dailyAverage: this.getDailyAverage(),
            mostProductiveHour: this.getMostProductiveHour(),
            topClients: this.getTopClients(),
            weeklyTrend: this.getWeeklyTrend(),
            recommendations: this.getRecommendations()
        };
        
        return insights;
    }

    getDailyAverage() {
        const days = Array.from(this.analytics.daily.values());
        const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);
        return Math.round(totalMinutes / days.length);
    }

    getMostProductiveHour() {
        const hourCounts = new Array(24).fill(0);
        
        this.sessions.forEach(session => {
            const hour = session.startTime.getHours();
            hourCounts[hour] += session.duration;
        });
        
        const maxIndex = hourCounts.indexOf(Math.max(...hourCounts));
        return `${maxIndex}:00-${maxIndex + 1}:00`;
    }

    getTopClients() {
        return Array.from(this.analytics.clients.entries())
            .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
            .slice(0, 5)
            .map(([clientId, data]) => ({
                client: clientId,
                hours: Math.round(data.totalHours * 10) / 10,
                revenue: Math.round(data.totalRevenue),
                avgRate: Math.round(data.avgRate)
            }));
    }

    getWeeklyTrend() {
        // Simplified weekly trend calculation
        const weeks = Array.from(this.analytics.weekly.values());
        if (weeks.length < 2) return 'stable';
        
        const recent = weeks[weeks.length - 1]?.totalMinutes || 0;
        const previous = weeks[weeks.length - 2]?.totalMinutes || 0;
        
        const change = ((recent - previous) / previous) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    getRecommendations() {
        const insights = [];
        
        const dailyAvg = this.getDailyAverage();
        if (dailyAvg < 240) { // Less than 4 hours
            insights.push('Consider increasing daily work hours for better revenue');
        }
        
        const topClient = this.getTopClients()[0];
        if (topClient && topClient.hours > 100) {
            insights.push(`${topClient.client} is your top client - consider upselling services`);
        }
        
        return insights;
    }

    getWeekKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const week = Math.ceil((d - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        return `${year}-W${week}`;
    }

    // Generate time tracking report
    generateReport(startDate, endDate) {
        const report = {
            period: `${startDate} to ${endDate}`,
            summary: {
                totalHours: 0,
                billableHours: 0,
                totalRevenue: 0,
                avgHourlyRate: 0
            },
            byClient: {},
            byProject: {},
            recommendations: this.getRecommendations()
        };

        // Calculate totals
        this.sessions.forEach(session => {
            const sessionDate = session.startTime.toISOString().split('T')[0];
            if (sessionDate >= startDate && sessionDate <= endDate) {
                report.summary.totalHours += session.duration / 60;
                report.summary.billableHours += session.billableHours;
                report.summary.totalRevenue += session.billableHours * session.rate;
            }
        });

        report.summary.avgHourlyRate = report.summary.totalRevenue / report.summary.billableHours || 0;
        
        return report;
    }

    // OpenClaw integration - send status to session
    async sendStatusUpdate(sessionKey = null) {
        const insights = this.getProductivityInsights();
        const message = `⏱️ **Time Tracking Update**
        
Daily Average: ${insights.dailyAverage} minutes
Most Productive: ${insights.mostProductiveHour}
Weekly Trend: ${insights.weeklyTrend}

Top Clients:
${insights.topClients.map(c => `• ${c.client}: ${c.hours}h, $${c.revenue}`).join('\n')}

Recommendations:
${insights.recommendations.map(r => `• ${r}`).join('\n')}`;

        if (sessionKey) {
            // Send to specific session
            console.log(`Sending update to session: ${sessionKey}`);
            return message;
        } else {
            console.log(message);
            return message;
        }
    }
}

// Usage example
const tracker = new TimeTracker();

// Example: Start tracking
// const sessionId = tracker.startSession('website-redesign', 'TechCorp', 'Frontend development');
// setTimeout(() => tracker.stopSession(sessionId, 75), 2 * 60 * 60 * 1000); // 2 hours at $75/hour

module.exports = { TimeTracker };