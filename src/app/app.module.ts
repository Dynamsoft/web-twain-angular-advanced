import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { DwtComponent } from './dwt/dwt.component';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CallbackPipe } from './callback.pipe';
import { SafeurlPipe } from './safeurl.pipe';

@NgModule({
  declarations: [
    AppComponent,
    DwtComponent,
    CallbackPipe,
    SafeurlPipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgbModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
