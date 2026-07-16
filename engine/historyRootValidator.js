window.HistoryRootValidator = (() => {
  function validate(bundle) {
    const errors = [];
    const warnings = [];

    if (!bundle || typeof bundle !== "object") {
      return { valid: false, errors: ["Bundle must be an object."], warnings, counts: {} };
    }

    const required = [
      "entities", "timelineEntries", "assertions", "edges",
      "disputes", "sources", "revisions", "identityRecords"
    ];

    required.forEach(key => {
      if (!Array.isArray(bundle[key])) {
        errors.push(`${key} must be an array.`);
      }
    });

    if (errors.length) {
      return { valid: false, errors, warnings, counts: {} };
    }

    const idCollections = {
      entities: bundle.entities,
      timelineEntries: bundle.timelineEntries,
      assertions: bundle.assertions,
      edges: bundle.edges,
      disputes: bundle.disputes,
      sources: bundle.sources,
      revisions: bundle.revisions,
      identityRecords: bundle.identityRecords
    };

    Object.entries(idCollections).forEach(([name, items]) => {
      const seen = new Set();
      items.forEach((item, index) => {
        const id = item.id || item.revisionId;
        if (!id) {
          errors.push(`${name}[${index}] is missing an ID.`);
        } else if (seen.has(id)) {
          errors.push(`${name} contains duplicate ID: ${id}`);
        } else {
          seen.add(id);
        }
      });
    });

    const entityIds = new Set(bundle.entities.map(item => item.id));
    const sourceIds = new Set(bundle.sources.map(item => item.id));
    const assertionIds = new Set(bundle.assertions.map(item => item.id));
    const timelineIds = new Set(bundle.timelineEntries.map(item => item.id));

    function requireRef(value, set, context) {
      if (!set.has(value)) errors.push(`${context} references missing ID: ${value}`);
    }

    function requireRefs(values, set, context) {
      (values || []).forEach(value => requireRef(value, set, context));
    }

    bundle.assertions.forEach(item => {
      requireRef(item.entityId, entityIds, `Assertion ${item.id}`);
      requireRefs(item.sourceIds, sourceIds, `Assertion ${item.id}`);
      if (!item.claim) warnings.push(`Assertion ${item.id} has no claim text.`);
    });

    bundle.edges.forEach(item => {
      requireRef(item.fromEntityId, entityIds, `Edge ${item.id}`);
      requireRef(item.toEntityId, entityIds, `Edge ${item.id}`);
      requireRefs(item.sourceIds, sourceIds, `Edge ${item.id}`);
    });

    bundle.timelineEntries.forEach(item => {
      requireRefs(item.entityIds, entityIds, `Timeline ${item.id}`);
      if (!item.date) warnings.push(`Timeline ${item.id} has no date.`);
    });

    bundle.disputes.forEach(item => {
      requireRef(item.subjectEntityId, entityIds, `Dispute ${item.id}`);
      (item.positions || []).forEach(position => {
        requireRefs(position.supportingAssertionIds, assertionIds, `Position ${position.id}`);
        requireRefs(position.opposingAssertionIds, assertionIds, `Position ${position.id}`);
        requireRefs(position.supportingSourceIds, sourceIds, `Position ${position.id}`);
        requireRefs(position.opposingSourceIds, sourceIds, `Position ${position.id}`);
        requireRefs(position.relatedEntityIds, entityIds, `Position ${position.id}`);
        requireRefs(position.relatedTimelineEntryIds, timelineIds, `Position ${position.id}`);
      });
    });

    bundle.identityRecords.forEach(item => {
      requireRef(item.entityId, entityIds, `Identity ${item.id}`);
      requireRefs(item.sourceIds, sourceIds, `Identity ${item.id}`);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      counts: Object.fromEntries(
        Object.entries(idCollections).map(([key, items]) => [key, items.length])
      )
    };
  }

  return { validate };
})();
