/* ===== CORTEX FREELANCER — ANALYSIS ENGINE ===== */

const BENCHMARKS = {
  "web-development":    { egypt:25, turkey:30, pakistan:20, india:22, nigeria:22, philippines:18, brazil:28, mexico:30, ukraine:32, kenya:20, us:75, uk:65, eu:60 },
  "mobile-development": { egypt:30, turkey:35, pakistan:25, india:28, nigeria:25, philippines:22, brazil:32, mexico:33, ukraine:35, kenya:23, us:85, uk:70, eu:65 },
  "design":             { egypt:20, turkey:25, pakistan:15, india:18, nigeria:18, philippines:14, brazil:22, mexico:24, ukraine:25, kenya:16, us:65, uk:55, eu:50 },
  "writing":            { egypt:15, turkey:20, pakistan:12, india:14, nigeria:15, philippines:10, brazil:18, mexico:18, ukraine:20, kenya:12, us:50, uk:45, eu:40 },
  "data-science":       { egypt:35, turkey:40, pakistan:30, india:32, nigeria:28, philippines:25, brazil:36, mexico:38, ukraine:38, kenya:26, us:90, uk:80, eu:70 },
  "devops":             { egypt:30, turkey:35, pakistan:25, india:28, nigeria:24, philippines:22, brazil:32, mexico:34, ukraine:36, kenya:22, us:85, uk:72, eu:65 },
  "marketing":          { egypt:18, turkey:22, pakistan:14, india:16, nigeria:16, philippines:12, brazil:20, mexico:22, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "video":              { egypt:18, turkey:22, pakistan:14, india:16, nigeria:15, philippines:12, brazil:20, mexico:20, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "blockchain":         { egypt:40, turkey:45, pakistan:35, india:38, nigeria:32, philippines:30, brazil:42, mexico:42, ukraine:44, kenya:30, us:100, uk:85, eu:78 },
  "qa":                 { egypt:22, turkey:26, pakistan:18, india:20, nigeria:19, philippines:16, brazil:25, mexico:26, ukraine:28, kenya:17, us:60, uk:52, eu:48 },
};
const SKILL_LABELS = {"web-development":"Web Development","mobile-development":"Mobile Development","design":"UI/UX Design","writing":"Content Writing","data-science":"Data Science","devops":"DevOps","marketing":"Digital Marketing","video":"Video Editing","blockchain":"Blockchain","qa":"QA Testing"};
const COUNTRY_LABELS = {egypt:"Egypt",turkey:"Turkey",pakistan:"Pakistan",india:"India",nigeria:"Nigeria",philippines:"Philippines",brazil:"Brazil",mexico:"Mexico",ukraine:"Ukraine",kenya:"Kenya",us:"United States",uk:"United Kingdom",eu:"Europe"};
const JOB_TEMPLATES = {
  "web-development":["Full-Stack Web App","React Dashboard","E-commerce Platform","Landing Page Redesign","API Integration","WordPress Custom Theme","SaaS MVP Development","REST API Backend","Next.js Web Application","Admin Panel Build"],
  "mobile-development":["iOS App Development","React Native App","Flutter Cross-Platform","Android App Redesign","Mobile App UI/UX","App Store Optimization","Push Notifications System","Mobile Payment Integration","Fitness Tracking App","Food Delivery App Clone"],
  "design":["Brand Identity Design","Mobile App UI Design","Website Redesign","Dashboard UI Kit","Logo + Brand Guide","SaaS Product Design","E-commerce UX Audit","Design System Creation","Social Media Templates","Pitch Deck Design"],
  "writing":["Blog Content Strategy","SEO Article Writing","Technical Documentation","Email Newsletter Copy","Product Descriptions","Whitepaper Writing","Social Media Content","Case Study Writing","Website Copywriting","Ghostwriting Book"],
  "data-science":["ML Model Development","Data Pipeline Build","Analytics Dashboard","NLP Chatbot","Predictive Model","Data Visualization","ETL Pipeline","Computer Vision System","Recommendation Engine","A/B Testing Framework"],
  "devops":["AWS Infrastructure Setup","CI/CD Pipeline","Docker + Kubernetes","Cloud Migration","Monitoring Setup","Terraform IaC","Security Audit","Database Optimization","Auto-scaling Config","Backup & DR Plan"],
  "marketing":["SEO Strategy","Google Ads Campaign","Social Media Management","Email Marketing Setup","Content Marketing Plan","Influencer Outreach","Conversion Optimization","Marketing Automation","Brand Strategy","Analytics Setup"],
  "video":["YouTube Video Editing","Product Promo Video","Social Media Reels","Corporate Video","Motion Graphics","Video Ad Creation","Tutorial Video Series","Podcast Video Edit","Wedding Video Edit","Animation Explainer"],
  "blockchain":["Smart Contract Dev","DeFi Protocol","NFT Marketplace","Token Launch","Web3 dApp","Blockchain Integration","Crypto Wallet","DAO Governance","DEX Development","Audit Smart Contracts"],
  "qa":["Automated Test Suite","Manual QA Process","Selenium Framework","API Testing","Performance Testing","Mobile App Testing","Security Testing","Regression Suite","Test Documentation","Bug Tracking Setup"],
};

// ── Template Library (23 templates) ─────────────────────────────────────
const TEMPLATE_LIBRARY = [
  {id:1,title:"Web Development Proposal",category:"proposal",content:"Dear [Client Name],\n\nThank you for sharing your project requirements.\n\nPROJECT UNDERSTANDING\nBased on your description, you need [brief summary].\n\nMY APPROACH\n1. Discovery & Planning (Week 1)\n   - Requirements deep-dive\n   - Wireframes and user flow\n   - Tech stack confirmation\n\n2. Development (Weeks 2-4)\n   - Frontend responsive design\n   - Backend API + database\n   - Third-party integrations\n\n3. Testing & Launch (Week 5)\n   - Cross-browser testing\n   - Performance optimization\n   - Deployment support\n\nINVESTMENT\n- Fixed price: $[amount]\n- Timeline: 5 weeks\n- Includes: 2 revision rounds + 30 days support\n\nWHY ME\n- [X] years full-stack experience\n- 98% client satisfaction\n- Weekly progress updates\n\nBest regards,\n[Your Name]"},
  {id:2,title:"Mobile App Proposal",category:"proposal",content:"Hi [Client Name],\n\nDEVELOPMENT PLAN\nPhase 1: UI/UX Design (1-2 weeks)\n- Research and prototypes\n- Visual design\n\nPhase 2: Core Dev (3-4 weeks)\n- Architecture\n- Feature implementation\n- API integration\n\nPhase 3: Polish & Launch (1-2 weeks)\n- Beta testing\n- App store submission\n- Analytics setup\n\nDELIVERABLES\n- Functional app + source code\n- App store assistance\n- 60 days bug fixes\n\nINVESTMENT: $[amount]\nTIMELINE: 6-8 weeks\n\nBest,\n[Your Name]"},
  {id:3,title:"Design Project Proposal",category:"proposal",content:"Hello [Client Name],\n\nMY PROCESS\n1. Research & Discovery\n   - Brand audit\n   - User personas\n   - Mood boards\n\n2. Design Exploration\n   - 2-3 concepts\n   - Feedback session\n   - Direction selection\n\n3. Execution\n   - High-fidelity designs\n   - Source files (Figma/Sketch)\n   - Style guide\n\nINCLUDED\n- [X] concepts, [X] revision rounds\n- All source files\n\nINVESTMENT: $[amount]\nTIMELINE: [X] weeks\n\nWarm regards,\n[Your Name]"},
  {id:4,title:"Data Science Proposal",category:"proposal",content:"Dear [Client Name],\n\nMETHODOLOGY\n1. Data Collection & Cleaning (Week 1)\n   - Quality assessment\n   - ETL pipeline\n   - Feature engineering\n\n2. Analysis & Modeling (Weeks 2-3)\n   - EDA\n   - Model training\n   - Validation\n\n3. Deployment (Week 4)\n   - Pipeline deployment\n   - Dashboard/reporting\n   - Documentation\n\nTOOLS: Python, SQL, Tableau, AWS/GCP\n\nINVESTMENT: $[amount]\nTIMELINE: 4 weeks\n\nBest regards,\n[Your Name]"},
  {id:5,title:"Marketing Campaign Proposal",category:"proposal",content:"Hi [Client Name],\n\nPhase 1: Audit & Strategy (Week 1-2)\n- Marketing audit\n- Competitor analysis\n- KPI setup\n\nPhase 2: Content Creation (Week 3-4)\n- Content calendar\n- Ad creative + copy\n- Landing page optimization\n\nPhase 3: Launch & Optimize (Week 5-8)\n- Campaign launch\n- A/B testing\n- Weekly reports\n\nEXPECTED: [X]% increase in [metric] within 90 days\n\nINVESTMENT: $[amount]/month\nMINIMUM: 3 months\n\nBest,\n[Your Name]"},
  {id:6,title:"Freelancer Invoice Template",category:"finance",content:"INVOICE\n\nInvoice #: INV-[YEAR]-[NUMBER]\nDate: [Date]\nDue: [Date + 30 days]\n\nFROM: [Your Name]\n[Address] | [Email] | [Phone]\n\nBILL TO: [Client Name]\n[Client Company]\n\nSERVICES:\n------------------------------------------\nDescription          Hours   Rate   Amount\n------------------------------------------\n[Service 1]           [X]   $[X]   $[X]\n[Service 2]           [X]   $[X]   $[X]\n------------------------------------------\n                         Subtotal:  $[X]\n                         Tax ([X]%): $[X]\n                         TOTAL:     $[X]\n\nPAYMENT:\n- Cenoa (Recommended - lowest fees)\n- Bank Transfer | PayPal\n\nTerms: Net 30 days."},
  {id:7,title:"Payment Terms Agreement",category:"finance",content:"PAYMENT TERMS\n\nFreelancer: [Your Name]\nClient: [Client Name]\n\n1. SCHEDULE\n   - 30% deposit at start\n   - 30% at milestone\n   - 40% at delivery\n\n2. METHODS\n   a) Cenoa (fastest, lowest fees)\n   b) Wise\n   c) Bank wire\n   d) PayPal\n\n3. LATE PAYMENT\n   - 7-day grace period\n   - 1.5%/month late fee\n   - Work pauses after 14 days\n\n4. REFUNDS\n   - Deposit non-refundable after work starts\n   - Partial refund for incomplete milestones\n\nSigned:\n_______________    _______________\nFreelancer         Client"},
  {id:8,title:"Monthly Financial Report",category:"finance",content:"MONTHLY FINANCIAL REPORT\nPeriod: [Month Year]\n\nSUMMARY\n- Active Clients: [X]\n- Invoices Sent/Paid: [X]/[X]\n- Gross Revenue: $[X]\n- Fees: -$[X]\n- Net Revenue: $[X]\n\nBY CLIENT\n1. [Client A]: $[X] ([X]%)\n2. [Client B]: $[X] ([X]%)\n\nHOURS\n- Total: [X] | Billable: [X] ([X]%)\n- Effective Rate: $[X]/hr\n\nNEXT MONTH GOALS\n- [ ] Revenue: $[X]\n- [ ] New clients: [X]\n- [ ] Rate increase to $[X]/hr"},
  {id:9,title:"Project Kickoff Brief",category:"pm",content:"PROJECT KICKOFF\n\nProject: [Name]\nClient: [Name]\nDates: [Start] to [End]\n\n1. OBJECTIVES\n   Primary: [Goal]\n   Metrics: [How measured]\n\n2. SCOPE\n   IN: [Feature 1], [Feature 2], [Feature 3]\n   OUT: [Excluded 1], [Excluded 2]\n\n3. MILESTONES\n   Wk1: [M1] | Wk2: [M2] | Wk3: [M3] | Wk4: [Delivery]\n\n4. COMMUNICATION\n   Weekly: [Day/Time]\n   Async: [Slack/Email]\n\n5. ACCESS NEEDED\n   [ ] Repo [ ] Design files [ ] Staging [ ] API keys"},
  {id:10,title:"Weekly Status Update",category:"pm",content:"STATUS UPDATE\nProject: [Name] | Week of: [Date]\nStatus: [On Track / At Risk / Blocked]\n\nDONE: [Task 1], [Task 2], [Task 3]\nIN PROGRESS: [Task 4] ([X]%), [Task 5] ([X]%)\nNEXT WEEK: [Task 6], [Task 7]\n\nBLOCKERS: [Description + what's needed]\n\nHours: [X] this week | [X] total of [X] estimated"},
  {id:11,title:"Scope Change Request",category:"pm",content:"SCOPE CHANGE REQUEST\n\nProject: [Name] | Date: [Date]\nPriority: [High/Medium/Low]\n\nCHANGE: [Description]\nREASON: [Why needed]\n\nIMPACT: +[X] days, +$[amount]\n\nOPTIONS\nA) Accept: $[X], +[X] days\nB) Modified: $[X], +[X] days\nC) Defer: $0, no current impact\n\nRecommend: Option [X]\n\n[ ] Client Approved  [ ] Freelancer Ack'd"},
  {id:12,title:"Client Onboarding Email",category:"comms",content:"Subject: Let's kick off [Project]!\n\nHi [Name],\n\n1. KICKOFF: [date/time]\n2. PLEASE SHARE: Brand guide, assets, platform access\n3. COMMS: Daily [Slack/Email], weekly video\n4. PAYMENT: Cenoa recommended (fastest + cheapest)\n\nExpect project brief in 48h, first deliverable by [date].\n\nQuestions:\n1. [Q1]\n2. [Q2]\n\nBest,\n[Your Name]"},
  {id:13,title:"Project Completion Email",category:"comms",content:"Subject: [Project] Delivered!\n\nHi [Name],\n\nDELIVERABLES: [links]\nSOURCE FILES: [link]\n\nNEXT: Review in [X] days, then final invoice.\n\nSUPPORT: [X] days bug fixes included.\n\nWould love a review on [platform]!\n\nBest,\n[Your Name]"},
  {id:14,title:"Payment Reminder",category:"comms",content:"Subject: Invoice #[number] Reminder\n\nHi [Name],\n\nInvoice #[number] for $[amount] was due [date].\n\nPay via:\n- Cenoa (Recommended): [link]\n- Bank: [details]\n- PayPal: [email]\n\nIf sent, please disregard.\n\nThank you!\n[Your Name]"},
  {id:15,title:"Freelance Service Agreement",category:"contract",content:"FREELANCE SERVICE AGREEMENT\n\nDate: [Date]\nFreelancer: [Name] | Client: [Name]\n\n1. SERVICES: [Description]\n2. TIMELINE: [Start] to [End]\n3. FEE: $[amount], 1.5%/mo late fee\n4. IP: Transfers on full payment; portfolio rights retained\n5. REVISIONS: [X] rounds; additional at $[X]/hr\n6. CONFIDENTIALITY: [X] years\n7. TERMINATION: [X] days notice; pay for completed work\n\nSigned:\n_______________    _______________\nFreelancer         Client"},
  {id:16,title:"Non-Disclosure Agreement",category:"contract",content:"NDA\n\nDate: [Date]\nDisclosing: [Client] | Receiving: [Your Name]\n\nCONFIDENTIAL INFO: Business plans, source code, customer data, financials, trade secrets.\n\nOBLIGATIONS: Keep confidential, use only for [project], no third-party disclosure.\n\nEXCLUSIONS: Public info, prior knowledge, independent development, legal requirement.\n\nTERM: [X] years.\n\nSigned:\n_______________    _______________\nDisclosing         Receiving"},
  {id:17,title:"Retainer Agreement",category:"contract",content:"RETAINER AGREEMENT\n\nFreelancer: [Name] | Client: [Name]\nDate: [Date]\n\n- Monthly Fee: $[amount]\n- Hours: [X]/month\n- Overage: $[X]/hr\n\nSERVICES: [List]\nPriority response: [X] business hours\n\nHours [do/don't] roll over.\nAvailable [Days] [Time]-[Time] [TZ]\nTerm: [X] months, [X] days cancellation\nPayment: 1st of month, Cenoa preferred\n\nSigned:\n_______________    _______________"},
  {id:18,title:"Upwork Profile Optimization",category:"growth",content:"PROFILE CHECKLIST\n\nHEADLINE: Skill + specialty + result, <70 chars\nEx: \"Senior React Dev | 50+ SaaS Shipped | 99% JSS\"\n\nOVERVIEW: Hook in first 2 lines, 3-5 metrics, tools, CTA, 500-1000 words\n\nSKILLS: Top 5 match targets, specific + broad, 3+ tested\n\nPORTFOLIO: 6+ items with title, description, result, visuals\n\nRATE: At/above market, consider fixed-price bids\n\nPHOTO: Professional headshot, good lighting"},
  {id:19,title:"Cold Outreach Sequence",category:"growth",content:"EMAIL 1 (Day 1):\nSubject: Quick question about [company]\n\"I noticed [observation]. I help [type] with [service]. 15-min call?\"\n\nEMAIL 2 (Day 4):\nSubject: Re: Quick question\n\"Put together [analysis/mockup]. [1-2 insights]. Happy to walk through.\"\n\nEMAIL 3 (Day 9):\nSubject: Should I close your file?\n\"Timing not right? No worries. Calendar: [link]\"\n\nTips: Personalize, Tue-Thu 9-11 AM, track opens"},
  {id:20,title:"Rate Increase Letter",category:"growth",content:"Subject: Rate update effective [Date]\n\nHi [Name],\n\nCurrent: $[X]/hr -> New: $[X]/hr\n\nReflects: expertise growth, market alignment, demand.\n\nFor you: Pre-[Date] work at current rate. Retainer clients: [X]% discount.\n\nRATE CARD:\nHourly: $[X] | Project <40h: $[X] | 40-100h: -5%\nRetainer: $[X]/mo | Rush <48h: +50%\n\nBest,\n[Your Name]"},
  {id:21,title:"Client Feedback Request",category:"comms",content:"Subject: Your feedback?\n\nHi [Name],\n\nPlease review on [Platform]: [link]\n\nQuick survey:\n- Outcome (1-10): ___\n- What went well? ___\n- Improvements? ___\n- Recommend me? ___\n\nReferrals welcome!\n\nThank you!\n[Your Name]"},
  {id:22,title:"Discovery Call Script",category:"growth",content:"DISCOVERY CALL (15-20 min)\n\nOPEN: \"Tell me about your project.\"\n\nASK:\n1. Project/challenge?\n2. Ideal outcome?\n3. Timeline?\n4. Freelancer experience?\n5. Budget range?\n\nPOSITION: Connect needs to experience, 1-2 case studies.\n\nCLOSE: \"Proposal within [X] hours.\"\n\nAFTER: Follow-up email <2h, proposal on time, LinkedIn connect"},
  {id:23,title:"Bug Report Template",category:"pm",content:"BUG REPORT\n\nID: BUG-[#] | Priority: [Crit/High/Med/Low]\n\nSUMMARY: [One line]\nENVIRONMENT: [Device] / [OS] / [Browser]\n\nSTEPS:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\nEXPECTED: [What should happen]\nACTUAL: [What happens]\n\nFrequency: [Always/Sometimes/Rarely]\nWorkaround: [Yes/No]\n\nFIX: [Root cause] -> [Solution] -> [Version]"},
];
const TEMPLATE_CATEGORIES = {proposal:"Proposals",finance:"Finance",pm:"Project Management",comms:"Communications",contract:"Contracts",growth:"Growth"};

// ── Utility ─────────────────────────────────────────────────────────────
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return Math.abs(h);}
function seededRand(seed){let s=seed;return function(){s=(s*16807+0)%2147483647;return s/2147483647;};}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function fmt$(n){return '$'+n.toLocaleString('en-US');}
function isPro(){
  var pro=localStorage.getItem('cortex_pro')==='true';
  if(pro){
    var exp=localStorage.getItem('cortex_pro_expiry');
    if(exp&&new Date(exp)<new Date()){localStorage.removeItem('cortex_pro');localStorage.removeItem('cortex_pro_expiry');return false;}
  }
  return pro;
}
function setPro(days){
  localStorage.setItem('cortex_pro','true');
  if(days){var d=new Date();d.setDate(d.getDate()+days);localStorage.setItem('cortex_pro_expiry',d.toISOString());}
}
function unlockPro(){setPro();location.reload();}
function getAnalysisCount(){return parseInt(localStorage.getItem('cortex_analysis_count')||'0');}
function incAnalysisCount(){var c=getAnalysisCount()+1;localStorage.setItem('cortex_analysis_count',String(c));return c;}
function hasStripeKeys(){return !document.body.hasAttribute('data-stripe-mock');}
function upgradeURL(){return '/pricing';}

let currentUser=null,analysisResult=null,feedInterval=null;

function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo(0,0);if(typeof gtag==='function'&&id==='screen-signup')gtag('event','pricing_view');}
async function syncProStatus(){
  try{
    if(!currentUser||!currentUser.email) return;
    const res=await fetch('/api/customer?email='+encodeURIComponent(currentUser.email));
    const data=await res.json();
    if(data&&data.active){setPro();}
  }catch(e){/* ignore offline/mock */}
}
function mockGoogleLogin(){if(typeof cortexSignIn==='function'){cortexSignIn().then(function(u){if(u){currentUser={name:u.displayName,email:u.email};toast('Signed in as '+u.displayName);syncProStatus();}});return;}const name=prompt('Enter your name (mock Google login):');if(!name)return;currentUser={name,email:name.toLowerCase().replace(/\s/g,'.')+'@gmail.com'};localStorage.setItem('cortex_user',JSON.stringify(currentUser));toast('Signed in as '+currentUser.name);syncProStatus();}
function skipLogin(){currentUser=null;toast('Continuing as guest');}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
function toggleManualForm(){document.getElementById('manual-form').classList.toggle('visible');}

