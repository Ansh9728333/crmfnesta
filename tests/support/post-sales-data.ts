export function stageData(number: number, glass = false): Record<string, unknown> {
  const date = "2020-01-01T10:00:00+05:30";
  const data: Record<number, Record<string, unknown>> = {
    1: {
      groupName: "Isolated site team",
      groupLink: "https://chat.whatsapp.com/IsolatedTestReference",
      groupCreatedAt: date,
    },
    2: {
      contractReference: "Isolated contract",
      paymentTerms: "40 INR contractually due before dispatch; remainder after handover",
      dueBeforeDispatch: "40.00",
    },
    3: { surveyAt: date, contactPerson: "Test site contact" },
    4: {
      measurements: [{ label: "Opening width", value: "1500", unit: "mm" }],
      surveyFindings: "Final opening measurements checked",
    },
    5: { siteReady: true, readinessChecks: "Access, openings and power checked" },
    6: { loadCount: 2, loadPlan: "Two production loads planned under the existing order" },
    7: { releaseReference: "Isolated release", releasedAt: date },
    8: { factoryReady: true, factoryReference: "Both loads confirmed ready" },
    9: {
      verifiedReceipts: "40.00",
      receiptReferences: "Isolated receipt evidence verified against contract",
      verifiedAt: date,
    },
    10: { dispatchReference: "Isolated dispatch", carrier: "Test carrier", dispatchedAt: date },
    11: { deliveryReference: "Isolated delivery", receivedBy: "Test customer", deliveredAt: date },
    12: { installationStartedAt: date, ...(glass ? { glassRequired: true } : {}) },
    13: {
      allLoadsInstalled: true,
      installationChecks: "All loads installed and checked",
      installationCompletedAt: date,
      ...(glass
        ? { glassMeasurementTaken: true, glassTemplatePrepared: true, glassTemplateApproved: true }
        : {}),
    },
    14: { auditPassed: true, auditFindings: "Installation and site checks passed", auditAt: date },
    15: {
      handoverAccepted: true,
      handoverAt: date,
      customerRepresentative: "Test customer representative",
    },
    16: {
      reviewRequestedAt: date,
      reviewOutcome: "declined",
    },
  };
  return data[number];
}
