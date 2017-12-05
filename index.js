var http = require('http');
var request = require("request");
var pollingtoevent = require('polling-to-event');
var deviceType = require("./DeviceType.json");
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    console.log("morelinks homebridge API version: " + homebridge.version);

    // Accessory must be created from PlatformAccessory Constructor
    Accessory = homebridge.platformAccessory;

    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    // console.log(Accessory,Service,Characteristic,UUIDGen);
    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerPlatform("homebridge-morelinks", "morelinks", SamplePlatform, true);
    homebridge.registerAccessory("homebridge-morelinks", "morelinks", HttpAccessory);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function SamplePlatform(log, config, api) {
    log("MoreLinks Platform Init");
    var platform = this;
    this.log = log;
    this.config = config;
    this.accessories = [];

    this.requestServer = http.createServer(function(request, response) {
        if (request.url === "/add") {
            this.addAccessory(new Date().toISOString());
            response.writeHead(204);
            response.end();
        }

        if (request.url == "/reachability") {
            this.updateAccessoriesReachability();
            response.writeHead(204);
            response.end();
        }

        if (request.url == "/remove") {
            this.removeAccessory();
            response.writeHead(204);
            response.end();
        }
    }.bind(this));

    this.requestServer.listen(18081, function() {
        platform.log("Server Listening...");
    });

    if (api) {
        // Save the API object as plugin needs to register new accessory via this object
        this.api = api;

        // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
        // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
        // Or start discover new accessories.
        this.api.on('didFinishLaunching', function() {
            platform.log("DidFinishLaunching");
        }.bind(this));
    }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
SamplePlatform.prototype.configureAccessory = function(accessory) {
    this.log(accessory.displayName, "Configure Accessory");
    var platform = this;

    // Set the accessory to reachable if plugin can currently process the accessory,
    // otherwise set to false and update the reachability later by invoking
    // accessory.updateReachability()
    accessory.reachable = true;

    accessory.on('identify', function(paired, callback) {
        platform.log(accessory.displayName, "Identify!!!");
        callback();
    });

    if (accessory.getService(Service.Lightbulb)) {
        accessory.getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                platform.log(accessory.displayName, "Light -> " + value);
                callback();
            });
    }

    this.accessories.push(accessory);
}

// Handler will be invoked when user try to config your plugin.
// Callback can be cached and invoke when necessary.
SamplePlatform.prototype.configurationRequestHandler = function(context, request, callback) {
    this.log("Context: ", JSON.stringify(context));
    this.log("Request: ", JSON.stringify(request));

    // Check the request response
    if (request && request.response && request.response.inputs && request.response.inputs.name) {
        this.addAccessory(request.response.inputs.name);

        // Invoke callback with config will let homebridge save the new config into config.json
        // Callback = function(response, type, replace, config)
        // set "type" to platform if the plugin is trying to modify platforms section
        // set "replace" to true will let homebridge replace existing config in config.json
        // "config" is the data platform trying to save
        callback(null, "platform", true, {"platform":"morelinks", "otherConfig":"SomeData"});
        return;
    }

    // - UI Type: Input
    // Can be used to request input from user
    // User response can be retrieved from request.response.inputs next time
    // when configurationRequestHandler being invoked

    var respDict = {
        "type": "Interface",
        "interface": "input",
        "title": "Add Accessory",
        "items": [
            {
                "id": "name",
                "title": "Name",
                "placeholder": "Fancy Light"
            }//,
            // {
            //   "id": "pw",
            //   "title": "Password",
            //   "secure": true
            // }
        ]
    }

    // - UI Type: List
    // Can be used to ask user to select something from the list
    // User response can be retrieved from request.response.selections next time
    // when configurationRequestHandler being invoked

    // var respDict = {
    //   "type": "Interface",
    //   "interface": "list",
    //   "title": "Select Something",
    //   "allowMultipleSelection": true,
    //   "items": [
    //     "A","B","C"
    //   ]
    // }

    // - UI Type: Instruction
    // Can be used to ask user to do something (other than text input)
    // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

    // var respDict = {
    //   "type": "Interface",
    //   "interface": "instruction",
    //   "title": "Almost There",
    //   "detail": "Please press the button on the bridge to finish the setup.",
    //   "heroImage": "base64 image data",
    //   "showActivityIndicator": true,
    // "showNextButton": true,
    // "buttonText": "Login in browser",
    // "actionURL": "https://google.com"
    // }

    // Plugin can set context to allow it track setup process
    context.ts = "Hello";

    // Invoke callback to update setup UI
    callback(respDict);
}

// Sample function to show how developer can add accessory dynamically from outside event
SamplePlatform.prototype.addAccessory = function(accessoryName) {
    this.log("Add Accessory");
    var platform = this;
    var uuid;

    uuid = UUIDGen.generate(accessoryName);

    var newAccessory = new Accessory(accessoryName, uuid);
    newAccessory.on('identify', function(paired, callback) {
        platform.log(accessory.displayName, "Identify!!!");
        callback();
    });
    // Plugin can save context on accessory to help restore accessory in configureAccessory()
    // newAccessory.context.something = "Something"

    // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
    newAccessory.addService(Service.Lightbulb, "Test Light")
        .getCharacteristic(Characteristic.On)
        .on('set', function(value, callback) {
            platform.log(accessory.displayName, "Light -> " + value);
            callback();
        });

    this.accessories.push(newAccessory);
    this.api.registerPlatformAccessories("homebridge-morelinks", "morelinks", [newAccessory]);
}

SamplePlatform.prototype.updateAccessoriesReachability = function() {
    this.log("Update Reachability");
    for (var index in this.accessories) {
        var accessory = this.accessories[index];
        accessory.updateReachability(false);
    }
}

// Sample function to show how developer can remove accessory dynamically from outside event
SamplePlatform.prototype.removeAccessory = function() {
    this.log("Remove Accessory");
    this.api.unregisterPlatformAccessories("homebridge-morelinks", "morelinks", this.accessories);

    this.accessories = [];
}

