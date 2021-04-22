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
  version = ' v17.0';
  currentEnv = "";
  bStartUp = true;
  bNoInstall = false;
  bMobile = false;
  bShowCameraOption = false;
  bUseCameraViaDirectShow = false;
  constructor(protected dwtService: DwtService) { }

  toggleStartDemo() {
    this.bStartUp = !this.bStartUp;
    this.dwtService.bUseService = !this.bNoInstall;
    this.dwtService.bUseCameraViaDirectShow = this.bUseCameraViaDirectShow && !this.bNoInstall;
  }
  ngOnInit() {
	let env = this.dwtService.runningEnvironment;
	if (env.bMobile) {
		this.bMobile = env.bMobile;
		this.currentEnv += env.bChrome ? "Chrome " + env.strChromeVersion : "";
		this.currentEnv += env.bFirefox ? "Firefox " + env.strFirefoxVersion : "";
		this.currentEnv += env.bSafari ? "Safari" : "";
	} else {
		if (env.bWin)
		  this.bShowCameraOption = true;
		this.currentEnv += env.isX64 ? "64bit " : "32bit ";
		this.currentEnv += env.bWin ? "Windows, " : "";
		this.currentEnv += env.bMac ? "macOS " + env.macOSX + " " + env.osVersion + ", " : "";
		this.currentEnv += env.bLinux ? "Linux, " : "";
		this.currentEnv += env.bChrome ? "Chrome " + env.strChromeVersion : "";
		this.currentEnv += env.bFirefox ? "Firefox " + env.strFirefoxVersion : "";
		this.currentEnv += env.bSafari ? "Safari" : "";
		this.currentEnv += env.bIE ? "Internet Explorer" + env.strIEVersion : "";
		this.currentEnv += env.bEdge ? "Edge" : "";
	}
  }
}
