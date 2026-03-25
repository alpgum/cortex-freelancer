#!/usr/bin/env python3
"""
Portfolio Site Generator (CFX-059b)

Generates a complete, responsive portfolio HTML site from project data:
- Professional dark-themed design
- Project showcase with categories
- Skills visualization
- Testimonials section
- Contact form
- SEO-optimized meta tags

Usage:
    python portfolio_site_generator.py generate --name "Jane Dev" --title "Full-Stack Developer"
    python portfolio_site_generator.py generate --config portfolio.json --output my_portfolio.html
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# ---------------------------------------------------------------------------
# Sample Portfolio Data
# ---------------------------------------------------------------------------

SAMPLE_DATA = {
    "name": "Alex Morgan",
    "title": "Full-Stack Developer & Designer",
    "tagline": "I build beautiful, performant web experiences that drive results.",
    "bio": "With 5+ years of freelance experience, I've helped startups and established businesses build products their users love. I specialize in React, Node.js, and design systems.",
    "email": "hello@alexmorgan.dev",
    "location": "Remote (UTC+3)",
    "availability": "Available for new projects",
    "photo_url": "",
    "social": {
        "github": "https://github.com/alexmorgan",
        "linkedin": "https://linkedin.com/in/alexmorgan",
        "twitter": "https://twitter.com/alexmorgan",
    },
    "skills": [
        {"name": "React / Next.js", "level": 95},
        {"name": "Node.js / Express", "level": 90},
        {"name": "TypeScript", "level": 88},
        {"name": "PostgreSQL / MongoDB", "level": 85},
        {"name": "UI/UX Design", "level": 80},
        {"name": "DevOps / CI/CD", "level": 75},
        {"name": "Python / Django", "level": 72},
        {"name": "React Native", "level": 70},
    ],
    "projects": [
        {
            "title": "E-Commerce Platform",
            "client": "RetailFlow",
            "category": "Web Development",
            "description": "Built a complete e-commerce platform handling 10K+ daily transactions with real-time inventory management.",
            "tech": ["Next.js", "Stripe", "PostgreSQL", "Redis"],
            "result": "40% increase in conversion rate",
            "image_url": "",
            "link": "#",
        },
        {
            "title": "SaaS Dashboard",
            "client": "DataPulse",
            "category": "Web App",
            "description": "Designed and developed an analytics dashboard with real-time data visualization and team collaboration features.",
            "tech": ["React", "D3.js", "Node.js", "WebSocket"],
            "result": "Reduced report generation time by 70%",
            "image_url": "",
            "link": "#",
        },
        {
            "title": "Mobile Banking App",
            "client": "FinTech Startup",
            "category": "Mobile",
            "description": "React Native mobile app with biometric auth, real-time transactions, and P2P payments.",
            "tech": ["React Native", "Firebase", "Plaid API"],
            "result": "50K+ downloads in first month",
            "image_url": "",
            "link": "#",
        },
        {
            "title": "Brand Identity System",
            "client": "CreativeStudio",
            "category": "Design",
            "description": "Complete brand identity including logo, design system, and marketing materials.",
            "tech": ["Figma", "Illustrator", "After Effects"],
            "result": "Brand recognition increased 3x",
            "image_url": "",
            "link": "#",
        },
    ],
    "testimonials": [
        {
            "text": "Alex delivered beyond our expectations. The platform handles our scale beautifully and the code quality is exceptional.",
            "author": "Sarah Chen",
            "role": "CTO, RetailFlow",
        },
        {
            "text": "Working with Alex was a pleasure. They understood our vision immediately and turned it into a product our users love.",
            "author": "Marcus Johnson",
            "role": "Founder, DataPulse",
        },
        {
            "text": "Professional, responsive, and incredibly talented. Our app launch was a huge success thanks to Alex.",
            "author": "Priya Patel",
            "role": "Product Lead, FinTech Startup",
        },
    ],
    "stats": {
        "projects_completed": "50+",
        "happy_clients": "30+",
        "years_experience": "5+",
        "countries": "12",
    },
}


def generate_portfolio(data: Dict) -> str:
    """Generate complete portfolio HTML."""
    name = data.get("name", "Your Name")
    title = data.get("title", "Freelancer")
    tagline = data.get("tagline", "")
    bio = data.get("bio", "")
    email = data.get("email", "")
    skills = data.get("skills", [])
    projects = data.get("projects", [])
    testimonials = data.get("testimonials", [])
    stats = data.get("stats", {})
    social = data.get("social", {})

    # Build project cards
    project_cards = ""
    for p in projects:
        tech_tags = "".join(f'<span class="tag">{t}</span>' for t in p.get("tech", []))
        project_cards += f"""
        <div class="project-card" data-category="{p.get('category', 'All')}">
          <div class="project-img" style="background:linear-gradient(135deg,var(--accent),var(--accent2))">
            <span class="project-category">{p.get('category', '')}</span>
          </div>
          <div class="project-info">
            <h3>{p['title']}</h3>
            <p class="project-client">{p.get('client', '')}</p>
            <p>{p.get('description', '')}</p>
            <div class="tags">{tech_tags}</div>
            <p class="project-result">📈 {p.get('result', '')}</p>
          </div>
        </div>"""

    # Build skills bars
    skill_bars = ""
    for s in skills:
        skill_bars += f"""
        <div class="skill">
          <div class="skill-header">
            <span>{s['name']}</span><span>{s['level']}%</span>
          </div>
          <div class="skill-bar"><div class="skill-fill" style="width:{s['level']}%"></div></div>
        </div>"""

    # Build testimonials
    testimonial_cards = ""
    for t in testimonials:
        testimonial_cards += f"""
        <div class="testimonial">
          <p class="quote">"{t['text']}"</p>
          <div class="testimonial-author">
            <strong>{t['author']}</strong>
            <span>{t.get('role', '')}</span>
          </div>
        </div>"""

    # Build stats
    stat_items = ""
    stat_labels = {"projects_completed": "Projects", "happy_clients": "Clients", "years_experience": "Years", "countries": "Countries"}
    for key, label in stat_labels.items():
        val = stats.get(key, "—")
        stat_items += f'<div class="stat"><div class="stat-value">{val}</div><div class="stat-label">{label}</div></div>'

    # Social links
    social_links = ""
    social_icons = {"github": "GH", "linkedin": "LI", "twitter": "TW", "dribbble": "DR"}
    for platform, url in social.items():
        icon = social_icons.get(platform, platform[:2].upper())
        social_links += f'<a href="{url}" class="social-link" target="_blank">{icon}</a>'

    # Categories for filter
    categories = list(set(p.get("category", "All") for p in projects))
    cat_buttons = '<button class="filter-btn active" data-filter="all">All</button>'
    for c in categories:
        cat_buttons += f'<button class="filter-btn" data-filter="{c}">{c}</button>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name} — {title}</title>
<meta name="description" content="{tagline}">
<meta property="og:title" content="{name} — {title}">
<meta property="og:description" content="{tagline}">
<meta property="og:type" content="website">
<style>
:root {{
  --bg: #0a0a0f; --card: #12121a; --border: #1e1e2e;
  --text: #e8e8ed; --muted: #8888aa; --accent: #6c5ce7; --accent2: #a29bfe;
  --green: #00b894; --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html {{ scroll-behavior:smooth; }}
body {{ font-family:var(--font); background:var(--bg); color:var(--text); line-height:1.6; }}
a {{ color:var(--accent2); text-decoration:none; }}
a:hover {{ color:var(--accent); }}
.container {{ max-width:1100px; margin:0 auto; padding:0 24px; }}

/* Hero */
.hero {{ min-height:90vh; display:flex; align-items:center; position:relative; overflow:hidden; }}
.hero::before {{ content:''; position:absolute; inset:0;
  background:radial-gradient(ellipse at 30% 50%, rgba(108,92,231,0.15), transparent 60%),
             radial-gradient(ellipse at 70% 80%, rgba(162,155,254,0.1), transparent 50%); }}
.hero-content {{ position:relative; z-index:1; }}
.hero h1 {{ font-size:clamp(36px,6vw,64px); font-weight:800; line-height:1.1; margin-bottom:16px; }}
.hero h1 .accent {{ color:var(--accent2); }}
.hero .subtitle {{ font-size:clamp(18px,2.5vw,24px); color:var(--muted); max-width:600px; margin-bottom:32px; }}
.hero .cta {{ display:inline-flex; gap:12px; }}
.btn {{ padding:12px 28px; border-radius:8px; font-size:16px; font-weight:600; border:none; cursor:pointer; transition:all 0.2s; }}
.btn-primary {{ background:var(--accent); color:white; }}
.btn-primary:hover {{ background:var(--accent2); transform:translateY(-2px); }}
.btn-outline {{ background:transparent; color:var(--text); border:1px solid var(--border); }}
.btn-outline:hover {{ border-color:var(--accent); color:var(--accent2); }}

/* Stats */
.stats {{ display:grid; grid-template-columns:repeat(4,1fr); gap:24px; padding:60px 0; text-align:center; }}
.stat-value {{ font-size:36px; font-weight:800; color:var(--accent2); }}
.stat-label {{ font-size:14px; color:var(--muted); margin-top:4px; }}

/* Section */
section {{ padding:80px 0; }}
.section-title {{ font-size:32px; font-weight:700; margin-bottom:12px; }}
.section-sub {{ color:var(--muted); margin-bottom:40px; max-width:500px; }}

/* Projects */
.filter-bar {{ display:flex; gap:8px; margin-bottom:32px; flex-wrap:wrap; }}
.filter-btn {{ padding:8px 20px; border-radius:20px; border:1px solid var(--border); background:transparent;
  color:var(--muted); cursor:pointer; font-size:14px; transition:all 0.2s; }}
.filter-btn.active,.filter-btn:hover {{ background:var(--accent); color:white; border-color:var(--accent); }}
.projects-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:24px; }}
.project-card {{ background:var(--card); border:1px solid var(--border); border-radius:16px; overflow:hidden;
  transition:transform 0.2s, box-shadow 0.2s; }}
.project-card:hover {{ transform:translateY(-4px); box-shadow:0 12px 40px rgba(108,92,231,0.15); }}
.project-img {{ height:180px; display:flex; align-items:flex-end; padding:16px; position:relative; }}
.project-category {{ background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:12px; font-size:12px; backdrop-filter:blur(4px); }}
.project-info {{ padding:20px; }}
.project-info h3 {{ font-size:20px; margin-bottom:4px; }}
.project-client {{ color:var(--muted); font-size:14px; margin-bottom:8px; }}
.tags {{ display:flex; flex-wrap:wrap; gap:6px; margin:12px 0; }}
.tag {{ padding:4px 10px; background:rgba(108,92,231,0.15); color:var(--accent2); border-radius:6px; font-size:12px; }}
.project-result {{ color:var(--green); font-size:14px; font-weight:600; }}

/* Skills */
.skills-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }}
.skill {{ margin-bottom:12px; }}
.skill-header {{ display:flex; justify-content:space-between; font-size:14px; margin-bottom:6px; }}
.skill-bar {{ height:6px; background:var(--border); border-radius:3px; overflow:hidden; }}
.skill-fill {{ height:100%; background:linear-gradient(90deg,var(--accent),var(--accent2)); border-radius:3px;
  transition:width 1s ease; }}

/* Testimonials */
.testimonials-grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:24px; }}
.testimonial {{ background:var(--card); border:1px solid var(--border); border-radius:16px; padding:28px; }}
.quote {{ font-size:16px; font-style:italic; margin-bottom:16px; line-height:1.7; color:var(--muted); }}
.testimonial-author strong {{ display:block; color:var(--text); }}
.testimonial-author span {{ font-size:13px; color:var(--muted); }}

/* Contact */
.contact-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:48px; }}
@media(max-width:768px) {{ .contact-grid {{ grid-template-columns:1fr; }} .stats {{ grid-template-columns:repeat(2,1fr); }} }}
.contact-info {{ font-size:18px; }}
.contact-info p {{ margin-bottom:16px; }}
.social-links {{ display:flex; gap:12px; margin-top:24px; }}
.social-link {{ width:44px; height:44px; border-radius:50%; border:1px solid var(--border); display:flex;
  align-items:center; justify-content:center; font-size:14px; font-weight:700; color:var(--muted); transition:all 0.2s; }}
.social-link:hover {{ background:var(--accent); color:white; border-color:var(--accent); }}

/* Footer */
footer {{ text-align:center; padding:40px 0; color:var(--muted); font-size:14px; border-top:1px solid var(--border); }}

/* Nav */
nav {{ position:fixed; top:0; left:0; right:0; z-index:100; padding:16px 0;
  background:rgba(10,10,15,0.8); backdrop-filter:blur(12px); border-bottom:1px solid transparent; transition:border-color 0.3s; }}
nav.scrolled {{ border-color:var(--border); }}
nav .container {{ display:flex; justify-content:space-between; align-items:center; }}
nav .logo {{ font-size:20px; font-weight:800; }}
nav .links {{ display:flex; gap:24px; }}
nav .links a {{ color:var(--muted); font-size:14px; }}
nav .links a:hover {{ color:var(--text); }}
.availability {{ display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  background:rgba(0,184,148,0.1); border:1px solid rgba(0,184,148,0.3); border-radius:20px;
  font-size:13px; color:var(--green); }}
.availability::before {{ content:''; width:8px; height:8px; border-radius:50%; background:var(--green);
  animation:pulse 2s infinite; }}
@keyframes pulse {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:0.4; }} }}
</style>
</head>
<body>

<nav id="nav">
<div class="container">
  <div class="logo">{name.split()[0] if ' ' in name else name}</div>
  <div class="links">
    <a href="#projects">Work</a>
    <a href="#skills">Skills</a>
    <a href="#testimonials">Testimonials</a>
    <a href="#contact">Contact</a>
  </div>
</div>
</nav>

<section class="hero">
<div class="container">
<div class="hero-content">
  <span class="availability">{data.get('availability', 'Available for hire')}</span>
  <h1 style="margin-top:16px">Hi, I'm <span class="accent">{name}</span></h1>
  <p class="subtitle">{tagline or title}</p>
  <p style="color:var(--muted);max-width:550px;margin-bottom:32px">{bio}</p>
  <div class="cta">
    <a href="#contact" class="btn btn-primary">Get in Touch</a>
    <a href="#projects" class="btn btn-outline">View My Work</a>
  </div>
</div>
</div>
</section>

<div class="container">
<div class="stats">
  {stat_items}
</div>
</div>

<section id="projects">
<div class="container">
  <h2 class="section-title">Featured Work</h2>
  <p class="section-sub">A selection of projects I'm proud of.</p>
  <div class="filter-bar">{cat_buttons}</div>
  <div class="projects-grid">{project_cards}</div>
</div>
</section>

<section id="skills" style="background:var(--card)">
<div class="container">
  <h2 class="section-title">Skills & Expertise</h2>
  <p class="section-sub">Technologies and tools I work with daily.</p>
  <div class="skills-grid">{skill_bars}</div>
</div>
</section>

<section id="testimonials">
<div class="container">
  <h2 class="section-title">What Clients Say</h2>
  <p class="section-sub">Feedback from people I've worked with.</p>
  <div class="testimonials-grid">{testimonial_cards}</div>
</div>
</section>

<section id="contact">
<div class="container">
  <div class="contact-grid">
    <div>
      <h2 class="section-title">Let's Work Together</h2>
      <div class="contact-info">
        <p>📧 <a href="mailto:{email}">{email}</a></p>
        <p>📍 {data.get('location', 'Remote')}</p>
        <p style="color:var(--green)">{data.get('availability', '')}</p>
      </div>
      <div class="social-links">{social_links}</div>
    </div>
    <div>
      <p style="color:var(--muted);margin-bottom:20px">Drop me a message and I'll get back to you within 24 hours.</p>
      <form onsubmit="event.preventDefault();alert('Message sent! (Demo)')">
        <input type="text" placeholder="Your name" style="width:100%;padding:12px;margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px">
        <input type="email" placeholder="Your email" style="width:100%;padding:12px;margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px">
        <textarea placeholder="Tell me about your project..." rows="5" style="width:100%;padding:12px;margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;resize:vertical"></textarea>
        <button type="submit" class="btn btn-primary" style="width:100%">Send Message</button>
      </form>
    </div>
  </div>
</div>
</section>

<footer>
<div class="container">
  <p>&copy; {datetime.now().year} {name}. Built with Cortex Freelancer ⚡</p>
</div>
</footer>

<script>
// Nav scroll
window.addEventListener('scroll', () => {{
  document.getElementById('nav').classList.toggle('scrolled', scrollY > 50);
}});
// Project filter
document.querySelectorAll('.filter-btn').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card => {{
      card.style.display = (filter === 'all' || card.dataset.category === filter) ? '' : 'none';
    }});
  }});
}});
// Animate skill bars on scroll
const observer = new IntersectionObserver(entries => {{
  entries.forEach(e => {{
    if(e.isIntersecting) e.target.querySelectorAll('.skill-fill').forEach(bar => {{
      bar.style.width = bar.style.width;
    }});
  }});
}});
document.querySelectorAll('.skills-grid').forEach(el => observer.observe(el));
</script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Cortex Freelancer — Portfolio Site Generator")
    sub = parser.add_subparsers(dest="command")

    gen = sub.add_parser("generate", help="Generate portfolio site")
    gen.add_argument("--name", default="")
    gen.add_argument("--title", default="")
    gen.add_argument("--config", help="JSON config file")
    gen.add_argument("--output", default="portfolio.html")

    demo = sub.add_parser("demo", help="Generate demo portfolio")
    demo.add_argument("--output", default="portfolio_demo.html")

    args = parser.parse_args()

    if args.command == "generate":
        if args.config:
            data = json.loads(Path(args.config).read_text())
        else:
            data = SAMPLE_DATA.copy()
            if args.name: data["name"] = args.name
            if args.title: data["title"] = args.title
        html = generate_portfolio(data)
        Path(args.output).write_text(html)
        print(f"✅ Portfolio generated: {args.output}")
        print(f"   {len(data.get('projects', []))} projects, {len(data.get('skills', []))} skills, {len(data.get('testimonials', []))} testimonials")
    elif args.command == "demo":
        html = generate_portfolio(SAMPLE_DATA)
        Path(args.output).write_text(html)
        print(f"✅ Demo portfolio generated: {args.output}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
