
const axios = require('axios');

class OdorikApi {

    /**
     * {apiEndpoint, apiUsername, apiPassword}
     */
    constructor(odorikCredentials) {
        this.odorikCredentials = odorikCredentials;
    }

    async getBalance() {
        try {
            // Make the GET request with basic auth
            const response = await axios({
                method: 'get',
                url: this.odorikCredentials.apiEndpoint + '/balance',
                params: {
                    user: this.odorikCredentials.apiUsername,
                    password: this.odorikCredentials.apiPassword
                }
            });

            return response.data
        } catch (error) {
            console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        }
    }


    async requestCallback(o_param) {

        console.log('Requesting callback', o_param);

        try {
            // Make the GET request with basic auth
            const response = await axios({
                method: 'POST',
                url: this.odorikCredentials.apiEndpoint + '/callback',
                params: {
                    user: this.odorikCredentials.apiUsername,
                    password: this.odorikCredentials.apiPassword,
                    caller: o_param.caller,
                    recipient: o_param.recipient,
                }
            });

            // Log the balance information
            console.log('Callback:', response.data);
        } catch (error) {
            console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        }
    }


    async getSpeedDials() {

        try {
            // Make the GET request with basic auth
            const response = await axios({
                method: 'get',
                url: this.odorikCredentials.apiEndpoint + '/speed_dials.json',
                params: {
                    user: this.odorikCredentials.apiUsername,
                    password: this.odorikCredentials.apiPassword
                }
            });
    
            // Log the balance information
            console.log('Speed dials found:', response.data.length);

            return response.data;

        } catch (error) {
            console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        }
    }

    
    async getSpeedDial() {
        return await this.getSpeedDials();
    }

    async lookForSpeedDial({s_name}) {
        const o_speed_dials = await this.getSpeedDials();

        if(!s_name) {
            console.log('Empty name to find !');
            return '';
        }

        console.log('Looking for speed dial name', s_name);

        for(const o_speed_dial of o_speed_dials) {

            console.log(o_speed_dial.name, 'vs', s_name);

            if(o_speed_dial && o_speed_dial.hasOwnProperty('name')) {
                if(o_speed_dial.name.toUpperCase().includes(s_name.toUpperCase())) {
                    console.log('Speed dial found', o_speed_dial);
                    return o_speed_dial;
                }
            }
        }

        return null;
    }
}

module.exports = OdorikApi;



