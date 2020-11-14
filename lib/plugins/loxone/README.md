## Plugin for ioBroker.loxone

This adatper creates Google Home devices from those in the ioBroker tree created by the [ioBroker.Loxone](https://github.com/UncleSamSwiss/ioBroker.loxone) adapter.

### Supported Device Types

The following (Loxone) device types are supported:

- Lighting Controller (V2)
  - One lighting controller in Loxone creates one Google Home light device with on/off function. This is purely so the user can ask to turn off lights.
    - *Hey Google... turn off the lights* - Triggers Loxone 'Off' mood.
    - *Hey Google... turn on the lights* - Triggers Loxone 'Bright' mood.
  - Additionally, one Google Home scene device is created for each Loxone mood in each lighting controller (excluding 'Off' moods which are redundant). Sadly Google Home doesn't seem to support activating multiple scenes in the same command so mixing is not supported at this time.
    - *Hey Google... activate scene \<name of Loxone mood>* - Same as clicking that specific mood button in the Loxone app/UI.
  
- Automatic Blinds (Jalousie)
  - One automatic blinds block in Loxone creates one Google Home shutter device.
    - *Hey Google... close \<name of Loxone device>* - Same as hitting 'Down Full' on the Loxone app/UI.
    - *Hey Google... close the shutters* - Closes all the shutters in the current room.
    - *Hey Google... close all the shutters* - Closes all the shutters throughout the home.
