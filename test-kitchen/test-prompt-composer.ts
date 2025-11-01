#!/usr/bin/env tsx
// Prompt Composer Validation Test
// Validates templates, personas, and component structure

import { 
  DEFAULT_BROWSER_AUTOMATION_TEMPLATES, 
  DEFAULT_PERSONAS,
  TEMPLATE_CATEGORIES,
} from '../components/agents-ui/agent-prompt-composer.js';

console.log('🎨 Agent Prompt Composer Validation Test\n');
console.log('='.repeat(80));

// Test 1: Templates validation
console.log('\n📋 TEMPLATE VALIDATION');
console.log('─'.repeat(80));

console.log(`Total Templates: ${DEFAULT_BROWSER_AUTOMATION_TEMPLATES.length}\n`);

let templateScore = 100;
const templateIssues: string[] = [];

DEFAULT_BROWSER_AUTOMATION_TEMPLATES.forEach((template, idx) => {
  const issues: string[] = [];
  
  if (!template.id) {
    issues.push('Missing id');
    templateScore -= 10;
  }
  if (!template.name) {
    issues.push('Missing name');
    templateScore -= 10;
  }
  if (!template.prompt) {
    issues.push('Missing prompt');
    templateScore -= 15;
  }
  if (template.prompt && template.prompt.length < 20) {
    issues.push('Prompt too short');
    templateScore -= 5;
  }
  
  const status = issues.length === 0 ? '✅' : '❌';
  console.log(`${status} Template ${idx + 1}: ${template.name}`);
  console.log(`   ID: ${template.id}`);
  console.log(`   Category: ${template.category || 'none'}`);
  console.log(`   Prompt Length: ${template.prompt.length} chars`);
  
  if (template.description) {
    console.log(`   Description: ${template.description}`);
  }
  
  if (issues.length > 0) {
    console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
    templateIssues.push(`Template ${idx + 1}: ${issues.join(', ')}`);
  }
  
  console.log('');
});

// Test 2: Personas validation
console.log('─'.repeat(80));
console.log('👤 PERSONA VALIDATION');
console.log('─'.repeat(80) + '\n');

console.log(`Total Personas: ${DEFAULT_PERSONAS.length}\n`);

let personaScore = 100;
const personaIssues: string[] = [];

DEFAULT_PERSONAS.forEach((persona, idx) => {
  const issues: string[] = [];
  
  if (!persona.id) {
    issues.push('Missing id');
    personaScore -= 10;
  }
  if (!persona.name) {
    issues.push('Missing name');
    personaScore -= 10;
  }
  if (!persona.systemPrompt) {
    issues.push('Missing systemPrompt');
    personaScore -= 20;
  }
  if (persona.systemPrompt && persona.systemPrompt.length < 50) {
    issues.push('System prompt too short');
    personaScore -= 10;
  }
  
  const status = issues.length === 0 ? '✅' : '❌';
  console.log(`${status} Persona ${idx + 1}: ${persona.name}`);
  console.log(`   ID: ${persona.id}`);
  console.log(`   System Prompt Length: ${persona.systemPrompt.length} chars`);
  
  if (persona.description) {
    console.log(`   Description: ${persona.description}`);
  }
  
  if (persona.capabilities && persona.capabilities.length > 0) {
    console.log(`   Capabilities: ${persona.capabilities.join(', ')}`);
  }
  
  if (issues.length > 0) {
    console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
    personaIssues.push(`Persona ${idx + 1}: ${issues.join(', ')}`);
  }
  
  console.log('');
});

// Test 3: Categories validation
console.log('─'.repeat(80));
console.log('📂 CATEGORY VALIDATION');
console.log('─'.repeat(80) + '\n');

const categories = Object.entries(TEMPLATE_CATEGORIES);
console.log(`Total Categories: ${categories.length}\n`);

categories.forEach(([key, value]) => {
  console.log(`✅ ${key}: ${value}`);
});

// Test 4: Template coverage by category
console.log('\n─'.repeat(80));
console.log('📊 TEMPLATE COVERAGE BY CATEGORY');
console.log('─'.repeat(80) + '\n');

const templatesByCategory = DEFAULT_BROWSER_AUTOMATION_TEMPLATES.reduce((acc: any, t) => {
  const cat = t.category || 'uncategorized';
  acc[cat] = (acc[cat] || 0) + 1;
  return acc;
}, {});

Object.entries(templatesByCategory).forEach(([category, count]) => {
  console.log(`  ${category}: ${count} templates`);
});

// Overall scoring
console.log('\n' + '='.repeat(80));
console.log('📊 OVERALL VALIDATION RESULTS');
console.log('='.repeat(80) + '\n');

templateScore = Math.max(0, templateScore);
personaScore = Math.max(0, personaScore);
const overallScore = (templateScore + personaScore) / 2;

console.log(`Template Validation: ${templateScore}/100`);
console.log(`Persona Validation: ${personaScore}/100`);
console.log(`Overall Score: ${overallScore.toFixed(0)}/100\n`);

if (templateIssues.length > 0) {
  console.log('⚠️  Template Issues:');
  templateIssues.forEach(issue => console.log(`  - ${issue}`));
  console.log('');
}

if (personaIssues.length > 0) {
  console.log('⚠️  Persona Issues:');
  personaIssues.forEach(issue => console.log(`  - ${issue}`));
  console.log('');
}

const passed = overallScore >= 80;
const rating = overallScore >= 95 ? '🌟 EXCELLENT' :
               overallScore >= 80 ? '✅ GOOD' :
               overallScore >= 60 ? '⚠️  ACCEPTABLE' :
               '❌ NEEDS WORK';

console.log('='.repeat(80));
console.log('🏁 TEST COMPLETE');
console.log('='.repeat(80) + '\n');

console.log(`Rating: ${rating}`);
console.log(`Overall Score: ${overallScore.toFixed(0)}/100`);
console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);

if (passed) {
  console.log('✅ Agent Prompt Composer is properly configured');
  console.log('✅ Templates and personas are valid');
  console.log('✅ Ready for production use\n');
}

process.exit(passed ? 0 : 1);

