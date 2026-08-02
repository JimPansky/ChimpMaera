import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readCanonicalCompanyData, validateCompanyDataPack } from "./validate-company-data-pack.mjs";

const EDGE_CLASSES = new Set(["HARD", "SOFT", "DERIVED", "TEMPORAL", "CROSS_SYSTEM"]);
const CARDINALITIES = new Set(["many-to-one", "many-to-many"]);
const STAGES = ["create", "link", "activate"];

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function addViolation(violations, code, path, message) {
  violations.push({ code, path, message });
}

function directCyclePairs(edges) {
  const pairs = new Map();
  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join("|");
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(edge);
  }
  return [...pairs.entries()].filter(([key, pairEdges]) => {
    const [left, right] = key.split("|");
    return left === right || (
      pairEdges.some((edge) => edge.from === left && edge.to === right)
      && pairEdges.some((edge) => edge.from === right && edge.to === left)
    );
  });
}

function buildStagedDag(graph, violations) {
  const operations = new Map();
  for (const node of graph.nodes) {
    for (const stage of STAGES) {
      const id = `${node.id}:${stage}`;
      operations.set(id, { id, nodeId: node.id, stage, declaredWave: node.load.wave, dependsOn: new Set() });
    }
    operations.get(`${node.id}:link`).dependsOn.add(`${node.id}:create`);
    operations.get(`${node.id}:activate`).dependsOn.add(`${node.id}:link`);
  }
  for (const edge of graph.edges) {
    const operation = edge.createOrder === "PATCH_AFTER" ? `${edge.from}:link` : `${edge.from}:create`;
    operations.get(operation)?.dependsOn.add(`${edge.to}:create`);
  }

  const pending = new Map([...operations].map(([id, operation]) => [id, new Set(operation.dependsOn)]));
  const order = [];
  while (pending.size > 0) {
    const ready = [...pending.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort((left, right) => {
        const a = operations.get(left);
        const b = operations.get(right);
        return a.declaredWave - b.declaredWave || STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || left.localeCompare(right);
      });
    if (ready.length === 0) {
      addViolation(violations, "UNCLASSIFIED_CYCLE", "$.edges", `Staged operation graph retains ${pending.size} cyclic operations.`);
      return null;
    }
    for (const id of ready) {
      order.push(id);
      pending.delete(id);
      for (const dependencies of pending.values()) dependencies.delete(id);
    }
  }
  const emitted = order.map((id, sequence) => {
    const operation = operations.get(id);
    return {
      sequence: sequence + 1,
      id,
      nodeId: operation.nodeId,
      stage: operation.stage,
      declaredWave: operation.declaredWave,
      dependsOn: [...operation.dependsOn].sort()
    };
  });
  return {
    schemaVersion: "chimpmaera.company-data-staged-dag/v1",
    operationCount: emitted.length,
    digest: sha256(stableJson(emitted)),
    operations: emitted
  };
}

function cents(value, path, violations) {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) {
    addViolation(violations, "MONEY_RULE_VIOLATION", path, `Expected a decimal money string; received ${String(value)}.`);
    return null;
  }
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -result : result;
}

function quantity(value, path, violations) {
  const parsed = typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    addViolation(violations, "QUANTITY_RULE_VIOLATION", path, `Expected a non-negative decimal quantity; received ${String(value)}.`);
    return null;
  }
  return parsed;
}

