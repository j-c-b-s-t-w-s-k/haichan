#!/bin/bash
# haichan GitHub Repository Setup Script
# This script automates the setup of the GitHub repository

set -e  # Exit on error

echo "======================================"
echo "haichan GitHub Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed. Please install git first.${NC}"
    exit 1
fi

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}Error: GitHub username cannot be empty.${NC}"
    exit 1
fi

# Repository name
REPO_NAME="haichan-pow-imageboard"

echo ""
echo -e "${GREEN}Setting up repository: ${GITHUB_USERNAME}/${REPO_NAME}${NC}"
echo ""

# Check if already a git repository
if [ -d ".git" ]; then
    echo -e "${YELLOW}Warning: This directory is already a git repository.${NC}"
    read -p "Do you want to continue? This will add a new remote. (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "Aborted."
        exit 0
    fi
else
    # Initialize git repository
    echo "Initializing git repository..."
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Production
/dist
/build

# Environment
.env
.env.local

# Logs
*.log

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
EOF
    echo -e "${GREEN}✓ .gitignore created${NC}"
fi

# Stage all files
echo "Staging files..."
git add .
echo -e "${GREEN}✓ Files staged${NC}"

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo -e "${YELLOW}No changes to commit${NC}"
else
    # Create initial commit
    echo "Creating initial commit..."
    git commit -m "feat: initial commit - proof-of-work imageboard

- Core proof-of-work mining system
- Bitcoin secp256k1 authentication
- Threaded discussions with PoW ranking
- Personal blogs with custom themes
- Realtime chat
- Diamond hash achievements
- Invite-gated registration (256 user cap)
- Monospace terminal aesthetic
- Comprehensive thesis and documentation"
    echo -e "${GREEN}✓ Initial commit created${NC}"
fi

# Rename branch to main if needed
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Renaming branch to main..."
    git branch -M main
    echo -e "${GREEN}✓ Branch renamed to main${NC}"
fi

# Add remote
REMOTE_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
echo "Adding remote: $REMOTE_URL"

if git remote | grep -q "origin"; then
    echo -e "${YELLOW}Remote 'origin' already exists${NC}"
    read -p "Do you want to update it? (y/n): " UPDATE_REMOTE
    if [ "$UPDATE_REMOTE" = "y" ]; then
        git remote set-url origin "$REMOTE_URL"
        echo -e "${GREEN}✓ Remote updated${NC}"
    fi
else
    git remote add origin "$REMOTE_URL"
    echo -e "${GREEN}✓ Remote added${NC}"
fi

echo ""
echo -e "${GREEN}======================================"
echo "Setup Complete!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Create the repository on GitHub:"
echo -e "   ${YELLOW}https://github.com/new${NC}"
echo "   - Name: ${REPO_NAME}"
echo "   - Description: Proof-of-work mediated social interaction imageboard"
echo "   - Public or Private (your choice)"
echo "   - DON'T initialize with README (we already have one)"
echo ""
echo "2. Push to GitHub:"
echo -e "   ${YELLOW}git push -u origin main${NC}"
echo ""
echo "3. Configure repository settings:"
echo "   - Add topics: proof-of-work, imageboard, typescript, react, blockchain, mining"
echo "   - Enable Issues and Discussions"
echo "   - Set up branch protection for main"
echo "   - Review .github/REPOSITORY_SETUP.md for detailed instructions"
echo ""
echo "4. Set up GitHub Actions:"
echo "   - Workflows are already configured in .github/workflows/"
echo "   - They will run automatically on push and PR"
echo ""
echo "Repository URL: ${REMOTE_URL}"
echo ""
echo -e "${GREEN}Happy hashing! ⚡${NC}"
