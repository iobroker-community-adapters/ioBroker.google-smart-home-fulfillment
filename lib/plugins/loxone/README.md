## Plugin for ioBroker.loxone

This adatper creates Google Home devices from those in the ioBroker tree created by the [ioBroker.Loxone](https://github.com/UncleSamSwiss/ioBroker.loxone) adapter.

### Supported Device Types

The following (Loxone) device types are supported:

- Lighting Controller (V2)
  - One lighting controller in Loxone creates one Google Home light device with on/off function. This is purely so the user can ask to turn off lights.
    - *Hey Google... turn off the lights* - Triggers Loxone 'Off' mood.
    - *Hey Google... turn on the lights* - Triggers Loxone 'Bright' mood.
  - Additionally, one Google Home scene device is created for each Loxone mood in each lighting controller (excluding 'Off' moods which are redundant). This can operate in one of two ways: with or without reversible scenes.
    - With reversible scenes moods can be mixed in and out:
      - *Hey Google... activate scene <name of Loxone mood>* - Mixes in the named scene.
      - *Hey Google... deactivate scene <name of Loxone mood>* - Mixes out the named scene.
      - *Hey Google... turn off the lights then activate scene <name of Loxone mood>* - Results in only the named scene being active.
    - Without reversible scenes only a single mood can be activated:
      - *Hey Google... activate scene <name of Loxone mood>* - Same as clicking that specific mood button in the Loxone app/UI.
      - Sadly it is not possible to activate multiple scenes in one command, asking *activate scene X and Y* results in scene *X* breifly turning on before being immediately replaced with scene *Y*.
  
- Automatic Blinds (Jalousie)
  - One automatic blinds block in Loxone creates one Google Home shutter device.
    - *Hey Google... close <name of Loxone device>* - Same as hitting 'Down Full' on the Loxone app/UI.
    - *Hey Google... close the shutters* - Closes all the shutters in the current room.
    - *Hey Google... stop the shutters* - Stops movement of any shutters in the current room.
    - *Hey Google... close all the shutters* - Closes all the shutters throughout the home.

### Options

TODO: the reversible scenes option is hardcoded to `false` right now (bottom of `lib/plugins/loxone.js`). A screen for plugin settings is required.