#!/usr/bin/env python3
"""Health check for the Cortex Freelancer platform."""

import argparse
import os
import subprocess
import sys


REQUIRED_AGENT_FILES = ["SOUL.md", "KNOWLEDGE.md", "README.md"]
REQUIRED_AGENT_DIRS = ["scripts", "templates"]

EXPECTED_AGENTS = [
    "business-dev",
    "client-comms",
    "contract-legal",
    "finance-manager",
    "growth-strategist",
    "portfolio-builder",
    "project-manager",
    "schedule-manager",
]

SCRIPTS_TO_CHECK = [
    "daily_brief.py",
    "weekly_report.py",
    "onboarding_wizard.py",
    "health_check.py",
]


def find_project_root():
    """Find the cortex-freelancer project root."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(script_dir)


def check_python_version():
    """Check that Python version is 3.8+."""
    issues = []
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 8):
        issues.append(f"Python version {major}.{minor} detected; 3.8+ required.")
    return issues


def check_agents(root, verbose=False):
    """Check that all agent directories exist with required files."""
    issues = []
    agents_dir = os.path.join(root, "agents")

    if not os.path.isdir(agents_dir):
        issues.append("agents/ directory not found at project root.")
        return issues

    # Check for expected agents
    existing_agents = set()
    try:
        existing_agents = set(os.listdir(agents_dir))
    except OSError as e:
        issues.append(f"Could not read agents/ directory: {e}")
        return issues

    for agent_name in EXPECTED_AGENTS:
        agent_path = os.path.join(agents_dir, agent_name)

        if agent_name not in existing_agents:
            issues.append(f"Agent directory missing: agents/{agent_name}/")
            continue

        if not os.path.isdir(agent_path):
            issues.append(f"agents/{agent_name} exists but is not a directory.")
            continue

        # Check required files
        for req_file in REQUIRED_AGENT_FILES:
            filepath = os.path.join(agent_path, req_file)
            if not os.path.isfile(filepath):
                issues.append(f"Missing: agents/{agent_name}/{req_file}")

        # Check required subdirectories
        for req_dir in REQUIRED_AGENT_DIRS:
            dirpath = os.path.join(agent_path, req_dir)
            if not os.path.isdir(dirpath):
                issues.append(f"Missing directory: agents/{agent_name}/{req_dir}/")

    return issues


def check_scripts(root, verbose=False):
    """Check that each script has working --help."""
    issues = []
    scripts_dir = os.path.join(root, "scripts")

    if not os.path.isdir(scripts_dir):
        issues.append("scripts/ directory not found at project root.")
        return issues

    for script_name in SCRIPTS_TO_CHECK:
        script_path = os.path.join(scripts_dir, script_name)

        if not os.path.isfile(script_path):
            issues.append(f"Script not found: scripts/{script_name}")
            continue

        # Test --help
        try:
            result = subprocess.run(
                [sys.executable, script_path, "--help"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                issues.append(
                    f"scripts/{script_name} --help exited with code {result.returncode}"
                )
                if verbose and result.stderr:
                    issues.append(f"  stderr: {result.stderr.strip()}")
        except subprocess.TimeoutExpired:
            issues.append(f"scripts/{script_name} --help timed out (>10s)")
        except OSError as e:
            issues.append(f"Could not run scripts/{script_name}: {e}")

    return issues


def check_data_dir(root):
    """Check that the data directory exists."""
    issues = []
    data_dir = os.path.join(root, "data")
    if not os.path.isdir(data_dir):
        issues.append("data/ directory not found. Run onboarding_wizard.py to create it.")
    return issues


def run_health_check(root, verbose=False):
    """Run all health checks and return a list of issues."""
    all_issues = []

    print("Running Cortex Freelancer health check...")
    print(f"Project root: {root}")
    print()

    # 1. Python version
    print("Checking Python version...", end=" ")
    py_issues = check_python_version()
    if py_issues:
        print("ISSUE")
        all_issues.extend(py_issues)
    else:
        major, minor, micro = sys.version_info[:3]
        print(f"OK (Python {major}.{minor}.{micro})")

    # 2. Agent directories
    print("Checking agent directories...", end=" ")
    agent_issues = check_agents(root, verbose)
    if agent_issues:
        print(f"{len(agent_issues)} issue(s)")
        all_issues.extend(agent_issues)
    else:
        print("OK")

    # 3. Scripts
    print("Checking scripts...", end=" ")
    script_issues = check_scripts(root, verbose)
    if script_issues:
        print(f"{len(script_issues)} issue(s)")
        all_issues.extend(script_issues)
    else:
        print("OK")

    # 4. Data directory
    print("Checking data directory...", end=" ")
    data_issues = check_data_dir(root)
    if data_issues:
        print("ISSUE")
        all_issues.extend(data_issues)
    else:
        print("OK")

    return all_issues


def main():
    parser = argparse.ArgumentParser(
        description="Health check for the Cortex Freelancer platform. Verifies agent directories, scripts, and configuration.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example:\n  python3 health_check.py\n  python3 health_check.py --verbose\n  python3 health_check.py --project-root /path/to/cortex-freelancer",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Path to the cortex-freelancer project root (default: auto-detect)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output for issues",
    )
    args = parser.parse_args()

    root = args.project_root if args.project_root else find_project_root()

    if not os.path.isdir(root):
        print(f"Error: Project root '{root}' does not exist.", file=sys.stderr)
        sys.exit(1)

    print()
    issues = run_health_check(root, args.verbose)
    print()

    if issues:
        print("=" * 50)
        print("  WARNING: Issues found")
        print("=" * 50)
        print()
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        print()
        print(f"Total: {len(issues)} issue(s) found.")
        sys.exit(1)
    else:
        print("=" * 50)
        print("  All good!")
        print("=" * 50)
        print()
        print("Your Cortex Freelancer setup looks healthy.")
        sys.exit(0)


if __name__ == "__main__":
    main()