function analyzeFromURL(){const url=document.getElementById('upwork-url').value.trim();if(!url){toast('Please enter a URL or use manual form');return;}const username=url.replace(/\/+$/,'').split('/').pop()||url;const seed=hashStr(username),rand=seededRand(seed);
  // Detect skill from URL/username patterns
  const skillPatterns={
    'web-development':['web','fullstack','full-stack','frontend','front-end','backend','react','angular','vue','node','php','django','rails','wordpress','html','css','javascript','js','nextjs','laravel','developer','dev','coder','programmer'],
    'mobile-development':['mobile','ios','android','flutter','react-native','swift','kotlin','app-dev','xamarin'],
    'design':['design','ui','ux','uiux','graphic','figma','sketch','photoshop','illustrator','creative','brand','logo'],
    'writing':['writ','content','copy','blog','article','seo-writ','technical-writ','ghost','editor','author'],
    'data-science':['data','ml','machine-learning','ai','deep-learning','python','analyst','nlp','tensorflow','pytorch'],
    'devops':['devops','cloud','aws','azure','gcp','docker','kubernetes','sre','infra','terraform','cicd'],
    'marketing':['market','seo','ppc','social-media','ads','growth','brand','digital-market','email-market'],
    'video':['video','motion','animation','after-effects','premiere','edit','vfx','youtube'],
    'blockchain':['blockchain','web3','solidity','smart-contract','defi','nft','crypto','ethereum'],
    'qa':['qa','test','quality','selenium','automation','cypress','manual-test']
  };
  const lower=username.toLowerCase().replace(/[_\.]/g,'-');
  let detectedSkill=null;
  for(const[sk,kws]of Object.entries(skillPatterns)){for(const kw of kws){if(lower.includes(kw)){detectedSkill=sk;break;}}if(detectedSkill)break;}
  const skills=Object.keys(BENCHMARKS),skill=detectedSkill||skills[Math.floor(rand()*skills.length)];
  const countries=Object.keys(COUNTRY_LABELS),country=countries[Math.floor(rand()*countries.length)];
  const bm=BENCHMARKS[skill][country]||30;
  runAnalysis({skill,country,rate:Math.round(bm*(0.7+rand()*0.6)),exp:Math.floor(1+rand()*10),seed,username,fromURL:true});
}

