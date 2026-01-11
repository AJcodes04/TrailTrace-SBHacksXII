#!/bin/bash

# Get local IP address (works on macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "Unable to determine IP")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "Unable to determine IP")
else
    LOCAL_IP="Unable to determine IP"
fi

if [ "$LOCAL_IP" != "Unable to determine IP" ]; then
    echo ""
    echo "========================================="
    echo "  Network Access Information"
    echo "========================================="
    echo ""
    echo "  Local access:    http://localhost:3000"
    echo "  Network access:  http://$LOCAL_IP:3000"
    echo ""
    echo "  Access from other devices using:"
    echo "  http://$LOCAL_IP:3000"
    echo ""
    echo "  Make sure devices are on the same network!"
    echo "========================================="
    echo ""
else
    echo ""
    echo "Warning: Could not determine local IP address."
    echo "You can find it manually by running:"
    echo "  macOS: ipconfig getifaddr en0"
    echo "  Linux: hostname -I"
    echo ""
fi
