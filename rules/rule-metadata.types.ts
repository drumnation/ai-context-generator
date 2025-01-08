export interface RuleMetadata {
  id: string;
  version: string;
  category: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  applicability?: {
    filePatterns?: string[];
    contentPatterns?: string[];
  };
  validation?: {
    lintRules?: string[];
  };
}
