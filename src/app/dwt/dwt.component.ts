import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { DwtService, Device } from './../dwt.service';
import { WebTwain } from 'dwt/dist/types/WebTwain';
import { ThumbnailViewer } from 'dwt/dist/types/WebTwain.Viewer';
import { ThumbnailViewerSettings } from 'dwt/dist/types/WebTwain.Viewer';
import { ViewMode } from 'dwt/dist/types/WebTwain.Viewer';
import { Subscription, Observable } from 'rxjs';

import Dynamsoft from 'dwt';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CallbackPipe } from '../callback.pipe';
import { SafeurlPipe } from '../safeurl.pipe';

@Component({
  selector: 'app-dwt',
  templateUrl: './dwt.component.html',
  styleUrl: './dwt.component.css',
  imports: [
    NgbModule,
    CommonModule,
    FormsModule,
    CallbackPipe,
    SafeurlPipe
  ]
})
export class DwtComponent implements OnInit, OnDestroy {
  @Input() events: Observable<void>;

  /**
   * Variable that refer to the open modal dialog.
   */
  private modalRef: NgbModalRef;
  /**
   * A few subscriptions and observables to get information from dwt.service
   */
  private eventsSubscription: Subscription;
  private barcodeReadingSubscription: Subscription;
  private bufferSubscription: Subscription;
  private bufferObservable: Observable<string>;
  private generalSubscription: Subscription;
  /**
   * Two WebTwain objects doing all the job.
   */
  protected DWTObject: WebTwain = null;
  protected VideoContainer: WebTwain = null;
  /**
   * Global variables and status flags.
   */
  public bWin = true;
  public dwtMounted = true;
  public bUseCameraViaDirectShow: boolean;
  public containerId = "dwtcontrolContainer";
  public videoContainerId = "videoContainer";
  public editorShown = false;
  public devices: Device[];
  public showDevices: boolean = false;
  public deviceName: string = "Choose...";
  public thumbnail: ThumbnailViewer;
  public emptyBuffer: boolean = true;
  public zones: Zone[] = [];
  public mainViewerPos = { x: 0, y: 0 };
  public videoPlaying: boolean = false;
  public showVideoText: string = "Show Video";
  public instantError: string = "There is no image in buffer!";
  public outputMessages: Message[] = [];
  public historyMessages: Message[] = [];
  public bDontScrollMessages: boolean = true;
  /**
   * For Barcode Reading.
   */
  public barcodeResult: Observable<any>;
  public barcodeRects: any
  public barcodeRectsOnCurrentImage: Array<BarcodeRectToShow> = [];
  public barcodeButtonText = "Read";
  /**
   * Buffer info
   */
  public current: 0;
  public count: 0;
  /**
   * Options.
   */
  public formatsToImport = {
    JPG: true,
    PNG: true,
    TIF: false,
    PDF: false
  };
  public scanOptions = {
    IfShowUI: true,
    PixelType: "1",// "gray"
    Resolution: 200,
    IfFeederEnabled: false,
    IfDuplexEnabled: false,
    IfDisableSourceAfterAcquire: true,
    IfGetImageInfo: false,
    IfGetExtImageInfo: false,
    extendedImageInfoQueryLevel: 0
  };
  public cameraOptions = [];
  public currentOption = "";
  public currentOptionItems = [];
  public currentItem = "";
  public showRangePicker = false;
  public rangePicker: any = null;
  public barcodeReaderOptions = {
    Symbologies: {
      All: true,
      Linear: true,
      QRCode: true,
      Pdf: true,
      DM: true,
      Aztec: true,
      GS1Databar: true,
      Maxi: true,
      Patch: true,
      Postal: true,
      Dot: true,
      GS1Composite: true
    },
    Mode: "balance",
    showRects: true,
    rectShowingTime: 3,
    interval: null
  };
  public saveOptions = {
    outPutType: "File",
    outPutFormat: "PDF",
    multiPage: false,
    fileName: "CreatedByDynamsoft",
    upload: true,
    buttonText: "Upload",
    indices: []
  };
  public saveResults = {
    blob: [],
    blobURL: [],
    base64String: [],
    savedFiles: [],
    uploadedFiles: [],
    base64ButtonText: [],
    saveFileText: [],
    blobToShow: null
  };
  public saveBarcodesDivScrollPos = 0;


  constructor(protected dwtService: DwtService, private modalService: NgbModal) {

  }

  ngAfterViewInit() {
    this.initDWT();
  }

