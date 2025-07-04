import type { RawGovernanceConfig } from './types.js';

const spec: RawGovernanceConfig<'built-in'> = {
  rules: {
    struct: 'error',
  },
  // TODO: populate with spec-related rules similar to `arazzo1Rules` (v2)
  oas2Rules: {},
  oas3_0Rules: {},
  oas3_1Rules: {},
  async2Rules: {},
  async3Rules: {},
  arazzo1Rules: {
    'sourceDescription-type': 'error',
    'respect-supported-versions': 'off',
    'workflowId-unique': 'error',
    'stepId-unique': 'error',
    'sourceDescription-name-unique': 'error',
    'sourceDescriptions-not-empty': 'error',
    'workflow-dependsOn': 'error',
    'parameters-unique': 'error',
    'step-onSuccess-unique': 'error',
    'step-onFailure-unique': 'error',
    'requestBody-replacements-unique': 'error',
    'no-criteria-xpath': 'off',
    'criteria-unique': 'error',
    'no-x-security-scheme-name-without-openapi': 'off',
    'x-security-scheme-required-values': 'off',
    'no-x-security-scheme-name-in-workflow': 'off',
  },
  overlay1Rules: {
    'info-contact': 'warn',
  },
};

export default spec;
