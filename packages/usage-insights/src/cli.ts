#!/usr/bin/env node

import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  USAGE_INSIGHTS_CAPABILITY_IDS_V1,
  USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1,
} from "../../contracts/src/usage-insights.js";
import {
  UsageInsightsLocalServiceV1,
  UsageInsightsLoopbackTransportV1,
  renderUsageInsightsDashboardV1,
} from "./index.js";

function takeFlag(args: string[], name: string, required = false): string | undefined {
  const positions = args.flatMap((value, index) => value === name ? [index] : []);
  if (positions.length > 1) throw new TypeError("DUPLICATE_ARGUMENT_DENIED");
  const position = positions[0];
  if (position === undefined) {
    if (required) throw new TypeError("REQUIRED_ARGUMENT_MISSING");
    return undefined;
  }
  const value = args[position + 1];
  if (value === undefined || value.startsWith("--")) throw new TypeError("REQUIRED_ARGUMENT_MISSING");
  args.splice(position, 2);
  return value;
}

function takeSwitch(args: string[], name: string): boolean {
  const positions = args.flatMap((value, index) => value === name ? [index] : []);
  if (positions.length > 1) throw new TypeError("DUPLICATE_ARGUMENT_DENIED");
  const position = positions[0];
  if (position === undefined) return false;
  args.splice(position, 1);
  return true;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value)) throw new TypeError("INTEGER_ARGUMENT_DENIED");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new TypeError("INTEGER_ARGUMENT_DENIED");
  return parsed;
}

function print(value: unknown): void {
  process.stdout.write(`${canonicalJson(value)}\n`);
}

function usage(): never {
  process.stderr.write([
    "Usage: usage-insights COMMAND [SUBCOMMAND] --store FILE [options]",
    "Commands:",
    "  consent show",
    "  consent grant --profile basic|capability|diagnostics [--diagnostics-ttl-ms N]",
    "  share enable --endpoint http://127.0.0.1:PORT/v1/usage-insights",
    "  share disable | share send",
    "  status | preview | export | report | revoke | rotate",
    "  record --capability ID --outcome OUTCOME",
    "  delete [--shared]",
    "Default: network OFF. Only explicit IP-literal loopback sharing is supported by this synthetic reference.",
  ].join("\n") + "\n");
  process.exit(2);
}

async function main(argv: readonly string[]): Promise<void> {
  const args = [...argv];
  const command = args.shift();
  if (command === undefined || command === "help" || command === "--help") usage();
  const subcommand = ["consent", "share"].includes(command) ? args.shift() : undefined;
  const store = takeFlag(args, "--store", true) as string;
  const service = UsageInsightsLocalServiceV1.open(store);

  if (command === "consent" && subcommand === "show") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.consentStatus());
    return;
  }
  if (command === "consent" && subcommand === "grant") {
    const profile = takeFlag(args, "--profile", true);
    const diagnosticsTtlMs = parsePositiveInteger(takeFlag(args, "--diagnostics-ttl-ms"));
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.grant(profile, Date.now(), diagnosticsTtlMs));
    return;
  }
  if (command === "share" && subcommand === "enable") {
    const endpoint = takeFlag(args, "--endpoint", true);
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.enableSharing(endpoint));
    return;
  }
  if (command === "share" && subcommand === "disable") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.disableSharing());
    return;
  }
  if (command === "share" && subcommand === "send") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(await service.share(new UsageInsightsLoopbackTransportV1()));
    return;
  }
  if (command === "record") {
    const capabilityId = takeFlag(args, "--capability", true);
    const lifecycleOutcome = takeFlag(args, "--outcome", true);
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    if (!(USAGE_INSIGHTS_CAPABILITY_IDS_V1 as readonly unknown[]).includes(capabilityId)
      || !(USAGE_INSIGHTS_LIFECYCLE_OUTCOMES_V1 as readonly unknown[]).includes(lifecycleOutcome)) {
      throw new TypeError("CLOSED_VOCABULARY_ARGUMENT_DENIED");
    }
    print(service.record({ capabilityId, lifecycleOutcome }));
    return;
  }
  if (command === "status") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.status());
    return;
  }
  if (command === "preview") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.preview());
    return;
  }
  if (command === "export") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.exportData());
    return;
  }
  if (command === "report") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    const report = service.localReport();
    print({ report, dashboard: renderUsageInsightsDashboardV1(report) });
    return;
  }
  if (command === "revoke") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(service.revoke());
    return;
  }
  if (command === "rotate") {
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print({ rotated: true, installationId: service.rotate() });
    return;
  }
  if (command === "delete") {
    const shared = takeSwitch(args, "--shared");
    if (args.length !== 0) throw new TypeError("UNKNOWN_ARGUMENT_DENIED");
    print(await service.deleteManagedData(shared ? new UsageInsightsLoopbackTransportV1() : undefined));
    return;
  }
  usage();
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "USAGE_INSIGHTS_COMMAND_FAILED";
  process.stderr.write(`${canonicalJson({ outcome: "DENIED", code })}\n`);
  process.exitCode = 1;
});
