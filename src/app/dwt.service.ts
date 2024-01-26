import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from './../environments/environment';
import Dynamsoft from 'dwt';
import { DynamsoftEnumsDWT } from 'dwt/dist/types/Dynamsoft.Enum';
import { WebTwain } from 'dwt/dist/types/WebTwain';
import { DeviceConfiguration, ScanSetup } from 'dwt/dist/types/WebTwain.Acquire';
import { RuntimeSettings, TextResults, TextResult } from 'dwt/dist/types/Addon.BarcodeReader';
import { DWTInitialConfig } from 'dwt/dist/types/Dynamsoft';

@Injectable({
  providedIn: 'root'
})

export class DwtService {
  barcodeSubject: Subject<any> = new Subject<any>();
  bufferSubject: Subject<string> = new Subject<string>();
  generalSubject: Subject<any> = new Subject<any>();
  /**
   * WebTwain objects
   */
  protected _DWObject: WebTwain = null;
  protected _DWObjectEx: WebTwain = null;
  /**
   * Global environment that is detected by the dwt library.
   */
  public runningEnvironment = Dynamsoft.Lib.env;

  public bWin: boolean = true;
  /**
   * Scan
   */
  protected _scannersCount: number;
  public devices: Device[] = [];
  public _selectedDevice: string = "";
  /**
   * Camera
   */
  protected _useCamera: boolean;
  /**
   * The Webcam Addon vai DirectShow only works for Service mode on Desktop (dwt@16.1.1)
   * Otherwise, Camera Addon is used.
   */
  public bUseCameraViaDirectShow: boolean = true;
  public cameraOptions = [];
  /**
   * Barcode
   */
  public barcodeResults = [];
  public barcodeRects = { imageIds: [], rects: [] };
  /**
   * Save
   */
  private fileSavingPath = "C:";
  private fileActualName = "";
  private _doFunction;


  constructor() {
    Dynamsoft.OnLicenseError = function (message, errorCode) {
      if(errorCode == -2808)
        message = '<div style="padding:0">Sorry. Your product key has expired. You can purchase a full license at the <a target="_blank" href="https://www.dynamsoft.com/store/dynamic-web-twain/#DynamicWebTWAIN">online store</a>.</div><div style="padding:0">Or, you can try requesting a new product key at <a target="_blank" href="https://www.dynamsoft.com/customer/license/trialLicense?product=dwt&utm_source=in-product">this page</a>.</div><div style="padding:0">If you need any help, please <a target="_blank" href="https://www.dynamsoft.com/company/contact/">contact us</a>.</div>';
      (Dynamsoft.DWT as any).ShowMessage(message, {
        width: 680,
        headerStyle: 2
      });
   };
    /**
     * ResourcesPath & ProductKey must be set in order to use the library!
     */
    Dynamsoft.DWT.ResourcesPath = environment.Dynamsoft.resourcesPath;
    Dynamsoft.DWT.ProductKey = environment.Dynamsoft.dwtProductKey;
    Dynamsoft.DWT.Containers = [{ WebTwainId: 'dwtcontrolContainer', Width: 270, Height: 350 }];
    Dynamsoft.DWT.Load();
    /**
     * ConnectToTheService is overwritten here for smoother install process.
     */
    Dynamsoft.DWT.ConnectToTheService = () => {
      //this.mountDWT();
      this._doFunction(true);
      window.location.reload();
    };
    Dynamsoft.DWT.OnWebTwainReady = () => { 
      this._doFunction(true);
     }
  }

  showStartDemo(doFunction){
    this._doFunction = doFunction;
  }

