import type { Oas2Definition, Oas3_1Definition, Oas3Definition } from '@redocly/openapi-core';

export type Definition = Oas3_1Definition | Oas3Definition | Oas2Definition;
export interface ComponentsFiles {
  [schemas: string]: any;
}
export interface RefObject {
  [$ref: string]: string;
}

export const COMPONENTS = 'components';
export const PATHS = 'paths';
export const WEBHOOKS = 'webhooks';
export const xWEBHOOKS = 'x-webhooks';

export type Oas3Method = typeof OPENAPI3_METHOD_NAMES[number];
export const OPENAPI3_METHOD_NAMES = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export type Oas3Component = typeof OPENAPI3_COMPONENT_NAMES[number];
export const OPENAPI3_COMPONENT_NAMES = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'headers',
  'requestBodies',
  'links',
  'callbacks',
  'securitySchemes',
] as const;
