#!/usr/bin/env node

/**
 * Security Headers Checker for AnoChat
 * Validates that all required security headers are properly configured
 */

const requiredHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "connect-src 'self' *.supabase.co wss://*.supabase.co",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "manifest-src 'self'",
    "worker-src 'self'"
  ].join('; ')
};

const securityChecks = {
  // Check for dangerous console.log statements
  checkConsoleStatements: () => {
    const fs = require('fs');
    const path = require('path');
    const glob = require('glob');
    
    console.log('🔍 Checking for console statements...');
    
    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', '.next/**', 'scripts/**', '**/*.test.*', '**/__tests__/**']
    });
    
    let issues = [];
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.includes('console.log') || line.includes('console.error') || line.includes('console.warn')) {
          // Skip if it's a SecurityUtils call or in comments
          if (!line.includes('SecurityUtils.') && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            issues.push({
              file,
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    });
    
    if (issues.length > 0) {
      console.log('❌ Found console statements that should be removed:');
      issues.forEach(issue => {
        console.log(`   ${issue.file}:${issue.line} - ${issue.content}`);
      });
      return false;
    } else {
      console.log('✅ No dangerous console statements found');
      return true;
    }
  },

  // Check for hardcoded secrets
  checkHardcodedSecrets: () => {
    const fs = require('fs');
    const glob = require('glob');
    
    console.log('🔍 Checking for hardcoded secrets...');
    
    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', '.next/**', 'scripts/**']
    });
    
    const dangerousPatterns = [
      /(?:password|passwd|pwd)\s*[:=]\s*['"]\w+['"]/i,
      /(?:secret|key|token)\s*[:=]\s*['"]\w{10,}['"]/i,
      /(?:api_key|apikey)\s*[:=]\s*['"]\w+['"]/i,
      /supabase\.co\/.*\/[a-zA-Z0-9]{20,}/,
    ];
    
    let issues = [];
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        dangerousPatterns.forEach(pattern => {
          if (pattern.test(line) && !line.includes('process.env')) {
            issues.push({
              file,
              line: index + 1,
              content: line.trim()
            });
          }
        });
      });
    });
    
    if (issues.length > 0) {
      console.log('❌ Found potential hardcoded secrets:');
      issues.forEach(issue => {
        console.log(`   ${issue.file}:${issue.line} - ${issue.content}`);
      });
      return false;
    } else {
      console.log('✅ No hardcoded secrets found');
      return true;
    }
  },

  // Check environment variables
  checkEnvironmentVariables: () => {
    console.log('🔍 Checking environment variables...');
    
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];
    
    const fs = require('fs');
    let envExists = false;
    let issues = [];
    
    try {
      const envContent = fs.readFileSync('.env.local', 'utf8');
      envExists = true;
      
      requiredEnvVars.forEach(envVar => {
        if (!envContent.includes(envVar)) {
          issues.push(`Missing required environment variable: ${envVar}`);
        }
      });
      
    } catch (error) {
      issues.push('Missing .env.local file');
    }
    
    if (issues.length > 0) {
      console.log('❌ Environment variable issues:');
      issues.forEach(issue => console.log(`   ${issue}`));
      return false;
    } else {
      console.log('✅ Environment variables properly configured');
      return true;
    }
  },

  // Check Next.js configuration
  checkNextConfig: () => {
    console.log('🔍 Checking Next.js security configuration...');
    
    const fs = require('fs');
    let issues = [];
    
    try {
      const configContent = fs.readFileSync('next.config.ts', 'utf8');
      
      // Check for security headers
      Object.keys(requiredHeaders).forEach(header => {
        if (!configContent.includes(header)) {
          issues.push(`Missing security header: ${header}`);
        }
      });
      
      // Check for source maps disabled
      if (!configContent.includes('productionBrowserSourceMaps: false')) {
        issues.push('Source maps should be disabled in production');
      }
      
      // Check for powered by header disabled
      if (!configContent.includes('poweredByHeader: false')) {
        issues.push('X-Powered-By header should be disabled');
      }
      
    } catch (error) {
      issues.push('Cannot read next.config.ts file');
    }
    
    if (issues.length > 0) {
      console.log('❌ Next.js configuration issues:');
      issues.forEach(issue => console.log(`   ${issue}`));
      return false;
    } else {
      console.log('✅ Next.js security configuration looks good');
      return true;
    }
  }
};

// Run all security checks
console.log('🔒 AnoChat Security Audit');
console.log('========================\n');

const results = Object.values(securityChecks).map(check => check());
const allPassed = results.every(result => result);

console.log('\n📊 Security Audit Summary');
console.log('=========================');

if (allPassed) {
  console.log('✅ All security checks passed!');
  console.log('🚀 Ready for production deployment');
  process.exit(0);
} else {
  console.log('❌ Some security checks failed');
  console.log('🔧 Please fix the issues above before deploying');
  process.exit(1);
} 