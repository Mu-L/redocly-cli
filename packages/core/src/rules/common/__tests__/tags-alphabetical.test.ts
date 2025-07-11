import { outdent } from 'outdent';
import { lintDocument } from '../../../lint.js';
import { parseYamlToDocument, replaceSourceWithRef } from '../../../../__tests__/utils.js';
import { BaseResolver } from '../../../resolve.js';
import { createConfig } from '../../../config/index.js';

describe('Oas3 tags-alphabetical', () => {
  it('should report on tags object if not sorted alphabetically', async () => {
    const document = parseYamlToDocument(
      outdent`
          openapi: 3.0.0
          paths: {}
          tags:
            - name: b
            - name: a
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await createConfig({ rules: { 'tags-alphabetical': 'error' } }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      [
        {
          "location": [
            {
              "pointer": "#/tags/0",
              "reportOnKey": false,
              "source": "foobar.yaml",
            },
          ],
          "message": "The \`tags\` array should be in alphabetical order.",
          "ruleId": "tags-alphabetical",
          "severity": "error",
          "suggest": [],
        },
      ]
    `);
  });

  it('should not report on tags object if sorted alphabetically', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      paths: {}
      tags:
        - name: a
        - name: b
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await createConfig({ rules: { 'tags-alphabetical': 'error' } }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`[]`);
  });

  it('should report on tags object if not sorted alphabetically not ignoring case', async () => {
    const document = parseYamlToDocument(
      outdent`
          openapi: 3.0.0
          paths: {}
          tags:
            - name: a
            - name: B
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await createConfig({ rules: { 'tags-alphabetical': 'error' } }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      [
        {
          "location": [
            {
              "pointer": "#/tags/0",
              "reportOnKey": false,
              "source": "foobar.yaml",
            },
          ],
          "message": "The \`tags\` array should be in alphabetical order.",
          "ruleId": "tags-alphabetical",
          "severity": "error",
          "suggest": [],
        },
      ]
    `);
  });

  it('should not report on tags object if sorted alphabetically ignoring case', async () => {
    const document = parseYamlToDocument(
      outdent`
      openapi: 3.0.0
      paths: {}
      tags:
        - name: a
        - name: B
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await createConfig({
        rules: { 'tags-alphabetical': { severity: 'error', ignoreCase: true } },
      }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`[]`);
  });
});