function HttpAccessory(log, config)
{
    this.index = 0;
    this.log = log;
    this.log('http Index:',this.index);
    this.index++;

    // Accessory Information
    this.service               = undefined;
    this.serviceName           = config["service"]          || "Switch";
    this.manufacturer          = config["manufacturer"]     || "Unknown";
    this.model                 = config["model"]            || "Unknown";
    this.serial                = config["serial"]           || "Unknown";
    this.refresh_interval      = config["refresh_interval"] || 300;
    this.http_method           = config["http_method"] 	  	|| "GET";
    this.username              = config["username"] 	    || "";
    this.password              = config["password"]         || "";
    this.sendimmediately       = config["sendimmediately"]  || "";
    this.base_url              = config["base_url"];
    this.name                  = config["name"];
    this.request_power_url     = "";
    this.request_brightness_url= "";
    this.request_fanspeed_url  = "";
    this.request_thermostat_url= "";
    this.request_lockstatus_url= "";
    this.request_garagedoor_url= "";
    this.request_temperature_url= "";
    this.request_mode_url       = "";
    this.request_currenttemp_url= "";
    this.request_curtainstatus_url_open = "";
    this.request_curtainstatus_url_close = "";
    this.request_curtainposition_url = "";
    this.set_power_url         = "";
    this.set_brightness_url    = "";
    this.set_fanspeed_url      = "";
    this.set_thermostat_url    = "";
    this.set_lockstatus_url    = "";
    this.set_garagedoor_url    = "";
    this.set_temperature_url   = "";
    this.set_curtainstatus_url_open = "";
    this.set_curtainstatus_url_close = "";
    this.set_mode_url          = "";
    this.switch                = "";
    this.switchon              = "";
    this.switchstop            = "";
    this.brightnessmin         = "";
    this.colornum              = "";
    this.fanspeednum           = "";
    this.modecool              = "";
    this.modeheat              = "";
    this.modedry               = "";
    this.modefan               = "";
    this.modeauto              = "";
    this.temperaturenum        = "";
    this.fanspeednum           = "";
    this.swing_modehorizon     = "";
    this.swing_modehorizonoff  = "";
    this.swing_modevertical    = "";
    this.swing_modeverticaloff = "";

    this.getfanspeedlever    = 0;
    this.getpowerstatus      = false;
    this.getbrightnesslever  = 0;
    this.gettemperaturelever = 0;
    this.getmodelever        = 0;
    this.getcurtainlever     = 0;
    this.getlockstatus       = false;
    this.getgaragedoorstatus = false;
    this.gettemperature      = 16;
    this.setfanspeedlever    = 0;
    this.setpowerstatus      = false;
    this.setbrightnesslever  = 0;
    this.settemperaturelever = 16;
    this.setmodelever        = 0;
    this.setcurtainlever     = 0;
    this.setlockstatus       = false;
    this.setgaragedoorstatus = false;
    this.settemperature      = 16;

    this.enableSet = true;


    var that = this;

    switch (this.serviceName){
        case "Curtain":
            this.switchon   = deviceType[this.serviceName].switchon;
            this.switchoff  = deviceType[this.serviceName].switchoff;
            this.switchstop = deviceType[this.serviceName].switchstop;
            this.position   = deviceType[this.serviceName].position;

            this.request_curtainstatus_url_open  = this.base_url + "/get/" + this.switchon;
            this.request_curtainstatus_url_close = this.base_url + "/get/" + this.switchoff;
            this.set_curtainstatus_url_open      = this.base_url + "/set/" + this.switchon;
            this.set_curtainstatus_url_close     = this.base_url + "/set/" + this.switchoff;
            this.request_curtainposition_url     = this.base_url + "/get/" + this.position;
            // this.getStatus(this.serviceName,this.curtainService,this.request_power_url);

            break;
        case "Light":
            this.switchon  = deviceType[this.serviceName].switchon;
            this.switchoff = deviceType[this.serviceName].switchoff;
            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.lightService,this.request_power_url);
            break;
        case "Dimmer":
            this.switchon      = deviceType[this.serviceName].switchon;
            this.switchoff     = deviceType[this.serviceName].switchoff;
            this.brightnessnum = deviceType[this.serviceName].brightnessnum;
            this.set_brightness_url = this.base_url + "/set/" + this.brightnessnum + "/%n";

            this.request_dimmerpower_url = this.base_url + "/get/" + this.switchon;
            this.set_dimmerpower_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.dimmerService,this.request_power_url);
            this.request_brightness_url = this.base_url + "/get/" + this.brightnessnum;
            // this.getBrightness(this.serviceName,this.dimmerService,this.request_brightness_url);
            
            break;
        case "Outlet":
            this.switchon  = deviceType[this.serviceName].switchon;
            this.switchoff = deviceType[this.serviceName].switchoff;
            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.outletService,this.request_power_url);
            break;
        case "Switch":
            this.switchon    = deviceType[this.serviceName].switchon;
            this.switchoff   = deviceType[this.serviceName].switchoff;
            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.switchService,this.request_power_url);
            break;
        case "Doorbell":
            break;
        case "TV":
            break;
        case "Fan":
            this.switchon  = deviceType[this.serviceName].switchon;
            this.switchoff = deviceType[this.serviceName].switchoff;
            this.fanspeednum = deviceType[this.serviceName].fanspeednum;

            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.request_fanspeed_url = this.base_url + "/get/" + this.fanspeednum;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;
            this.set_fanspeed_url     = this.base_url + "/set/" + this.fanspeednum;

            break;
        case "Motion":
            break;
        case "AC":
            this.switchon       = deviceType[this.serviceName].switchon;
            this.switchoff      = deviceType[this.serviceName].switchoff;
            this.mode           = deviceType[this.serviceName].mode;
            this.fanspeednum    = deviceType[this.serviceName].fanspeednum;
            this.temperaturenum = deviceType[this.serviceName].temperaturenum;
            this.currenttempnum = deviceType[this.serviceName].currenttempnum;

            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;

            this.request_fanspeed_url = this.base_url + "/get/" + this.fanspeednum;
            this.set_fanspeed_url     = this.base_url + "/set/" + this.fanspeednum;


            this.request_mode_url        = this.base_url + "/get/" + this.mode;
            this.set_mode_url            = this.base_url + "/set/" + this.mode;
            this.request_temperature_url = this.base_url + "/get/" + this.temperaturenum;
            this.set_temperature_url     = this.base_url + "/set/" + this.temperaturenum + "/%n";
            this.request_currenttemp_url = this.base_url + "/get/" + this.currenttempnum;
            // this.getStatus(this.serviceName,this.acService,this.request_power_url);

            break;
        case "Thermostat":
            this.switchon       = deviceType[this.serviceName].switchon;
            this.switchoff      = deviceType[this.serviceName].switchoff;
            this.modecool       = deviceType[this.serviceName].modecool;
            this.modeheat       = deviceType[this.serviceName].modeheat;
            this.modeauto       = deviceType[this.serviceName].modeauto;
            this.currenttempnum = deviceType[this.serviceName].currenttempnum;

            this.request_power_url       = this.base_url + "/get/" + this.switchon;
            this.set_power_url           = this.base_url + "/set/" + this.switchon;
            this.request_thermostat_url  = this.base_url + "/get/" + this.switchon;
            this.set_thermostat_url      = this.base_url + "/set/" + this.switchon;
            this.request_temperature_url = this.base_url + "/get/" + this.temperaturenum;
            this.set_temperature_url     = this.base_url + "/set/" + this.temperaturenum + "/%n";
            this.request_currenttemp_url = this.base_url + "/get/" + this.currenttempnum;
            // this.getStatus(this.serviceName,this.thermostatService,this.request_power_url);

            break;
        case "GarageDoor":
            this.switchon  = deviceType[this.serviceName].switchon;
            this.switchoff = deviceType[this.serviceName].switchoff;
            this.request_power_url = this.base_url + "/get/" + this.switchon;
            this.set_power_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.doorService,this.request_power_url);

            break;
        case "Security":
            break;
        case "Lock":
            this.switchon  = deviceType[this.serviceName].switchon;
            this.switchoff = deviceType[this.serviceName].switchoff;

            this.request_lockstatus_url = this.base_url + "/get/" + this.switchon;
            this.set_lockstatus_url     = this.base_url + "/set/" + this.switchon;
            // this.getStatus(this.serviceName,this.lockService,this.request_power_url);

            break;
        case "FloorHeater":
            this.switchon        = deviceType[this.serviceName].switchon;
            this.switchoff       = deviceType[this.serviceName].switchoff;
            this.temperaturenum  = deviceType[this.serviceName].temperaturenum;
            this.currenttempnum  = deviceType[this.serviceName].currenttempnum;

            this.request_power_url       = this.base_url + "/get/" + this.switchon;
            this.set_floorheater_url     = this.base_url + "/set/" + this.switchon;
            this.request_temperature_url = this.base_url + "/get/" + this.temperaturenum;
            this.set_temperature_url     = this.base_url + "/set/" + this.temperaturenum + "/%n";
            this.request_currenttemp_url = this.base_url + "/get/" + this.currenttempnum;

            break;
        case "Window":
            break;
    }
}

