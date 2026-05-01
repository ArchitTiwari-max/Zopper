#!/bin/bash

echo "🚀 Starting push process..."

# Add all changes
echo "📁 Adding changes..."
git add .

# Commit with a default message
echo "💾 Committing changes..."
git commit -m "new changes"

# Push to bitbucket main
echo "📤 Pushing to bitbucket main..."
git push bitbucket main

echo "✅ All done!"