  mountDWT(UseService?: boolean): Promise<any> {
    this._DWObject = null;
    return new Promise((res, rej) => {
      let dwtInitialConfig: DWTInitialConfig = {
        WebTwainId: "dwtObject"
      };
      /**
       * [Why checkScript()?]
       * Dynamic Web TWAIN relies on a few extra scripts to work correct.
       * Therefore we must make sure these files are ready before creating a WebTwain instance.
       */
      let checkScript = () => {
          /*  Dynamsoft.DWT.OnWebTwainPreExecute = () => {
              // Show your own progress indicator
              console.log('An operation starts!');
            };
            Dynamsoft.DWT.OnWebTwainPostExecute = () => {
              // Hide the progress indicator
              console.log('An operation ends!');
            };
            */

          this.bWin = this.runningEnvironment.bWin;

          dwtInitialConfig.UseLocalService = Dynamsoft.DWT.UseLocalService;
          Dynamsoft.DWT.CreateDWTObjectEx(
            dwtInitialConfig,
            (_DWObject) => {
              this._DWObject = _DWObject;
              /*this._DWObject.IfShowProgressBar = false;
              this._DWObject.IfShowCancelDialogWhenImageTransfer = false;*/
              /**
               * The event OnBufferChanged is used here for monitoring the image buffer.
               */
              this._DWObject.RegisterEvent("OnBufferChanged", (changedIndexArray, operationType, changedIndex, imagesCount) => {
                switch (operationType) {
                  /** reserved space
                   * type: 1-Append(after index), 2-Insert(before index), 3-Remove, 4-Edit(Replace), 5-Index Change
                   */
                  case 1: break;
                  case 2: break;
                  case 3: break;
                  case 4: break;
                  case 5: break;
                  default: break;
                }
                this.bufferSubject.next("changed");
                if (this._DWObject.HowManyImagesInBuffer === 0)
                  this.bufferSubject.next("empty");
                else
                  this.bufferSubject.next("filled");
              });
              res(_DWObject);
            },
            (errorString) => {
              rej(errorString);
            }
          );
      };
      checkScript();
    });
  }
  unMountDWT(): Promise<any> {
    return new Promise((res, rej) => {
      if (Dynamsoft.DWT.DeleteDWTObject("dwtObject"))
        res(true);
      else
        rej(false);
    });
  }
  /**
   * Create an extra WebTwain instance _DWObjectEx
   * This is used solely for displaying & capturing from a video stream.
   */
  mountVideoContainer(): Promise<any> {
    this._DWObjectEx = null;
    return new Promise((res, rej) => {
      if (this._DWObject) {
        let dwtInitialConfig: DWTInitialConfig = {
          WebTwainId: "videoContainer" 
        };
        Dynamsoft.DWT.CreateDWTObjectEx(
          dwtInitialConfig,
          (_container) => {
            this._DWObjectEx = _container;
            res(_container);
          },
          (errorString) => {
            rej(errorString);
          }
        );
      } else {
        rej("Please call mountDWT first!");
      }
    });
  }
  /**
   * Removes the extra WebTwain instance. Optional.
   */
  unMountVideoContainer(): Promise<any> {
    return new Promise((res, rej) => {
      if (Dynamsoft.DWT.DeleteDWTObject("videoContainer"))
        res(true);
      else
        rej(false);
    });
  }
  /**
   * Retrieve all devices (scanners + cameras).
   */
  getDevices(bfromCamera): Promise<Device[]> {
    return new Promise((res, rej) => {
      let _dwt = this._DWObject;
      if (this._DWObjectEx)
        _dwt = this._DWObjectEx;
      this.devices = [];
      this._DWObject.GetDevicesAsync().then((devicesList)=>{
        for (let i = 0; i < devicesList.length; i++) {
          this.devices.push({ deviceId: Math.floor(Math.random() * 100000).toString(), name: (i + 1).toString() + "." + devicesList[i].displayName, label: devicesList[i].displayName, type: "scanner", deviceInfo: devicesList[i] });
        }           
        this._scannersCount = this.devices.length;
        if (this.bUseCameraViaDirectShow) {
          try {
            let _cameras = _dwt.Addon.Webcam.GetSourceList();
            for (let i = 0; i < _cameras.length; i++) {
              this.devices.push({ deviceId: Math.floor(Math.random() * 100000).toString(), name: (i + 1).toString() + "." + _cameras[i], label: _cameras[i], type: "camera", deviceInfo:[]});
            }  
            res(this.devices);
          } catch (e) {
            if(bfromCamera)
              rej(e);
            else {
              if(e.code == -2338)
                res(this.devices);
              else
                rej(e);
            }
          }
          
        } 
        }).catch(function (exp) {
          alert(exp.message);
        });
    });
  }
  /**
   * Retrieve detailed information of the devices.
   */
  getDeviceDetails() {
    return this._DWObject.GetSourceNames(true);
  }
  /**
   * Select a scanner or camera by name.
   * @param name the name of the device
   */
  selectADevice(name: string): Promise<boolean> {
    return new Promise((res, rej) => {
      let waitForAnotherPromise = false;
      this._selectedDevice = "";
      this._useCamera = false;
      if (this.devices.length === 0)
        rej(false);
      this.devices.forEach((value, index) => {
        if (value && value.name === name) {
          if (index > this._scannersCount - 1) {
            let _dwt = this._DWObject;
            if (this._DWObjectEx)
              _dwt = this._DWObjectEx;
            if (this.bUseCameraViaDirectShow) {
              _dwt.Addon.Webcam.StopVideo();
              if (_dwt.Addon.Webcam.SelectSource(value.label)) {
                this._selectedDevice = name;
                this._useCamera = true;
                this.updateCameraValues(_dwt);
              }
              else {
                rej("Can't use the Webcam " + name + ", please make sure it's not in use!")
              }
            }
            else {
              waitForAnotherPromise = true;
            }
          }
          else {
            waitForAnotherPromise = true;
            this._DWObject.SelectDeviceAsync(value.deviceInfo).then(()=>{
              this._selectedDevice = name;
              this.generalSubject.next({ type: "deviceName", deviceName: this._selectedDevice });
              res(true);
            }).catch((exp) =>{
              rej(exp.message);
            });
          }
        }
      });
      if (!waitForAnotherPromise) {
        if (this._selectedDevice !== "") {
          this.generalSubject.next({ type: "deviceName", deviceName: this._selectedDevice });
          res(true);
        }
        else
          res(false);
      }
    });
  }
  /**
   * Retrieve detailed camera capabilities.
   * @param _dwt The WebTwain instance.
   */
  updateCameraValues(_dwt: WebTwain) {
    let mediaTypes = _dwt.Addon.Webcam.GetMediaType(),
      _mediaTypes = [],
      _currentmT = mediaTypes.GetCurrent();
    let frameRates = _dwt.Addon.Webcam.GetFrameRate(),
      _frameRates = [],
      _currentfR = frameRates.GetCurrent();
    let resolutions = _dwt.Addon.Webcam.GetResolution(),
      _resolutions = [],
      _currentRes = resolutions.GetCurrent();
    let _advancedSettings = [],
      _advancedCameraSettings = [];
    for (let i = 0; i < mediaTypes.GetCount(); i++) {
      mediaTypes.Get(i) === _currentmT
        ? _mediaTypes[i] = { value: mediaTypes.Get(i).toString(), checked: true }
        : _mediaTypes[i] = { value: mediaTypes.Get(i).toString(), checked: false };
    }
    for (let i = 0; i < frameRates.GetCount(); i++) {
      frameRates.Get(i) === _currentfR
        ? _frameRates[i] = { value: frameRates.Get(i).toString(), checked: true }
        : _frameRates[i] = { value: frameRates.Get(i).toString(), checked: false };
    }
    for (let i = 0; i < resolutions.GetCount(); i++) {
      resolutions.Get(i) === _currentRes
        ? _resolutions[i] = { value: resolutions.Get(i).toString(), checked: true }
        : _resolutions[i] = { value: resolutions.Get(i).toString(), checked: false };
    }
    _advancedSettings = Object.keys(Dynamsoft.DWT.EnumDWT_VideoProperty).map((_value) => { return { value: _value.substr(3) } });
    for (let i = 0; i < _advancedSettings.length; i++) {
      _advancedSettings[i].checked = false;
    }
    _advancedSettings[0].checked = true;
    _advancedCameraSettings = Object.keys(Dynamsoft.DWT.EnumDWT_CameraControlProperty).map((_value) => { return { value: _value.substr(4) } });
    for (let i = 0; i < _advancedCameraSettings.length; i++) {
      _advancedCameraSettings[i].checked = false;
    }
    _advancedCameraSettings[0].checked = true;
    this.cameraOptions = [{
      name: "Media Type",
      items: _mediaTypes,
      current: false
    }, {
      name: "Frame Rate",
      items: _frameRates,
      current: false
    }, {
      name: "Resolution",
      items: _resolutions,
      current: true
    }, {
      name: "Video Setup",
      items: _advancedSettings,
      current: false
    }, {
      name: "Camera Setup",
      items: _advancedCameraSettings,
      current: false
    }];
    this.cameraOptions["type"] = "cameraOptions";
    this.generalSubject.next(this.cameraOptions);
  }
  /**
   * Acquire images (scanner or camera).
   * @param config Configuration for image aquisition.
   */
  acquire(config?: DeviceConfiguration | ScanSetup, bAdvanced?: boolean): Promise<any> {
    return new Promise((res, rej) => {
      if (this._selectedDevice !== "") {
        if (this._useCamera) {
          if (this._DWObjectEx) {
            if (this.bUseCameraViaDirectShow) {
              this._DWObjectEx.Addon.Webcam.CaptureImage(() => {
                this.getBlob([0], Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG, this._DWObjectEx)
                  .then(blob => this._DWObject.LoadImageFromBinary(blob, () => {
                    this._DWObjectEx.RemoveImage(0);
                    res(true);
                  }, (errCode, errString) => rej(errString)));
              }, (errCode, errStr) => rej(errStr));
            }
          } else {
            rej("No WebTwain instanance for camera capture!");
          }
        } else {
          this._DWObject.SetOpenSourceTimeout(3000);
          if (bAdvanced) {
            if (this._DWObject.OpenSource()){
              this._DWObject.startScan(<ScanSetup>config);
            } else {
              rej(this._DWObject.ErrorString);
            }
          } else {
            this._DWObject.AcquireImageAsync(<DeviceConfiguration>config).then(()=>{
              return  this._DWObject.CloseSourceAsync();
            }).then(()=>{
              this._DWObject.CloseWorkingProcess();
            }).catch((exp) =>{
              rej(exp.message);
            });
          }
        }
      } else {
        rej("Please select a device first!");
      }
    });
  }
  /**
   * Load images by opending a file dialog (either with built-in feature or use a INPUT element).
   * @param files Files to load.
   */
  load(files?: FileList): Promise<any> {
    return new Promise((res, rej) => {
      this._DWObject.Addon.PDF.SetReaderOptions({
        convertMode: Dynamsoft.DWT.EnumDWT_ConvertMode.CM_AUTO,
        renderOptions: {
            resolution: 200
        }
      });
      this._DWObject.IfShowFileDialog = true;
      this._DWObject.RegisterEvent("OnPostLoad", (
        directory: string,
        fileName: string,
        fileType: DynamsoftEnumsDWT.EnumDWT_ImageType) => {
      });
      this._DWObject.LoadImageEx("", -1,  () => { res(true); }, (errCode, errStr) => rej(errStr))    
    });
  }
  /**
   * Filter zones for the current image.
   * @param zones Original zones.
   */
  filterZones(index: number, zones: Zone[]): Zone[] {
    if (zones !== undefined && zones.length > 0) {
      for (let i = 0; i < zones.length; i++) {
        if (zones[i].index !== index)
          zones.splice(i, 1);
      }
      return zones;
    }
    return [];
  }
  /**
   * Read barcode off the current image.
   * @param config Configuration for the read.
   */
  readBarcode(config?: any) {
    let _index = this._DWObject.CurrentImageIndexInBuffer;
    if (config && config.index !== undefined) {
      _index = Math.floor(config.index);
      if (_index < 0 || _index > this._DWObject.HowManyImagesInBuffer - 1)
        _index = this._DWObject.CurrentImageIndexInBuffer;
    }
    Dynamsoft.Lib.showMask();
    this._DWObject.Addon.BarcodeReader.getRuntimeSettings()
      .then(settings => {
        if (this._DWObject.GetImageBitDepth(_index) === 1) {
          settings.scaleDownThreshold = 214748347;
        } else {
          settings.scaleDownThreshold = 2300;
        }
        settings.barcodeFormatIds = Dynamsoft.DBR.EnumBarcodeFormat.BF_ALL;
        if (config) {
          if (config.formatId) {
            settings.barcodeFormatIds = config.formatId;
          }
          if (config.formatId2) {
            settings.barcodeFormatIds_2 = config.formatId2;
          }
          if (config.zones)
            config.zones = this.filterZones(_index, config.zones);
        }
        // Clear old results before reading again
        this.barcodeResults = [];
        settings.region.regionMeasuredByPercentage = 0;

        if (config && config.zones && config.zones.length > 0) {
          let i = 0;
          let readBarcodeFromRect = () => {
            i++;
            settings.region.regionLeft = config.zones[i].x;
            settings.region.regionTop = config.zones[i].y;
            settings.region.regionRight = config.zones[i].x + config.zones[i].width;
            settings.region.regionBottom = config.zones[i].y + config.zones[i].height;
            if (i === config.zones.length - 1)
              this.doReadBarode(_index, settings, null);
            else
              this.doReadBarode(_index, settings, readBarcodeFromRect);
          }
          settings.region.regionLeft = config.zones[0].x;
          settings.region.regionTop = config.zones[0].y;
          settings.region.regionRight = config.zones[0].x + config.zones[0].width;
          settings.region.regionBottom = config.zones[0].y + config.zones[0].height;
          if (config.zones.length === 1)
            this.doReadBarode(_index, settings, null);
          else
            this.doReadBarode(_index, settings, readBarcodeFromRect);
        }
        else {
          settings.region.regionLeft = 0;
          settings.region.regionTop = 0;
          settings.region.regionRight = 0;
          settings.region.regionBottom = 0;
          this.doReadBarode(_index, settings, null);
        }
      });
  }
  /**
   * Actual barcode reading...
   * @param index The index of the image to read.
   * @param settings RuntimeSettings for the read.
   * @param callback Callback for the read.
   */
  doReadBarode(index: number, settings: RuntimeSettings, callback: () => void) {
    let bHasCallback = !!callback;
    let outputResults = () => {
      let resultString = [];
      if (this.barcodeResults.length === 0) {
        resultString.push({ text: "--------------------------", type: "seperator" });
        resultString.push({ text: "Nothing found on the image!", type: "important" });
        this.barcodeSubject.next(resultString);
      } else {
        let allBarcodeResults: TextResults = [];
        for (let j = 0; j < this.barcodeResults.length; j++) {
          allBarcodeResults = allBarcodeResults.concat(this.barcodeResults[j]);
        }
        resultString.push({ text: "--------------------------", type: "seperator" });
        resultString.push({ text: "Total barcode(s) found: " + allBarcodeResults.length, type: "important" });
        for (let i = 0; i < allBarcodeResults.length; ++i) {
          let result: TextResult = allBarcodeResults[i];
          resultString.push({ text: "------------------", type: "seperator" });
          resultString.push({ text: "Barcode " + (i + 1).toString(), type: "nomral" });
          resultString.push({ text: "Type: " + (result.barcodeFormatString ? result.barcodeFormatString : result.barcodeFormatString_2), type: "nomral" });
          resultString.push({ text: "Value: " + result.barcodeText, type: "important" });
        }
        this.returnBarcodeRects();
        this.barcodeSubject.next(resultString);
      }
      this.barcodeSubject.next({ done: true });
      Dynamsoft.Lib.hideMask();
    };
    this._DWObject.Addon.BarcodeReader.updateRuntimeSettings(settings)
      .then(_ => {
        let decoderFunc = () => {
          try {
            this._DWObject.Addon.BarcodeReader.decode(index)
              .then(textResults => {
                this.barcodeResults.push(textResults);
                bHasCallback ? callback() : outputResults();
              }, error => {
                console.log(error);
                bHasCallback ? callback() : outputResults();
              });
          } catch (err) { console.log(err); setTimeout(() => { decoderFunc() }, 1000); }
        }
        decoderFunc();
      });
  }
  /**
   * Calculate and return the rects of the barcodes (coordinates to indicate where they are located).
   */
  returnBarcodeRects() {
    this.barcodeRects = { imageIds: [], rects: [] };
    let results = this.barcodeResults;
    for (let j = 0; j < results.length; j++) {
      let eachBarcodeResults: TextResults = results[j];
      let existingIndex = -1;
      for (let k = 0; k < this.barcodeRects.imageIds.length; k++) {
        if (this.barcodeRects.imageIds[k] === eachBarcodeResults.imageid) {
          existingIndex = k;
          break;
        }
      }
      let tempRects = [];
      for (let i = 0; i < eachBarcodeResults.length; ++i) {
        let result = eachBarcodeResults[i];
        let loc = result.localizationResult;
        let left = Math.min(loc.x1, loc.x2, loc.x3, loc.x4);
        let top = Math.min(loc.y1, loc.y2, loc.y3, loc.y4);
        let right = Math.max(loc.x1, loc.x2, loc.x3, loc.x4);
        let bottom = Math.max(loc.y1, loc.y2, loc.y3, loc.y4);
        tempRects.push({ x: left, y: top, w: right - left, h: bottom - top });
      }
      if (existingIndex === -1) {
        this.barcodeRects.imageIds.push(eachBarcodeResults.imageid);
        this.barcodeRects.rects.push(tempRects);
      } else {
        this.barcodeRects.rects[existingIndex] = this.barcodeRects.rects[existingIndex].concat(tempRects);
      }
    }
    this.barcodeSubject.next(this.barcodeRects);
  }
 