HttpAccessory.prototype =
    {
        httpRequest: function(url, body, method, username, password, sendimmediately, callback)
        {
            var sig = body;
            var signed = url;
            if( sig !== undefined && sig !== null && sig != "null" && sig.length > 0 && sig.length < 50 && !error )
                signed = signed + "?" + sig;

            request({
                    url: signed,
                    body: body,
                    method: method,
                    rejectUnauthorized: false,
                    auth: {
                        user: username,
                        pass: password,
                        sendImmediately: sendimmediately
                    }
                },
                function(error, response, body)
                {
                    callback(error, response, body)
                })
        },

        setSecurityState: function(newState, callback)
        {
            var that = this;
            if (this.enableSet == true)
            {
                if (!this.state_url)
                {
                    this.log.warn("Ignoring request; No security state url defined.");
                    callback(new Error("No security state url defined."));
                    return;
                }

                this.secTarState = newState;

                setTimeout(function() {
                    var url;
                    var body;

                    url = that.state_url.replace("%s", that.secTarState);
                    // that.log("Setting new security state: "+url);

                    that.httpRequest(url, body, that.http_method, that.username, that.password, that.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                that.log('HTTP set security state function failed: %s', error.message);
                                callback(error);
                            }
                            else
                            {
                                // that.log('HTTP set security state function succeeded!');
                                callback();
                            }
                        }.bind(that));
                },1000);
            }
            else
            {
                callback();
            }
        },

        setPowerState: function(powerOn, callback)
        {
            var that = this;


            if (this.set_power_url && (powerOn != undefined ))
            {
                var url;
                var body;
                this.setpowerstatus = powerOn;

                if (powerOn)
                {
                    url = this.set_power_url + "/true";
                    body = "";
                    // this.log("Setting power state to on",powerOn);
                }
                else
                {
                    url = this.set_power_url + "/false";
                    body = "";
                    // this.log("Setting power state to off",powerOn);
                }

                this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately,
                    function(error, response, responseBody)
                    {
                        if (error)
                        {
                            this.log('HTTP set power function failed: %s,%s', error.message);
                            callback(error);
                        }
                        else
                        {
                            // this.log('HTTP set power function succeeded!',this.serviceName,responseBody);
                            callback();
                        }
                    }.bind(this));
            }
            else
            {
                callback(null);
            }
        },

        setDimmerState: function(powerOn, callback)
        {
            var that = this;


            if (this.set_dimmerpower_url && (powerOn != undefined ))
            {
                var url;
                var body = "";
                this.setpowerstatus = powerOn;

                if (!powerOn)
                {
                    url = that.set_brightness_url.replace("%n", 0);

                this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately,
                    function(error, response, responseBody)
                    {
                        if (error)
                        {
                            this.log('HTTP set power function failed: %s,%s', error.message);
                            callback(error);
                        }
                        else
                        {
                            // this.log('HTTP set power function succeeded!',this.serviceName,responseBody);
                            callback();
                        }
                    }.bind(this));

                }else
                {
                    // url = this.set_dimmerpower_url + "/true";
                    // body = "";
                    if(this.getpowerstatus == false){


                    if(this.getbrightnesslever == 0){
                        this.getbrightnesslever = 100;
                    }

                    url = that.set_brightness_url.replace("%n", this.getbrightnesslever);
                    this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP set power function failed: %s,%s', error.message);
                                callback(error);
                            }
                            else
                            {
                                // this.log('HTTP set power function succeeded!',this.serviceName,responseBody);
                                callback();
                            }
                        }.bind(this));
                    }else {
                        callback();
                    }
                }

            }
            else
            {
                callback();
            }
        },

        setFanSpeed: function(fanSpeed, callback)
        {
            var that = this;

            if (fanSpeed != undefined )
            {
                var url;
                var body;

                // 低速 0/中速 1/高速 2/自动 3

                if(fanSpeed < 26){
                    url = this.set_fanspeed_url + "/0";
                }

                if(fanSpeed > 25 && fanSpeed < 51){
                    url = this.set_fanspeed_url + "/1";
                }

                if(fanSpeed > 75){
                    url = this.set_fanspeed_url + "/2";
                }

                if(fanSpeed == 75){
                    url = this.set_fanspeed_url + "/3";
                }

                    body = ""
                    // this.log("Setting fan speed to %s",fanSpeed,url,this.http_method);

                this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately,
                    function(error, response, responseBody)
                    {
                        if (error)
                        {
                            this.log('HTTP set fan speed function failed: %s,%s', error.message);
                            // callback();
                            callback(error);
                        }
                        else
                        {
                            // this.log('HTTP set fan speed function succeeded!',responseBody);
                            callback();
                        }
                    }.bind(this));
            }
            else
            {
                callback();
            }
        },

        setACFanSpeed : function (fanSpeed, callback) {
            var that = this;

            if (fanSpeed != undefined )
            {
                var url;
                var body;

                // 低速 0/中速 1/高速 2/自动 3

                if(fanSpeed < 26){
                    url = this.set_fanspeed_url + "/0";
                }

                if(fanSpeed > 25 && fanSpeed < 51){
                    url = this.set_fanspeed_url + "/1";
                }

                if(fanSpeed > 75){
                    url = this.set_fanspeed_url + "/2";
                }

                if(fanSpeed == 75){
                    url = this.set_fanspeed_url + "/3";
                }

                body = ""
                // this.log("Setting fan speed to %s",fanSpeed,url,this.http_method);

                this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately,
                    function(error, response, responseBody)
                    {
                        if (error)
                        {
                            this.log('HTTP set fan speed function failed: %s,%s', error.message);
                            // callback();
                            callback(error);
                        }
                        else
                        {
                            // this.log('HTTP set fan speed function succeeded!',responseBody);

                            callback();
                        }
                    }.bind(this));
            }
            else
            {
                callback();
            }
        },

        setBrightness: function(level, callback)
        {
            var that = this;

                if (this.set_brightness_url)
                {
                    // that.log.warn('that.getpowerstatus:',that.getpowerstatus,that.getbrightnesslever)
                    var url
                    if(that.getpowerstatus == false && (level == 100)){
                        url = that.set_brightness_url.replace("%n", this.getbrightnesslever);
                    }else {
                        url = that.set_brightness_url.replace("%n", level);
                    }

                    // url = that.set_brightness_url.replace("%n", level);

                    // that.log("Setting brightness to %s", level,url);

                    that.httpRequest(url, "", that.http_method, that.username, that.password, that.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                that.log('HTTP brightness function failed: %s', error);
                                callback(error);
                            }
                            else
                            {
                                // that.log('HTTP brightness function succeeded!',body);
                                // that.dimmerService.getCharacteristic(Characteristic.Brightness).setValue(parseInt(body));
                                callback();
                            }
                        });
                }else {
                    this.log.warn("Ignoring request; No brightness url defined.");
                    callback(new Error("No brightness url defined."));
                }
        },

        setCurtainState : function (level, callback) {
            var that = this;

            if (this.set_curtainstatus_url_open)
            {
                // that.log.warn('that.getpowerstatus:',that.getpowerstatus,that.getbrightnesslever)
                var url
                if(level > 50){
                    url = that.set_curtainstatus_url_open + '/true';
                    // that.log("Setting curtain to open",url);
                }else {
                    url = that.set_curtainstatus_url_close + '/true';
                    // that.log("Setting curtain to close",url);
                }

                that.httpRequest(url, "", that.http_method, that.username, that.password, that.sendimmediately,
                    function(error, response, body)
                    {
                        if (error)
                        {
                            that.log('HTTP curtain function failed: %s', error);
                            callback(error);
                        }
                        else
                        {
                            // that.log('HTTP curtain function succeeded!',body);
                            // if(level > 0){
                            //     that.curtainService.setCharacteristic(Characteristic.TargetPosition,level);
                            //
                            // }else {
                            //     that.curtainService.setCharacteristic(Characteristic.TargetPosition,0);
                            //
                            // }
                            callback();
                        }
                    });
            }else {
                this.log.warn("Ignoring request; No curtain url defined.");
                callback(new Error("No curtain url defined."));
            }
        },

        setLockState: function(lockstatus, callback)
        {
            var that = this;



            if (this.set_lockstatus_url)
            {

                var url;
                var body;

            if (lockstatus == Characteristic.LockTargetState.UNSECURED)
            {
                url = this.set_lockstatus_url + "/true";
                body = "";
                // this.log("Setting lock state to on",lockstatus);
            }
            else
            {
                url = this.set_lockstatus_url + "/false";
                body = "";
                // this.log("Setting lock state to off",lockstatus);
            }
            that.httpRequest(url, "", that.http_method, that.username, that.password, that.sendimmediately,
                function(error, response, body)
                {
                    if (error)
                    {
                        that.log('HTTP lock function failed: %s', error);
                        callback(error);
                    }
                    else
                    {
                        // that.log('HTTP lock function succeeded!',body);

                        if(lockstatus == Characteristic.LockTargetState.UNSECURED){
                            that.setlockstatus = false;
                            that.lockService
                                .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);

                        }else {
                            that.setlockstatus = true;
                            that.lockService
                                .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);

                        }
                        callback();
                    }
                });
            }else {
                this.log.warn("Ignoring request; No lock url defined.");
                callback("No lock url defined.");
            }

        },

        setGarageDoorState : function (lockstatus, callback) {
            var that = this;



            if (this.set_garagedoor_url)
            {

                var url;
                var body;

                if (lockstatus == Characteristic.TargetDoorState.OPEN)
                {
                    url = this.set_garagedoor_url + "/true";
                    body = "";
                    // this.log("Setting lock state to on",lockstatus);
                }
                else
                {
                    url = this.set_garagedoor_url + "/false";
                    body = "";
                    // this.log("Setting lock state to off",lockstatus);
                }
                that.httpRequest(url, "", that.http_method, that.username, that.password, that.sendimmediately,
                    function(error, response, body)
                    {
                        if (error)
                        {
                            that.log('HTTP garage door function failed: %s', error);
                            callback(error);
                        }
                        else
                        {
                            // that.log('HTTP garage door function succeeded!',body);

                            if(lockstatus == Characteristic.TargetDoorState.OPEN){
                                that.setgaragedoorstatus = true;
                                that.lockService
                                    .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);

                            }else {
                                that.setgaragedoorstatus = false;
                                that.lockService
                                    .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);

                            }
                            callback();
                        }
                    });
            }else {
                this.log.warn("Ignoring request; No lock url defined.");
                callback("No lock url defined.");
            }
        },

        setFloorHeaterStatus:function (state, callback) {
            var that = this;
            var url,body;

            if( state == Characteristic.TargetHeatingCoolingState.OFF )
            {
                url = this.set_floorheater_url + '/false';
            }
            else
            {
                url = this.set_floorheater_url + '/true';
            }

            // this.log("Setting hvac mode to ", url);

            this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                function(error, response, body)
                {
                    if( error )
                    {
                        this.log('HTTP floorheater mode function failed: %s', error);
                        callback(error);
                    }
                    else
                    {
                        // this.log('HTTP floorheater mode function succeeded!',body);

                        // switch (state){
                        //     case Characteristic.TargetHeatingCoolingState.OFF:
                        //         that.floorHeaterService.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.OFF);
                        //         this.getmodelever = Characteristic.CurrentHeatingCoolingState.OFF;
                        //         break;
                        //     case Characteristic.TargetHeatingCoolingState.HEAT:
                        //         that.floorHeaterService.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.HEAT);
                        //         break;
                        //     case Characteristic.TargetHeatingCoolingState.COOL:
                        //         that.floorHeaterService.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.COOL);
                        //         break;
                        // }

                        callback();
                    }
                }.bind(this));
        },

        setThermostatTargetHeatingCoolingState: function(state, callback)
        {
            // 送风 0/制热 1/制冷 2/自动 3/除湿 7
            var that = this;
            var url = undefined,powerurl = undefined,fanurl = undefined,body;

            switch (state){
                case Characteristic.TargetHeatingCoolingState.HEAT:
                    url = this.set_mode_url + '/1';
                    powerurl = this.set_power_url + '/true';
                    break;
                case Characteristic.TargetHeatingCoolingState.COOL:
                    url = this.set_mode_url + '/2';
                    powerurl = this.set_power_url + '/true';
                    break;
                case Characteristic.TargetHeatingCoolingState.AUTO:
                    url = this.set_mode_url + '/3';
                    powerurl = this.set_power_url + '/true';
                    break;
                case Characteristic.TargetHeatingCoolingState.OFF:
                    powerurl = this.set_power_url + '/false';
                    fanurl = that.set_fanspeed_url + '/0';
                    break;
            }


            if(url){
                // this.log("Setting AC mode to ", url);

                this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                    function(error, response, body)
                    {
                        if( error )
                        {
                            this.log('HTTP AC power function failed: %s', error);
                            callback(error);
                            return;
                        }else {
                            // callback();
                        }
                    }.bind(this));

            }


            if(powerurl){
                this.httpRequest(powerurl, "", "GET", this.username, this.password, this.sendimmediately,
                    function(error, response, body)
                    {
                        if( error )
                        {
                            this.log('HTTP AC power function failed: %s', error);
                            callback(error);
                        }else {
                            callback();
                        }
                    }.bind(this));
            }else{
                callback();
            }

        },

        setThermostatTargetTemp: function(temp, callback)
        {
            var that = this;
            if( this.set_temperature_url )
            {
                var url;


            if( temp <16 ){
                temp = 16;
            }

                if( temp >35 )
                    temp = 35;

                url = this.set_temperature_url.replace("%n", temp)

            this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                function(error, response, body)
                {
                    if( error )
                    {
                        this.log('HTTP Target Temp function failed: %s', error);
                        callback(error);
                    }
                    else
                    {
                        // this.log('HTTP Target Temp function succeeded!');
                        callback();
                    }
                }.bind(this));
            }else{
                callback();
            }
        },

        getStatus: function (servicename,service,url) {
            var that = this;
            if(service){
                this.statusemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get power function failed: %s', error.message,url);
                                // return;
                                done(null,undefined);
                            }
                            else
                            {
                                // this.log(servicename, "received power",url, "state is currently", body);
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"statuspoll"
                });

                this.statusemitter.on("statuspoll",function(data){
                        // console.log(data);
                        if(data){

                            this.getpowerstatus = data;

                            // this.log("received power",url, "state is currently", this.getpowerstatus);
                                    // this.enableSet = false;
                                    if(data.toString().toLowerCase() == 'true'){
                                        service.setCharacteristic(Characteristic.On,true);
                                    }else {
                                        service.setCharacteristic(Characteristic.On,false);
                                    }
                        }
                    }.bind(this));

                this.statusemitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("service not init")
            }

        },
        
        getFloorHeaterStatus : function (servicename,service,url) {
            var that = this;
            if(service){
                this.floorheaterstatusemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get floorheater power function failed: %s', error.message,url);
                                // return;
                                done(null,undefined);
                            }
                            else
                            {
                                // this.log(servicename, "received power",url, "state is currently", body);
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"floorheaterstatuspoll"
                });

                this.floorheaterstatusemitter.on("floorheaterstatuspoll",function(data){
                    // console.log(data);
                    if(data){

                        // this.getpowerstatus = data;
                        // this.enableSet = false;
                        if(data.toString().toLowerCase() == 'true'){
                            // service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(Characteristic.CurrentHeatingCoolingState.HEAT);
                            service.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.HEAT);
                            // this.getmodelever = Characteristic.CurrentHeatingCoolingState.HEAT;
                            // this.log("received floorheater mode",url, "state is currently", Characteristic.TargetHeatingCoolingState.HEAT);
                        }else {
                            // this.getmodelever = Characteristic.CurrentHeatingCoolingState.OFF;
                            // this.log("received floorheater mode",url, "state is currently", Characteristic.TargetHeatingCoolingState.OFF);
                            // service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).setValue(Characteristic.CurrentHeatingCoolingState.OFF);
                            service.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.OFF);
                        }
                    }
                }.bind(this));

                this.floorheaterstatusemitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("service not init")
            }
        },

        getBrightness : function (servicename,service,url) {
            if(service){
                var that = this;
            this.brightnessemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP get brightness function failed : %s', error.message);
                                // return;
                                done(null, undefined);
                            }
                            else
                            {
                                done(null, responseBody);
                            }
                        }.bind(this)) // set longer polling as slider takes longer to set value
                }.bind(this), {longpolling:true,interval:that.refresh_interval,longpollEventName:"brightnesspoll"});

            this.brightnessemitter.on("brightnesspoll",
                    function(data)
                    {
                        if(data){
                            var currentlevel = parseInt(data);

                            if(currentlevel>0){
                                service.setCharacteristic(Characteristic.On,true);
                                // this.log(servicename, "received brightness",url, "level is currently", currentlevel);
                                service.setCharacteristic(Characteristic.Brightness,currentlevel);
                                this.getbrightnesslever = currentlevel;
                                this.getpowerstatus = true;
                            }else {
                                service.setCharacteristic(Characteristic.On,false);
                                this.getpowerstatus = false;
                            }
                        }

                    }.bind(this));
                 }
            },

        getFanSpeed : function (servicename,service,url) {

            if(service){
                var that = this;
                this.fanspeedemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP get power function failed: %s', error.message);
                                // return;
                                done(null, undefined);
                            }
                            else
                            {
                                done(null, responseBody);
                            }
                        }.bind(this)) // set longer polling as slider takes longer to set value
                }.bind(this), {longpolling:true,interval:that.refresh_interval,longpollEventName:"brightnesspoll"});

                this.fanspeedemitter.on("brightnesspoll",
                    function(data)
                    {
                        // console.log(data);
                        if(data){
                            var currentlevel = parseInt(data);
                            // 低速 0/中速 1/高速 2/自动 3
                            switch (currentlevel){
                                case 0:
                                    currentlevel = 25;
                                    break;
                                case 1:
                                    currentlevel = 50;
                                    break;
                                case 2:
                                    currentlevel = 100;
                                    break;
                                case 3:
                                    currentlevel = 75;
                                    break;
                            }
                            this.getfanspeedlever = currentlevel;

                            // console.log(data)
                            // this.log(servicename, "received fan speed",url, "level is currently", currentlevel);
                            service.setCharacteristic(Characteristic.RotationSpeed,currentlevel);
                        }

                    }.bind(this));
            }
        },

        getCurtainStatus : function (servicename,service,url) {
            if(service){
                var that = this;

                this.log.warn('url:',url);
                this.curtainemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP get curtain function failed : %s', error.message);

                                done(null, undefined);
                            }
                            else
                            {
                                done(null, responseBody);
                            }
                        }.bind(this)) // set longer polling as slider takes longer to set value
                }.bind(this), {longpolling:true,interval:that.refresh_interval,longpollEventName:"curtainpositionpoll"});

                this.curtainemitter.on("curtainpositionpoll",
                    function(data)
                    {
                        if(data){
                            var currentlevel = 100 - parseInt(data);
                            that.getcurtainlever = currentlevel;
                            // this.log(servicename, "received curtain",url, "level is currently", currentlevel);
                            service.setCharacteristic(Characteristic.CurrentPosition,currentlevel);
                        }

                    }.bind(this));
            }
        },

        getLockStatus : function (servicename,service,url) {
            var that = this;
            if(service){
                this.statusemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get lock function failed: %s', error.message,url);
                                // return;
                                done(null,undefined);
                            }
                            else
                            {
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"lockstatuspoll"
                });

                this.statusemitter.on("lockstatuspoll",function(data){
                    if(data){

                        this.getlockstatus = data;

                        // this.log("received lock",url, "state is currently", this.getlockstatus);
                        if(data.toString().toLowerCase() == 'true'){
                            service.setCharacteristic(Characteristic.LockCurrentState,Characteristic.LockCurrentState.UNSECURED);
                            service.setCharacteristic(Characteristic.LockTargetState,Characteristic.LockTargetState.UNSECURED);
                        }else {
                            service.setCharacteristic(Characteristic.LockCurrentState,Characteristic.LockCurrentState.SECURED);
                            service.setCharacteristic(Characteristic.LockTargetState,Characteristic.LockTargetState.SECURED);
                        }
                    }
                }.bind(this));

                this.statusemitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("lock service not init")
            }
        },

        getGarageDoorStatus : function (servicename,service,url) {
            var that = this;
            if(service){
                this.statusemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get Garage Door function failed: %s', error.message,url);
                                // return;
                                done(null,undefined);
                            }
                            else
                            {
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"garagedoorstatuspoll"
                });

                this.statusemitter.on("garagedoorstatuspoll",function(data){
                    if(data){

                        this.getgaragedoorstatus = data;

                        // this.log("received Garage Door",url, "state is currently", this.getgaragedoorstatus);
                        if(data.toString().toLowerCase() == 'true'){
                            service.setCharacteristic(Characteristic.CurrentDoorState,Characteristic.CurrentDoorState.OPEN);
                        }else {
                            service.setCharacteristic(Characteristic.CurrentDoorState,Characteristic.CurrentDoorState.CLOSED);
                        }
                    }
                }.bind(this));

                this.statusemitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("lock service not init")
            }
        },

        getThermostatTemp : function (servicename,service,url) {
            if(service){
                var that = this;
                this.thermostattempemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP get Target Temperature function failed : %s', error.message);
                                // return;
                                done(null, undefined);
                            }
                            else
                            {
                                done(null, responseBody);
                            }
                        }.bind(this)) // set longer polling as slider takes longer to set value
                }.bind(this), {longpolling:true,interval:that.refresh_interval,longpollEventName:"thermostattemppoll"});

                this.thermostattempemitter.on("thermostattemppoll",
                    function(data)
                    {
                        if(data){
                            var currentlevel = parseInt(data);
                            this.settemperaturelever = currentlevel;
                            // this.log(servicename, "received Target Temperature",url, "level is currently", currentlevel);
                            service.setCharacteristic(Characteristic.TargetTemperature,currentlevel);
                            // service.getCharacteristic(Characteristic.On).setValue(state);
                        }

                    }.bind(this));
            }
        },

        getCurrentTemp : function (servicename,service,url) {
            if(service){
                var that = this;
                this.currenttempemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, responseBody)
                        {
                            if (error)
                            {
                                this.log('HTTP get Current Temperature function failed : %s', error.message);
                                // return;
                                done(null, undefined);
                            }
                            else
                            {
                                done(null, responseBody);
                            }
                        }.bind(this)) // set longer polling as slider takes longer to set value
                }.bind(this), {longpolling:true,interval:that.refresh_interval,longpollEventName:"currenttemppoll"});

                this.currenttempemitter.on("currenttemppoll",
                    function(data)
                    {
                        if(data){
                            var currentlevel = parseInt(data);
                            this.gettemperaturelever = currentlevel;
                            // this.log(servicename, "received Current Temperature",url, "level is currently", currentlevel);
                            service.setCharacteristic(Characteristic.CurrentTemperature,currentlevel);
                            // service.getCharacteristic(Characteristic.On).setValue(state);
                        }

                    }.bind(this));
            }
        },

        getThermostatHeatingCoolingState : function (servicename,service,url) {
            var that = this;
            // 送风 0/制热 1/制冷 2/自动 3/除湿 7
            if(service){
                this.acemitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get ac mode function failed: %s', error.message,url);
                                done(null,undefined);
                            }
                            else
                            {
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"acpoll"
                });

                this.acemitter.on("acpoll",function(data){
                    // console.log(data);
                    if(data) {
                        try{
                            switch (parseInt(data)) {
                                case 1:
                                    service.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.HEAT);
                                    break;
                                case 2:
                                    service.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);
                                    break;
                                case 3:
                                case 0:
                                case 7:
                                    service.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.AUTO);
                                    break;

                            }
                        }catch (e){

                        }

                    }
                }.bind(this));

                this.acemitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("service not init")
            }
        },

        getACStatus : function (servicename,service,url) {
            var that = this;
            if(service){
                this.acpoweremitter = pollingtoevent(function(done)
                {
                    this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately,
                        function(error, response, body)
                        {
                            if (error)
                            {
                                this.log('HTTP get ac status function failed: %s', error.message,url);
                                done(null,undefined);
                            }
                            else
                            {
                                done(null, body);
                            }
                        }.bind(this))
                }.bind(this), {
                    longpolling:true,
                    interval:that.refresh_interval,
                    longpollEventName:"acpowerpoll"
                });

                this.acpoweremitter.on("acpowerpoll",function(data){
                    console.log(data);
                    if(data) {
                        try{
                            if(data.toString().toLowerCase() == 'false'){
                                that.getmodelever = 0;
                                service.setCharacteristic(Characteristic.TargetHeatingCoolingState,Characteristic.TargetHeatingCoolingState.OFF);
                                that.acfanService.setCharacteristic(Characteristic.On,false);
                            }else{
                                that.acfanService.setCharacteristic(Characteristic.On,true);
                            }
                        }catch (e){

                        }

                    }
                }.bind(this));

                this.acpoweremitter.on("err", function(err) {
                    console.log(err);
                });


            }else{
                this.log("service not init")
            }
        },

        identify: function(callback)
        {
            this.log("Identify requested!");
            callback(); // success
        },

        getServices: function()
        {
            var that = this;
            that.log('get ' + this.serviceName +' Services');

            // you can OPTIONALLY create an information service if you wish to override
            // the default values for things like serial number, model, etc.
            var informationService = new Service.AccessoryInformation();

            informationService
                .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
                .setCharacteristic(Characteristic.Model, this.model)
                .setCharacteristic(Characteristic.SerialNumber, this.serial);

            switch (this.serviceName)
            {
                case "Switch":
                {
                    this.switchService = new Service.Switch(this.name);
                    this.getStatus(this.serviceName,this.switchService,this.request_power_url);
                    this.switchService
                        .getCharacteristic(Characteristic.On)
                        .on('get', function(callback){
                            that.log("switch get status")
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        })
                        .on('set', that.setPowerState.bind(this));

                    return [informationService,this.switchService];
                    break;
                }

                case "Outlet":
                    this.outletService = new Service.Outlet(this.name);
                    this.getStatus(this.serviceName,this.outletService,this.request_power_url);
                    this.outletService
                        .getCharacteristic(Characteristic.On)
                        .on('get', function(callback){
                            that.log("Outlet get status");
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }

                        })
                        .on('set', that.setPowerState.bind(this))
                        // .setValue(this.getpowerstatus);

                    // that.outletService.getCharacteristic(Characteristic.On).setValue(status);


                    return [informationService,this.outletService];

                    break;

                case "Light":
                {
                    this.lightService = new Service.Lightbulb(this.name);
                    this.lightService
                        .getCharacteristic(Characteristic.On)
                        .on('get', function(callback){
                            that.log("Light get status")
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        })
                        .on('set', that.setPowerState.bind(this));

                    this.getStatus(this.serviceName,this.lightService,this.request_power_url);
                    return [informationService, this.lightService];

                    break;
                }
                case "Dimmer":
                {
                    this.dimmerService = new Service.Lightbulb(this.name);
                    this.dimmerService
                        .getCharacteristic(Characteristic.On)
                        // .on('get', function(callback){
                        //     that.log("dimmer get status")
                        //     if(that.getpowerstatus == 'true'){
                        //         callback(null,true)
                        //     }else {
                        //         callback(null,false)
                        //     }
                        // })
                        .on('set', that.setDimmerState.bind(this));

                    // Brightness Polling
                    this.dimmerService
                        .addCharacteristic(new Characteristic.Brightness())
                        .on('get', function(callback) {
                            that.log("dimmer get brightness")
                            callback(null,that.getbrightnesslever)
                        })
                        .on('set', that.setBrightness.bind(this));
                    // this.getStatus(this.serviceName,this.dimmerService,this.request_power_url);
                    this.getBrightness(this.serviceName,this.dimmerService,this.request_brightness_url);
                    return [informationService, this.dimmerService];
                    break;
                }

                case "Door":
                {
                    this.doorService = new Service.Door(this.name);
                    this.doorService
                        .getCharacteristic(Characteristic.CurrentPosition)
                        .on('get', function(callback) {
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        });

                    this.doorService
                        .getCharacteristic(Characteristic.TargetPosition)
                        .on('get', function(callback) {
                            callback(null,that.getpowerstatus)
                        })
                        .on('set', that.setPowerState.bind(this));

                    this.doorService
                        .getCharacteristic(Characteristic.PositionState)
                        .on('get', function(callback) {
                            callback(null,2)
                        });

                    return [informationService, this.doorService];
                    break;
                }

                case "Window":
                {
                    this.windowService = new Service.Window(this.name);
                    this.windowService
                        .getCharacteristic(Characteristic.CurrentPosition)
                        .on('get', function(callback) {
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        });

                    this.windowService
                        .getCharacteristic(Characteristic.TargetPosition)
                        .on('get', function(callback) {
                            callback(null,that.getpowerstatus)
                        })
                        .on('set', that.setPowerState.bind(this));

                    this.windowService
                        .getCharacteristic(Characteristic.PositionState)
                        .on('get', function(callback) {
                            callback(null,2)
                        });

                    return [informationService, this.windowService];
                    break;
                }

                case "GarageDoor":
                {
                    this.garageDoorService = new Service.GarageDoorOpener(this.name);
                    this.garageDoorService
                        .getCharacteristic(Characteristic.CurrentDoorState)
                        .on('get', function(callback) {
                            callback(null,that.getgaragedoorstatus.toString().toLowerCase() !='true'?Characteristic.CurrentDoorState.CLOSED:Characteristic.CurrentDoorState.OPEN)});

                    this.garageDoorService
                        .getCharacteristic(Characteristic.TargetDoorState)
                        .on('set', that.setGarageDoorState.bind(this));

                    this.garageDoorService
                        .getCharacteristic(Characteristic.ObstructionDetected)
                        .on('get', function(callback) {
                            callback(null,false)
                        });
                    this.getGarageDoorStatus(this.serviceName,this.garageDoorService,this.request_garagedoor_url);
                    return [informationService, this.garageDoorService];
                    break;
                }

                case "Lock":
                {
                    this.lockService = new Service.LockMechanism(this.name);
                    this.lockService
                        .getCharacteristic(Characteristic.LockCurrentState)
                        .on('get', function(callback) {
                            callback(null,that.getlockstatus.toString().toLowerCase() !='true'?Characteristic.LockCurrentState.SECURED:Characteristic.LockCurrentState.UNSECURED)
                        });


                    this.lockService
                        .getCharacteristic(Characteristic.LockTargetState)
                        .on('set', that.setLockState.bind(this));


                    this.getLockStatus(this.serviceName,this.lockService,this.request_lockstatus_url);
                    return [informationService, this.lockService];
                    break;
                }

                case "Contact":
                {
                    // this.contactService = new Service.ContactSensor(this.name);
                    // this.contactService
                    //     .getCharacteristic(Characteristic.ContactSensorState)
                    //     .on('get', function(callback) {
                    //         callback(null,that.state?Characteristic.ContactSensorState.CONTACT_DETECTED:Characteristic.ContactSensorState.CONTACT_NOT_DETECTED)
                    //     });
                    //
                    // return [informationService, this.contactService];
                    //
                    // this.getStatus(this.serviceName,this.curtainService,this.request_power_url);
                    break;
                }

                case "Doorbell":
                {
                    // this.cameraService = new Service.CameraRTPStreamManagement(this.name);
                    // this.doorbellService = new Service.Doorbell(this.name);
                    // this.doorbellService
                    //     .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                    //     .on('get', function(callback) {
                    //         callback(null,that.lastSent?1:0)});
                    //
                    // if( this.include_video )
                    //     return [informationService, this.doorbellService, this.cameraService];
                    // else
                    //     return [informationService, this.doorbellService];
                    break;
                }

                case "Motion":
                {
                    // this.montionService = new Service.MotionSensor(this.name);
                    // this.montionService
                    //     .getCharacteristic(Characteristic.MotionDetected)
                    //     .on('get', function(callback) {
                    //         callback(null,!that.state)
                    //     });

                    return [informationService, this.montionService];
                    break;
                }

                case "Fan":
                {
                    this.fanService = new Service.Fan(this.name);
                    this.fanService
                        .getCharacteristic(Characteristic.On)
                        .on('get', function(callback) {
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        })
                        .on('set', that.setPowerState.bind(this));

                    this.fanService
                        .addCharacteristic(new Characteristic.RotationSpeed())
                        .on('get', function(callback) {
                            callback(null,that.getfanspeedlever)
                        })
                        .on('set', that.setFanSpeed.bind(this))
                        .setProps({
                                minStep:25
                            });

                    this.getStatus(this.serviceName,this.fanService,this.request_power_url);
                    this.getFanSpeed(this.serviceName,this.fanService,this.request_fanspeed_url)
                    return [informationService, this.fanService];
                    break;
                }

                case "Security":
                {
                    // this.securityService = new Service.SecuritySystem(this.name);
                    // this.securityService
                    //     .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    //     .on('get', function(callback) {callback(null,that.secCurState)});
                    //
                    // this.securityService
                    //     .getCharacteristic(Characteristic.SecuritySystemTargetState)
                    //     .on('get', function(callback) {callback(null,that.secTarState)})
                    //     .on('set', that.setSecurityState.bind(this));
                    //
                    // return [informationService, this.securityService];
                    break;
                }

                case "Thermostat":
                {
                    break;
                }

                case "AC":
                {
                    this.acService = new Service.Thermostat(this.name);

                    this.acService
                        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                        .on('get', function(callback) {
                            that.log("Thermostat get current state: "+that.getmodelever);
                            callback(null,that.getmodelever)
                        });

                    this.acService
                        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                        .on('get', function(callback) {
                            that.log("Thermostat get target state: "+that.setmodelever);
                            callback(null,that.setmodelever)
                        })
                        .on('set', this.setThermostatTargetHeatingCoolingState.bind(this));

                    this.acService
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .on('get', function(callback) {
                            that.log("Thermostat get current temp: "+that.gettemperaturelever);
                            callback(null,that.gettemperaturelever)
                        });

                    this.acService
                        .getCharacteristic(Characteristic.TargetTemperature)
                        .on('get', function(callback)
                        {
                            that.log("Thermostat get current temp: "+that.settemperaturelever);
                            callback(null,that.settemperaturelever)
                        })
                        .on('set', that.setThermostatTargetTemp.bind(this));

                    this.acService
                        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
                        .on('get', function(callback) {
                            callback(null,true)
                        })
                        .on('set', function(state,callback) {
                            that.thermDisplayUnits = true;
                            callback();
                        });

                    this.acfanService = new Service.Fan(this.name);
                    this.acfanService
                        .getCharacteristic(Characteristic.On)
                        .on('get', function(callback) {
                            if(that.getpowerstatus == 'true'){
                                callback(null,true)
                            }else {
                                callback(null,false)
                            }
                        })
                        .on('set', that.setPowerState.bind(this));
                    this.acfanService
                        .addCharacteristic(new Characteristic.RotationSpeed())
                        .on('set', that.setACFanSpeed.bind(this))
                        .setProps({
                            minStep:25
                        });

                    this.getACStatus(this.serviceName,this.acService,this.request_power_url);


                    this.getThermostatHeatingCoolingState(this.serviceName,this.acService,this.request_mode_url)
                    this.getThermostatTemp(this.serviceName,this.acService,this.request_temperature_url)
                    this.getCurrentTemp(this.serviceName,this.acService,this.request_currenttemp_url)

                    this.getFanSpeed(this.serviceName,this.acfanService,this.request_fanspeed_url)
                    return [informationService, this.acService,this.acfanService];
                    break;
                }
                case "FloorHeater":
                {
                    this.floorHeaterService = new Service.Thermostat(this.name);
                    this.floorHeaterService
                        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                        .on('get', function(callback) {
                            that.log("Thermostat get current state: 2");
                            callback(null,that.getmodelever)
                        });

                    this.floorHeaterService
                        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                        .on('get', function(callback) {
                            that.log("Thermostat get current state: 2");
                            callback(null,that.getmodelever)
                        })
                        .on('set', that.setFloorHeaterStatus.bind(this));

                    this.floorHeaterService
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .on('get', function(callback) {
                            that.log("FloorHeater get current temp: "+that.gettemperaturelever);
                            callback(null,that.gettemperaturelever)
                        });

                    this.floorHeaterService
                        .getCharacteristic(Characteristic.TargetTemperature)
                        .on('get', function(callback) {
                            that.log("FloorHeater get target temp "+that.settemperaturelever);
                            callback(null,that.settemperaturelever);
                        })
                        .on('set', that.setThermostatTargetTemp.bind(this));

                    this.floorHeaterService
                        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
                        .on('get', function(callback) {
                            callback(null,true)
                        })
                        .on('set', function(state,callback) {
                            that.thermDisplayUnits = true;
                            callback();
                        });

                    this.getFloorHeaterStatus(this.serviceName,this.floorHeaterService,this.request_power_url);
                    this.getThermostatTemp(this.serviceName,this.floorHeaterService,this.request_temperature_url)
                    this.getCurrentTemp(this.serviceName,this.floorHeaterService,this.request_currenttemp_url)
                    return [informationService, this.floorHeaterService];
                    break;
                }

                case "Curtain":
                {
                    this.curtainService = new Service.WindowCovering(this.name);
                    this.curtainService
                        .getCharacteristic(Characteristic.CurrentPosition)
                        .on('get', function(callback) {
                            callback(null,that.getcurtainlever)
                        });

                    this.curtainService
                        .getCharacteristic(Characteristic.TargetPosition)
                        // .on('get', function(callback) {
                        //     callback(null,that.setcurtainlever)
                        // })
                        .on('set', this.setCurtainState.bind(this));

                    this.curtainService
                        .getCharacteristic(Characteristic.PositionState)
                        .on('get', function(callback) {
                            callback(null,0)
                        });

                    this.getCurtainStatus(this.serviceName,this.curtainService,this.request_curtainposition_url);
                    return [informationService, this.curtainService];
                    break;
                }
            }
        }
    };