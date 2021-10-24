redmine-time-spender
====================

Spend less time with Redmine time tracking.
This Chrome extension helps to save time with:
* no need to log into Redmine because every action is done with the API key
* check the registered time entries with a click/hotkey
* duplicate or change a time entry with the speed of light

API key
-------

![key](API-key.png)

1. Log into Redmine.
1. Click on **My account** after login.
2. Under **API access key** click on **Show**.
3. Copy the *key* (40 hexadecimal characters).

Security
--------

Redmine projects/issues/activities and time entries are cached in local IndexedDB.
Except the `id`s and some date properties (`updated_on`, `closed_on`, etc.) everything else is stored encrypted.
The key is saved in a cookie under the configured Redmine URL.
Basically it is as secure as any other cookie in the browser.

Roadmap
-------
* create options page
* generate lorem ipsum sample data for screenshots
* publish 1.0 🍰

Future plans
------------
* quick search in tasks and time entries
* favorite projects/issues/activities
* periodic auto-refresh in the background