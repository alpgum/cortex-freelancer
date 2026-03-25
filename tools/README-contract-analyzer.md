# Contract Risk Analyzer

**CFX-060b** — Analyze contracts for red flags and generate safe templates.

## Features
- 12 red flag patterns (unlimited revisions, non-compete, IP transfer, etc.)
- Risk scoring (0-100) with severity levels
- Good practice detection
- 3 contract templates: web development, consulting, design
- Comprehensive freelancer contract checklist

## Usage
```bash
python contract_analyzer.py analyze --text "unlimited revisions until satisfied..."
python contract_analyzer.py analyze --file contract.txt
python contract_analyzer.py template --type web_development --rate 95 --client "Acme"
python contract_analyzer.py checklist
```
