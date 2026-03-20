#!/bin/bash
cd "$(dirname "$0")"
echo "Installing dependencies..."
npm install
echo ""
echo "Starting Cortex Freelancer on port 3847..."
npm start
