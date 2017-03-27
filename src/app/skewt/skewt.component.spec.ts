import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SkewtComponent } from './skewt.component';

describe('SkewtComponent', () => {
  let component: SkewtComponent;
  let fixture: ComponentFixture<SkewtComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SkewtComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SkewtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