function validateMoneyAndQuantity(pack, byId, violations) {
  const objectsOf = (type) => pack.objects.filter((object) => object.objectType === type);
  const lineNet = (line, path) => {
    const units = quantity(line.values.quantity, `${path}.values.quantity`, violations);
    const unitPrice = cents(line.values.unitPrice, `${path}.values.unitPrice`, violations);
    return units === null || unitPrice === null ? null : BigInt(Math.round(units * Number(unitPrice)));
  };

  for (const [type, lineType, reference] of [
    ["SALES-ORDER", "SALES-ORDER-LINE", "salesOrderId"],
    ["PROC-PURCHASE-ORDER", "PROC-PO-LINE", "purchaseOrderId"]
  ]) {
    for (const header of objectsOf(type)) {
      const lines = objectsOf(lineType).filter((line) => line.references[reference] === header.canonicalId);
      const computed = lines.reduce((total, line, index) => total + (lineNet(line, `$.objects.${lineType}[${index}]`) ?? 0n), 0n);
      const declared = cents(header.values.totalNet, `$.objects.${header.canonicalId}.values.totalNet`, violations);
      if (declared !== null && declared !== computed) {
        addViolation(violations, "MONEY_RULE_VIOLATION", `$.objects.${header.canonicalId}.values.totalNet`, `Declared ${declared} cents; lines total ${computed} cents.`);
      }
    }
  }

  for (const [headerType, lineType, reference] of [
    ["AR-CUSTOMER-INVOICE", "AR-CUSTOMER-INVOICE-LINE", "customerInvoiceId"],
    ["PROC-SUPPLIER-INVOICE", "PROC-SUPPLIER-INVOICE-LINE", "supplierInvoiceId"]
  ]) {
    for (const header of objectsOf(headerType)) {
      const lines = objectsOf(lineType).filter((line) => line.references[reference] === header.canonicalId);
      let computed = 0n;
      for (const [index, line] of lines.entries()) {
        const net = lineNet(line, `$.objects.${lineType}[${index}]`);
        const tax = byId.get(line.references.taxCodeId);
        const rate = Number(tax?.values?.rate);
        if (net === null || !Number.isFinite(rate)) {
          addViolation(violations, "MONEY_RULE_VIOLATION", `$.objects.${line.canonicalId}.references.taxCodeId`, "Tax code or rate is missing.");
          continue;
        }
        computed += BigInt(Math.round(Number(net) * (1 + rate / 100)));
      }
      const declared = cents(header.values.totalGross, `$.objects.${header.canonicalId}.values.totalGross`, violations);
      if (declared !== null && declared !== computed) {
        addViolation(violations, "MONEY_RULE_VIOLATION", `$.objects.${header.canonicalId}.values.totalGross`, `Declared ${declared} cents; taxed lines total ${computed} cents.`);
      }
    }
  }

  for (const invoice of objectsOf("AR-CUSTOMER-INVOICE")) {
    const gross = cents(invoice.values.totalGross, `$.objects.${invoice.canonicalId}.values.totalGross`, violations);
    const allocations = objectsOf("AR-ALLOCATION").filter((item) => item.references.documentId === invoice.canonicalId);
    const credits = objectsOf("AR-CREDIT-NOTE").filter((item) => item.references.customerInvoiceId === invoice.canonicalId);
    const applied = [...allocations, ...credits].reduce((total, item) => total + (cents(item.values.amount, `$.objects.${item.canonicalId}.values.amount`, violations) ?? 0n), 0n);
    if (gross !== null && applied > gross) addViolation(violations, "MONEY_RULE_VIOLATION", `$.objects.${invoice.canonicalId}`, "Allocations plus issued credits exceed invoice gross.");
  }

  for (const orderLine of objectsOf("SALES-ORDER-LINE")) {
    const ordered = quantity(orderLine.values.quantity, `$.objects.${orderLine.canonicalId}.values.quantity`, violations);
    const delivered = objectsOf("AR-DELIVERY-LINE")
      .filter((line) => line.references.salesOrderLineId === orderLine.canonicalId)
      .reduce((total, line) => total + (quantity(line.values.quantity, `$.objects.${line.canonicalId}.values.quantity`, violations) ?? 0), 0);
    const returned = objectsOf("AR-RETURN-AUTHORIZATION")
      .filter((rma) => rma.references.salesOrderLineId === orderLine.canonicalId)
      .reduce((total, rma) => total + (quantity(rma.values.quantity, `$.objects.${rma.canonicalId}.values.quantity`, violations) ?? 0), 0);
    if (ordered !== null && delivered > ordered) addViolation(violations, "QUANTITY_RULE_VIOLATION", `$.objects.${orderLine.canonicalId}`, "Delivered quantity exceeds ordered quantity.");
    if (returned > delivered) addViolation(violations, "QUANTITY_RULE_VIOLATION", `$.objects.${orderLine.canonicalId}`, "Returned quantity exceeds delivered quantity.");
  }

  for (const poLine of objectsOf("PROC-PO-LINE")) {
    const ordered = quantity(poLine.values.quantity, `$.objects.${poLine.canonicalId}.values.quantity`, violations);
    const receiptLines = objectsOf("PROC-RECEIPT-LINE").filter((line) => line.references.poLineId === poLine.canonicalId);
    const accepted = receiptLines.reduce((total, line) => total + (quantity(line.values.quantityAccepted, `$.objects.${line.canonicalId}.values.quantityAccepted`, violations) ?? 0), 0);
    const rejected = receiptLines.reduce((total, line) => total + (quantity(line.values.quantityRejected, `$.objects.${line.canonicalId}.values.quantityRejected`, violations) ?? 0), 0);
    const invoiced = objectsOf("PROC-SUPPLIER-INVOICE-LINE")
      .filter((line) => line.references.poLineId === poLine.canonicalId)
      .reduce((total, line) => total + (quantity(line.values.quantity, `$.objects.${line.canonicalId}.values.quantity`, violations) ?? 0), 0);
    if (ordered !== null && accepted + rejected > ordered) addViolation(violations, "QUANTITY_RULE_VIOLATION", `$.objects.${poLine.canonicalId}`, "Received quantity exceeds ordered quantity.");
    if (invoiced > accepted) addViolation(violations, "QUANTITY_RULE_VIOLATION", `$.objects.${poLine.canonicalId}`, "Supplier-invoiced quantity exceeds accepted quantity.");
  }
}

