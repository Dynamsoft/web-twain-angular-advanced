/// <reference types="jasmine" />

import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';

import { DwtComponent } from './dwt.component';

describe('DwtComponent', () => {
  let component: DwtComponent;
  let fixture: ComponentFixture<DwtComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DwtComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DwtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
});
