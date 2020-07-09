import { TestBed } from '@angular/core/testing';

import { DwtService } from './dwt.service';

describe('DwtService', () => {
  let service: DwtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DwtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
