#!/bin/bash
# Inject Firebase Auth into all HTML pages
# This script adds:
# 1. Auth CSS styles
# 2. #cortex-auth div in nav
# 3. Firebase SDK + auth.js script tags

cd "$(dirname "$0")/.."

AUTH_CSS='/* AUTH UI */
#cortex-auth{display:flex;align-items:center}
.cortex-auth-btn{border:none;cursor:pointer;font-family:inherit;transition:all .2s;border-radius:100px;font-weight:600;font-size:.8rem;letter-spacing:.5px}
.cortex-login-btn{background:var(--orange);color:#000;padding:.45rem 1rem}
.cortex-login-btn:hover{background:var(--green);color:#000}
.cortex-logout-btn{background:var(--bg3);color:var(--text2);padding:.35rem .8rem;font-size:.75rem;border:1px solid rgba(255,255,255,.1)}
.cortex-logout-btn:hover{border-color:var(--orange);color:var(--orange)}
.cortex-user-info{display:flex;align-items:center;gap:.5rem}
.cortex-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover}
.cortex-avatar-placeholder{width:28px;height:28px;border-radius:50%;background:var(--orange);color:#000;display:grid;place-items:center;font-size:.75rem;font-weight:800}
.cortex-user-name{font-size:.8rem;color:var(--text2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cortex-pro-badge{background:linear-gradient(135deg,var(--green),var(--green2,#00cc6a));color:#000;font-size:.6rem;font-weight:800;padding:.15rem .5rem;border-radius:100px;letter-spacing:1px}
.toast{position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(80px);background:var(--green,#00ff88);color:var(--bg,#0a0a0a);padding:.75rem 1.5rem;border-radius:10px;font-weight:600;font-size:.85rem;opacity:0;transition:all .3s;z-index:100;pointer-events:none}
.toast.show{transform:translateX(-50%) translateY(0);opacity:1}
@media(max-width:600px){.cortex-user-name{display:none}}'

echo "Auth injection script created. Use the main tool to inject into each file."
