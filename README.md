redmine-time-spender
====================

Spend less time with Redmine tiome tracking.
This Chrome extension helps to save time with:
* no need to log into Redmine because every action is done with an API key
* check the registered time entries with a click/keypress
* duplicate or change a time entry with the speed of light

API key
-------

![key](API-key.png)
1. Click on **My account** after login.
2. Under **API access key** click on **Show**.
3. Copy the *key* (40 hexadecimal characters).

Login with username filled: https://redmine.bhu.flextronics.com/login?username=zaladdev

Shortcuts
---------

API: https://developer.chrome.com/docs/extensions/reference/commands/#basic-command
Link: chrome://extensions/shortcuts

Color shades generators
-----------------------
https://mdigi.tools/color-shades/#b84058
https://maketintsandshades.com/#b84058

TODO
====
* [x] fix background refresh
* [x] reload on force refresh
* [x] check background script module support
* [x] task features done: color/update/delete
* [ ] task features left: stopper?/notes?
* [x] animation on day select
* [x] save new entry on popup close and continue next time
* [x] options page
* [ ] favorite projects/issues/activities

Next steps
==========
* check cookie permission request/revoke
* fix dark theme
* create light theme
* generate lorem ipsum sample data for screenshots
* add hotkey link to the config dialog
* publish 🍰

Color: [chroma](https://gka.github.io/chroma.js) [GitHub](https://github.com/gka/chroma.js)
Theme generator: [CSS Color Theme Generator by Numl.Design](https://theme.numl.design/)