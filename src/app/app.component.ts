import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DwtService } from './dwt.service';
import { Subject } from 'rxjs';
import { DwtComponent } from './dwt/dwt.component';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css', 
  
  imports: [
    CommonModule,
    DwtComponent
  ]
})
export class AppComponent implements OnInit {
  eventsSubject: Subject<void> = new Subject<void>();

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.eventsSubject.next(event);
  }
  title = 'DWT + Angular Sample';
  version = ' v19.x';
  currentEnv = "";
  bStartUp = true;
  bStartDemo = false;
  bUseCameraViaDirectShow = true;
  constructor(protected dwtService: DwtService) {
    let _this = this; 
    dwtService.showStartDemo(function(bShowStartDemo){
      _this.bStartDemo = bShowStartDemo;
      //_this.onResize(undefined);
    });
  }

  toggleStartDemo() {
    this.bStartUp = !this.bStartUp;
    this.dwtService.bUseCameraViaDirectShow = this.bUseCameraViaDirectShow;
  }
  ngOnInit() {
	let env = this.dwtService.runningEnvironment;

  this.currentEnv += env.bWin ? "Windows, " : "";
  this.currentEnv += env.bLinux ? "Linux, " : "";
  this.currentEnv += env.bChrome ? "Chrome " + env.strChromeVersion : "";
  this.currentEnv += env.bFirefox ? "Firefox " + env.strFirefoxVersion : "";
  this.currentEnv += env.bSafari ? "Safari" : "";
  this.currentEnv += env.bIE ? "Internet Explorer" + env.strIEVersion : "";
  this.currentEnv += env.bEdge ? "Edge" : "";
  
	let curYear = <HTMLDivElement>document.getElementById("copyRightCurYear");
	curYear.innerHTML = (new Date()).getFullYear().toString();
  }

}
