@echo off
chcp 65001 >nul
title %~2

REM  Thin launcher for win-open.ps1, which holds the actual logic.
REM
REM    %1  path to open   ( / or /admin )
REM    %2  window title
REM
REM  pushd first, then a relative script path: the folder name contains
REM  Arabic letters, and a path spelled out on a command line can arrive
REM  mangled through the console code page. The working directory does not.
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\win-open.ps1" -Path "%~1" -Title "%~2"
popd
