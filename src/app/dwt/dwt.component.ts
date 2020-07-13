import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { DwtService, Device } from './../dwt.service';
import { WebTwain } from 'dwt/WebTwain';
import { BasicViewerConfig } from 'dwt/WebTwain.Viewer';
import { Subscription, Observable } from 'rxjs';
import Dynamsoft from 'dwt';
import { NgbModal, NgbModalRef, ModalDismissReasons, } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-dwt',
  templateUrl: './dwt.component.html',
  styleUrls: ['./dwt.component.css']
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
  protected DWObject: WebTwain = null;
  protected VideoContainer: WebTwain = null;
  /**
   * Global variables and status flags.
   */
  public bWASM = false;
  public dwtMounted = false;
  public bMobile: boolean;
  public bCameraAddonUsable: boolean;
  public containerId = "dwtcontrolContainer";
  public videoContainerId = "videoContainer";
  public editorShown = false;
  public devices: Device[];
  public deviceName: string = "Choose...";
  public basicView: BasicViewerConfig;
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
   * For OCR.
   */
  public ocrReady: boolean = false;
  public ocrResultString: string = "";
  public ocrResultFiles: File[] = [];
  public ocrResultURLs: string[] = [];
  public ocrButtonText = "Recognize";
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
  public rangePicker = null;
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
    rectShowingTime: 5
  };
  public OCRLanguages = [];
  public OCROutputFormats = [];
  public ocrOptions = {
    Language: "eng",
    OutputFormat: "0"
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
  }
  constructor(protected dwtService: DwtService, private modalService: NgbModal) {
    this.initDWT();
    this.bMobile = this.dwtService.runningEnvironment.bMobile;
    this.OCRLanguages = this.dwtService.OCRLanguages;
    this.OCROutputFormats = this.dwtService.OCROutputFormats;
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
          case "changed": this.barcodeRectsOnCurrentImage = [];
            this.zones = [];
            break;
        }
        if (this.emptyBuffer) {
          this.instantError = "There is no image in buffer!";
        } else { this.instantError = "" }
      }
    );
    this.generalSubscription = this.dwtService.generalSubject.subscribe(
      input => {
        if (input && input.type) {
          switch (input.type) {
            case "httpResponse":
              this.handleOutPutMessage(input.responsString, input.type, false, false);
            case "deviceName":
              this.deviceName = input.deviceName;
              break;
            case "cameraOptions":
              this.cameraOptions = input;
              for (let i = 0; i < input.length; i++) {
                if (input[i].current) {
                  this.currentOptionItems = input[i].items;
                  this.currentOption = input[i].name;
                  for (let j = 0; j < this.currentOptionItems.length; j++) {
                    if (this.currentOptionItems[j].checked) {
                      this.currentItem = this.currentOptionItems[j].value;
                    }
                  }
                  break;
                }
              }
              this.setUpPlayVideo();
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
      let currentIndex = this.DWObject.ImageIDToIndex(this.barcodeRects.imageIds[i]);
      if (this.DWObject.CurrentImageIndexInBuffer === currentIndex) {
        let rectsOnOnePage = this.barcodeRects.rects[i];
        let mainViewer = <HTMLDivElement>document.querySelector("#" + this.containerId + " .DVS_content");
        let zoom = 0,
          viewerWidth = <number>mainViewer.offsetWidth,
          viewerHeight = <number>mainViewer.offsetHeight,
          imageWidth = <number>this.DWObject.GetImageWidth(currentIndex),
          imageHeight = <number>this.DWObject.GetImageHeight(currentIndex);
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
          //  this.instantError = "x: " + rect.x + " y: " + rect.y + " w: " + rect.w + ", h: " + rect.h;
          //this.DWObject.OverlayRectangle(currentIndex, rect.x, rect.y, rect.x + rect.w, rect.y + rect.h, 0xfe8e14, 0.5);
          this.barcodeRectsOnCurrentImage.push({ x: left, y: top, w: width, h: height });
        }
        break;
      }
    }
  }
  updateViewer() {
    this.basicView = {
      Height: "100%",
      Width: "100%",
      view: { bShow: true, Width: "80%" }
    }
    if (this.DWObject && this.DWObject.UpdateViewer(this.basicView))
      return true;
    else
      return false;
  }
  unBindViewer() {
    if (this.DWObject.UnbindViewer()) {
      let container = document.getElementById(this.containerId);
      while (container.firstChild) {
        container.removeChild(container.lastChild);
      }
      if (this.instantError !== "There is no image in buffer!")
        this.instantError = "";
      return true;
    } else {
      this.instantError = this.DWObject.ErrorString;
      return false;
    }
  }
  bindViewer() {
    this.basicView = {
      Height: "100%",
      Width: "100%",
      view: { bShow: true, Width: "80%" }
    }
    if (this.DWObject.BindViewer(this.containerId, this.basicView)) {
      // Remove the context menu which is still not functioning correctly.
      this.DWObject.Viewer.off('imageRightClick');
      this.DWObject.RegisterEvent('OnImageAreaSelected', (nImageIndex, left, top, right, bottom, sAreaIndex) => {
        this.instantError = "";
        if (sAreaIndex > this.zones.length + 1) {
          this.instantError = "Impossible Area selected!";
          return;
        }
        if (this.zones.length + 1 === sAreaIndex)
          this.zones.push({ x: left, y: top, width: right - left, height: bottom - top, index: nImageIndex });
        else
          this.zones.splice(sAreaIndex - 1, 1, { x: left, y: top, width: right - left, height: bottom - top, index: nImageIndex });
      });
      this.DWObject.RegisterEvent('OnImageAreaDeSelected', () => {
        this.instantError = ""; this.zones = [];
      });
      this.bMobile ? this.DWObject.Viewer.operationMode = 0 : this.DWObject.Viewer.operationMode = 1;
      this.DWObject.Viewer.showFooter = false;
      this.DWObject.Viewer.showHeader = false;
      this.DWObject.ShowPageNumber = true;
      //this.DWObject.Viewer.off('imageRightClick');
      this.bMobile ? this.DWObject.Viewer.setViewMode(1, 5) :
        this.DWObject.Viewer.setViewMode(1, 3);
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
        let filters = [], filter = "";
        this.formatsToImport.JPG ? filters.push("image/jpeg") : false;
        this.formatsToImport.PNG ? filters.push("image/png") : false;
        this.formatsToImport.TIF ? filters.push("image/tiff") : false;
        this.formatsToImport.PDF ? filters.push("application/pdf") : false;
        if (filters.length > 0) {
          filter = filters.join(",");
          this.instantError = "";
        } else {
          this.instantError = "Please select at least one format!";
          return false;
        }
        WASMInput.setAttribute("accept", filter);
      }
      WASMInput.onchange = evt => {
        let _input = <HTMLInputElement>evt.target;
        this.dwtService.load(_input.files)
          .then(_ => {
            this.closeModal(true);
            _input.value = '';
          });
      };
      document.getElementById(this.containerId).parentElement.appendChild(WASMInput);
    }
    else {
      console.log(this.DWObject.ErrorString);
    }
  }
  initDWT(): void {
    this.DWObject = null;
    this.dwtService.mountDWT()
      .then(
        obj => {
          this.DWObject = obj;
          this.bWASM = this.dwtService.bWASM;
          this.bCameraAddonUsable = this.dwtService.bCameraAddonUsable;
          this.dwtMounted = true;
          this.dwtService.mountVideoContainer()
            .then(containerDWT => {
              this.VideoContainer = containerDWT;
            }, err => this.instantError = err);
          setTimeout(() => {
            this.bindViewer();
          }, 0);
        },
        err => this.instantError = err);
  }
  openModal(content, type?: string) {
    this.modalRef = this.modalService.open(content, {
      backdrop: "static",
      centered: true,
      beforeDismiss: (): boolean => {
        switch (type) {
          case "acquire":
            this.deviceName = "Choose...";
            return true;
          case "camera":
            if (this.bWASM)
              return true;
            if (this.videoPlaying) {
              this.instantError = "Please Stop Video first!";
              return false;
            } else {
              this.deviceName = "Choose...";
              return this.VideoContainer.UnbindViewer();
            }
          case "barcode":
            let __interval = setInterval(
              () => {
                this.barcodeReaderOptions.rectShowingTime--;
                if (this.barcodeReaderOptions.rectShowingTime === 0) {
                  this.barcodeReaderOptions.rectShowingTime = 5;
                  this.barcodeReaderOptions.showRects = false;
                  clearInterval(__interval);
                }
              }, 1000);
            this.barcodeButtonText = "Read";
            this.handleOutPutMessage("", "", true, true);
            return true;
          case "ocr":
            this.ocrResultFiles = [];
            this.ocrResultURLs = [];
            return true;
          case "save":
            this.saveOptions.indices = [];
            return true;
            break;
          default:
            return true;
            break;
        }
      }
    });
    this.modalRef.result.then((result) => {//close
    }, (reason) => {//dismiss, reset modal dialogs
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
    if (this.instantError !== "There is no image in buffer!")
      this.instantError = "";
    switch (type) {
      case "camera":
        let makeSureDIVExists = () => {
          let container = <HTMLDivElement>document.getElementById(this.videoContainerId);
          if (container) {
            if (this.VideoContainer === null) {
              this.instantError = "No Video Container!";
              return;
            }
            container.style.height = "100%";
            this.VideoContainer.BindViewer(this.videoContainerId, {
              Height: "100%",
              Width: "100%",
              view: { bShow: false, Width: "80%" }
            });
          }
          else
            setTimeout(() => makeSureDIVExists(), 10);
        };
        makeSureDIVExists();
      case "acquire":
        this.devices = this.dwtService.getDevices();
        this.deviceName = "Choose...";
        break;
      case "barcode":
        this.barcodeReaderOptions.showRects = true;
        break;
      case "ocr":
        if (this.bMobile) return;
        this.ocrResultString = "";
        this.ocrButtonText = "Recognize";
        this.dwtService.loadOCRModule()
          .then(() => {
            this.ocrReady = true;
          }, err =>
            this.instantError = err
          );
        break;
      case "save":
        let selectedIndices = this.DWObject.SelectedImagesIndices;
        let count = this.DWObject.HowManyImagesInBuffer;
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
  handleDeviceChange() {
    if (this.deviceName === "" || this.deviceName === "Choose...")
      return;
    this.dwtService.selectADevice(this.deviceName)
      .then(
        done => done ? this.instantError = "" : this.instantError = "Device selecting failed!",
        error => typeof error === "string" ? this.instantError = error : this.instantError = "Device selecting failed!");
  }
  acquire() {
    if (this.dwtService.bWASM) {
      (<HTMLInputElement>document.getElementById(this.containerId + "-fileInput")).value = "";
      document.getElementById(this.containerId + "-fileInput").click();
    } else {
      this.scan();
    }
  }
  acquireFromCamera() {
    this.dwtService.acquire()
      .then(_ => {
        this.instantError = "Captured successfully!"; setTimeout(() => {
          this.instantError = "";
        }, 3000);
      }, err => this.instantError = err);
  }
  scan() {
    this.dwtService.acquire(this.scanOptions)
      .then(() => {
        this.closeModal(true);
        if (this.instantError !== "There is no image in buffer!")
          this.instantError = "";
      }, err => this.instantError = err);
  }
  load() {
    this.dwtService.load()
      .then(() => {
        this.closeModal(true);
        if (this.instantError !== "There is no image in buffer!")
          this.instantError = "";
      }, err => this.instantError = err)
  }
  showEditor() {
    this.DWObject.ShowImageEditor();
    this.DWObject.RegisterEvent('CloseImageEditorUI', () => {
      this.editorShown = false;
    });
    this.editorShown = true;
  }
  /**
   * OCR
   */
  filterZones() {
    let index = this.DWObject.CurrentImageIndexInBuffer;
    for (let i = 0; i < this.zones.length; i++) {
      if (this.zones[i].index !== index)
        this.zones.splice(index, 1);
    }
  }
  doOCR() {
    this.ocrResultFiles = [];
    this.ocrResultURLs = [];
    this.ocrButtonText = "Recognizing";
    if (this.instantError !== "There is no image in buffer!")
      this.instantError = "";
    this.ocrResultString = "";
    this.filterZones();
    this.dwtService.ocr(this.ocrOptions.Language, parseInt(this.ocrOptions.OutputFormat), this.zones)
      .then(
        res => {
          this.ocrButtonText = "Done, click to do it again"
          this.instantError = "";
          let resultStrings = res.split(",");
          switch (this.ocrOptions.OutputFormat) {
            case "0" /* TEXT */:
              let stringToShow: string[] = [];
              for (let i = 0; i < resultStrings.length; i++) {
                stringToShow.push(atob(resultStrings[i]));
              }
              this.ocrResultString = stringToShow.join("\n"); break;
            case "1" /* Text PDF */:
            case "2" /* Image PDF */:
              this.ocrResultFiles = [];
              this.ocrResultURLs = [];
              for (let i = 0; i < resultStrings.length; i++) {
                fetch("data:application/pdf;base64," + resultStrings[i])
                  .then(r => r.blob())
                  .then(blob => {
                    let newFile = new File([blob], "OCRResult_" + i + ".pdf", { type: "application/pdf" });
                    this.ocrResultFiles.push(newFile);
                    this.ocrResultURLs.push(URL.createObjectURL(newFile));
                  });
              }
              break;
            default: break;
          }
        }, err => { this.instantError = err; this.ocrButtonText = "Recognize failed, try again!" }
      );
  }
  readBarcode() {
    if (this.outputMessages.length > 0) {
      this.handleOutPutMessage("", "", true, true);
      this.barcodeButtonText = "Read";
      return;
    }
    this.barcodeButtonText = "Reading...";
    let formatId = 0, formatId2 = 0;
    this.barcodeReaderOptions.Symbologies.Aztec ? formatId += Dynamsoft.EnumBarcodeFormat.BF_AZTEC : formatId += 0;
    this.barcodeReaderOptions.Symbologies.DM ? formatId += Dynamsoft.EnumBarcodeFormat.BF_DATAMATRIX : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Dot ? formatId2 += Dynamsoft.EnumBarcodeFormat_2.BF2_DOTCODE : formatId2 += 0;
    this.barcodeReaderOptions.Symbologies.GS1Composite ? formatId += Dynamsoft.EnumBarcodeFormat.BF_GS1_COMPOSITE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.GS1Databar ? formatId += Dynamsoft.EnumBarcodeFormat.BF_GS1_DATABAR : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Linear ? formatId += Dynamsoft.EnumBarcodeFormat.BF_ONED : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Maxi ? formatId += Dynamsoft.EnumBarcodeFormat.BF_MAXICODE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Patch ? formatId += Dynamsoft.EnumBarcodeFormat.BF_PATCHCODE : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Pdf ? formatId += Dynamsoft.EnumBarcodeFormat.BF_PDF417 + Dynamsoft.EnumBarcodeFormat.BF_MICRO_PDF417 : formatId += 0;
    this.barcodeReaderOptions.Symbologies.QRCode ? formatId += Dynamsoft.EnumBarcodeFormat.BF_QR_CODE + Dynamsoft.EnumBarcodeFormat.BF_MICRO_QR : formatId += 0;
    this.barcodeReaderOptions.Symbologies.Postal ?
      formatId2 +=
      Dynamsoft.EnumBarcodeFormat_2.BF2_POSTALCODE
      + Dynamsoft.EnumBarcodeFormat_2.BF2_POSTNET
      + Dynamsoft.EnumBarcodeFormat_2.BF2_AUSTRALIANPOST
      + Dynamsoft.EnumBarcodeFormat_2.BF2_USPSINTELLIGENTMAIL
      + Dynamsoft.EnumBarcodeFormat_2.BF2_RM4SCC
      + Dynamsoft.EnumBarcodeFormat_2.BF2_PLANET
      : formatId2 += 0;
    this.barcodeRectsOnCurrentImage.splice(0, this.barcodeRectsOnCurrentImage.length);
    this.filterZones();
    this.dwtService.readBarcode({ formatId: formatId, formatId2: formatId2, zones: this.zones });
  }
  hideBarcodeTextResults() {
    this.barcodeButtonText = "Read";
    this.handleOutPutMessage("", "", true, true);
  }
  handleOutPutMessage(message: string, type: string, bReset: boolean, bNoScroll: boolean) {
    let _noScroll = false, _type = "info";
    if (type)
      _type = type;
    if (_type === "httpResponse") {
      let msgWindow = window.open("", "Response from server", "height=500,width=750,top=0,left=0,toolbar=no,menubar=no,scrollbars=no, resizable=no,location=no, status=no");
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
        this.setUpPlayVideo({ prop: this.currentOption, value: this.currentItem });
        this.playVideo();
        break;
      }
    }
  }
  handleItemPicked() {
    for (let j = 0; j < this.currentOptionItems.length; j++) {
      if (this.currentItem === this.currentOptionItems[j].value) {
        this.currentOptionItems[j].checked = true;
        this.setUpPlayVideo({ prop: this.currentOption, value: this.currentItem });
        this.playVideo();
      } else {
        this.currentOptionItems[j].checked = false;
      }
    }
  }
  setUpPlayVideo(config?) {
    let _dwt = this.DWObject;
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
          basicSetting = _dwt.Addon.Webcam.GetVideoPropertySetting(Dynamsoft.EnumDWT_VideoProperty["VP_" + config.value]);
          moreSetting = _dwt.Addon.Webcam.GetVideoPropertyMoreSetting(Dynamsoft.EnumDWT_VideoProperty["VP_" + config.value]);
        } else {
          basicSetting = _dwt.Addon.Webcam.GetCameraControlPropertySetting(Dynamsoft.EnumDWT_CameraControlProperty["CCP_" + config.value]);
          moreSetting = _dwt.Addon.Webcam.GetCameraControlPropertyMoreSetting(Dynamsoft.EnumDWT_CameraControlProperty["CCP_" + config.value]);
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
    let _dwt = this.DWObject;
    this.DWObject.Addon.Webcam.StopVideo();
    this.DWObject.Addon.Webcam.CloseSource();
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    if (this.VideoContainer === null) {
      this.instantError = "No Video Container!";
      return false;
    }
    _dwt.Addon.Webcam.PlayVideo(_dwt, 80, () => {
      this.showVideoText = "Stop Video";
      this.videoPlaying = true;
    });
    return true;
  }
  toggleVideo() {
    let _dwt = this.DWObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    if (this.videoPlaying) {
      this.videoPlaying = false;
      this.showVideoText = "Show Video";
      return _dwt.Addon.Webcam.StopVideo();
    } else
      return this.playVideo();
  }
  handleRangeReset() {
    let _dwt = this.DWObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    this.rangePicker.bCamera
      ? _dwt.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.EnumDWT_CameraControlProperty["CCP_" + this.rangePicker.title], this.rangePicker.default, true)
      : _dwt.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.EnumDWT_VideoProperty["VP_" + this.rangePicker.title], this.rangePicker.default, true);
    this.rangePicker.value = this.rangePicker.default;
  }
  handleRangeChange() {
    let _dwt = this.DWObject;
    if (this.VideoContainer)
      _dwt = this.VideoContainer;
    this.rangePicker.bCamera
      ? _dwt.Addon.Webcam.SetCameraControlPropertySetting(Dynamsoft.EnumDWT_CameraControlProperty["CCP_" + this.rangePicker.title], this.rangePicker.value, false)
      : _dwt.Addon.Webcam.SetVideoPropertySetting(Dynamsoft.EnumDWT_VideoProperty["VP_" + this.rangePicker.title], this.rangePicker.value, false);
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
    Object.entries(Dynamsoft.EnumDWT_ImageType).forEach(_type => {
      if (_type[0] === formatString)
        imageType = <number>_type[1];
    });
    return imageType;
  }
  copyBase64String(indexOfString) {
    if (navigator.clipboard) {
      if (this.saveResults.base64String[indexOfString] === "")
        this.instantError = "No resulting String!";
      navigator.clipboard.writeText(this.saveResults.base64String[indexOfString])
        .then(_ => {
          this.saveResults.base64ButtonText[indexOfString] = "Copied!";
          setTimeout(() => {
            this.saveResults.base64String.splice(indexOfString, 1);
            this.saveResults.base64ButtonText.splice(indexOfString, 1);
          }, 3000);
        });
    } else {
      this.instantError = "Can not use the clipboard! Please use HTTPS.";
    }
  }
  copyFilePath(indexOfString) {
    if (navigator.clipboard) {
      if (this.saveResults.saveFileText[indexOfString] === "")
        this.instantError = "No resulting String!";
      navigator.clipboard.writeText(this.saveResults.savedFiles[indexOfString].path)
        .then(_ => {
          this.saveResults.saveFileText[indexOfString] = "Copied!";
          setTimeout(() => {
            this.saveResults.savedFiles.splice(indexOfString, 1);
            this.saveResults.saveFileText.splice(indexOfString, 1);
          }, 3000);
        });
    } else {
      this.instantError = "Can not use the clipboard! Please use HTTPS.";
    }
  }
  handleMultiPageCheck() {
    if (this.saveOptions.multiPage) {
      if (this.DWObject.SelectedImagesIndices.length === 1) {
        this.saveOptions.indices.forEach((value, index, arr) => { value.selected = true; arr[index] = value; });
        this.DWObject.SelectAllImages();
      }
    } else {
      if (this.DWObject.SelectedImagesIndices.length > 1)
        this.DWObject.SelectImages([this.DWObject.CurrentImageIndexInBuffer]);
      this.saveOptions.indices.forEach((value, index, arr) => {
        value.selected = false;
        if (value.number === this.DWObject.CurrentImageIndexInBuffer)
          value.selected = true;
        arr[index] = value;
      });
    }
  }
  handleIndexSelection(selected: boolean, index: number) {
    let selectedIndices = this.DWObject.SelectedImagesIndices;
    if (selected) {
      selectedIndices.push(index);
    } else {
      selectedIndices.splice(selectedIndices.indexOf(index), 1);
    }
    selectedIndices.sort();
    this.DWObject.SelectImages(selectedIndices);
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
            let selectedIndices = this.DWObject.SelectedImagesIndices;
            this.dwtService.uploadToServer(selectedIndices, this.getImageType(this.saveOptions.outPutFormat), this.saveOptions.fileName)
              .then(result => { this.saveResults.uploadedFiles.push(result); this.instantError = ""; }, err => this.instantError = err);
          }
          else {
            let count = this.DWObject.HowManyImagesInBuffer;
            for (let i = 0; i < count; i++) {
              this.dwtService.uploadToServer([i], this.getImageType(this.saveOptions.outPutFormat), this.saveOptions.fileName + "_" + (i + 1))
                .then(result => { this.saveResults.uploadedFiles.push(result); this.instantError = ""; }, err => this.instantError = err);
            }
          }
        } else {
          if (this.saveOptions.multiPage) {
            let selectedIndices = this.DWObject.SelectedImagesIndices;
            let type = this.getImageType(this.saveOptions.outPutFormat);
            if (type === 2) type = 8;
            if (type === 4) type = 7;
            this.dwtService.saveLocally(selectedIndices, type, this.saveOptions.fileName, true)
              .then(result => {
                this.saveResults.savedFiles.push(result);
                this.saveResults.saveFileText.push("Copy path for " + result.name);
                this.instantError = "";
              }, err => this.instantError = err);
          }
          else {
            let count = this.DWObject.HowManyImagesInBuffer;
            let fileName = this.saveOptions.fileName + "_" + 1;
            this.dwtService.saveLocally([0], this.getImageType(this.saveOptions.outPutFormat), fileName, true)
              .then(result => {
                this.instantError = "";
                this.saveResults.savedFiles.push(result);
                this.saveResults.saveFileText.push("Copy path for  " + result.name);
                /**
                 * Save more only when the 1st one succeeds!
                 */
                for (let i = 1; i < count; i++) {
                  let fileName = this.saveOptions.fileName + "_" + (i + 1);
                  this.dwtService.saveLocally([i], this.getImageType(this.saveOptions.outPutFormat), fileName, false)
                    .then(result => {
                      this.instantError = "";
                      this.saveResults.savedFiles.push(result);
                      this.saveResults.saveFileText.push("Copy path for  " + result.name);
                    }, err => this.instantError = err);
                }
              }, err => this.instantError = err);
          }
        }
        break;
      case "Blob":
        if (this.saveOptions.multiPage) {
          let selectedIndices = this.DWObject.SelectedImagesIndices;
          this.dwtService.getBlob(
            selectedIndices,
            this.getImageType(this.saveOptions.outPutFormat))
            .then(blob => {
              let newFile = new File([blob], "Saved_Blob (" + blob.type + ")", { type: blob.type });
              this.saveResults.blob.push(newFile);
              this.saveResults.blobURL.push(URL.createObjectURL(newFile));
              this.instantError = "";
            }, err => this.instantError = err);
        } else {
          let count = this.DWObject.HowManyImagesInBuffer;
          for (let i = 0; i < count; i++) {
            this.dwtService.getBlob(
              [i],
              this.getImageType(this.saveOptions.outPutFormat))
              .then(blob => {
                let newFile = new File([blob], "Saved_Blob_" + (i + 1) + "(" + blob.type + ")", { type: blob.type });
                this.saveResults.blob.push(newFile);
                this.saveResults.blobURL.push(URL.createObjectURL(newFile));
                this.instantError = "";
              }, err => this.instantError = err);
          }
        }
        break;
      case "Base64":
        if (this.saveOptions.multiPage) {
          let selectedIndices = this.DWObject.SelectedImagesIndices;
          this.dwtService.getBase64(
            selectedIndices,
            this.getImageType(this.saveOptions.outPutFormat))
            .then(base64String => {
              this.saveResults.base64String.push(base64String);
              this.saveResults.base64ButtonText.push("Copy Base64 String");
              this.instantError = "";
            }, err => this.instantError = err);
        } else {
          let count = this.DWObject.HowManyImagesInBuffer;
          for (let i = 0; i < count; i++) {
            this.dwtService.getBase64(
              [i],
              this.getImageType(this.saveOptions.outPutFormat))
              .then(base64String => {
                this.saveResults.base64String.push(base64String);
                this.saveResults.base64ButtonText.push("Copy Base64 String for image " + i);
                this.instantError = "";
              }, err => this.instantError = err);
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
          this.instantError = "URL of the blob copied, try paste it in another tab to view the blob!";
        });
    } else {
      this.instantError = "Can not use the clipboard! Please use HTTPS.";
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
