# CORTEX FREELANCER - GIT WORKFLOW
## Professional Branch Strategy | Implemented: 2026-03-26 02:05 GMT+3

⚡ **No more task queue confusion - Clean versioning system**

---

## 🌿 **BRANCH STRUCTURE**

```
main                    # Production releases only
├─ phase3-sprint       # ⭐ ACTIVE: Current development  
├─ wave1-complete      # Completed Wave 1 (CF3-001 to CF3-008)
├─ wave2-prep          # Next: Wave 2 (CF3-009 to CF3-015) 
├─ wave3-prep          # Future: Wave 3 (external integrations)
└─ hotfix/*           # Emergency production fixes
```

---

## ⚡ **CURRENT STATUS**

**Active Branch:** `phase3-sprint`  
**Last Tag:** `v0.1.0-wave1` (Wave 1 complete)  
**Next Tag:** `v0.2.0-wave2` (when CF3-009 to CF3-015 done)

---

## 🚀 **WORKFLOW RULES**

### **Daily Development:**
```bash
git checkout phase3-sprint    # Always work here
# Make changes, commit frequently
git add . && git commit -m "CF3-XXX: task description"
```

### **Wave Completion:**
```bash
# When wave completes (e.g., CF3-009 to CF3-015)
git checkout main
git merge phase3-sprint
git tag v0.2.0-wave2 -m "Wave 2 Complete: expense + tax + analytics"
git checkout phase3-sprint    # Back to development
```

### **Major Milestones:**
```bash
# Full Phase 3 completion (all 50 tasks)
git checkout main  
git merge phase3-sprint
git tag v1.0.0-mvp -m "Phase 3 Complete: Full AI Freelancer MVP"
```

### **Emergency Fixes:**
```bash
git checkout main
git checkout -b hotfix/critical-bug
# Fix, commit
git checkout main
git merge hotfix/critical-bug
git tag v0.1.1-hotfix
```

---

## 📊 **VERSIONING SCHEME**

**Format:** `vMAJOR.MINOR.PATCH-LABEL`

| Version | Meaning |
|---------|---------|
| `v0.1.0-wave1` | Wave 1 complete (CF3-001 to CF3-008) |
| `v0.2.0-wave2` | Wave 2 complete (CF3-009 to CF3-015) |  
| `v0.3.0-wave3` | Week 2 integrations complete |
| `v1.0.0-mvp` | Full Phase 3 MVP complete |
| `v1.0.1-hotfix` | Production bug fixes |
| `v2.0.0-launch` | Production launch ready |

---

## 🎯 **BENEFITS**

✅ **Zero Confusion:** Each wave has clear branch  
✅ **Easy Rollback:** `git checkout v0.1.0-wave1`  
✅ **Clean History:** Professional git log  
✅ **ACP Integration:** Works seamlessly with OpenClaw  
✅ **Milestone Tracking:** Tags show major achievements

---

## 📋 **CURRENT TAGS**

```bash
git tag -l
# v0.1.0-wave1   # Wave 1 complete (8 core AI features)
# v0.2.0-wave2   # Coming: Wave 2 (expense, tax, analytics)  
# v1.0.0-mvp     # Target: Full Phase 3 MVP
```

---

## ⚡ **ACTIVE COMMANDS**

**Check current status:**
```bash
git branch              # See all branches
git log --oneline -5    # Recent commits  
git tag -l              # All version tags
```

**Switch contexts:**
```bash
git checkout phase3-sprint    # Development work
git checkout main            # Production state
git checkout v0.1.0-wave1    # Rollback to Wave 1
```

---

**🎉 CLEAN VERSIONING = NO MORE CONFUSION!**  
**All future work happens in `phase3-sprint` branch.**