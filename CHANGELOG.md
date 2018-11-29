# CHANGELOG - compare

## UNRELEASED
### Added
* Added comment for request diff.
* Upgraded to latest PageXray that will automatically calculate first/third party request + adding the possibility to configure it in a config file.

## 1.0.0 2018-11-28
### Added
* Added support for using Github gists see [#34](https://github.com/sitespeedio/compare/issues/34).
* Added support for using a config file to configure which HARs to test.
* Added support for copy/paste directly you HAR, configuration file or a gist URL or id.
* Refactor the CSS into Sass, development build process now uses BrowserSync.
* Service worker added for offline support. Workbox is used to achieve this.
* Added support for showing changes in request/responses if you compare the same page [#63](https://github.com/sitespeedio/compare/pull/63).

### Changed
* New internal structure and use the new configuration object all the way.

## 0.6.0 2018-10-17
### Added
* Sort CPU events by name to make it easier to spot regressions
* Upgraded to latest release of template7
* Added more Visual Metrics.
* Upgrad to PageXray 2.4.0

## 0.5.1 2018-06-01
### Fixed
* Layout -> Rendering in latest Browsertime.
* Upgraded to PerfCascade 2.5.2 fixiing Edge tab bug

## 0.5.0 2018-04-05
### Added
* CPU metrics are now showed automatically.
* Styled the PageXray info table to make it easier to read.

## 0.4.1 2018-04-04
### Fixed
* Major code refactoring to make it easier to do changes in the future.
* Uploading files failed on Firefox.

## 0.4.0 2018-04-02
### Added
* Upgraded to PerfCascade 2.4.1
* You can change/upload HAR files when you already compare two HARs.

### Fixed
* The layout in the PageXray table was dependent of the length of the URL. That could make some pages look really bad.


## 0.3.0 2018-03-30
### Added
* Automatically load the HAR files if both files are given in the URL . Thanks [Ivru](https://github.com/Ivru) for the PR [#15](https://github.com/sitespeedio/compare/pull/15).
* You can automatically load one HAR file by adding ?har1=URL&compare=1 as the full URL.
* Updated to PageXray 2.2.1
* You can now drag and drop one HAR file with multiple pages and compare the pages with each others [#16](https://github.com/sitespeedio/compare/issues/16).

## 0.2.1 2018-02-03

### Fixed
* Upgraded to PerfCascade 2.2.2 that makes HAR files from WebPageTest Linux render
* Log errors to the console

## 0.2.0 2018-02-01

### Added
* Upgraded to PageXray 2.1.0 and added more CPU metrics

## 0.1.2 2018-01-17

### Fixed
* Upgraded to PageXray 2.0.4

## 0.1.1 2017-12-28

### Fixed
* Upgraded to PageXray 2.0.2

## 0.1.0 2017-09-25

## Added
* Added a switch button so you can choose which HAR that will be number 1 and 2.
* Made drag/drop first option to make it more generic.

### Fixed
* Make sure we don't hide content when choosing header links

## 0.0.1 2017-09-06
### Added
* First release with functionality to compare generic HAR files and some extra love for WebPageTest and sitespeed.io HARs.