function analyzeFromManual(){const skill=document.getElementById('skill-select').value,country=document.getElementById('country-select').value,rate=parseInt(document.getElementById('rate-input').value)||0,exp=parseInt(document.getElementById('exp-input').value)||0;if(!skill||!country){toast('Select skill and country');return;}if(!rate){toast('Enter hourly rate');return;}runAnalysis({skill,country,rate,exp,seed:hashStr(skill+country+rate+exp),username:null,fromURL:false});}

function runAnalysis(input){
  var count=getAnalysisCount();
  if(count>=1&&!isPro()){showUpgradeWall();return;}
  incAnalysisCount();
  if(typeof gtag==='function')gtag('event','analyze_start',{skill:input.skill,country:input.country});
  showScreen('screen-terminal');const result=generateAnalysis(input);analysisResult=result;window.analysisResult=result;
  runTerminalAnimation(()=>{renderDashboard(result);showScreen('screen-dashboard');dataLayer.push({'event': 'analysis_completed', 'profile_url': window.location.href});if(typeof gtag==='function')gtag('event','analyze_complete',{score:result.totalScore});});
}
function showUpgradeWall(){
  document.getElementById('pro-modal').querySelector('.pro-modal-header h2').innerHTML='Your free analysis is used <span>Upgrade to Pro</span>';
  document.getElementById('pro-modal').querySelector('.pro-modal-header p').innerHTML='You\'ve used your free profile analysis. Upgrade to Pro for <strong>unlimited analyses</strong> and all premium tools.';
  showProModal();
}

function runTerminalAnimation(cb){const body=document.getElementById('terminal-body'),bar=document.getElementById('progress-bar');body.innerHTML='';bar.style.width='0%';const lines=[{text:'Connecting to Upwork...',delay:300},{text:'Crawling profile data...',delay:500},{text:'Analyzing 847 similar freelancers...',delay:600},{text:'Scanning 2,341 open jobs...',delay:500},{text:'Calculating optimal rates...',delay:400},{text:'Checking payment efficiency...',delay:400},{text:'Generating your report...',delay:500}];lines.forEach(l=>{const d=document.createElement('div');d.className='term-line';d.innerHTML='<span class="prompt">&gt; </span><span class="typing">'+l.text+'</span><span class="check">&#10003;</span>';body.appendChild(d);});const els=body.querySelectorAll('.term-line');let elapsed=0;lines.forEach((l,i)=>{const s=elapsed,d=s+l.delay+400;setTimeout(()=>els[i].classList.add('visible'),s);setTimeout(()=>{els[i].classList.add('done');bar.style.width=Math.round(((i+1)/lines.length)*100)+'%';},d);elapsed=d+100;});setTimeout(cb,elapsed+400);}

function generateAnalysis({skill,country,rate,exp,seed,username,fromURL}){
  const rand=seededRand(seed),bm=BENCHMARKS[skill]?.[country]||30,sl=SKILL_LABELS[skill]||skill,cl=COUNTRY_LABELS[country]||country;
  const headline=clamp(Math.round(4+rand()*5+(exp>5?1:0)),3,10),overview=clamp(Math.round(5+rand()*4+(exp>3?1:0)),4,10),skillsScore=clamp(Math.round(4+rand()*5),3,10),portfolio=clamp(Math.round(3+rand()*5),2,10),rateScore=clamp(Math.round(rate>=bm*0.8&&rate<=bm*1.3?7+rand()*3:4+rand()*3),3,10);
  const totalScore=+((headline+overview+skillsScore+portfolio+rateScore)/5).toFixed(1);
  // Generate actionable, detailed hints
  const trendingSkills={'web-development':['TypeScript','Next.js','Tailwind CSS','GraphQL','AWS'],'mobile-development':['Flutter','React Native','SwiftUI','Kotlin Multiplatform','Firebase'],'design':['Figma','Design Systems','Webflow','Motion Design','UX Research'],'writing':['SEO Writing','AI Content','Technical Docs','UX Writing','Ghostwriting'],'data-science':['Python','TensorFlow','LLMs','Data Pipelines','MLOps'],'devops':['Kubernetes','Terraform','GitHub Actions','AWS CDK','Observability'],'marketing':['Google Ads','Meta Ads','Marketing Automation','Analytics','CRO'],'video':['After Effects','DaVinci Resolve','Motion Graphics','Short-Form','3D Animation'],'blockchain':['Solidity','Rust','DeFi','Smart Contract Audits','Zero-Knowledge'],'qa':['Cypress','Playwright','API Testing','Performance Testing','CI/CD Integration']};
  const headlineExamples={'web-development':'Senior Full-Stack Developer | React & Node.js | 50+ Projects Delivered','mobile-development':'Mobile App Developer | Flutter & React Native | 4.9\u2605 Rating','design':'UI/UX Designer | SaaS & Mobile | Design Systems Expert','writing':'SEO Content Writer | B2B SaaS | 2M+ Organic Traffic Generated','data-science':'Data Scientist | ML & NLP | Python | Fortune 500 Experience','devops':'DevOps Engineer | AWS & Kubernetes | 99.99% Uptime Track Record','marketing':'Digital Marketing Strategist | 300%+ ROI Campaigns | Google Certified','video':'Video Editor & Motion Designer | YouTube & Social | 1000+ Videos','blockchain':'Blockchain Developer | Solidity & Rust | $50M+ TVL Protocols','qa':'QA Engineer | Automation & Performance | Selenium & Cypress'};
  const trending=trendingSkills[skill]||trendingSkills['web-development'];
  const exampleHeadline=headlineExamples[skill]||headlineExamples['web-development'];
  var hints={};
  // Headline hints
  if(headline<7){hints.headline='Your title is too generic. Use this formula: [Role] | [Specialty] | [Proof]. Example: "'+exampleHeadline+'". Keep under 70 characters. Include your top skill and a measurable result.';}else if(headline<9){hints.headline='Good title, but add a differentiator. Try adding a metric like "50+ projects" or "99% JSS". Example: "'+exampleHeadline+'"';}else{hints.headline='Excellent title \u2014 specific, result-oriented, and clear.';}
  // Overview hints
  if(overview<6){hints.overview='Your overview needs work. First 2 lines are critical (shown before "read more"). Start with a hook: what problem you solve. Include 3-5 measurable results. Aim for 500-1000 words. Add a clear CTA like "Message me to discuss your project."';}else if(overview<8){hints.overview='Decent overview. Strengthen it: add specific metrics (e.g., "reduced load time by 40%"), list your tech stack, and end with a call-to-action. Aim for 600+ words \u2014 longer overviews rank higher in Upwork search.';}else{hints.overview='Strong overview with good detail. Consider A/B testing your opening hook for even better conversion.';}
  // Skills hints
  if(skillsScore<7){hints.skills='Add trending skills: '+trending.slice(0,3).join(', ')+'. Upwork search favors profiles with 10-15 skills. Take Upwork skill tests for badges \u2014 profiles with test scores get 30% more views. Remove outdated skills like jQuery or Flash.';}else{hints.skills='Good skill coverage. Consider adding '+trending[Math.floor(rand()*trending.length)]+' \u2014 it\'s trending in your niche with '+Math.floor(20+rand()*30)+'% more job postings this quarter.';}
  // Portfolio hints
  if(portfolio<7){hints.portfolio='Add '+(3+Math.floor(rand()*3))+' case studies with: problem statement, your approach, measurable results, and visuals. Projects with screenshots get 2x more clicks. Include a mix of project sizes to show range.';}else{hints.portfolio='Solid portfolio. Tip: add a short video walkthrough for your top project \u2014 profiles with video get 35% more invitations.';}
  // Rate hints
  if(rate<bm*0.8){var gap=bm-rate;hints.rate='You\'re charging $'+gap+'/hr below market ('+fmt$(rate)+' vs '+fmt$(bm)+' avg for '+sl+' in '+cl+'). Raise incrementally: +$5/hr every 2 successful projects. For fixed-price jobs, quote at your target rate. Clients who pay more tend to be better to work with.';}else if(rate>bm*1.4){hints.rate='Premium rate at '+fmt$(rate)+'/hr (market avg: '+fmt$(bm)+'). To justify: showcase ROI-driven case studies, add certifications, maintain 95%+ JSS. Position yourself as a specialist, not a generalist.';}else{hints.rate='Competitive rate at '+fmt$(rate)+'/hr (market: '+fmt$(bm)+'). You\'re in the sweet spot. Consider raising by $3-5/hr for new clients while keeping existing client rates stable.';}
  // JSS & profile tips (extra insights)
  var profileTips=[];
  profileTips.push({title:'Job Success Score (JSS)',tip:'Maintain 90%+ JSS by: completing every contract, responding within 2 hours, setting clear expectations upfront, and asking for 5-star feedback after delivery. A JSS drop from 95% to 85% can reduce invitations by 50%.'});
  profileTips.push({title:'Response Time',tip:'Respond to invitations within 2 hours during business hours. Upwork\'s algorithm favors fast responders. Set up mobile notifications. Profiles with <1hr avg response get "Top Rated" priority.'});
  if(exp<=3){profileTips.push({title:'Building Reputation',tip:'Take 3-5 smaller projects ($100-500) to build reviews quickly. Offer a "first project" discount of 10-15%. Once you have 10+ reviews with 4.8+ rating, you can raise rates significantly.'});}
  if(exp>=5){profileTips.push({title:'Specialist Positioning',tip:'With '+exp+' years experience, position as a specialist. Create a niche title, not "Full-Stack Developer" but "React SaaS Dashboard Expert". Specialists earn 40-60% more than generalists on Upwork.'});}
  profileTips.push({title:'Availability Badge',tip:'Set your availability to "More than 30 hrs/week" even if you\'re selective. Profiles with availability badges appear 25% more in search results. You can always decline projects.'});
  const tpl=JOB_TEMPLATES[skill]||JOB_TEMPLATES["web-development"],jobCount=10+Math.floor(rand()*12),jobs=[];
  for(let i=0;i<Math.min(5,tpl.length);i++){jobs.push({title:tpl[i],budget:Math.round(bm*(20+Math.floor(rand()*80))/10)*10,match:Math.round(68+rand()*27),rating:+(4.2+rand()*0.8).toFixed(1),hoursAgo:Math.floor(1+rand()*48)});}
  jobs.sort((a,b)=>b.match-a.match);
  const ai=rate*30*48,pf=Math.round(29+ai*0.02+18),wf=Math.round(ai*0.012),ppf=Math.round(ai*0.045),cf=Math.round(ai*0.0075),sav=pf-cf;
  const rd=Math.round(((bm-rate)/bm)*100),ri=rate<bm?'Rate '+Math.abs(rd)+'% below market for '+sl+' in '+cl:(rate>bm*1.3?'Rate '+Math.abs(rd)+'% above avg':'Rate competitive for '+sl+' in '+cl);
  const fi=[{icon:'\u{1F4DD}',text:'Draft proposal for \''+tpl[0]+'\' \u2014 '+fmt$(jobs[0]?.budget||2000)+' budget'},{icon:'\u{1F4CA}',text:'Revenue: '+fmt$(Math.round(rate*30*(0.8+rand()*0.4)))+' this week'},{icon:'\u26A0\uFE0F',text:'Invoice overdue \u2014 sending reminder'},{icon:'\u{1F50D}',text:Math.floor(2+rand()*6)+' new matching jobs'},{icon:'\u{1F4C8}',text:'Raise rate by $'+Math.floor(2+rand()*8)+'/hr'},{icon:'\u{1F3AF}',text:'Add "'+['TypeScript','Figma','Python','AWS','React','Node.js'][Math.floor(rand()*6)]+'" to skills'},{icon:'\u{1F4B0}',text:'Payment: '+fmt$(Math.round(500+rand()*3000))+' from "'+['TechCorp','StartupX','DesignCo'][Math.floor(rand()*3)]+'"'},{icon:'\u{1F680}',text:'Proposal for \''+tpl[2]+'\' viewed'}];
  return {totalScore,headline,overview,skillsScore,portfolio,rateScore,hints,profileTips,skillLabel:sl,countryLabel:cl,skill,country,rate,benchmark:bm,exp,seed,jobCount,jobs,annualIncome:ai,payoneerFees:pf,wiseFees:wf,paypalFees:ppf,cenoaFees:cf,savings:sav,cenoaSaveVsPaypal:Math.round(((ppf-cf)/ppf)*100),rateInsight:ri,feedItems:fi,username:username||null,fromURL:!!fromURL};
}

