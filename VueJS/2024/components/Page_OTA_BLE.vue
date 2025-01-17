<template>
  <v-container>
    <v-row class="text-center">
      <v-col class="" cols="12">
        <div class="App" id="top">

          <div class="main-title text-center">
            <h1 class="display-2 font-weight-bold mb-3">
              Bluetooth (BLE) OTA
            </h1>
            <hr class="mb-2" />
          </div>

          <header class="App-header" id="mid">
            <p id="hw_version">Hardware: Nepřipojeno</p>
            <p id="sw_version">Software: Nepřipojeno</p>
            <p id="completion"></p>
            <hr class="mb-2 mt-2 mb-2" />
            <v-btn
                id="connect"
                class="bg-primary"
                @click="this.BTConnect"
            >
              Připojit zařízení
            </v-btn>
          </header>
        </div>

        <router-link to="/ota-update">
          <v-btn
              class="bg-primary w-100 mb-2 mt-5"
          ><v-icon icon="mdi mdi-chevron-left" class="m-3" /> ZPĚT</v-btn>
        </router-link>

      </v-col>
    </v-row>
  </v-container>
</template>

<script>

const myESP32 = '********-6ce7-4e81-9f8a-ce0f699085eb'

const otaServiceUuid = '********-af91-4ad3-a995-a58d6fd26145'
const versionCharacteristicUuid = '********-af91-4ad3-a995-a58d6fd26145'
const fileCharacteristicUuid = '********-af91-4ad3-a995-a58d6fd26145'

let esp32Device = null;
let esp32Service = null;
let readyFlagCharacteristic = null;
let dataToSend = null;
let updateData = null;

let totalSize;
let remaining;
let amountToWrite;
let currentPosition;

let currentHardwareVersion = "N/A";
let softwareVersion = "N/A";
let latestCompatibleSoftware = "N/A";

const characteristicSize = 512;

