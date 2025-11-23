#!/usr/bin/env node

/**
 * QR Scanner App - Automated Netlify Deployment Script
 * This script sets up environment variables and deploys to Netlify
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Firebase configuration from your project
const firebaseConfig = {
  VITE_FIREBASE_API_KEY: "AIzaSyDmv9blz5rP55kp8_a9gnGdn1UQcI1753k",
  VITE_FIREBASE_AUTH_DOMAIN: "qr-users-8e1c4.firebaseapp.com",
  VITE_FIREBASE_DATABASE_URL: "https://qr-users-8e1c4-default-rtdb.asia-southeast1.firebasedatabase.app",
  VITE_FIREBASE_PROJECT_ID: "qr-users-8e1c4",
  VITE_FIREBASE_STORAGE_BUCKET: "qr-users-8e1c4.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "802989435149",
  VITE_FIREBASE_APP_ID: "1:802989435149:web:a14939bb8fe04599a3e844",
  VITE_FIREBASE_MEASUREMENT_ID: "G-YQLS5FXCX1"
};

console.log('🚀 QR Scanner App - Netlify Deployment Script');
console.log('='.repeat(50));

function runCommand(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} completed successfully`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

function checkNetlifyCLI() {
  try {
    execSync('netlify --version', { stdio: 'pipe' });
    console.log('✅ Netlify CLI is installed');
    return true;
  } catch (error) {
    console.log('❌ Netlify CLI not found. Installing...');
    try {
      runCommand('npm install -g netlify-cli', 'Installing Netlify CLI');
      return true;
    } catch (installError) {
      console.error('❌ Failed to install Netlify CLI. Please install manually:');
      console.error('   npm install -g netlify-cli');
      return false;
    }
  }
}

function setEnvironmentVariables() {
  console.log('\n⚙️ Setting up Firebase environment variables...');
  
  Object.entries(firebaseConfig).forEach(([key, value]) => {
    try {
      runCommand(`netlify env:set ${key} "${value}"`, `Setting ${key}`);
    } catch (error) {
      console.error(`❌ Failed to set ${key}:`, error.message);
      throw error;
    }
  });
  
  console.log('✅ All environment variables set successfully!');
}

function verifyEnvironmentVariables() {
  console.log('\n🔍 Verifying environment variables...');
  try {
    const envList = runCommand('netlify env:list', 'Listing environment variables');
    console.log('📋 Current environment variables:');
    console.log(envList);
    return true;
  } catch (error) {
    console.error('❌ Failed to verify environment variables');
    return false;
  }
}

function buildProject() {
  console.log('\n🔨 Building the project...');
  
  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    runCommand('npm install', 'Installing dependencies');
  }
  
  // Build the project
  runCommand('npm run build', 'Building project');
  
  // Verify dist folder exists
  if (!fs.existsSync('dist')) {
    throw new Error('Build failed - dist folder not found');
  }
  
  console.log('✅ Project built successfully!');
}

function deployToNetlify() {
  console.log('\n🌐 Deploying to Netlify...');
  
  try {
    const deployOutput = runCommand('netlify deploy --prod --dir=dist', 'Deploying to production');
    console.log('📋 Deployment output:');
    console.log(deployOutput);
    
    // Extract URL from output if possible
    const urlMatch = deployOutput.match(/Website URL:\s*(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      console.log(`\n🎉 Deployment successful!`);
      console.log(`🌐 Your app is live at: ${urlMatch[1]}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Check Netlify CLI
    if (!checkNetlifyCLI()) {
      process.exit(1);
    }
    
    // Step 2: Login check
    try {
      runCommand('netlify status', 'Checking login status');
    } catch (error) {
      console.log('\n🔐 Please log in to Netlify...');
      runCommand('netlify login', 'Logging in to Netlify');
    }
    
    // Step 3: Set environment variables
    setEnvironmentVariables();
    
    // Step 4: Verify environment variables
    verifyEnvironmentVariables();
    
    // Step 5: Build project
    buildProject();
    
    // Step 6: Deploy to Netlify
    if (deployToNetlify()) {
      console.log('\n🎉 Deployment completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Update Firebase Security Rules (see FIREBASE_SECURITY_RULES_FIX.md)');
      console.log('2. Add your Netlify domain to Firebase authorized domains');
      console.log('3. Test your app functionality');
      console.log('\n✅ Your QR Scanner app is now live!');
    } else {
      throw new Error('Deployment failed');
    }
    
  } catch (error) {
    console.error('\n💥 Deployment script failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure you are logged into Netlify CLI: netlify login');
    console.log('2. Check your internet connection');
    console.log('3. Verify your project has a Netlify site created');
    console.log('4. Try running commands manually from netlify-commands.txt');
    process.exit(1);
  }
}

// Run the script
main(); 