function validateCustomerAssets(pack, byId, violations) {
  for (const asset of pack.objects.filter((object) => object.objectType === "PROJECT-INSTALLED-ASSET")) {
    const site = byId.get(asset.references.siteId);
    const deliveryLine = byId.get(asset.references.originDeliveryLineId);
    const delivery = byId.get(deliveryLine?.references?.deliveryId);
    const order = byId.get(delivery?.references?.salesOrderId);
    const customers = [asset.references.customerId, site?.references?.customerId, order?.references?.customerId];
    if (customers.some((customer) => typeof customer !== "string") || new Set(customers).size !== 1) {
      addViolation(violations, "CROSS_CUSTOMER_ASSET", `$.objects.${asset.canonicalId}.references`, "Asset, customer site and delivery/order provenance must resolve to one customer.");
    }
  }
}

export function validateCompanyDataGraph(input) {
  const violations = [];
  const checks = [];
  const dataPackReceipt = validateCompanyDataPack(input);
  if (!dataPackReceipt.success) addViolation(violations, "DATA_001_PRECONDITION", "$", "DATA-001 validation must pass before DATA-002.");
  checks.push({ id: "DATA_001_PRECONDITION", passed: dataPackReceipt.success });
  if (!dataPackReceipt.success) return makeReceipt({ violations, checks, dataPackReceipt, stagedDag: null });

  let graph;
  let catalog;
  try {
    graph = JSON.parse(input.graphBytes);
    catalog = JSON.parse(input.catalogBytes);
  } catch (error) {
    addViolation(violations, "GRAPH_JSON_INVALID", "$", error.message);
  }
  if (!graph || !catalog || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(catalog.objects)) {
    if (graph && catalog) addViolation(violations, "GRAPH_STRUCTURE_INVALID", "$", "Graph nodes, edges and catalog objects must be arrays.");
    return makeReceipt({ violations, checks, dataPackReceipt, stagedDag: null, graph, catalog });
  }

  const nodeIds = new Set();
  const nodeMap = new Map();
  for (const [index, node] of graph.nodes.entries()) {
    if (nodeIds.has(node.id)) addViolation(violations, "DUPLICATE_GRAPH_NODE", `$.nodes[${index}].id`, `Duplicate node ${node.id}.`);
    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
    if (!Array.isArray(node.lifecycle?.states) || node.lifecycle.states.length === 0 || new Set(node.lifecycle.states).size !== node.lifecycle.states.length) {
      addViolation(violations, "STATE_RULE_VIOLATION", `$.nodes[${index}].lifecycle.states`, "Lifecycle states must be non-empty and unique.");
    }
    if (!Number.isInteger(node.load?.wave) || node.load.wave < 0 || node.load.wave > 9 || stableJson(node.load?.stages) !== stableJson(STAGES)) {
      addViolation(violations, "GRAPH_STRUCTURE_INVALID", `$.nodes[${index}].load`, "Every node must declare create/link/activate in wave 0..9.");
    }
  }
  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    if (edgeIds.has(edge.id)) addViolation(violations, "DUPLICATE_GRAPH_EDGE", `$.edges[${index}].id`, `Duplicate edge ${edge.id}.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) addViolation(violations, "MISSING_PREREQUISITE", `$.edges[${index}]`, "Edge endpoint does not exist.");
    if (!CARDINALITIES.has(edge.cardinality)) addViolation(violations, "CARDINALITY_INVALID", `$.edges[${index}].cardinality`, `Unsupported cardinality ${edge.cardinality}.`);
    if (!Array.isArray(edge.classes) || edge.classes.length === 0 || edge.classes.some((value) => !EDGE_CLASSES.has(value))) {
      addViolation(violations, "GRAPH_STRUCTURE_INVALID", `$.edges[${index}].classes`, "Edge classes are missing or unknown.");
    }
    if (!/^[A-Za-z][A-Za-z0-9]*Id(s)?$/.test(edge.relation)) addViolation(violations, "GRAPH_STRUCTURE_INVALID", `$.edges[${index}].relation`, "Relation must be a typed ID field.");
  }
  const metrics = graph.metrics ?? {};
  if (graph.nodes.length !== 90 || graph.edges.length !== 193 || metrics.totalNodes !== 90 || metrics.totalEdges !== 193 || metrics.loadWaves !== 10) {
    addViolation(violations, "GRAPH_METRICS_MISMATCH", "$.metrics", "Expected 90 nodes, 193 edges and ten load waves.");
  }
  for (const edgeClass of EDGE_CLASSES) {
    const actual = graph.edges.filter((edge) => edge.classes.includes(edgeClass)).length;
    if (metrics.edgeClassCounts?.[edgeClass] !== actual) addViolation(violations, "GRAPH_METRICS_MISMATCH", `$.metrics.edgeClassCounts.${edgeClass}`, `Expected recomputed count ${actual}.`);
  }
  checks.push({ id: "GRAPH_STRUCTURE", passed: !violations.some(({ code }) => ["DUPLICATE_GRAPH_NODE", "DUPLICATE_GRAPH_EDGE", "GRAPH_STRUCTURE_INVALID", "GRAPH_METRICS_MISMATCH"].includes(code)) });

  const catalogIds = new Set(catalog.objects.map((object) => object.id));
  const graphCatalogIds = new Set(graph.nodes.filter((node) => node.catalogObject === true).map((node) => node.id));
  const extensions = graph.nodes.filter((node) => node.catalogObject === false);
  const coverageValid = catalog.objects.length === 88 && graphCatalogIds.size === 88 && extensions.length === 2
    && [...catalogIds].every((id) => graphCatalogIds.has(id)) && [...graphCatalogIds].every((id) => catalogIds.has(id));
  if (!coverageValid) addViolation(violations, "SOURCE_COVERAGE_MISMATCH", "$.nodes", "Graph must cover all 88 catalog objects exactly once plus two labelled extensions.");
  checks.push({ id: "SOURCE_COVERAGE_88_OF_88", passed: coverageValid });

  const byId = new Map(input.pack.objects.map((object) => [object.canonicalId, object]));
  for (const [index, object] of input.pack.objects.entries()) {
    const node = nodeMap.get(object.objectType);
    if (!node) addViolation(violations, "UNKNOWN_OBJECT_TYPE", `$.objects[${index}].objectType`, `Graph node ${object.objectType} is absent.`);
    for (const required of node?.requiredReferences ?? []) {
      if (!(required in object.references)) addViolation(violations, "MISSING_PREREQUISITE", `$.objects[${index}].references.${required}`, "Required graph reference is absent.");
    }
    for (const [relation, value] of Object.entries(object.references ?? {})) {
      const references = Array.isArray(value) ? value : [value];
      const edge = graph.edges.find((candidate) => candidate.from === object.objectType && candidate.relation === relation);
      if (edge?.cardinality === "many-to-one" && Array.isArray(value)) addViolation(violations, "CARDINALITY_INVALID", `$.objects[${index}].references.${relation}`, "many-to-one reference must be scalar.");
      if (edge?.cardinality === "many-to-many" && !Array.isArray(value)) addViolation(violations, "CARDINALITY_INVALID", `$.objects[${index}].references.${relation}`, "many-to-many reference must be an array.");
      for (const reference of references) {
        const target = byId.get(reference);
        if (!target) addViolation(violations, "MISSING_PREREQUISITE", `$.objects[${index}].references.${relation}`, `Reference ${reference} does not resolve.`);
        else if (edge && target.objectType !== edge.to) addViolation(violations, "REFERENCE_TYPE_MISMATCH", `$.objects[${index}].references.${relation}`, `Expected ${edge.to}; read ${target.objectType}.`);
      }
    }
  }
  for (const node of graph.nodes) {
    for (const relation of [...(node.requiredReferences ?? []), ...(node.optionalReferences ?? [])]) {
      if (!graph.edges.some((edge) => edge.from === node.id && edge.relation === relation)) addViolation(violations, "GRAPH_REFERENCE_UNMODELED", `$.nodes.${node.id}.${relation}`, "Declared reference has no graph edge.");
    }
  }
  checks.push({ id: "REFERENCES_AND_CARDINALITY", passed: !violations.some(({ code }) => ["MISSING_PREREQUISITE", "CARDINALITY_INVALID", "REFERENCE_TYPE_MISMATCH", "GRAPH_REFERENCE_UNMODELED"].includes(code)) });

  const groups = graph.cycleGroups ?? [];
  if (groups.length !== 6 || graph.metrics.classifiedCycles !== 6 || new Set(groups.map((group) => group.id)).size !== 6) {
    addViolation(violations, "CYCLE_CLASSIFICATION_MISMATCH", "$.cycleGroups", "Exactly six uniquely named cycle groups are required.");
  }
  for (const [key] of directCyclePairs(graph.edges)) {
    const [left, right] = key.split("|");
    if (!groups.some((group) => group.nodes.includes(left) && group.nodes.includes(right))) {
      addViolation(violations, "UNCLASSIFIED_CYCLE", "$.cycleGroups", `Cycle ${left}<->${right} is not classified.`);
    }
  }
  for (const group of groups) {
    if (!group.nodes.every((id) => nodeIds.has(id)) || typeof group.resolution !== "string" || group.resolution.length < 10) {
      addViolation(violations, "CYCLE_CLASSIFICATION_MISMATCH", `$.cycleGroups.${group.id}`, "Cycle nodes or staged resolution are invalid.");
    }
  }
  const stagedDag = buildStagedDag(graph, violations);
  if (stagedDag?.operationCount !== 270) addViolation(violations, "STAGED_DAG_INVALID", "$.stagedDag", "Expected three staged operations for each of 90 nodes.");
  checks.push({ id: "SIX_CLASSIFIED_CYCLES_AND_STAGED_DAG", passed: !violations.some(({ code }) => ["CYCLE_CLASSIFICATION_MISMATCH", "UNCLASSIFIED_CYCLE", "STAGED_DAG_INVALID"].includes(code)) });

  const fixedClock = Date.parse(input.pack.fixedClock);
  for (const [index, object] of input.pack.objects.entries()) {
    const states = new Set(nodeMap.get(object.objectType)?.lifecycle?.states ?? []);
    if (!states.has(object.state)) addViolation(violations, "ILLEGAL_TRANSITION", `$.objects[${index}].state`, `State ${object.state} is outside the lifecycle.`);
    const effective = Date.parse(object.effectiveAt);
    if (!Number.isFinite(effective) || effective > fixedClock) addViolation(violations, "TIME_TRAVEL", `$.objects[${index}].effectiveAt`, "Effective time is invalid or after the fixed clock.");
    let priorState = null;
    let priorTime = Number.NEGATIVE_INFINITY;
    for (const [transitionIndex, transition] of (object.transitions ?? []).entries()) {
      const path = `$.objects[${index}].transitions[${transitionIndex}]`;
      if (transition.sequence !== transitionIndex + 1 || transition.from !== priorState || !states.has(transition.to) || (transition.from !== null && !states.has(transition.from))) {
        addViolation(violations, "ILLEGAL_TRANSITION", path, "Transition sequence, prior state or lifecycle state is invalid.");
      }
      const occurredAt = Date.parse(transition.occurredAt);
      if (!Number.isFinite(occurredAt) || occurredAt < priorTime || occurredAt > fixedClock) addViolation(violations, "TIME_TRAVEL", `${path}.occurredAt`, "Transition time is invalid, non-monotonic or after the fixed clock.");
      priorState = transition.to;
      priorTime = occurredAt;
    }
    if ((object.transitions?.length ?? 0) > 0 && priorState !== object.state) addViolation(violations, "ILLEGAL_TRANSITION", `$.objects[${index}].state`, "Final transition state does not equal object state.");
  }
  checks.push({ id: "STATE_AND_TIME_RULES", passed: !violations.some(({ code }) => code === "ILLEGAL_TRANSITION" || code === "TIME_TRAVEL") });

  validateMoneyAndQuantity(input.pack, byId, violations);
  validateCustomerAssets(input.pack, byId, violations);
  const assertionSet = new Set(input.pack.expectedProcesses.flatMap((process) => process.assertions));
  for (const required of ["STATES_REACHABLE", "TIMELINE_MONOTONIC", "MONEY_RECONCILES", "QUANTITY_RECONCILES", "CUSTOMER_CONSISTENT"]) {
    if (!assertionSet.has(required)) addViolation(violations, "SEMANTIC_RULE_MISSING", "$.expectedProcesses", `Required semantic rule ${required} is not declared.`);
  }
  checks.push({ id: "MONEY_QUANTITY_AND_CUSTOMER_RULES", passed: !violations.some(({ code }) => ["MONEY_RULE_VIOLATION", "QUANTITY_RULE_VIOLATION", "CROSS_CUSTOMER_ASSET", "SEMANTIC_RULE_MISSING"].includes(code)) });

  return makeReceipt({ violations, checks, dataPackReceipt, stagedDag, graph, catalog });
}

function makeReceipt({ violations, checks, dataPackReceipt, stagedDag, graph, catalog }) {
  const success = violations.length === 0;
  return {
    receiptVersion: "chimpmaera.company-data-graph-validation/v1",
    status: success ? "PASS" : "DENY",
    success,
    authority: "NONE",
    claim: "VALIDATION_ONLY",
    mutationAllowed: false,
    mutationCount: 0,
    counts: {
      checks: checks.length,
      checksPassed: checks.filter(({ passed }) => passed).length,
      graphNodes: graph?.nodes?.length ?? 0,
      catalogCoverage: catalog?.objects?.length ?? 0,
      graphEdges: graph?.edges?.length ?? 0,
      classifiedCycles: graph?.cycleGroups?.length ?? 0,
      stagedOperations: stagedDag?.operationCount ?? 0,
      violations: violations.length
    },
    checks,
    digests: {
      dataPack: dataPackReceipt.digests.pack,
      catalog: dataPackReceipt.digests.catalog,
      graph: dataPackReceipt.digests.graph,
      stagedDag: stagedDag?.digest ?? null
    },
    stagedDag,
    violations
  };
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const input = await readCanonicalCompanyData(repoRoot);
  const receipt = validateCompanyDataGraph(input);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.success) process.exitCode = 1;
}
