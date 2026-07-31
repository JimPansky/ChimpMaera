import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type EmailFixture = {
  fixtureId: string;
  emailLocalPart: string;
  emailDomain: string;
};
type Account = EmailFixture & { name: string };
type Contact = EmailFixture & { firstName: string; lastName: string; accountFixtureId: string };
type Opportunity = {
  fixtureId: string;
  name: string;
  accountFixtureId: string;
  amount: number;
  demoClassification: string;
};
type ThirdParty = Account & { customerCode: string };
type OrderLine = {
  description: string;
  quantity: number;
  unitPriceExcludingTax: number;
  vatRate: number;
};
type Order = {
  fixtureId: string;
  crmOpportunityFixtureId: string;
  customerFixtureId: string;
  customerReference: string;
  demoClassification: string;
  lines: OrderLine[];
};

const manifest = JSON.parse(
  readFileSync("demo/manifests/fixtures/panskys-zoo-demo-v1.json", "utf8"),
) as {
  inventoryPolicy: {
    backgroundOrdersAreChimpMaeraGovernedEvidence: boolean;
    fullySynthetic: boolean;
    knownInstallerGovernanceBypass: boolean;
    proofEvidenceEligibility: string;
    proofScenarioFixtureId: string;
  };
  crm: { accounts: Account[]; contacts: Contact[]; opportunities: Opportunity[] };
  erp: { thirdParties: ThirdParty[]; orders: Order[] };
  expectedCounts: {
    seedEnabled: Record<string, number>;
    seedDisabled: Record<string, number>;
  };
};

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

test("CM demo inventory is a correlated 57-object synthetic story", () => {
  const { accounts, contacts, opportunities } = manifest.crm;
  const { orders, thirdParties } = manifest.erp;
  const lineCount = orders.reduce((total, order) => total + order.lines.length, 0);
  const actual = {
    crmAccounts: accounts.length + 1,
    crmContacts: contacts.length,
    crmOpportunities: opportunities.length,
    erpOwnCompanies: 1,
    erpThirdParties: thirdParties.length,
    erpOrders: orders.length,
    erpOrderLines: lineCount,
    operationalObjects:
      accounts.length + 1 + contacts.length + opportunities.length + 1
      + thirdParties.length + orders.length + lineCount,
    proofScenarios: orders.filter(
      ({ demoClassification }) =>
        demoClassification === "GATE_ENFORCED_PROOF_SCENARIO",
    ).length,
    backgroundDemoOrders: orders.filter(
      ({ demoClassification }) => demoClassification === "BACKGROUND_DEMO_DATA",
    ).length,
    governedFlows: 1,
  };
  assert.deepEqual(actual, manifest.expectedCounts.seedEnabled);
  assert.deepEqual(manifest.expectedCounts.seedDisabled, {
    crmAccounts: 1,
    crmContacts: 0,
    crmOpportunities: 0,
    erpOwnCompanies: 1,
    erpThirdParties: 0,
    erpOrders: 0,
    erpOrderLines: 0,
    operationalObjects: 2,
    proofScenarios: 0,
    backgroundDemoOrders: 0,
    governedFlows: 0,
  });
});

test("CM demo keys, references and example-only addresses are strict", () => {
  const { accounts, contacts, opportunities } = manifest.crm;
  const { orders, thirdParties } = manifest.erp;
  const accountIds = new Set(accounts.map(({ fixtureId }) => fixtureId));
  const opportunityIds = new Set(opportunities.map(({ fixtureId }) => fixtureId));
  const thirdPartyIds = new Set(thirdParties.map(({ fixtureId }) => fixtureId));

  assert.equal(manifest.inventoryPolicy.fullySynthetic, true);
  assert.equal(manifest.inventoryPolicy.knownInstallerGovernanceBypass, false);
  assert.equal(
    manifest.inventoryPolicy.proofEvidenceEligibility,
    "CURRENT_BYTE_GATE_ENFORCED",
  );
  assert.equal(manifest.inventoryPolicy.backgroundOrdersAreChimpMaeraGovernedEvidence, false);
  assert.equal(unique(accounts.map(({ fixtureId }) => fixtureId)), true);
  assert.equal(unique(contacts.map(({ fixtureId }) => fixtureId)), true);
  assert.equal(unique(opportunities.map(({ fixtureId }) => fixtureId)), true);
  assert.equal(unique(thirdParties.map(({ customerCode }) => customerCode)), true);
  assert.equal(unique(orders.map(({ customerReference }) => customerReference)), true);
  assert.equal(unique(orders.flatMap(({ lines }) => lines.map(({ description }) => description))), true);

  for (const value of [...accounts, ...contacts, ...thirdParties]) {
    assert.match(`${value.emailLocalPart}@${value.emailDomain}`, /^[^@]+@[^@]+\.example$/);
  }
  for (const contact of contacts) assert.equal(accountIds.has(contact.accountFixtureId), true);
  for (const opportunity of opportunities) {
    assert.equal(accountIds.has(opportunity.accountFixtureId), true);
  }
  for (const order of orders) {
    assert.equal(thirdPartyIds.has(order.customerFixtureId), true);
    assert.equal(opportunityIds.has(order.crmOpportunityFixtureId), true);
    assert.equal(order.customerReference, order.crmOpportunityFixtureId);
    const opportunity = opportunities.find(({ fixtureId }) => fixtureId === order.crmOpportunityFixtureId);
    assert.ok(opportunity);
    assert.equal(opportunity.accountFixtureId, order.customerFixtureId);
    assert.equal(
      order.lines.reduce(
        (total, { quantity, unitPriceExcludingTax }) =>
          total + quantity * unitPriceExcludingTax,
        0,
      ),
      opportunity.amount,
    );
  }
});

test("only the original proof order is separated; background orders are not evidence", () => {
  const proofOrders = manifest.erp.orders.filter(
    ({ demoClassification }) =>
      demoClassification === "GATE_ENFORCED_PROOF_SCENARIO",
  );
  const backgroundOrders = manifest.erp.orders.filter(
    ({ demoClassification }) => demoClassification === "BACKGROUND_DEMO_DATA",
  );
  assert.deepEqual(proofOrders.map(({ fixtureId }) => fixtureId), [
    manifest.inventoryPolicy.proofScenarioFixtureId,
  ]);
  assert.equal(backgroundOrders.length, 7);
  assert.equal(
    manifest.crm.opportunities.filter(
      ({ demoClassification }) =>
        demoClassification === "GATE_ENFORCED_PROOF_SCENARIO",
    ).length,
    1,
  );
});
