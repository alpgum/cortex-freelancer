/**
 * Firebase Authentication Service for Cortex Freelancer
 * Handles user registration, login, and session management
 */

const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

class FirebaseAuthService {
    constructor() {
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            const serviceAccount = require('../../config/firebase-service-account.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL
            });
        }
        
        this.auth = getAuth();
        this.db = getFirestore();
    }

    /**
     * Create new user account with email/password
     */
    async createUser(email, password, displayName = null) {
        try {
            const userRecord = await this.auth.createUser({
                email,
                password,
                displayName,
                emailVerified: false
            });

            // Create user profile in Firestore
            await this.createUserProfile(userRecord.uid, {
                email,
                displayName,
                createdAt: new Date(),
                onboardingCompleted: false,
                subscriptionStatus: 'free',
                preferences: {
                    hourlyRate: null,
                    skills: [],
                    clientTypes: [],
                    workloadCapacity: 'medium'
                }
            });

            return {
                success: true,
                user: {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Authenticate user with custom token
     */
    async authenticateUser(idToken) {
        try {
            const decodedToken = await this.auth.verifyIdToken(idToken);
            const userProfile = await this.getUserProfile(decodedToken.uid);
            
            return {
                success: true,
                user: {
                    uid: decodedToken.uid,
                    email: decodedToken.email,
                    displayName: decodedToken.name,
                    profile: userProfile
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create user profile in Firestore
     */
    async createUserProfile(uid, profileData) {
        try {
            await this.db.collection('user_profiles').doc(uid).set({
                ...profileData,
                updatedAt: new Date()
            });

            // Initialize user context for AI memory system
            await this.db.collection('user_context').doc(uid).set({
                currentPhase: 'onboarding',
                preferences: profileData.preferences,
                successMetrics: {
                    proposalWinRate: 0,
                    avgProjectValue: 0,
                    repeatClientRate: 0,
                    totalProjects: 0
                },
                lastActivity: new Date(),
                isOnboarded: false
            });

            return true;
        } catch (error) {
            console.error('Error creating user profile:', error);
            return false;
        }
    }

    /**
     * Get user profile from Firestore
     */
    async getUserProfile(uid) {
        try {
            const doc = await this.db.collection('user_profiles').doc(uid).get();
            
            if (!doc.exists) {
                return null;
            }
            
            return {
                uid,
                ...doc.data()
            };
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    /**
     * Update user profile
     */
    async updateUserProfile(uid, updates) {
        try {
            await this.db.collection('user_profiles').doc(uid).update({
                ...updates,
                updatedAt: new Date()
            });
            
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Complete user onboarding
     */
    async completeOnboarding(uid, onboardingData) {
        try {
            const { hourlyRate, skills, clientTypes, experience } = onboardingData;
            
            // Update user profile
            await this.updateUserProfile(uid, {
                onboardingCompleted: true,
                preferences: {
                    hourlyRate,
                    skills,
                    clientTypes,
                    workloadCapacity: 'medium'
                },
                experience
            });

            // Update AI context
            await this.db.collection('user_context').doc(uid).update({
                currentPhase: 'job-hunting',
                preferences: {
                    hourlyRate,
                    skills,
                    clientTypes
                },
                isOnboarded: true,
                lastActivity: new Date()
            });

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update subscription status
     */
    async updateSubscription(uid, subscriptionData) {
        try {
            const { status, planId, customerId, subscriptionId } = subscriptionData;
            
            await this.updateUserProfile(uid, {
                subscriptionStatus: status,
                planId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId
            });
            
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Delete user account and all associated data
     */
    async deleteUser(uid) {
        try {
            // Delete user authentication
            await this.auth.deleteUser(uid);
            
            // Delete user data from Firestore
            const collections = [
                'user_profiles',
                'user_context', 
                'user_patterns',
                'job_applications',
                'proposals'
            ];
            
            for (const collection of collections) {
                const doc = this.db.collection(collection).doc(uid);
                await doc.delete();
            }
            
            // Delete user_patterns subcollection
            const patternsRef = this.db.collection('user_patterns').doc(uid).collection('actions');
            const patterns = await patternsRef.get();
            
            const batch = this.db.batch();
            patterns.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user analytics and statistics
     */
    async getUserAnalytics(uid) {
        try {
            const [profile, context, applications, proposals] = await Promise.all([
                this.getUserProfile(uid),
                this.db.collection('user_context').doc(uid).get(),
                this.db.collection('job_applications').where('userId', '==', uid).get(),
                this.db.collection('proposals').where('userId', '==', uid).get()
            ]);

            const analytics = {
                profile: profile,
                context: context.exists ? context.data() : null,
                stats: {
                    totalApplications: applications.size,
                    totalProposals: proposals.size,
                    successRate: context.exists ? 
                        context.data().successMetrics?.proposalWinRate || 0 : 0
                }
            };

            return analytics;
        } catch (error) {
            console.error('Error fetching user analytics:', error);
            return null;
        }
    }

    /**
     * Middleware for protecting routes
     */
    async authMiddleware(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    error: 'No valid authorization header'
                });
            }
            
            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await this.auth.verifyIdToken(idToken);
            
            req.user = decodedToken;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
    }
}

module.exports = FirebaseAuthService;