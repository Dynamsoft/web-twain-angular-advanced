/// <reference types="jasmine" />

import { SafeurlPipe } from './safeurl.pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('SafeurlPipe', () => {
  it('create an instance', () => {
    const sanitizer = {
      bypassSecurityTrustResourceUrl: (url: string) => url
    } as unknown as DomSanitizer;
    const pipe = new SafeurlPipe(sanitizer);
    expect(pipe).toBeTruthy();
  });
});
