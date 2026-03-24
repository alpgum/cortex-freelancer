# Cortex Freelancer → OpenClaw Skill Sprint

## Strategy: Simple Skill Architecture (Not Web Bridge)

### Insight from CMO Skill
- Simple markdown files with guidance
- No complex API integrations
- Direct OpenClaw integration
- Template-based responses

## Sprint Tasks (4 ACP Parallel)

### Batch A: Cortex Skill Creation
- [ ] **CS-001:** Create `skills/cortex-freelancer/SKILL.md` (CMO pattern)
- [ ] **CS-002:** Freelancer guidance templates (proposal, pricing, job analysis)
- [ ] **CS-003:** Skill auxiliary files (templates, frameworks)
- [ ] **CS-004:** Test skill installation and activation

### Batch B: Frontend Integration  
- [ ] **CS-005:** Remove HTTP bridge complexity from Cortex frontend
- [ ] **CS-006:** Direct OpenClaw sessions_send integration
- [ ] **CS-007:** Update chat UI for skill-based responses
- [ ] **CS-008:** Remove Anthropic/bridge fallback code

### Batch C: Skill Enhancement
- [ ] **CS-009:** Upwork-specific guidance templates
- [ ] **CS-010:** Rate optimization frameworks
- [ ] **CS-011:** Proposal generation templates
- [ ] **CS-012:** Client communication templates

### Batch D: Testing & Polish
- [ ] **CS-013:** End-to-end test: Frontend → Skill → Response
- [ ] **CS-014:** Polish skill responses and templates
- [ ] **CS-015:** Deploy updated frontend (no bridge)
- [ ] **CS-016:** Verify working pipeline

## Architecture: SIMPLE

```
User [cortexfreelancer.com/chat] 
  ↓ 
Frontend JS [sessions_send to OpenClaw]
  ↓ 
OpenClaw Skill [cortex-freelancer] 
  ↓ 
Template Response
```

**No HTTP bridge, no tunnel, no complexity - just direct skill execution**

---

## Estimated Time: 90 minutes (vs 3+ hours for bridge)
## Success: User types message → gets Cortex freelancer advice instantly