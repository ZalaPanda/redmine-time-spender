redmine-time-spender
====================

Chrome web store: [Redmine Time Spender](https://chrome.google.com/webstore/detail/ajgdpnedcfflmknmalhcaenanifgfiop)

![screen](images/promo1.png)

Spend less time with Redmine time tracking.
* no need to login again because your session has expired
* check your time entries with a simple click/hotkey
* change or create a copy of a time entry with the speed of light

Security
--------

Redmine projects/issues/activities and time entries are cached in local IndexedDB.
Except the `id`s and some date properties (`updated_on`, `closed_on`, etc.) everything else is stored encrypted.
The key is saved in a cookie under the configured Redmine URL.
Basically it is as secure as any other cookie in the browser.

Roadmap
-------
- [X] create options page with help (+screenshots)
- [X] fix sync issue- #2
- [X] filter issues based on selected project
- [X] favorite projects/issues/activities
- [X] periodic auto-refresh
- [X] quick search (`CTRL`+`F`) in tasks and time entries
- [X] beta test
- [X] publish 1.0 🍰

Future plans
------------
* create issues in redmine - #4
* maybe replace webpack with [esbuild](https://esbuild.github.io/)

TODO
----
- [X] fix Select focus/blur problem (reason: the portal)
- [ ] replace `no more options` in *time entry* dialog *issue* field with `add new issue`
- [ ] check icons in *time entry* dialog *issue* field
- [ ] more testing with multiple custom fields
- [ ] check both issue dates