export default {
  name: 'PageOTABLE',
  data() {
    return {
    };
  },
  methods: {

    /* onDisconnected(event)
     * If the device becomes disconnected, prompt the user to reconnect.
     */
    onDisconnected() {

      console.log('Disconnected');
      if(confirm(esp32Device.name + ' is disconnected, would you like to reconnect?')) {
        this.BTConnect();
      }
    },


    /**
     * Brings up the bluetooth connection window and filters for the esp32
     */
    BTConnect() {

      console.log(navigator);

      if (location.protocol !== 'https:') {
        alert('Aplikace potřebuje protokol HTTPS');
      }

      /*
      if(!navigator || !navigator.hasOwnProperty('bluetooth')) {
        alert("Your device does not support the Web Bluetooth API. Try again on Chrome on Desktop or Android!");
        return;
      }

      if(!navigator.bluetooth.hasOwnProperty('requestDevice')) {
        alert('Your browser not able to use requestDevice function');
      }
      */

      try {
        navigator.bluetooth.requestDevice({
          filters: [{
            services: [myESP32]
          }],
          optionalServices: [otaServiceUuid],
          /*acceptAllDevices: true*/
        })
            .then(device => {
              return device.gatt.connect()
            })
            .then(server => server.getPrimaryService(otaServiceUuid))
            .then(service => {
              esp32Service = service;
            })
            .then(service => {
              return service;
            })
            .then((/*_*/) => {
              return this.CheckVersion();
            })
            .catch(error => {
              console.log(error);
            });
      } catch(e) {
        console.log(e)
        alert(e.message)
      }
    },


    /**
     * Grab most current version from Github and Server, if they don't match, prompt the user for firmware update
     */
    CheckVersion() {

      const self = this;

      if(!esp32Service)
      {
        return;
      }

      return esp32Service.getCharacteristic(versionCharacteristicUuid)
          .then(characteristic => characteristic.readValue())
          .then(value => {
            currentHardwareVersion = 'v' + value.getUint8(0) + '.' + value.getUint8(1);
            softwareVersion = 'v' + value.getUint8(2) + '.' + value.getUint8(3) + '.' + value.getUint8(4);
            document.getElementById('hw_version').innerHTML = "Hardware: " + currentHardwareVersion;
            document.getElementById('sw_version').innerHTML = "Software: " + softwareVersion;
          })
          //Grab our version numbers from Github
          .then((/*_*/) => fetch('https://raw.githubusercontent.com/sparkfun/ESP32_OTA_BLE_React_WebApp_Demo/master/GithubRepo/version.json'))
          .then(function (response) {
            // The API call was successful!
            return response.json();
          })
          .then(function (data) {
            // JSON should be formatted so that 0'th entry is the newest version
            if (latestCompatibleSoftware === softwareVersion)
            {
              //Software is updated, do nothing.
            }
            else {
              let softwareVersionCount = 0;
              latestCompatibleSoftware = data.firmware[softwareVersionCount]['software'];
              versionFindLoop:
                  while (latestCompatibleSoftware !== undefined) {
                    let compatibleHardwareVersion = "N/A"
                    let hardwareVersionCount = 0;
                    while (compatibleHardwareVersion !== undefined) {
                      compatibleHardwareVersion = data.firmware[softwareVersionCount]['hardware'][hardwareVersionCount++];
                      if (compatibleHardwareVersion === currentHardwareVersion)
                      {
                        latestCompatibleSoftware = data.firmware[softwareVersionCount]['software'];
                        if (latestCompatibleSoftware !== softwareVersion)
                        {
                          console.log(latestCompatibleSoftware);
                          self.PromptUserForUpdate(self);
                        }
                        break versionFindLoop;
                      }
                    }
                    softwareVersionCount++;
                  }
            }
          })
          .catch(error => { console.log(error); });
    },


    /**
     * Asks the user if they want to update, if yes downloads the firmware based on the hardware version and latest software version and begins sending
     */
    PromptUserForUpdate(self) {

      if(confirm(
          "Version " + softwareVersion + " is out of date. Update to " + latestCompatibleSoftware + "?"
      )) {
        fetch('https://raw.githubusercontent.com/sparkfun/ESP32_OTA_BLE_React_WebApp_Demo/' + latestCompatibleSoftware + '/GithubRepo/' + currentHardwareVersion + '.bin')
            .then(function (response) {
              return response.arrayBuffer();
            })
            .then(function (data) {
              updateData = data;
              return self.SendFileOverBluetooth();
            })
            .catch(function (err) {
              console.warn('Something went wrong.', err);
            });
      }
    },

    /**
     * Figures out how large our update binary is, attaches an eventListener to our dataCharacteristic so the Server can tell us when it has finished writing the data to memory
     * Calls SendBufferedData(), which begins a loop of write, wait for ready flag, write, wait for ready flag...
     */
    SendFileOverBluetooth() {

      const self = this;

      if(!esp32Service)
      {
        console.log("No esp32 Service");
        return;
      }

      totalSize = updateData.byteLength;
      remaining = totalSize;
      amountToWrite = 0;
      currentPosition = 0;
      esp32Service.getCharacteristic(fileCharacteristicUuid)
          .then(characteristic => {
            readyFlagCharacteristic = characteristic;
            return characteristic.startNotifications()
                .then((/*_*/) => {
                  readyFlagCharacteristic.addEventListener('characteristicvaluechanged', this.SendBufferedData)
                });
          })
          .catch(error => {
            console.log(error);
          });

      self.SendBufferedData();
    },

    /**
     * An ISR attached to the same characteristic that it writes to, this function slices data into characteristic sized chunks and sends them to the Server
     */
    SendBufferedData() {
      if (remaining > 0) {
        if (remaining >= characteristicSize) {
          amountToWrite = characteristicSize
        }
        else {
          amountToWrite = remaining;
        }
        dataToSend = updateData.slice(currentPosition, currentPosition + amountToWrite);
        currentPosition += amountToWrite;
        remaining -= amountToWrite;
        console.log("remaining: " + remaining);
        esp32Service.getCharacteristic(fileCharacteristicUuid)
            .then(characteristic => this.RecursiveSend(characteristic, dataToSend))
            .then((/*_*/) => {
              return document.getElementById('completion').innerHTML = (100 * (currentPosition/totalSize)).toPrecision(3) + '%';
            })
            .catch(error => {
              console.log(error);
            });
      }
    },

    /**
     * Returns a promise to itself to ensure data was sent and the promise is resolved.
     */
    RecursiveSend(characteristic, data) {
      return characteristic.writeValue(data)
      .catch((/*error*/) => {
        return this.RecursiveSend(characteristic, data);
      })
    },

  },
};
</script>

<style scoped>

.App-header {
  font-size: calc(10px + 2vmin);
}

</style>
