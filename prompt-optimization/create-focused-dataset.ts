#!/usr/bin/env tsx

/**
 * Create focused dataset with exactly 20 samples per agent
 * for fast GEPA optimization
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Sample {
  id: string;
  group: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  feedback?: {
    rating: number;
    comment?: string;
  };
}

interface SampleGroup {
  id: string;
  name: string;
  samples: Sample[];
}

interface Dataset {
  groups: SampleGroup[];
  currentGroupId: string;
}

/**
 * Select diverse, high-quality samples for optimization
 */
function selectTopSamples(allSamples: Sample[], targetCount: number): Sample[] {
  // Group samples by category for diversity
  const samplesByCategory = new Map<string, Sample[]>();
  
  allSamples.forEach(sample => {
    const category = sample.group || 'default';
    if (!samplesByCategory.has(category)) {
      samplesByCategory.set(category, []);
    }
    samplesByCategory.get(category)!.push(sample);
  });

  // Prioritize samples with higher ratings
  const prioritizeSamples = (samples: Sample[]) => {
    return samples.sort((a, b) => {
      const ratingA = a.feedback?.rating || 3;
      const ratingB = b.feedback?.rating || 3;
      return ratingB - ratingA; // Higher ratings first
    });
  };

  // Select samples from each category to ensure diversity
  const selectedSamples: Sample[] = [];
  const categories = Array.from(samplesByCategory.keys());
  
  // First pass: take up to 3 samples from each category
  categories.forEach(category => {
    const categorySamples = prioritizeSamples(samplesByCategory.get(category)!);
    const samplesToTake = Math.min(3, categorySamples.length, targetCount - selectedSamples.length);
    selectedSamples.push(...categorySamples.slice(0, samplesToTake));
  });

  // If we need more samples, add from remaining high-rated samples
  if (selectedSamples.length < targetCount) {
    const remainingSamples = allSamples.filter(sample => !selectedSamples.includes(sample));
    const sortedRemaining = prioritizeSamples(remainingSamples);
    const additionalNeeded = targetCount - selectedSamples.length;
    selectedSamples.push(...sortedRemaining.slice(0, additionalNeeded));
  }

  // If we have too many, trim to exactly target count
  if (selectedSamples.length > targetCount) {
    return selectedSamples.slice(0, targetCount);
  }

  return selectedSamples;
}

/**
 * Create focused dataset for optimization
 */
function createFocusedDataset(agentName: string, targetCount: number = 20): Dataset {
  const dataPath = join(__dirname, `${agentName}/.dspyground/data/samples.json`);
  
  try {
    const data = JSON.parse(readFileSync(dataPath, 'utf8')) as Dataset;
    const allSamples: Sample[] = data.groups.flatMap(group => group.samples);
    
    console.log(`📊 ${agentName}: ${allSamples.length} total samples`);
    
    // Select top samples for optimization
    const selectedSamples = selectTopSamples(allSamples, targetCount);
    
    // Create new dataset structure with selected samples
    const focusedGroups = selectedSamples.reduce((acc, sample) => {
      let group = acc.find(g => g.name === sample.group);
      if (!group) {
        group = {
          id: sample.group.toLowerCase().replace(/\s+/g, '-'),
          name: sample.group,
          samples: []
        };
        acc.push(group);
      }
      group.samples.push(sample);
      return acc;
    }, [] as SampleGroup[]);

    const focusedDataset: Dataset = {
      groups: focusedGroups,
      currentGroupId: focusedGroups[0]?.id || 'default'
    };

    // Save focused dataset
    const focusedPath = join(__dirname, `${agentName}/.dspyground/data/focused-samples.json`);
    writeFileSync(focusedPath, JSON.stringify(focusedDataset, null, 2));
    
    console.log(`✅ ${agentName}: Selected ${selectedSamples.length} samples for optimization`);
    console.log(`   Groups: ${focusedGroups.length}`);
    console.log(`   File: ${focusedPath}`);
    
    return focusedDataset;
    
    } catch (error: any) {
    console.error(`❌ Error processing ${agent.name}:`, error.message);
    return { groups: [], currentGroupId: 'default' };
  }
}

async function main() {
  console.log('🎯 Creating Focused Dataset (20 Samples Per Agent)');
  console.log('=' .repeat(60));
  console.log('');

  const agents = [
    { name: 'planner', target: 20 },
    { name: 'browser-automation', target: 20 },
    { name: 'evaluator', target: 20 },
    { name: 'gemini-computer-use', target: 20 }
  ];

  for (const agent of agents) {
    console.log(`\n📋 Processing ${agent.name}...`);
    const dataset = createFocusedDataset(agent.name, agent.target);
    console.log(`   Final count: ${dataset.groups.reduce((sum, g) => sum + g.samples.length, 0)} samples`);
  }

  console.log('\n✅ Focused dataset creation complete!');
  console.log('\n📊 Summary:');
  console.log('   - 20 samples per agent selected');
  console.log('   - Diversity preserved across categories');
  console.log('   - High-quality samples prioritized');
  console.log('   - Ready for fast GEPA optimization');
}

main().catch(console.error);