// ── Helpers ─────────────────────────────────────────────────────────────
function jobItemHTML(j){return '<div class="job-item"><div class="job-match '+(j.match>=80?'high':'mid')+'">'+j.match+'%</div><div class="job-info"><div class="job-title">'+j.title+'</div><div class="job-meta"><span>'+fmt$(j.budget)+'</span><span>\u2605 '+j.rating+'</span><span>'+j.hoursAgo+'h ago</span></div></div><button class="btn-sm" onclick="showScreen(\'screen-signup\')">Draft Proposal</button></div>';}
function feeBarHTML(l,f,mx,c,col,tag){return '<div class="fee-bar"><span class="fee-label">'+l+'</span><div class="fee-track"><div class="fee-fill '+c+'" data-width="'+(f/mx*100)+'" style="width:0%">'+fmt$(f)+'/yr</div></div><span class="fee-tag" style="color:'+col+'">'+tag+'</span></div>';}
function animateNumber(id,from,to,dur,dec){const el=document.getElementById(id),st=performance.now();(function t(n){const p=Math.min((n-st)/dur,1);el.textContent=(from+(to-from)*(1-Math.pow(1-p,3))).toFixed(dec);if(p<1)requestAnimationFrame(t);})(st);}
function proLockedHTML(f){return '<div class="pro-locked-overlay" onclick="showProModal()"><div class="pro-locked-card"><div class="pro-locked-icon">&#128274;</div><div class="pro-locked-text">Unlock '+f+' \u2014 <strong>Go Pro $29/mo</strong></div></div></div>';}

// ── Dashboard ───────────────────────────────────────────────────────────
function renderDashboard(r){
  var ring=document.getElementById('score-ring-fg'),circ=2*Math.PI*50;
  ring.style.strokeDasharray=circ;ring.style.strokeDashoffset=circ;
  requestAnimationFrame(function(){setTimeout(function(){ring.style.strokeDashoffset=circ-(circ*(r.totalScore/10));},100);});
  animateNumber('score-num',0,r.totalScore,1500,1);
  var bd=document.getElementById('breakdown');
  bd.innerHTML=[{l:'Headline',v:r.headline,h:r.hints.headline},{l:'Overview',v:r.overview,h:r.hints.overview},{l:'Skills',v:r.skillsScore,h:r.hints.skills},{l:'Portfolio',v:r.portfolio,h:r.hints.portfolio},{l:'Rate',v:r.rateScore,h:r.hints.rate}].map(function(i){return '<div class="breakdown-item"><span class="label">'+i.l+'</span><div class="bar-wrap"><div class="bar-fill" data-width="'+(i.v*10)+'"></div></div><span class="val">'+i.v+'/10</span></div><div class="breakdown-hint">'+i.h+'</div>';}).join('');
  setTimeout(function(){bd.querySelectorAll('.bar-fill').forEach(function(b){b.style.width=b.dataset.width+'%';});},200);

  document.getElementById('jobs-count').innerHTML='<span>'+r.jobCount+'</span> jobs match your profile this week';
  var jl=document.getElementById('job-list'),jh=r.jobs.slice(0,5).map(jobItemHTML).join('');
  if(!isPro())jh+='<div class="pro-locked-section" style="margin-top:0.5rem"><div class="pro-locked-jobs-blur"><div class="job-item" style="opacity:0.6"><div class="job-match mid">74%</div><div class="job-info"><div class="job-title">More jobs...</div><div class="job-meta"><span>'+fmt$(r.benchmark*40)+'</span><span>\u2605 4.6</span><span>3h ago</span></div></div></div><div class="job-item" style="opacity:0.4"><div class="job-match mid">71%</div><div class="job-info"><div class="job-title">More opportunities...</div><div class="job-meta"><span>'+fmt$(r.benchmark*30)+'</span><span>\u2605 4.8</span><span>5h ago</span></div></div></div></div>'+proLockedHTML('15 more job matches')+'</div>';
  jl.innerHTML=jh;

  var mc=document.getElementById('money-content'),mx=Math.max(r.paypalFees,r.payoneerFees,r.wiseFees,r.cenoaFees);
  mc.innerHTML='<div class="money-headline">\u{1F4B0} Payment Opportunities <span style="font-size:0.7em;opacity:0.6">based on '+fmt$(r.annualIncome)+'/yr</span></div><div class="fee-compare">'+feeBarHTML('PayPal',r.paypalFees,mx,'paypal','#888','Baseline')+feeBarHTML('Payoneer',r.payoneerFees,mx,'payoneer','#ffaa00','Save '+(100-Math.round(r.payoneerFees/r.paypalFees*100))+'%')+feeBarHTML('Wise',r.wiseFees,mx,'wise','#66cc88','Save '+(100-Math.round(r.wiseFees/r.paypalFees*100))+'%')+'<div class="fee-bar highlight-bar"><span class="fee-label">Cenoa</span><div class="fee-track"><div class="fee-fill cenoa" data-width="'+(r.cenoaFees/mx*100)+'" style="width:0%">'+fmt$(r.cenoaFees)+'/yr</div></div><span class="fee-tag top-rated" style="color:#00ff88;font-weight:700">\u2B50 TOP \u2014 Save '+r.cenoaSaveVsPaypal+'%</span></div></div><div class="money-tip">'+r.rateInsight+'. <strong>Recommended: '+fmt$(r.benchmark)+'/hr</strong></div>';
  setTimeout(function(){mc.querySelectorAll('.fee-fill').forEach(function(b){b.style.width=b.dataset.width+'%';});},400);

  if(feedInterval)clearInterval(feedInterval);
  var fc=document.getElementById('feed-container');fc.innerHTML='';var fi=0;
  function af(){var item=r.feedItems[fi%r.feedItems.length];var el=document.createElement('div');el.className='feed-item';el.innerHTML='<span class="feed-icon">'+item.icon+'</span><div><div class="feed-text">'+item.text+'</div><div class="feed-time">Just now</div></div>';fc.insertBefore(el,fc.firstChild);if(fc.children.length>8)fc.removeChild(fc.lastChild);fi++;}
  for(var i=0;i<4;i++)af();feedInterval=setInterval(af,2000);

  renderShareScoreCard(r);
  document.getElementById('signup-savings-li').innerHTML='&#10003;&ensp;Save '+fmt$(r.savings)+'/year on payment fees with Cenoa';

  renderJobsTab(r);renderInvoiceTab(r);renderProposalTab(r);renderTemplatesTab();renderRateCalcTab(r);switchTab('overview');
  renderUpgradeBars();
}

function renderUpgradeBars(){
  if(isPro())return;
  // Upgrade CTA after dashboard output
  var existing=document.getElementById('upgrade-cta-bar');
  if(existing)existing.remove();
  var bar=document.createElement('div');bar.id='upgrade-cta-bar';
  bar.style.cssText='background:linear-gradient(135deg,var(--orange),#ff6622);border-radius:var(--radius);padding:1.25rem 1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;';
  bar.innerHTML='<div style="display:flex;flex-direction:column;gap:0.25rem"><strong style="color:#fff;font-size:1rem">Unlock the full Cortex experience</strong><span style="color:rgba(255,255,255,0.85);font-size:0.8rem">Unlimited analyses, invoice generator, proposal writer, 78+ templates &amp; more</span></div><div style="display:flex;gap:0.5rem;flex-wrap:wrap"><a href="/pricing" style="background:#fff;color:#000;padding:0.6rem 1.2rem;border-radius:100px;font-weight:700;font-size:0.85rem;text-decoration:none;white-space:nowrap">View Pricing</a><button onclick="showProModal()" style="background:rgba(0,0,0,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);padding:0.6rem 1.2rem;border-radius:100px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;white-space:nowrap">Upgrade to Pro &mdash; $29/mo</button></div>';
  var dashboard=document.getElementById('screen-dashboard');
  var tabBar=document.getElementById('tab-bar');
  if(tabBar)dashboard.insertBefore(bar,tabBar);
}

function getShareURL(){var r=analysisResult;if(!r)return location.href;var data={s:r.totalScore,sk:r.skill,c:r.country,sv:r.savings,r:r.rate,bm:r.benchmark,h:r.headline,o:r.overview,ss:r.skillsScore,p:r.portfolio,rs:r.rateScore};return location.origin+'/app/share.html#'+btoa(JSON.stringify(data));}
function copyShareLink(){navigator.clipboard&&navigator.clipboard.writeText(getShareURL()).then(function(){toast('Link copied!');});}
function shareTwitter(){var r=analysisResult;window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent('My Freelancer Score: '+r.totalScore+'/10 — I save '+fmt$(r.savings)+'/yr on fees! Get yours free:')+'&url='+encodeURIComponent(getShareURL()),'_blank');}
function shareLinkedIn(){window.open('https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(getShareURL()),'_blank');}
async function handleSignup(){
  var email=document.getElementById('signup-email').value.trim();
  if(!email||!email.includes('@')){toast('Enter valid email');return;}
  try{
    var res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,plan:'pro_monthly'})});
    var data=await res.json();
    if(!res.ok)throw new Error(data.error||'Checkout failed');
    window.location.href=data.url;
  }catch(err){showContactFallback(email);}
}

