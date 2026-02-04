#!/usr/bin/env bash
pkill -f "ssh -f -N -A -J archit_tiwari@13.127.240.17 archit_tiwari@10.0.0.82 -L 27017:localhost:27017"
echo "🛑 Tunnel stopped."