  /**
   * Convert image(s) to a Blob.
   * @param indices Specify the image(s).
   * @param type Specify the type of the Blob.
   * @param dwt Specify the WebTwain instance doing the job.
   */
  getBlob(indices: number[], type: DynamsoftEnumsDWT.EnumDWT_ImageType, dwt?: WebTwain): Promise<any> {
    return new Promise((res, rej) => {
      let _dwt = this._DWObject;
      if (dwt)
        _dwt = dwt;
      switch (type) {
        case Dynamsoft.DWT.EnumDWT_ImageType.IT_ALL:
          rej("Must specify an image type!"); break;
      }
      _dwt.ConvertToBlob(indices, type, (result, indices, type) => {
        res(result);
      }, (errCode, errString) => {
        rej(errString);
      });
    });
  }
  /**
   * Convert image(s) to a Base64 string.
   * @param indices Specify the image(s).
   * @param type Specify the type of the Base64 string.
   * @param dwt Specify the WebTwain instance doing the job.
   */
  getBase64(indices: number[], type: DynamsoftEnumsDWT.EnumDWT_ImageType, dwt?: WebTwain): Promise<any> {
    return new Promise((res, rej) => {
      let _dwt = this._DWObject;
      if (dwt)
        _dwt = dwt;
      if (type === Dynamsoft.DWT.EnumDWT_ImageType.IT_ALL)
        rej("Must specify an image type!");
      _dwt.ConvertToBase64(indices, type, (result, indices, type) => {
        let _result = result.getData(0, result.getLength());
        switch (type) {
          case 0:
            res("data:image/bmp;base64," + _result); break;
          case 1:
            res("data:image/jpeg;base64," + _result); break;
          case 2:
          case 8:
            res("data:image/tiff;base64," + _result); break;
          case 3:
            res("data:image/png;base64," + _result); break;
          case 4:
          case 7:
            res("data:application/pdf;base64," + _result); break;
          default:
            rej("Wrong image type!"); break;
        }
      }, (errCode, errString) => {
        rej(errString);
      });
    });
  }
  /**
   * Return the extention string of the specified image type.
   * @param type The image type (number).
   */
  getExtension(type: DynamsoftEnumsDWT.EnumDWT_ImageType) {
    switch (type) {
      case 0: return ".bmp";
      case 1: return ".jpg";
      case 2: case 8: return ".tif";
      case 3: return ".png";
      case 4: case 7: return ".pdf";
      default: return ".unknown";
    }
  }
  /**
   * Return the file filter for the save-file dialog based on the image type.
   * @param type The image type (number).
   */
  getDialogFilter(type: DynamsoftEnumsDWT.EnumDWT_ImageType): string {
    let filter = "BMP,TIF,JPG,PNG,PDF|*.bmp;*.tif;*.png;*.jpg;*.pdf;*.tiff;*.jpeg";
    switch (type) {
      case 0: filter = "BMP|*.bmp"; break;
      case 2: case 8: filter = "TIF|*.tif;*.tiff"; break;
      case 1: filter = "JPG|*.jpg;*.jpeg"; break;
      case 3: filter = "PNG|*.png"; break;
      case 4: case 7: filter = "PDF|*.pdf"; break;
      default: break;
    }
    if (this.runningEnvironment.bMac) {
      filter = "TIF,TIFF,JPG,JPEG,PNG,PDF";
      switch (type) {
        case 0: filter = "BMP"; break;
        case 2: case 8: filter = "TIF,TIFF"; break;
        case 1: filter = "JPG,JPEG"; break;
        case 3: filter = "PNG"; break;
        case 4: case 7: filter = "PDF"; break;
        default: break;
      }
    }
    return filter;
  }
  /**
   * Saved the specified images locally.
   * @param indices Specify the image(s).
   * @param type Specify the type of the target file.
   * @param fileName Specify the file name.
   * @param showDialog Specify whether to show a saving dialog.
   */
  saveLocally(indices: number[], type: DynamsoftEnumsDWT.EnumDWT_ImageType, fileName: string, showDialog: boolean): Promise<any> {
    return new Promise((res, rej) => {
      let saveInner = (_path, _name, _type): Promise<any> => {
        return new Promise((res, rej) => {
          let s = () => {
            if (showDialog) {
              _name = this.fileActualName;
              _path = this.fileSavingPath + "/" + _name;
            }
            res({ name: _name, path: _path });
          }, f = (errCode, errStr) => rej(errStr);
          switch (_type) {
            case 0: this._DWObject.SaveAsBMP(_path, indices[0], s, f); break;
            case 1: this._DWObject.SaveAsJPEG(_path, indices[0], s, f); break;
            case 2: this._DWObject.SaveAsTIFF(_path, indices[0], s, f); break;
            case 3: this._DWObject.SaveAsPNG(_path, indices[0], s, f); break;
            case 4: this._DWObject.SaveAsPDF(_path, indices[0], s, f); break;
            case 7: this._DWObject.SaveSelectedImagesAsMultiPagePDF(_path, s, f); break;
            case 8: this._DWObject.SaveSelectedImagesAsMultiPageTIFF(_path, s, f); break;
            default: break;
          }
        });
      };
      fileName = fileName + this.getExtension(type);
      let filePath = this.fileSavingPath + "/" + fileName;
      if (showDialog) {
        this.fileSavingPath = "";
        this.fileActualName = "";
        this._DWObject.IfShowFileDialog = false;
        this._DWObject.RegisterEvent("OnGetFilePath", (isSave, filesCount, index, directory, _fn) => {
          if(isSave && filesCount != -1){
            if (directory === "" && _fn === "") {
              rej("User cancelled the operation.")
            } else {
              this.fileActualName = _fn;
              this.fileSavingPath = directory;
              res(saveInner(this.fileSavingPath + "/" + fileName, fileName, type));
            }
          }
        });
        if(this.runningEnvironment.bMac)

          this._DWObject.ShowFileDialog(
            true,
            "TIF,TIFF,JPG,JPEG,PNG,PDF",
            0,
            "",
            fileName,
            true,
            false,
            0
          );
        else
          this._DWObject.ShowFileDialog(
            true,
           "BMP,TIF,JPG,PNG,PDF|*.bmp;*.tif;*.png;*.jpg;*.pdf;*.tiff;*.jpeg",
            0,
            "",
            fileName,
            true,
            false,
            0
          );

      } else {
        this._DWObject.IfShowFileDialog = false;
        res(saveInner(filePath, fileName, type));
      }
    });
  }
  /**
   * Upload the specified images to the server.
   * @param indices Specify the image(s).
   * @param type Specify the type of the target file.
   * @param fileName Specify the file name.
   */
  uploadToServer(indices: number[], type: DynamsoftEnumsDWT.EnumDWT_ImageType, fileName: string): Promise<any> {
    return new Promise((res, rej) => {
      fileName = fileName + this.getExtension(type);
      let url = "", savedDir = "";
      if (environment.Dynamsoft.uploadTargetURL !== "") {
        url = environment.Dynamsoft.uploadTargetURL;
        /**
         * Change this to point to a url of a directory under which the uploaded files are saved.
         */
        savedDir = "";
      }
      else {
        /**
         * Testing server based on express & formidable
         * Make sure you have the server in /server/ running
         */
        let protocol = Dynamsoft.Lib.detect.ssl ? "https://" : "http://"
        let _strPort = 2020;
        let strActionPage = "/upload";
        savedDir = protocol + window.location.hostname + ":" + _strPort + "/uploaded/";
        url = protocol + window.location.hostname + ":" + _strPort + strActionPage;
      }
      this._DWObject.HTTPUpload(
        url,
        indices,
        type,
        Dynamsoft.DWT.EnumDWT_UploadDataFormat.Binary,
        fileName,
        () => {
          res({ name: fileName, url: savedDir + fileName });
        },
        (errCode, errString, responseStr) => {
          if (responseStr !== "") {
            this.generalSubject.next({ type: "httpResponse", responsString: responseStr });
          }
          rej(errString);
        }
      );
    });
  }
}
export interface Device {
  deviceId: string,
  name: string,
  label: string,
  type: string,
  deviceInfo: any
}

interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}