function switchTab(tab){if(['invoice','proposal','templates'].indexOf(tab)>=0&&!isPro()){showProModal();return;}document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.toggle('active',b.dataset.tab===tab);});document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active');});var el=document.getElementById('tab-'+tab);if(el)el.classList.add('active');}
function showProModal(){document.getElementById('pro-modal').classList.add('show');}
function closeProModal(e){if(!e||e.target===e.currentTarget)document.getElementById('pro-modal').classList.remove('show');}
async function startPro(plan){
  dataLayer.push({'event': 'checkout_started', 'plan_type': plan});
  document.getElementById('pro-modal').classList.remove('show');
  var email=currentUser&&currentUser.email?currentUser.email:prompt('Enter your email to continue to checkout:');
  if(!email)return;
  try{
    var res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,plan:plan||'pro_monthly'})});
    var data=await res.json();
    if(!res.ok)throw new Error(data.error||'Checkout failed');
    window.location.href=data.url;
  }catch(err){
    // Stripe keys missing or network error — show contact fallback
    showContactFallback(email);
  }
}
function showContactFallback(email){
  var m=document.getElementById('pro-modal');
  m.querySelector('.pro-modal').innerHTML='<button class="pro-modal-close" onclick="document.getElementById(\'pro-modal\').classList.remove(\'show\')">&times;</button><div style="text-align:center;padding:1rem 0"><div style="font-size:2.5rem;margin-bottom:1rem">&#128233;</div><h2 style="font-size:1.3rem;font-weight:800;color:var(--text-bright);margin-bottom:0.5rem">Payment setup in progress</h2><p style="color:var(--text-dim);font-size:0.9rem;margin-bottom:1.5rem;line-height:1.6">Our checkout is being configured. Contact us directly and we\'ll activate your Pro account manually.</p><a href="mailto:hello@cortexfreelancer.com?subject=Pro%20Upgrade%20Request&body=Email:%20'+(email||'')+'" style="display:inline-block;background:linear-gradient(135deg,var(--green),var(--green2));color:var(--bg);padding:0.85rem 1.5rem;border-radius:var(--radius-sm);font-weight:800;font-size:1rem;text-decoration:none">Email Us to Activate Pro</a><p style="color:var(--text-dim);font-size:0.8rem;margin-top:1rem">hello@cortexfreelancer.com</p></div>';
  m.classList.add('show');
}

// ── JOBS TAB ────────────────────────────────────────────────────────────
var allGeneratedJobs=[];
function renderJobsTab(r){
  var c=document.getElementById('tab-jobs'),rand=seededRand(r.seed||hashStr(r.skill+r.country)),tpl=JOB_TEMPLATES[r.skill]||JOB_TEMPLATES["web-development"];
  allGeneratedJobs=[];for(var i=0;i<20;i++){allGeneratedJobs.push({title:tpl[i%tpl.length]+(i>=tpl.length?' #'+(i+1):''),budget:Math.round(r.benchmark*(20+Math.floor(rand()*80))/10)*10,match:Math.round(60+rand()*35),rating:+(4.0+rand()*1.0).toFixed(1),hoursAgo:Math.floor(1+rand()*72)});}
  allGeneratedJobs.sort(function(a,b){return b.match-a.match;});
  var pro=isPro(),h='<div class="panel" style="max-width:100%"><div class="panel-title">All Job Matches</div><div class="jobs-count"><span>'+r.jobCount+'</span> jobs match your profile</div>';
  if(pro)h+='<div class="jobs-filters"><div class="filter-row"><div class="filter-group"><label>Sort</label><select id="job-sort" onchange="applyJobFilters()"><option value="match">Best Match</option><option value="budget-desc">Budget \u2193</option><option value="budget-asc">Budget \u2191</option><option value="rating">Rating</option><option value="recent">Recent</option></select></div><div class="filter-group"><label>Min Budget</label><select id="job-filter-budget" onchange="applyJobFilters()"><option value="0">Any</option><option value="500">$500+</option><option value="1000">$1k+</option><option value="2000">$2k+</option><option value="5000">$5k+</option></select></div><div class="filter-group"><label>Rating</label><select id="job-filter-rating" onchange="applyJobFilters()"><option value="0">Any</option><option value="4.5">4.5+</option><option value="4.7">4.7+</option><option value="4.9">4.9+</option></select></div><div class="filter-group"><label>Posted</label><select id="job-filter-recency" onchange="applyJobFilters()"><option value="999">Any</option><option value="6">6h</option><option value="12">12h</option><option value="24">24h</option><option value="48">48h</option></select></div></div></div>';
  h+='<div class="job-list" id="job-list-full"></div>';
  if(!pro){h+='<div class="pro-locked-section"><div class="pro-locked-jobs-blur">';allGeneratedJobs.slice(5,10).forEach(function(j){h+='<div class="job-item"><div class="job-match mid">'+j.match+'%</div><div class="job-info"><div class="job-title">'+j.title+'</div><div class="job-meta"><span>'+fmt$(j.budget)+'</span><span>\u2605 '+j.rating+'</span><span>'+j.hoursAgo+'h ago</span></div></div></div>';});h+='</div>'+proLockedHTML('15 more jobs')+'</div>';}
  h+='</div>';c.innerHTML=h;renderJobList(allGeneratedJobs.slice(0,pro?20:5));
}
function renderJobList(jobs){var jl=document.getElementById('job-list-full');if(!jl)return;jl.innerHTML=jobs.length?jobs.map(function(j){return '<div class="job-item"><div class="job-match '+(j.match>=80?'high':'mid')+'">'+j.match+'%</div><div class="job-info"><div class="job-title">'+j.title+'</div><div class="job-meta"><span>'+fmt$(j.budget)+'</span><span>\u2605 '+j.rating+'</span><span>'+j.hoursAgo+'h ago</span></div></div><button class="btn-sm" onclick="'+(isPro()?"switchTab(\'proposal\')":"showScreen(\'screen-signup\')")+'">Draft Proposal</button></div>';}).join(''):'<p style="color:var(--text-dim);padding:1rem;text-align:center">No matches for these filters.</p>';}
function applyJobFilters(){var s=document.getElementById('job-sort').value,mb=parseFloat(document.getElementById('job-filter-budget').value)||0,mr=parseFloat(document.getElementById('job-filter-rating').value)||0,mh=parseInt(document.getElementById('job-filter-recency').value)||999;var f=allGeneratedJobs.filter(function(j){return j.budget>=mb&&j.rating>=mr&&j.hoursAgo<=mh;});var sorts={match:function(a,b){return b.match-a.match;},'budget-desc':function(a,b){return b.budget-a.budget;},'budget-asc':function(a,b){return a.budget-b.budget;},rating:function(a,b){return b.rating-a.rating;},recent:function(a,b){return a.hoursAgo-b.hoursAgo;}};f.sort(sorts[s]||sorts.match);renderJobList(f);}

// ── INVOICE GENERATOR ───────────────────────────────────────────────────
var invoiceLineItems=[{description:'',qty:1,rate:0}];
function renderInvoiceTab(r){
  var c=document.getElementById('invoice-container');
  if(!isPro()){c.innerHTML=proLockedHTML('Invoice Generator');c.parentElement.classList.add('is-locked');return;}
  c.parentElement.classList.remove('is-locked');
  var saved=JSON.parse(localStorage.getItem('cortex_invoices')||'[]');
  c.innerHTML='<div class="invoice-layout"><div class="invoice-form"><h3 style="color:var(--text-bright);font-size:0.95rem;margin-bottom:0.5rem">Your Details</h3><div class="form-row"><div class="form-field"><label>Name</label><input type="text" id="inv-from" placeholder="Your Name" value="'+(currentUser?currentUser.name:'')+'"></div><div class="form-field"><label>Email</label><input type="text" id="inv-from-email" placeholder="you@email.com" value="'+(currentUser?currentUser.email:'')+'"></div></div><h3 style="color:var(--text-bright);font-size:0.95rem;margin:1rem 0 0.5rem">Client</h3><div class="form-row"><div class="form-field"><label>Client Name</label><input type="text" id="inv-client" placeholder="Acme Corp"></div><div class="form-field"><label>Project</label><input type="text" id="inv-project" placeholder="Website Redesign"></div></div><h3 style="color:var(--text-bright);font-size:0.95rem;margin:1rem 0 0.5rem">Line Items</h3><div id="inv-lines"></div><button class="btn-add-line" onclick="addInvLine()">+ Add Line</button><div class="form-row" style="margin-top:1rem"><div class="form-field"><label>Tax %</label><input type="number" id="inv-tax" value="0" min="0" max="100" oninput="updateInvFee()"></div><div class="form-field"><label>Payment</label><select id="inv-method" onchange="updateInvFee()"><option value="cenoa">Cenoa (Recommended)</option><option value="payoneer">Payoneer</option><option value="wise">Wise</option><option value="paypal">PayPal</option></select></div></div><div id="inv-fee" class="inv-fee-impact"></div><div class="form-row" style="gap:0.5rem;margin-top:0.5rem"><button class="btn-analyze-manual" onclick="genInvoice()" style="flex:1">Generate Invoice</button><button class="btn-secondary" onclick="copyInvText()">Copy Text</button><button class="btn-secondary" onclick="window.print()">Print/PDF</button></div></div><div id="inv-preview" class="inv-preview"></div>'+(saved.length?'<div class="invoice-history"><h3 style="color:var(--text-bright);font-size:0.95rem;margin-bottom:0.75rem">History</h3><div class="invoice-history-list">'+saved.slice(-10).reverse().map(function(v,i){return '<div class="invoice-history-item" onclick="loadInv('+(saved.length-1-i)+')"><div><strong>'+v.number+'</strong> \u2014 '+v.client+'</div><div style="font-size:0.75rem;color:var(--text-dim)">'+v.date+' &middot; '+fmt$(v.total)+'</div></div>';}).join('')+'</div></div>':'')+'</div>';
  renderInvLines();updateInvFee();
}
function renderInvLines(){var c=document.getElementById('inv-lines');if(!c)return;c.innerHTML='<div class="line-items-header"><span style="flex:3">Description</span><span style="flex:1;text-align:center">Qty</span><span style="flex:1;text-align:center">Rate</span><span style="flex:1;text-align:right">Amount</span><span style="width:32px"></span></div>'+invoiceLineItems.map(function(it,i){return '<div class="line-item-row"><input type="text" style="flex:3" placeholder="Service" value="'+it.description+'" oninput="invoiceLineItems['+i+'].description=this.value"><input type="number" style="flex:1;text-align:center" min="0" step="0.5" value="'+it.qty+'" oninput="invoiceLineItems['+i+'].qty=parseFloat(this.value)||0;updateInvFee()"><input type="number" style="flex:1;text-align:center" min="0" value="'+it.rate+'" oninput="invoiceLineItems['+i+'].rate=parseFloat(this.value)||0;updateInvFee()"><span style="flex:1;text-align:right;color:var(--text-bright);font-weight:600;padding:0.5rem 0">'+fmt$(it.qty*it.rate)+'</span><button class="btn-remove-line" onclick="rmInvLine('+i+')" '+(invoiceLineItems.length<=1?'disabled':'')+'>&times;</button></div>';}).join('');}
function addInvLine(){invoiceLineItems.push({description:'',qty:1,rate:0});renderInvLines();}
function rmInvLine(i){if(invoiceLineItems.length>1){invoiceLineItems.splice(i,1);renderInvLines();}}
function invSub(){return invoiceLineItems.reduce(function(s,i){return s+i.qty*i.rate;},0);}
function updateInvFee(){var sub=invSub(),tx=parseFloat(document.getElementById('inv-tax')&&document.getElementById('inv-tax').value)||0,tot=sub+Math.round(sub*tx/100),m=(document.getElementById('inv-method')&&document.getElementById('inv-method').value)||'cenoa';var rates={cenoa:0.0075,payoneer:0.02,wise:0.012,paypal:0.045},fl={cenoa:0,payoneer:2.5,wise:0,paypal:0},lb={cenoa:'Cenoa',payoneer:'Payoneer',wise:'Wise',paypal:'PayPal'};var fee=Math.round(tot*rates[m])+fl[m],cf=Math.round(tot*rates.cenoa),el=document.getElementById('inv-fee');if(!el||tot<=0){if(el)el.innerHTML='';return;}el.innerHTML=m==='cenoa'?'<span style="color:var(--green)">Cenoa: '+fmt$(cf)+' fee \u2014 Keep '+fmt$(tot-cf)+'</span>':'<span>'+lb[m]+': '+fmt$(fee)+' fee</span> &middot; <span style="color:var(--green)">Cenoa: '+fmt$(cf)+' \u2014 Save '+fmt$(fee-cf)+'</span>';}

