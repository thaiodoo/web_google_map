/*global: openerp,document,setTimeout,alert */

openerp.web_google_map = function(instance) {

    console = window.console;

    function getFixedValue(element, editMode) {
        try {
            var fixedValue = editMode ? element.val() : element.get_value().toString();
            if (fixedValue === "")
                return 0;
            return parseFloat(fixedValue.replace(",", "."));
        } catch(e) {
            console.log(e);
        }
    }

    function getAddress() {
        var address = "";
        var addressElements = [
            $('input[name$="zip"]').val(),
            $('input[name$="street"]').val(),
            $('input[name$="street2"]').val(),
            $('input[name$="city"]').val(),
            $('input[name$="country_id_text"]').val(),
            $('input[name$="state_id_text"]').val()
        ];
        var separator = "";
        for (var i = 0; i < addressElements.length; i++) {
            if (addressElements[i]) {
                address += separator;
                address += addressElements[i];
                // Dirty but easy.
                separator = ", ";
            }
        }

        return address;
    }


    // Form widget

    instance.web_google_map.form = {};

    instance.web_google_map.form.FieldGoogleMap = instance.web.form.FieldChar.extend({
        template: 'GoogleMap',

        init: function (view, node) {
            this._super(view, node);

            // XXXvlab: all these fields should be part of the same widget
            this.edit_mode = true;
        },

        get_lat_lng: function() {
            return [
                getFixedValue(this.$latElement, this.edit_mode),
                getFixedValue(this.$lngElement, this.edit_mode)
            ];
        },

        get_lat_lng_elements: function() {
            this.widget_lat = this.view.fields.lat;
            this.widget_lng = this.view.fields.lng;
            if (this.edit_mode) {
                this.$latElement = $('[name$="lat"]');
                this.$lngElement = $('[name$="lng"]');
            } else {
                this.$latElement = this.widget_lat;
                this.$lngElement = this.widget_lng;
            }
        },

        start: function () {
            var self = this;
            this._super.apply(this, arguments);

            // XXXvlab: couldn't we put this just after rendering ?
            this.$canvas = this.$element.find("div#gmap");
            this.$msg_empty = this.$element.find("p.msg_empty");

            if (this.edit_mode) {
                this.$gc =      this.$element.find("button#gcb");
                this.$refresh = this.$element.find("button#refresh");
            }

            this.get_lat_lng_elements();

            try {
                $(document).ready(function () {
                    setTimeout(function() {
                        self.draw_map();
                    }, 1000);
                });

                if (this.edit_mode) {
                    this.$refresh.click(function () {
                        self.draw_map();
                    });
                    this.$gc.click(function () {
                        self.code_address();
                    });
                }
            } catch(e) {
                console.log(e);
            }
        },

        code_address: function () {
            var self = this;
            var address = getAddress();
            var geocoder = new google.maps.Geocoder();

            geocoder.geocode({'address': address}, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    self.set_lat_lng(results[0].geometry.location);
                } else {
                    alert("Geocode was not successful for the following reason: " +
                          status);
                }
            });
        },

        set_lat_lng: function (obj) {
            // object is google position object
            this.widget_lat.set_value(obj.lat());
            this.widget_lng.set_value(obj.lng());
            this.widget_lat.on_ui_change();
            this.widget_lng.on_ui_change();
            this.update_dom();
        },

        update_dom: function() {
            this._super.apply(this, arguments);
            this.draw_map();
        },

        draw_map: function () {
            var self = this;

            // Load google map api if necessary
            if (typeof(google) === "undefined" ||
                typeof(google.maps) === "undefined") {
                if (this.fetching_map_api === true) {
                    // console.log("inhibiting surnumerous call of drawmap");
                    return; // call already sent
                }
                this.fetching_map_api = true;
                window.ginit = function() { self.draw_map(); };
                $.getScript('//maps.googleapis.com/maps/api/js' +
                            '?sensor=false&async=true&callback=ginit');
                return;
            }

            var OPTIONS = {
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };

            try {

                var lat_lng = this.get_lat_lng();
                if (lat_lng[0] === 0 || isNaN(lat_lng[0]) || lat_lng[1] === 0 ||
                    isNaN(lat_lng[1])) {
                    this.$msg_empty.show();
                    this.$canvas.hide();
                    return;
                }

                var point = new google.maps.LatLng(lat_lng[0], lat_lng[1]);
                this.$msg_empty.hide();
                this.$canvas.show(500, function() {
                    // XXXvlab: cache this object !
                    var map = new google.maps.Map(self.$canvas[0], OPTIONS);
                    var marker = new google.maps.Marker({
                        'map': map,
                        'position': point,
                        'draggable': self.edit_mode
                    });
                    if (self.edit_mode)
                        google.maps.event.addListener(marker, "dragend", function() {
                            self.set_lat_lng(marker.getPosition());
                        });
                    map.setCenter(point);
                });
            } catch (e) {
                console.log(e);
            }
        }

    });

    instance.web.form.widgets = instance.web.form.widgets.extend({
        'gmap': 'openerp.web_google_map.form.FieldGoogleMap',
    });

    // Page widget

    instance.web_google_map.page = {};

    instance.web_google_map.page.FieldGoogleMap = instance.web_google_map.form.FieldGoogleMap.extend({
        template: 'GoogleMapReadonly',

        init: function (view, node) {
            this._super(view, node);
            this.edit_mode = false;
        },

    });

    instance.web.page.readonly = instance.web.page.readonly.extend({
        'gmap': 'openerp.web_google_map.page.FieldGoogleMap',
    });

};

// function load_js(urls) {
//   var self = this;
//   var d = $.Deferred();
//   if(urls.length != 0) {
//     var url = urls.shift();
//     var tag = document.createElement('script');
//     tag.type = 'text/javascript';
//     tag.src = url;
//     tag.onload = tag.onreadystatechange = function() {
//       if ( (tag.readyState && tag.readyState != "loaded" && tag.readyState != "complete") || tag.onload_done )
//         return;
//       tag.onload_done = true;
//       load_js(urls).then(function () {
//           d.resolve();
//         });
//     };
//     var head = document.head || document.getElementsByTagName('head')[0];
//     head.appendChild(tag);
//   } else {
//     d.resolve();
//   }
//   return d;
// };

// load_js(['http://maps.googleapis.com/maps/api/js?sensor=false',])
//     .then(on_google_loaded);


