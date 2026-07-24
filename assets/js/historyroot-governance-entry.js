(function historyRootGovernanceEntry(global) {
  "use strict";

  async function start() {
    const auth = global.DictionaryRootAuth;
    const params = new URLSearchParams(global.location.search);
    const recordId = params.get("recordId") || params.get("id");
    if (!auth || !recordId) return;
    try {
      await auth.initialize();
      const record = await auth.request(
        `/context/records/${encodeURIComponent(recordId)}`
      );
      const recordType = record.recordKind || "entity";
      const revisions = document.getElementById("historyrootRecordRevisionLink");
      const proposal = document.getElementById("historyrootRecordProposalLink");
      if (revisions) {
        revisions.href =
          `history-revisions-v1.html?recordId=${encodeURIComponent(recordId)}&recordType=${encodeURIComponent(recordType)}`;
      }
      if (proposal && auth.hasPermission("revision.create")) {
        proposal.href =
          `history-proposal-v1.html?mode=new&recordId=${encodeURIComponent(recordId)}&recordType=${encodeURIComponent(recordType)}&changeType=structured_update`;
        proposal.hidden = false;
      }
    } catch (_) {
      // Public record reading remains independent from optional governance entry.
    }
  }

  start();
})(window);
