<?php

/**
 *  Class Siptools
 *  @version 0.99.140705
 *  @author: Tomas Hujer (c) 2014
 *
 * 0.99.140705 - Basic functionality - sending SMS, calling, balance checking
 *
 */
class Siptools
{
    protected $api_url = '';
    protected $authentication = array();
    protected $response = null;

    /**
     * Init, store api url and login credentials
     * @param $api_url URL url for CURD
     * @param $user Login name
     * @param $password Login password
     */
    public function __construct($api_url, $user, $password) {
        $this->api_url = $api_url;
        $this->authentication($user, $password);
    }

    /**
     * Store login credentials
     * @param $user Login name
     * @param $password Login password
     */
    public function authentication($user, $password) {
        $this->authentication = array("user" => $user, "password" => $password);
    }

    /**
     * Send SMS message
     * @param $params SMS structure
     * @return mixed Response data
     */
    public function sms($params) {
        $curl_handle = curl_init($this->api_url.'/sms');
        curl_setopt($curl_handle, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl_handle, CURLOPT_POSTFIELDS, $this->authentication + $params);
        $response = curl_exec($curl_handle);
        curl_close($curl_handle);
        return($response);
    }

    /**
     * Get current balance
     * @return mixed Ballance in decimal (example 43.25)
     */
    public function balance() {
        $curl_handle = curl_init($this->api_url.'/balance?user='.$this->authentication['user'].'&password='.$this->authentication['password']);
        curl_setopt($curl_handle, CURLOPT_RETURNTRANSFER, true);
        print_r(curl_error($curl_handle));
        $response = curl_exec($curl_handle);
        curl_close($curl_handle);
        return($response);
    }

    /**
     * Return all active calls
     * @return mixed active call in json array or empty array
     *
     * Return example
     * [
     *  {"id":4439923,
     *   "source_number":"00420777748740",
     *   "destination_number":"00420910111303",
     *   "destination_name":"Česká rep. v síti - přesměrováno",
     *   "start_date":"2014-07-27T00:41:18Z",
     *   "price_per_minute":0.0,"line":412889},
     *
     *  {"id":4439924,
     *   "source_number":"777748740",
     *   "destination_number":"*412889",
     *   "destination_name":"Česká rep. - * v síti",
     *   "start_date":"2014-07-27T00:41:18Z",
     *   "price_per_minute":0.0,
     *   "line":412889}
     * ]
     */
    public function get_active_calls() {
        $curl_handle = curl_init($this->api_url.'/active_calls.json?user='.$this->authentication['user'].'&password='.$this->authentication['password']);
        curl_setopt($curl_handle, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($curl_handle);
        curl_close($curl_handle);
        return($response);
    }

}

