import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { select, Store } from '@ngrx/store';
import { of as observableOf, forkJoin } from 'rxjs';
import { mergeMap, take, tap } from 'rxjs/operators';

import { TriggerHandler } from '@flogo-web/client-core';
import { RESTAPIHandlersService, TriggersApiService } from '@flogo-web/client-core/services';

import { AppState } from '@flogo-web/client/flow/core/state/app.state';
import * as TriggerActions from '@flogo-web/client/flow/core/state/triggers/triggers.actions';
import {
  TriggerConfigureSelectors,
  TriggerConfigureActions,
} from '@flogo-web/client/flow/core/state/triggers-configure/index';

import { SaveParams } from './save/save-params';
import { extractTriggerChanges } from './save/extract-trigger-changes';
import { extractHandlerChanges } from './save/extract-handler-changes';

@Injectable()
export class ConfiguratorService {
  private params: SaveParams;

  constructor(
    private store: Store<AppState>,
    private triggerService: TriggersApiService,
    private handlersService: RESTAPIHandlersService
  ) {}

  setParams(params: SaveParams) {
    this.params = params;
  }

  clear() {
    this.params = null;
  }

  save() {
    const saveParams = this.params;
    return this.store.pipe(
      select(TriggerConfigureSelectors.getSaveInfo),
      take(1),
      tap(({ triggerId }) =>
        this.store.dispatch(new TriggerConfigureActions.SaveTriggerStarted({ triggerId }))
      ),
      mergeMap(({ triggerId, actionId, handler }) => {
        return forkJoin(
          this.saveTriggerSettings(triggerId, saveParams.settings),
          this.saveHandlerSettings({ triggerId, actionId }, handler, saveParams)
        ).pipe(
          tap(() =>
            this.store.dispatch(
              new TriggerConfigureActions.SaveTriggerCompleted({ triggerId })
            )
          )
        );
      })
    );
  }

  private saveHandlerSettings(
    { triggerId, actionId }: { triggerId: string; actionId: string },
    currentHandler: TriggerHandler,
    saveParams: SaveParams
  ) {
    const changes = extractHandlerChanges(currentHandler, saveParams);
    if (changes) {
      return this.handlersService
        .updateHandler(triggerId, actionId, changes)
        .then(updatedHandler => {
          this.store.dispatch(
            new TriggerActions.UpdateHandler({
              triggerId,
              handler: { triggerId, ...updatedHandler },
            })
          );
        });
    }
    return observableOf(null);
  }

  private saveTriggerSettings(triggerId: string, allSettingsForm: FormGroup) {
    const changes = extractTriggerChanges(allSettingsForm);
    if (changes) {
      return this.triggerService
        .updateTrigger(triggerId, changes)
        .then(updatedTrigger => {
          this.store.dispatch(new TriggerActions.UpdateTrigger(updatedTrigger));
        });
    }
    return observableOf(null);
  }
}
