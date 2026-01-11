#!/usr/bin/env node

/**
 * Helper script to display network URL for accessing the dev server from other devices
 * Run this after starting the dev server to see the network URL
 */

const os = require('os');
const { execSync } = require('child_process');

function getLocalIP() {
  try {
    // Try using Node's os.networkInterfaces() first
    const interfaces = os.networkInterfaces();
    
    if (!interfaces) {
      throw new Error('Unable to get network interfaces');
    }
    
    // Prefer en0 (primary WiFi/Ethernet on macOS) or eth0 (Linux)
    const preferredInterfaces = ['en0', 'en1', 'eth0', 'wlan0'];
    
    for (const ifaceName of preferredInterfaces) {
      const iface = interfaces[ifaceName];
      if (iface) {
        for (const addr of iface) {
          // Handle both 'IPv4' and 4 (numeric) family types
          const isIPv4 = addr.family === 'IPv4' || addr.family === 4;
          if (isIPv4 && !addr.internal) {
            return addr.address;
          }
        }
      }
    }
    
    // Fallback: find first non-internal IPv4 address
    for (const ifaceName of Object.keys(interfaces)) {
      const iface = interfaces[ifaceName];
      if (iface) {
        for (const addr of iface) {
          const isIPv4 = addr.family === 'IPv4' || addr.family === 4;
          if (isIPv4 && !addr.internal) {
            return addr.address;
          }
        }
      }
    }
  } catch (error) {
    // If os.networkInterfaces() fails, try system commands
    try {
      if (process.platform === 'darwin') {
        // macOS
        const ip = execSync('ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1', { 
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          return ip;
        }
      } else if (process.platform === 'linux') {
        // Linux
        const ip = execSync('hostname -I | awk \'{print $1}\'', { 
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          return ip;
        }
      }
    } catch (cmdError) {
      // Ignore command errors
    }
  }
  
  return null;
}

const localIP = getLocalIP();

console.log('');
console.log('=========================================');
console.log('  Network Access Information');
console.log('=========================================');
console.log('');
console.log('  Local access:    http://localhost:3000');
if (localIP) {
  console.log(`  Network access:  http://${localIP}:3000`);
  console.log('');
  console.log('  Access from other devices using:');
  console.log(`  http://${localIP}:3000`);
} else {
  console.log('  Network access:  Unable to determine IP');
  console.log('');
  console.log('  Try running:');
  if (process.platform === 'darwin') {
    console.log('    ipconfig getifaddr en0');
  } else {
    console.log('    hostname -I');
  }
}
console.log('');
console.log('  Make sure devices are on the same network!');
console.log('=========================================');
console.log('');
