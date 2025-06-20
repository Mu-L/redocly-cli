import { outdent } from 'outdent';
import { lintDocument } from '../../../lint.js';
import { parseYamlToDocument, replaceSourceWithRef } from '../../../../__tests__/utils.js';
import { BaseResolver } from '../../../resolve.js';
import { createConfig } from '../../../config/index.js';

describe('no-identical-paths', () => {
  it('should report on identical paths', async () => {
    const document = parseYamlToDocument(
      outdent`
        openapi: 3.0.0
        paths:
          '/good/{id}':
            get:
              summary: List all pets
          '/good/last':
            get:
              summary: List all pets
          '/bad/{id}':
            get:
              summary: List all pets
          '/good/{hash}':
            get:
              summary: List all pets
          '/{id}/valid':
            get:
              summary: List all pets
          '/valid/{id}':
            get:
              summary: List all pets
        `,
      'foobar.yaml'
    );

    const results = await lintDocument({
      externalRefResolver: new BaseResolver(),
      document,
      config: await createConfig({ rules: { 'no-identical-paths': 'error' } }),
    });

    expect(replaceSourceWithRef(results)).toMatchInlineSnapshot(`
      [
        {
          "location": [
            {
              "pointer": "#/paths/~1good~1{hash}",
              "reportOnKey": true,
              "source": "foobar.yaml",
            },
          ],
          "message": "The path already exists which differs only by path parameter name(s): \`/good/{id}\` and \`/good/{hash}\`.",
          "ruleId": "no-identical-paths",
          "severity": "error",
          "suggest": [],
        },
      ]
    `);
  });
});
