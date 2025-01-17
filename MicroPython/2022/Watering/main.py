
# *******************************************************************************
# * @author  Tomas Hujer
# * @version 0.1.0
# * @date    Oct 19 2022
# * @brief   Watering
# *******************************************************************************

from umqttsimple import MQTTClient
import network
import machine
from machine import Pin
from machine import ADC
from machine import WDT
import json
import neopixel
from consts import *
from timer import Timer
import utime


def get_mode_str(mode):
    if(mode == MODE_AUTO):
        return "AUTO"
    elif mode == MODE_MANUAL:
        return "MANUAL"
    elif mode == MODE_STOP:
        return "STOP"

def rgb_update(r, g, b):
    np[0] = (r, g, b)
    np.write()
    tm_led.set(TIME_LED_BLINK_OFF)
    
def do_pump_change_request():
    global water_flow
    
    if(water_flow == True):
        tm_water_flow.set(TIME_MAX_FLOW_TIMEOUT)
        pin_pump.value(1)
        mqttc.publish(TOPIC_PUB, make_mqtt_response("Water pump ON", "RAW-MULTI"))
    else:
        pin_pump.value(0)
        mqttc.publish(TOPIC_PUB, make_mqtt_response("Water pump OFF", "RAW-MULTI"))


def do_mode_manual():
    global mode
    global mode_last
    global water_flow
    global water_refresh_request
    
    if(mode_last != mode):
        print("Mode changed to MANUAL")
        mode_last = mode
        rgb_update(0, 0, 1)
        
    if(water_refresh_request == True):
        water_refresh_request = False
        do_pump_change_request()
           
    if(water_flow == True):
        if(tm_water_flow.timeout()):
            print("Water flow timeout")
            mqttc.publish(TOPIC_PUB, make_mqtt_response("Water flow timeout", "RAW-MULTI"))
            water_flow = False
            water_refresh_request = True

def do_mode_stop():
    global mode
    global mode_last
    global water_flow
    
    if(mode_last != mode):
        print("Mode changed to STOP")
        mode_last = mode
        water_flow = False
        pin_pump.value(0)
        rgb_update(1, 0, 0)

def do_mode_auto():
    global mode
    global mode_last
    global water_flow
    global water_refresh_request
    
    if(mode_last != mode):
        print("Mode changed to AUTO")
        mode_last = mode
        rgb_update(0, 1, 0)
        
    if (watering_value > int(config["thresold"])):
        if(tm_watering_again.timeout()):
            if(water_flow == False):
                print("Request pump to ON")
                water_flow = True
                water_refresh_request = True
                tm_water_flow.set(TIME_WATER_FLOW_MAX)
                tm_watering_again.set(TIME_WATER_AGAIN)
    else:
        if(water_flow == True):
            print("Request pump to OFF")
            water_flow = False
            water_refresh_request = True
            
    if(water_flow == True):
        if(tm_water_flow.timeout()):
            print("Water flow timeout")
            mqttc.publish(TOPIC_PUB, make_mqtt_response("Water flow timeout", "RAW-MULTI"))
            water_flow = False
            water_refresh_request = True

    if(water_refresh_request == True):
        water_refresh_request = False
        do_pump_change_request()

    
def wifi_connect():
    global wlan
    
    #  connect to the internet
    wlan = network.WLAN(network.STA_IF)
    count = 0

    if not wlan.isconnected():
        print('Connecting to ' + WIFI_SSID + ' ...')
        wlan.active(True)
        #wlan.ifconfig(('192.168.10.99', '255.255.255.0', '192.168.10.1', '8.8.8.8'))
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        
        while (count < 5):
            count += 1

            status = wlan.status()

            try:
                with open('errors.txt', 'a') as outfile:
                    outfile.write('Connect status = ' + str(status) + '\n')
                outfile.close()
                    
            except OSError:
                print('oops')

            if (wlan.isconnected()):
                count = 0
                break

            print('.', end = '')
            utime.sleep(1)

    if (count == WIFI_CONNECT_WAIT_LOOPS):
        count = 0

        try:
            with open('errors.txt', 'a') as outfile:
                outfile.write('Did NOT connect to internet' + '\n')
                outfile.close()
                
        except OSError:
            print('oops')

        print("Doing machine reset");
        with open('restarts.txt', 'a') as outfile:
            outfile.write("Wifi cant connect\n")
            outfile.close();
            
        machine.reset()

    print('Network config:', wlan.ifconfig())
    

def make_mqtt_response(message, xtype):
    global mqtt_message_id
    global DEVICE_ID
    
    mqtt_message_id += 1
    return 'S:{}|T:{}|M:{}|I:{}'.format(DEVICE_ID, xtype, message, mqtt_message_id)

