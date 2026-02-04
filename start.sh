#!/usr/bin/env bash

set -e

#eval "$(ssh-agent -s)"
#ssh-add -K ~/.ssh/id_rsa

echo "🔐 Starting SSH tunnel in background..."

ssh -i ~/.ssh/id_rsa -f -N -A -J vishal@13.127.240.17 vishal@10.0.0.82 -L 27017:localhost:27017

echo "✅ Tunnel started."
echo "🚀 Connecting to Remote MongoDB..."
echo "🚀 Connected to Remote MongoDB."

#mongosh "mongodb://127.0.0.1:27017/zoppertrack?directConnection=true"

