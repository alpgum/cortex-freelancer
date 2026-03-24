/**
 * CF-009: Certification Recommendation Engine
 * Cross-references user skills with Upwork-recognized certifications,
 * prioritized by ROI. Top 30 certifications hardcoded.
 */
(function () {
  'use strict';

  /**
   * Top 30 Upwork-recognized certifications with associated skills and ROI data.
   * @type {{name: string, provider: string, skills: string[], avgRateBoost: number, difficulty: string, cost: string}[]}
   */
  const CERTIFICATIONS = [
    { name: 'AWS Solutions Architect – Associate', provider: 'Amazon', skills: ['AWS', 'Cloud', 'DevOps', 'Infrastructure'], avgRateBoost: 15, difficulty: 'Medium', cost: '$150' },
    { name: 'AWS Solutions Architect – Professional', provider: 'Amazon', skills: ['AWS', 'Cloud Architecture', 'DevOps'], avgRateBoost: 22, difficulty: 'Hard', cost: '$300' },
    { name: 'Google Cloud Professional Cloud Architect', provider: 'Google', skills: ['GCP', 'Cloud', 'Kubernetes', 'DevOps'], avgRateBoost: 18, difficulty: 'Hard', cost: '$200' },
    { name: 'Azure Solutions Architect Expert', provider: 'Microsoft', skills: ['Azure', 'Cloud', 'DevOps', '.NET'], avgRateBoost: 16, difficulty: 'Hard', cost: '$165' },
    { name: 'Certified Kubernetes Administrator (CKA)', provider: 'CNCF', skills: ['Kubernetes', 'Docker', 'DevOps', 'Linux'], avgRateBoost: 20, difficulty: 'Hard', cost: '$395' },
    { name: 'Google Analytics 4 Certification', provider: 'Google', skills: ['Google Analytics', 'SEO', 'Marketing', 'Data Analysis'], avgRateBoost: 8, difficulty: 'Easy', cost: 'Free' },
    { name: 'Google Ads Certification', provider: 'Google', skills: ['Google Ads', 'PPC', 'Marketing', 'SEM'], avgRateBoost: 10, difficulty: 'Easy', cost: 'Free' },
    { name: 'Meta Blueprint Certification', provider: 'Meta', skills: ['Facebook Ads', 'Instagram Ads', 'Social Media Marketing'], avgRateBoost: 9, difficulty: 'Easy', cost: 'Free' },
    { name: 'HubSpot Inbound Marketing', provider: 'HubSpot', skills: ['Content Marketing', 'Email Marketing', 'HubSpot', 'Inbound Marketing'], avgRateBoost: 7, difficulty: 'Easy', cost: 'Free' },
    { name: 'HubSpot Content Marketing', provider: 'HubSpot', skills: ['Content Marketing', 'SEO Writing', 'Blog Writing', 'Content Strategy'], avgRateBoost: 6, difficulty: 'Easy', cost: 'Free' },
    { name: 'PMP (Project Management Professional)', provider: 'PMI', skills: ['Project Management', 'Agile', 'Scrum', 'Leadership'], avgRateBoost: 18, difficulty: 'Hard', cost: '$555' },
    { name: 'Certified Scrum Master (CSM)', provider: 'Scrum Alliance', skills: ['Scrum', 'Agile', 'Project Management'], avgRateBoost: 12, difficulty: 'Medium', cost: '$500' },
    { name: 'Salesforce Administrator', provider: 'Salesforce', skills: ['Salesforce', 'CRM', 'Business Analysis'], avgRateBoost: 14, difficulty: 'Medium', cost: '$200' },
    { name: 'Shopify Partner Certification', provider: 'Shopify', skills: ['Shopify', 'E-commerce', 'Liquid', 'Web Development'], avgRateBoost: 10, difficulty: 'Easy', cost: 'Free' },
    { name: 'Terraform Associate', provider: 'HashiCorp', skills: ['Terraform', 'Infrastructure as Code', 'DevOps', 'Cloud'], avgRateBoost: 15, difficulty: 'Medium', cost: '$70' },
    { name: 'Docker Certified Associate', provider: 'Docker', skills: ['Docker', 'Containers', 'DevOps', 'Kubernetes'], avgRateBoost: 12, difficulty: 'Medium', cost: '$195' },
    { name: 'Figma Professional Certificate', provider: 'Figma', skills: ['Figma', 'UI Design', 'UX Design', 'Prototyping'], avgRateBoost: 8, difficulty: 'Easy', cost: 'Free' },
    { name: 'Adobe Certified Professional – Photoshop', provider: 'Adobe', skills: ['Adobe Photoshop', 'Graphic Design', 'Photo Editing'], avgRateBoost: 6, difficulty: 'Medium', cost: '$180' },
    { name: 'Adobe Certified Professional – Illustrator', provider: 'Adobe', skills: ['Adobe Illustrator', 'Vector Design', 'Branding'], avgRateBoost: 6, difficulty: 'Medium', cost: '$180' },
    { name: 'Tableau Desktop Specialist', provider: 'Tableau', skills: ['Tableau', 'Data Visualization', 'Data Analysis', 'Business Intelligence'], avgRateBoost: 11, difficulty: 'Medium', cost: '$100' },
    { name: 'Microsoft Power BI Data Analyst', provider: 'Microsoft', skills: ['Power BI', 'Data Analysis', 'DAX', 'Business Intelligence'], avgRateBoost: 12, difficulty: 'Medium', cost: '$165' },
    { name: 'TensorFlow Developer Certificate', provider: 'Google', skills: ['TensorFlow', 'Machine Learning', 'Deep Learning', 'Python'], avgRateBoost: 14, difficulty: 'Hard', cost: '$100' },
    { name: 'MongoDB Associate Developer', provider: 'MongoDB', skills: ['MongoDB', 'NoSQL', 'Node.js', 'Database'], avgRateBoost: 8, difficulty: 'Medium', cost: '$150' },
    { name: 'Cisco CCNA', provider: 'Cisco', skills: ['Networking', 'Security', 'Infrastructure', 'Cisco'], avgRateBoost: 13, difficulty: 'Medium', cost: '$330' },
    { name: 'CompTIA Security+', provider: 'CompTIA', skills: ['Cybersecurity', 'Network Security', 'Security', 'Compliance'], avgRateBoost: 14, difficulty: 'Medium', cost: '$392' },
    { name: 'ISTQB Certified Tester', provider: 'ISTQB', skills: ['QA', 'Testing', 'Test Automation', 'Quality Assurance'], avgRateBoost: 10, difficulty: 'Medium', cost: '$250' },
    { name: 'Stripe Certified Developer', provider: 'Stripe', skills: ['Stripe', 'Payments', 'API Integration', 'E-commerce'], avgRateBoost: 9, difficulty: 'Medium', cost: 'Free' },
    { name: 'Webflow Expert Certification', provider: 'Webflow', skills: ['Webflow', 'Web Design', 'No-code', 'Responsive Design'], avgRateBoost: 8, difficulty: 'Easy', cost: 'Free' },
    { name: 'SEMrush SEO Toolkit Certification', provider: 'SEMrush', skills: ['SEO', 'Keyword Research', 'Content Strategy', 'SEO Writing'], avgRateBoost: 7, difficulty: 'Easy', cost: 'Free' },
    { name: 'Klaviyo Product Certification', provider: 'Klaviyo', skills: ['Klaviyo', 'Email Marketing', 'Marketing Automation', 'E-commerce'], avgRateBoost: 8, difficulty: 'Easy', cost: 'Free' }
  ];

  /**
   * Normalize skill string for matching.
   * @param {string} s
   * @returns {string}
   */
  function norm(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Recommend certifications based on user skills and existing certs.
   * @param {string[]} skills - User's current skills
   * @param {string[]} existingCerts - Names of certifications user already has
   * @returns {{cert: string, provider: string, relevanceScore: number, estimatedROI: string, reason: string, difficulty: string, cost: string}[]}
   */
  function recommendCertifications(skills, existingCerts) {
    const normSkills = new Set((skills || []).map(norm));
    const normExisting = new Set((existingCerts || []).map(norm));

    return CERTIFICATIONS
      .filter(c => !normExisting.has(norm(c.name)))
      .map(c => {
        // Relevance = how many of user's skills overlap with cert's associated skills
        const matching = c.skills.filter(s => normSkills.has(norm(s)));
        const relevanceScore = Math.round((matching.length / c.skills.length) * 100);

        // ROI = relevance × rate boost, adjusted by difficulty
        const difficultyMultiplier = c.difficulty === 'Easy' ? 1.3 : c.difficulty === 'Medium' ? 1.0 : 0.8;
        const roi = relevanceScore * c.avgRateBoost * difficultyMultiplier / 100;

        const matchingStr = matching.length > 0
          ? `Matches your skills: ${matching.join(', ')}.`
          : 'Expands into a new skill area.';

        return {
          cert: c.name,
          provider: c.provider,
          relevanceScore,
          estimatedROI: `+${c.avgRateBoost}% avg rate increase`,
          reason: `${matchingStr} ${c.difficulty} difficulty, ${c.cost} cost.`,
          difficulty: c.difficulty,
          cost: c.cost,
          _sortScore: roi
        };
      })
      .filter(c => c.relevanceScore > 0)
      .sort((a, b) => b._sortScore - a._sortScore)
      .map(({ _sortScore, ...rest }) => rest);
  }

  // Export
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CertRecommender = {
    recommendCertifications: recommendCertifications,
    CERTIFICATIONS_DB: CERTIFICATIONS
  };
})();
