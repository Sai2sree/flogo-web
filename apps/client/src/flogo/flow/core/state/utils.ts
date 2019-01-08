import { Item } from '@flogo-web/client-core';
import { GraphNodeDictionary } from '@flogo-web/client-core/interfaces';
import { HandlerType } from '@flogo-web/client/flow/core/models';
import { FlowState } from './flow/flow.state';

export const getItemsDictionaryName = (handlerType: HandlerType) => `${handlerType}Items`;

export const getGraphName = (handlerType: HandlerType) => `${handlerType}Graph`;

export const getItem = (
  state: FlowState,
  handlerType: HandlerType,
  itemId: string
): Item => {
  return state[getItemsDictionaryName(handlerType)][itemId];
};
export const nodesContainErrors = (nodes: GraphNodeDictionary) => {
  const nodeKeys = Object.keys(nodes);
  return !!nodeKeys.find(nodeKey => !!nodes[nodeKey].status.executionErrored);
};
export type PayloadOf<T extends { payload: any }> = T['payload'];
