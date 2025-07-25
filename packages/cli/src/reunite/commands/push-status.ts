import * as colors from 'colorette';
import { logger } from '@redocly/openapi-core';
import { printExecutionTime, capitalize } from '../../utils/miscellaneous.js';
import { Spinner } from '../../utils/spinner.js';
import { DeploymentError } from '../utils.js';
import { ReuniteApi, getApiKeys, getDomain } from '../api/index.js';
import { handleReuniteError, retryUntilConditionMet } from './utils.js';

import type { OutputFormat } from '@redocly/openapi-core';
import type { CommandArgs } from '../../wrapper.js';
import type {
  DeploymentStatus,
  DeploymentStatusResponse,
  PushResponse,
  ScorecardItem,
} from '../api/types.js';
import type { VerifyConfigOptions } from '../../types.js';

const RETRY_INTERVAL_MS = 5000; // 5 sec

export type PushStatusArgv = {
  organization: string;
  project: string;
  pushId: string;
  domain?: string;
  format?: Extract<OutputFormat, 'stylish'>;
  wait?: boolean;
  'max-execution-time'?: number; // in seconds
  'retry-interval'?: number; // in seconds
  'start-time'?: number; // in milliseconds
  'continue-on-deploy-failures'?: boolean;
  onRetry?: (lasSummary: PushStatusSummary) => void;
} & VerifyConfigOptions;

export interface PushStatusSummary {
  preview: DeploymentStatusResponse;
  production: DeploymentStatusResponse | null;
  commit: PushResponse['commit'];
}

export async function handlePushStatus({
  argv,
  version,
}: CommandArgs<PushStatusArgv>): Promise<PushStatusSummary | void> {
  const startedAt = performance.now();
  const spinner = new Spinner();

  const { organization, project: projectId, pushId, wait } = argv;

  const domain = argv.domain || getDomain();
  const maxExecutionTime = argv['max-execution-time'] || 1200; // 20 min
  const retryIntervalMs = argv['retry-interval']
    ? argv['retry-interval'] * 1000
    : RETRY_INTERVAL_MS;
  const startTime = argv['start-time'] || Date.now();
  const retryTimeoutMs = maxExecutionTime * 1000;
  const continueOnDeployFailures = argv['continue-on-deploy-failures'] || false;

  try {
    const apiKey = getApiKeys();
    const client = new ReuniteApi({ domain, apiKey, version, command: 'push-status' });

    let pushResponse: PushResponse;

    pushResponse = await retryUntilConditionMet({
      operation: () =>
        client.remotes.getPush({
          organizationId: organization,
          projectId,
          pushId,
        }),
      condition: wait
        ? // Keep retrying if status is "pending" or "running" (returning false, so the operation will be retried)
          (result) => !['pending', 'running'].includes(result.status['preview'].deploy.status)
        : null,
      onConditionNotMet: (lastResult) => {
        displayDeploymentAndBuildStatus({
          status: lastResult.status['preview'].deploy.status,
          url: lastResult.status['preview'].deploy.url,
          spinner,
          buildType: 'preview',
          continueOnDeployFailures,
          wait,
        });
      },
      onRetry: (lastResult) => {
        if (argv.onRetry) {
          argv.onRetry({
            preview: lastResult.status.preview,
            production: lastResult.isMainBranch ? lastResult.status.production : null,
            commit: lastResult.commit,
          });
        }
      },
      startTime,
      retryTimeoutMs,
      retryIntervalMs,
    });

    printPushStatus({
      buildType: 'preview',
      spinner,
      wait,
      push: pushResponse,
      continueOnDeployFailures,
    });
    printScorecard(pushResponse.status.preview.scorecard);

    const shouldWaitForProdDeployment =
      pushResponse.isMainBranch &&
      (wait ? pushResponse.status.preview.deploy.status === 'success' : true);

    if (shouldWaitForProdDeployment) {
      pushResponse = await retryUntilConditionMet({
        operation: () =>
          client.remotes.getPush({
            organizationId: organization,
            projectId,
            pushId,
          }),
        condition: wait
          ? // Keep retrying if status is "pending" or "running" (returning false, so the operation will be retried)
            (result) => !['pending', 'running'].includes(result.status['production'].deploy.status)
          : null,
        onConditionNotMet: (lastResult) => {
          displayDeploymentAndBuildStatus({
            status: lastResult.status['production'].deploy.status,
            url: lastResult.status['production'].deploy.url,
            spinner,
            buildType: 'production',
            continueOnDeployFailures,
            wait,
          });
        },
        onRetry: (lastResult) => {
          if (argv.onRetry) {
            argv.onRetry({
              preview: lastResult.status.preview,
              production: lastResult.isMainBranch ? lastResult.status.production : null,
              commit: lastResult.commit,
            });
          }
        },
        startTime,
        retryTimeoutMs,
        retryIntervalMs,
      });
    }

    if (pushResponse.isMainBranch) {
      printPushStatus({
        buildType: 'production',
        spinner,
        wait,
        push: pushResponse,
        continueOnDeployFailures,
      });
      printScorecard(pushResponse.status.production.scorecard);
    }
    printPushStatusInfo({ organization, projectId, pushId, startedAt });

    client.reportSunsetWarnings();

    const summary: PushStatusSummary = {
      preview: pushResponse.status.preview,
      production: pushResponse.isMainBranch ? pushResponse.status.production : null,
      commit: pushResponse.commit,
    };

    return summary;
  } catch (err) {
    spinner.stop(); // Spinner can block process exit, so we need to stop it explicitly.

    handleReuniteError('✗ Failed to get push status.', err);
  } finally {
    spinner.stop(); // Spinner can block process exit, so we need to stop it explicitly.
  }
}

