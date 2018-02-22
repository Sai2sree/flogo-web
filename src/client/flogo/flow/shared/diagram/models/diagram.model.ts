import { FlowDiagram, TaskDictionary, Task, RootNode as RootFlowNode, Node as FlowNode, NodeDictionary } from '@flogo/core';
import { FlogoFlowDiagramNode } from './node.model';

import { Selection } from 'd3';
import {
  FLOGO_FLOW_DIAGRAM_DEBUG as DEBUG,
  FLOGO_FLOW_DIAGRAM_NODE_MENU_ITEM_TYPE,
  FLOGO_FLOW_DIAGRAM_NODE_TYPE,
  FLOGO_FLOW_DIAGRAM_VERBOSE as VERBOSE
} from '../constants';
import { FLOGO_PROFILE_TYPE, FLOGO_TASK_TYPE } from '@flogo/core/constants';
import { genBranchLine } from './branch-generator';
import { LanguageService } from '@flogo/core';
import { diagramToRenderableMatrix } from './matrix-creator.model';
import {isIterableTask} from '@flogo/shared/utils';

const DEFAULT_MAX_ROW_LEN = 6;

const CLS = {
  diagram: 'flogo-flows-detail-diagram',
  diagramRow: 'flogo-flows-detail-diagram-row',
  diagramRowStatusSelected: 'flogo-flows-detail-diagram-row-selected',
  diagramNode: 'flogo-flows-detail-diagram-node',
  diagramNodeBranchHover: 'flogo-flows-diagram-node-branch-hover',
  diagramNodeStatusSelected: 'flogo-flows-detail-diagram-node-selected',
  diagramNodeStatusRun: 'flogo-flows-detail-diagram-node-run',
  diagramNodeStatusHasError: 'flogo-flows-detail-diagram-node-has-error',
  diagramNodeStatusHasWarn: 'flogo-flows-detail-diagram-node-has-warn',
  diagramLastNode: 'flogo-flows-detail-diagram-node-last-node',
  diagramNodeDetail: 'flogo-flows-detail-diagram-node-detail',
  diagramNodeDetailContent: 'flogo-flows-detail-diagram-node-detail-content',
  diagramNodeDetailShape: 'flogo-flows-detail-diagram-node-detail-shape',
  diagramNodeDetailBranch: 'flogo-flows-detail-diagram-node-detail-branch',
  diagramNodeDetailBranchSelected: 'flogo-flows-detail-diagram-node-detail-branch-selected',
  diagramNodeDetailBranchHover: 'flogo-flows-detail-diagram-node-detail-branch-hover',
  diagramNodeDetailBranchRun: 'flogo-flows-detail-diagram-node-detail-branch-run',
  diagramNodeDetailIcon: 'flogo-flows-detail-diagram-node-detail-icon',
  diagramNodeDetailTitle: 'flogo-flows-detail-diagram-node-detail-title',
  diagramNodeDetailDesc: 'flogo-flows-detail-diagram-node-detail-description',
  diagramNodeBadge: 'flogo-flows-detail-diagram-node-badge',
  diagramNodeMenu: 'flogo-flows-detail-diagram-node-menu',

  // comment out since hover will show the menu
  // diagramNodeMenuOpen : 'flogo-flows-detail-diagram-node-menu-open',
  // diagramNodeMenuSelected : 'flogo-flows-detail-diagram-node-menu-selected',

  diagramNodeMenuBox: 'flogo-flows-detail-diagram-node-menu-box',
  diagramNodeMenuList: 'flogo-flows-detail-diagram-node-menu-list',
  diagramNodeMenuGear: 'flogo-flows-detail-diagram-node-menu-gear'
};

export class FlogoFlowDiagram implements FlowDiagram {
  public root: RootFlowNode;
  public nodes: NodeDictionary;
  public MAX_ROW_LEN = DEFAULT_MAX_ROW_LEN;

  private rootElm: Selection<any>;
  private ng2StyleAttr = '';
  private nodesOfAddType: NodeDictionary;
  private requiresSvgFix = Boolean(
    document['documentMode'] || /(Edge)|(Version\/[\d\.]+.*Safari)/.test(navigator.userAgent)
  );

  static isBranchNode(node: FlowNode) {
    return _isBranchNode(node);
  }

  static hasBranchRun(node: FlowNode,
                      tasks: TaskDictionary,
                      nodes: NodeDictionary): boolean {

    // expose internal function.
    return _hasBranchRun(node, tasks, nodes);
  }

  static getEmptyDiagram(diagramType?: string): FlowDiagram {
    const newRootNode = new FlogoFlowDiagramNode();
    const emptyDiagram = < FlowDiagram > {
      root: {
        is: newRootNode.id
      },
      nodes: < NodeDictionary > {}
    };

    newRootNode.type = diagramType === 'error' ?
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW : FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW;

    emptyDiagram.nodes[newRootNode.id] = newRootNode;

    return emptyDiagram;
  }

  constructor(diagram: FlowDiagram,
              private tasks: TaskDictionary,
              private translate: LanguageService,
              private profileType: FLOGO_PROFILE_TYPE,
              private elm ?: HTMLElement,
              private diagramType?: string) {
    this.updateDiagram(diagram);
  }

  public update(opt: {
    diagram ?: FlowDiagram;
    tasks ?: TaskDictionary;
    element ?: HTMLElement;
  }): Promise<FlogoFlowDiagram> {
    const promises: Promise<FlogoFlowDiagram> [ ] = [];

    if (opt.diagram) {
      promises.push(this.updateDiagram(opt.diagram));
    }

    if (opt.tasks) {
      promises.push(this.updateTasks(opt.tasks));
    }

    if (opt.element) {
      promises.push(this.updateElement(opt.element));
    }

    return Promise.all(promises)
      .then(() => this);
  }

  public updateAndRender(opt: {
    diagram ?: FlowDiagram;
    tasks ?: TaskDictionary;
    element ?: HTMLElement;
  }): Promise<FlogoFlowDiagram> {
    return this.update(opt)
      .then(
        () => {
          return this.render();
        }
      );
  }

  public updateDiagram(diagram: FlowDiagram): Promise<FlogoFlowDiagram> {
    if (_.isEmpty(diagram) || _.isEmpty(diagram.root)) {

      // handle empty diagram
      this.updateDiagram(FlogoFlowDiagram.getEmptyDiagram(this.diagramType));

    } else {

      // handle diagram with trigger and more nodes

      // keep a copy of diagram information, but only keep the reference of the tasks
      this.root = _.cloneDeep(diagram.root);

      // convert FlogoNode object into instance of FlogoNode class
      const nodeDict: NodeDictionary = {};
      _.forIn(diagram.nodes, (node, nodeID) => {
        if (node instanceof FlogoFlowDiagramNode) {
          nodeDict[nodeID] = node;
        } else {
          nodeDict[nodeID] = new FlogoFlowDiagramNode(node);
        }
      });
      this.nodes = nodeDict;

      this.MAX_ROW_LEN = _.isNumber(diagram.MAX_ROW_LEN) ? diagram.MAX_ROW_LEN : this.MAX_ROW_LEN;
    }


    return Promise.resolve(this);
  }

