import { Component, OnInit, HostListener } from '@angular/core';
import { DwtService } from './dwt.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  eventsSubject: Subject<void> = new Subject<void>();

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.eventsSubject.next(event);
  }
  title = 'DWT + Angular Sample';
  version = ' v18.2';
  currentEnv = "";
  bStartUp = true;
  bMobile = false;
  bUseCameraViaDirectShow = true;
  constructor(protected dwtService: DwtService) { }

  toggleStartDemo() {
    this.bStartUp = !this.bStartUp;
    this.dwtService.bUseCameraViaDirectShow = this.bUseCameraViaDirectShow;
  }
  ngOnInit() {
	let env = this.dwtService.runningEnvironment;
	if (env.bMobile) {
		this.bMobile = env.bMobile;
		this.currentEnv += env.bChrome ? "Chrome " + env.strChromeVersion : "";
		this.currentEnv += env.bFirefox ? "Firefox " + env.strFirefoxVersion : "";
		this.currentEnv += env.bSafari ? "Safari" : "";
	} else {
		this.currentEnv += env.bWin ? "Windows, " : "";
		this.currentEnv += env.bLinux ? "Linux, " : "";
		this.currentEnv += env.bChrome ? "Chrome " + env.strChromeVersion : "";
		this.currentEnv += env.bFirefox ? "Firefox " + env.strFirefoxVersion : "";
		this.currentEnv += env.bSafari ? "Safari" : "";
		this.currentEnv += env.bIE ? "Internet Explorer" + env.strIEVersion : "";
		this.currentEnv += env.bEdge ? "Edge" : "";
	}
	let curYear = <HTMLDivElement>document.getElementById("copyRightCurYear");
	curYear.innerHTML = (new Date()).getFullYear().toString();
  }
}
