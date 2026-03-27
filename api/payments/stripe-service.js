/**
 * Stripe Payment Service for Cortex Freelancer
 * Handles subscriptions, payments, and webhook processing
 */

const Stripe = require('stripe');
const FirebaseAuthService = require('../auth/firebase-auth');

class StripePaymentService {
    constructor() {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        this.authService = new FirebaseAuthService();
        
        // Subscription plans
        this.plans = {
            free: {
                id: 'free',
                name: 'Free',
                price: 0,
                features: ['5 job applications/month', 'Basic AI assistance', 'Standard proposals'],
                limits: {
                    jobApplications: 5,
                    proposals: 5,
                    aiRequests: 50
                }
            },
            pro: {
                id: process.env.STRIPE_PRO_PRICE_ID,
                name: 'Professional',
                price: 29,
                features: ['Unlimited applications', 'Advanced AI features', 'Custom proposals', 'Client research', 'Analytics'],
                limits: {
                    jobApplications: -1, // unlimited
                    proposals: -1,
                    aiRequests: -1
                }
            },
            enterprise: {
                id: process.env.STRIPE_ENTERPRISE_PRICE_ID,
                name: 'Enterprise',
                price: 99,
                features: ['Everything in Pro', 'Priority support', 'Custom integrations', 'Team features', 'Advanced analytics'],
                limits: {
                    jobApplications: -1,
                    proposals: -1,
                    aiRequests: -1,
                    teamMembers: 5
                }
            }
        };
    }