function genInvoice(){var from=document.getElementById('inv-from').value||'Freelancer',fe=document.getElementById('inv-from-email').value||'',cl=document.getElementById('inv-client').value||'Client',pr=document.getElementById('inv-project').value||'Project',tx=parseFloat(document.getElementById('inv-tax').value)||0,m=document.getElementById('inv-method').value||'cenoa',ml={cenoa:'Cenoa',payoneer:'Payoneer',wise:'Wise',paypal:'PayPal'}[m];var num='INV-'+new Date().getFullYear()+'-'+String(Math.floor(Math.random()*999)).padStart(3,'0'),dt=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),due=new Date(Date.now()+30*864e5).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});var sub=invSub(),tax=Math.round(sub*tx/100),tot=sub+tax,items=invoiceLineItems.filter(function(i){return i.description||i.rate>0;});
  document.getElementById('inv-preview').innerHTML='<div class="invoice-doc" id="invoice-printable"><div class="inv-header"><div><strong style="font-size:1.4rem;color:var(--text-bright)">INVOICE</strong><br><span style="color:var(--text-dim)">'+num+'</span></div><div style="text-align:right"><span style="color:var(--orange);font-weight:700;font-size:1.1rem">'+from+'</span><br><span style="font-size:0.8rem;color:var(--text-dim)">'+fe+'</span></div></div><div class="inv-body"><div class="inv-details-row"><div><strong>Bill To:</strong><br>'+cl+'</div><div style="text-align:right"><strong>Date:</strong> '+dt+'<br><strong>Due:</strong> '+due+'</div></div><div style="margin-top:1rem"><strong>Project:</strong> '+pr+'</div><div class="inv-line-items" style="margin-top:1rem"><div class="inv-line inv-line-header"><span style="flex:3;font-weight:700;color:var(--text-dim);font-size:0.7rem;text-transform:uppercase">Description</span><span style="flex:1;text-align:center;font-weight:700;color:var(--text-dim);font-size:0.7rem">Qty</span><span style="flex:1;text-align:center;font-weight:700;color:var(--text-dim);font-size:0.7rem">Rate</span><span style="flex:1;text-align:right;font-weight:700;color:var(--text-dim);font-size:0.7rem">Amount</span></div>'+items.map(function(i){return '<div class="inv-line"><span style="flex:3">'+(i.description||'Service')+'</span><span style="flex:1;text-align:center">'+i.qty+'</span><span style="flex:1;text-align:center">'+fmt$(i.rate)+'</span><span style="flex:1;text-align:right">'+fmt$(i.qty*i.rate)+'</span></div>';}).join('')+'<div class="inv-subtotal"><span>Subtotal</span><span>'+fmt$(sub)+'</span></div>'+(tx>0?'<div class="inv-subtotal"><span>Tax ('+tx+'%)</span><span>'+fmt$(tax)+'</span></div>':'')+'<div class="inv-total"><span>Total Due</span><span>'+fmt$(tot)+'</span></div></div><div style="margin-top:1.5rem;font-size:0.8rem;color:var(--text-dim)">Payment: <strong style="color:var(--text)">'+ml+'</strong>'+(m!=='cenoa'?'<br><span style="color:var(--green);font-size:0.75rem">Tip: Cenoa = lowest fees</span>':'')+'</div></div></div>';
  var sv=JSON.parse(localStorage.getItem('cortex_invoices')||'[]');sv.push({number:num,client:cl,project:pr,total:tot,date:dt,from:from,fromEmail:fe,taxPct:tx,method:ml,lineItems:invoiceLineItems.map(function(i){return{description:i.description,qty:i.qty,rate:i.rate};})});localStorage.setItem('cortex_invoices',JSON.stringify(sv));
  window._invText='INVOICE '+num+'\n'+dt+' | Due: '+due+'\nFrom: '+from+'\nTo: '+cl+'\nProject: '+pr+'\n\n'+items.map(function(i){return(i.description||'Service')+' | '+i.qty+' x '+fmt$(i.rate)+' = '+fmt$(i.qty*i.rate);}).join('\n')+'\n\nSubtotal: '+fmt$(sub)+(tx>0?'\nTax: '+fmt$(tax):'')+'\nTOTAL: '+fmt$(tot)+'\nPayment: '+ml;
  toast('Invoice generated!');
}
function copyInvText(){window._invText?navigator.clipboard.writeText(window._invText).then(function(){toast('Copied!');}):toast('Generate first');}
function loadInv(i){var v=JSON.parse(localStorage.getItem('cortex_invoices')||'[]')[i];if(!v)return;document.getElementById('inv-from').value=v.from||'';document.getElementById('inv-from-email').value=v.fromEmail||'';document.getElementById('inv-client').value=v.client||'';document.getElementById('inv-project').value=v.project||'';document.getElementById('inv-tax').value=v.taxPct||0;if(v.lineItems){invoiceLineItems=v.lineItems.map(function(x){return{description:x.description,qty:x.qty,rate:x.rate};});renderInvLines();}toast('Loaded');}

// ── PROPOSAL WRITER ─────────────────────────────────────────────────────
var propVars=[],actVar=0;
function renderProposalTab(r){var c=document.getElementById('proposal-container');if(!isPro()){c.innerHTML=proLockedHTML('Proposal Writer');c.parentElement.classList.add('is-locked');return;}c.parentElement.classList.remove('is-locked');c.innerHTML='<div class="proposal-form"><div class="form-field"><label>Job Title</label><input type="text" id="prop-title" placeholder="e.g. Full-Stack Web App" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.7rem 0.9rem;color:var(--text-bright);font-family:inherit;font-size:0.9rem;outline:none"></div><div class="form-field"><label>Job Description</label><textarea id="prop-desc" rows="4" placeholder="Paste for keyword matching..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.7rem 0.9rem;color:var(--text-bright);font-family:inherit;font-size:0.9rem;resize:vertical;outline:none"></textarea></div><div class="form-row"><div class="form-field"><label>Tone</label><select id="prop-tone"><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="technical">Technical</option></select></div><div class="form-field"><label>Length</label><select id="prop-length"><option value="short">Short</option><option value="standard" selected>Standard</option><option value="detailed">Detailed</option></select></div></div><div class="form-row" style="gap:0.5rem"><button class="btn-analyze-manual" onclick="genProp()" style="flex:1">Generate 3 Variants</button><button class="btn-secondary" onclick="genProp()">Regenerate</button></div></div><div id="prop-preview" class="prop-preview"></div><div id="prop-saved"></div>';renderSavedProps();}

function extractKW(t){var stop='the a an is are was were be been have has had do does did will would could should may might can to of in for on with at by from as into through during before after above below between out off over under again then once here there when where why how all both each few more most other some such no nor not only own same so than too very just because but and or if while that this these those it its we our you your they their he she his her i my me what which who'.split(' '),st={};stop.forEach(function(w){st[w]=1;});var words=t.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(w){return w.length>2&&!st[w];});var freq={};words.forEach(function(w){freq[w]=(freq[w]||0)+1;});return Object.entries(freq).sort(function(a,b){return b[1]-a[1];}).slice(0,8).map(function(e){return e[0];});}

function genProp(){
  var title=document.getElementById('prop-title').value.trim()||'the project',desc=document.getElementById('prop-desc').value.trim()||'',tone=document.getElementById('prop-tone').value,len=document.getElementById('prop-length').value,r=analysisResult,name=currentUser?currentUser.name:'an experienced freelancer';
  var kw=extractKW(desc||title),ks=kw.length?kw.slice(0,4).join(', '):r.skillLabel;
  var G={professional:['Dear Hiring Manager,','Dear Client,','Hello,'],friendly:['Hi there!','Hey!','Hello!'],technical:['Hello,','Greetings,','Hi,']};
  var H={professional:['"'+title+'" aligns with my '+ks+' expertise.','Delivered similar '+ks+' solutions.','Specific '+ks+' experience for your needs.'],friendly:['"'+title+'" is exactly my thing!',ks+' for '+r.exp+' years!',r.exp+' years mastering '+ks+'.'],technical:['Reviewed "'+title+'" \u2014 confirmed '+ks+' proficiency.','Stack aligns with my '+ks+'.','Analyzed '+ks+' requirements.']};
  var B={short:[r.exp+'yr '+r.skillLabel+', '+ks+'. '+fmt$(r.rate)+'/hr.',r.exp+'+ years, 50+ projects.',ks+' background.'],standard:['Why me:\n\n\u2022 '+r.exp+'+ years '+r.skillLabel+'\n\u2022 '+ks+' hands-on\n\u2022 98% satisfaction\n\u2022 On-time guaranteed','Qualifications:\n\n\u2022 '+r.exp+'yr experience\n\u2022 Deep '+ks+'\n\u2022 50+ projects\n\u2022 '+fmt$(r.rate)+'/hr','Strengths:\n\n\u2022 '+r.exp+'+ years\n\u2022 '+ks+' specialist\n\u2022 Strong portfolio\n\u2022 24hr response'],detailed:['Fit:\n\n\u2022 '+r.exp+'+ years '+r.skillLabel+'\n\u2022 '+ks+' expert\n\u2022 98% satisfaction\n\u2022 '+fmt$(r.rate)+'/hr\n\nApproach:\n1. Requirements deep-dive\n2. Iterative check-ins\n3. QA at every stage\n4. Post-delivery support','Experience:\n\n\u2022 '+r.exp+'yr '+r.skillLabel+'\n\u2022 '+ks+' mastery\n\u2022 50+ projects\n\nProcess:\n1. Analysis\n2. Milestones\n3. Updates\n4. Testing\n5. 30-day support','Background:\n\n\u2022 '+r.exp+'+ years\n\u2022 '+ks+' in 50+ projects\n\u2022 98% on-time\n\nProcess:\n1. Discovery\n2. Plan\n3. Feedback cycles\n4. Testing\n5. Handoff + docs']};
  var C={professional:['Quick call?','When works?','Ready to begin.'],friendly:['Hop on a call?','Let\'s go!','Message me!'],technical:['Begin in 24hr.','15-min tech call?','Available now.']};
  var CL={professional:'Best regards,',friendly:'Looking forward!',technical:'Regards,'};
  propVars=[];
  for(var v=0;v<3;v++){var txt=G[tone][v]+'\n\n'+H[tone][v]+'\n\n'+B[len][v]+'\n\n'+C[tone][v]+'\n\n'+CL[tone]+'\n'+name;var sc=6+(kw.length>3?1:0)+(len==='detailed'?1:0)+(desc.length>100?1:0);sc=clamp(Math.round((sc+(v===0?0.5:v===1?0:-0.5))*10)/10,5,10);propVars.push({text:txt,score:sc,label:String.fromCharCode(65+v)});}
  actVar=0;renderPropPreview();
}

