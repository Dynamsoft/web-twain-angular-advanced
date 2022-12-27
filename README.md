# Dynamic Web TWAIN Angular Advanced

This project was bootstrapped with [Angular CLI](https://github.com/angular/angular-cli). It utilizes the SDK [Dynamic Web TWAIN](https://www.dynamsoft.com/Products/WebTWAIN_Overview.aspx) to provide the following functionalities.

* Scan documents from physical scanners
* Capture images from webcams
* Load documents from local disk (bmp/jpg/png/tif/pdf)
* View and process the documents already scanned/captured/loaded
  * Editing (rotate/flip/mirror/crop, etc.)
  * Saving or uploading
  * Barcode reading

## Usage

1. Apply for a [30-day free trial license](https://www.dynamsoft.com/customer/license/trialLicense?product=dwt) of Dynamic Web TWAIN.

2. Update the license key in `document-scanner.component.ts` file:

   ```
   Dynamsoft.DWT.ProductKey = "LICENSE-KEY";
   ```

3. Install the dependencies:

   ```
   npm install
   ```

4. Run the Angular application as follows:

   ```
   ng serve
   ```

5. Set up and run the server piece which is used solely for receiving uploaded files. Run the  command-line as follows:

   ```
   cd server
   npm install
   node server.js
   ```

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.