function printPushStatusInfo({
  organization,
  projectId,
  pushId,
  startedAt,
}: {
  organization: string;
  projectId: string;
  pushId: string;
  startedAt: number;
}) {
  logger.info(
    `\nProcessed push-status for ${colors.yellow(organization)}, ${colors.yellow(
      projectId
    )} and pushID ${colors.yellow(pushId)}.\n`
  );
  printExecutionTime('push-status', startedAt, 'Finished');
}

function printPushStatus({
  buildType,
  spinner,
  push,
  continueOnDeployFailures,
}: {
  buildType: 'preview' | 'production';
  spinner: Spinner;
  wait?: boolean;
  push?: PushResponse | null;
  continueOnDeployFailures: boolean;
}) {
  if (!push) {
    return;
  }
  if (push.isOutdated || !push.hasChanges) {
    logger.warn(
      `Files not added to your project. Reason: ${push.isOutdated ? 'outdated' : 'no changes'}.\n`
    );
  } else {
    displayDeploymentAndBuildStatus({
      status: push.status[buildType].deploy.status,
      url: push.status[buildType].deploy.url,
      buildType,
      spinner,
      continueOnDeployFailures,
    });
  }
}

function printScorecard(scorecard?: ScorecardItem[]) {
  if (!scorecard || scorecard.length === 0) {
    return;
  }
  logger.output(`\n${colors.magenta('Scorecard')}:`);
  for (const scorecardItem of scorecard) {
    logger.output(`
    ${colors.magenta('Name')}: ${scorecardItem.name}
    ${colors.magenta('Status')}: ${scorecardItem.status}
    ${colors.magenta('URL')}: ${colors.cyan(scorecardItem.url)}
    ${colors.magenta('Description')}: ${scorecardItem.description}\n`);
  }
  logger.output(`\n`);
}

function displayDeploymentAndBuildStatus({
  status,
  url,
  spinner,
  buildType,
  continueOnDeployFailures,
  wait,
}: {
  status: DeploymentStatus;
  url: string | null;
  spinner: Spinner;
  buildType: 'preview' | 'production';
  continueOnDeployFailures: boolean;
  wait?: boolean;
}) {
  const message = getMessage({ status, url, buildType, wait });

  if (status === 'failed' && !continueOnDeployFailures) {
    spinner.stop();
    throw new DeploymentError(message);
  }

  if (wait && (status === 'pending' || status === 'running')) {
    return spinner.start(message);
  }

  spinner.stop();

  return logger.output(message);
}

function getMessage({
  status,
  url,
  buildType,
  wait,
}: {
  status: DeploymentStatus;
  url: string | null;
  buildType: 'preview' | 'production';
  wait?: boolean;
}): string {
  switch (status) {
    case 'skipped':
      return `${colors.yellow(`Skipped ${buildType}`)}\n`;

    case 'pending': {
      const message = `${colors.yellow(`Pending ${buildType}`)}`;
      return wait ? message : `Status: ${message}\n`;
    }
    case 'running': {
      const message = `${colors.yellow(`Running ${buildType}`)}`;
      return wait ? message : `Status: ${message}\n`;
    }
    case 'success':
      return `${colors.green(`🚀 ${capitalize(buildType)} deploy success.`)}\n${colors.magenta(
        `${capitalize(buildType)} URL`
      )}: ${colors.cyan(url || 'No URL yet.')}\n`;

    case 'failed':
      return `${colors.red(`❌ ${capitalize(buildType)} deploy fail.`)}\n${colors.magenta(
        `${capitalize(buildType)} URL`
      )}: ${colors.cyan(url || 'No URL yet.')}`;

    default: {
      const message = `${colors.yellow(`No status yet for ${buildType} deploy`)}`;

      return wait ? message : `Status: ${message}\n`;
    }
  }
}
