import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoModalComponent } from './video-modal.component';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';

describe('VideoModalComponent', () => {
  let component: VideoModalComponent;
  let fixture: ComponentFixture<VideoModalComponent>;
  let backNavigation: jasmine.SpyObj<BackNavigationService>;

  beforeEach(async () => {
    backNavigation = jasmine.createSpyObj<BackNavigationService>(
      'BackNavigationService',
      ['register', 'unregister']
    );

    await TestBed.configureTestingModule({
      imports: [VideoModalComponent],
      providers: [{ provide: BackNavigationService, useValue: backNavigation }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close through browser back without unregistering twice', () => {
    component.video = {
      name: 'Vídeo',
      safeUrl: 'https://example.test/video',
    };
    component.visible = true;
    component.ngOnChanges();
    const onBack = backNavigation.register.calls.mostRecent().args[0];
    const closeSpy = spyOn(component.close, 'emit');

    onBack();

    expect(closeSpy).toHaveBeenCalled();
    expect(backNavigation.unregister).not.toHaveBeenCalled();
  });

  it('should unregister when closed normally', () => {
    component.video = {
      name: 'Vídeo',
      safeUrl: 'https://example.test/video',
    };
    component.visible = true;
    component.ngOnChanges();

    component.visible = false;
    component.ngOnChanges();

    expect(backNavigation.unregister).toHaveBeenCalledTimes(1);
  });
});
