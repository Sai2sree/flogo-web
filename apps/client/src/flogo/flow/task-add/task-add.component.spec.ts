import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { TASKADD_OPTIONS, TaskAddComponent } from './task-add.component';
import { TaskAddModule } from './task-add.module';
import { FakeRootLanguageModule } from '@flogo-web/client-core/language/testing';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { FlogoFlowService } from '@flogo-web/client/flow/core';
import { RESTAPIContributionsService } from '@flogo-web/client-core/services/restapi/v2/contributions.service';
import { TaskAddOptions } from './core/task-add-options';

describe('Component: TaskAddComponent', () => {
  let component: TaskAddComponent;
  let fixture: ComponentFixture<TaskAddComponent>;
  const mockOptions: TaskAddOptions = {
    activities$: of([
      {
        ref: 'github.com/TIBCOSoftware/flogo-contrib/activity/log',
        title: 'Log message',
      },
      {
        ref: 'github.com/TIBCOSoftware/flogo-contrib/activity/counter',
        title: 'Counter',
      },
      {
        ref: 'github.com/TIBCOSoftware/flogo-contrib/activity/subflow',
        title: 'Start a subflow',
      },
    ]),
    appAndFlowInfo$: of({
      appId: 'some_app',
      actionId: 'some_action',
    }),
    selectActivity: () => {},
    installedActivity: () => {},
    updateActiveState: () => {},
  };
  const mockFlowService = {
    listFlowsForApp: () => Promise.resolve([]),
  };
  const mockContribsAPIService = {
    installContributions: () => Promise.resolve({}),
    getContributionDetails: () => Promise.resolve({}),
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [FakeRootLanguageModule, TaskAddModule],
      providers: [
        {
          provide: TASKADD_OPTIONS,
          useValue: mockOptions,
        },
        {
          provide: FlogoFlowService,
          useValue: mockFlowService,
        },
        {
          provide: RESTAPIContributionsService,
          useValue: mockContribsAPIService,
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show 3 activities without filter', () => {
    const activitiesElements = fixture.debugElement.queryAll(By.css('.qa-activities'));
    expect(activitiesElements.length).toEqual(3);
  });

  it('should show 1 activity after filtering with "log"', () => {
    component.filterActivities('log');
    fixture.detectChanges();
    const activitiesElements = fixture.debugElement.queryAll(By.css('.qa-activities'));
    expect(activitiesElements.length).toEqual(1);
  });

  it('should show empty message if no activity with filtered text', () => {
    component.filterActivities('error');
    fixture.detectChanges();
    const activitiesElements = fixture.debugElement.queryAll(By.css('.qa-activities'));
    const messageElement = fixture.debugElement.query(By.css('.qa-no-tasks'));
    expect(activitiesElements.length).toEqual(0);
    expect(messageElement.nativeElement.innerHTML).toEqual('ADD:NO-TASKS');
  });

  it('should select the activity as a task', () => {
    const spySelectActivity = spyOn(
      fixture.debugElement.injector.get(TASKADD_OPTIONS),
      'selectActivity'
    );
    const activitiesElements = fixture.debugElement.queryAll(By.css('.qa-activities'));
    activitiesElements[1].triggerEventHandler('click', null);
    fixture.detectChanges();
    const [ref] = spySelectActivity.calls.mostRecent().args;
    expect(spySelectActivity).toHaveBeenCalledTimes(1);
    expect(ref).toEqual('github.com/TIBCOSoftware/flogo-contrib/activity/counter');
  });

  it('should open installer and mark the popover to keep active', () => {
    const spyActiveState = spyOn(
      fixture.debugElement.injector.get(TASKADD_OPTIONS),
      'updateActiveState'
    );
    const installElement = fixture.debugElement.query(By.css('.qa-install-item'));
    installElement.triggerEventHandler('click', null);
    fixture.detectChanges();
    const [state] = spyActiveState.calls.mostRecent().args;
    expect(spyActiveState).toHaveBeenCalledTimes(1);
    expect(component.isInstallOpen).toEqual(true);
    expect(state).toEqual(true);
  });

  it('should open subflow window and mark the popover to keep active', () => {
    const spyActiveState = spyOn(
      fixture.debugElement.injector.get(TASKADD_OPTIONS),
      'updateActiveState'
    );
    const activitiesElements = fixture.debugElement.queryAll(By.css('.qa-activities'));
    activitiesElements[2].triggerEventHandler('click', null);
    fixture.detectChanges();
    const [state] = spyActiveState.calls.mostRecent().args;
    expect(spyActiveState).toHaveBeenCalledTimes(1);
    expect(component.isSubflowOpen).toEqual(true);
    expect(state).toEqual(true);
  });
});
