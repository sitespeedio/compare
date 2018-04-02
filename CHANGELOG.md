# CHANGELOG - compare

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