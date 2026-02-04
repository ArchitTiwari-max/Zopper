#!/usr/bin/env bash
pkill -f "ssh -f -N -A -J vishal@13.127.240.17 vishal@10.0.0.82 -L 27017:localhost:27017"
echo "🛑 Tunnel stopped."

