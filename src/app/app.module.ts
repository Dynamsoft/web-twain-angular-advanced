import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { DwtComponent } from './dwt/dwt.component';
import { FormsModule } from '@angular/forms';
import { CallbackPipe } from './callback.pipe';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
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
    DragDropModule,
    NgbModule
  ],
  providers: [SafeurlPipe],
  bootstrap: [AppComponent]
})
export class AppModule { }
