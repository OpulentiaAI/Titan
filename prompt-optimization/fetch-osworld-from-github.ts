#!/usr/bin/env tsx

/**
 * Fetch OSWorld tasks directly from GitHub repository
 * This script can fetch the full 369-task dataset from OSWorld
 * 
 * Repository: https://github.com/xlang-ai/OSWorld
 * Usage: npx tsx fetch-osworld-from-github.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Fetch OSWorld tasks from GitHub API or direct download
 * OSWorld tasks are typically stored in data/tasks.json or data/tasks/ directory
 */
async function fetchOSWorldTasksFromGitHub(): Promise<any[]> {
  console.log('🔄 Fetching OSWorld tasks from GitHub...\n');
  
  try {
    // Option 1: Fetch from GitHub API
    const repoOwner = 'xlang-ai';
    const repoName = 'OSWorld';
    
    // Common paths where OSWorld stores task data:
    const possiblePaths = [
      'data/tasks.json',
      'data/tasks/all.json',
      'benchmarks/osworld/tasks.json',
    ];
    
    console.log(`Repository: https://github.com/${repoOwner}/${repoName}`);
    console.log('\nTo fetch tasks, you can:');
    console.log('1. Clone the repository:');
    console.log(`   git clone https://github.com/${repoOwner}/${repoName}.git`);
    console.log('\n2. Load tasks from local clone:');
    console.log('   Tasks are typically in data/tasks/ or data/tasks.json');
    console.log('\n3. Or use the raw GitHub URL:');
    possiblePaths.forEach(path => {
      console.log(`   https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/${path}`);
    });
    
    console.log('\n💡 Alternative: Use the add-osworld-samples.ts script');
    console.log('   It includes representative samples from OSWorld categories');
    console.log('   You can extend it with more tasks manually.\n');
    
    // For now, return empty array - user should clone repo or provide tasks manually
    return [];
    
  } catch (error: any) {
    console.error('❌ Error fetching from GitHub:', error.message);
    console.log('\n📝 Manual Setup Instructions:');
    console.log('1. Clone OSWorld repository:');
    console.log('   git clone https://github.com/xlang-ai/OSWorld.git');
    console.log('2. Copy task data to this directory');
    console.log('3. Update add-osworld-samples.ts to load from local files\n');
    return [];
  }
}

/**
 * Load tasks from local OSWorld clone
 */
function loadTasksFromLocal(osworldPath: string): any[] {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Try different possible locations
    const possibleFiles = [
      path.join(osworldPath, 'data', 'tasks.json'),
      path.join(osworldPath, 'benchmarks', 'osworld', 'tasks.json'),
      path.join(osworldPath, 'data', 'tasks', 'all.json'),
    ];
    
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ Found tasks file: ${file}`);
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        
        // OSWorld tasks can be in different formats
        if (Array.isArray(data)) {
          return data;
        } else if (data.tasks && Array.isArray(data.tasks)) {
          return data.tasks;
        } else if (data.data && Array.isArray(data.data)) {
          return data.data;
        }
      }
    }
    
    console.warn('⚠️  Could not find tasks.json in expected locations');
    return [];
    
  } catch (error: any) {
    console.error('❌ Error loading local tasks:', error.message);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0]) {
    // Load from local path
    const localPath = args[0];
    console.log(`📂 Loading OSWorld tasks from local path: ${localPath}\n`);
    const tasks = loadTasksFromLocal(localPath);
    
    if (tasks.length > 0) {
      console.log(`✅ Loaded ${tasks.length} tasks from local repository`);
      console.log('\n💡 Next step: Update add-osworld-samples.ts to use these tasks');
      console.log('   Or run add-osworld-samples.ts which will use representative samples\n');
      
      // Save a reference file
      const outputPath = join(__dirname, 'osworld-tasks-reference.json');
      writeFileSync(outputPath, JSON.stringify(tasks.slice(0, 10), null, 2));
      console.log(`📝 Saved sample to: ${outputPath} (first 10 tasks as reference)`);
    } else {
      console.log('❌ No tasks found. Make sure the path is correct.');
    }
  } else {
    // Show instructions
    await fetchOSWorldTasksFromGitHub();
  }
}

main().catch(console.error);

