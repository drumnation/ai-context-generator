/**
 * Senior Developer Analysis Rules for Code Understanding
 * Based on: https://blog.example.com/senior-dev-analysis
 * Purpose: Guide AI agents in analyzing code with senior developer patterns
 */

export interface AnalysisContext {
  /** Current feature being analyzed */
  currentFeature: string;
  /** Known system patterns */
  knownPatterns: Map<string, string>;
  /** Historical context if available */
  history?: {
    /** Previous code versions */
    versions: string[];
    /** Change history */
    changes: {
      date: string;
      description: string;
    }[];
  };
}

export const AgentRules = {
  /**
   * Core Analysis Pattern
   * Follow this sequence for every analysis task
   */
  analysisSequence: {
    // Phase 1: System Understanding
    buildContext: () => ({
      instruction: "Build system context before detailed analysis",
      steps: [
        "Identify core system files and entry points",
        "Group related files by feature (auth, db, etc.)",
        "Map dependencies between features"
      ],
      validation: [
        "Have core files been identified?",
        "Are feature groups clear?",
        "Are major dependencies mapped?"
      ]
    }),

    // Phase 2: Pattern Recognition
    identifyPatterns: (context: AnalysisContext) => ({
      instruction: "Look for recurring patterns across the system",
      focus: [
        "Error handling approaches",
        "State management patterns",
        "Data flow patterns",
        "Security implementations"
      ],
      action: "Compare current implementation with known patterns"
    }),

    // Phase 3: Impact Analysis
    evaluateImpact: (feature: string) => ({
      instruction: "Assess system-wide implications",
      checkpoints: [
        "Performance impact under load",
        "Security implications",
        "Effects on connected systems",
        "Race conditions in async operations"
      ]
    })
  },

  /**
   * Decision Making Logic
   * Use these rules to guide analysis decisions
   */
  decisionRules: {
    prioritization: [
      "Core system files > Feature implementations > Utility functions",
      "Security concerns > Performance issues > Style inconsistencies",
      "System-wide patterns > Local optimizations"
    ],
    
    whenToAlert: {
      security: ["Unauthorized data access", "Token validation issues"],
      performance: ["O(n²) operations", "Unnecessary database calls"],
      maintenance: ["Duplicated logic", "Inconsistent patterns"]
    }
  },

  /**
   * Analysis Directives
   * Core principles for code review
   */
  directives: {
    always: [
      "Build context before diving into details",
      "Consider system-wide impact of changes",
      "Look for similar patterns in other features",
      "Check historical context when available"
    ],
    never: [
      "Analyze files in isolation",
      "Ignore potential race conditions",
      "Skip security implications",
      "Overlook performance impact"
    ]
  },

  /**
   * Response Templates
   * Structure analysis output consistently
   */
  responseTemplates: {
    standardAnalysis: `
    System Context:
    - Feature Purpose: {purpose}
    - Related Systems: {systems}
    - Core Patterns: {patterns}

    Impact Analysis:
    - Performance: {performance}
    - Security: {security}
    - Connected Systems: {connections}

    Pattern Recognition:
    - Similar Implementations: {similarities}
    - Inconsistencies: {inconsistencies}
    - Suggested Improvements: {improvements}
    `,

    quickReview: `
    Key Points:
    - Main Impact: {impact}
    - Risk Level: {risk}
    - Action Items: {actions}
    `
  }
};

// Usage example:
/*
import { AgentRules } from './cursor-analysis-rules';

function analyzeCode(context: AnalysisContext) {
  // 1. Build Context
  const systemContext = AgentRules.analysisSequence.buildContext();
  validateContext(systemContext.validation);

  // 2. Identify Patterns
  const patterns = AgentRules.analysisSequence.identifyPatterns(context);
  
  // 3. Evaluate Impact
  const impact = AgentRules.analysisSequence.evaluateImpact(context.currentFeature);

  // 4. Format Response
  return formatAnalysis(AgentRules.responseTemplates.standardAnalysis, {
    // ... analysis results
  });
}
*/