    /**
     * Create Stripe customer for user
     */
    async createCustomer(userId, userEmail, displayName = null) {
        try {
            const customer = await this.stripe.customers.create({
                email: userEmail,
                name: displayName,
                metadata: {
                    userId: userId
                }
            });

            // Update user profile with Stripe customer ID
            await this.authService.updateUserProfile(userId, {
                stripeCustomerId: customer.id
            });

            return {
                success: true,
                customer: customer
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create checkout session for subscription
     */
    async createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
        try {
            // Get user profile to check for existing customer
            const userProfile = await this.authService.getUserProfile(userId);
            
            let customerId = userProfile?.stripeCustomerId;
            
            // Create customer if doesn't exist
            if (!customerId) {
                const customerResult = await this.createCustomer(
                    userId, 
                    userProfile.email, 
                    userProfile.displayName
                );
                
                if (!customerResult.success) {
                    throw new Error('Failed to create customer');
                }
                
                customerId = customerResult.customer.id;
            }

            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                allow_promotion_codes: true,
                billing_address_collection: 'auto',
                metadata: {
                    userId: userId
                }
            });

            return {
                success: true,
                sessionId: session.id,
                url: session.url
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create customer portal session
     */
    async createPortalSession(userId, returnUrl) {
        try {
            const userProfile = await this.authService.getUserProfile(userId);
            
            if (!userProfile?.stripeCustomerId) {
                throw new Error('No Stripe customer found');
            }

            const session = await this.stripe.billingPortal.sessions.create({
                customer: userProfile.stripeCustomerId,
                return_url: returnUrl,
            });

            return {
                success: true,
                url: session.url
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get customer subscriptions
     */
    async getSubscriptions(userId) {
        try {
            const userProfile = await this.authService.getUserProfile(userId);
            
            if (!userProfile?.stripeCustomerId) {
                return {
                    success: true,
                    subscriptions: [],
                    currentPlan: this.plans.free
                };
            }

            const subscriptions = await this.stripe.subscriptions.list({
                customer: userProfile.stripeCustomerId,
                status: 'active',
                expand: ['data.default_payment_method']
            });

            const currentSubscription = subscriptions.data[0];
            let currentPlan = this.plans.free;

            if (currentSubscription) {
                const priceId = currentSubscription.items.data[0].price.id;
                currentPlan = Object.values(this.plans).find(plan => plan.id === priceId) || this.plans.free;
            }

            return {
                success: true,
                subscriptions: subscriptions.data.map(sub => ({
                    id: sub.id,
                    status: sub.status,
                    currentPeriodStart: new Date(sub.current_period_start * 1000),
                    currentPeriodEnd: new Date(sub.current_period_end * 1000),
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    plan: currentPlan
                })),
                currentPlan
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                subscriptions: []
            };
        }
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(userId, subscriptionId, immediately = false) {
        try {
            const userProfile = await this.authService.getUserProfile(userId);
            
            if (!userProfile?.stripeCustomerId) {
                throw new Error('No Stripe customer found');
            }

            let subscription;
            
            if (immediately) {
                subscription = await this.stripe.subscriptions.cancel(subscriptionId);
            } else {
                subscription = await this.stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true
                });
            }

            // Update user subscription status
            await this.authService.updateSubscription(userId, {
                status: subscription.status,
                planId: 'free',
                subscriptionId: subscriptionId
            });

            return {
                success: true,
                subscription: subscription
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process webhook events
     */
    async processWebhook(rawBody, signature) {
        try {
            const event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;

                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionCancelled(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;

                default:
                    console.log(`Unhandled webhook event type: ${event.type}`);
            }

            return {
                success: true,
                processed: event.type
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle successful checkout completion
     */
    async handleCheckoutCompleted(session) {
        const userId = session.metadata.userId;
        const customerId = session.customer;

        // Get subscription details
        const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0].price.id;
        
        // Find matching plan
        const plan = Object.values(this.plans).find(p => p.id === priceId) || this.plans.pro;

        // Update user subscription status
        await this.authService.updateSubscription(userId, {
            status: subscription.status,
            planId: plan.id,
            customerId: customerId,
            subscriptionId: subscription.id
        });

        console.log(`Subscription activated for user ${userId}: ${plan.name}`);
    }

    /**
     * Handle subscription updates
     */
    async handleSubscriptionUpdated(subscription) {
        const customerId = subscription.customer;
        
        // Find user by customer ID
        const userProfile = await this.findUserByCustomerId(customerId);
        
        if (userProfile) {
            const priceId = subscription.items.data[0].price.id;
            const plan = Object.values(this.plans).find(p => p.id === priceId) || this.plans.free;

            await this.authService.updateSubscription(userProfile.uid, {
                status: subscription.status,
                planId: plan.id,
                subscriptionId: subscription.id
            });

            console.log(`Subscription updated for user ${userProfile.uid}: ${plan.name} (${subscription.status})`);
        }
    }

    /**
     * Handle subscription cancellation
     */
    async handleSubscriptionCancelled(subscription) {
        const customerId = subscription.customer;
        
        const userProfile = await this.findUserByCustomerId(customerId);
        
        if (userProfile) {
            await this.authService.updateSubscription(userProfile.uid, {
                status: 'cancelled',
                planId: 'free',
                subscriptionId: subscription.id
            });

            console.log(`Subscription cancelled for user ${userProfile.uid}`);
        }
    }

    /**
     * Handle successful payment
     */
    async handlePaymentSucceeded(invoice) {
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        
        const userProfile = await this.findUserByCustomerId(customerId);
        
        if (userProfile) {
            // Log successful payment
            console.log(`Payment succeeded for user ${userProfile.uid}: $${invoice.amount_paid / 100}`);
            
            // Could update payment history here
        }
    }

    /**
     * Handle failed payment
     */
    async handlePaymentFailed(invoice) {
        const customerId = invoice.customer;
        
        const userProfile = await this.findUserByCustomerId(customerId);
        
        if (userProfile) {
            console.log(`Payment failed for user ${userProfile.uid}`);
            
            // Could send notification or update subscription status
        }
    }

    /**
     * Find user by Stripe customer ID
     */
    async findUserByCustomerId(customerId) {
        try {
            const db = this.authService.db;
            const snapshot = await db.collection('user_profiles')
                .where('stripeCustomerId', '==', customerId)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                return null;
            }
            
            const doc = snapshot.docs[0];
            return {
                uid: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Error finding user by customer ID:', error);
            return null;
        }
    }

    /**
     * Check user's plan limits
     */
    async checkUsageLimits(userId, action) {
        try {
            const subscriptions = await this.getSubscriptions(userId);
            const currentPlan = subscriptions.currentPlan;
            
            if (currentPlan.id === 'free') {
                // Check usage limits for free plan
                // This would integrate with usage tracking system
                return {
                    allowed: true, // Simplified for demo
                    remaining: currentPlan.limits[action] || 0
                };
            }
            
            // Pro and Enterprise plans have unlimited usage
            return {
                allowed: true,
                remaining: -1 // unlimited
            };
        } catch (error) {
            return {
                allowed: false,
                error: error.message
            };
        }
    }

    /**
     * Get plan information
     */
    getPlans() {
        return this.plans;
    }

    /**
     * Health check for Stripe connectivity
     */
    async healthCheck() {
        try {
            await this.stripe.plans.list({ limit: 1 });
            return {
                success: true,
                status: 'connected'
            };
        } catch (error) {
            return {
                success: false,
                status: 'disconnected',
                error: error.message
            };
        }
    }
}

module.exports = StripePaymentService;