def mqtt_receive_callback(topic, msg):
    global mode
    global water_flow
    global water_refresh_request
    
    print((topic, msg))
    for param in msg.decode().split('#'):
        param_array = param.split(':')
        if(param_array[0] == 'C'):
            commands = param_array[1].split(' ')
            if commands[0] == 'help':
                print("COMMAND", param_array[1])
                message = (
                    "Usable commands\n"
                    "HW\tHardware info\n"
                    "adc\tRead ADC value\n"
                    "adc_get\tRead adc thresold\n"
                    "adc_set [value]\tWrite adc thresold\n"
                    "mod\tShow current mode\n"
                    "mod_aut\tChange mode to auto\n"
                    "mod_man\tChange mode to manual\n"
                    "mod_stop\tChange mode to stop\n"
                    "water\tGet current flow status\n"
                    "water_flow\tSwitch pump to run\n"
                    "water_stop\tSwitch pump to stop\n"
                )
                response = make_mqtt_response(message, "RAW-MULTI")
                print("response", response)
                mqttc.publish(TOPIC_PUB, response)
                    
            elif commands[0] == "mod":
                msg = "Current mode " + get_mode_str(mode)
                print(msg)
                response = make_mqtt_response(msg, "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)

            elif commands[0] == "mod_aut":
                mode = MODE_AUTO
                print("Switched to autonomous mode")
                response = make_mqtt_response("Switched to AUTO mode " + str(MODE_AUTO), "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                
            elif commands[0] == "mod_man":
                print("Switched to manual mode")
                response = make_mqtt_response("Switched to MANUAL mode " + str(MODE_MANUAL), "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                mode = MODE_MANUAL
                water_refresh_request = True
                
            elif commands[0] == "mod_stop":
                print("Switched to stop mode")
                response = make_mqtt_response("Switched to STOP mode " + str(MODE_STOP), "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                mode = MODE_STOP
                
            elif commands[0] == "water":
                msg = "Current water status " + str(water_flow)
                print(msg)
                response = make_mqtt_response(msg, "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                
            elif commands[0] == "water_flow":
                print("Water flow")
                response = make_mqtt_response("Water switched flowing", "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                water_flow = True
                water_refresh_request = True
                tm_water_flow.set(5000)
                
            elif commands[0] == "water_stop":
                print("Water stop")
                response = make_mqtt_response("Water switched stop", "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                water_flow = False
                water_refresh_request = True
                
            elif commands[0] == "adc":
                msg = "ADC value " + str((water_sensor.read())) + " / " + str(config["thresold"])
                response = make_mqtt_response(msg, "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)
                
            elif commands[0] == "adc_set":
                config["thresold"] = commands[1]
                file_config = open("config.json", 'w')
                json_config = json.dumps(config)
                file_config.write(json_config)
                file_config.close()

                msg = "ADC updated to " + str(config["thresold"])
                response = make_mqtt_response(msg, "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)

            elif commands[0] == "adc_get":
                msg = "ADC thresold is " + str(config["thresold"])
                response = make_mqtt_response(msg, "RAW-MULTI")
                mqttc.publish(TOPIC_PUB, response)

            else:
                print("Unknown command " + param_array[1])
                mqttc.publish(TOPIC_PUB, make_mqtt_response("Unknown command " + param_array[1], "RAW-MULTI"))
 
def get_wake_up_reason(wake_reason):
    if(wake_reason == machine.PWRON_RESET):
        return "PWRON_RESET"
    elif wake_reason == machine.HARD_RESET:
        return "HARD_RESET"
    elif wake_reason == machine.WDT_RESET:
        return "WDT_RESET"
    elif wake_reason == machine.DEEPSLEEP_RESET:
        return "DEEPSLEEP_RESET"
    elif wake_reason == machine.SOFT_RESET:
        return "SOFT_RESET"
    elif wake_reason == machine.PIN_WAKE:
        return "PIN_WAKE"
    else:
        return "Unknown reason"

 
def mqtt_whatsup():
    global wlan
    global mqttc
    global TOPIC_PUB
    
    if(wlan.isconnected):
        message = make_mqtt_response("WHATS-UP", "REQ")
        print("Publishing WHATSUP message " + message)
        try:
            mqttc.publish(TOPIC_PUB, message)
        except OSError:
            print('MQTT publish oops')
    else:
        print("WLAN not connected (WHATSUP)")

wdt = WDT(timeout = TIME_WATCHDOG)
wdt.feed()

push_button = Pin(PIN_BUTTON, Pin.IN, Pin.PULL_UP)
button_state = push_button.value()
button_state_last = button_state

f = open("secrets.json", 'r')
secrets = json.load(f)
f.close()

with open('wake_reason.txt', 'a') as outfile:
    wake_reason = machine.wake_reason()
    outfile.write(get_wake_up_reason(wake_reason) + " (" + str(wake_reason) + ')\n')
    outfile.close()

file_config = open("config.json", 'r')
config = json.load(file_config)
file_config.close()

print("Config", config)

WIFI_SSID = secrets["wifi"]["ssid"]
WIFI_PASSWORD = secrets["wifi"]["pass"]

MQTT_SERVER = secrets["mqtt"]["server"]
MQTT_PORT = secrets["mqtt"]["port"]
MQTT_USER = secrets["mqtt"]["user"]
MQTT_PASSWORD = secrets["mqtt"]["pass"]
mqtt_message_id = 1

mode = MODE_MANUAL
mode_last = MODE_MANUAL

connect_counter = 0

tm_mode_check = Timer()
tm_wifi = Timer()
tm_mqtt_check = Timer()
tm_whatsup = Timer()
tm_water_flow = Timer()
tm_watering_update = Timer()
tm_led = Timer()
tm_watering_again = Timer()
tm_planned_restart = Timer()

np = neopixel.NeoPixel(machine.Pin(2), 1)

print("Mode:", str(mode))

tm_mode_check.set(TIME_MODE_CHANGE_CHECK)
tm_wifi.set(TIME_WIFI)
tm_mqtt_check.set(TIME_MQTT_CHECK)
tm_whatsup.set(0)
tm_water_flow.set(TIME_WATER_FLOW_MAX)
tm_watering_update.set(TIME_WATERING_UPDATE)
tm_led.set(TIME_LED_BLINK_OFF)
tm_watering_again.set(TIME_WATER_AGAIN)
tm_planned_restart.set(TIME_PLANNED_RESTART)

rgb_update(1, 0, 0)
      
pin_water_sensor = Pin(PIN_ADC, Pin.IN)
pin_pump = Pin(PIN_PUMP, Pin.OUT)

pin_pump.value(0)

water_sensor = ADC(pin_water_sensor)
water_sensor.atten(ADC.ATTN_11DB)
watering_value = water_sensor.read()

print("Water ADC: " + str((water_sensor.read())) + " / " + str(config["thresold"]))

print("Client id: " + CLIENT_NAME)

wifi_connect()
wlan_connected_last = not wlan.isconnected()

mqttc = MQTTClient(CLIENT_NAME, BROKER_ADDR, keepalive=60, port=MQTT_PORT, user=MQTT_USER, password=MQTT_PASSWORD)

while True:
   
    if(tm_wifi.timeout()):
        tm_wifi.set(3000)
        
        if(wlan_connected_last != wlan.isconnected()):
            print("Wifi connection changed to " + str(wlan.isconnected()))
            wlan_connected_last = wlan.isconnected()

            if(wlan.isconnected()):
                rgb_update(0, 1, 0)
                print("Wifi connected: " + wlan.ifconfig()[0])
                
                mqttc.set_callback(mqtt_receive_callback)
                mqttc.connect()
                mqttc.subscribe(topic=TOPIC_SUB)
                print("Subscribed to ", TOPIC_SUB)
            else:
                connect_counter += 1
                wifi_connect()
                rgb_update(1, 0, 0)
    
    if(tm_mode_check.timeout()):
        tm_mode_check.set(TIME_MODE_CHECK)
        
        if(tm_watering_update.timeout()):
            tm_watering_update.set(TIME_WATERING_UPDATE)
            watering_value = (water_sensor.read())
            print("ADC measure: " + str(watering_value) + " / " + str(config["thresold"]))
    
        if(mode == MODE_AUTO):
            do_mode_auto()
                
        elif(mode == MODE_STOP):
            do_mode_stop()
            
        elif (mode == MODE_MANUAL):
            do_mode_manual()

    if(tm_whatsup.timeout()):
        tm_whatsup.set(TIME_WHATSUP)
        if(wlan.isconnected()):
            mqtt_whatsup()

    if(tm_mqtt_check.timeout()):
        tm_mqtt_check.set(TIME_MQTT_CHECK_MSG)
        if(wlan.isconnected()):
            mqttc.check_msg()
                
    if(tm_led.timeout()):
        if(np[0] == (0, 0, 0)):
            if(mode == MODE_MANUAL):
                rgb_update(1, 0, 1)
            else:
                rgb_update(0, 0, 1)
                
            tm_led.set(TIME_LED_BLINK_ON)
        else:
            tm_led.set(TIME_LED_BLINK_OFF)
            rgb_update(0, 0, 0)
            
    button_state = push_button.value()
    if(button_state_last != button_state):
        button_state_last = button_state
        if(button_state == True):
            print("Button released")
        else:
            print("Button pressed")
            if mode == MODE_MANUAL:
                mode = MODE_AUTO
            elif(mode == MODE_AUTO):
                mode = MODE_STOP
            elif(mode == MODE_STOP):
                mode = MODE_MANUAL
                
    if(tm_planned_restart.timeout()):
        print("Doing planned restart...")
        with open('restarts.txt', 'a') as outfile:
            outfile.write("Planned restart\n")
        machine.reset()
        
    wdt.feed()