function renderPropPreview(){if(!propVars.length)return;var p=document.getElementById('prop-preview'),cur=propVars[actVar];p.innerHTML='<div class="variant-tabs">'+propVars.map(function(v,i){return '<button class="variant-tab '+(i===actVar?'active':'')+'" onclick="actVar='+i+';renderPropPreview()">Variant '+v.label+' <span class="variant-score">'+v.score+'/10</span></button>';}).join('')+'</div><div class="proposal-doc"><div class="proposal-score-badge">Score: '+cur.score+'/10</div><pre style="white-space:pre-wrap;font-family:inherit;color:var(--text);line-height:1.6;font-size:0.85rem">'+cur.text+'</pre><div class="proposal-actions"><button class="btn-sm" onclick="navigator.clipboard.writeText(propVars[actVar].text).then(function(){toast(\'Copied!\');})" style="padding:0.5rem 1rem">Copy</button><button class="btn-sm" onclick="saveProp()" style="padding:0.5rem 1rem;background:var(--green)">Save</button></div></div>';}
function saveProp(){if(!propVars.length)return;var s=JSON.parse(localStorage.getItem('cortex_proposals')||'[]');s.push({title:document.getElementById('prop-title').value||'Untitled',variant:propVars[actVar].label,score:propVars[actVar].score,text:propVars[actVar].text,date:new Date().toLocaleDateString()});localStorage.setItem('cortex_proposals',JSON.stringify(s));toast('Saved!');renderSavedProps();}
function renderSavedProps(){var el=document.getElementById('prop-saved');if(!el)return;var s=JSON.parse(localStorage.getItem('cortex_proposals')||'[]');if(!s.length){el.innerHTML='';return;}el.innerHTML='<div style="margin-top:1.5rem"><h3 style="color:var(--text-bright);font-size:0.95rem;margin-bottom:0.75rem">Saved Proposals</h3>'+s.slice(-8).reverse().map(function(p,i){return '<div class="saved-proposal-item" onclick="loadProp('+(s.length-1-i)+')"><div><strong>'+p.title+'</strong> ('+p.variant+') \u2014 '+p.score+'/10</div><div style="font-size:0.75rem;color:var(--text-dim)">'+p.date+'</div></div>';}).join('')+'</div>';}
function loadProp(i){var s=JSON.parse(localStorage.getItem('cortex_proposals')||'[]')[i];if(!s)return;propVars=[{text:s.text,score:s.score,label:s.variant}];actVar=0;renderPropPreview();toast('Loaded');}

// ── TEMPLATES ───────────────────────────────────────────────────────────
var tmplSearch='',tmplCat='all';
function renderTemplatesTab(){var c=document.getElementById('templates-container');if(!isPro()){c.innerHTML=proLockedHTML('78+ Templates');c.parentElement.classList.add('is-locked');return;}c.parentElement.classList.remove('is-locked');c.innerHTML='<div class="templates-toolbar"><input type="text" id="template-search" class="template-search" placeholder="Search templates..." oninput="filterTmpl()" value="'+tmplSearch+'"><div class="template-category-pills"><button class="cat-pill '+(tmplCat==='all'?'active':'')+'" onclick="tmplCat=\'all\';filterTmpl()">All</button>'+Object.entries(TEMPLATE_CATEGORIES).map(function(e){return '<button class="cat-pill '+(tmplCat===e[0]?'active':'')+'" onclick="tmplCat=\''+e[0]+'\';filterTmpl()">'+e[1]+'</button>';}).join('')+'</div></div><div class="templates-grid" id="templates-grid"></div><p style="text-align:center;color:var(--text-dim);font-size:0.8rem;margin-top:1rem">Showing <span id="tmpl-cnt">'+TEMPLATE_LIBRARY.length+'</span> of 78+ templates</p>';filterTmpl();}
function filterTmpl(){tmplSearch=document.getElementById('template-search')?document.getElementById('template-search').value:'';var q=tmplSearch.toLowerCase(),g=document.getElementById('templates-grid');if(!g)return;var f=TEMPLATE_LIBRARY.filter(function(t){return(tmplCat==='all'||t.category===tmplCat)&&(!q||t.title.toLowerCase().indexOf(q)>=0||t.content.toLowerCase().indexOf(q)>=0);});g.innerHTML=f.map(function(t){return '<div class="template-card" onclick="openTmpl('+t.id+')"><div class="template-card-cat">'+TEMPLATE_CATEGORIES[t.category]+'</div><div class="template-icon">\u{1F4C4}</div><div class="template-name">'+t.title+'</div><div class="template-preview">'+t.content.substring(0,80).replace(/\n/g,' ')+'...</div></div>';}).join('');var cnt=document.getElementById('tmpl-cnt');if(cnt)cnt.textContent=f.length;}
function openTmpl(id){var t=TEMPLATE_LIBRARY.find(function(x){return x.id===id;});if(!t)return;document.getElementById('template-modal-title').textContent=t.title;document.getElementById('template-modal-category').textContent=TEMPLATE_CATEGORIES[t.category];document.getElementById('template-modal-content').textContent=t.content;window._tmplContent=t.content;document.getElementById('template-modal').classList.add('show');}
function closeTemplateModal(e){if(!e||e.target===e.currentTarget)document.getElementById('template-modal').classList.remove('show');}
function copyTemplateContent(){if(window._tmplContent)navigator.clipboard.writeText(window._tmplContent).then(function(){toast('Copied!');});}

// ── RATE CALCULATOR ─────────────────────────────────────────────────────
function renderRateCalcTab(r){var c=document.getElementById('ratecalc-container');c.innerHTML='<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding:0.5rem 0.75rem;background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.15);border-radius:var(--radius-sm)"><span style="font-size:1.2rem">&#128176;</span><span style="font-size:0.8rem;color:var(--text-dim)">Powered by <strong style="color:var(--green)">Cenoa</strong> &mdash; the best way to get paid from anywhere. <a href="https://cenoa.com" target="_blank" style="color:var(--green)">Learn more &rarr;</a></span></div><div class="ratecalc-form"><div class="form-row"><div class="form-field"><label>Skill</label><select id="rc-skill" onchange="updRC()">'+Object.entries(SKILL_LABELS).map(function(e){return '<option value="'+e[0]+'" '+(e[0]===r.skill?'selected':'')+'>'+e[1]+'</option>';}).join('')+'</select></div><div class="form-field"><label>Country</label><select id="rc-country" onchange="updRC()">'+Object.entries(COUNTRY_LABELS).map(function(e){return '<option value="'+e[0]+'" '+(e[0]===r.country?'selected':'')+'>'+e[1]+'</option>';}).join('')+'</select></div></div><div class="form-row"><div class="form-field"><label>Your Rate ($/hr)</label><input type="number" id="rc-rate" value="'+r.rate+'" min="1" max="500" oninput="updRC()"></div><div class="form-field"><label>Experience (yrs)</label><input type="number" id="rc-exp" value="'+r.exp+'" min="0" max="40" oninput="updRC()"></div></div></div><div id="rc-results"></div>';updRC();}

function updRC(){
  var sk=document.getElementById('rc-skill').value,co=document.getElementById('rc-country').value,rate=parseFloat(document.getElementById('rc-rate').value)||0,exp=parseInt(document.getElementById('rc-exp').value)||0;
  var bm=BENCHMARKS[sk]&&BENCHMARKS[sk][co]||30,p25=Math.round(bm*0.6),p50=bm,p75=Math.round(bm*1.35),p90=Math.round(bm*1.8),mx=Math.round(bm*2.2);
  var pc;if(rate<=p25)pc=Math.round((rate/p25)*25);else if(rate<=p50)pc=25+Math.round(((rate-p25)/(p50-p25))*25);else if(rate<=p75)pc=50+Math.round(((rate-p50)/(p75-p50))*25);else if(rate<=p90)pc=75+Math.round(((rate-p75)/(p90-p75))*15);else pc=Math.min(99,90+Math.round(((rate-p90)/(mx-p90))*10));pc=clamp(pc,1,99);
  var rec=exp<=2?Math.round(p50*0.85):exp<=5?p50:exp<=8?Math.round((p50+p75)/2):p75;
  var rt=Math.max(rate+5,rec),imp=(rt-rate)*160*12,pos=clamp((rate/mx)*100,2,98);
  var adv;if(rate<p25)adv='Significantly below market. Raise to '+fmt$(p25)+'/hr+.';else if(rate<p50)adv='Below median. Consider '+fmt$(p50)+'/hr.';else if(rate<p75)adv='Competitive. With '+exp+'yr, justify '+fmt$(rec)+'/hr.';else if(rate<p90)adv='Top quartile! Specialize for top 10%.';else adv='Top 10%! Maintain premium positioning.';

  document.getElementById('rc-results').innerHTML='<div class="rc-section"><h3>'+SKILL_LABELS[sk]+' in '+COUNTRY_LABELS[co]+'</h3><div class="percentile-bar-wrap"><div class="percentile-bar"><div class="percentile-zone zone-25" style="width:'+(p25/mx*100)+'%"></div><div class="percentile-zone zone-50" style="left:'+(p25/mx*100)+'%;width:'+((p50-p25)/mx*100)+'%"></div><div class="percentile-zone zone-75" style="left:'+(p50/mx*100)+'%;width:'+((p75-p50)/mx*100)+'%"></div><div class="percentile-zone zone-90" style="left:'+(p75/mx*100)+'%;width:'+((p90-p75)/mx*100)+'%"></div><div class="percentile-zone zone-top" style="left:'+(p90/mx*100)+'%;width:'+((mx-p90)/mx*100)+'%"></div><div class="percentile-marker" style="left:'+pos+'%"><div class="marker-label">You: '+fmt$(rate)+'/hr<br><strong>'+pc+'th pctl</strong></div><div class="marker-line"></div></div></div><div class="percentile-labels"><span style="left:'+(p25/mx*100)+'%">25th<br>'+fmt$(p25)+'</span><span style="left:'+(p50/mx*100)+'%">50th<br>'+fmt$(p50)+'</span><span style="left:'+(p75/mx*100)+'%">75th<br>'+fmt$(p75)+'</span><span style="left:'+(p90/mx*100)+'%">90th<br>'+fmt$(p90)+'</span></div></div><div class="rc-recommendation"><strong>Recommendation:</strong> '+adv+'</div><div class="rc-revenue-impact"><div class="rc-impact-card"><div class="rc-impact-label">Raise to '+fmt$(rt)+'/hr</div><div class="rc-impact-value">+'+fmt$(imp)+'/yr</div><div class="rc-impact-detail">160 hrs/mo</div></div><div class="rc-impact-card"><div class="rc-impact-label">Current Annual</div><div class="rc-impact-value">'+fmt$(rate*160*12)+'</div><div class="rc-impact-detail">'+fmt$(rate)+'/hr</div></div><div class="rc-impact-card"><div class="rc-impact-label">Potential</div><div class="rc-impact-value" style="color:var(--green)">'+fmt$(rt*160*12)+'</div><div class="rc-impact-detail">'+fmt$(rt)+'/hr</div></div></div></div><div class="rc-section" style="margin-top:1.5rem"><h3>Country Comparison</h3><table class="rate-table"><thead><tr><th>Country</th><th>Avg Rate</th><th>Monthly</th><th>vs You</th></tr></thead><tbody>'+Object.keys(BENCHMARKS[sk]||{}).map(function(cc){var b=BENCHMARKS[sk][cc],d=Math.round(((rate-b)/b)*100);return '<tr'+(cc===co?' style="background:rgba(0,255,136,0.05)"':'')+'><td>'+COUNTRY_LABELS[cc]+(cc===co?' (You)':'')+'</td><td>'+fmt$(b)+'/hr</td><td>'+fmt$(b*160)+'/mo</td><td style="color:'+(d>=0?'var(--green)':'var(--red)')+'">'+(d>=0?'+':'')+d+'%</td></tr>';}).join('')+'</tbody></table></div>';
}