  public updateTasks(tasks: TaskDictionary): Promise<FlogoFlowDiagram> {
    this.tasks = tasks;
    return Promise.resolve(this);
  }

  public updateElement(elm: HTMLElement): Promise<FlogoFlowDiagram> {
    d3.select(this.elm)
      .select(`.${CLS.diagram}`)
      .selectAll(`.${CLS.diagramRow}`)
      .remove(); // clean the previous diagram
    this.elm = elm;
    return Promise.resolve(this);
  }

  public render(): Promise<FlogoFlowDiagram> {
    /* tslint:disable-next-line:no-unused-expression */
    DEBUG && console.group('rendering...');

    this.rootElm = d3.select(this.elm)
      .select(`.${CLS.diagram}`);

    if (!this.ng2StyleAttr) {
      this._updateNG2StyleAttr();
    }

    this.nodesOfAddType = this.nodesOfAddType || <NodeDictionary>{};

    // enter selection
    const rows = this.rootElm.selectAll(`.${CLS.diagramRow}`)
                    .data(diagramToRenderableMatrix(this, this.MAX_ROW_LEN));

    this._handleEnterRows(rows);
    this._handleUpdateRows(rows);
    this._handleExitRows(rows);

    this.fixAbsoluteSvgUrlsIfRequired();

    /* tslint:disable-next-line:no-unused-expression */
    DEBUG && console.groupEnd();

    return Promise.resolve(this);
  }

  public triggerByTaskID(eventName: string, taskID: string): Promise<FlogoFlowDiagram> {

    if (!eventName || !taskID) {
      return Promise.resolve(this);
    }

    let nodeID: string;

    for (const nid in this.nodes) {
      if (this.nodes[nid].taskID === taskID) {
        nodeID = nid;
        break;
      }
    }

    const node = this.nodes[nodeID];

    if (!node) {
      return Promise.resolve(this);
    }

    const diagram = this;

    const allNodes = d3.selectAll(`.${CLS.diagramNode}`);

    // find the node in diagram
    let nodeInDiagram: any;
    let prevNodeInDiagram: any;
    let nextNodeInDiagram: any;
    let doneFlag = false;

    allNodes.each(function (nodeInfo: any, idx: number) {

      // get the next node of the current node in the diagram
      if (doneFlag) {
        if (nodeInDiagram && !nextNodeInDiagram) {
          nextNodeInDiagram = d3.select(this);
        }
        return;
      }

      // get the given node in the diagram
      if (nodeInfo.id === nodeID) {
        doneFlag = true;
        nodeInDiagram = d3.select(this);
      } else {
        // record the previous node in the diagram
        prevNodeInDiagram = d3.select(this);
      }

      return;
    });

    try {
      switch (eventName) {
        case 'addTask':

          (<any>$(nextNodeInDiagram[0][0]))
            .trigger('click');

          break;

        case 'selectTask':
        case 'selectTrigger':

          (<any>$(nodeInDiagram[0][0]))
            .trigger('click');

          break;

        default:

          (<any>$(nodeInDiagram[0][0]))
            .trigger(eventName);

          break;
      }
    } catch (e) {
      console.error(e);
    }

    return Promise.resolve(this);
  }

  public linkNodeWithTask(nodeID: string, task: Task): Promise<FlogoFlowDiagram> {
    const node = this.nodes[nodeID] || this.nodesOfAddType[nodeID];

    if (node) {
      node.taskID = task.id;

      if (node.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ADD) {
        this.nodes[node.id] = node;
        delete this.nodesOfAddType[node.id];

        node.type = FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE;

        const parentNode = this.nodes[node.parents[0]];

        (<FlogoFlowDiagramNode>parentNode).linkToChildren([node.id]);

      } else if (node.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW) {
        // node.type = FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT;
        node.type = FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE;
      }
    } else {
      // use Promise.reject with error message cause TypeScript error
      // TODO
      //   change to Promise.reject sometime somehow.
      /* tslint:disable-next-line:no-unused-expression */
      DEBUG && console.warn('Cannot find the node');
    }

    return Promise.resolve(this);
  }

  public findNodesByType(type: FLOGO_FLOW_DIAGRAM_NODE_TYPE,
                         sourceNodes ?: FlowNode[ ]): FlowNode[ ] {
    const nodes: FlowNode[ ] = [];

    if (sourceNodes) {
      _.each(
        sourceNodes, (node) => {
          if (node.type === type) {
            nodes.push(node);
          }
        }
      );
    } else {
      _.mapKeys(
        this.nodes, (node: FlowNode) => {
          if (node.type === type) {
            nodes.push(node);
          }
        }
      );
    }

    return nodes;
  }

  public findNodesByIDs(ids: string[ ]): FlowNode[ ] {
    const nodes: FlowNode[ ] = [];

    _.each(
      ids, (id) => {
        const node = this.nodes[id];
        /* tslint:disable:no-unused-expression */
        node && nodes.push(node);
      }
    );

    return nodes;
  }

  public findChildrenNodesByType(type: FLOGO_FLOW_DIAGRAM_NODE_TYPE,
                                 node: FlowNode): FlowNode[ ] {
    return this.findNodesByType(type, this.findNodesByIDs(node.children));
  }

  public findParentsNodesByType(type: FLOGO_FLOW_DIAGRAM_NODE_TYPE,
                                node: FlowNode): FlowNode[ ] {
    return this.findNodesByType(type, this.findNodesByIDs(node.parents));
  }

  public deleteNode(node: FlowNode): Promise<any> {
    const deleteNode = <FlogoFlowDiagramNode>this.nodes[node.id];

    if (deleteNode) {
      _deleteNode(deleteNode, this.nodes, this.root);
      if (_.isEmpty(this.nodes)) {
        // create new diagram
        return this.updateDiagram(null).then(() => this);
      }
    } else {
      return Promise.reject(`Node ${node.id} doesn't exists.`);
    }

    return Promise.resolve(this);
  }

  public addBranch(parentNode: FlowNode, branchInfo: any): Promise<any> {
    // the `node` is the parent node of the branch
    // the `task` is the branch information

    const node = new FlogoFlowDiagramNode({
      id: FlogoFlowDiagramNode.genNodeID(),
      type: FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH,
      taskID: branchInfo.id,
      parents: [parentNode.id],
      children: []
    });

    this.nodes[node.id] = node;

    (<FlogoFlowDiagramNode>this.nodes[parentNode.id]).linkToChildren([node.id]);

    return Promise.resolve(this);
  }

