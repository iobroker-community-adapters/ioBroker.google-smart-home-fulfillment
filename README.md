![Logo](admin/google-smart-home-fulfillment.png)
# ioBroker.google-smart-home-fulfillment

[![NPM version](http://img.shields.io/npm/v/iobroker.google-smart-home-fulfillment.svg)](https://www.npmjs.com/package/iobroker.google-smart-home-fulfillment)
[![Downloads](https://img.shields.io/npm/dm/iobroker.google-smart-home-fulfillment.svg)](https://www.npmjs.com/package/iobroker.google-smart-home-fulfillment)
![Number of Installations (latest)](http://iobroker.live/badges/google-smart-home-fulfillment-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/google-smart-home-fulfillment-stable.svg)
[![Dependency Status](https://img.shields.io/david/raintonr/iobroker.google-smart-home-fulfillment.svg)](https://david-dm.org/raintonr/iobroker.google-smart-home-fulfillment)
[![Known Vulnerabilities](https://snyk.io/test/github/raintonr/ioBroker.google-smart-home-fulfillment/badge.svg)](https://snyk.io/test/github/raintonr/ioBroker.google-smart-home-fulfillment)
[![Tests](https://travis-ci.org/raintonr/ioBroker.legrand-ecocompteur.svg?branch=master)](https://travis-ci.org/raintonr/ioBroker.google-smart-home-fulfillment)

[![NPM](https://nodei.co/npm/iobroker.google-smart-home-fulfillment.png?downloads=true)](https://nodei.co/npm/iobroker.google-smart-home-fulfillment/)

## google-smart-home-fulfillment adapter for ioBroker

### Caveats

**This software is currently cosidered Beta test quality. Use at your own risk.**

**Setup of this adapter requires some technical knowledge.** If you are looking or a way to connect an ioBroker instance with Google Assistant consider the [ioBroker.iot](https://github.com/ioBroker/ioBroker.iot) adapter. Pros & cons of each are briefly discussed below.

### Introduction

This adapter implements a Google Smart Home Actions fulfillment server running within an ioBroker installation. It creates devices in the Google ecosystem to mirror devices within the ioBroker object tree. These can be controller from any [Google Assistant](https://assistant.google.com/) device, smartphone running the Google Assistant app, etc.

#### Compared with ioBroker.iot

Benefits of this adapter over ioBroker.iot include:

- No (ioBroker Pro)[https://iobroker.pro/] subscription required. In fact, no subscriptions of any kind are necessary so this implementation is **completely free to use**.
- Device configuration is automatic. Once the adapter is correctly up and running no further configuration is required.

Disadvantages:

- More complicated installation process (see below).
- Foreign adapter developers must create plugin code to allow their devices to used. Mapping between ioBroker/Google Home device types is necessary, and the philosophy here is that such mapping & translation should be performed in code on a per-foreign adapter basis. That is, foregin adapter developers should create a plugin for iobroker.google-smart-home-fulfillment which describes how devices in that foreign adapter map to devices in the Google Home and how commands and queries for each are serviced. While this requires more development effort, this philosophy actually leads to less configuration effort for the end user (an advantage above) and ultimately more flexibility how devices can be controlled.
- Given the above, a limited set of foregin adapters and device types are supported. Current foreign adapters are:
-- [ioBroker.Loxone](https://github.com/UncleSamSwiss/ioBroker.loxone)

Feel free to [submit a feature request issue](https://github.com/raintonr/ioBroker.google-smart-home-fulfillment/issues) for with plugin requests.

### Create an Actions on Google Test Project

For correct integration with Google Assistant a project is required. 

Visit the [Actions on Google Console](https://console.actions.google.com/) and create a new project. This is going to be a test project and will never be published so the name isn't really important. For example purposes below we assume `My ioBroker` is used.

The following configuration settings are necessary in the 'Develop' tab:

- Actions
-- Fulfillment URL. Set to `https://example.com/fulfillment` where 'example.com' is actually the public FQDN of the ioBroker instance (and must match the setting configured in ioBroker below).

- Account linking
-- OAuth Client Information
--- Client ID & Secret. Enter some random strings here. It doesn't matter what is used so long as the same values are entered in the ioBroker configuration below.
--- Authorization URL. Set to `https://example.com/oidc/auth` (replacing 'example.com' with the correct public FQDN).
--- Token URL. Set to `https://example.com/oidc/token` (replacing 'example.com' with the correct public FQDN).
-- Configure your client (optional)
--- Scopes. Enter `Fulfillment` here.

Moving on to the 'Test' tab:

In the simulator here there is a 'Settings' button over on the right. Make sure 'On device testing' is selected here.

### ioBroker Installation & Configuration

Install the adapter in the usual way then visit the settings page and follow the steps below to determine each value required:

#### Secure HTTPS Port

HTTPS requests from the public internet must be correctly received by this adapter for it to function correctly. The adapter will create a HTTPS server listening on the specified port. This port does not necessarily need to be the standard 443, and it is often preferrable not to use that due to O/S restrictions on privileged ports. The author suggests using port `8443`.

#### Public FQDN

Requests to port 443 on this public FQDN (or IP address) must be received by the adapter, on the HTTPS port configured. Usually achieved through port forwarding/firewall configuration. If a fixed IP address or name is available that should be used, otherwise it could be possible to use a dynamic DNS resolution service and place the configured public name here.

#### Public/Private/Chained Certrificates

Required for correct HTTPS operation. Within ioBroker, certificates are stored in the system configuration/certificates configuration screen. Follow the usual steps for obtaining a valid set of certificates and be sure they are stored in the system configuration/certificates screen, then select them in the correct order here.

**At this time automatic certificate generation from Let’s Encrypt is broken** so certificates must be created by another means, generally manually with (certbot)[https://certbot.eff.org/] (see [Getting Started Let’s Encrypt](https://letsencrypt.org/getting-started/)).

#### Google HomeGraph JSON Key

[Create a Service Account Key](https://developers.google.com/assistant/smarthome/develop/report-state#service-account-key) for your project and copy/paste the JSON here.

#### OAuth Client ID/Secret

Enter the client ID & secret configured in your project in the [Actions on Google Console](https://console.actions.google.com/)

### Troubleshooting

#### Test public connectivity and certificates

Say the configured public FQDN is `example.com`. Verify external connectivity and certificates by visiting `https://example.com/`. This should yield a 404 response with a single line reading, `Cannot GET /` - that is expected behaviour. There should be no certificate errors (click the padlock in the brower URL bar to verify).

#### Check the Google HomeGraph API console

https://console.cloud.google.com/apis/api/homegraph.googleapis.com/overview

### Add Devices in Google Home App

Once all the above installation and configuration steps are complete it's time to link ioBroker with Google Home. Follow these steps in Google Home App:

- Hit the plus symbol to add/setup a new device.
- Select the 'Works with Google' option. A list of many external services will load.
- Select your test project name in the list. Say the project is named `My ioBroker` in this list it will be shown as `[test] My ioBroker`.
- Follow the OAuth login/grant process.

At this point a list of devices know to the fulfillment adater should be shown. If you are satisfied with the room placement just hit 'done'.

If you made it this far, well done! ;) Enjoy :)

## Changelog

### 0.0.1
* (Robin Rainton) initial release

## License
MIT License

Copyright (c) 2020 Robin Rainton <robin@rainton.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