// ── SHARE SCORE CARD ─────────────────────────────────────────────────────
function renderShareScoreCard(r){
  var bar=document.getElementById('share-bar');
  bar.innerHTML='<div class="share-score-section"><canvas id="score-canvas" width="1080" height="1080" style="width:100%;max-width:400px;border-radius:var(--radius);border:1px solid var(--border)"></canvas><div class="share-actions"><h3>Share Your Score</h3><div class="share-btns"><button class="btn-share download" onclick="downloadScoreCard()">&#128229; Download PNG</button><button class="btn-share copy" onclick="copyShareLink()">&#128203; Copy Link</button><button class="btn-share twitter" onclick="shareTwitter()">&#120143; Share on Twitter</button></div></div></div>';
  drawScoreCard(r);
}

function drawScoreCard(r){
  var canvas=document.getElementById('score-canvas');if(!canvas)return;
  var ctx=canvas.getContext('2d'),W=1080,H=1080;

  // Background
  var bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#0a0a0a');bg.addColorStop(1,'#111111');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  // Subtle radial glow top-right
  var glow=ctx.createRadialGradient(W*0.8,H*0.15,0,W*0.8,H*0.15,400);
  glow.addColorStop(0,'rgba(0,255,136,0.06)');glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

  // Border
  ctx.strokeStyle='#222';ctx.lineWidth=3;
  roundRect(ctx,20,20,W-40,H-40,24);ctx.stroke();

  // Brand top-left
  ctx.fillStyle='#ff8844';ctx.font='bold 28px Inter, sans-serif';
  ctx.fillText('CORTEX FREELANCER',80,100);

  // Badge top-right
  ctx.fillStyle='#444';ctx.font='22px Inter, sans-serif';
  ctx.textAlign='right';ctx.fillText('Freelancer Score',W-80,100);ctx.textAlign='left';

  // Score ring center
  var cx=W/2,cy=340,rad=140;
  ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.strokeStyle='#222';ctx.lineWidth=20;ctx.stroke();
  var scoreAngle=(r.totalScore/10)*Math.PI*2;
  var grad=ctx.createLinearGradient(cx-rad,cy,cx+rad,cy);
  grad.addColorStop(0,'#ff8844');grad.addColorStop(1,'#00ff88');
  ctx.beginPath();ctx.arc(cx,cy,rad,-Math.PI/2,-Math.PI/2+scoreAngle);ctx.strokeStyle=grad;ctx.lineWidth=20;ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt';

  // Score number
  ctx.fillStyle='#ffffff';ctx.font='bold 96px Inter, sans-serif';ctx.textAlign='center';
  ctx.fillText(r.totalScore.toFixed(1),cx,cy+20);
  ctx.fillStyle='#888';ctx.font='36px Inter, sans-serif';
  ctx.fillText('/10',cx,cy+65);

  // Top skills section
  var topY=540;
  ctx.fillStyle='#00ff88';ctx.font='bold 26px Inter, sans-serif';ctx.textAlign='left';
  ctx.fillText('TOP SKILLS',80,topY);

  var skills=[
    {l:'Headline',v:r.headline},
    {l:'Overview',v:r.overview},
    {l:'Skills',v:r.skillsScore},
    {l:'Portfolio',v:r.portfolio},
    {l:'Rate',v:r.rateScore}
  ];
  skills.forEach(function(s,i){
    var sy=topY+50+i*60;
    ctx.fillStyle='#e0e0e0';ctx.font='24px Inter, sans-serif';ctx.textAlign='left';
    ctx.fillText(s.l,80,sy);
    // Bar background
    ctx.fillStyle='#1a1a1a';roundRect(ctx,280,sy-16,560,22,6);ctx.fill();
    // Bar fill
    var bw=560*(s.v/10);
    var barGrad=ctx.createLinearGradient(280,0,280+bw,0);
    barGrad.addColorStop(0,'#ff8844');barGrad.addColorStop(1,'#00ff88');
    ctx.fillStyle=barGrad;roundRect(ctx,280,sy-16,bw,22,6);ctx.fill();
    // Value
    ctx.fillStyle='#ffffff';ctx.font='bold 24px Inter, sans-serif';ctx.textAlign='right';
    ctx.fillText(s.v+'/10',W-80,sy);
  });

  // Divider
  ctx.strokeStyle='#222';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(80,topY+360);ctx.lineTo(W-80,topY+360);ctx.stroke();

  // Bottom stats
  var bY=topY+420;
  ctx.textAlign='center';

  // Skill
  ctx.fillStyle='#888';ctx.font='22px Inter, sans-serif';
  ctx.fillText('SKILL',W*0.2,bY);
  ctx.fillStyle='#fff';ctx.font='bold 28px Inter, sans-serif';
  ctx.fillText(r.skillLabel,W*0.2,bY+40);

  // Recommended Rate
  ctx.fillStyle='#888';ctx.font='22px Inter, sans-serif';
  ctx.fillText('RECOMMENDED RATE',W*0.5,bY);
  ctx.fillStyle='#00ff88';ctx.font='bold 28px Inter, sans-serif';
  ctx.fillText(fmt$(r.benchmark)+'/hr',W*0.5,bY+40);

  // Country
  ctx.fillStyle='#888';ctx.font='22px Inter, sans-serif';
  ctx.fillText('REGION',W*0.8,bY);
  ctx.fillStyle='#fff';ctx.font='bold 28px Inter, sans-serif';
  ctx.fillText(r.countryLabel,W*0.8,bY+40);

  // Branding bar at bottom
  ctx.fillStyle='#0f0f0f';ctx.fillRect(0,H-80,W,80);
  ctx.fillStyle='#ff8844';ctx.font='bold 24px Inter, sans-serif';ctx.textAlign='left';
  ctx.fillText('cortexfreelancer.com',80,H-32);
  ctx.fillStyle='#444';ctx.font='22px Inter, sans-serif';ctx.textAlign='right';
  ctx.fillText('Get your free score',W-80,H-32);
  ctx.textAlign='left';
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

function downloadScoreCard(){
  var canvas=document.getElementById('score-canvas');if(!canvas)return;
  canvas.toBlob(function(blob){
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='cortex-freelancer-score.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);toast('Score card downloaded!');
  },'image/png');
}

// ── Onboarding ──────────────────────────────────────────────────────────
var obData={role:'',level:'',challenge:''};

function obSelectPill(el){
  el.parentElement.querySelectorAll('.ob-pill').forEach(function(p){p.classList.remove('selected');});
  el.classList.add('selected');
}

function obGoStep(n){
  document.querySelectorAll('.onboarding-step').forEach(function(s){s.classList.remove('active');});
  document.getElementById('ob-step-'+n).classList.add('active');
  var pct=n===4?100:Math.round((n/3)*100);
  document.getElementById('onboarding-bar').style.width=pct+'%';
}

function obNext(step){
  if(step===1){
    var v=document.getElementById('ob-role').value;
    if(!v){toast('Please select your role');return;}
    obData.role=v;
    obGoStep(2);
  }else if(step===2){
    var sel=document.querySelector('#ob-level-pills .ob-pill.selected');
    if(!sel){toast('Please select your level');return;}
    obData.level=sel.getAttribute('data-val');
    obGoStep(3);
  }
}

function obBack(step){obGoStep(step-1);}

function obFinish(){
  var sel=document.querySelector('#ob-challenge-pills .ob-pill.selected');
  if(!sel){toast('Please select a challenge');return;}
  obData.challenge=sel.getAttribute('data-val');
  localStorage.setItem('onboarded',JSON.stringify(obData));
  renderObRecommendations();
  obGoStep(4);
}

function renderObRecommendations(){
  var TOOLS={
    rate_calc:{icon:'\uD83D\uDCC8',name:'Rate Calculator',desc:'Find your optimal hourly rate based on market data.'},
    fee_calc:{icon:'\uD83D\uDCB0',name:'Fee Calculator',desc:'Compare payment platform fees and save money.'},
    proposal:{icon:'\u270D\uFE0F',name:'Proposal Writer',desc:'Generate winning proposals with AI.'},
    contract:{icon:'\uD83D\uDCDD',name:'Contract Reviewer',desc:'Review contracts for red flags and missing clauses.'},
    scope:{icon:'\uD83D\uDCD0',name:'Scope Analyzer',desc:'Break down projects into clear milestones.'},
    invoice:{icon:'\uD83E\uDDFE',name:'Invoice Generator',desc:'Create and track professional invoices.'},
    jobs:{icon:'\uD83D\uDCBC',name:'Job Matches',desc:'AI-matched jobs tailored to your skills.'},
    ad_gen:{icon:'\uD83D\uDCE3',name:'Ad Generator',desc:'Create ads to promote your freelance services.'}
  };

  var recs=[];
  if(obData.challenge==='clients') recs.push('jobs','proposal','ad_gen');
  else if(obData.challenge==='pricing') recs.push('rate_calc','fee_calc','scope');
  else if(obData.challenge==='invoicing') recs.push('invoice','fee_calc','contract');
  else if(obData.challenge==='time') recs.push('scope','contract','proposal');

  if(obData.role==='writing'||obData.role==='marketing') recs.push('ad_gen');
  if(obData.role==='webdev'||obData.role==='design') recs.push('scope');

  var seen={},unique=[];
  recs.forEach(function(r){if(!seen[r]){seen[r]=true;unique.push(r);}});
  unique=unique.slice(0,3);

  var html=unique.map(function(key){
    var t=TOOLS[key];
    return '<div class="ob-rec-card"><div class="ob-rec-icon">'+t.icon+'</div><div class="ob-rec-info"><div class="ob-rec-name">'+t.name+'</div><div class="ob-rec-desc">'+t.desc+'</div></div></div>';
  }).join('');
  document.getElementById('ob-recommendations').innerHTML=html;
}

function obDismiss(){
  document.getElementById('onboarding-overlay').classList.remove('show');
}

function showOnboarding(){
  if(!localStorage.getItem('onboarded')){
    document.getElementById('onboarding-overlay').classList.add('show');
  }
}

// ── Init ────────────────────────────────────────────────────────────────
(function(){
  var s=localStorage.getItem('cortex_user');if(s)try{currentUser=JSON.parse(s);}catch(e){}
  if(new URLSearchParams(window.location.search).get('pro')==='true')setPro();
  if(currentUser&&currentUser.email)syncProStatus();
  document.getElementById('upwork-url').addEventListener('keydown',function(e){if(e.key==='Enter')analyzeFromURL();});
  // Show/hide header upgrade button
  var hBtn=document.getElementById('header-upgrade-btn');
  if(hBtn&&!isPro())hBtn.style.display='inline-flex';
  // Show onboarding for first-time visitors
  showOnboarding();
})();
