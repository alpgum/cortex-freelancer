#!/bin/bash
# Cortex Freelancer — One-command setup
# Checks OpenClaw, copies agents, configures workspace

set -e

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BOLD}========================================${RESET}"
echo -e "${BOLD}  Cortex Freelancer — Setup${RESET}"
echo -e "${BOLD}========================================${RESET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$PROJECT_DIR/agents"

# Step 1: Check Python
echo -e "${BOLD}[1/5] Checking Python...${RESET}"
if command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1)
    echo -e "  ${GREEN}Found $PY_VERSION${RESET}"
else
    echo -e "  ${RED}Python 3 not found. Please install Python 3.8+ and try again.${RESET}"
    exit 1
fi

PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 8 ]); then
    echo -e "  ${RED}Python 3.8+ required. Found $PY_MAJOR.$PY_MINOR${RESET}"
    exit 1
fi

# Step 2: Check OpenClaw
echo -e "${BOLD}[2/5] Checking OpenClaw CLI...${RESET}"
if command -v openclaw &> /dev/null; then
    echo -e "  ${GREEN}OpenClaw CLI found.${RESET}"
else
    echo -e "  ${YELLOW}OpenClaw CLI not found.${RESET}"
    echo -e "  Agents are still usable standalone, but for the full experience:"
    echo -e "  Install OpenClaw: ${BOLD}pip install openclaw${RESET}"
    echo ""
fi

# Step 3: Validate agent directories
echo -e "${BOLD}[3/5] Validating agent packages...${RESET}"
AGENTS=("business-dev" "project-manager" "finance-manager")
ALL_VALID=true

for agent in "${AGENTS[@]}"; do
    AGENT_PATH="$AGENTS_DIR/$agent"
    if [ ! -d "$AGENT_PATH" ]; then
        echo -e "  ${RED}Missing: $agent/${RESET}"
        ALL_VALID=false
        continue
    fi

    MISSING=""
    [ ! -f "$AGENT_PATH/SOUL.md" ] && MISSING="$MISSING SOUL.md"
    [ ! -f "$AGENT_PATH/KNOWLEDGE.md" ] && MISSING="$MISSING KNOWLEDGE.md"
    [ ! -f "$AGENT_PATH/README.md" ] && MISSING="$MISSING README.md"
    [ ! -d "$AGENT_PATH/templates" ] && MISSING="$MISSING templates/"
    [ ! -d "$AGENT_PATH/scripts" ] && MISSING="$MISSING scripts/"

    if [ -n "$MISSING" ]; then
        echo -e "  ${YELLOW}$agent/ — missing:$MISSING${RESET}"
        ALL_VALID=false
    else
        TEMPLATE_COUNT=$(ls "$AGENT_PATH/templates/"*.md 2>/dev/null | wc -l | tr -d ' ')
        SCRIPT_COUNT=$(ls "$AGENT_PATH/scripts/"*.py 2>/dev/null | wc -l | tr -d ' ')
        echo -e "  ${GREEN}$agent/ — OK ($TEMPLATE_COUNT templates, $SCRIPT_COUNT scripts)${RESET}"
    fi
done

if [ "$ALL_VALID" = false ]; then
    echo ""
    echo -e "  ${YELLOW}Some agents have issues. They may still work, but check the warnings above.${RESET}"
fi

# Step 4: Make scripts executable
echo -e "${BOLD}[4/5] Setting permissions...${RESET}"
find "$AGENTS_DIR" -name "*.py" -exec chmod +x {} \;
find "$AGENTS_DIR" -name "*.sh" -exec chmod +x {} \;
echo -e "  ${GREEN}All scripts are executable.${RESET}"

# Step 5: Create workspace config
echo -e "${BOLD}[5/5] Creating workspace config...${RESET}"
CONFIG_FILE="$PROJECT_DIR/.cortex-freelancer.json"
if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << 'EOF'
{
  "version": "1.0.0",
  "product": "cortex-freelancer",
  "agents": {
    "business-dev": {
      "enabled": true,
      "path": "agents/business-dev"
    },
    "project-manager": {
      "enabled": true,
      "path": "agents/project-manager"
    },
    "finance-manager": {
      "enabled": true,
      "path": "agents/finance-manager"
    }
  },
  "settings": {
    "default_currency": "USD",
    "timezone": "UTC"
  }
}
EOF
    echo -e "  ${GREEN}Created .cortex-freelancer.json${RESET}"
else
    echo -e "  ${GREEN}Config already exists, skipping.${RESET}"
fi

echo ""
echo -e "${BOLD}========================================${RESET}"
echo -e "${GREEN}${BOLD}  Setup complete!${RESET}"
echo -e "${BOLD}========================================${RESET}"
echo ""
echo "  Your agents are ready:"
echo "    - Business Dev    → agents/business-dev/"
echo "    - Project Manager → agents/project-manager/"
echo "    - Finance Manager → agents/finance-manager/"
echo ""
echo "  Quick start:"
echo "    cd $PROJECT_DIR"
echo "    openclaw start"
echo ""
echo "  Or run agents standalone:"
echo "    python3 agents/business-dev/scripts/job_scanner.py --help"
echo "    python3 agents/project-manager/scripts/deadline_tracker.py --help"
echo "    python3 agents/finance-manager/scripts/fee_calculator.py --help"
echo ""
