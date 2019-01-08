import { FlowState } from '@flogo-web/client/flow/core/state';
import { ItemSubflow } from '@flogo-web/client-core';
import { getLinkedSubflow } from './get-linked-subflow';

export function removeSubschemaIfNotUsed(state: FlowState, subflowId: string) {
  if (!isSubflowUsedAgain(state, subflowId)) {
    const { [subflowId]: subflowToRemove, ...subflows } = state.linkedSubflows;
    state = { ...state, linkedSubflows: subflows };
  }
  return state;
}

function isSubflowUsedAgain(state: FlowState, subflowId: string) {
  const isReferencedSubflow = (t: ItemSubflow) => getLinkedSubflow(t) === subflowId;
  return Boolean(
    Object.values(state.mainItems).find(isReferencedSubflow) ||
      Object.values(state.errorItems).find(isReferencedSubflow)
  );
}