  ngOnInit() {

    this.eventsSubscription = this.events.subscribe(
      (args: any) => {
        if (args.type)
          switch (args.type) {
            case "resize":
              if (this.editorShown)
                break;
              else
                if (this.updateViewer()) {
                  this.showRects();
                }
              break;
            default: break;
          }
      }
    );
    this.barcodeResult = this.dwtService.barcodeSubject;
    this.bufferObservable = this.dwtService.bufferSubject;
    this.barcodeReadingSubscription = this.barcodeResult.subscribe(
      result => {
        if (result.done) {
          this.barcodeButtonText = "Done, Click to Read Again!";
        }
        if (result.imageIds) {
          // Barcode rects have been returned
          this.barcodeRects = result;
          this.showRects();
        } else if (result.length > 0 && result[0].type !== "") {
          for (let i = 0; i < result.length; i++)
            this.handleOutPutMessage(result[i].text, result[i].type, false, false);
        }
      }
    );
    this.bufferSubscription = this.bufferObservable.subscribe(
      bufferStatus => {
        this.emptyBuffer = false;
        switch (bufferStatus) {
          default: break;
          case "empty": this.emptyBuffer = true; break;
          case "changed": 
            this.barcodeRectsOnCurrentImage = [];
            this.zones = [];
            break;
        }
        if (this.emptyBuffer) {
          this.showMessage("There is no image in buffer!");
        } else { this.clearMessage() }
      }
    );
    this.generalSubscription = this.dwtService.generalSubject.subscribe(
      input => {
        if (input && input.type) {
          switch (input.type) {
            case "httpResponse":
              this.handleOutPutMessage(input.responsString, input.type, false, false);
            case "deviceName":
              if (input.deviceName === "") {
                this.deviceName = "Choose...";
              } else {
                this.deviceName = input.deviceName; 
              }
              break;
            case "cameraOptions":
              if (this.deviceName === "" || this.deviceName === "Choose...")
                break;
              this.cameraOptions = input;
              for (let i = 0; i < input.length; i++) {
                if (input[i].current) {
                  this.currentOption = input[i].name;
                  this.currentOptionItems = input[i].items;
                  for (let j = 0; j < this.currentOptionItems.length; j++) {
                    if (this.currentOptionItems[j].checked) {
                      this.currentItem = this.currentOptionItems[j].value;
                      this.setupPlayVideo({ prop: this.currentOption, value: this.currentItem });
                    }
                  }
                  break;
                }
              }
              this.playVideo();
              break;
            default: break;
          }
        }
      }
    );
  }
  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
    this.bufferSubscription.unsubscribe();
    this.generalSubscription.unsubscribe();
    this.barcodeReadingSubscription.unsubscribe();
    this.dwtService.unMountDWT().then(
      _ =>
        this.dwtService.unMountVideoContainer());
  }
  clearMessage() {
    this.instantError = "";
  }
  showMessage(msg: string) {
    this.instantError = msg;
  }
  /**
   * Supporting functions.
   */
  isScannerFilter(device: Device) {
    return device.type === "scanner";
  }
  isCameraFilter(device: Device) {
    return device.type === "camera";
  }
  toggleCheckAll() {
    let _symbologies = this.barcodeReaderOptions.Symbologies;
    for (let key in _symbologies) {
      if (_symbologies.hasOwnProperty(key)) {
        if (key !== "All")
          _symbologies[key] = !_symbologies["All"];
      }
    }
  }
  showRects() {
    // Clear rects
    this.barcodeRectsOnCurrentImage = [];
    if (this.barcodeRects === undefined || this.barcodeRects.imageIds === undefined) return;
    if (this.barcodeRects.imageIds.length === 0 || this.barcodeRects.imageIds.length !== this.barcodeRects.rects.length)
      //invalid rects
      return;
    for (let i = 0; i < this.barcodeRects.imageIds.length; i++) {
      let currentIndex = this.DWTObject.ImageIDToIndex(this.barcodeRects.imageIds[i]);
      if (this.DWTObject.CurrentImageIndexInBuffer === currentIndex) {
        let rectsOnOnePage = this.barcodeRects.rects[i];
        let mainViewer = <HTMLDivElement>document.querySelector("#" + this.containerId + " .dvs-viewer-main");
        let zoom = 0,
          viewerWidth = <number>mainViewer.offsetWidth,
          viewerHeight = <number>mainViewer.offsetHeight,
          imageWidth = <number>this.DWTObject.GetImageWidth(currentIndex),
          imageHeight = <number>this.DWTObject.GetImageHeight(currentIndex);
        this.mainViewerPos.y = <number>mainViewer.getBoundingClientRect().top;
        this.mainViewerPos.x = <number>mainViewer.getBoundingClientRect().left;
        if (viewerWidth >= imageWidth && viewerHeight >= imageHeight) {
          zoom = 1;
        } else if (viewerWidth / viewerHeight >= imageWidth / imageHeight) {
          zoom = viewerHeight / imageHeight;
        } else {
          zoom = viewerWidth / imageWidth;
        }
        for (let j = 0; j < rectsOnOnePage.length; ++j) {
          let rect = rectsOnOnePage[j];
          let leftBase = 1 + viewerWidth / 2 - imageWidth / 2 * zoom;
          let topBase = 1 + viewerHeight / 2 - imageHeight / 2 * zoom;
          let left = leftBase + rect.x * zoom;
          let top = topBase + rect.y * zoom;
          let width = rect.w * zoom;
          let height = rect.h * zoom;
          //this.showMessage("x: " + rect.x + " y: " + rect.y + " w: " + rect.w + ", h: " + rect.h);
          //this.DWTObject.OverlayRectangle(currentIndex, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h, 0xfe8e14, 0.5);
          this.barcodeRectsOnCurrentImage.push({ x: left, y: top, w: width, h: height });
        }
        break;
      }
    }
  }
  updateViewer() {
    if (this.DWTObject){
		this.thumbnail = this.DWTObject.Viewer.createThumbnailViewer(<ThumbnailViewerSettings>{size: '20%'});
		this.DWTObject.Viewer.width = "100%";
		this.DWTObject.Viewer.height = "100%";
		this.thumbnail.show();
		return true;
	}
    else
      return false;
  }
  unBindViewer() {
    if (this.DWTObject.Viewer.unbind()) {
      let container = document.getElementById(this.containerId) as HTMLDivElement;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      if (!this.emptyBuffer)
        this.clearMessage();
      return true;
    } else {
      this.showMessage(this.DWTObject.ErrorString);
      return false;
    }
  }
  bindViewer() {
    this.DWTObject.Viewer.bind(<HTMLDivElement>document.getElementById(this.containerId));
    this.DWTObject.Viewer.width = "100%";
    this.DWTObject.Viewer.height = "100%";
    this.DWTObject.Viewer.on("wheel", ()=>{
      this.barcodeReaderOptions.showRects = false;
      if(this.barcodeReaderOptions.interval) {
        clearInterval(this.barcodeReaderOptions.interval);
        this.barcodeReaderOptions.interval = null;
      }
      this.barcodeReaderOptions.rectShowingTime = 3;
    });
    this.DWTObject.Viewer.on("scroll", ()=>{
      this.barcodeReaderOptions.showRects = false;
      if(this.barcodeReaderOptions.interval) {
        clearInterval(this.barcodeReaderOptions.interval);
        this.barcodeReaderOptions.interval = null;
      }
      this.barcodeReaderOptions.rectShowingTime = 3;
    });

	this.thumbnail = this.DWTObject.Viewer.createThumbnailViewer(<ThumbnailViewerSettings>{size: '20%'});	
	if (this.thumbnail) {
		this.DWTObject.Viewer.show();
		this.thumbnail.show();
		// Remove the context menu which is still not functioning correctly.
		this.DWTObject.Viewer.off('imageRightClick');
		this.DWTObject.Viewer.on('pageAreaSelected', (nImageIndex, rect) => {
			if (rect.length > 0) {
				this.clearMessage();
				var currentRect = rect[rect.length - 1];
				if (rect.length > this.zones.length + 1) {
				  this.showMessage("Impossible Area selected!");
				  return;
				}
				if(rect.length == 1)
					this.zones = [];
				if (this.zones.length + 1 === rect.length)
				  this.zones.push({ x: currentRect.x, y: currentRect.y, width: currentRect.x + currentRect.width, height: currentRect.y + currentRect.height, index: nImageIndex });
				else
				  this.zones.splice(rect.length - 1, 1, { x: currentRect.x, y: currentRect.y, width: currentRect.x + currentRect.width, height: currentRect.y + currentRect.height, index: nImageIndex });
			}
		});
      this.DWTObject.Viewer.on('OnImageAreaDeSelected', () => {
        this.clearMessage(); this.zones = [];
      });
      this.DWTObject.Viewer.cursor = 'crosshair';
      this.DWTObject.Viewer.showPageNumber = true;
      //this.DWTObject.Viewer.off('imageRightClick');
      this.thumbnail.updateViewMode(<ViewMode>{columns: 1, rows: 3});
      if (document.getElementById(this.containerId + "-fileInput"))
        // Only allow one such input on the page
        return;
      let WASMInput = document.createElement("input");
      WASMInput.style.position = "fixed";
      WASMInput.style.top = "-1000px";
      WASMInput.setAttribute("multiple", "multiple");
      WASMInput.setAttribute("id", this.containerId + "-fileInput");
      WASMInput.setAttribute("type", "file");
      WASMInput.onclick = _ => {
        let filters : string[] = [], filter = "";
        this.formatsToImport.JPG ? filters.push("image/jpeg") : false;
        this.formatsToImport.PNG ? filters.push("image/png") : false;
        this.formatsToImport.TIF ? filters.push("image/tiff") : false;
        this.formatsToImport.PDF ? filters.push("application/pdf") : false;
        if (filters.length > 0) {
          filter = filters.join(",");
          this.clearMessage();
        } else {
          this.showMessage("Please select at least one format!");
          return false;
        }
        WASMInput.setAttribute("accept", filter);
      }
      WASMInput.onchange = evt => {
        let _input = evt.target as HTMLInputElement;
        this.dwtService.load(_input.files)
          .then(_ => {
            this.closeModal(true);
            _input.value = '';
          });
      };
      document.getElementById(this.containerId).parentElement.appendChild(WASMInput);
    }
    else {
      console.log(this.DWTObject.ErrorString);
    }
  }
  initDWT(): void {
    this.DWTObject = null;
    this.dwtService.mountDWT()
      .then(
        obj => {
          this.DWTObject = obj;
          this.bWin = this.dwtService.runningEnvironment.bWin;
          this.bUseCameraViaDirectShow = this.dwtService.bUseCameraViaDirectShow;
          this.dwtMounted = true;
          this.dwtService.mountVideoContainer()
            .then(containerDWT => {
              this.VideoContainer = containerDWT;
            }, err => this.showMessage(err));
          setTimeout(() => {
            this.bindViewer();
            this.DWTObject.Viewer.pageMargin = 10;
          }, 0);
        },
        err => this.showMessage(err));
  }
  openModal(content, type?: string) {
    this.modalRef = this.modalService.open(content, {
      backdrop: "static",
      centered: true,
      beforeDismiss: (): boolean => {
        switch (type) {
          case "acquire":
            this.dwtService.selectADevice("");
            this.deviceName = "Choose...";
            return true;
          case "camera":
            if (this.videoPlaying) {
              if (this.bUseCameraViaDirectShow) {
                this.showMessage("Please stop video first!");
                return false;
              }
              else {
                this.toggleVideo();
                this.dwtService.selectADevice("");
                this.deviceName = "Choose...";
                return true;
              }
            } else {
              this.dwtService.selectADevice("");
              this.deviceName = "Choose...";
              return this.VideoContainer.Viewer.unbind();
            }
          case "barcode":
            if(this.barcodeReaderOptions.interval) {
              clearInterval(this.barcodeReaderOptions.interval);
            }

            this.barcodeReaderOptions.interval = setInterval(
              () => {
                this.barcodeReaderOptions.rectShowingTime--;

                if (this.barcodeReaderOptions.rectShowingTime <= 0) {
                  this.barcodeReaderOptions.rectShowingTime = 3;
                  this.barcodeReaderOptions.showRects = false;
                  clearInterval(this.barcodeReaderOptions.interval);
                  this.barcodeReaderOptions.interval = null;
                }
              }, 1000);
            this.barcodeButtonText = "Read";
            this.handleOutPutMessage("", "", true, true);

            let barcodesDiv = document.querySelector('.barcodeReaderOptions');
            if(barcodesDiv) {
              this.saveBarcodesDivScrollPos = barcodesDiv.scrollTop;
            }
            
            return true;
          case "save":
            this.saveOptions.indices = [];
            return true;
          default:
            return true;
        }
      }
    });
    this.modalRef.result.then((result) => {//close
    }, (reason) => {//dismiss, reset modal dialogs
      if (this.emptyBuffer)
        this.showMessage("There is no image in buffer!");
      this.saveResults = {
        blob: [],
        blobURL: [],
        base64String: [],
        savedFiles: [],
        uploadedFiles: [],
        base64ButtonText: [],
        saveFileText: [],
        blobToShow: null
      };
    });
    switch (type) {
      case "camera":
        let makeSureDIVExists = () => {
          let container = <HTMLDivElement>document.getElementById(this.videoContainerId);
          if (container) {
            if (this.VideoContainer === null) {
              this.showMessage("No Video Container!");
              return;
            }
            container.style.height = "100%";
            this.cameraOptions = [];
            this.currentOption = "";
            this.currentItem = "";
            this.currentOptionItems = [];
            this.VideoContainer.Viewer.bind(<HTMLDivElement>document.getElementById(this.videoContainerId));
            this.VideoContainer.Viewer.width = "100%";
            this.VideoContainer.Viewer.height = "100%";
            this.VideoContainer.Viewer.show();
          }
          else
            setTimeout(() => makeSureDIVExists(), 10);
        };
        makeSureDIVExists();
        this.clearMessage();
        this.dwtService.getDevices(true)
          .then(result => { this.devices = result; this.showDevices = true; }, err => this.showMessage(err.message));
        this.deviceName = "Choose...";
        break;
      case "acquire":
        this.clearMessage();
        this.dwtService.getDevices(false)
          .then(result => { this.devices = result; this.showDevices = true; }, err => this.showMessage(err.message));
        this.deviceName = "Choose...";
        break;
      case "barcode":
        if (!this.emptyBuffer)
          this.clearMessage();
        this.barcodeReaderOptions.showRects = true;
        this.barcodeRectsOnCurrentImage = [];
        this.barcodeReaderOptions.rectShowingTime = 3;
        if(this.barcodeReaderOptions.interval) {
          clearInterval(this.barcodeReaderOptions.interval);
          this.barcodeReaderOptions.interval = null;
        }
        
        setTimeout(() => {
          let barcodesDiv = document.querySelector('.barcodeReaderOptions');
          if(barcodesDiv)
            barcodesDiv.scrollTo(0, this.saveBarcodesDivScrollPos);
        }, 0);
        break;
      case "save":
        if (!this.emptyBuffer)
          this.clearMessage();
        let selectedIndices = this.DWTObject.SelectedImagesIndices;
        let count = this.DWTObject.HowManyImagesInBuffer;
        for (let i = 0; i < count; i++)
          this.saveOptions.indices.push({ number: i, selected: !!selectedIndices.find(o => { return o == i; }) });
        break;
      default: break;
    }
  }
  closeModal(close: boolean) {
    if (this.modalRef === undefined) return;
    if (close)
      this.modalRef.close();
    else
      this.modalRef.dismiss();
  }
  handleDeviceChange(deviceType: string) {

    console.log('this.deviceName 0' + this.deviceName);
    if (this.deviceName === "" || this.deviceName === "Choose...")
      return;

    this.dwtService.selectADevice(this.deviceName)
      .then(
        done => done ? this.openADevice(deviceType) : this.showMessage("Device selecting failed!"),
        error => typeof error === "string" ? this.showMessage(error) : this.showMessage("Device selecting failed!"));
  }
  openADevice(deviceType: string) {
    
    this.clearMessage();
    if (deviceType === "camera") {
      if (this.videoPlaying)
        this.toggleVideo();
      this.toggleVideo();
    }
    
  }
  acquire() {
    this.scan();
  }
  acquireFromCamera() {
    this.dwtService.acquire()
      .then(_ => {
        this.showMessage("Captured successfully!"); setTimeout(() => {
          this.clearMessage();
        }, 3000);
      }, err => this.showMessage(err));
  }
  scan() {
    this.dwtService.acquire(this.scanOptions)
      .then(() => {
        this.closeModal(true);
        if (!this.emptyBuffer)
          this.clearMessage();
      }, err => this.showMessage(err));
  }
  load() {
    this.dwtService.load()
      .then(() => {
        this.closeModal(true);
        if (!this.emptyBuffer)
          this.clearMessage();
      }, err => this.showMessage(err));
  }
  showEditor() {
    this.DWTObject.Viewer.createImageEditor().show();
    this.DWTObject.RegisterEvent('CloseImageEditorUI', () => {
      this.editorShown = false;
    });
    this.editorShown = true;
  }
  readBarcode() {
    if (this.outputMessages.length > 0) {
      this.handleOutPutMessage("", "", true, true);
      this.barcodeButtonText = "Read";
      return;
    }

    let barcodesDiv = document.querySelector('.barcodeReaderOptions');
    if(barcodesDiv) {
      this.saveBarcodesDivScrollPos = barcodesDiv.scrollTop;
    }

    this.barcodeButtonText = "Reading...";
    let formatId = 0, formatId2 = 0;
    this.barcodeReaderOptions.Symbologies.Aztec ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_AZTEC : formatId += 0;
    this.barcodeReaderOptions.Symbologies.DM ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_DATAMATRIX : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Dot ? formatId2 += Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_DOTCODE : formatId2 += 0;
    this.barcodeReaderOptions.Symbologies.GS1Composite ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_GS1_COMPOSITE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.GS1Databar ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_GS1_DATABAR : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Linear ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_ONED : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Maxi ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_MAXICODE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Patch ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_PATCHCODE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Pdf ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_PDF417 + Dynamsoft.DBR.EnumBarcodeFormat.BF_MICRO_PDF417 : formatId += 0;
    this.barcodeReaderOptions.Symbologies.QRCode ? formatId += Dynamsoft.DBR.EnumBarcodeFormat.BF_QR_CODE + Dynamsoft.DBR.EnumBarcodeFormat.BF_MICRO_QR : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Postal ?
      formatId2 +=
      Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_POSTALCODE
      + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_POSTNET
      + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_AUSTRALIANPOST
      + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_USPSINTELLIGENTMAIL
      + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_RM4SCC
      + Dynamsoft.DBR.EnumBarcodeFormat_2.BF2_PLANET
      : formatId2 += 0;
    this.dwtService.readBarcode({ formatId: formatId, formatId2: formatId2, zones: this.zones });
  }
  hideBarcodeTextResults() {
    this.barcodeButtonText = "Read";
    this.handleOutPutMessage("", "", true, true);

    setTimeout(() => {
      let barcodesDiv = document.querySelector('.barcodeReaderOptions');
      if(barcodesDiv)
        barcodesDiv.scrollTo(0, this.saveBarcodesDivScrollPos);
    }, 0);
  }
  handleOutPutMessage(message: string, type: string, bReset: boolean, bNoScroll: boolean) {
    let _noScroll = false, _type = "info";
    if (type)
      _type = type;
    if (_type === "httpResponse") {
      let msgWindow = window.open("", "Response from server", "height=500,width=750,top=0,left=0,toolbar=no,menubar=no,scrollbars=no, resizable=no,location=no, status=no") as Window;
      msgWindow.document.writeln(message);
    } else {
      if (bNoScroll)
        _noScroll = true;
      if (bReset) {
        this.historyMessages.concat(this.outputMessages);
        this.outputMessages = [];
      }
      else {
        this.outputMessages.push({ time: (new Date()).getTime(), text: message, type: _type });
      }
      this.bDontScrollMessages = _noScroll;
    }
  }
  handleOptionChange() {

    if (this.deviceName === "" || this.deviceName === "Choose...")
      return;

    for (let i = 0; i < this.cameraOptions.length; i++) {
      if (this.cameraOptions[i].name === this.currentOption) {
        this.cameraOptions[i].current = true;
        this.currentOptionItems = this.cameraOptions[i].items;
      } else {
        this.cameraOptions[i].current = false;
      }
    }
    for (let j = 0; j < this.currentOptionItems.length; j++) {
      if (this.currentOptionItems[j].checked) {
        this.currentItem = this.currentOptionItems[j].value;
        this.setupPlayVideo({ prop: this.currentOption, value: this.currentItem });
        this.playVideo();
        break;
      }
    }
  }
  handleItemPicked() {
    
    if (this.deviceName === "" || this.deviceName === "Choose...")
      return;
    
    for (let j = 0; j < this.currentOptionItems.length; j++) {
      if (this.currentItem === this.currentOptionItems[j].value) {
        this.currentOptionItems[j].checked = true;
        this.setupPlayVideo({ prop: this.currentOption, value: this.currentItem });
        this.playVideo();
      } else {
        this.currentOptionItems[j].checked = false;
      }
    }
  }
  setupPlayVideo(config?) {
    let _dwt = this.DWTObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    let basicSetting, moreSetting;
    if (config) {
      this.showRangePicker = false;
      this.rangePicker = null;
      if (config.prop === "Video Setup" || config.prop === "Camera Setup") {
        let bCamera = true;
        if (config.prop === "Video Setup") {
          bCamera = false;
          basicSetting = _dwt.Addon.Webcam.GetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + config.value]);
          moreSetting = _dwt.Addon.Webcam.GetVideoPropertyMoreSetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + config.value]);
        } else {
          basicSetting = _dwt.Addon.Webcam.GetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + config.value]);
          moreSetting = _dwt.Addon.Webcam.GetCameraControlPropertyMoreSetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + config.value]);
        }
        let value = basicSetting.GetValue(),
          min = moreSetting.GetMinValue(),
          max = moreSetting.GetMaxValue(),
          defaultvalue = moreSetting.GetDefaultValue();
        let bMutable = true;
        if (min === max && value === defaultvalue && min === value) {
          bMutable = false;
        }
        this.showRangePicker = true;
        this.rangePicker = {
          bMutable: bMutable,
          bCamera: bCamera,
          value: value,
          min: min,
          max: max,
          default: defaultvalue,
          step: moreSetting.GetSteppingDelta(),
          title: config.value
        };
        return;
      } else {
        switch (config.prop) {
          case "Frame Rate": _dwt.Addon.Webcam.SetFrameRate(config.value); break;
          case "Media Type": _dwt.Addon.Webcam.SetMediaType(config.value); break;
          case "Resolution": _dwt.Addon.Webcam.SetResolution(config.value); break;
          default: break;
        }
      }
    }
  }
  playVideo() {
    let _dwt = this.DWTObject;
    if (this.bUseCameraViaDirectShow) {
      this.DWTObject.Addon.Webcam.StopVideo();
      this.DWTObject.Addon.Webcam.CloseSource();
    }
    
	if (this.VideoContainer)
      _dwt = this.VideoContainer;

    if (this.VideoContainer === null) {
      this.showMessage("No Video Container!");
      return false;
    }
    if (this.bUseCameraViaDirectShow) {
      _dwt.Addon.Webcam.PlayVideo(_dwt, 80, () => {
        this.showVideoText = "Stop Video";
        this.videoPlaying = true;
      });
      return true;
    } 
  }
  toggleVideo() {
    let _dwt = this.DWTObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    if (this.videoPlaying) {
      this.videoPlaying = false;
      this.showVideoText = "Show Video";
      if (this.bUseCameraViaDirectShow)
        return _dwt.Addon.Webcam.StopVideo();
    } else
      return this.playVideo();
  }
  handleRangeReset() {
    let _dwt = this.DWTObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    this.rangePicker.bCamera
      ? _dwt.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + this.rangePicker.title], this.rangePicker.default, true)
      : _dwt.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + this.rangePicker.title], this.rangePicker.default, true);
    this.rangePicker.value = this.rangePicker.default;
  }
  handleRangeChange() {
    let _dwt = this.DWTObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    this.rangePicker.bCamera
      ? _dwt.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.DWT.EnumDWT_CameraControlProperty["CCP_" + this.rangePicker.title], this.rangePicker.value, false)
      : _dwt.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.DWT.EnumDWT_VideoProperty["VP_" + this.rangePicker.title], this.rangePicker.value, false);
  }
  outPutTypeChanged(newType) {
    switch (newType) {
      case "File":
        this.saveOptions.upload ? this.saveOptions.buttonText = "Upload" : this.saveOptions.buttonText = "Save";
        break;
      case "Blob":
        this.saveOptions.buttonText = "Save As Blob";
        break;
      case "Base64":
        this.saveOptions.buttonText = "Save As Base64";
        break;
      default: break;
    }
  }
  getImageType(formatString: string): number {
    formatString = "IT_" + formatString;
    let imageType = 4;
    Object.entries(Dynamsoft.DWT.EnumDWT_ImageType).forEach(_type => {
      if (_type[0] === formatString)
        imageType = <number>_type[1];
    });
    return imageType;
  }
  copyBase64String(indexOfString) {
    if (navigator.clipboard) {
      if (this.saveResults.base64String[indexOfString] === "")
        this.showMessage("No resulting String!");
      navigator.clipboard.writeText(this.saveResults.base64String[indexOfString])
        .then(_ => {
          this.saveResults.base64ButtonText[indexOfString] = "Copied!";
          setTimeout(() => {
            this.saveResults.base64String.splice(indexOfString, 1);
            this.saveResults.base64ButtonText.splice(indexOfString, 1);
          }, 3000);
        });
    } else {
      this.showMessage("Can not use the clipboard! Please use HTTPS.");
    }
  }
  copyFilePath(indexOfString) {
    if (navigator.clipboard) {
      if (this.saveResults.saveFileText[indexOfString] === "")
        this.showMessage("No resulting String!");
      navigator.clipboard.writeText(this.saveResults.savedFiles[indexOfString].path)
        .then(_ => {
          this.saveResults.saveFileText[indexOfString] = "Copied!";
          setTimeout(() => {
            this.saveResults.savedFiles.splice(indexOfString, 1);
            this.saveResults.saveFileText.splice(indexOfString, 1);
          }, 3000);
        });
    } else {
      this.showMessage("Can not use the clipboard! Please use HTTPS.");
    }
  }
  handleMultiPageCheck() {
    if (this.saveOptions.multiPage) {
      if (this.DWTObject.SelectedImagesIndices.length === 1) {
        this.saveOptions.indices.forEach((value, index, arr) => { value.selected = true; arr[index] = value; });
        this.DWTObject.SelectAllImages();
      }
    } else {
      if (this.DWTObject.SelectedImagesIndices.length > 1)
        this.DWTObject.SelectImages([this.DWTObject.CurrentImageIndexInBuffer]);
      this.saveOptions.indices.forEach((value, index, arr) => {
        value.selected = false;
        if (value.number === this.DWTObject.CurrentImageIndexInBuffer)
          value.selected = true;
        arr[index] = value;
      });
    }
  }
  handleIndexSelection(selected: boolean, index: number) {
    let selectedIndices = this.DWTObject.SelectedImagesIndices;
    if (selected) {
      selectedIndices.push(index);
    } else {
      selectedIndices.splice(selectedIndices.indexOf(index), 1);
    }
    this.DWTObject.SelectImages(selectedIndices);
  }
  handleOutPutFormatChange(format) {
    if (format !== "PDF" && format !== "TIF") {
      this.saveOptions.multiPage = false;
      this.handleMultiPageCheck();
    }
  }
  save() {
    this.saveResults.uploadedFiles = [];
    this.saveResults.savedFiles = [];
    this.saveResults.base64String = [];
    this.saveResults.blob = [];
    this.saveResults.blobURL = [];
    this.saveResults.base64ButtonText = [];
    this.saveResults.saveFileText = [];
    switch (this.saveOptions.outPutType) {
      case "File":
        if (this.saveOptions.upload) {
          if (this.saveOptions.multiPage) {
            let selectedIndices = this.DWTObject.SelectedImagesIndices;
            this.dwtService.uploadToServer(selectedIndices, this.getImageType(this.saveOptions.outPutFormat), this.saveOptions.fileName)
              .then(result => { this.saveResults.uploadedFiles.push(result); this.clearMessage(); }, err => this.showMessage(err));
          }
          else {
            let count = this.DWTObject.HowManyImagesInBuffer;
            for (let i = 0; i < count; i++) {
              this.dwtService.uploadToServer([i], this.getImageType(this.saveOptions.outPutFormat), this.saveOptions.fileName + "_" + (i + 1))
                .then(result => { this.saveResults.uploadedFiles.push(result); this.clearMessage(); }, err => this.showMessage(err));
            }
          }
        } else {
          if (this.saveOptions.multiPage) {
            let selectedIndices = this.DWTObject.SelectedImagesIndices;
            let type = this.getImageType(this.saveOptions.outPutFormat);
            if (type === 2) type = 8;
            if (type === 4) type = 7;
            this.dwtService.saveLocally(selectedIndices, type, this.saveOptions.fileName, true)
              .then(result => {
                this.saveResults.savedFiles.push(result);
                this.saveResults.saveFileText.push("Copy path for " + result.name);
                this.clearMessage();
              }, err => this.showMessage(err));
          }
          else {
            let count = this.DWTObject.HowManyImagesInBuffer;
            let fileName = this.saveOptions.fileName + "_" + 1;
            this.dwtService.saveLocally([0], this.getImageType(this.saveOptions.outPutFormat), fileName, true)
              .then(result => {
                this.clearMessage();
                this.saveResults.savedFiles.push(result);
                this.saveResults.saveFileText.push("Copy path for  " + result.name);
                /**
                 * Save more only when the 1st one succeeds!
                 */
                for (let i = 1; i < count; i++) {
                  let fileName = this.saveOptions.fileName + "_" + (i + 1);
                  this.dwtService.saveLocally([i], this.getImageType(this.saveOptions.outPutFormat), fileName, false)
                    .then(result => {
                      this.clearMessage();
                      this.saveResults.savedFiles.push(result);
                      this.saveResults.saveFileText.push("Copy path for  " + result.name);
                    }, err => this.showMessage(err));
                }
              }, err => this.showMessage(err));
          }
        }
        break;
      case "Blob":
        if (this.saveOptions.multiPage) {
          let selectedIndices = this.DWTObject.SelectedImagesIndices;
          this.dwtService.getBlob(
            selectedIndices,
            this.getImageType(this.saveOptions.outPutFormat))
            .then(blob => {
              let newFile = new File([blob], "Saved_Blob (" + blob.type + ")", { type: blob.type });
              this.saveResults.blob.push(newFile);
              this.saveResults.blobURL.push(URL.createObjectURL(newFile));
              this.clearMessage();
            }, err => this.showMessage(err));
        } else {
          let count = this.DWTObject.HowManyImagesInBuffer;
          for (let i = 0; i < count; i++) {
            this.dwtService.getBlob(
              [i],
              this.getImageType(this.saveOptions.outPutFormat))
              .then(blob => {
                let newFile = new File([blob], "Saved_Blob_" + (i + 1) + "(" + blob.type + ")", { type: blob.type });
                this.saveResults.blob.push(newFile);
                this.saveResults.blobURL.push(URL.createObjectURL(newFile));
                this.clearMessage();
              }, err => this.showMessage(err));
          }
        }
        break;
      case "Base64":
        if (this.saveOptions.multiPage) {
          let selectedIndices = this.DWTObject.SelectedImagesIndices;
          this.dwtService.getBase64(
            selectedIndices,
            this.getImageType(this.saveOptions.outPutFormat))
            .then(base64String => {
              this.saveResults.base64String.push(base64String);
              this.saveResults.base64ButtonText.push("Copy Base64 String");
              this.clearMessage();
            }, err => this.showMessage(err));
        } else {
          let count = this.DWTObject.HowManyImagesInBuffer;
          for (let i = 0; i < count; i++) {
            this.dwtService.getBase64(
              [i],
              this.getImageType(this.saveOptions.outPutFormat))
              .then(base64String => {
                this.saveResults.base64String.push(base64String);
                this.saveResults.base64ButtonText.push("Copy Base64 String for image " + i);
                this.clearMessage();
              }, err => this.showMessage(err));
          }
        }
        break;
      default: break;
    }
  }
  copyURLToShow(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(_ => {
          this.showMessage("URL of the blob copied, try paste it in another tab to view it or download the blob as a file. Don't forget to add an extension to the downloaded file before opening it!");
        });
    } else {
      this.showMessage("Can not use the clipboard! Please use HTTPS.");
    }
  }
}

interface BarcodeRectToShow {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Message {
  time: number;
  text: string;
  type: string;
}

interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}