  public fixAbsoluteSvgUrlsIfRequired() {
    if (!this.requiresSvgFix) {
      return;
    }
    const functionalUrlRegex = /url\((.*)#/;
    const simpleHashedRegex = /(.*)#/;
    const replaceFunctionalUrl = (inString: string) => inString.replace(functionalUrlRegex, `url(${window.location.href}#`);
    const replaceHashedRef = (inString: string) => inString.replace(simpleHashedRegex, `${window.location.href}#`);
    const updateAttrUrlIfNeeded = (element: Element, attrName) => {
      if (element.hasAttribute(attrName)) {
        const attrVal = element.getAttribute(attrName);
        const replaceUrl =  functionalUrlRegex.test(attrVal) ? replaceFunctionalUrl : replaceHashedRef;
        element.setAttribute(attrName, replaceUrl(attrVal));
      }
    };
    Array.from(this.elm.querySelectorAll('[fill], [filter]'))
      .forEach((element: Element) => {
        ['fill', 'filter', 'xlink:href'].forEach(attrName => updateAttrUrlIfNeeded(element, attrName));
      });
  }

  private _handleEnterRows(rows: d3.selection.Update<any>) {
    const enterRows = rows
      .enter()
      .append('div')
      .attr(this.ng2StyleAttr, '')
      .classed(CLS.diagramRow, true)
      .style('z-index', (d: any, row: number) => rows.size() - row) // the earlier rendered row is higher
      .on(
        'mouseenter', function () {
          d3.select(this)
            .classed('hover', true);
        }
      )
      .on(
        'mouseleave', function () {
          d3.select(this)
            .classed('hover', false);
        }
      );
  }

  private _handleUpdateRows(rows: d3.selection.Update<any>) {
    rows
      .classed('updated', true)
      .style('z-index', (d: any, row: number) => rows.size() - row); // the earlier rendered row is higher

    const tasks = this._bindDataToNodes(rows);

    this._handleTaskNodes(tasks, rows);
  }

  private _handleExitRows(rows: d3.selection.Update<any>) {
    rows.exit()
      .classed(
        {
          'updated': false,
          'exit': true
        }
      )
      .on('mouseenter', null)
      .on('mouseleave', null)
      .remove();
  }

  private _bindDataToNodes(rows: any) {
    const nodes = rows.selectAll(`.${CLS.diagramNode}`);

    return nodes.data((rowNodesIds: string[ ]) => {
      return _.map(
        rowNodesIds, (nodeID: string, idx: number) => {
          let nodeInfo = <FlogoFlowDiagramNode>this.nodes[nodeID];

          if (nodeID === '+') {
            // node of NODE_ADD

            // reuse existing nodes
            let found = false;
            _.forIn(this.nodesOfAddType, (node: FlogoFlowDiagramNode, id: string) => {
              if (node.parents.indexOf(rowNodesIds[idx - 1]) !== -1) {
                found = true;
                nodeInfo = node;
              }
            });

            if (!found) {
              nodeInfo = new FlogoFlowDiagramNode();
              this.nodesOfAddType[nodeInfo.id] = nodeInfo;
              // only save the parent IDs to this node, but not add this node to the children of the parent node,
              // in order to keep the diagram itself clean.
              nodeInfo.linkToParents([rowNodesIds[idx - 1]]);
            }
          } else if (nodeID === '_') {
            // placeholder node
            nodeInfo = new FlogoFlowDiagramNode({
              id: '',
              taskID: '',
              type: FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_HOLDER,
              children: [],
              parents: []
            });
          } else if (_.isEmpty(nodeInfo)) {
            // padding nodes
            nodeInfo = new FlogoFlowDiagramNode({
              id: '',
              taskID: '',
              type: FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_PADDING,
              children: [],
              parents: []
            });
          }

          return nodeInfo;
        }
      );
    });
  }

  private _handleEnterNodes(nodes: any, rows: any) {
    const diagram = this;
    // let timerHandle : any = {};

    const dontCareNodesTypesForNodeMenu = [
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ADD,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_HOLDER,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_PADDING,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW
    ];

    // enter selection
    const newNodes = nodes.enter()
      .append('div')
      .attr('data-task-id', (nodeInfo: FlowNode) => {
        return nodeInfo.taskID || -1;
      })
      .attr(this.ng2StyleAttr, '')
      .classed(CLS.diagramNode, true)
      .on(
        'click', function (d: FlowNode, col: number, row: number) {
          /* tslint:disable:no-unused-expression */
          DEBUG && console.group('on click');

          DEBUG && console.group('node data');
          // DEBUG && console.table( d );
          DEBUG && console.log(d);
          DEBUG && console.groupEnd();

          if (d.taskID) {
            DEBUG && console.group('task data');
            DEBUG && console.log(diagram.tasks[d.taskID]);
            DEBUG && console.groupEnd();
          }

          DEBUG && console.group('location in matrix');
          DEBUG && console.log(`row: ${row + 1}, col: ${col + 1}`);
          DEBUG && console.groupEnd();

          DEBUG && console.group('event');
          DEBUG && console.log(d3.event);
          DEBUG && console.groupEnd();
          /* tslint:enable:no-unused-expression */

          if (_isNodeSelectable(d)) {

            let evtType = '';

            if (d.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ADD ||
              d.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW) {
              evtType = 'flogoAddTask';

              // TODO
              //   refine the logic to handle more kinds of nodes
            } else if ([
                FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE,
                FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT,
                FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH,
              ].indexOf(d.type) !== -1) {
              evtType = 'flogoSelectTask';
            }

            if (evtType) {
              _triggerCustomEvent(
                evtType, {
                  origEvent: d3.event,
                  node: d,
                  col: col,
                  row: row
                }, this
              );

            }

            d3.selectAll(`.${CLS.diagramNodeStatusSelected}`)
              .classed(CLS.diagramNodeStatusSelected, (nodeInfo: any) => {
                _.set(nodeInfo, '__status.isSelected', false);
                return false;
              });
            d3.selectAll(`.${CLS.diagramRowStatusSelected}`)
              .classed(CLS.diagramRowStatusSelected, false);

            d3.select(this)
              .classed(CLS.diagramNodeStatusSelected, (nodeInfo: any) => {
                _.set(nodeInfo, '__status.isSelected', true);
                return true;
              });

            if (d.type !== FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
              d3.select(this.parentElement)
                .classed(CLS.diagramRowStatusSelected, true);
            }
          }

          /* tslint:disable-next-line:no-unused-expression */
          DEBUG && console.groupEnd();
        }
      )
      .on(
        'mouseenter', function (d: FlowNode) {
          const element: HTMLElement = this;

          if (dontCareNodesTypesForNodeMenu.indexOf(d.type) !== -1) {
            return;
          }

          if (d.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
            let doneFlag = false;
            const rowsInTheDiagram = d3.select(diagram.elm).selectAll(`.${CLS.diagramRow}`);

            rowsInTheDiagram.each(function (rowNodesIDs: string[], row: number) {
              if (!doneFlag && rowNodesIDs.indexOf(d.id) !== -1) {
                d3.select(this)
                  .classed(CLS.diagramNodeBranchHover, true)
                  .style('z-index', () => rowsInTheDiagram.size() + 1);
                doneFlag = true;
              }
            });
          }

          // comment out since hover will show the menu
          // timerHandle[ d.id ] = setTimeout(
          //   () => {
          //     d3.select( element )
          //       .classed( CLS.diagramNodeMenuOpen, true );
          //   }, 250
          // );
        }
      )
      .on(
        'mouseleave', function (d: FlowNode) {
          // clearTimeout( timerHandle[ d.id ] );

          // comment out since hover will show the menu
          // d3.select( this )
          //   .classed( CLS.diagramNodeMenuOpen, false )
          //   .classed( CLS.diagramNodeMenuSelected, false );

          if (d.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
            d3.selectAll(`.${CLS.diagramNodeBranchHover}`)
              .classed(CLS.diagramNodeBranchHover, false);
          }

          if (d.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
            let doneFlag = false;
            const rowsInTheDiagram = d3.select(diagram.elm).selectAll(`.${CLS.diagramRow}`);

            rowsInTheDiagram.each(function (rowNodesIDs: string[], row: number) {
              if (!doneFlag && rowNodesIDs.indexOf(d.id) !== -1) {
                d3.select(this)
                  .style('z-index', () => rowsInTheDiagram.size() - row);
                doneFlag = true;
              }
            });
          }
        }
      );
    // comment out since hover will show the menu
    // .on(
    //   'flogoClickNodeMenu', function ( nodeInfo : any ) {
    //     d3.select( this )
    //       .classed( CLS.diagramNodeMenuSelected, true );
    //   }
    // );
  }

  private _handleUpdateNodes(nodes: any, rows: any) {
    const diagram = this;
    const lastNodeInd = this.MAX_ROW_LEN - 1;

    // comment out since hover will show the menu
    // nodes.classed( CLS.diagramNodeMenuOpen, false )
    nodes.classed({
      'updated': true
    })
      .attr('data-flogo-node-type',
        (d: FlowNode) => FLOGO_FLOW_DIAGRAM_NODE_TYPE[d.type].toLowerCase());

    nodes.each(
      function (d: FlowNode, index: number) {
        const thisNode = d3.select(this);
        const task = diagram.tasks && diagram.tasks[d.taskID];
        const classes: { [key: string]: boolean } = {};

        // status for resetting
        classes[CLS.diagramNodeStatusRun] = false;
        classes[CLS.diagramNodeStatusHasError] = false;
        classes[CLS.diagramNodeStatusHasWarn] = false;
        classes[CLS.diagramLastNode] = false;

        if (task) {
          const taskStatus = _getTaskStatus(task);

          classes[CLS.diagramNodeStatusRun] = taskStatus['hasRun'];
          classes[CLS.diagramNodeStatusHasError] = taskStatus.hasError;
          classes[CLS.diagramNodeStatusHasWarn] = taskStatus.hasWarning;
          if ((index === lastNodeInd) || _isReturnActivity(diagram.tasks[d.taskID])) {
            classes[CLS.diagramLastNode] = true;
          }
          thisNode.classed(classes);

        } else {
          thisNode.classed(classes);
        }

        // comment out since hover will show the menu
        // thisNode.classed( CLS.diagramNodeMenuSelected, false );

        thisNode.classed(CLS.diagramNodeStatusSelected, (nodeInfo: any) => {
          return _.get(nodeInfo, '__status.isSelected', false);
        });

        // update the current node ID
        thisNode.attr('data-task-id', function (nodeInfo: FlowNode) {
          const previousID = thisNode.attr('data-task-id');

          // unset whatever status should not be kept once the task is changed.
          if (previousID !== nodeInfo.taskID) {
            // persist node selected status
            thisNode.classed(CLS.diagramNodeStatusSelected, (otherNodeInfo: any) => {
              return _.get(otherNodeInfo, '__status.isSelected', false);
            });
          }

          return nodeInfo.taskID || -1;
        });
      }
    );

    // if no node is selected, unset the row selected class
    if (!_.some(d3.selectAll(`.${CLS.diagramNodeStatusSelected}`)
        .data(), (nodesInfo: any) => {
        return nodesInfo && (nodesInfo.type
          === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE
          || nodesInfo.type
          === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT);
      })) {
      d3.select(`.${CLS.diagramRowStatusSelected}`)
        .classed(CLS.diagramRowStatusSelected, false);
    }

    const nodeMenus = this._bindDataToNodeMenus(nodes.selectAll(`.${CLS.diagramNodeMenu}`));
    this._handleNodeMenus(nodeMenus);

    const nodeDetails = this._bindDataToNodeDetails(rows);
    this._handleNodeDetails(nodeDetails, rows);

    const nodeBadgeArea = this._bindDataToNodeBadges(nodes.selectAll(`.${CLS.diagramNodeBadge}`));
    this._handleNodeBadges(nodeBadgeArea);

  }

  private _handleExitNodes(nodes: any, rows: any) {
    nodes.exit()
      .classed(
        {
          'updated': false,
          'exit': true
        }
      )
      .on('click', null)
      .on('mouseover', null)
      .on('mouseleave', null)
      .on('flogoClickNodeMenu', null)
      .remove();
  }

  private _handleTaskNodes(tasks: any, rows: any) {

    this._handleEnterNodes(tasks, rows);
    this._handleUpdateNodes(tasks, rows);
    this._handleExitNodes(tasks, rows);

  }

  private _bindDataToNodeDetails(rows: any): any {
    const nodeDetails = rows.selectAll(`.${CLS.diagramNode}`)
      .selectAll(`.${CLS.diagramNodeDetail}`);
    return nodeDetails.data(
      (nodeInfo: any) => {
        if (nodeInfo) {
          const task = this.tasks[nodeInfo.taskID];

          if (task && _isNodeHasDetails(nodeInfo)) {
            let taskDescription: string;
            const taskStatus = _getTaskStatus(task);

            // the first message of error/warning will be used as description when presents
            // NOTE: not going to display error messages in the
            // if ( taskStatus.hasError ) {
            //   let _errors = _.get( task, '__props.errors', [ { msg : '' } ] );
            //   taskDescription = _errors[ 0 ].msg;
            // } else
            if (taskStatus.hasWarning) {
              const _warnings = _.get(task, '__props.warnings', [{ msg: '' }]);
              taskDescription = _warnings[0].msg;
            } else {
              taskDescription = task.description;
            }

            return <any>[
              {
                name: task.name,
                desc: taskDescription,
                type: task.type,
                taskStatus: taskStatus,
                nodeInfo: nodeInfo
              }
            ];
          }
        }

        return <any>[
          {
            nodeInfo: nodeInfo
          }
        ];
      }
    );
  }

  private _handleEnterNodeDetails(nodeDetails: any, rows: any) {
    nodeDetails.enter()
      .append('div')
      .attr(this.ng2StyleAttr, '')
      .classed(CLS.diagramNodeDetail, true);
  }

  private _handleUpdateNodeDetails(nodeDetails: any, rows: any) {
    const diagram = this;
    const rowHeight = _getRowHeight(diagram.elm, CLS.diagramRow);

    nodeDetails = rows.selectAll(`.${CLS.diagramNodeDetail}`);

    const nodeParents = [];
    let numOfChildren;
    nodeDetails.html((taskInfo: {
      name: string;
      desc: string;
      type: FLOGO_TASK_TYPE;
      taskStatus: {
        [key: string]: boolean;
        hasError: boolean;
        hasWarning: boolean;
      };
      nodeInfo: any;
    }, col: number, row: number) => {

      if (_.isEmpty(taskInfo)) {
        return '';
      }

      if (taskInfo.nodeInfo.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
        const parentId = taskInfo.nodeInfo.parents[0];
        if (nodeParents.indexOf(parentId) === -1) {
          nodeParents.push(parentId);
          numOfChildren = 1;
        } else {
          numOfChildren++;
        }
        return this.makeBranch(row, parentId, numOfChildren, rows, rowHeight, diagram);
      }

      if (taskInfo.nodeInfo.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW) {
        taskInfo = _.assign({}, taskInfo, { name: 'On Error', desc: 'Error ocurred', type: FLOGO_TASK_TYPE.TASK_ROOT });
        return `
         <div ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailContent}">
            <i ${diagram.ng2StyleAttr} class="flogo-flows-detail-diagram-node-detail-error-icon flogo-icon flogo-icon-info"></i>
            ${this.makeErrorRootTile()}
          </div>
        `;
      }

      const taskSchema = diagram.tasks[taskInfo.nodeInfo.taskID];
      if (!taskInfo.name || (taskSchema.type !== FLOGO_TASK_TYPE.TASK_SUB_PROC && !taskInfo.desc)) {
        return '';
      }

      let iconName = 'activity.icon.svg';

      if (taskInfo.type === FLOGO_TASK_TYPE.TASK_ROOT) {
        iconName = 'trigger.icon.svg';
      }

      let taskIcon;
      if (taskSchema && taskSchema.ref === 'github.com/TIBCOSoftware/flogo-contrib/activity/lambda') {
        taskIcon = `<svg ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailIcon} --lambda" viewBox="0 0 200 278">
                      <use xlink:href="/assets/svg/lambda-icon.svg#layer1"></use>
                    </svg>`;
      } else if (taskSchema && taskSchema.type === FLOGO_TASK_TYPE.TASK_SUB_PROC) {
        taskIcon = `<img ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailIcon} --subflow"
                          src="/assets/svg/subflow.svg" alt=""/>`;
      } else {
        taskIcon = `<img ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailIcon}"
                          src="/assets/svg/flogo.flows.detail.diagram.${iconName}" alt=""/>`;
      }

      return `
        <div ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailContent}">
          ${this.makeTile()}
          ${taskIcon}
          <div ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailTitle}" title="${taskInfo.name}">${taskInfo.name}</div>
          <div ${diagram.ng2StyleAttr} class="${CLS.diagramNodeDetailDesc}" title="${taskInfo.desc}">${taskInfo.desc}</div>
        </div>
      `;

    });
  }

  private makeBranch(row: number,
                     parentId: string,
                     numOfChildren: number,
                     rows: any,
                     rowHeight: number,
                     diagram: FlogoFlowDiagram) {
    const thisBranchRow = row;
    let level = 0;

    const thisBranchParent = <any>{
      id: parentId
    };

    // TODO
    //  change to other Array API like some to optimise? but need to manually call d3 API to get the data..
    rows.each(function (rowNodesIDs: string[], rowIndex: number) {
      // if haven't got the level
      // try to find the parent node's row and get the diff of the rows as the level
      if (!level) {
        const parentCol = rowNodesIDs.indexOf(thisBranchParent.id);

        if (parentCol !== -1) {
          thisBranchParent.loc = {
            col: parentCol,
            row: rowIndex
          };

          level = thisBranchRow - rowIndex;
        }
      }
    });

    const defaultLevel = numOfChildren === 1 ? level : 1;
    const branchOverlap = 31; // branch overlap with mother tile
    const thisBranchLineHeight = rowHeight * level - branchOverlap;
    const branchLines = genBranchLine({
      svgHeight: thisBranchLineHeight,
      defaultHeight: rowHeight * defaultLevel - branchOverlap
    });

    return _.map([
      {
        class: CLS.diagramNodeDetailBranch,
        state: 'default'
      }, {
        class: CLS.diagramNodeDetailBranchHover,
        state: 'hover'
      }, {
        class: CLS.diagramNodeDetailBranchSelected,
        state: 'selected'
      }, {
        class: CLS.diagramNodeDetailBranchRun,
        state: 'run'
      }
    ], (item: any) => {
      const branchLine = btoa(
        branchLines[item.state].trim()
          .replace(/"/g, '\'')
          .replace(/\s+/g, ' '));
      /* tslint:disable:max-line-length */
      return `
              <div ${diagram.ng2StyleAttr} class="${item.class}">
                <div ${diagram.ng2StyleAttr} class="img-left" style="background:url(data:image/svg+xml;base64,${branchLine}) left bottom no-repeat; height: ${thisBranchLineHeight}px"></div>
                <div ${diagram.ng2StyleAttr} class="img-right" style="background:url(data:image/svg+xml;base64,${branchLine}) right bottom no-repeat;"></div>
              </div>
            `;
      /* tslint:enable:max-line-length */
    })
      .join('');
  }

  private makeTile() {
    /* tslint:disable:max-line-length */
    return `
    <svg class="${CLS.diagramNodeDetailShape}" 
      xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="150" height="138" viewBox="0 0 150 138">
        <defs>
            <linearGradient id="flogo-diagram-tile-bg-default" x1="0%" x2="31.438%" y1="52.069%" y2="52.069%">
                <stop offset="0%" stop-color="#F4F4F4"/>
                <stop offset="100%" stop-color="#FFF"/>
            </linearGradient>
            <linearGradient id="flogo-diagram-tile-bg-run" x1="0%" x2="33.893%" y1="50%" y2="50%">
                <stop offset="0%" stop-color="#D2EDFD"/>
                <stop offset="100%" stop-color="#DEF2FD"/>
            </linearGradient>
            <path id="flogo-diagram-tile-shape" d="M110.11 25.536V8a8 8 0 0 0-8-8h-94a8 8 0 0 0-8 8v94a8 8 0 0 0 8 8h94a8 8 0 0 0 8-8V84.758l13.333-29.61-13.333-29.612z"/>
            <rect id="flogo-diagram-tile-shape-terminal" width="110" height="110" x=".11" rx="8"/>
            <filter id="flogo-diagram-tile-shadow" width="105.7%" height="106.4%" x="-2.8%" y="-2.3%" filterUnits="objectBoundingBox">
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/>
                <feGaussianBlur in="shadowOffsetOuter1" result="shadowBlurOuter1" stdDeviation="1"/>
                <feComposite in="shadowBlurOuter1" in2="SourceAlpha" operator="out" result="shadowBlurOuter1"/>
                <feColorMatrix in="shadowBlurOuter1" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.325888813 0"/>
            </filter>
            <filter id="flogo-diagram-tile-shadow-active" width="135.3%" height="139.2%" x="-17.7%" y="-15.4%" filterUnits="objectBoundingBox">
                <feOffset dy="5" in="SourceAlpha" result="shadowOffsetOuter2"/>
                <feGaussianBlur in="shadowOffsetOuter2" result="shadowBlurOuter2" stdDeviation="7"/>
                <feColorMatrix in="shadowBlurOuter2" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.325888813 0"/>
            </filter>
        </defs>
        <g class="tile" fill="none" fill-rule="evenodd" transform="translate(11 9)">
            <g class="tile__default">
                <use class="tile__shadow" fill="#000" filter="url(#flogo-diagram-tile-shadow)" xlink:href="#flogo-diagram-tile-shape"/>
                <use class="tile__bg" fill="url(#flogo-diagram-tile-bg-default)" xlink:href="#flogo-diagram-tile-shape"/>
                <path class="tile__stroke" stroke="#F4F4F4" stroke-width=".8" d="M123.005 55.147l-13.26-29.446-.035-.165V8a7.6 7.6 0 0 0-7.6-7.6h-94A7.6 7.6 0 0 0 .51 8v94a7.6 7.6 0 0 0 7.6 7.6h94a7.6 7.6 0 0 0 7.6-7.6V84.758l.035-.164 13.26-29.447z"/>
            </g>
    
            <g class="tile__terminal">
                <use class="tile__shadow" fill="#000" filter="url(#flogo-diagram-tile-shadow)" xlink:href="#flogo-diagram-tile-shape-terminal"/>
                <use class="tile__bg" fill="url(#flogo-diagram-tile-bg-default)" xlink:href="#flogo-diagram-tile-shape-terminal" />
                <rect class="tile__stroke" width="109.2" height="109.2" x=".51" y=".4" stroke="#F4F4F4" stroke-width=".8" rx="8"/>
            </g>
        </g>
    </svg>
    `;
    /* tslint:enable:max-line-length */
  }

  private makeErrorRootTile() {
    return `<svg class="${CLS.diagramNodeDetailShape}" xmlns="http://www.w3.org/2000/svg" 
        xmlns:xlink="http://www.w3.org/1999/xlink" width="52" height="52" viewBox="0 0 52 52">
        <defs>
            <path id="flogo-diagram-error-shape" d="M40 .12V0H2.4A2.4 2.4 0 0 0 0 2.4v43.2A2.4 2.4 0 0 0 2.4 48H40v-.12L48 24 40 .12z"/>
            <filter id="flogo-diagram-error-bg" width="114.6%" height="114.6%" x="-7.3%" y="-5.2%" filterUnits="objectBoundingBox">
                <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/>
                <feGaussianBlur in="shadowOffsetOuter1" result="shadowBlurOuter1" stdDeviation="1"/>
                <feComposite in="shadowBlurOuter1" in2="SourceAlpha" operator="out" result="shadowBlurOuter1"/>
                <feColorMatrix in="shadowBlurOuter1" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.325888813 0"/>
            </filter>
        </defs>
        <g fill="none" fill-rule="evenodd" transform="translate(2 1)">
            <use fill="#000" filter="url(#flogo-diagram-error-bg)"
              xlink:href="#flogo-diagram-error-shape"/>
            <use fill="#FBCDD1" xlink:href="#flogo-diagram-error-shape"/>
            <path stroke="#EE3342" stroke-width=".8" d="M39.672.4H2.4a2 2 0 0 0-2 2v43.2a2 2 0 0 0 2 2h37.272L47.578 24 39.672.4z"/>
        </g>
    </svg>
    `;
  }

  private _handleExitNodeDetails(nodeDetails: any, rows: any) {
    nodeDetails.exit()
      .remove();
  }

  private _handleNodeDetails(nodeDetails: any, rows: any) {

    this._handleEnterNodeDetails(nodeDetails, rows);
    this._handleUpdateNodeDetails(nodeDetails, rows);
    this._handleExitNodeDetails(nodeDetails, rows);

  }

  private _bindDataToNodeMenus(nodeMenus: any) {
    return nodeMenus.data(
      (nodeInfo: any) => {
        if (nodeInfo && _isNodeHasMenu(nodeInfo)) {
          return [nodeInfo];
        }

        return [];
      }
    );
  }

  private _handleEnterNodeMenus(nodeMenus: any) {
    const newNodeMenus = nodeMenus.enter();

    newNodeMenus.append('div')
      .attr(this.ng2StyleAttr, '')
      .classed(CLS.diagramNodeMenu, true)
      .on('click', function (nodeInfo: any, col: number, row: number) {
        const event = <Event>d3.event;
        event.stopPropagation();

        if ((
            <HTMLElement>event.target
          ).getAttribute('data-menu-item-type')) {

          // fire event if it's menu item
          const evtType = 'flogoClickNodeMenuItem';

          _triggerCustomEvent(evtType, {
            origEvent: d3.event,
            node: nodeInfo
          }, this);
        }

        // comment out since hover will show the menu
        // else {
        //
        //   // fire menu on clicked event if this menu is clicked.
        //   let evtType = 'flogoClickNodeMenu';
        //
        //   _triggerCustomEvent( evtType, {
        //     origEvent : d3.event,
        //     node : nodeInfo
        //   }, this );
        // }
      });
  }

  private _handleUpdateNodeMenus(nodeMenus: any) {
    const diagram = this;
    const textAddBranch = this.translate.instant('DIAGRAM:ADD-BRANCH');
    const textConfigure = this.translate.instant('DIAGRAM:CONFIGURE');
    const textDelete = this.translate.instant('DIAGRAM:DELETE');

    nodeMenus.html((nodeInfo: any, ignore: number, idxInTotalNodes: number) => {
      /* tslint:disable-next-line:max-line-length */
      const tplItemAddBranch = `<li ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuList}" data-menu-item-type="${FLOGO_FLOW_DIAGRAM_NODE_MENU_ITEM_TYPE.ADD_BRANCH}"><i ${diagram.ng2StyleAttr} class="flogo-icon-addbranch"></i>${textAddBranch}</li>`;

      /* tslint:disable-next-line:max-line-length */
      const tplItemConfigure = (this.profileType !== FLOGO_PROFILE_TYPE.DEVICE) ? `<li ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuList}" data-menu-item-type="${FLOGO_FLOW_DIAGRAM_NODE_MENU_ITEM_TYPE.SELECT_TRANSFORM}"><i ${diagram.ng2StyleAttr} class="fa flogo-icon-settings"></i>${textConfigure}</li>` : '';

      /* tslint:disable-next-line:max-line-length */
      const tplItemDelete = `<li ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuList}" data-menu-item-type="${FLOGO_FLOW_DIAGRAM_NODE_MENU_ITEM_TYPE.DELETE}"><i ${diagram.ng2StyleAttr} class="fa flogo-icon-delete"></i>${textDelete}</li>`;

      const tplGear = `<span ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuGear}"></span>`;

      // TODO
      //  enable the delete for trigger in the future
      if (nodeInfo.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT) {
        return ``;
      }

      if ((nodeInfo.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) ||
        _isReturnActivity(diagram['tasks'][nodeInfo.taskID])
      ) {
        return `<ul ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuBox}">
                    ${tplItemDelete}
                  </ul>${tplGear}`;
      }

      // if not the last node in row
      if ((idxInTotalNodes + 1) % 7) {
        // normal template
        return `<ul ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuBox}">
                     ${tplItemConfigure}
                     ${tplItemAddBranch}
                     ${tplItemDelete}
                </ul>${tplGear}`;
      } else {
        // no add branch
        return `<ul ${diagram.ng2StyleAttr} class="${CLS.diagramNodeMenuBox}">
                    ${tplItemConfigure}
                    ${tplItemDelete}
                </ul>${tplGear}`;
      }

    });
  }

  private _handleExitNodeMenus(nodeMenus: any) {
    const exitNodeMenus = nodeMenus.exit();
    exitNodeMenus.on('click', null)
      .remove();
  }

  private _handleNodeMenus(nodeMenus: any) {

    this._handleEnterNodeMenus(nodeMenus);
    this._handleUpdateNodeMenus(nodeMenus);
    this._handleExitNodeMenus(nodeMenus);

  }

  private _bindDataToNodeBadges(nodeBadges: any) {
    return nodeBadges.data(
      (nodeInfo: any) => {
        if (nodeInfo) {
          const task = this.tasks[nodeInfo.taskID];
          const taskStatus = _getTaskStatus(task);
          const errors = _.get(task, '__props.errors', []);

          if (task) {
            return [
              {
                hasError: taskStatus.hasError,
                hasMapping: _isTaskHasMapping(task),
                hasIterators: isIterableTask(task),
                errors: errors
              }
            ];
          }
        }

        return [];
      }
    );
  }

  private _handleEnterNodeBadges(nodeBadges: any) {
    nodeBadges.enter()
      .append('div')
      .attr(this.ng2StyleAttr, '')
      .classed(CLS.diagramNodeBadge, true);
  }

  private _handleUpdateNodeBadges(nodeBadges: any) {
    const diagram = this;

    nodeBadges.html((taskStatus: any) => {
      let tpl = '';

      if (taskStatus) {
        if (taskStatus.hasError) {
          const message = _.reduce(taskStatus.errors, (result: string, error: { msg: string; time: string; }) => {
            return `${result}[Error][${moment(error.time || new Date().toJSON())
              .fromNow()
              }]: ${error.msg}\n`;
          }, '');

          /* tslint:disable-next-line:max-line-length */
          tpl += `<i ${diagram.ng2StyleAttr} class="flogo-flows-detail-diagram-status-icon flogo-flows-detail-diagram-ic-error" title="${message.trim()}"></i>`;
        }

        if (taskStatus.hasMapping) {
          tpl += `<i ${diagram.ng2StyleAttr} class="flogo-flows-detail-diagram-status-icon flogo-flows-detail-diagram-ic-transform"></i>`;
        }
        if (taskStatus.hasIterators) {
          tpl += `<i ${diagram.ng2StyleAttr} class="flogo-flows-detail-diagram-status-icon flogo-icon-iterator"></i>`;
        }
      }

      return tpl;
    });
  }

  private _handleExitNodeBadges(nodeBadges: any) {
    nodeBadges.exit()
      .remove();
  }

  private _handleNodeBadges(nodeBadges: any) {

    this._handleEnterNodeBadges(nodeBadges);
    this._handleUpdateNodeBadges(nodeBadges);
    this._handleExitNodeBadges(nodeBadges);

  }

  private _updateNG2StyleAttr() {
    const el = this.elm.getElementsByClassName(CLS.diagram);
    const ng2StyleAttrReg = /^_ngcontent\-.*$/g;

    if (el && el.length) {
      Array.prototype.some.call(
        el[0].attributes, (attr: any) => {

          if (ng2StyleAttrReg.test(attr.name)) {
            this.ng2StyleAttr = attr.name;

            return true;
          }

          return false;
        }
      );

      return true;
    }

    return false;
  }

}

function _triggerCustomEvent(eventType: string, eventDetail: any, elm: HTMLElement): boolean {

  // trigger specific events
  if (CustomEvent && elm.dispatchEvent) {
    if (eventType) {
      const evtDetail = {
        'view': window,
        'bubbles': true,
        'cancelable': true,
        'cancelBubble': true,
        'detail': eventDetail
      };

      elm.dispatchEvent(new CustomEvent(eventType, evtDetail));

      return true;
    } else {
      /* tslint:disable-next-line:no-unused-expression */
      DEBUG && console.warn('No eventType is given.');
      return false;
    }
  } else {
    /* tslint:disable-next-line:no-unused-expression */
    DEBUG && console.warn('Unsupport CustomEvent or dispatchEvent');
    return false;
  }

}

function _getTaskStatus(task: any) {
  const _errors = _.get(task, '__props.errors', []);
  const _warnings = _.get(task, '__props.warnings', []);

  const taskStatus: {
    [key: string]: boolean;
    hasError: boolean;
    hasWarning: boolean;
  } = {
    hasError: !_.isEmpty(_errors),
    hasWarning: !_.isEmpty(_warnings)
  };

  _.forIn(_.get(task, '__status', {}), (val: boolean, statusName: string) => {
    taskStatus[statusName] = val;
  });

  return taskStatus;
}

function _isNodeHasDetails(nodeInfo: any): boolean {
  if (nodeInfo.type) {
    return [
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ADD,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_HOLDER,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW
    ].indexOf(nodeInfo.type) === -1;
  } else {
    return false;
  }
}

function _isNodeHasMenu(nodeInfo: any): boolean {
  if (nodeInfo.type) {
    return [
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ADD,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_NEW,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_HOLDER,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW
    ].indexOf(nodeInfo.type) === -1;
  } else {
    return false;
  }
}

function _isNodeSelectable(nodeInfo: FlowNode) {
  if (nodeInfo.type) {
    return [
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_HOLDER,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_PADDING,
      FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_ROOT_ERROR_NEW
    ].indexOf(nodeInfo.type) === -1;
  } else {
    return false;
  }
}

function _isTaskHasMapping(taskInfo: any): boolean {
  return taskInfo && (
    (
      _.isArray(taskInfo.inputMappings) && taskInfo.inputMappings.length > 0
    )
    // TODO: re-enable outputMappings verification after its editing is enabled
    // || (
    //  _.isArray( taskInfo.outputMappings ) && taskInfo.outputMappings.length > 0
    // )
  );
}

function _getRowHeight(elm: HTMLElement, rowClassName: string): number {
  // Need to make sure that the elm is in a visible contianer.
  const rowElm = elm.querySelector(`.${rowClassName}`);
  const clientRect = rowElm.getBoundingClientRect();

  return clientRect.height;
}

function _isReturnActivity(task) {
  if (task) {
    return task.return;
  } else {
    return false;
  }
}

/**
 * Utility functions to delete nodes
 */
function _isInSingleRow(node: FlowNode) {
  const parentsCount = node.parents && node.parents.length;
  return ((parentsCount === 0 || parentsCount === 1) && node.children.length < 2);
}

function _isBranchNode(node: FlowNode) {
  return node.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH;
}

function _hasTaskRun(node: FlowNode, tasks: TaskDictionary): boolean {
  if (!node || !tasks) {
    return false;
  }

  const task = tasks[node.taskID];

  if (!task) {
    return false;
  }

  return _.get(task, '__status.hasRun', false);
}

function _hasBranchRun(node: FlowNode,
                       tasks: TaskDictionary,
                       nodes: NodeDictionary): boolean {

  if (!node || !tasks || !nodes || !_isBranchNode(node)) {
    return false;
  }

  const parents = _.get(node, 'parents', []);
  const children = _.get(node, 'children', []);

  // when no parent or no child, then the branch shouldn't been run
  if (!parents.length || !children.length) {
    return false;
  }

  // if any of the parents and any of the children have run
  // then the branch should be marked as run
  return _.some(parents, (parent) => _hasTaskRun(nodes[parent], tasks)) && _.some(children,
    (child) => _hasTaskRun(nodes[child], tasks));

}

function _removeNodeInSingleRow(node: FlogoFlowDiagramNode, nodes: NodeDictionary, root: RootFlowNode) {
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.group(`_removeNodeInSingleRow: ${node.id}`);

  const itsParent = nodes[node.parents[0]];
  const itsChild = nodes[node.children[0]];

  if (itsChild) {
    if (itsChild.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
      _removeBranchNode(<FlogoFlowDiagramNode>itsChild, nodes, root);
    }
    if (itsParent) {
      if (itsChild.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
        itsParent.children.splice(itsParent.children.indexOf(node.id), 1);
      } else {
        itsChild.parents.splice(itsChild.parents.indexOf(node.id), 1, itsParent.id);
        itsParent.children.splice(itsParent.children.indexOf(node.id), 1, itsChild.id);
      }
    } else if (root) {
      // child and no parent means this is the root node
      // child needs to be the root now
      root.is = itsChild.id;
      itsChild.parents.splice(itsChild.parents.indexOf(node.id), 1);
    }
  } else if (itsParent) {
    itsParent.children.splice(itsParent.children.indexOf(node.id), 1);
  }

  delete nodes[node.id];
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.groupEnd();
}

function _removeNodeHasChildren(node: FlogoFlowDiagramNode, nodes: NodeDictionary, root: RootFlowNode) {
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.group(`_removeNodeHasChildren: ${node.id}`);

  // TODO
  //  note that the node has single non-branch child at the time of implement this logic.
  //  if that assumption is changed, then need to refine this logic.
  if (node.children.length > 1) {
    // remove all of the branch type children;
    node.children = _.filter(_.clone(node.children), (childNodeID: string) => {
      const childNode = <FlogoFlowDiagramNode>nodes[childNodeID];
      if (childNode && childNode.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {
        _deleteNode(childNode, nodes, root);
        return false;
      }

      return true;
    });
  }

  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.log(_.cloneDeep(node));

  // remove self;
  _deleteNode(node, nodes, root);
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.groupEnd();
}

function _removeBranchNode(node: FlogoFlowDiagramNode, nodes: NodeDictionary, root: RootFlowNode) {
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.group(`_removeBranchNode: ${node.id}`);

  if (node.children.length > 0) {
    _recursivelyDeleteNodes(<FlogoFlowDiagramNode>nodes[node.children[0]], nodes, root);
  }

  _removeNodeInSingleRow(node, nodes, root);
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.groupEnd();
}

// could be used to recursively delete nodes
function _deleteNode(node: FlogoFlowDiagramNode, nodes: NodeDictionary, root: RootFlowNode) {
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.group(`_deleteNode: ${node.id}`);
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.log(_.cloneDeep(node));

  if (node && nodes) {
    if (node.children.length > 1) {

      _removeNodeHasChildren(node, nodes, root);

    } else if (node.type === FLOGO_FLOW_DIAGRAM_NODE_TYPE.NODE_BRANCH) {

      _removeBranchNode(node, nodes, root);

    } else if (_isInSingleRow(node)) {

      _removeNodeInSingleRow(node, nodes, root);

    } else {
      // TODO
      //  support linking cases
      /* tslint:disable-next-line:no-unused-expression */
      DEBUG && console.warn('Unsupported case..');
    }
  }
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.groupEnd();
}

function _recursivelyDeleteNodes(node: FlogoFlowDiagramNode, nodes: NodeDictionary, root: RootFlowNode) {
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.group(`_recursivelyDeleteNodes: ${node.id}`);

  if (node.children.length > 0) {
    _.each(_.clone(node.children), (childNodeID: string) => {
      const childNode = <FlogoFlowDiagramNode>nodes[childNodeID];

      if (childNode) {
        _recursivelyDeleteNodes(childNode, nodes, root);
      }
    });
  }

  _deleteNode(node, nodes, root);
  /* tslint:disable-next-line:no-unused-expression */
  VERBOSE && console.groupEnd();
}