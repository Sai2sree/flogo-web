import {Component, HostBinding, OnDestroy, HostListener} from '@angular/core';
import {PostService} from '@flogo/core/services/post.service';

import {SUB_EVENTS, PUB_EVENTS} from './messages';

@Component({
  selector: 'flogo-flow-error-panel',
  templateUrl: 'error-panel.component.html',
  styleUrls: ['error-panel.component.less']
})


export class FlogoFlowsDetailErrorPanelComponent implements OnDestroy {

  @HostBinding('class.is-open')
  isOpen = false;
  @HostBinding('class.is-opening')
  isOpening = false;
  @HostBinding('class.is-closing')
  isClosing = false;

  isScreenScrolled  = false;
  imgErrorHandler = '/assets/svg/error-icon-info.svg';

  private subscriptions: Array<any>;

  constructor(private postService: PostService) {
    this.initSubscribe();
  }

  public openLogs() {
    window.open('http://localhost:3012');
  }

  public toggle() {
    this.isClosing = this.isOpen;
    this.isOpening = !this.isClosing;

    // let the animation setup take effect
    setTimeout(() => {
      this.isOpening = false;
      this.isClosing = false;
      this.isOpen = !this.isOpen;

      if (this.isOpen) {
        this.postService.publish( _.assign( {}, PUB_EVENTS.openPanel, { data : {} } ) );
      } else {
        this.postService.publish( _.assign( {}, PUB_EVENTS.closePanel, { data : {} } ) );
      }

    }, 100);
  }

  public open() {
    if (!this.isOpen && !this.isOpening) {
      this.toggle();
    }
  }

  public close() {
    if (this.isOpen || this.isOpening) {
      this.toggle();
    }
  }

  public ngOnDestroy(): any {
    this.unsubscribe();
  }

  @HostListener('window:scroll', ['$event'])
  onPageScroll(event: Event) {
    if (this.isOpen) {
      const target = <any>event.target;
      const NAV_HEIGHT = 48;
      this.isScreenScrolled = !!(target && target.body && target.body.scrollTop > NAV_HEIGHT);
    }
  }

  private initSubscribe() {
    if ( _.isEmpty( this.subscriptions ) ) {
      this.subscriptions = [];
    }

    if ( !this.postService ) {
      console.error( 'No PostService Found..' );
      return;
    }

    const subs = [
      _.assign( {}, SUB_EVENTS.openPanel, { callback : this.open.bind(this) } ),
      _.assign( {}, SUB_EVENTS.closePanel, { callback : this.close.bind(this) } )
    ];

    _.each(
      subs, ( sub ) => {
        this.subscriptions.push( this.postService.subscribe( sub ) );
      }
    );
  }

  private unsubscribe() {
    if ( _.isEmpty( this.subscriptions ) ) {
      return true;
    }

    _.each(
      this.subscriptions, sub => {
        this.postService.unsubscribe( sub );
      }
    );

    return true;
  }

}